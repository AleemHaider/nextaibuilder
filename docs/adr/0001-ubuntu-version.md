# ADR-0001: Ubuntu 24.04 LTS for EC2 Deployment Target

**Date:** 2025-01-22  
**Status:** Accepted  
**Jira:** FIR-176  

## Context
FIR-80 originally specified Ubuntu 22.04 LTS. The BRD architecture section specifies Ubuntu 24.04 LTS.

## Decision
Use **Ubuntu 24.04 LTS (Noble Numbat)** as the deployment target for EC2, Docker base images, and GitHub Actions runners.

## Rationale
- Ubuntu 24.04 LTS has standard support until April 2029 (5 years)
- Node.js 20 LTS is fully supported via NodeSource on 24.04
- `ubuntu-24.04` is a stable GitHub Actions runner as of 2024
- Aligns with BRD specification

## Consequences
- Dockerfile base images use `ubuntu:24.04` (or `node:20-alpine` for smaller images)
- EC2 provisioning runbook (FIR-80) must use a 24.04 AMI in us-east-2
- GitHub Actions `runs-on: ubuntu-24.04`
