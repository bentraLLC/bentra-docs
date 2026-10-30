# REST APIs

Bentra exposes two distinct REST surfaces. They have different mount points, different auth, and different purposes.

| API | Mount | Auth class | Consumer |
|---|---|---|---|
| [User-facing API](#user-facing-api) | `/orgs/{org_id}/api/v1/` | `ApiTokenAuthentication` | Developer tools / integrations |
| [Runner API](#runner-api) | `/api/v1/runner/` | `RunnerTokenAuthentication` | Runner containers |

Both are Django REST Framework.

!!! note "User-facing API reference"
    The user-facing API is documented endpoint by endpoint in the [API reference](../../reference/api/overview.mdx). The section below is an architectural overview and may lag behind it.

---

## User-Facing API

Lives in the `api` app. Read-only today — lists workflows and deployments accessible to the token's owner.

### Authentication

```
Authorization: Bearer <api-token>
```

The token is a `secrets.token_urlsafe(48)` string returned **once** when created from the Settings UI. Only its SHA-256 hash is stored. `ApiTokenAuthentication`:

1. Extracts `Bearer <token>`.
2. Hashes and looks up in `settings.ApiToken`.
3. **Requires `request.organization` to match `token.organization`** — cross-org use is rejected.
4. Checks `revoked_at`, `expires_at`, `user.is_active`.
5. Updates `last_used_at`.
6. Returns the token's `user` as `request.user`.

### Token Scopes

Each token has a JSONField list of scope strings. Views declare required scopes via `required_scopes = [...]` and enforce via the `HasTokenScopes` permission class.

Known scopes:

- `read:workflows`
- `read:deployments`

### Endpoints

#### `GET /orgs/{org_id}/api/v1/workflows/`

Lists workflows accessible to the token's user, ordered by `-created_at`.

- **Scope**: `read:workflows`
- **Queryset**: `get_accessible_workflows(user, organization)`
- **Pagination**: `BentoPagination`, page size 25

Response (paginated):

```json
{
  "count": 42,
  "next": "...",
  "previous": null,
  "results": [
    { "id": "uuid", "name": "...", "slug": "...", "status": "active", ... }
  ]
}
```

#### `GET /orgs/{org_id}/api/v1/deployments/`

Lists deployments accessible to the token's user, ordered by `-created_at`.

- **Scope**: `read:deployments`
- **Queryset**: `get_accessible_deployments(user, organization).select_related("workflow", "submitted_by")`
- **Pagination**: same

### Creating a Token

Settings UI → API Tokens → Create. Pick description + scopes. The raw token is shown once and discarded. Store it somewhere safe (password manager, CI secret, etc.).

---

## Runner API

Lives in the `runners` app. The control surface between the Django control plane and external runners. Designed to be safe to expose over the public internet — it's how customer-hosted runners talk home.

### Authentication

```
Authorization: Bearer rnr_{8-hex-prefix}_{32-hex-random}
```

`RunnerTokenAuthentication`:

1. Matches the full SHA-256 hash (via `hmac.compare_digest`).
2. Checks `revoked_at`, `expires_at`.
3. Updates `last_used_at`.
4. Returns a `RunnerUser` proxy with `.organization`, `.pool`, `.runner_token`, `.is_authenticated = True`. **Not** a Django `User`.

All runner endpoints use this auth class + `IsAuthenticated` permission. No org middleware involved — the URL pattern `/api/v1/runner/...` is rooted outside `/orgs/{org_id}/`.

### Endpoints

All endpoints return JSON and use `Authorization: Bearer rnr_...`. All queries are scoped to the authenticated token's organization.

---

#### `GET /api/v1/runner/jobs/next/`

Long-polling claim endpoint. The runner calls this in a loop; each call blocks up to 30 seconds waiting for a queued deployment.

**Behavior**:

- Searches for `Deployment` rows where `status = QUEUED`, scoped to the runner's org, matching the runner's pool (or unrouted rows if the runner's pool is the org default).
- Uses `select_for_update(skip_locked=True, of=("self",))` for atomic claim.
- On claim: flips to `RUNNING`, creates a `DeploymentRun`, returns the serialized job payload.
- Polls up to `RUNNER_POLL_TIMEOUT` (default 30s) with `RUNNER_POLL_INTERVAL` (default 2s) between attempts.

**200 OK** — job claimed; body is the job payload. See [Runners § Job Payload](runners.md#job-payload) for the full shape.

**204 No Content** — no work available within the polling window.

---

#### `POST /api/v1/runner/runs/{job_id}/logs/`

Ingest a batch of log lines during a run. `job_id` is `DeploymentRun.id`.

**Request body**:

```json
{
  "type": "stream_start" | "log_batch" | "stream_end",
  "attempt": 1,
  "lines": [
    {
      "seq": 0,
      "step_name": "terraform_plan",
      "stream": "stdout" | "stderr",
      "content": "Refreshing state...",
      "timestamp": "2026-04-23T21:00:00Z"
    }
  ],
  "status": "success" | "failed" | "timeout"
}
```

**Behavior by `type`**:

| `type` | Effect |
|---|---|
| `stream_start` | Sets `DeploymentRun.status=RUNNING`, `started_at=now()`, records `attempt`. |
| `log_batch` | Bulk-inserts `RunLogLine` rows from `lines[]`. |
| `stream_end` | Sets final `DeploymentRun.status` from `status` field, `completed_at=now()`, `total_lines=count`. |

**Errors**:

- `404` — `job_id` not found, or `DeploymentRun` doesn't belong to the runner's org.
- `400` — unknown `type` or malformed body.

**Response**: `{ "ok": true }` on success.

---

#### `POST /api/v1/runner/runs/{job_id}/complete/`

Final result submission. Runner calls this after the job finishes (success, failure, or timeout).

**Request body**:

```json
{
  "deployment_id": "uuid",
  "execution_id": "uuid",
  "status": "success" | "failed" | "timeout",
  "started_at": "ISO8601",
  "completed_at": "ISO8601",
  "steps": [
    {
      "name": "terraform_plan",
      "started_at": "ISO8601",
      "completed_at": "ISO8601",
      "stdout": "...",
      "stderr": "..."
    }
  ],
  "error": "Optional error message"
}
```

**Behavior** (atomic, all-or-nothing):

1. Update `DeploymentRun` — status, timestamps. If no `RunLogLine`s exist, materialize them from `steps[]` (ANSI-stripped).
2. Update `Deployment` — status, `steps`, `error_message`, timestamps.
3. Update `WorkflowExecution` (if linked) — status, steps, error, timestamps.
4. Update linked `Request` — `mark_completed()` or `mark_failed()` depending on outcome.

**Response**: `{ "ok": true }` on success; `404` / `400` for not-found / malformed.

---

#### `GET /api/v1/runner/connectors/{connector_id}/token/`

Fetch a short-lived VCS token for a connector. `connector_id` is `settings.VCSConnector.id`.

**Validation**:

- Connector must exist and belong to the runner's authenticated org. Cross-org fetches return `404`.
- `?job_id=<attempt id>` is required: the attempt must be RUNNING, held by the runner's pool, and its workflow's connector must be this one. Otherwise `404`.
- Optional `?repo=<owner>/<name>` (runner 0.11.0+, `github_workflow_dispatch` steps): `400` if malformed, `403` if the owner isn't the connector's `owner`.

**Behavior**:

- For `auth_type = 'pat'`: reads the token from OpenBao at `VCSConnector.openbao_secret_path`.
- For `auth_type = 'github_app'`: mints a fresh GitHub App installation token (JWT sign → installation token exchange, ~1hr TTL). With `repo`, the token is minted for that one repository with `actions: write` + `metadata: read` and is not cached.

**Response**:

```json
{
  "ok": true,
  "token": "ghs_...",
  "auth_type": "pat" | "github_app"
}
```

**Errors**:

- `404` — connector not found (or wrong org).
- `502 Bad Gateway` — OpenBao unavailable or GitHub App token mint failed.

---

## Mounting

From `bento/bento/urls.py`:

```python
urlpatterns = [
    # Runner API — token-authenticated, no org middleware
    path("api/v1/runner/", include("runners.urls")),

    # Auth
    path("accounts/", include("accounts.urls")),

    # Org-management (no org context)
    path("orgs/", include("organizations.urls")),

    # Org-scoped app URLs — middleware resolves {slug} → request.organization
    re_path(r"^orgs/(?:[\w-]+)/", include(org_app_patterns)),

    path("", lambda request: redirect("/orgs/")),
]
```

And `organizations/urls.py` pulls in the user-facing API under `api/v1/`:

```python
org_app_patterns = [
    path("workflows/", include("workflows.urls")),
    path("forms/", include("forms.urls")),
    path("deployments/", include("deployments.urls")),
    # ...
    path("api/v1/", include("api.urls")),
]
```

So:

- `/orgs/{org_id}/api/v1/workflows/` → user-facing API → requires `ApiToken` with `read:workflows`.
- `/api/v1/runner/jobs/next/` → runner API → requires `RunnerToken`.

## Differences at a Glance

| | User-facing API | Runner API |
|---|---|---|
| Mount | `/orgs/{org_id}/api/v1/` | `/api/v1/runner/` |
| Org context from | URL slug (+ middleware) | Bearer token |
| Auth | `ApiToken` (user-owned) | `RunnerToken` (machine) |
| Token format | `token_urlsafe(48)` | `rnr_{hex}_{hex}` |
| Returned user | Django `User` | `RunnerUser` proxy |
| Permissions | DRF + RBAC helpers | Pool isolation in query |
| Endpoints | List workflows, list deployments | Claim, log, complete, token |
| Typical caller | Developer tool / CI | Workflow runner container |
