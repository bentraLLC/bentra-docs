# System Overview

Bentra is a Django control plane with a sidecar script executor and a fleet of external runners. This page describes how the pieces fit together.

## High-Level Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                       Bentra Control Plane                    │
│                                                               │
│   ┌─────────────────┐      ┌─────────────────┐                │
│   │  Django Web App │◄────►│   PostgreSQL    │                │
│   │  (gunicorn/     │      │   (source of    │                │
│   │   runserver)    │      │    truth)       │                │
│   └────────┬────────┘      └─────────────────┘                │
│            │                                                  │
│            │ HTTP (internal)         ┌─────────────────┐      │
│            └────────────────────────►│ Script Executor │      │
│                                      │   (Flask :5001) │      │
│                                      └─────────────────┘      │
│                                                               │
│                         ┌─────────────────┐                   │
│                         │    OpenBao      │                   │
│                         │   (HVAC :8200)  │                   │
│                         └─────────────────┘                   │
└───────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS / port 443 (outbound only)
                              │ Bearer rnr_... tokens
                              │
             ┌────────────────┼────────────────┐
             │                │                │
     ┌───────▼─────┐  ┌───────▼─────┐  ┌───────▼─────┐
     │  Runner(s)  │  │  Runner(s)  │  │  Runner(s)  │
     │ (customer-  │  │ (customer-  │  │ (customer-  │
     │   hosted)   │  │   hosted)   │  │   hosted)   │
     └─────────────┘  └─────────────┘  └─────────────┘

                         ┌─────────────────┐
                         │  GitHub (API)   │
                         │  (PAT / App)    │
                         └─────────────────┘
```

## Core Pieces

| Component | What it is | Scope |
|---|---|---|
| **Django web app** | The control plane. Renders the UI, serves two REST APIs (user-facing and runner-facing), enforces RBAC, orchestrates requests → deployments. | Bentra-hosted |
| **PostgreSQL** | Single source of truth. All lifecycle state (requests, deployments, runs, log lines) lives here. | Bentra-hosted |
| **OpenBao** | Vault-compatible secret store. Holds VCS tokens and variable-collection secrets. Accessed via HVAC. | Bentra-hosted |
| **Script executor** | Flask microservice on port 5001. Runs user-defined Python/JavaScript/Bash `calculate(form_data, params)` scripts for form auto-populate. | Bentra-hosted sidecar |
| **Runners** | Docker containers that execute workflow jobs (Terraform, OpenTofu, generic scripts). Poll the control plane for work over HTTPS. | **Customer-hosted** |
| **GitHub** | Stores workflow repositories (workflow YAML, form YAML, IaC code). Integrated via PAT or GitHub App. | External |

## Request Lifecycle

The canonical flow from "user fills out a form" to "deployment finished":

```
┌────────┐   1. submit form   ┌─────────┐   2. approve   ┌──────────┐
│  User  │ ─────────────────► │ Request │ ─────────────► │ APPROVED │
└────────┘                    └─────────┘                └─────┬────┘
                                                               │ 3. trigger_execution()
                                                               ▼
                                                   ┌─────────────────────┐
                                                   │ WorkflowExecution   │ (PENDING)
                                                   │ Deployment          │ (QUEUED)
                                                   │ Request             │ (EXECUTING)
                                                   └──────────┬──────────┘
                                                              │
                                                              │ 4. runner polls
                                                              │    GET /api/v1/runner/jobs/next/
                                                              ▼
                            ┌──────────────────────────────────────────────┐
                            │ Deployment claimed atomically                │
                            │  - status → RUNNING                          │
                            │  - DeploymentRun created (attempt N)         │
                            │  - job payload returned to runner            │
                            └──────────────────────────┬───────────────────┘
                                                       │
                                                       │ 5. runner executes
                                                       ▼
                            ┌──────────────────────────────────────────────┐
                            │ POST /api/v1/runner/runs/{job_id}/logs/      │ (streaming)
                            │ GET  /api/v1/runner/connectors/{id}/token/   │ (mid-run)
                            │ POST /api/v1/runner/runs/{job_id}/complete/  │ (final)
                            └──────────────────────────┬───────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ All of:         │
                                              │  Run            │ → SUCCESS/FAILED/TIMEOUT
                                              │  Deployment     │
                                              │  Execution      │
                                              │  Request        │ → COMPLETED/FAILED
                                              └─────────────────┘
```

### Key Guarantees

- **Atomic job claim** — `select_for_update(skip_locked=True)` ensures two runners never pick up the same deployment.
- **Pool isolation** — a runner only sees deployments whose `runner_pool` matches its authenticated token's pool (or null, if the token's pool is the org default).
- **Org isolation** — every runner endpoint scopes queries by `token.organization`.
- **DB is authoritative** — there is no in-flight queue. If the process dies, state is reconstructible from `Deployment` + `DeploymentRun` rows.

## Two REST APIs

Bentra exposes two separate REST surfaces, each with its own authentication scheme:

### User-facing API (`api` app)

- **Mount**: `/orgs/{org_id}/api/v1/`
- **Auth**: `Bearer <api-token>` (SHA-256 hashed `ApiToken`, scoped to permissions like `read:workflows`)
- **Purpose**: Read-only access for integrations (list workflows, list deployments)
- **Scoped by**: the organization in the URL slug + the token's permissions

### Runner API (`runners` app)

- **Mount**: `/api/v1/runner/`
- **Auth**: `Bearer rnr_<prefix>_<hex>` (SHA-256 hashed `RunnerToken`, scoped to a `RunnerPool`)
- **Purpose**: Machine-to-machine job dispatch, log streaming, result ingestion, VCS token fetching
- **Scoped by**: `organization` + `pool` derived from the token

The runner API intentionally sits **outside** the org middleware — it does not have a `/orgs/{org_id}/` prefix. Org resolution is done entirely from the bearer token.

## Multi-Tenant Architecture

Every user-facing URL is scoped to an organization via slug:

```
/orgs/{org_id}/workflows/
/orgs/{org_id}/forms/
/orgs/{org_id}/deployments/
/orgs/{org_id}/settings/
/orgs/{org_id}/variable-collections/
/orgs/{org_id}/api/v1/
```

`OrganizationMiddleware` resolves `{slug}` → `request.organization`, checks membership, and 404s on unknown slugs. All data models carry an `organization` FK, and queries must filter on it (directly or through RBAC helpers like `get_accessible_workflows`).

## What This Is Not

- **Not a runner** — Bentra does not execute Terraform/OpenTofu itself. Runners do, in the customer's environment.
- **Not a secret store** — Bentra proxies to OpenBao; it never persists plaintext secrets in its own DB.
- **Not a queue broker** — jobs live in Postgres; runners poll.
