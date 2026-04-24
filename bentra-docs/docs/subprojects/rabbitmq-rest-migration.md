# RabbitMQ → REST API Migration

!!! success "Completed — 2026-04-23"

## Description

Replace all four RabbitMQ usage patterns in Bentra with a REST API. Client-hosted runners will connect to the control plane over HTTPS (port 443) instead of AMQPS (port 5671), eliminating the firewall exposure problem and removing RabbitMQ as a hosted component.

## Goals

- Remove RabbitMQ from the control plane entirely
- Runners connect outbound on port 443 only — no special firewall rules
- Maintain same functional contract: job dispatch, log streaming, result reporting, VCS credential fetching
- Keep job state in PostgreSQL (already the source of truth via `Deployment` / `DeploymentRun` models)

## Current RabbitMQ Patterns → REST Replacements

| Pattern | File | Replacement |
|---|---|---|
| Job dispatch (Django → Runner) | `deployments/rabbitmq_producer.py`, `workflows/rabbitmq_producer.py` | Runner polls `GET /api/v1/jobs/next` (long-poll, 30s) |
| Results (Runner → Django) | `workflows/rabbitmq_consumer.py` | Runner posts `POST /api/v1/runs/{id}/complete` |
| Log streaming (Runner → Django) | `deployments/log_consumer.py` | Runner posts `POST /api/v1/runs/{id}/logs` |
| VCS credentials RPC (Runner ↔ Django) | `vcs_connectors/rabbitmq_credentials_consumer.py` | Runner calls `GET /api/v1/connectors/{id}/token` |

## Architecture

### Control Plane (Django)

New API endpoints (authenticated, runner tokens):

- `GET /api/v1/jobs/next` — long-poll, returns next QUEUED job for org, locks it
- `POST /api/v1/runs/{run_id}/logs` — accepts log batch payload
- `POST /api/v1/runs/{run_id}/complete` — accepts final status + steps
- `GET /api/v1/connectors/{connector_id}/token` — returns short-lived VCS token

Job locking: DB-level `select_for_update()` to prevent two runners grabbing the same job.

### Runner Side

- Replace `pika` with `requests` (or `httpx`)
- Poll for jobs on startup, re-poll immediately after completion
- Stream logs in batches via POST during execution
- Fetch VCS token at start of run via GET

## Outcome

All control-plane code shipped in `bento/runners/` with **49 Django TestCase tests** (models, auth, 4 views, serializer, data migration). A Postgres-specific bug in `NextJobView` (`select_for_update` across nullable joins) was found and fixed during the test pass via `of=("self",)`. Residual `pika` references and the `CHAT.md` scratch file were cleaned up.

The [Azure Hosting Spike](azure-hosting/index.md) is now **unblocked** — runners connect outbound over HTTPS:443 only, and RabbitMQ is no longer a hosted control-plane component.

## Deferred

- Stale-job recovery on runner crash (needs heartbeat/reaper)
- Client-side runner image migration (lives in `bento-kubernetes-deployments/`)
