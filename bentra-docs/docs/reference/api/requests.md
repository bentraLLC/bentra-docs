# Requests

A request is one submission of a request workflow's form. Its status moves through:

```
pending ──approve (enough approvals)──▶ approved ──▶ executing ──▶ completed | failed
   │  ▲                                                    
   │  └── update answers ── changes_requested ◀── request changes
   ├── reject ──▶ rejected
   └── cancel ──▶ cancelled
```

Requests that don't need approval start running as soon as they're submitted. Approval itself lives on the request; the execution is a [run](runs.md).

| Method | Path | Scope | MCP tool |
|---|---|---|---|
| `POST` | `workflows/{id}/submit/` | `submit:workflow_requests` | `submit_request` |
| `GET` | `workflows/{id}/form-options/` | `read:workflows` | `get_form_options` |
| `GET` | `requests/` | `read:requests` | `list_requests` |
| `GET` | `requests/{id}/` | `read:requests` | `get_request` |
| `PATCH` | `requests/{id}/` | `submit:workflow_requests` | `update_request` |
| `GET` | `requests/{id}/activity/` | `read:requests` | `get_request_activity` |
| `GET` | `requests/{id}/comments/` | `read:requests` | `list_request_comments` |
| `POST` | `requests/{id}/comments/` | `comment:requests` | `add_request_comment` |
| `POST` | `requests/{id}/cancel/` | `submit:workflow_requests` | `cancel_request` |
| `POST` | `requests/{id}/approve/` | `approve:workflow_requests` | `approve_request` |
| `POST` | `requests/{id}/reject/` | `approve:workflow_requests` | `reject_request` |
| `POST` | `requests/{id}/request-changes/` | `approve:workflow_requests` | `request_changes` |

---

## `POST workflows/{id}/submit/`

The API equivalent of filling in the form.

**Permission:** `workflow.execute`. The workflow must be active with API intake on, otherwise `409`.

```json
{"form_data": {"bucket_name": "logs", "region": "eu-west-1"}, "skip_approval": false}
```

`form_data` is keyed by the form's field ids. `skip_approval` needs the `skip:workflow_approval` scope (personal tokens) and the `workflow.skip_approval` permission.

**Response** `201`:

```json
{"success": true, "request_id": "…", "status": "pending"}
```

**Errors:** `422` with `errors` per field when answers don't pass the form's validation; `400` if the workflow isn't a request workflow or its form can't be loaded.

## `GET workflows/{id}/form-options/`

Current choices for fields whose options come from job datasets (`options_from` in form.yml).

## `GET requests/`

Requests you can see: on workflows you can view, ones you submitted, and ones you're a designated approver on. Newest first, paginated.

| Query | Notes |
|---|---|
| `status` | `pending`, `changes_requested`, `approved`, `executing`, `completed`, `failed`, `cancelled`, `rejected`. |
| `workflow` | Workflow id. |
| `awaiting` | `me`: pending requests waiting on your decision. |

## `GET requests/{id}/`

```json
{
  "id": "…",
  "workflow_id": "…",
  "workflow_name": "Create bucket",
  "status": "pending",
  "submitted_by": "alice",
  "form_data": {"bucket_name": "logs"},
  "notes": "",
  "approval_required": true,
  "approvers_required": 2,
  "approval_count": 1,
  "run_id": null,
  "created_at": "…",
  "approved_at": null,
  "completed_at": null,
  "approvals": [
    {"username": "bob", "name": "Bob Lee", "state": "approved", "notes": "lgtm"},
    {"username": "carol", "name": "carol", "state": "waiting", "notes": ""}
  ],
  "capabilities": {
    "is_submitter": false, "is_approver": true, "can_cancel": false, "can_edit": false,
    "can_approve": true, "can_reject": true, "can_request_changes": true, "can_view_run": true
  }
}
```

`approvals[].state` is `waiting`, `approved`, `rejected` or `changes_requested`. `capabilities` says what *you* can do with the request now.

## `PATCH requests/{id}/`

The submitter updates the answers while the request is `pending` or `changes_requested`. The old answers are kept as a revision, approvals already given are cleared, and the request goes back to `pending`.

```json
{"form_data": {"bucket_name": "logs-eu", "region": "eu-west-1"}}
```

Send every answer, not only the changed ones.

**Response** `200`: `{"success": true, "request": {…}}`.

**Errors:** `403` if you didn't submit it; `409` once it's approved, running or finished, or if the workflow stopped taking API requests; `422` for invalid answers.

## `GET requests/{id}/activity/`

Everything that happened, newest first. `type` is `created`, `status_change`, `approval`, `comment` or `revision` (the submitter updated the answers; `changes` lists what changed).

```json
{
  "success": true,
  "activity": [
    {"type": "approval", "timestamp": "…", "author": "Bob Lee", "action_type": "approved",
     "action_text": "approved", "notes": "lgtm"},
    {"type": "comment", "timestamp": "…", "author": "Bob Lee", "content": "Which account?",
     "is_system": false},
    {"type": "status_change", "timestamp": "…", "author": "Alice Kim", "previous_status": "Changes requested",
     "new_status": "Pending", "notes": ""},
    {"type": "created", "timestamp": "…", "author": "Alice Kim"}
  ]
}
```

## `GET requests/{id}/comments/`

```json
{"success": true, "comments": [{"id": "…", "author": "Bob Lee", "content": "Which account?", "created_at": "…"}]}
```

## `POST requests/{id}/comments/`

`{"content": "The prod account, please."}`. Anyone who can see the request can comment. Up to 5000 characters.

**Response** `201`: `{"success": true, "comment": {…}}`.

## `POST requests/{id}/cancel/`

The submitter cancels a request that hasn't started running. `409` otherwise.

## `POST requests/{id}/approve/`

As a designated approver. `notes` is optional.

```json
{
  "success": true,
  "request_status": "approved",
  "is_fully_approved": true,
  "approval_count": 2,
  "approvers_required": 2,
  "message": "Request approved and execution triggered successfully",
  "execution_id": "…"
}
```

The last required approval starts the run (when `auto_deploy_on_approval` is on).

## `POST requests/{id}/reject/` and `POST requests/{id}/request-changes/`

As a designated approver. `notes` (the reason, or what to change) is required.

```json
{"notes": "Use the eu-west-1 region."}
```

**Errors** for all decisions: `403` if you're not a designated approver; `409` if the request isn't pending.
