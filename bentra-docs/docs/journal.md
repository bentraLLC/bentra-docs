# Journal

Dated entries from Bentra's top-level log. Most recent first.

## 2026-04-23 — RabbitMQ → REST migration completed

Shipped all control-plane code in `bento/runners/` with 49 Django TestCase tests. Fixed a Postgres-specific bug in `NextJobView` (`select_for_update` across nullable joins) via `of=("self",)`. Cleaned up residual `pika` references and the `CHAT.md` scratch file.

Azure Hosting Spike is now unblocked — runners connect outbound over HTTPS:443 only, and RabbitMQ is no longer a hosted control-plane component.

See [RabbitMQ → REST Migration](subprojects/rabbitmq-rest-migration.md).

## 2026-04-15 — Hosting decision: Azure Container Apps

Decided on Azure Container Apps (Consumption Plan) for control plane hosting. ~$40–55/month target.

Key unknowns to validate: AMQPS TCP ingress for client runners, RabbitMQ persistence on Azure Files, long-running consumer container stability. (The RabbitMQ-related items became moot once the REST migration landed on 2026-04-23.)

See [Hosting Architecture](architecture/hosting.md).

## 2026-04-15 — Azure hosting strategy

Working on how to host Bentra in Azure as cheaply as possible. Two open design questions:

1. **Control plane** — what Bentra owns and operates centrally
2. **Customer brings** — what resources/infra the customer provides on their side
