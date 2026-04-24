# Azure Hosting Spike

!!! info "Status — Active (unblocked 2026-04-23)"
    Resumed 2026-04-15. The RabbitMQ dependency was removed via the [REST migration](../rabbitmq-rest-migration.md); architecture now assumes **port 443 only** for runner connectivity.

## Description

Design and build the Azure hosting infrastructure for the Bentra control plane. Goal is the cheapest viable production deployment on Azure Container Apps.

## Goals

- Architecture and networking design
- Full infrastructure-as-code via Terraform
- CI/CD pipeline for infra and app deployments
- Logging and monitoring strategy
- Defined production readiness criteria

## Architecture Decision

**Azure Container Apps (Consumption Plan)** — ~$40–55/month target. See the [Hosting Architecture](../../architecture/hosting.md) page for the full breakdown.

Control plane in one Container Apps Environment:

- Django (min 1 replica)
- OpenBao (Azure Files volume)
- Log consumer (long-running container)
- VCS credentials consumer (long-running container)

Supporting services:

- Azure Database for PostgreSQL Flexible Server — B1ms
- Azure Blob Storage — static files (`django-storages`)
- Azure Container Registry — Basic tier

Runners are customer-hosted and connect outbound to the control plane on port 443 only.

## Work Areas

| Area | Summary | Status |
|------|---------|--------|
| [Infra & Networking](infra-networking.md) | Resource layout, VNet, DNS, firewall rules | active |
| [Terraform & CI/CD](terraform-cicd.md) | IaC modules and deployment pipelines | active |
| [Logging](logging.md) | Log aggregation and retention strategy | active |
| [Monitoring](monitoring.md) | Metrics, alerts, and on-call policy | active |
| [Production State](production-state.md) | Readiness checklist, runbooks, SLAs, backups | active |
