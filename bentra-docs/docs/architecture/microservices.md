# Microservices & Sidecars

Bentra's control plane is a Django web app, but it doesn't run alone. This page enumerates **everything that runs alongside `python manage.py runserver`** in local development and in a deployed control plane.

## Processes to Start (Local Dev)

The minimum set of processes for a functional dev environment is:

| Process | Port | Required | What it is |
|---|---|---|---|
| **Django web app** (`runserver`) | 8000 | yes | The control plane. Serves UI + both REST APIs. |
| **PostgreSQL** | 5432 | yes | Source of truth. Either local (`brew services start postgresql@17`) or port-forwarded from Kubernetes. |
| **OpenBao** | 8200 | yes* | Vault-compatible KV store for secrets. Can be skipped in tests with `OPENBAO_SKIP_AUTH_CHECK=1`. |
| **Script Executor** (Flask) | 5001 | optional | Needed only if you're using form auto-populate scripts. |
| **Runner(s)** | — | optional | External. Poll the Django API for jobs. Not required to browse the UI or make submissions. |

## Django Web App

```bash
python bento/manage.py runserver
# http://localhost:8000/orgs/
```

- Entry point: `bento/manage.py`; project settings at `bento/bento/settings.py`.
- Renders the UI + serves two REST APIs:
  - **User-facing**: `/orgs/{slug}/api/v1/` (DRF, `ApiTokenAuthentication`)
  - **Runner-facing**: `/api/v1/runner/` (DRF, `RunnerTokenAuthentication`)
- Uses Django 6.0.1 + DRF 3.16.0.
- Does **not** run any background threads — the REST migration eliminated the need for in-process consumers. All work is either synchronous request handling or runner-driven.

## Script Executor (Flask, port 5001)

A standalone microservice living in `executor/`.

### What it does

Executes user-defined `calculate(form_data, params)` scripts for form auto-populate fields. Supports Python, JavaScript, and Bash. Django proxies to it over HTTP.

### Starting it

```bash
cd executor
python app.py
# http://localhost:5001/health
```

Configurable via env vars:

- `PORT` — defaults to 5001.
- `EXECUTION_TIMEOUT` — defaults to 5 seconds.
- `MAX_OUTPUT_SIZE` — defaults to 10,000 chars.

Dependencies are in `executor/requirements.txt` (separate from the Django requirements).

### Why it's separate

Running arbitrary user code inside the Django process is a security and stability risk. The executor:

- Runs each script in a subprocess with a hard timeout.
- Truncates stdout/stderr to `MAX_OUTPUT_SIZE`.
- Has no network access by default.
- Is stateless — no shared state between executions.

JavaScript execution requires Node.js to be installed on the host.

### Django integration

Django calls the executor from `forms/views.py` via the `/forms/<slug>/execute-script/` endpoint. The Django setting `SCRIPT_EXECUTOR_URL` controls the destination (default `http://localhost:5001`).

## PostgreSQL

The canonical source of truth.

### Local dev options

**Option A — local install (recommended for simplicity):**

```bash
brew install postgresql@17
brew services start postgresql@17
createdb postgres
```

**Option B — Kubernetes port-forward** (if you're running the `bento-kubernetes-deployments` repo):

```bash
cd ../bento-kubernetes-deployments
./start-port-forwards.sh
```

Either way, Django connects via the settings default:

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "postgres",
        "USER": "connor",
        "PASSWORD": "",
        "HOST": "localhost",
        "PORT": "5432",
    }
}
```

### Migrations

```bash
python bento/manage.py migrate
```

## OpenBao

Bentra uses OpenBao (a Vault fork / drop-in) as its secret backend. The HVAC client is initialized at Django settings import time.

### Starting it (dev)

Run an OpenBao dev server however you like — typically:

```bash
openbao server -dev
# sets OPENBAO_TOKEN from stdout
```

Then export:

```bash
export OPENBAO_URL=http://localhost:8200
export OPENBAO_TOKEN=<dev-token-from-stdout>
export ORG_ID=<your-dev-org-uuid>
```

### Skipping the auth check

The settings file runs a `client.is_authenticated()` check on import. If you're running tests or an offline task where OpenBao isn't available:

```bash
export OPENBAO_SKIP_AUTH_CHECK=1
```

In `DEBUG=True`, the auth check failure is downgraded to a warning automatically.

### Path scheme

See [Integrations § OpenBao](integrations.md#openbao) for the full path scheme. Each org gets its own mount point (the org UUID), so you can have multiple tenants with non-overlapping secret namespaces in a single OpenBao instance.

## Runners (External)

Runners are **not part of this repo's dev loop**. They're Docker images that run in the customer's infrastructure — or for end-to-end testing, on your own machine or Kubernetes cluster.

Runner source lives in `bento-kubernetes-deployments/runners/`. Deployment to a local Kind cluster:

```bash
cd ../bento-kubernetes-deployments/runners
./deploy.sh --kind desktop
```

Runners authenticate using a `RunnerToken` issued from the Settings UI. You do not need runners running to submit forms and see them land in the Deployments UI — the deployment will just stay in `QUEUED`.

## Typical Dev Shell Setup

Five terminals (or a process manager) for the full stack:

```bash
# Terminal 1 — PostgreSQL (skip if using local brew services)
cd ../bento-kubernetes-deployments && ./start-port-forwards.sh

# Terminal 2 — OpenBao
openbao server -dev

# Terminal 3 — Django
source .venv/bin/activate
python bento/manage.py runserver

# Terminal 4 — Script Executor (optional; only if using form scripts)
cd executor && python app.py

# Terminal 5 — Runner (optional; only for end-to-end flow)
cd ../bento-kubernetes-deployments/runners && ./deploy.sh --kind desktop
```

## Production Topology

See [Hosting Architecture](hosting.md) for the Azure Container Apps plan. In short:

- Django gets its own Container App (min 1 replica for always-on).
- OpenBao gets its own Container App with an Azure Files volume for persistence.
- PostgreSQL is Azure Database for PostgreSQL Flexible Server (B1ms).
- Script Executor runs as a separate Container App (minimal resources; mostly idle).
- Runners run **in the customer's environment**, not Bentra's.

There are no long-running Django consumer containers to deploy anymore — the REST migration removed them.
