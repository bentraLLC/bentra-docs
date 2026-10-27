# Network requirements

Runners only make outbound connections.

| From | To | Port | Why |
|---|---|---|---|
| Runner | your Bentra host (for example `app.bentralabs.com`) | 443 (HTTPS) | Poll for jobs, report steps and logs, fetch the job's secrets |
| Runner | your Git provider (GitHub, GitLab, ...) | 443 | Clone the workflow's repository with a short-lived token Bentra issues for that job |
| Runner | whatever your workflow steps call | as needed | Your own cloud APIs, package registries and so on |

Nothing needs to reach the runner: no inbound ports, no public IP, no VPN.

## How a job flows

1. The runner long-polls `GET /api/v1/runner/jobs/next/` with its `rnr_` token, and waits up to 30 seconds for a job.
2. When it gets one, it fetches that job's variables and secrets. Secrets are served only to the runner holding the running job, and never appear in the job payload.
3. It runs the steps and streams their status and logs back.
4. It reports the result.

## Proxies and firewalls

- Allow outbound HTTPS to the Bentra host.
- If outbound traffic goes through an HTTP proxy, set `HTTPS_PROXY` for the runner process, or `env` in the Helm values.
- Runners don't need a fixed IP of their own. To allow-list Bentra's own outbound address on your Git server, ask us for it.

## Rate limits

Each runner token has its own request budget, generous enough for log streaming. A runner that sends too many failed token attempts from one address is locked out for a few minutes.
