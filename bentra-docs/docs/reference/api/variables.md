# Variables

Variables reach a workflow's steps as environment variables. They come from **variable collections** (reusable sets in a workspace, attached to any number of workflows) and from the workflow's **own variables**, which override collection values. Among attached collections, a later one overrides an earlier one.

Secret values are stored in OpenBao and are **never returned**: responses show a masked `display_value`.

| Method | Path | Scope | MCP tool |
|---|---|---|---|
| `GET` | `variable-collections/?workspace=` | `read:variables` | `list_variable_collections` |
| `GET` | `variable-collections/{id}/` | `read:variables` | `get_variable_collection` |
| `POST` | `variable-collections/` | `edit:variables` | `create_variable_collection` |
| `PATCH` | `variable-collections/{id}/` | `edit:variables` | `update_variable_collection` |
| `DELETE` | `variable-collections/{id}/` | `edit:variables` | `delete_variable_collection` |
| `POST` | `variable-collections/{id}/variables/` | `edit:variables` | `add_collection_variable` |
| `PATCH` | `variable-collections/{id}/variables/{variable_id}/` | `edit:variables` | `update_collection_variable` |
| `DELETE` | `variable-collections/{id}/variables/{variable_id}/` | `edit:variables` | `delete_collection_variable` |
| `GET` | `workflows/{id}/variables/` | `read:variables` | `list_workflow_variables` |
| `POST` | `workflows/{id}/variables/` | `edit:variables` | `add_workflow_variable` |
| `PATCH` | `workflows/{id}/variables/{variable_id}/` | `edit:variables` | `update_workflow_variable` |
| `DELETE` | `workflows/{id}/variables/{variable_id}/` | `edit:variables` | `delete_workflow_variable` |
| `POST` | `workflows/{id}/variable-collections/` | `edit:variables` | `attach_collection` |
| `DELETE` | `workflows/{id}/variable-collections/{collection_id}/` | `edit:variables` | `detach_collection` |

**Permissions:** collections need `org.view_variable_collections` to read and `org.manage_variable_collections` to change. A workflow's variables and attached collections need `workflow.manage_variables`.

---

## A variable

```json
{"id": "…", "key": "AWS_REGION", "display_value": "eu-west-1", "is_secret": false, "treat_as_json": false}
```

Body for creating or changing one:

| Field | Notes |
|---|---|
| `key` | Letters, digits and underscores, not starting with a digit. Unique within the collection or workflow. Required on create. |
| `value` | The value. For a secret, write-only. |
| `is_secret` | Store the value in OpenBao; it's never returned. |
| `treat_as_json` | Validate the value as JSON. |

`PATCH` changes only what you send. Changing a key or value of a secret never reveals the old value.

!!! note "Secrets and agents"
    An agent can set a secret if you give it the value, but the value then passes through the conversation. Prefer entering secret values in Bentra.

## Collections

### `GET variable-collections/`

Collections in workspaces you belong to. `?workspace=<slug>` filters. Paginated.

```json
{"count": 1, "next": null, "previous": null,
 "results": [{"id": "…", "name": "AWS prod", "description": "", "workspace": "platform", "created_at": "…", "updated_at": "…"}]}
```

### `GET variable-collections/{id}/`

The collection plus `variables`.

### `POST variable-collections/`

`{"workspace": "platform", "name": "AWS prod", "description": "…"}` → `201`. `502` if secret storage is unavailable.

### `PATCH variable-collections/{id}/`

`{"name": "…", "description": "…"}`.

### `DELETE variable-collections/{id}/`

Deletes the collection, its variables and their secrets, and detaches it from workflows. Returns `204`.

## A workflow's variables

### `GET workflows/{id}/variables/`

```json
{"success": true,
 "variables": [{"id": "…", "key": "BUCKET_PREFIX", "display_value": "acme-", "is_secret": false, "treat_as_json": false}],
 "collections": [{"id": "…", "name": "AWS dev", "order": 1}, {"id": "…", "name": "AWS prod", "order": 2}],
 "overrides": [{"key": "AWS_SECRET_ACCESS_KEY",
                "used": {"type": "collection", "id": "…", "name": "AWS prod"},
                "overridden": [{"type": "collection", "id": "…", "name": "AWS dev"}]}]}
```

`collections` is in precedence order: later ones override earlier ones, and the workflow's own variables override them all.

`overrides` lists every key defined in more than one place, sorted by key: `used` is the definition a run gets, `overridden` the ones it ignores (nearest first). `type` is `collection` or `workflow`. Only keys are compared; no values are read. A run decrypts only the `used` definitions, so a broken overridden secret never fails it.

### `POST workflows/{id}/variable-collections/`

`{"collection_id": "…"}` attaches a collection from the same workspace, after the existing ones. `409` if already attached.

### `DELETE workflows/{id}/variable-collections/{collection_id}/`

Detaches it.
