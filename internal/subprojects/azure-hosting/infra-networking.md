# Infra & Networking

## Description

Design and document the Azure infrastructure topology and network architecture for the Bentra control plane.

## Goals

- Define resource group and subscription layout
- Design Container Apps Environment networking (VNet integration, ingress rules)
- Document connectivity model between control plane and customer-hosted runners
- Decide on DNS strategy for public endpoints
- Define firewall / NSG rules

## Todos

- [ ] Define resource group and subscription layout
- [ ] Design Container Apps Environment networking (VNet integration, ingress)
- [ ] Document runner-to-control-plane connectivity model (outbound only, port 443)
- [ ] Decide DNS strategy for public endpoints (Django, OpenBao)
- [ ] Define NSG / firewall rules
