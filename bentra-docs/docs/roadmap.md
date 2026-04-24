# Roadmap

Rolled up from active work across Bentra and its subprojects.

## Top-level: Azure Hosting Spike

Integration tests to run once infra is up:

- [ ] Provision Azure Container Apps environment
- [ ] Deploy OpenBao container — test runner token auth over public HTTPS
- [ ] Wire `django-storages[azure]` for static file serving from Blob Storage
- [ ] Deploy Django app — verify gunicorn startup, min-replicas: 1
- [ ] Deploy log consumer and VCS consumer as long-running containers — verify they stay alive
- [ ] Validate per-org isolation in the REST API

## Infra & Networking

See [area page](subprojects/azure-hosting/infra-networking.md).

- [ ] Define resource group and subscription layout
- [ ] Design Container Apps Environment networking (VNet integration, ingress)
- [ ] Document runner-to-control-plane connectivity model (outbound only, port 443)
- [ ] Decide DNS strategy for public endpoints (Django, OpenBao)
- [ ] Define NSG / firewall rules

## Terraform & CI/CD

See [area page](subprojects/azure-hosting/terraform-cicd.md).

- [ ] Choose Terraform state backend (Azure Storage account)
- [ ] Write Terraform module for Container Apps Environment
- [ ] Write Terraform modules for supporting services (PostgreSQL, Blob Storage, ACR)
- [ ] Write Terraform for OpenBao container app
- [ ] Write Terraform for Django, log consumer, VCS consumer container apps
- [ ] Define CI/CD pipeline for infra changes (plan → apply gated on PR merge)
- [ ] Define CI/CD pipeline for app container builds and deploys
- [ ] Handle secrets injection (Key Vault references or env vars at deploy time)

## Logging

See [area page](subprojects/azure-hosting/logging.md).

- [ ] Decide log aggregation tool (Azure Log Analytics vs. third-party e.g. Grafana Loki)
- [ ] Configure Container Apps to emit structured logs to chosen backend
- [ ] Define log retention policy (cost vs. debuggability tradeoff)
- [ ] Verify workflow execution logs flow correctly in new architecture (no RabbitMQ log consumer)
- [ ] Make logs queryable — define key queries for debugging common issues

## Monitoring

See [area page](subprojects/azure-hosting/monitoring.md).

- [ ] Identify key health metrics (Django uptime, consumer liveness, DB connections, queue depth)
- [ ] Set up uptime / availability checks for public endpoints (Django, OpenBao)
- [ ] Configure alerts for container crashes and restarts
- [ ] Configure alerts for DB unreachable / connection pool exhaustion
- [ ] Decide monitoring tooling (Azure Monitor vs. Grafana Cloud vs. other)
- [ ] Define alerting policy — who gets paged and when

## Production State

See [area page](subprojects/azure-hosting/production-state.md).

- [ ] Define production readiness checklist (security, reliability, observability gates)
- [ ] Document PostgreSQL backup and restore procedure
- [ ] Document OpenBao backup and restore procedure
- [ ] Define scaling strategy and cost model at 10 / 50 / 100 customers
- [ ] Write runbook: deploy, rollback, secret rotation
- [ ] Define SLA targets
- [ ] Security review — exposed endpoints, secrets handling, tenant isolation
