---
# ADR-001: Choose Ubuntu 24.04 LTS over 22.04 LTS

**Status:** Accepted
**Date:** 2026-04-12
**Jira:** FIR-176

## Context

FIR-80 originally specified Ubuntu 22.04 LTS as the EC2 deployment target. The BRD architecture section specifies Ubuntu 24.04 LTS (Noble Numbat). A conflict existed between the story spec and the BRD — this ADR formally resolves it.

## Decision

Use **Ubuntu 24.04 LTS** (Noble Numbat) as the deployment target for all EC2 instances, Docker base images, and GitHub Actions runners.

## Rationale

- LTS support until April 2029 (vs April 2027 for 22.04) — aligns with the product's 3-year growth horizon
- Standard security maintenance window covers the planned product lifecycle without a mid-cycle OS upgrade
- Node.js 20 LTS is fully supported on 24.04 via the NodeSource setup script
- `ubuntu-24.04` is a stable GitHub Actions hosted runner as of 2024 (already in use in `.github/workflows/ci-cd.yml`)

## Consequences

- All Dockerfiles use `ubuntu:24.04` as base (or `node:20-alpine` for minimal images)
- EC2 provisioning scripts (`infra/ec2-setup.sh`) target a 24.04 AMI in the deployment region
- GitHub Actions `runs-on: ubuntu-24.04` (already enforced in existing workflows)
- Previous `docs/adr/0001-ubuntu-version.md` captures an earlier draft of this decision — this file is the canonical ADR going forward
