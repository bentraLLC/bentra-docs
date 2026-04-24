# Hosting Architecture

!!! note "Decision — 2026-04-15"
    **Azure Container Apps (Consumption Plan)** — chosen for lowest cost with variable workloads.

    Target: **~$40–55/month** at early scale.

## Control Plane (Bentra-owned)

All in one Container Apps Environment:

- Django web app (min 1 replica — always on)
- Log consumer (`consume_workflow_logs` management cmd — long-running container)
- VCS credentials consumer (`consume_vcs_credentials` — long-running container)
- OpenBao (Azure Files volume for secret persistence)

Supporting services:

- Azure Database for PostgreSQL Flexible Server — B1ms (1 vCPU, 2 GB)
- Azure Blob Storage — static files (via `django-storages`)
- Azure Container Registry — Basic tier

## Client-side (customer-hosted)

- Runners sit behind customer firewall
- Runners connect **outbound only** to Bentra's REST API over HTTPS (port 443)
- Per-org authentication / isolation enforced at the API layer

!!! success "Unblocked after RabbitMQ removal"
    The prior design required runners to connect outbound on AMQPS (port 5671), which created firewall friction for customers. The [RabbitMQ → REST migration](../subprojects/rabbitmq-rest-migration.md) replaced all four RabbitMQ patterns with REST, so runners now need port 443 only.

## What to Test

- [ ] RabbitMQ persistence across container restarts with Azure Files mount — _(no longer applicable; RabbitMQ removed)_
- [ ] Django Container App cold start time with gunicorn (min-replicas: 1 should avoid this)
- [ ] Long-running consumer containers stay alive without health check issues
- [ ] OpenBao token auth from runners over public HTTPS endpoint
- [ ] Static file serving from Azure Blob Storage (`django-storages[azure]`)
- [ ] Per-org isolation — one org's runner cannot consume another org's jobs
