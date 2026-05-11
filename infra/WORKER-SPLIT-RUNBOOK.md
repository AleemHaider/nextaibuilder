# Worker Split — Horizontal-Scale Runbook

Until this change, the API process did **two** jobs at once: serve HTTP requests and run six BullMQ workers + a cron. Both halves shared the same Node event loop, so:

- You could not run a second `api` instance behind a load balancer — every Stripe webhook would be processed by **both** workers, sometimes creating duplicate refunds / enrollments.
- A slow Anthropic Vision call (P95 ~5–10s) competed with HTTP request capacity.
- A worker hotfix required restarting all API replicas.

The fix is a `ROLE` env switch + a separate `worker.ts` entrypoint. The default `ROLE=all` preserves the existing single-process deployment — **nothing changes** until you choose to split.

## Current default — ROLE=all (single process)

```bash
# apps/api/.env or process env
ROLE=all   # or unset
```

`src/index.ts` boots Fastify HTTP + all six workers in one process. This is what `docker compose up` currently does. **No action needed** to stay on this path.

## Split mode — ROLE=api + ROLE=worker

When you're ready to horizontally scale:

```bash
# Process A (one or more replicas behind load balancer)
ROLE=api  npm start
# → Fastify HTTP only. No workers. Safe to scale to N replicas.

# Process B (exactly one — single worker process)
ROLE=worker  npm run start:worker
# → BullMQ workers + cron. NO HTTP listener.
```

The Socket.io Redis adapter (added alongside this change) means events emitted from process B (e.g. `submission:updated` from the ML worker) reach clients connected to process A — the adapter publishes to Redis and every Socket.io server with the adapter attached delivers to its locally-connected clients.

Presence (online/offline students) is now backed by a Redis SET (`presence:students`) instead of an in-memory `Set`, so admins on any `api` replica see the full set of online students.

## docker-compose example

Add a second service to `docker-compose.yml`:

```yaml
services:
  api:
    image: ${IMAGE_BASE}/nextaibuilder-api:${IMAGE_TAG:-latest}
    environment:
      ROLE: api
      # ... rest of env
    deploy:
      replicas: 2          # safe to scale; workers run elsewhere

  worker:
    image: ${IMAGE_BASE}/nextaibuilder-api:${IMAGE_TAG:-latest}
    command: node dist/worker.js
    environment:
      ROLE: worker
      # ... same env as api (Mongo, Redis, Stripe, Slack, etc.)
    deploy:
      replicas: 1          # exactly one — BullMQ handles concurrency inside
```

The worker image is the same Docker image as the API — only the start command + `ROLE` env differs.

## Why `worker.replicas: 1`?

BullMQ handles intra-process concurrency via the `concurrency` option on each Worker. Running multiple worker container replicas would have each replica pull jobs from the same queue independently — fine for stateless jobs, but the Stripe webhook worker already mitigates duplicate processing via the `ProcessedStripeEvent` idempotency table, so multiple replicas would just race on the same row.

If you ever need more worker throughput, bump `ML_WORKER_CONCURRENCY` (or the per-worker concurrency option) inside the single container before adding replicas.

## What to verify after switching

1. **Webhook delivery to a 2-instance `api` deployment is not duplicated.** Tail `ProcessedStripeEvent` after a test charge — exactly one row with `outcome=SUCCESS`.
2. **Admin presence panel** shows online students from BOTH `api` instances. Open two browser sessions against the load balancer (sticky off) — both should appear in the admin `presence:snapshot`.
3. **`/health` on every `api` replica returns 200**; the `worker` container is not exposed (it has no HTTP listener).
4. **Worker logs** in the `worker` container; **request logs** in the `api` containers. No worker startup messages should appear in `api` logs.

## Rollback

Set `ROLE=all` on the `api` service, stop the `worker` service. Single-process mode resumes immediately — no data migration needed (everything is in Redis/Mongo, no in-memory state).
