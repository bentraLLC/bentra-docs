# Logging

## Description

Design and implement the logging strategy for the Bentra Azure control plane.

## Goals

- Decide log aggregation approach (Azure Monitor / Log Analytics vs. third-party)
- Capture structured logs from Django, consumers, and OpenBao
- Ensure workflow execution logs (previously streamed via RabbitMQ consumer) are captured in the new REST-based architecture
- Define log retention policy
- Make logs queryable for debugging

## Todos

- [ ] Decide log aggregation tool (Azure Log Analytics vs. third-party e.g. Grafana Loki)
- [ ] Configure Container Apps to emit structured logs to chosen backend
- [ ] Define log retention policy (cost vs. debuggability tradeoff)
- [ ] Verify workflow execution logs flow correctly in new architecture (no RabbitMQ log consumer)
- [ ] Make logs queryable — define key queries for debugging common issues
