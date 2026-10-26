# Plan and account

The organization's plan, what it includes, its limits and this month's usage, and the other organizations on the same account. See [Plans and limits](../../plans.md) for what each plan includes.

| Method | Path | Scope | MCP tool |
|---|---|---|---|
| `GET` | `plan/` | `read:org` | `get_plan` |
| `GET` | `account/organizations/` | `read:org` | `list_account_organizations` |
| `POST` | `account/organizations/` | `manage:org` | `create_account_organization` |

---

## `GET plan/`

Every member can read it. `license_key` is only included for callers with `org.manage_settings`.

```json
{
  "plan": {"key": "free", "name": "Free"},
  "active": true,
  "expires_at": null,
  "features": [
    {"key": "sso", "label": "Single sign-on", "enabled": false, "available_on": "enterprise"},
    {"key": "portal", "label": "The employee request portal", "enabled": false, "available_on": "enterprise"}
  ],
  "limits": {"max_orgs": 1, "max_users": 3, "max_workflows": 5, "max_runners_per_pool": 1,
             "max_active_schedules": 2, "max_runs_per_month": 300, "log_retention_days": 3},
  "usage": {"users": 2, "workflows": 4, "runs_this_month": 120, "active_schedules": 1, "orgs": 1,
            "period_resets_at": "2026-11-01T00:00:00+00:00"},
  "meters": [
    {"key": "max_workflows", "label": "Workflows", "used": 4, "limit": 5, "percent": 80,
     "tone": "warning", "unlimited": false, "monthly": false, "noun": "workflows"}
  ],
  "license_key": "lic_…"
}
```

- A `null` limit means unlimited.
- `tone` is `neutral` under 80% of the limit, `warning` from 80%, and `danger` at the limit.
- `active: false` means the plan expired. The organization then gets Free entitlements and keeps its data.
- `plan: null` means the organization has no account (only staff-created test orgs).

## `GET account/organizations/`

Organizations that share this organization's account (License). Needs `org.manage_settings`.

```json
{"results": [{"id": "…", "name": "Acme", "slug": "k3j9x2m4pqrt"},
             {"id": "…", "name": "Acme EU", "slug": "p7q2n5vbx4ma"}]}
```

## `POST account/organizations/`

`{"name": "Acme EU"}`. Owners and admins of an organization on a Business (up to 3 organizations) or Enterprise (unlimited) account can use it. The caller becomes the new organization's owner. `201` with `{"organization": {...}}`, `409` with `code: "plan_limit_reached"` when the account is full or the plan allows one organization, and `403` for members.

---

## Plan errors elsewhere

| Status | `code` | When |
|---|---|---|
| `402` | `plan_required` | A feature isn't on the plan: the portal API, branding changes, `portal_enabled`, requester invitations, `jit_role: requester`, SSO. The body names `feature` and the `plan` that includes it. |
| `409` | `plan_limit_reached` | Submissions and triggers once the month's runs are used, or restoring an archived workflow at the workflow limit. |
| `400` | | Creating a workflow at the workflow limit (`errors.name`), or saving a schedule over the schedule limit. |
| `409` | | Inviting a member at the user limit. |
