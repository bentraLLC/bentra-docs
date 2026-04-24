# Data Model

Core entities in Bentra's PostgreSQL database. All domain models are scoped to an `Organization`.

## Entity-Relationship Diagram

```
                     ┌──────────────────┐
                     │   Organization   │
                     └────────┬─────────┘
                              │ (FK on almost everything)
          ┌───────────────────┼───────────────────┐
          │                   │                   │
   ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
   │  Workflow   │     │ RunnerPool  │     │VCSConnector │
   │             │     │             │     │             │
   │ workflow_   │     │ is_default  │     │  auth_type  │
   │   type      │     └──────┬──────┘     │ openbao_    │
   │ github_rep  │            │            │  secret_    │
   │ vcs_conn    │            │            │  path       │
   └──────┬──────┘     ┌──────▼──────┐     └─────────────┘
          │            │ RunnerToken │
          │            │  (hashed)   │
          │            └─────────────┘
          │
   ┌──────▼──────┐     ┌──────────────┐
   │   Form      │     │VariableColl. │────┬─► Variable (is_secret → OpenBao)
   │             │     └──────────────┘    │
   └──────┬──────┘                         │
          │        (M2M via through)  ─────┘
          │           ↑
          │       ┌───┴──────┐
          │       │ Workflow │  ── variable_collections ── VariableCollection
          │       └──────────┘
   ┌──────▼──────────────────────┐
   │         Request             │  (form submission)
   │  form_data, status,         │
   │  approval lifecycle         │
   │                             │
   │  ┌──► RequestApproval       │
   │  ├──► RequestApprover       │
   │  ├──► RequestStatusHistory  │
   │  └──► RequestComment        │
   └──────┬───────────────────┬──┘
          │                   │
          │ 1:1               │ FK
          ▼                   ▼
   ┌──────────────┐     ┌────────────────┐
   │ Deployment   │◄────┤WorkflowExecution│
   │              │ 1:1 └────────────────┘
   │ status       │
   │ deployment_  │
   │   type       │
   │ runner_pool  │──► RunnerPool (nullable; fallback to org default)
   │ steps (JSON) │
   │              │
   │  ┌──► DeploymentSettings (1:1, auto-created)
   │  └──► DeploymentRun ────► RunLogLine (seq-ordered)
   │                    └───► IACActionRequest (1:1 for IAC workflows)
   └──────────────┘
```

## Models by Lifecycle

### Tenancy

**`Organization`**
: UUID pk, `name`, `slug` (unique). Root of all tenant isolation.

**`OrganizationMembership`**
: Links `User` ↔ `Organization`. Role: `owner` / `admin` / `member`.

### RBAC

**`Role`**
: `(name, scope)` unique. Scope ∈ `organization` / `workflow` / `deployment`. `permissions` = JSONField list of permission strings.

**`RoleAssignment`**
: User gets a role at a specific org/workflow/deployment. `deployment` FK requires `workflow` FK (check constraint). Workflow/deployment must belong to the named org (validated in `clean()`).

**`Group` / `GroupMember` / `GroupOwner`**
: Org-scoped groups used for form-level access control.

**`FormAccessRestriction`**
: If any rows exist for a form, only users in those groups can access it. No rows = open to all org members.

### Authentication Tokens (two kinds)

**`settings.ApiToken`** — user-facing REST API
: SHA-256 hash storage, `token_prefix` (12 chars) for lookup. Scoped by `user` + `organization` + `scopes` list. Default expiry 90 days. `token_urlsafe(48)` raw form. Returned once via `ApiToken.issue_token()`.

**`runners.RunnerToken`** — runner-facing REST API
: SHA-256 hash storage, `token_prefix` (16 chars). Scoped by `organization` + `pool`. Raw format: `rnr_{8-hex}_{32-hex}`. Returned once via `RunnerToken.issue_token()`.

Both support `expires_at` and `revoked_at`; both expose `is_active()`.

### Workflows

**`Workflow`**
: UUID pk. `workflow_type` ∈ `terraform` / `opentofu` / `generic`. `status` ∈ `active` / `pending` / `error` / `disabled`. Optional `github_repository` FK and `vcs_connector` FK. M2M to `VariableCollection` through `WorkflowVariableCollection` (ordered). Auto-generates `slug` and `workflow_url` on save.

**`GithubRepository`**
: `repo_url`, `repo_name`, `repo_branch`, `repo_working_directory`, `form_file_path` (default `.bento/form/form.yml`), `workflow_file_path` (default `.bento/workflow/workflow.yml`), `deploy_directory` (default `.`).

**`WorkflowFormSettings`**
: 1:1 with `Workflow`. Approval settings (`require_approvers`, `approver_count`), execution settings (`auto_execute`, `manual_execution`, `execute_on_submit`), notification flags.

**`WorkflowExecution`**
: One row per trigger attempt. `status` ∈ `pending` / `running` / `success` / `failed` / `timeout`. `steps` JSONField. Retry tracking via `is_retry` / `retry_of` (self-FK) / `retry_count`.

**`WorkflowVariable`**
: Per-workflow key-value. `is_secret=True` → OpenBao path `workflow_variables/{workflow_id}/{key}`, placeholder in `value`. `treat_as_json` flag for JSON values.

**`WorkflowVariableCollection`** *(through model)*
: `(workflow, collection)` unique. `order` (PositiveInt) — higher order wins on conflict. `attached_at` timestamp.

### Forms

**`Form`**
: `workflow` FK. `name`, `description`. That's it in the DB — the actual *schema* lives in the workflow's GitHub repo at `.bento/form/form.yml`.

### Variable Collections

**`VariableCollection`**
: Org-scoped, owner (User). `openbao_base_path` stored for reference.

**`Variable`**
: `(collection, key)` unique. `is_secret=True` → OpenBao path `variable_collections/{collection_uuid}/{variable_key}`. `treat_as_json` flag.

### Requests

**`Request`**
: UUID pk. `form_data` (JSON). `status` ∈ `pending` / `approved` / `rejected` / `changes_requested` / `cancelled` / `executing` / `completed` / `failed`. Approval config: `approval_required`, `approvers_required`. Timestamps for every state transition (`submitted_at`, `approved_at`, `executed_at`, `completed_at`, `cancelled_at`).

**`RequestApproval`**
: `(request, approver)` unique. `approved` bool. `changes_requested` bool.

**`WorkflowApprover`**
: Pre-configured approvers for a workflow. Auto-propagated to new `Request`s as `RequestApprover` rows.

**`RequestApprover`**
: `(request, approver)` unique. Designated approvers for a specific request. `has_responded` bool.

**`RequestStatusHistory`**
: Audit trail of state transitions.

**`RequestComment`**
: User + system comments on a request. `is_system=True` for system-generated.

### Deployments

**`Deployment`**
: UUID pk. Linked to `Request` (1:1), `WorkflowExecution` (1:1), `Workflow`. `status` ∈ `pending` / `queued` / `running` / `success` / `failed` / `timeout` / `cancelled`. `deployment_type` ∈ `terraform` / `opentofu` / `generic` (auto-set by signal from workflow type). `runner_pool` FK is nullable — `resolved_pool` property returns the explicit pool or the org's default. `steps` JSONField, `error_message` text. Timestamps: `created_at`, `queued_at`, `started_at`, `completed_at`, `updated_at`.

**`DeploymentSettings`**
: 1:1 with `Deployment`. Auto-created by a post_save signal. Overrides for repo/branch/working-dir/connector + IAC-specific fields (`terraform_version`, `auto_apply`, `speculative_plans_enabled`, `speculative_webhook_secret`).

**`DeploymentRun`**
: One row per execution attempt for a deployment. `(execution_id, attempt)` unique. `status` ∈ `queued` / `running` / `success` / `failed` / `timeout`. `total_lines` int.

**`IACActionRequest`**
: 1:1 with `DeploymentRun`. `action` ∈ `plan` / `plan_apply` / `destroy`. `requested_by` (User).

**`RunLogLine`**
: Individual log line. `(run, seq)` indexed for ordered retrieval. `stream` ∈ `stdout` / `stderr`. `step_name`, `content`, `timestamp`.

### Runners

**`RunnerPool`**
: Org-scoped. `(organization, name)` unique. At most one `is_default=True` per org (enforced in `save()`). Nullable `Deployment.runner_pool` resolves to this via `Deployment.resolved_pool`.

**`RunnerToken`**
: Scoped to an org + pool. SHA-256 hash only. Raw format `rnr_{prefix}_{hex}`.

### VCS Connectors

**`settings.VCSConnector`**
: Per-org. `vcs_type` = `github`. `auth_type` ∈ `pat` / `github_app`. `client_id` (GitHub App ID if applicable). `owner` (GitHub org/user). `openbao_secret_path` — token/private key lives in OpenBao, not in the DB.

## ID Conventions

| Concept | Where it comes from |
|---|---|
| `deployment_id` | `Deployment.id` |
| `execution_id` | `WorkflowExecution.id` |
| `job_id` | `DeploymentRun.id` (this is what runners use) |
| `request_id` | `Request.id` |
| `organization_id` | `Organization.id` |

The runner API uses `job_id` consistently in its URL path — logs and completion go to `/runs/{job_id}/`. That `job_id` is a `DeploymentRun.id`.

## Secret Storage Paths

Plaintext secrets **never** live in the Django DB. They go to OpenBao under the org's mount point (which is the org UUID):

| Secret | OpenBao path (relative to mount) |
|---|---|
| Workflow-level variable (secret) | `workflow_variables/{workflow_id}/{key}` |
| Variable-collection variable (secret) | `variable_collections/{collection_uuid}/{variable_key}` |
| VCS connector credential | stored at `VCSConnector.openbao_secret_path` (set when connector is created) |

The DB column stores a placeholder (`OPENBAO_SECRET_PLACEHOLDER` for workflow vars, a random UUID-hex placeholder for variable-collection vars) so that `is_secret=True` rows have a predictable value shape.

## JSON Fields (non-obvious)

| Model | Field | Shape |
|---|---|---|
| `Workflow` | `deployments` | Legacy list of `{id, status, url, created_at, updated_at}` — quick lookup, not the source of truth. |
| `WorkflowExecution` | `form_data` | Whatever the submitting user posted. |
| `WorkflowExecution` | `steps` | Same shape as `Deployment.steps`. |
| `Deployment` | `steps` | `[{name, started_at, completed_at, stdout, stderr}, ...]` — canonical post-run output. |
| `Request` | `form_data` | Same as the execution's form_data. |
| `Role` | `permissions` | `["workflow.view", "workflow.edit", ...]` |
| `ApiToken` | `scopes` | `["read:workflows", "read:deployments"]` |

## Indexes Worth Knowing

Each major model has an `organization` index so per-org queries are cheap. Additional notable indexes:

- `Deployment`: `(workflow, -created_at)`, `(status, -created_at)`, `(submitted_by, -created_at)`
- `DeploymentRun`: `(execution_id, attempt)`, plus unique constraint
- `RunLogLine`: `(run, seq)` — ordered retrieval
- `RunnerToken`: `(organization, pool)`, `token_prefix` (for auth lookups)
- `ApiToken`: `(organization, user)`, `token_prefix`
- `RoleAssignment`: conditional indexes on `(user, workflow)` and `(user, deployment)` when those FKs aren't null
