# Integrations

Bentra integrates with three external systems: **GitHub** (source of truth for workflow + form YAML), **OpenBao** (all plaintext secrets), and the **Script Executor** microservice (sandboxed code execution for form auto-populate).

## GitHub

All workflow/form definitions live in customer GitHub repos. Bentra reads them at the right moment and never writes secrets back.

### Where Workflow/Form YAML Lives

A Bentra workflow is bound to a `GithubRepository` with these relevant fields:

- `repo_url`, `repo_branch`, `repo_working_directory`
- `form_file_path` (default: `.bento/form/form.yml`)
- `workflow_file_path` (default: `.bento/workflow/workflow.yml`)
- `deploy_directory` (default: `.`) — the subdirectory the runner `cd`s into to run Terraform.

When a workflow is created, Bentra can call `bootstrap_bento_structure()` / `create_bento_structure_pr()` to seed those two YAML files.

### Auth Modes

Two auth modes are supported, captured in `settings.VCSConnector`:

**Personal Access Token (`auth_type = 'pat'`)**

- Token stored in OpenBao at `VCSConnector.openbao_secret_path`, under a `{"token": "..."}` secret.
- Fetched by `get_github_token_for_connector()` via `read_kv_v2_secret()`.
- Validated on save via `validate_pat_credentials()` (hits `/user`).

**GitHub App (`auth_type = 'github_app'`)**

- App ID stored in the connector (`client_id` field).
- Installation ID + PEM private key stored in OpenBao at `openbao_secret_path`.
- On every token fetch, Bentra mints a short-lived installation token via `_mint_github_app_installation_token()`:
  1. Signs an RS256 JWT with the PEM key (`_create_github_app_jwt()`).
  2. POSTs to `/app/installations/{installation_id}/access_tokens` with that JWT.
  3. Returns the installation token (expires in 1 hour).
- Validated on save via `validate_github_app_credentials()`.

### Service Layer

Two key files:

- **`vcs_connectors/github_service.py`** — `GitHubService` class + module-level helpers. No Django models live in this app.
- **`vcs_connectors/provider.py`** — starting point of a provider-abstraction layer. GitHub is the only implementation today.

Key entry points used elsewhere in the codebase:

| Function | Caller | Purpose |
|---|---|---|
| `get_github_token_for_connector(connector)` | runner API (`ConnectorTokenView`), workflow views | Return `(token, error)` for a specific connector. Handles PAT + App. |
| `get_github_token_from_connectors(org)` | various | Fetch an org's default connector token. |
| `create_workflow_repository(...)` | workflow create view | Create a repo for a new workflow (optionally from a template). |
| `bootstrap_bento_structure(...)` / `create_bento_structure_pr(...)` | workflow create flow | Seed `.bento/form/form.yml` + `.bento/workflow/workflow.yml`. |
| `check_repository_exists(repo_name, connector)` | workflow create flow | Distinguish new-repo vs. existing-repo path. |
| `list_user_repositories_helper(connector)` | workflow create flow | Populate the repo picker. |
| `get_repository_content(workflow_id)` | workflow views | Show files in the Bentra UI. |

### Runners and VCS Tokens

Runners never store GitHub credentials. Mid-execution, they call:

```
GET /api/v1/runner/connectors/{connector_id}/token/
Authorization: Bearer rnr_...
```

The `ConnectorTokenView`:

1. Validates the connector belongs to the runner's authenticated organization.
2. Calls `get_github_token_for_connector(connector)`.
3. Returns `{"ok": true, "token": "...", "auth_type": "pat" | "github_app"}`.

For GitHub App connectors, the returned token is short-lived (1 hour). Runners should call this endpoint fresh each run rather than cache tokens.

---

## OpenBao

OpenBao is a Vault-compatible KV store. Bentra uses it as the **only** home for plaintext secrets. The Django DB holds placeholders.

### Connection

`bento/bento/settings.py` holds the HVAC client at module scope:

```python
OPENBAO_URL   = os.environ.get("OPENBAO_URL",   "http://localhost:8200")
OPENBAO_TOKEN = os.environ.get("OPENBAO_TOKEN", "<dev-token>")
OPEN_BAO_CLIENT = hvac.Client(url=OPENBAO_URL, token=OPENBAO_TOKEN)
```

An authentication check runs at settings import time unless `OPENBAO_SKIP_AUTH_CHECK=1` is set (used in tests / management commands).

### Client Wrapper — `variable_collections/open_bao.py`

Provides a small API on top of HVAC:

- `get_openbao_client()` — returns the authenticated client or raises `OpenBaoError`.
- `get_mount_point(organization)` — returns the mount point: the org's UUID (so renames don't break paths). Falls back to `settings.ORG_ID` when no org is passed (legacy / test / global contexts).
- `ensure_kv_v2_mount(mount_point)` — idempotently enables KV v2 at `mount_point`.
- `write_kv_v2_secret(mount_point, path, secret)`
- `read_kv_v2_secret(mount_point, path)` → dict or None
- `delete_kv_v2_secret(mount_point, path)` → bool

Path builders:

- `build_collection_openbao_path(collection_id)` → `variable_collections/{id}`
- `build_variable_openbao_path(collection_id, key)` → `variable_collections/{id}/{key}`

### Path Scheme (per org mount)

```
{org_uuid}/
├── variable_collections/
│   └── {collection_uuid}/
│       └── {variable_key}    → secret variables in a collection
│
├── workflow_variables/
│   └── {workflow_id}/
│       └── {variable_key}    → secret variables attached directly to a workflow
│
└── <connector-specific-path> → VCS connector credentials
                                 (actual path stored in VCSConnector.openbao_secret_path)
```

### Read / Write Flow for a Secret Variable

1. User sets a variable with `is_secret=True` in the UI.
2. `Variable.set_value(plaintext)` stashes the plaintext on the instance as `_pending_secret_value` and sets `self.value = SECRET_PLACEHOLDER`.
3. `Variable.save()` writes the DB row first, then calls `save_secret_to_openbao(plaintext)` which builds the path and invokes `write_kv_v2_secret()`.
4. `Variable.get_value()` — for secrets, reads back from OpenBao via `_fetch_secret_from_openbao()` (returns `""` on error, not a raise — graceful degradation).
5. `Variable.get_display_value()` — returns masked bullets for UI display.

Deletion is best-effort (`delete_secret_from_openbao()` swallows errors) so that orphan DB rows can always be cleaned up even if OpenBao is down.

### Runners and OpenBao

Runners do **not** talk to OpenBao directly. The control plane serves them everything they need via the job payload and the connector-token endpoint:

- Non-secret variables come inline in the payload's `openbao.variables[].value` field.
- Secret variables come as `{"openbao_path": "workflow_variables/{workflow_id}/{key}", "value": null}`. Runners use this path to fetch the plaintext **from Bentra** in a way that's out of scope for these docs today (roadmap item: runner-side OpenBao proxy).

---

## Script Executor (Flask Microservice)

A separate Flask app at `executor/app.py`. Bentra proxies `auto_populate` form-script execution to it so that arbitrary user code never runs inside the Django process.

### Why It Exists

Forms can declare fields whose value is computed by a user-provided script. That script could be:

- A short Python function (`def calculate(form_data, params): ...`)
- A JavaScript function (same signature)
- A Bash script (form data + params injected as env vars)

Running that code inside the Django process is a security and stability risk. The executor subprocess runs each script in isolation.

### Boundaries

| Limit | Default | Env var |
|---|---|---|
| Execution timeout | 5 seconds | `EXECUTION_TIMEOUT` |
| Max output size | 10,000 chars | `MAX_OUTPUT_SIZE` |
| Allowed languages | `python`, `javascript`, `bash` | — |
| Network access | none (relies on subprocess + caller not granting it) | — |
| Filesystem | tmpfile created per execution, no persistent state | — |

### Endpoints

The executor is intentionally simple. Typical surface:

- `GET /health` — liveness check.
- `POST /execute` — runs a script given `{language, script, form_data, params}`; returns stdout/stderr/duration.

Scripts can optionally be fetched from GitHub at execution time via `fetch_script_from_github(repo_url, script_path, github_token)`, which uses a PAT to pull raw file contents through the GitHub Contents API.

### How Django Talks to It

Django proxies form submissions that need script execution through an internal HTTP call, routed via the `/forms/<slug>/execute-script/` endpoint in the `forms` app. Configured via `SCRIPT_EXECUTOR_URL` (defaults to `http://localhost:5001`).

See [Microservices](microservices.md) for how the executor runs alongside Django in development.

### Script Contracts

**Python**:

```python
def calculate(form_data, params):
    # form_data: dict of all current field values
    # params:    dict of params declared in the YAML
    return "computed value"
```

**JavaScript** (requires Node.js on the executor host):

```javascript
function calculate(formData, params) {
    return "computed value";
}
```

**Bash**:

```bash
# form fields exposed as env vars (e.g. $FORM_FIELD_NAME)
# params exposed as env vars (e.g. $PARAM_FOO)
echo "computed value"
```

---

## Summary — Who Holds What

| System | What Bentra stores there | What Bentra fetches at runtime |
|---|---|---|
| **PostgreSQL** | All business-logic state (workflows, requests, deployments, runs, memberships, roles) + secret *placeholders* + *hashed* tokens. | Everything on every page load. |
| **OpenBao** | Plaintext secrets only (VCS credentials, variable-collection secrets, per-workflow secret variables). | On-demand during form execution / job payload building / runner connector-token fetches. |
| **GitHub** | Nothing (no writes). | Workflow YAML, form YAML, IaC source code — read by runners; metadata read by Django for the UI. |
| **Executor** | Nothing (stateless). | Per-submission script execution for form auto-populate fields. |
