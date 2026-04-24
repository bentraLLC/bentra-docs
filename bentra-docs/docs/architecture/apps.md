# Django Apps

Bentra is a single Django project with multiple apps under `bento/`. Each app owns a slice of the domain. All apps except `accounts`, `organizations`, and `api` live under the org-slug URL prefix.

## Installed Apps

From `bento/bento/settings.py`:

```python
INSTALLED_APPS = [
    # ...Django built-ins...
    "rest_framework",
    "api",                    # User-facing REST API (token-authenticated)
    "organizations",          # Multi-tenant org model + middleware
    "workflows",              # Workflow definitions + GitHub integration
    "dashboard",              # Dashboard / landing pages
    "forms",                  # Form definitions linked to workflows
    "accounts",               # Auth (login, logout, signup)
    "settings",               # VCS connectors + API tokens
    "workflow_requests",      # Form submissions + approval lifecycle
    "deployments",            # Deployment tracking + IAC actions
    "variable_collections",   # Reusable variable sets + OpenBao secrets
    "vcs_connectors",         # GitHub API service + legacy models
    "permissions",            # RBAC: roles, assignments, groups
    "runners",                # Runner pools + tokens + runner REST API
]
```

## App Overview

| App | Purpose | Key Models |
|---|---|---|
| [organizations](#organizations) | Multi-tenant foundation | `Organization`, `OrganizationMembership` |
| [accounts](#accounts) | Auth views | (uses Django `User`) |
| [permissions](#permissions) | RBAC (roles, groups, form access) | `Role`, `RoleAssignment`, `Group`, `GroupMember`, `FormAccessRestriction` |
| [workflows](#workflows) | Workflow definitions + GitHub repos | `Workflow`, `GithubRepository`, `WorkflowExecution`, `WorkflowVariable` |
| [forms](#forms) | Form definitions linked to workflows | `Form` |
| [workflow_requests](#workflow_requests) | Form submissions + approval flow | `Request`, `RequestApproval`, `WorkflowApprover`, `RequestComment` |
| [deployments](#deployments) | Deployment + run tracking, IAC actions | `Deployment`, `DeploymentRun`, `DeploymentSettings`, `IACActionRequest`, `RunLogLine` |
| [variable_collections](#variable_collections) | Reusable variable sets + OpenBao secrets | `VariableCollection`, `Variable` |
| [settings](#settings) | VCS connectors + API tokens | `VCSConnector`, `ApiToken` |
| [vcs_connectors](#vcs_connectors) | GitHub API service layer | (service-only; no models) |
| [runners](#runners) | Runner pools, tokens, runner REST API | `RunnerPool`, `RunnerToken` |
| [api](#api) | User-facing DRF viewsets | (no models; viewsets over workflows/deployments) |
| [dashboard](#dashboard) | Landing / overview page | (no models) |

---

## organizations

Foundation of Bentra's multi-tenancy.

- **`Organization`** — UUID pk, `name`, `slug` (unique). All domain models have an `organization` FK.
- **`OrganizationMembership`** — Links `User` ↔ `Organization` with a role: `owner`, `admin`, `member`.
- **`OrganizationMiddleware`** — Matches `/orgs/{slug}/` in the URL, loads the org, checks membership, and attaches `request.organization`. Bypasses `/accounts/`, `/static/`, `/orgs/new`, `/api/me/`. Returns 404 for unknown slugs and raises `PermissionDenied` if the user isn't a member.

URL structure exported via `organizations.urls.org_app_patterns` — this is what ``bento/urls.py`` mounts under `re_path(r"^orgs/(?:[\w-]+)/", ...)`.

---

## accounts

Login/logout/signup views and templates. Uses Django's built-in `User` model — there is no custom user model.

Important settings:

- `LOGIN_URL = "/accounts/login/"`
- `LOGIN_REDIRECT_URL = "/accounts/post-login/"` — redirects to org selection after login
- `LOGOUT_REDIRECT_URL = "/accounts/login/"`

---

## permissions

Fine-grained RBAC on top of org membership. Permissions are constants (strings) grouped by scope.

**Scopes**: `organization`, `workflow`, `deployment`.

**Permission constants** (from `permissions/constants.py`):

- Org: `org.manage_settings`, `org.manage_members`, `org.manage_groups`, `org.view_members`, `org.create_workflow`, `org.view_connectors`, `org.manage_connectors`, `org.view_variable_collections`, `org.manage_variable_collections`
- Workflow: `workflow.view`, `workflow.edit`, `workflow.delete`, `workflow.manage_permissions`, `workflow.execute`, `workflow.manage_form_settings`, `workflow.manage_variables`
- Deployment: `deployment.view`, `deployment.manage`, `deployment.manage_permissions`

**Seeded roles**:

| Scope | Role | Permissions |
|---|---|---|
| organization | `admin` | all org perms |
| organization | `user` | `create_workflow`, `view_connectors`, `view_variable_collections`, `view_members` |
| workflow | `admin` | all workflow perms |
| workflow | `writer` | `view`, `edit`, `execute`, `manage_form_settings`, `manage_variables` |
| workflow | `reader` | `view` |
| deployment | `admin` | all deployment perms |
| deployment | `writer` | `view`, `manage` |
| deployment | `reader` | `view` |

**Models**:

- `Role` — `(name, scope)` unique; a list of permission strings in a JSONField.
- `RoleAssignment` — User gets a role at a specific org/workflow/deployment. Enforces validity via `clean()`.
- `Group` / `GroupMember` / `GroupOwner` — Org-scoped groups for delegating form access.
- `FormAccessRestriction` — If any rows exist for a form, only users in those groups can access it.

**Enforcement**:

```python
@require_permission(DEPLOYMENT_VIEW, resource_kwarg="deployment_id", resource_type="deployment")
def my_view(request, deployment_id): ...
```

Inline checks with `permissions.services.has_permission()`. Accessible-queryset helpers: `get_accessible_workflows(user, org)`, `get_accessible_deployments(user, org)`.

See [RBAC](rbac.md) for the full model.

---

## workflows

Core domain: a workflow is a versioned thing linked to a GitHub repo, backed by a workflow YAML in that repo, and optionally attached to variable collections.

**Models**:

- **`Workflow`** — UUID pk; belongs to an `Organization`; has an `owner` (User); `workflow_type` is one of `terraform`, `opentofu`, `generic`; optional `github_repository` FK; optional `vcs_connector` FK; M2M to `VariableCollection`; legacy `deployments` JSONField for quick lookup. Auto-generates `slug` and `workflow_url` on save.
- **`GithubRepository`** — `repo_url`, `repo_name`, `repo_branch`, `repo_working_directory`, `form_file_path` (defaults to `.bento/form/form.yml`), `workflow_file_path` (defaults to `.bento/workflow/workflow.yml`), `deploy_directory`.
- **`WorkflowFormSettings`** — 1:1 with Workflow; controls approval count, auto-execute, notification flags.
- **`WorkflowExecution`** — One record per trigger attempt; `steps` JSONField captures step-level output; retry tracking via `is_retry` / `retry_of`.
- **`WorkflowVariable`** — Per-workflow key/value; secrets stored in OpenBao under `workflow_variables/{workflow_id}/{key}` with a `SECRET_PLACEHOLDER` in the DB.
- **`WorkflowVariableCollection`** — Through model for Workflow ↔ VariableCollection, with `order` for conflict resolution (higher order wins).

---

## forms

Very thin app. A `Form` belongs to an `Organization` and a `Workflow`, with `name` and `description`. The actual form *schema* lives in the workflow's GitHub repo at `.bento/form/form.yml`.

---

## workflow_requests

Handles the submission → approval → execution lifecycle.

**Lifecycle states** (`RequestStatus`):

```
PENDING → APPROVED → EXECUTING → COMPLETED / FAILED
    │         │
    ├─► REJECTED
    ├─► CHANGES_REQUESTED
    └─► CANCELLED
```

**Models**:

- **`Request`** — the submission. Has `form_data` (JSON), status, approval flags (`approval_required`, `approvers_required`), and timestamps for every state transition.
- **`RequestApproval`** — individual approve/reject records; `changes_requested` flag.
- **`WorkflowApprover`** — users pre-configured as approvers for a workflow.
- **`RequestApprover`** — approvers assigned to a specific request (auto-populated from `WorkflowApprover` on creation).
- **`RequestStatusHistory`** — audit trail of every state transition.
- **`RequestComment`** — user + system comments on a request.

**Key service** — `workflow_requests/execution_service.py::trigger_execution()`:

1. Validate prerequisites (workflow has VCS connector + GitHub repo).
2. Idempotency check (request already linked to an execution).
3. Create `WorkflowExecution` (PENDING) + `Deployment` (PENDING).
4. Link execution to request; mark request `EXECUTING`.
5. Flip deployment to `QUEUED` with `queued_at = now()`.

That's it. Runners discover the deployment via polling. Nothing is published to a queue.

---

## deployments

Tracks actual execution attempts. This is the app the runners interact with indirectly — the runner API lives in `runners/`, but the models live here.

**Lifecycle** (`DeploymentStatus`):

```
PENDING → QUEUED → RUNNING → SUCCESS / FAILED / TIMEOUT / CANCELLED
```

**Models**:

- **`Deployment`** — the parent record. Owns: `status`, `deployment_type` (`terraform`/`opentofu`/`generic`), `steps` JSON, `error_message`, `runner_pool` FK (nullable — falls back to the org's default pool via the `resolved_pool` property). Linked to the originating `Request` (1:1), `WorkflowExecution` (1:1), and `Workflow`.
- **`DeploymentRun`** — one row per execution attempt (`attempt` int). Has its own `status`, `total_lines`, timestamps. Created when a runner claims the deployment.
- **`DeploymentSettings`** — 1:1 override table for per-deployment repo/branch/working-dir/connector, plus Terraform-specific settings (`terraform_version`, `auto_apply`, `speculative_plans_enabled`, `speculative_webhook_secret`). Auto-created by a post_save signal when a `Deployment` is created.
- **`IACActionRequest`** — 1:1 with `DeploymentRun`; captures which IAC action was requested (`plan`, `plan_apply`, `destroy`).
- **`RunLogLine`** — individual log line from a runner; `(run, seq)` indexed for ordered retrieval. Populated by the runner's `POST /logs/` endpoint.

**Signals** (`deployments/signals.py`):

- `set_deployment_type` — auto-infers `deployment_type` from the workflow's type on creation.
- `create_deployment_settings` — auto-creates `DeploymentSettings` from the workflow's repo data.

**IAC workspace** — each `terraform`/`opentofu` deployment has a workspace UI with four tabs: Overview, Settings, Variables, Runs. The top bar shows a Plan / Plan & Apply dropdown (POSTs to `/iac/trigger/`). Settings → Danger Zone exposes destroy (POSTs to `/iac/destroy/`). Both trigger a new `DeploymentRun` + `IACActionRequest` and flip the deployment to `QUEUED` — no direct runner invocation.

---

## variable_collections

Reusable, org-scoped sets of variables. Inspired by Terraform Cloud Variable Sets.

- **`VariableCollection`** — named, described, owned by a `User`, scoped to an `Organization`. `openbao_base_path` is stored for reference.
- **`Variable`** — a `(collection, key)` pair. `is_secret=True` → value is stored in OpenBao at `variable_collections/{collection_id}/{variable_key}` and the DB holds a `SECRET_PLACEHOLDER`. `is_secret=False` → plaintext in DB. `treat_as_json=True` flags the value as JSON-encoded.

**OpenBao integration** — `variable_collections/open_bao.py`:

- `get_openbao_client()` — returns the authenticated HVAC client from `settings.OPEN_BAO_CLIENT`.
- `get_mount_point(org)` — mount point is the org UUID (renames don't break paths). Falls back to `settings.ORG_ID` for legacy/test callers.
- `ensure_kv_v2_mount()`, `write_kv_v2_secret()`, `read_kv_v2_secret()`, `delete_kv_v2_secret()`.

Path scheme:

- Variable-collection secret: `variable_collections/{collection_uuid}/{variable_key}`
- Workflow-level variable secret: `workflow_variables/{workflow_id}/{key}`
- VCS connector secret: stored at the connector's `openbao_secret_path`

---

## settings

Org-level configuration: VCS connectors and API tokens.

- **`VCSConnector`** — one per VCS provider + auth combo. `vcs_type` (`github`), `auth_type` (`pat` or `github_app`), `client_id` (GitHub App ID), `owner`, `openbao_secret_path`. Plaintext tokens live in OpenBao.
- **`ApiToken`** — user-facing API token. Hash stored as SHA-256; raw token returned once via `issue_token()`. Format: `secrets.token_urlsafe(48)`, prefix stored as `token[:12]` for lookup. Scopes stored as a JSONField list (`read:workflows`, `read:deployments`). Default expiry 90 days.

Settings UI at `/orgs/{slug}/settings/` exposes both. Connector auth via OpenBao means the Django DB never holds a GitHub PAT or App key.

---

## vcs_connectors

Service layer around GitHub (and future VCS providers). No models — all logic in `github_service.py`.

**`GitHubService`** class — thin wrapper around the GitHub REST API. Methods include:

- `create_repository()` / `create_repo_from_template()`
- `get_repository_content()` / `get_repository_contents_recursive()`
- `get_file_content()` (base64-decodes)
- `get_user_info()` — validates PAT
- `list_user_repositories()`

**Module-level helpers**:

- `validate_pat_credentials(token)` — confirms a PAT works.
- `validate_github_app_credentials(app_id, installation_id, pem)` — mints an installation token.
- `_create_github_app_jwt()` / `_mint_github_app_installation_token()` — GitHub App auth internals.
- `get_github_token_from_connectors(org)` — returns a usable token for the org's default connector.
- `get_github_token_for_connector(connector)` — returns `(token, error)` for a specific connector; PAT connectors fetch from OpenBao; App connectors mint an installation token.
- `create_workflow_repository()` — creates a GitHub repo when a workflow is first created.
- `bootstrap_bento_structure()` / `create_bento_structure_pr()` — seeds `.bento/form/form.yml` + `.bento/workflow/workflow.yml` into a new or existing repo.
- `check_repository_exists()` — used by the create-workflow flow to distinguish new-repo vs. existing-repo paths.

`provider.py` is the start of a provider-abstraction layer — today GitHub is the only implementation.

---

## runners

New app (added with the REST migration). Owns runner pool management, runner authentication, and the runner-facing REST API.

**Models**:

- **`RunnerPool`** — org-scoped logical grouping of runners. `(organization, name)` unique. At most one `is_default=True` per org (enforced in `save()`). `Deployment.runner_pool` is nullable — a null FK resolves to the org's default pool at claim time.
- **`RunnerToken`** — bearer token owned by a `RunnerPool`. Format: `rnr_{8-hex-prefix}_{32-hex-random}`. Only the SHA-256 hash is stored. Supports `expires_at` and `revoked_at`. `is_active()` checks both.

**Auth** — `RunnerTokenAuthentication` (`runners/authentication.py`):

- Parses `Authorization: Bearer rnr_...`.
- Looks up by full-hash match (constant-time compare with `hmac.compare_digest`).
- Rejects expired / revoked tokens.
- Returns a `RunnerUser` proxy exposing `.organization`, `.pool`, `.runner_token`, `.is_authenticated = True`. Not a Django `User`.
- Updates `last_used_at`.

**Views** (`runners/views.py`) — all `APIView`, all require `RunnerTokenAuthentication + IsAuthenticated`:

| View | URL | Description |
|---|---|---|
| `NextJobView` | `GET /api/v1/runner/jobs/next/` | Long-poll (30s default). Atomically claims one `QUEUED` deployment, flips to `RUNNING`, creates a `DeploymentRun`, returns job payload. |
| `RunLogsView` | `POST /api/v1/runner/runs/{job_id}/logs/` | Ingests `stream_start`, `log_batch`, or `stream_end` messages. |
| `RunCompleteView` | `POST /api/v1/runner/runs/{job_id}/complete/` | Finalizes run: updates `DeploymentRun`, `Deployment`, `WorkflowExecution`, and linked `Request`. |
| `ConnectorTokenView` | `GET /api/v1/runner/connectors/{connector_id}/token/` | Mid-run: mints/fetches a VCS token (PAT from OpenBao, or a short-lived GitHub App installation token). |

**Claim query** (important detail) — uses `select_for_update(skip_locked=True, of=("self",))` scoped to deployments in the runner's org, where either `runner_pool = runner.pool` OR (`runner_pool IS NULL` AND the runner's pool is the org default). The `of=("self",)` was required because `select_for_update` across nullable joins is broken on PostgreSQL (see [Journal](../journal.md#2026-04-23-rabbitmq-rest-migration-completed)).

**Services** (`runners/services.py`):

- `process_log_message(job_id, msg)` — handles `stream_start` (flip run to RUNNING), `log_batch` (bulk-insert `RunLogLine`s), `stream_end` (finalize run status + `total_lines`).
- `process_run_complete(job_id, data)` — atomically updates all four related rows (`DeploymentRun`, `Deployment`, `WorkflowExecution`, `Request`). Also synthesizes `RunLogLine`s from the `steps[]` payload if no streaming logs were posted.

**Serializers** (`runners/serializers.py`):

- `build_job_payload(deployment, run)` — canonical job envelope. See the [Runners page](runners.md#job-payload) for the full shape.

See [Runners](runners.md) for the runner execution model, and [REST API](rest-api.md) for the full runner endpoint reference.

---

## api

User-facing DRF API. Minimal today — two read-only list endpoints.

- **Mount**: `/orgs/{slug}/api/v1/` (inside org middleware).
- **Auth**: `ApiTokenAuthentication` → resolves `Bearer <api-token>` → `settings.ApiToken` (hash match). Rejects if token's org doesn't match the URL's org.
- **Permissions**: `HasTokenScopes` — checks `required_scopes` against `token.scopes`.
- **Pagination**: `BentoPagination`, page size 25 (`api/pagination.py`).

**Viewsets**:

- `WorkflowViewSet` — `GET /workflows/` — list workflows accessible to the token's user (scoped via `get_accessible_workflows`). Requires `read:workflows`.
- `DeploymentViewSet` — `GET /deployments/` — list deployments accessible to the token's user. Requires `read:deployments`.

---

## dashboard

Landing page app. Minimal logic — aggregates per-org counts/recent activity for the org's dashboard page. Routed under `/orgs/{slug}/dashboard/`.
