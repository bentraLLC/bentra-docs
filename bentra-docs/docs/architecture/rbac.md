# RBAC & Multi-Tenancy

Bentra is multi-tenant by construction. Every resource is scoped to an `Organization`, and within an org, access is gated by a permission system in the `permissions` app.

## Two Layers

There are **two orthogonal layers** of access control:

1. **Org membership** (`organizations.OrganizationMembership`) — gatekeeps entry to the org at all. If you're not a member, URL resolution for `/orgs/{slug}/...` raises `PermissionDenied`.
2. **Permissions** (`permissions.RoleAssignment`) — fine-grained per-resource permissions inside an org. Enforced by `@require_permission` decorators on views and by `get_accessible_*` helpers on querysets.

## Tenancy — `organizations`

### Model

```
Organization (id, name, slug)
    ↕ FK on every domain model
    
OrganizationMembership (user, organization, role)
    role ∈ {owner, admin, member}
```

The `role` field on `OrganizationMembership` is used only by org-admin flows (like kicking members) and is **not** the RBAC system. The RBAC system lives in the `permissions` app and assigns *Roles* that carry *permission strings*.

### URL Resolution — `OrganizationMiddleware`

Installed in `MIDDLEWARE` after `AuthenticationMiddleware`. Runs on every request:

1. Set `request.organization = None`.
2. If path is `/orgs/` or `/orgs/` (trailing slash variants), bypass.
3. If path starts with `/accounts/`, `/static/`, `/orgs/new`, or `/api/me/`, bypass.
4. Match `/orgs/{slug}/`:
   - Look up the org by slug. Missing → `Http404`.
   - If user is authenticated and not a superuser, check membership. Non-member → `PermissionDenied`.
   - Attach `request.organization`.

The **runner API** (`/api/v1/runner/`) is mounted at root, outside `/orgs/{slug}/`, so it bypasses this middleware. Runner org resolution is done entirely from the bearer token in `RunnerTokenAuthentication`.

### Data Scoping

Every domain model carries an `organization` FK. Queries must filter on it, either directly or via the RBAC helpers. Examples of apps that do this correctly:

- `permissions.services.get_accessible_workflows(user, org)` returns only workflows in `org` that `user` has `workflow.view` on.
- `permissions.services.get_accessible_deployments(user, org)` is the equivalent for deployments.
- `api.views.WorkflowViewSet.get_queryset` calls `get_accessible_workflows(self.request.user, self.request.organization)`.

## Permissions — `permissions`

### Constants

Lives in `permissions/constants.py`. Each permission is a dotted string like `workflow.view` or `org.manage_connectors`.

**Organization scope** (`ALL_ORG_PERMISSIONS`):

- `org.manage_settings`
- `org.manage_members`
- `org.manage_groups`
- `org.view_members`
- `org.create_workflow`
- `org.view_connectors`
- `org.manage_connectors`
- `org.view_variable_collections`
- `org.manage_variable_collections`

**Workflow scope** (`ALL_WORKFLOW_PERMISSIONS`):

- `workflow.view`
- `workflow.edit`
- `workflow.delete`
- `workflow.manage_permissions`
- `workflow.execute`
- `workflow.manage_form_settings`
- `workflow.manage_variables`

**Deployment scope** (`ALL_DEPLOYMENT_PERMISSIONS`):

- `deployment.view`
- `deployment.manage`
- `deployment.manage_permissions`

### Seeded Roles

Roles are seeded (`is_system=True`) from `SEEDED_ROLES` in `constants.py`. Each role is `(name, scope, permissions, description)`:

| Scope | Name | Permissions |
|---|---|---|
| organization | `admin` | all org perms |
| organization | `user` | `create_workflow`, `view_connectors`, `view_variable_collections`, `view_members` |
| workflow | `admin` | all workflow perms |
| workflow | `writer` | `view`, `edit`, `execute`, `manage_form_settings`, `manage_variables` |
| workflow | `reader` | `view` |
| deployment | `admin` | all deployment perms |
| deployment | `writer` | `view`, `manage` |
| deployment | `reader` | `view` |

User-defined roles can be added too (with `is_system=False`).

### Models

```
Role (name, scope, permissions: JSON list, is_system)
  (name, scope) unique

RoleAssignment (user, role, organization, workflow?, deployment?)
  - organization always required
  - workflow required for workflow/deployment scopes
  - deployment required only for deployment scope
  - check constraint: deployment requires workflow
  - clean() validates scope matches which FKs are set
```

### Granularity Example

User Alice is:

- An **org admin** at Acme Corp → one `RoleAssignment` with `role=(admin, organization)`, `organization=Acme`, `workflow=null`, `deployment=null`.
- A **workflow writer** on the "deploy-api" workflow → one `RoleAssignment` with `role=(writer, workflow)`, `organization=Acme`, `workflow=deploy-api`, `deployment=null`.
- A **deployment reader** on a specific deploy-api deployment → one `RoleAssignment` with `role=(reader, deployment)`, `organization=Acme`, `workflow=deploy-api`, `deployment=<uuid>`.

She inherits every permission in the union of those roles.

### Enforcement

**View-level** — `@require_permission` decorator:

```python
from permissions.decorators import require_permission
from permissions.constants import DEPLOYMENT_VIEW

@login_required
@require_permission(
    DEPLOYMENT_VIEW,
    resource_kwarg="deployment_id",
    resource_type="deployment",
)
def deployment_detail(request, deployment_id):
    ...
```

The decorator:

1. Resolves the resource via `resource_kwarg` + `resource_type`.
2. Calls `has_permission(user, organization, permission, resource)`.
3. Raises `PermissionDenied` on failure.

**Queryset-level** — `get_accessible_*` helpers:

```python
from permissions.services import get_accessible_workflows, get_accessible_deployments

workflows   = get_accessible_workflows(request.user, request.organization)
deployments = get_accessible_deployments(request.user, request.organization)
```

These return filtered querysets limited to resources the user has at least `view` permission on. Used by list views and the DRF viewsets.

**Template-level** — `has_permission()`:

```python
from permissions.services import has_permission
from permissions.constants import WORKFLOW_EDIT

if has_permission(request.user, request.organization, WORKFLOW_EDIT, workflow):
    show_edit_button = True
```

## Groups & Form Access — `permissions` (continued)

Groups are a lighter-weight mechanism for gating **form access** specifically.

- **`Group`** — org-scoped, `(organization, name)` unique.
- **`GroupMember`** — users in a group. `(group, user)` unique.
- **`GroupOwner`** — users who can manage the group.
- **`FormAccessRestriction`** — `(form, group)` unique. **If any rows exist for a form, only users in those groups can access it.** No rows = all org members can access.

Groups don't grant permissions per se — they only gate form visibility. RBAC roles control everything else.

## Authentication Tokens

Two separate bearer-token systems, each with its own auth class:

### `settings.ApiToken` — user-facing API

- Created by a user from the Settings UI, scoped to their org + a permission-scope list (`read:workflows`, `read:deployments`).
- SHA-256 hash stored; plaintext returned **once**.
- `token_urlsafe(48)` raw form; first 12 chars stored as `token_prefix` for cheap lookups.
- Default 90-day expiry.
- Authenticated via `api/authentication.py::ApiTokenAuthentication` — also validates that the token's org matches `request.organization` (from the URL slug). Cross-org usage is rejected even if the token hash matches.

### `runners.RunnerToken` — runner API

- Created by an org admin from the Runners Settings UI, bound to a specific `RunnerPool`.
- SHA-256 hash stored; plaintext `rnr_{prefix}_{hex}` returned once.
- Authenticated via `runners/authentication.py::RunnerTokenAuthentication` — returns a `RunnerUser` proxy (not a Django User) exposing `.organization` and `.pool`.
- No URL-based org check (runner API is not `/orgs/{slug}/`); org comes entirely from the token.

## Cross-Cutting: Why Two Token Types?

They serve different trust models:

| | `ApiToken` | `RunnerToken` |
|---|---|---|
| Subject | A user | A machine |
| Scoped to | User + Org + permission list | Org + Pool |
| Lives where | On developer laptop / CI | In a Docker container / K8s secret |
| Authorization | DRF permissions + RBAC helpers | Pool isolation in the query |
| Expiry default | 90 days | none by default |
| Returned as | `rest_framework.User` (the owner) | `RunnerUser` proxy |

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│ OrganizationMiddleware                                      │
│   /orgs/{slug}/ → resolves slug → request.organization      │
│   membership check → 404 or PermissionDenied on miss        │
└─────────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           │                             │
    ┌──────▼──────┐                ┌─────▼──────┐
    │ Session auth│                │ApiToken    │
    │ (web UI)    │                │(API tokens)│
    └──────┬──────┘                └─────┬──────┘
           │                             │
           └──────────────┬──────────────┘
                          │
                 ┌────────▼────────┐
                 │ @require_       │
                 │   permission    │  ← RBAC check
                 │ get_accessible_*│
                 └─────────────────┘

        ─────────────  (separate surface)  ─────────────

┌─────────────────────────────────────────────────────────────┐
│ /api/v1/runner/...                                          │
│   RunnerTokenAuthentication                                 │
│     → token.organization, token.pool                        │
│     → queries filter by org + pool; no middleware           │
└─────────────────────────────────────────────────────────────┘
```
