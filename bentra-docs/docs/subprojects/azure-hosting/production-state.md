# Production State

## Description

Define what "production ready" looks like for the Bentra Azure control plane — the criteria that must be met before going live with a real customer.

## Goals

- Define production readiness checklist
- Document backup and restore procedures (PostgreSQL, OpenBao, Blob Storage)
- Define scaling strategy (when and how to scale beyond the baseline ~$40–55/month)
- Document runbook for common operational tasks (deploy, rollback, secret rotation)
- Define SLA targets

## Todos

- [ ] Define production readiness checklist (security, reliability, observability gates)
- [ ] Document PostgreSQL backup and restore procedure
- [ ] Document OpenBao backup and restore procedure
- [ ] Define scaling strategy and cost model at 10 / 50 / 100 customers
- [ ] Write runbook: deploy, rollback, secret rotation
- [ ] Define SLA targets
- [ ] Security review — exposed endpoints, secrets handling, tenant isolation
