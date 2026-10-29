# Connectors

A connector gives Bentra access to the Git provider that holds your workflows. Only **GitHub** is supported today. Add connectors under **Settings → Connectors**, and click one to see its details, rotate its credentials, test it and change where it's available.

## Who can use a connector

A connector is available either to **every workspace** in the organization or to **selected workspaces**. A workflow can use any connector available to its workspace.

| | Owners and admins | Members |
|---|---|---|
| Add a connector | For every workspace, or any workspaces | For workspaces they belong to, except the default workspace |
| Change, rotate, re-share or delete it | Any connector | Connectors they added |

Members can't add connectors to the default workspace, so it doesn't fill up with personal connectors. Ask an admin, or use another workspace.

You can't take a connector away from a workspace, or delete it, while workflows still use it. The connector page lists them under **Used by**; switch them to another connector first. If the person who added a connector leaves the organization, it keeps working and the page shows a warning so someone can replace its credentials.

Bentra uses a connector to:

- list repositories and branches/tags when you create a workflow
- read `.bento/workflow/workflow.yml`, `.bento/form/form.yml` and the README
- hand a token to a runner so it can clone the repository; a runner only gets it for a run its pool is executing
- commit form edits made in Bentra to a branch and open a pull request

## GitHub App (recommended)

Install the app on the repositories your workflows use, not on the whole organization. Bentra and its runners only ever use installation tokens, which expire after an hour.

| Permission | Access | Why |
|---|---|---|
| Metadata | Read | Required by GitHub for every app |
| Contents | Read and write | Read workflow and form files; clone for runs. Write only commits form edits to a branch |
| Pull requests | Read and write | Open a pull request for a form edit |

If you don't edit forms from Bentra, **Contents: Read** and no pull request access are enough.

## Personal access token

Use a **fine-grained** token limited to the same repositories, with the permissions in the table above. A classic token with `repo` scope works but grants access to every repository the user can see. The token acts as its owner, so prefer a dedicated machine user. Runners receive the token itself to clone, which is another reason to prefer the GitHub App.

## Storage

Connector credentials are encrypted with your organization's own data key before they are stored.
