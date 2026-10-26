# Workflows

A workflow is either a **request** workflow (people submit a form, optionally approved before it runs) or a **job** (run manually, by API or on a schedule). Its files are stored in Bentra (*local*) or read from a repository through a VCS connector (*vcs*).

| Method | Path | Scope | MCP tool |
|---|---|---|---|
| `GET` | `workflows/` | `read:workflows` | `list_workflows` |
| `GET` | `workflows/{id}/` | `read:workflows` | `get_workflow` |
| `POST` | `workflows/` | `edit:workflows` | `create_workflow` |
| `PATCH` | `workflows/{id}/` | `edit:workflows` | `update_workflow` |
| `GET` | `workflows/{id}/settings/` | `read:workflows` | `get_workflow_settings` |
| `PATCH` | `workflows/{id}/settings/` | `edit:workflows` | `update_workflow_settings` |
| `POST` | `workflows/{id}/status/` | `edit:workflows` | `set_workflow_status` |
| `DELETE` | `workflows/{id}/` | `edit:workflows` | `delete_workflow` |
| `GET` | `workflows/{id}/form/` | `read:workflows` | `get_form` |
| `PUT` | `workflows/{id}/form/` | `edit:workflows` | `update_form` |

Approvers, roles and form sharing are on [Workflow access](workflow-access.md).

---

## `GET workflows/`

Workflows you can access, newest first. Paginated.

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "9394b000-a0e4-4b43-bc9f-4b4d8fb22e49",
      "name": "Create bucket",
      "slug": "create-bucket",
      "description": "",
      "status": "active",
      "workflow_type": "request",
      "owner_username": "alice",
      "tags": [{"key": "team", "value": "platform"}],
      "created_at": "2026-10-09T12:00:00Z",
      "updated_at": "2026-10-09T12:00:00Z"
    }
  ]
}
```

## `GET workflows/{id}/`

One workflow, with its workspace, runner pool and source.

```json
{
  "id": "9394b000-a0e4-4b43-bc9f-4b4d8fb22e49",
  "name": "Create bucket",
  "slug": "create-bucket",
  "description": "",
  "status": "active",
  "workflow_type": "request",
  "workspace": "platform",
  "owner_username": "alice",
  "tags": [],
  "runner_pool": null,
  "source": {
    "type": "vcs",
    "connector": {"id": "…", "name": "GitHub", "vcs_type": "github"},
    "repo_url": "https://github.com/acme/infra",
    "tracking_mode": "tag",
    "branch": "",
    "tag": "v1.2.0",
    "workflow_file_path": ".bento/workflow/workflow.yml",
    "readme_path": "README.md",
    "form_file_path": ".bento/form/form.yml"
  },
  "created_at": "2026-10-09T12:00:00+00:00",
  "updated_at": "2026-10-09T12:00:00+00:00"
}
```

For a local workflow, `source` is `{"type": "local"}`. `runner_pool` is `{"id", "name"}` when the workflow is pinned to a pool, otherwise `null` (the organization's default pool).

## `POST workflows/`

Creates a workflow in a workspace you belong to. You become its admin.

**Permission:** `org.create_workflow`.

| Field | Required | Notes |
|---|---|---|
| `workspace` | yes | Workspace slug ([list workspaces](administration.md#workspaces)). |
| `name` | yes | Unique among the workspace's workflows. |
| `workflow_type` | yes | `request` or `job`. |
| `description` | no | |
| `tags` | no | `[{"key": "team", "value": "platform"}]`, keys unique. |
| `source` | no | Where the files live. Omit for local. |

`source` for a repo-backed workflow:

| Field | Required | Notes |
|---|---|---|
| `type` | yes | `vcs` (or `local`). |
| `connector_id` | yes | A [connector](organization.md#get-connectors) of this organization. |
| `repository` | yes | `owner/repo`. Many workflows may use the same repository. |
| `branch` | no | Branch to track. Default: the repository's default branch. |
| `tag` | no | Tag to pin instead of a branch (a fixed version). Not with `branch`. |
| `workflow_file_path` | no | Default `.bento/workflow/workflow.yml`. Relative to the repository root. |
| `form_file_path` | no | Request workflows. Default `.bento/form/form.yml`. |

=== "Repo-backed job, pinned to a tag"

    ```json
    {
      "workspace": "platform",
      "name": "Nightly cleanup",
      "workflow_type": "job",
      "source": {
        "type": "vcs",
        "connector_id": "6c2f…",
        "repository": "acme/infra",
        "tag": "v1.2.0",
        "workflow_file_path": "cleanup/workflow.yml"
      }
    }
    ```

=== "Local request workflow"

    ```json
    {
      "workspace": "platform",
      "name": "Create bucket",
      "workflow_type": "request"
    }
    ```

    Local workflows start with starter files (`.bento/workflow/workflow.yml`, `requirements.txt`, and `.bento/form/form.yml` for request workflows) and a published v1. Edit the files, then publish a version.

**Response** `201`: `{"success": true, "workflow": {…}}` with the same shape as `GET workflows/{id}/`.

**Errors:** `400` with `errors.name`, `errors.workflow_type`, `errors.workspace` or `errors.source.<field>`; `403` without `org.create_workflow`.

## `PATCH workflows/{id}/`

Changes only the fields you send.

**Permission:** `workflow.manage_form_settings`; changing the connector also needs `workflow.edit`.

| Field | Notes |
|---|---|
| `name` | Unique in the workspace. The slug doesn't change. |
| `description` | |
| `tags` | Replaces all tags. `[]` clears them. |
| `runner_pool_id` | A [runner pool](organization.md#get-runner-pools) id, or `null` for the default pool. |
| `source.connector_id` | Repo-backed only. A [connector](organization.md) id, or `null` to disconnect. A workflow whose connector was deleted has none until you set one. |
| `source.branch` | Track this branch (clears any pinned tag). |
| `source.tag` | Pin this tag. |
| `source.workflow_file_path`, `source.readme_path`, `source.form_file_path` | Relative to the repository root. |

```json
{"source": {"tag": "v1.3.0"}, "runner_pool_id": null}
```

**Response** `200`: `{"success": true, "workflow": {…}}`.

**Errors:** `400` for a duplicate name, unknown pool or connector, a path outside the repository, `source` on a local workflow, or `form_file_path` on a job.

## `GET workflows/{id}/settings/`

Intake, approval and notification settings for request workflows; trigger channels and schedule for jobs.

=== "Request workflow"

    ```json
    {
      "success": true,
      "settings": {
        "description": "",
        "api_enabled": true,
        "listed_in_forms": true,
        "form_visibility": "this_workspace",
        "portal_enabled": false,
        "icon": "file-text",
        "category": "other",
        "require_approvers": true,
        "required_approvals": 2,
        "auto_deploy_on_approval": true,
        "notify_submission": true,
        "notify_approval": true,
        "notify_rejection": true,
        "notify_completion": true,
        "notify_failure": true
      }
    }
    ```

=== "Job"

    ```json
    {
      "success": true,
      "settings": {
        "description": "",
        "manual_trigger_enabled": true,
        "api_enabled": true,
        "schedule": {"enabled": true, "cron": "0 3 * * *", "timezone": "UTC"}
      }
    }
    ```

## `PATCH workflows/{id}/settings/`

Changes only the settings you send. Sending a setting of the other workflow type returns `400`.

**Permission:** `workflow.manage_form_settings`.

| Setting | Type | Meaning |
|---|---|---|
| `api_enabled` | request | Accept submissions through the API. |
| `listed_in_forms` | request | Shown in the Forms list (unlisted forms still work by link). |
| `form_visibility` | request | `this_workspace`, `all_workspaces`, or `selected_workspaces` ([share list](workflow-access.md#form-visibility)). |
| `portal_enabled` | request | Listed in the organization's request portal. |
| `icon` | request | Lucide icon on the form's card: `file-text`, `cloud`, `server`, `database`, `layout-grid`, `shield`, `lock`, `users`, `code-xml`, `git-branch`, `key-round`, `zap`. |
| `category` | request | Request portal category, independent of the icon: `access`, `infrastructure`, `data`, `developer_tools`, `security`, `operations`, `people`, `other` (default). |
| `require_approvers` | request | Requests need approval before they run. |
| `required_approvals` | request | 1–20 approvals. Approvers are set on [Workflow access](workflow-access.md#approvers). |
| `auto_deploy_on_approval` | request | Run as soon as approved. |
| `notify_*` | request | Email notifications. |
| `manual_trigger_enabled`, `api_enabled` | job | Trigger channels. |
| `schedule` | job | `{"enabled": true, "cron": "0 3 * * *", "timezone": "Europe/London"}`. At least 5 minutes apart. |
| `description` | both | |

The intake channels only apply while the workflow is `active`.

## `POST workflows/{id}/status/`

```json
{"status": "paused"}
```

`active` ↔ `paused` needs `workflow.edit`; archiving or restoring needs `workflow.delete`. Paused and archived workflows accept no new requests or runs.

**Response:** `{"success": true, "status": "paused"}`.

## `DELETE workflows/{id}/`

Permanently deletes the workflow and everything it owns: files, versions, settings, requests, runs and their logs, datasets, data grants, approvers and roles. It can't be undone. A repository the workflow reads from is not touched. To stop a workflow but keep its history, archive it instead.

Needs `workflow.delete`. Refused with `409` while the workflow has a `queued` or `running` run; cancel those first.

**Response:** `204 No Content`.

## `GET workflows/{id}/form/`

A request workflow's `form.yml`. For a Bentra-stored workflow it's the draft (`"source": "draft"`); for a repo-backed one it's the file at the tracked branch or pinned tag (`"source": "repository"`, with `ref`).

```json
{"success": true, "source": "repository", "path": ".bento/form/form.yml", "ref": "v1.2.0", "yaml": "name: …"}
```

## `PUT workflows/{id}/form/`

Changes a request workflow's form. **Permission:** `workflow.manage_form_settings`.

| Field | Notes |
|---|---|
| `yaml` | The whole new `form.yml` ([form syntax](../form-syntax.md)). |
| `acknowledge_invalid` | Save even if it doesn't validate. Otherwise invalid forms return `422` with `errors` (message and line). |
| `commit_message` | Repo-backed only: commit message and pull request title. |
| `branch_name` | Repo-backed only: the branch to create. Default `bento/form-<slug>-<timestamp>`. |

- **Bentra-stored:** saves the draft and returns `{"success": true, "saved_local": true}`. Publish a version to make it live.
- **Repo-backed:** creates a branch from the tracked branch (or the default branch for a tag-pinned workflow), commits the form file and opens a pull request: `{"success": true, "pr_url": "…", "pr_number": 7, "branch": "…"}`. The form changes once the pull request is merged (and, for a tag-pinned workflow, a new tag is pinned). `502` if the provider refuses.
