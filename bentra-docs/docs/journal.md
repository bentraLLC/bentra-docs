# Journal

Dated entries from Bentra's top-level log. Most recent first.

## 2026-04-23 — REST runner API completed

Shipped all control-plane code in `bento/runners/` with 49 Django TestCase tests. Fixed a Postgres-specific bug in `NextJobView` (`select_for_update` across nullable joins) via `of=("self",)`. Removed the `CHAT.md` scratch file.

Azure Hosting Spike is now unblocked — runners connect outbound over HTTPS:443 only.

See [Runners](architecture/runners.md).

## 2026-04-15 — Hosting decision: Azure Container Apps

Decided on Azure Container Apps (Consumption Plan) for control plane hosting. ~$40–55/month target.

Key unknowns to validate: cold start time, Container Apps scaling, and static file serving.

See [Hosting Architecture](architecture/hosting.md).

## 2026-04-15 — Azure hosting strategy

Working on how to host Bentra in Azure as cheaply as possible. Two open design questions:

1. **Control plane** — what Bentra owns and operates centrally
2. **Customer brings** — what resources/infra the customer provides on their side
