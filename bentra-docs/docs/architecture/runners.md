# Runner Execution Model

How workflow jobs get from a `QUEUED` deployment to a completed run. This is the post-REST-migration model (2026-04-23).

!!! note "Related"
    - [RabbitMQ → REST Migration](../subprojects/rabbitmq-rest-migration.md) — the subproject that delivered this architecture.
    - [REST API](rest-api.md) — full endpoint reference.

## What a Runner Is

A **runner** is a Docker container running outside Bentra's control plane, deployed in the customer's environment. It:

- Has a **`RunnerToken`** (format: `rnr_{prefix}_{hex}`) that authenticates it to a specific `RunnerPool` in a specific org.
- Makes **outbound HTTPS calls only** — port 443. No inbound ports, no AMQP, no special firewall rules.
- Is stateless — holds no state the control plane doesn't already have.
- Runs one job at a time (typical), scaling horizontally to handle concurrent deployments.

## Components

**`runners.RunnerPool`**

: An org-scoped group. At most one `is_default=True` per org. Deployments can route to an explicit pool or leave `Deployment.runner_pool=null` to land on the default pool via `Deployment.resolved_pool`.

**`runners.RunnerToken`**

: A bearer token belonging to a pool. SHA-256 hash stored in DB; plaintext shown once. Supports `expires_at` + `revoked_at`.

**`RunnerTokenAuthentication`** (`runners/authentication.py`)

: DRF authentication class. Parses `Authorization: Bearer rnr_...`, matches hash, rejects expired/revoked, updates `last_used_at`. Returns a `RunnerUser` proxy with `.organization`, `.pool`, `.runner_token` — **not** a Django `User`.

## End-to-End Flow

### 1. A deployment is queued

Either `workflow_requests/execution_service.py::trigger_execution()` (after a request is approved) or `deployments/views.py::trigger_iac_run` (plan / plan_apply / destroy actions) creates the deployment and sets:

```python
deployment.status    = DeploymentStatus.QUEUED
deployment.queued_at = timezone.now()
```

No publish, no notification. The database is now the queue.

### 2. A runner long-polls for work

```http
GET /api/v1/runner/jobs/next/
Authorization: Bearer rnr_...
```

`NextJobView.get()`:

1. Loops up to `RUNNER_POLL_TIMEOUT` (default 30s) with `RUNNER_POLL_INTERVAL` (default 2s) between attempts.
2. On each attempt, runs `_try_claim()` inside a DB transaction.
3. Returns the serialized job payload on claim, or `HTTP 204 No Content` when the deadline passes.

### 3. Atomic claim

Inside the transaction:

```python
Deployment.objects
  .select_for_update(skip_locked=True, of=("self",))   # skip rows locked by other runners
  .filter(organization=org, status=DeploymentStatus.QUEUED)
  .filter(pool_filter)                                 # pool=runner.pool OR (pool IS NULL AND runner is default)
  .select_related("workflow", "workflow__github_repository",
                  "workflow__vcs_connector", "request", "execution")
  .order_by("queued_at")
  .first()
```

If a row is found:

- `deployment.status = RUNNING`; `deployment.started_at = now()`
- Create a new `DeploymentRun(attempt=last_attempt+1, status=RUNNING, started_at=now())`
- Build the job payload via `serializers.build_job_payload(deployment, run)`

!!! info "About `of=('self',)`"
    `select_for_update` across nullable joins is broken on PostgreSQL in some cases — the query tries to lock rows in joined tables that may not exist. `of=("self",)` restricts the lock to the `Deployment` table only, which is both correct and performant. This was found during migration testing and fixed in the same pass.

### 4. Pool + org isolation

`pool_filter` is computed as:

```python
pool_filter = Q(runner_pool=runner.pool)
if runner.pool.is_default:
    pool_filter |= Q(runner_pool__isnull=True)
```

A runner whose token is in the org's default pool claims deployments explicitly routed to its pool **plus** unrouted deployments. A non-default pool's runners only see their own pool's work. All queries are additionally filtered by `organization=runner.organization`, so cross-tenant claims are impossible.

### 5. Runner executes

The job payload has everything the runner needs: repo info, VCS connector ref, OpenBao variable pointers, form data, queued-at timestamp, and (for IAC) the action to run. See [Job Payload](#job-payload) below.

During execution, the runner:

- Streams logs via `POST /api/v1/runner/runs/{job_id}/logs/` in batches.
- Optionally fetches a VCS token via `GET /api/v1/runner/connectors/{connector_id}/token/`.
- Submits the final result via `POST /api/v1/runner/runs/{job_id}/complete/`.

### 6. Log streaming

Three message shapes supported by `services.process_log_message()`:

**`stream_start`** — run has begun; flips `DeploymentRun` to `RUNNING`, sets `started_at`.

**`log_batch`** — inserts `RunLogLine` rows via `bulk_create`. Each line carries `seq`, `step_name`, `stream` (stdout/stderr), `content`, `timestamp`.

**`stream_end`** — run finished; sets final status (`success`/`failed`/`timeout`), `completed_at`, and `total_lines = run.log_lines.count()`.

Full payload:

```json
{
  "type": "stream_start" | "log_batch" | "stream_end",
  "attempt": 1,
  "lines": [
    {
      "seq": 0,
      "step_name": "terraform_plan",
      "stream": "stdout",
      "content": "Refreshing state...",
      "timestamp": "2026-04-23T21:00:00Z"
    }
  ],
  "status": "success" | "failed" | "timeout"
}
```

### 7. Completion

`POST /api/v1/runner/runs/{job_id}/complete/` with:

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

`services.process_run_complete()` atomically updates:

- `DeploymentRun` — status, timestamps, log lines materialized from `steps[]` if no streaming logs were posted.
- `Deployment` — status, `steps`, `error_message`, timestamps.
- `WorkflowExecution` — status, steps, error, timestamps.
- `Request` — `mark_completed()` or `mark_failed()`.

ANSI escape codes are stripped via `strip_ansi()` before log lines are inserted.

## Job Payload

Built by `runners/serializers.py::build_job_payload(deployment, run)`. Canonical shape:

```json
{
  "job_id": "uuid",                       // DeploymentRun.id
  "organization_id": "uuid",
  "deployment_id": "uuid",
  "execution_id": "uuid",
  "workflow_id": "uuid",
  "workflow_slug": "my-workflow",
  "workflow_type": "terraform" | "opentofu" | "generic",
  "runner_pool_id": "uuid",               // resolved (explicit pool OR org default)

  "repo": {
    "url": "https://github.com/org/repo",
    "branch": "main",
    "working_directory": "infra/prod"
  },

  "vcs_connector": {
    "id": "uuid",
    "vcs_type": "github",
    "auth_type": "pat" | "github_app",
    "owner": "my-github-org",
    "client_id": "optional GitHub App ID"
  },

  "openbao": {
    "mount_point": "<org-uuid>",
    "variable_collection_ids": ["uuid", "..."],
    "variables": [
      {
        "key": "AWS_REGION",
        "is_secret": false,
        "treat_as_json": false,
        "value": "us-east-1",
        "openbao_path": null
      },
      {
        "key": "AWS_SECRET_ACCESS_KEY",
        "is_secret": true,
        "treat_as_json": false,
        "value": null,
        "openbao_path": "workflow_variables/{workflow_id}/AWS_SECRET_ACCESS_KEY"
      }
    ]
  },

  "form_data": { "env": "prod", "region": "us-east-1" },
  "queued_at": "2026-04-23T21:00:00Z"
}
```

### IAC-specific fields (`workflow_type = terraform | opentofu`)

```json
{
  "iac_action": "plan" | "plan_apply" | "destroy",
  "state_path": "IAC_STATE_MANAGEMENT/{workflow_id}/{deployment_id}/tfstate.json",
  "terraform_version": "1.6.0",
  "auto_apply": false,
  "deploy_directory": "."
}
```

- `iac_action` comes from the `IACActionRequest` linked to this run.
- `state_path` is derived from the `Deployment.iac_state_path` property.
- `terraform_version` + `auto_apply` come from `DeploymentSettings`.
- `deploy_directory` comes from `GithubRepository` (subdirectory to `cd` into before running Terraform).

### Generic-specific fields (`workflow_type = generic`)

```json
{
  "workflow_file_path": ".bento/workflow/workflow.yml"
}
```

## Resolution Precedence

When building the payload:

1. **Repo block** — `DeploymentSettings.repo_*` fields override `Workflow.github_repository.*` fields (the settings row is auto-created on deployment creation and inherits the workflow's values, so typically they match).
2. **VCS connector** — `DeploymentSettings.vcs_connector` overrides `Workflow.vcs_connector`.
3. **Runner pool** — `deployment.resolved_pool` returns the explicit `runner_pool` or the org's default pool (the one with `is_default=True`).

## What Runners Do with the Payload

The runner container is not part of this repo (lives in `bento-kubernetes-deployments/` — see [CLAUDE.md](#) of that repo). At a high level, a runner:

1. Reads the job payload.
2. Fetches a VCS token via the connector endpoint.
3. `git clone` the repo at the specified branch into a workspace.
4. `cd` into `repo.working_directory` (or `deploy_directory` for IAC).
5. Resolves variables:
   - Non-secret → env var from `value`.
   - Secret → fetch via `openbao_path` and export as env var.
6. For `terraform` / `opentofu`:
   - Configure the backend to use the `state_path`.
   - Run `terraform init`, then `plan` / `apply` / `destroy` per `iac_action`.
7. For `generic`:
   - Read the workflow YAML at `workflow_file_path` and execute its steps.
8. Stream stdout/stderr to the logs endpoint as it goes.
9. POST the final status + steps to the completion endpoint.

## Operational Notes

**No heartbeat yet.** A stale-job reaper (to recover from crashed runners) is a roadmap item — see [RabbitMQ → REST Migration § Deferred](../subprojects/rabbitmq-rest-migration.md#deferred).

**Polling cadence.** Configurable via Django settings:

```python
RUNNER_POLL_TIMEOUT  = 30   # seconds a single long-poll request will wait
RUNNER_POLL_INTERVAL = 2    # seconds between claim attempts within a single request
```

A runner's effective dispatch latency is bounded by `RUNNER_POLL_INTERVAL` plus its own re-poll delay.

**Concurrency.** Multiple runners can long-poll simultaneously. The `SKIP LOCKED` clause ensures exactly one wins each deployment row without any coordination outside PostgreSQL.
