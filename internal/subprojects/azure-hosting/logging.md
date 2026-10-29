# Logging

## Description

Design and implement the logging strategy for the Bentra Azure control plane.

## Goals

- Decide log aggregation approach (Azure Monitor / Log Analytics vs. third-party)
- Capture structured logs from Django, consumers, and OpenBao
- Ensure workflow execution logs posted through the REST runner API are captured
- Define log retention policy
- Make logs queryable for debugging

## Todos

- [ ] Decide log aggregation tool (Azure Log Analytics vs. third-party e.g. Grafana Loki)
- [ ] Configure Container Apps to emit structured logs to chosen backend
- [ ] Define log retention policy (cost vs. debuggability tradeoff)
- [ ] Verify workflow execution logs flow correctly through the REST runner API
- [ ] Make logs queryable — define key queries for debugging common issues
