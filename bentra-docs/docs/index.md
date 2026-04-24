# Bentra

Django-based infrastructure workflow automation platform. Converts complex infrastructure deployments into form-driven UIs so development teams can create, manage, deploy, and monitor workflows without deep infra expertise.

## Tech Stack

- **Backend**: Django 6.0.1, PostgreSQL (prod) / SQLite (dev), Django REST Framework
- **Frontend**: Vanilla JS/CSS, no build process
- **Executor**: Flask microservice (port 5001) for sandboxed Python/JS/Bash script execution
- **Infra**: Kubernetes, KEDA (auto-scales runners 0–10)
- **Integrations**: OpenBao (secrets via HVAC), GitHub API

## Goals

- Form-driven deployments — convert infrastructure tasks into interactive user-facing forms
- Real-time deployment monitoring and status tracking
- Multi-language script support (Python, JavaScript, Bash)
- Secret management via OpenBao
- GitHub integration for templated repository creation
- Approval workflows with lifecycle tracking
- Multi-tenant RBAC architecture

!!! info "Current Status"
    Active development. The **RabbitMQ → REST API migration** was completed on **2026-04-23**, which unblocks the **Azure Hosting Spike** (runners now connect outbound on port 443 only).

    Next up: resume the [Azure Hosting Spike](subprojects/azure-hosting/index.md).

    See the [Roadmap](roadmap.md) for active work, or the [Journal](journal.md) for dated entries.

## Where to go next

- **New to the codebase?** Start with [System Overview](architecture/overview.md) for the big picture, then [Django Apps](architecture/apps.md) for app-by-app detail.
- **Setting up locally?** [Development](development.md) has the quickstart, and [Microservices](architecture/microservices.md) lists every process you need to run.
- **Integrating with Bentra?** See [REST APIs](architecture/rest-api.md) for both the user-facing and runner APIs.
- **Understanding the data model?** [Data Model](architecture/data-model.md) covers every model and how they relate.
- **Building a runner?** [Runner Execution Model](architecture/runners.md) has the claim flow and full job payload.
