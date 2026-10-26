# Job datasets

A job can publish JSON datasets (declared under `outputs.datasets` in its [workflow.yml](../workflow-syntax.md)). Request forms read them for dropdown options (`options_from`) and other jobs read them as inputs. Each successful run that changes a dataset adds a version; the **current** version is what readers see.

Who can read a job's data: workflows in its **data scope** (this workspace, selected workspaces, or all workspaces of the organization) that hold a **read grant**. Never across organizations.

| Method | Path | Scope | MCP tool |
|---|---|---|---|
| `GET` | `workflows/{id}/datasets/` | `read:workflows` | `list_job_datasets` |
| `GET` | `workflows/{id}/datasets/{name}/` | `read:workflows` | `get_job_dataset` |
| `GET` | `workflows/{id}/datasets/{name}/versions/` | `read:workflows` | — |
| `POST` | `workflows/{id}/datasets/{name}/promote/` | `manage:data_sharing` | `promote_dataset_version` |
| `POST` | `workflows/{id}/datasets/{name}/freeze/` | `manage:data_sharing` | `freeze_dataset` |
| `GET` | `workflows/{id}/data-sharing/` | `read:workflows` | `get_data_sharing` |
| `PUT` | `workflows/{id}/data-sharing/` | `manage:data_sharing` | `update_data_sharing` |
| `GET` | `workflows/{id}/data-grants/` | `read:workflows` | — |
| `POST` | `workflows/{id}/data-grants/` | `manage:data_sharing` | `grant_data_access` |
| `DELETE` | `workflows/{id}/data-grants/{grant_id}/` | `manage:data_sharing` | `revoke_data_access` |
| `GET` | `workflows/{id}/data-access/` | `read:workflows` | `get_data_access` |
| `GET` | `workflows/{id}/form-options/` | `read:workflows` | `get_form_options` |

Changes need `workflow.manage_data_sharing` on the job. Endpoints other than `data-access/` and `form-options/` are for job workflows only.

---

## Datasets and versions

`GET workflows/{id}/datasets/{name}/` returns the dataset with its versions and which one is current.

### `POST workflows/{id}/datasets/{name}/promote/`

`{"version": "<version id>"}` makes an earlier version current again (roll back the data).

### `POST workflows/{id}/datasets/{name}/freeze/`

`{"frozen": true}` keeps the current version in place: new runs still record versions but don't replace it. `{"frozen": false}` resumes.

## Data scope and grants

### `PUT workflows/{id}/data-sharing/`

```json
{"visibility": "selected_workspaces", "workspace_ids": ["…"], "dry_run": true}
```

`visibility` is `this_workspace`, `selected_workspaces` or `all_workspaces`. Grants outside the new scope are suspended, not deleted, and come back if the scope widens; the response's `suspended` lists the workflows that lost access. With `dry_run` nothing changes.

### `POST workflows/{id}/data-grants/`

`{"consumer_id": "<workflow id>"}` lets a workflow in the scope read this job's datasets. `400` if it's outside the scope; `404` if it isn't in this organization.

### `DELETE workflows/{id}/data-grants/{grant_id}/`

Revokes a grant.

### `GET workflows/{id}/data-access/`

From the reader's side: which jobs' data this workflow can read.
