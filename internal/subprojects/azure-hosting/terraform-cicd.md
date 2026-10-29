# Terraform & CI/CD

## Description

Build the infrastructure-as-code and deployment pipeline for the Bentra Azure control plane.

## Goals

- Write Terraform modules for all Azure resources (Container Apps, PostgreSQL, Blob Storage, ACR, etc.)
- Define state backend (Azure Storage)
- Build CI/CD pipeline for deploying infrastructure changes
- Build CI/CD pipeline for deploying application containers
- Handle secrets/env var injection at deploy time

## Todos

- [ ] Choose Terraform state backend (Azure Storage account)
- [ ] Write Terraform module for Container Apps Environment
- [ ] Write Terraform modules for supporting services (PostgreSQL, Blob Storage, ACR)
- [ ] Write Terraform for OpenBao container app
- [ ] Write Terraform for Django, log consumer, VCS consumer container apps
- [ ] Define CI/CD pipeline for infra changes (plan → apply gated on PR merge)
- [ ] Define CI/CD pipeline for app container builds and deploys
- [ ] Handle secrets injection (Key Vault references or env vars at deploy time)
