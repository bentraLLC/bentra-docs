# Monitoring

## Description

Design and implement observability and alerting for the Bentra Azure control plane.

## Goals

- Define key health metrics (Django uptime, consumer liveness, DB connections, job queue depth)
- Set up uptime checks for public endpoints
- Configure alerts for critical failures (container crashes, DB unreachable, etc.)
- Decide on monitoring tooling (Azure Monitor, Grafana, etc.)
- Define on-call / alerting policy

## Todos

- [ ] Identify key health metrics (Django uptime, consumer liveness, DB connections, queue depth)
- [ ] Set up uptime / availability checks for public endpoints (Django, OpenBao)
- [ ] Configure alerts for container crashes and restarts
- [ ] Configure alerts for DB unreachable / connection pool exhaustion
- [ ] Decide monitoring tooling (Azure Monitor vs. Grafana Cloud vs. other)
- [ ] Define alerting policy — who gets paged and when
