# Development

Quick reference for getting Bentra running locally. For the full guide, see `docs/DEVELOPMENT.md` in the Bento repo.

## Prerequisites

- **Python 3.12+** (3.13 not yet supported by `psycopg2`)
- **Node.js** (for JavaScript script execution in the executor)
- **PostgreSQL 17** (local install or Kubernetes port-forward)
- **OpenBao** (dev server is fine)
- **Git**

## Quick Start

```bash
# 1. Python environment
pyenv install 3.12.12
pyenv local 3.12.12
python -m venv .venv
source .venv/bin/activate

# 2. Dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 3. Database — pick one:
# Option A: local Postgres
brew install postgresql@17
brew services start postgresql@17

# Option B: Kubernetes port-forward
cd ../bento-kubernetes-deployments && ./start-port-forwards.sh

# 4. OpenBao (in its own terminal)
openbao server -dev
export OPENBAO_URL=http://localhost:8200
export OPENBAO_TOKEN=<dev-token-from-openbao-output>

# 5. Django setup
python bento/manage.py migrate
python bento/manage.py createsuperuser

# 6. Run the web app
python bento/manage.py runserver

# 7. Script executor (optional, separate terminal)
cd executor && python app.py
```

Then visit:

- **App**: http://localhost:8000/orgs/ (redirects to org selection)
- **Admin**: http://localhost:8000/admin/
- **Executor health**: http://localhost:5001/health

See [Microservices](architecture/microservices.md) for the full set of processes that make up a local dev environment.

## Common Commands

### Django management

```bash
python bento/manage.py runserver            # dev server
python bento/manage.py migrate              # apply migrations
python bento/manage.py makemigrations       # create migrations
python bento/manage.py createsuperuser      # admin user
python bento/manage.py shell                # Django shell
python bento/manage.py dbshell              # Postgres shell
python bento/manage.py check                # sanity checks
python bento/manage.py showmigrations       # migration status
python bento/manage.py collectstatic        # collect static files
```

!!! warning "Gone after the REST migration"
    These management commands **no longer exist**:

    - `consume_workflow_results`
    - `consume_workflow_logs`
    - `consume_vcs_credentials`

    They were replaced by the runner REST API. Don't add them back — use the HTTP endpoints in `bento/runners/views.py`.

### Testing

```bash
pytest                                      # all tests
pytest bento/workflows/tests.py             # one app
pytest -k "test_workflow_creation"          # by name
pytest -m unit                              # only unit tests
pytest -m integration                       # only integration tests
pytest --cov                                # with coverage
pytest --cov --cov-report=html              # HTML report in htmlcov/
python bento/manage.py test                 # Django's test runner
```

Tests run against a temporary database. OpenBao auth check is automatically skipped during tests (or you can set `OPENBAO_SKIP_AUTH_CHECK=1`).

### Code quality

```bash
black .                                     # format (line-length 100)
flake8 .                                    # lint (max-complexity 10)
mypy .                                      # type-check (django-stubs)
isort .                                     # sort imports
pre-commit run --all-files                  # all hooks
pre-commit install                          # install git hook
```

## URL Map

| Path | Purpose |
|---|---|
| `/` | Redirects to `/orgs/` |
| `/accounts/login/` | Auth |
| `/accounts/post-login/` | Post-login redirect (to org selection or last org) |
| `/orgs/` | Org picker / create |
| `/orgs/{org_id}/workflows/` | Workflow management |
| `/orgs/{org_id}/forms/` | Form definitions |
| `/orgs/{org_id}/requests/` | Request (submission) tracking |
| `/orgs/{org_id}/deployments/` | Deployment tracking + IAC workspace |
| `/orgs/{org_id}/variable-collections/` | Variable collections |
| `/orgs/{org_id}/members/` | Org membership management |
| `/orgs/{org_id}/settings/` | VCS connectors, API tokens, runner tokens |
| `/orgs/{org_id}/dashboard/` | Per-org dashboard |
| `/orgs/{org_id}/api/v1/` | User-facing REST API (API-token auth) |
| `/api/v1/runner/` | Runner REST API (runner-token auth) |
| `/admin/` | Django admin |

## Environment Variables

| Var | Default | Notes |
|---|---|---|
| `OPENBAO_URL` | `http://localhost:8200` | OpenBao endpoint |
| `OPENBAO_TOKEN` | `<dev-token>` | HVAC auth token |
| `OPENBAO_SKIP_AUTH_CHECK` | (unset) | Skip init-time auth check (tests / offline) |
| `ORG_ID` | `bento` | Legacy/fallback mount point when no org is passed to OpenBao helpers |
| `SECRET_KEY` | (insecure dev default in `settings.py`) | Must be overridden in production |
| `DEBUG` | `True` | Turn off in production |

The `settings.py` file also exposes runner polling knobs:

```python
RUNNER_POLL_TIMEOUT = 30    # seconds a single long-poll blocks
RUNNER_POLL_INTERVAL = 2    # seconds between claim attempts within the poll
```

Override in tests to keep them fast.

## Creating an Initial Setup

From a fresh database:

1. `migrate` (creates all tables + seeds runner pools via data migration).
2. `createsuperuser` — you'll be a superuser, which bypasses org membership checks.
3. Log in at `/accounts/login/`, create an org at `/orgs/new/`.
4. Join the org (superusers are auto-granted access; regular users need an `OrganizationMembership`).
5. Add a VCS connector at `/orgs/{org_id}/settings/` — choose GitHub, paste a PAT or upload a GitHub App private key.
6. Create a workflow — Bentra will seed `.bento/form/form.yml` + `.bento/workflow/workflow.yml` in the target repo.
7. Submit the form → a `Request` is created → if approvers aren't required, a `Deployment` is queued immediately.
8. Issue a `RunnerToken` in the Settings UI, deploy a runner container with that token, and watch the deployment move through `QUEUED → RUNNING → SUCCESS`.

## Troubleshooting

**Port already in use**

```bash
lsof -i :8000
kill -9 <PID>
```

**Postgres connection refused** — check either `brew services list` or the Kubernetes port-forward: `ps aux | grep port-forward`.

**OpenBao `Failed setup connection`** — either start OpenBao, or export `OPENBAO_SKIP_AUTH_CHECK=1` to bypass the startup check.

**Migration conflicts** — `python bento/manage.py showmigrations` to see state; `--fake` individual migrations if needed.
