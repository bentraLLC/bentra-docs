# Organization

Lookups you need before creating things (VCS connectors and their repositories, runner pools) and the request portal's branding. Workspaces, members and groups are on [Administration](administration.md).

| Method | Path | Scope | MCP tool |
|---|---|---|---|
| `GET` | `connectors/` | `read:org` | `list_connectors` |
| `GET` | `connectors/{id}/` | `read:org` | — |
| `PATCH` | `connectors/{id}/` | `manage:connectors` | `update_connector` |
| `POST` | `connectors/{id}/test/` | `manage:connectors` | `test_connector` |
| `GET` | `connectors/{id}/repositories/` | `read:org` | `list_repositories` |
| `GET` | `connectors/{id}/refs/?repo=owner/repo` | `read:org` | `list_repository_refs` |
| `GET` | `runner-pools/` | `read:org` | `list_runner_pools` |
| `GET` | `branding/` | `read:org` | `get_portal_branding` |
| `PATCH` | `branding/` | `manage:org` | `update_portal_branding` |
| `PUT` | `branding/logo/` | `manage:org` | `upload_portal_logo` |
| `DELETE` | `branding/logo/` | `manage:org` | `remove_portal_logo` |

---

## `GET connectors/`

VCS connectors you can see. Owners and admins see every connector. Everyone else sees the org-wide ones, the ones shared to a workspace they belong to, and the ones they added. `?workspace=<slug>` narrows the list to the connectors a workflow in that workspace can use. Paginated.

```json
{"count": 1, "next": null, "previous": null,
 "results": [{"id": "6c2f…", "name": "GitHub", "description": "", "vcs_type": "github",
              "auth_type": "github_app", "owner": "acme", "scope": "workspaces",
              "workspaces": ["platform"], "created_by": "dana@acme.com"}]}
```

`scope` is `organization` (every workspace) or `workspaces` (only those listed in `workspaces`).

Connectors hold credentials, so you add them and change their credentials in **Settings → Connectors**, not through the API.

## `PATCH connectors/{id}/`

Rename a connector or change where it's available. Allowed for owners and admins, and for the member who added it.

```json
{"name": "Platform GitHub", "scope": "workspaces", "workspaces": ["platform", "data"]}
```

- Only owners and admins can set `scope` to `organization`, change an org-wide connector, or share it to the default workspace or a workspace they're not in. When a member saves, workspaces they can't manage stay on the list.
- `409` with `blocking_workflows` (`slug`, `name`, `workspace`) when a workflow that uses the connector would lose it. Switch those workflows to another connector first.

## `POST connectors/{id}/test/`

Checks the stored credentials still work by listing one repository. Returns `{"success": true}`, or `502` with the provider's error.

## `GET connectors/{id}/repositories/`

Repositories the connector can reach.

| Query | Default | Notes |
|---|---|---|
| `q` | | Filter by name. |
| `page` | 1 | |
| `per_page` | 20 | Max 50. |

```json
{
  "success": true,
  "repos": [{"name": "infra", "full_name": "acme/infra", "html_url": "https://github.com/acme/infra",
             "pushed_at": "2026-10-08T21:14:03Z", "private": true}],
  "page": 1, "per_page": 20, "has_next": false, "has_prev": false, "total_count": 1
}
```

`502` if the provider refuses (for example, the connector's token expired).

## `GET connectors/{id}/refs/`

A repository's default branch, branches and tags (first 100 of each), to pick what a workflow tracks or pins.

`GET connectors/6c2f…/refs/?repo=acme/infra`

```json
{"success": true, "repo": "acme/infra", "default_branch": "main",
 "branches": ["main", "release"], "tags": ["v1.2.0", "v1.1.0"]}
```

`400` if `repo` isn't `owner/repo`; `502` if the repository doesn't exist or the connector can't reach it.

## `GET runner-pools/`

Pools a workflow can be pinned to with [`PATCH workflows/{id}/`](workflows.md#patch-workflowsid). Pools hold runner tokens, so they're created and changed in **Settings → Runners**.

```json
{"count": 1, "next": null, "previous": null,
 "results": [{"id": "…", "name": "Default", "slug": "default", "description": "",
              "scope_type": "organization", "workspace": null, "backend_type": "kubernetes",
              "is_default": true}]}
```

---

## Request portal branding

The request portal (`/orgs/<org>/portal/`) shows the portal name, welcome message, accent colour and logo.

**Permission to change:** `org.manage_settings`. Requesters (portal-only members) can't use these endpoints.

### `GET branding/`

```json
{"portal_name": "Acme Help", "welcome_message": "Ask for infrastructure here.",
 "accent_color": "#1f6feb", "logo_url": "/branding/acme/logo?v=3"}
```

### `PATCH branding/`

Any of `portal_name` (up to 100 characters), `welcome_message` (up to 1000), `accent_color` (hex, e.g. `#1f6feb`). An empty string clears a field.

### `PUT branding/logo/`

Multipart upload with a `logo` file: PNG, JPEG or WebP, up to 256 KB. SVG isn't accepted.

```bash
curl -X PUT -H "Authorization: Bearer $BENTRA_TOKEN" \
  -F logo=@logo.png https://bentra.example.com/orgs/k3j9x2m4pqrt/api/v1/branding/logo/
```

### `DELETE branding/logo/`

Removes the logo. Returns `204`.
