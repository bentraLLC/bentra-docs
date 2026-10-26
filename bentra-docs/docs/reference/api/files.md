# Files and versions

Workflows stored in Bentra (`source.type` `local`) keep their files in a **draft** you edit, and immutable **versions** cut from it. Only the active version runs; editing the draft changes nothing until you publish. Repo-backed workflows read their files from the repository instead: these endpoints return `404` for them.

| Method | Path | Scope | MCP tool |
|---|---|---|---|
| `GET` | `workflows/{id}/files/` | `read:workflows` | `list_files` |
| `POST` | `workflows/{id}/files/` | `edit:workflows` | `create_file` |
| `GET` | `workflows/{id}/files/content/?path=` | `read:workflows` | `read_file` |
| `PUT` | `workflows/{id}/files/content/` | `edit:workflows` | `update_file` |
| `DELETE` | `workflows/{id}/files/content/?path=` | `edit:workflows` | `delete_file` |
| `GET` | `workflows/{id}/versions/` | `read:workflows` | `list_versions` |
| `POST` | `workflows/{id}/versions/` | `edit:workflows` | `publish_version` |
| `POST` | `workflows/{id}/versions/{version_id}/activate/` | `edit:workflows` | `activate_version` |

Reads need `workflow.view`; writes need `workflow.edit`.

---

## Files

Every workflow has `.bento/workflow/workflow.yml` (the steps); request workflows also have `.bento/form/form.yml` ([form syntax](../form-syntax.md)). These are required and can't be deleted. Python dependencies go in `requirements.txt`.

### `GET workflows/{id}/files/`

```json
{"success": true, "read_only": false,
 "files": [{"path": ".bento/workflow/workflow.yml", "is_required": true},
           {"path": "requirements.txt", "is_required": false}]}
```

`?version=<version_id>` lists a version's files instead (`read_only: true`).

### `GET workflows/{id}/files/content/?path=.bento/workflow/workflow.yml`

```json
{"success": true, "path": ".bento/workflow/workflow.yml", "content": "name: …", "read_only": false}
```

Also takes `?version=`.

### `POST workflows/{id}/files/`

`{"path": "scripts/create.sh", "content": "#!/bin/bash\n…"}` creates a draft file. Paths are relative, without `..`. `409` if the path exists; `400` for an invalid path, too many files, or too much content.

### `PUT workflows/{id}/files/content/`

`{"path": "…", "content": "…"}` replaces an existing draft file's content.

### `DELETE workflows/{id}/files/content/?path=…`

Deletes a draft file. Required files return `400`.

---

## Versions

### `GET workflows/{id}/versions/`

```json
{"success": true, "versions": [
  {"id": "…", "version_number": 2, "label": "add region", "created_at": "…", "created_by": "alice", "is_active": true},
  {"id": "…", "version_number": 1, "label": "", "created_at": "…", "created_by": "alice", "is_active": false}
]}
```

### `POST workflows/{id}/versions/`

`{"label": "add region"}`. Snapshots the draft as the next version and makes it active. `400` if `workflow.yml` isn't valid YAML, or a request workflow's form doesn't validate.

### `POST workflows/{id}/versions/{version_id}/activate/`

Makes an existing version the one that runs: pin a known-good version or roll back. The draft isn't changed. Returns `{"success": true, "version": {…}}`.
