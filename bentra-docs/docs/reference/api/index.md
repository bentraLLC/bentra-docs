# Bentra API

The Bentra API lets scripts, integrations and AI agents do what people do in the Bentra UI: create and configure workflows, submit and approve requests, trigger and follow runs, and administer the organization. The [Bentra MCP server](../../mcp/index.md) is built on it.

Every call acts as a user and can only do what that user can do in the UI.

## Base URL

```
https://<bentra-host>/orgs/<org-id>/api/v1/
```

Paths on these pages are relative to that base. Swagger UI for your organization is at `/orgs/<org-id>/api/v1/docs/` when you're signed in.

## Authentication

Send a token as a bearer token:

```bash
curl -H "Authorization: Bearer $BENTRA_TOKEN" \
  https://bentra.example.com/orgs/k3j9x2m4pqrt/api/v1/workflows/
```

| Token | How you get it | What it can do |
|---|---|---|
| Personal access token | Settings → API in Bentra. Shown once. | Everything its user can do. |
| AI agent (delegated) token | Issued to the Bentra MCP server when you connect an agent. Short-lived. | Everything its user can do through the scopes below, except skipping approval. |

A token belongs to one organization; using it on another organization's URL returns `401`.

## Scopes

Personal tokens carry `*` (all scopes). Delegated tokens carry the named scopes, and every endpoint lists the scope it needs. Scopes narrow what a token can reach; they never grant more than the user's own permissions.

| Scope | Allows |
|---|---|
| `read:workflows` | View workflows, settings, files, approvers, form visibility. |
| `edit:workflows` | Create workflows, change their details and settings, edit files, publish versions. |
| `manage:workflow_access` | Change approvers, workflow roles and form visibility. |
| `read:variables` / `edit:variables` | View or change variable collections and workflow variables. |
| `read:runs` / `manage:runs` | View runs; re-run or cancel them. |
| `trigger:workflow_runs` | Trigger job runs. |
| `read:requests` | View requests. |
| `submit:workflow_requests` | Submit, update and cancel your own requests. |
| `approve:workflow_requests` | Approve, reject or request changes where you're a designated approver. |
| `comment:requests` | Comment on requests you can view. |
| `skip:workflow_approval` | Submit without approval (personal tokens only). |
| `manage:data_sharing` | Change a job's dataset sharing. |
| `read:org` | View workspaces, members, groups, connectors, runner pools and branding. |
| `manage:org` | Change organization details, request-portal branding and single sign-on. |
| `manage:workspaces` | Create, rename and delete workspaces. |
| `manage:members` | Invite and remove members, change roles, manage groups and workspace access. |

## What stays in the UI

Anything that takes or mints a secret is read-only through the API: adding VCS connectors, runner tokens and personal API tokens. You can list connectors and runner pools so you can choose one. Single sign-on is partly here: domains, provisioning and setup links, but a person connects the identity provider in the WorkOS assistant.

## Conventions

**Pagination.** Lists return `{"count", "next", "previous", "results"}`. Use `page` and `page_size` (default 25, max 100).

**Success.** Writes return `{"success": true, ...}` with the changed object, `201` on create. Deletes return `204` or `{"success": true}`.

**Errors.**

| Status | Meaning | Body |
|---|---|---|
| `400` | Invalid input | `{"success": false, "errors": {"field": "message"}}` or `{"success": false, "error": "..."}` |
| `401` | Missing, revoked or expired token | `{"detail": "..."}` |
| `403` | Missing scope or permission | `{"detail": "..."}` or `{"success": false, "error": "..."}` |
| `404` | Doesn't exist, or you can't see it | `{"detail": "Not found."}` |
| `409` | Not allowed in the object's current state (e.g. workflow paused) | `{"success": false, "error": "...", "code": "..."}` |
| `429` | Rate limited | `{"detail": "..."}` |
| `502` | The VCS provider returned an error | `{"success": false, "error": "..."}` |

**Naming people and groups.** Where a body takes a `user`, pass a user id, username or email of a member of the organization. Where it takes a `group`, pass the group's id or name.

## Resources

- [Organization](organization.md): connectors, repositories, branches and tags, runner pools, portal branding
- [Administration](administration.md): organization details, members, invitations, workspaces, groups
- [Workflows](workflows.md): create (local or repo-backed), details, settings, schedule, status
- [Workflow access](workflow-access.md): approvers, roles, form visibility
- [Files and versions](files.md): files of Bentra-stored workflows, publishing and pinning versions
- [Variables](variables.md): variable collections and workflow variables
- [Requests](requests.md): submit, follow, comment, update, approve
- [Runs](runs.md): trigger jobs, follow runs, logs, re-run, cancel
- [Job datasets](datasets.md): versions, promote, freeze, data scope and read grants
- [Single sign-on](sso.md): status, allowed domains, member provisioning, setup links
