# Runs

A run is one execution of a workflow: from an approved request, or a job trigger (manual, API or schedule). Each time a runner picks it up is an **attempt**; re-running a finished run adds an attempt.

Run status: `queued` → `running` → `success`, `failed` or `timeout`; or `cancelled`.

| Method | Path | Scope | MCP tool |
|---|---|---|---|
| `POST` | `workflows/{id}/runs/trigger/` | `trigger:workflow_runs` | `trigger_run` |
| `GET` | `workflows/{id}/runs/` | `read:workflows` | `list_runs` |
| `GET` | `runs/` | `read:runs` | `list_runs` |
| `GET` | `runs/{id}/` | `read:runs` | `get_run` |
| `GET` | `runs/{id}/logs/` | `read:runs` | `get_run_logs` |
| `POST` | `runs/{id}/rerun/` | `manage:runs` | `rerun` |
| `POST` | `runs/{id}/cancel/` | `manage:runs` | `cancel_run` |

---

## `POST workflows/{id}/runs/trigger/`

Starts a job now.

**Permission:** `workflow.execute`. The job must be active with API triggering on, otherwise `409`.

```json
{"runtime_variables": {"DRY_RUN": "true"}}
```

`runtime_variables` become environment variables for this run only.

**Response** `201`:

```json
{
  "success": true,
  "run_id": "5a1c…",
  "run": {"id": "…", "workflow_id": "…", "status": "queued", "trigger_type": "api",
          "triggered_by": "alice", "queued_at": "…", "started_at": null, "completed_at": null}
}
```

`run` is the trigger record; follow the run itself with `GET runs/{run_id}/`.

## `GET runs/` and `GET workflows/{id}/runs/`

Runs you can view, newest first. Paginated.

```json
{"count": 1, "next": null, "previous": null,
 "results": [{"id": "…", "name": "Create bucket #12", "sequence": 12, "workflow_id": "…",
              "workflow_name": "Create bucket", "status": "success", "submitted_by": "alice",
              "created_at": "…", "completed_at": "…"}]}
```

## `GET runs/{id}/`

The run, why it failed, and each attempt (latest first) with its steps.

```json
{
  "id": "…",
  "name": "Create bucket #12",
  "status": "failed",
  "workflow_id": "…",
  "request_id": "…",
  "error_message": "Step 'Create' exited with code 1",
  "queued_at": "…", "started_at": "…", "completed_at": "…", "duration": 41.2,
  "attempts": [
    {
      "run": {"id": "…", "status": "failed", "attempt": 1, "started_at": "…", "completed_at": "…",
              "duration": 40.8, "total_lines": 212},
      "steps": [{"index": 0, "name": "Create", "status": "failed", "exit_code": 1, "…": "…"}],
      "summary": {"total": 1, "…": "…"},
      "source_ref": "v1.2.0",
      "commit_sha": "9f2c…"
    }
  ]
}
```

## `GET runs/{id}/logs/`

Log lines in order, up to 500 per call.

| Query | Notes |
|---|---|
| `attempt` | Attempt id. Default: the latest. |
| `step` | Only this step's lines (its `index`). |
| `after` | Continue after this `seq`: pass the previous response's `next_after`. |

```json
{
  "success": true,
  "attempt_id": "…",
  "attempt_status": "failed",
  "logs": [{"id": 1, "seq": 0, "step_index": 0, "step_name": "Create", "stream": "stdout",
            "content": "Creating bucket logs", "timestamp": "…"}],
  "next_after": null
}
```

`next_after` is `null` when there are no more lines (so far, for a running attempt).

## `POST runs/{id}/rerun/`

Queues a finished run again as a new attempt, with the same inputs.

**Permission:** `run.manage`. `409` unless the run is finished; `403` if the workflow isn't active.

## `POST runs/{id}/cancel/`

Cancels a run no runner has picked up yet. `409` unless it's `queued`.
