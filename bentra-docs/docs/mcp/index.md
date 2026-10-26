# Bentra MCP server

The Bentra MCP server lets an AI agent (Claude Code, Cursor, Claude Desktop, or your own) work in Bentra for you. You describe what you want ("create a job from `acme/infra` pinned to v1.2, run it nightly", "who still needs to approve my request?") and the agent calls Bentra on your behalf.

The agent acts **as you**: it can do exactly what you can do in Bentra, and your MCP client asks before it runs anything that changes something.

## Connect

=== "Hosted (recommended)"

    ```bash
    claude mcp add --transport http bentra https://mcp.bentra.io/mcp
    ```

    The first tool call opens your browser to sign in to Bentra and approve the agent. Each agent you approve is listed under **Settings → API Access → AI agent sessions**, where you can revoke it.

=== "Local, with a personal token"

    Generate a personal token in **Settings → API Access**, then:

    ```bash
    claude mcp add bentra \
      -e BENTRA_URL=https://app.bentra.io -e BENTRA_ORG=acme -e BENTRA_API_TOKEN=... \
      -- uvx --from git+https://github.com/bentrallc/bentra-mcp bentra-mcp
    ```

    Set `BENTRA_READ_ONLY=true` for an assistant that can only look.

If you belong to several organizations, tell the agent which one to use, or let it call `list_organizations`.

## What the agent can do

| Area | Tools | API reference |
|---|---|---|
| Find things | `list_organizations`, `list_workspaces`, `list_connectors`, `list_repositories`, `list_repository_refs`, `list_runner_pools` | [Organization](../reference/api/organization.md) |
| Workflows | `list_workflows`, `get_workflow`, `create_workflow`, `update_workflow`, `get_workflow_settings`, `update_workflow_settings`, `set_workflow_status`, `get_form`, `update_form` | [Workflows](../reference/api/workflows.md) |
| Access | `list_approvers`, `add_approver`, `update_approver`, `remove_approver`, `list_workflow_permissions`, `grant_workflow_role`, `change_workflow_role`, `revoke_workflow_role`, `get_form_visibility`, `share_form_with_workspace`, `unshare_form_with_workspace` | [Workflow access](../reference/api/workflow-access.md) |
| Files (Bentra-stored workflows) | `list_files`, `read_file`, `create_file`, `update_file`, `delete_file`, `list_versions`, `publish_version`, `activate_version` | [Files and versions](../reference/api/files.md) |
| Variables | `list_variable_collections`, `get_variable_collection`, `create_variable_collection`, `update_variable_collection`, `delete_variable_collection`, `add_collection_variable`, `update_collection_variable`, `delete_collection_variable`, `list_workflow_variables`, `add_workflow_variable`, `update_workflow_variable`, `delete_workflow_variable`, `attach_collection`, `detach_collection` | [Variables](../reference/api/variables.md) |
| Requests | `submit_request`, `get_form_options`, `list_requests`, `get_request`, `get_request_activity`, `list_request_comments`, `add_request_comment`, `update_request`, `cancel_request`, `approve_request`, `reject_request`, `request_changes` | [Requests](../reference/api/requests.md) |
| Runs | `trigger_run`, `list_runs`, `get_run`, `get_run_logs`, `rerun`, `cancel_run` | [Runs](../reference/api/runs.md) |
| Job datasets | `list_job_datasets`, `get_job_dataset`, `promote_dataset_version`, `freeze_dataset`, `get_data_sharing`, `update_data_sharing`, `grant_data_access`, `revoke_data_access`, `get_data_access` | [Job datasets](../reference/api/datasets.md) |
| Administration | `get_organization`, `update_organization`, `get_portal_branding`, `update_portal_branding`, `upload_portal_logo`, `remove_portal_logo`, `list_members`, `change_member_role`, `remove_member`, `list_invitations`, `invite_member`, `revoke_invitation`, `create_workspace`, `update_workspace`, `delete_workspace`, `list_workspace_members`, `add_workspace_member`, `change_workspace_member_role`, `remove_workspace_member`, `list_groups`, `get_group`, `create_group`, `update_group`, `delete_group`, `add_group_member`, `remove_group_member`, `add_group_owner`, `remove_group_owner`, `grant_group_workspace_access`, `revoke_group_workspace_access` | [Administration](../reference/api/administration.md), [Organization](../reference/api/organization.md#request-portal-branding) |
| Single sign-on | `get_sso`, `update_sso`, `add_sso_domain`, `verify_sso_domain`, `remove_sso_domain`, `get_sso_setup_link` | [Single sign-on](../reference/api/sso.md) |

The server also gives the agent:

- `bentra://schemas/form`: the exact schema `form.yml` must satisfy.
- Guides the agent reads before a task: `bentra://guides/create-workflow`, `bentra://guides/requests`, `bentra://guides/set-up-portal`, `bentra://guides/administration`.
- Prompts `set_up_workflow` and `create_request_workflow`, which walk the agent through gathering your requirements and confirming each step.

## Example: a repo-backed request workflow

> Create a request workflow called "Create bucket" in the Platform workspace from `acme/infra`, pinned to tag v1.2.0. Two approvals from the Platform group, listed in the request portal under Storage.

The agent:

1. `list_workspaces` → `platform`; `list_connectors` → the GitHub connector; `list_repository_refs` confirms `v1.2.0` exists.
2. `create_workflow(workspace="platform", name="Create bucket", workflow_type="request", repository="acme/infra", connector_id=…, tag="v1.2.0")`.
3. `update_workflow_settings(require_approvers=true, required_approvals=2, portal_enabled=true)`.
4. `add_approver(group="Platform")`.
5. `get_workflow` and `list_approvers` to check, then summarizes.

## What stays in the UI

These take or mint secrets, so the agent can't do them. It points you to the right page instead:

- adding, changing or removing VCS connectors (**Settings → Connectors**)
- runner pools and runner tokens (**Settings → Runners**)
- personal API tokens (**Settings → API Access**)
- connecting an identity provider for SSO: the agent can manage allowed domains and provisioning and give you a setup link (`get_sso_setup_link`), but you complete setup in the WorkOS assistant
- secret variable values: the agent can set them if you give them, but should ask you to enter them in Bentra instead
