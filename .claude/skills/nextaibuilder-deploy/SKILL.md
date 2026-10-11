---
name: nextaibuilder-deploy
description: Operational map of nextaibuilder.com's production infrastructure — the EC2 server, its two PM2 processes, nginx layout, and the deploy workflow that actually works on this box. Load this BEFORE any SSH access, deployment, production debugging, DNS/cert work, or infrastructure question about this project — including requests to "deploy", "push this to production", "check the server", "restart the API", "update sdk.nextaibuilder.com", "is the site down", or anything that touches nextaibuilder.com or sdk.nextaibuilder.com in a running/live sense (not just editing code locally). Use it even if the user doesn't say "infrastructure" or "server" explicitly — e.g. "ship this," "why is checkout broken," "add a subdomain."
---

# nextaibuilder production deploy

This project's production topology has several non-obvious traps — the main
one being that **the code in this repo's `apps/web` is not what's currently
serving nextaibuilder.com**. Read this whole file before touching the server;
skipping straight to SSH commands is exactly how the topology gets
misread and something gets deployed to the wrong place.

## The one fact that changes everything else

`nextaibuilder.com`'s main site is currently served by an **old Vite SPA**
(static files + nginx), a different and older app than this repo's
`apps/web` (Next.js). This repo's `apps/web` has **zero commits in git** —
it's fully untracked, locally-only work — and has only ever been deployed
as the isolated `sdk.nextaibuilder.com` subdomain app, never as the main
site. Don't assume "deploy the web app" means the main site; ask which
target is meant if it's ambiguous.

## Server access

Production box: `ubuntu@<EC2 IP>` on AWS EC2 (us-east-2). Get the exact IP
and SSH key from:
1. **Claude's memory first** (`prod-server-access` or similar) — if this
   session has prior context on this project, the key path is probably
   already recorded there. Memory is machine-local and not part of this
   git repo (deliberately — the key itself must never be committed).
2. If memory has nothing (new machine, fresh clone) — **ask the user**
   for the SSH key and confirm the host. Don't guess a path or invent one.
   Once given, it's worth saving to memory so the next session on that
   machine doesn't have to ask again.

There is no staging environment. Every deploy is directly to production —
treat every server change as live-traffic-affecting, verify after every step.

## What's actually running

Two PM2 processes on the box (`pm2 list` to check), both under a
`pm2-ubuntu` systemd service (already enabled — `pm2 save` after any
process change so it survives a reboot):

| Process | Port | Code location on server | What it is |
|---|---|---|---|
| `nextaibuilder-api` | 4001 | `~/nextaibuilder/apps/api` | The real, live Fastify API. Backs **both** nextaibuilder.com and sdk.nextaibuilder.com. |
| `nextaibuilder-web-sdk` | 3001 | `~/nextaibuilder-web-sdk` (standalone, **not** inside `~/nextaibuilder`) | This repo's Next.js `apps/web`, serving only the `sdk.nextaibuilder.com` subdomain. |

`~/nextaibuilder` on the server is an npm-workspaces monorepo
(`workspaces: ["apps/api", "apps/web"]` in the root `package.json`) but its
git repo has **zero commits** — files get there via `rsync`, not
`git pull`. `~/nextaibuilder-web-sdk` is a separate, non-workspace
directory with its own `package.json`/`node_modules` — it's a standalone
deploy of just the Next.js app, unrelated to the monorepo structure.

nginx (bare-metal, not Docker) has two site configs:
- `/etc/nginx/sites-enabled/nextaibuilder` — main site: static Vite `dist`
  + proxies `/api/*` to `127.0.0.1:4001`.
- `/etc/nginx/sites-enabled/sdk-nextaibuilder` — sdk subdomain: proxies
  `/` to `127.0.0.1:3001`, and `/api/*` + `/socket.io/*` to
  `127.0.0.1:4001` (same API backend as the main site).

TLS via Let's Encrypt/certbot. The main cert covers `nextaibuilder.com` +
`www`; `sdk.nextaibuilder.com` has its **own separate cert**
(`sudo certbot --nginx -d sdk.nextaibuilder.com` — needs DNS pointed at
the box first, since it's an HTTP-01 challenge).

Data: MongoDB Atlas (cluster `aiproductbuilder.ad2ohp8.mongodb.net`, db
`nextaibuilder`); Redis local on the box, port 6379.

DNS is on **GoDaddy** (`ns43/44.domaincontrol.com`), not Route53 — don't
assume DNS changes can be scripted via AWS CLI even if AWS credentials are
present locally; they're unrelated to this domain. DNS changes need the
user to do them at the registrar.

## The GitHub Actions pipeline isn't live

`.github/workflows/deploy.yml` describes a Docker-compose + GHCR deploy
pipeline, but check `gh secret list` before assuming it works — as of this
writing it has **zero repository secrets configured**
(`EC2_HOST`/`EC2_USER`/`EC2_SSH_KEY`/`GHCR_TOKEN` all missing), so it has
never actually run successfully. Don't treat a push to `production` as a
real deploy until those secrets exist. There may also be stale Docker
containers on the box left over from an earlier `pba-*`-prefixed compose
setup — if you see containers nginx doesn't route to, they're leftovers,
not the current serving path; confirm with the user before removing
anything.

## Deploy workflow that actually works

The server runs an older Node/npm than a typical dev machine
(historically Node 20 / npm 10) — **`npm ci` reliably fails here on lockfile
version-skew errors even when the lockfile is valid.** Use `npm install`
on the server instead.

**Deploying `apps/api` changes:**
1. `rsync` the changed source from local to `~/nextaibuilder/apps/api` on
   the server (exclude `node_modules`, `dist`, `.env`).
2. Also `rsync` the **root** `package.json` + `package-lock.json` — npm
   workspaces hoist dependencies to the root `node_modules`, so a
   dependency change in `apps/api` needs the root lockfile in sync too.
3. `npm install` at the **repo root** on the server (not inside
   `apps/api`), then `npm run build --workspace=apps/api`.
4. `pm2 restart nextaibuilder-api --update-env`.

**Deploying the sdk Next.js app:**
1. `rsync` the changed source into `~/nextaibuilder-web-sdk` (exclude
   `node_modules`, `.next`, `.env*`).
2. `npm install` inside that directory (it's standalone, no workspace
   root to worry about).
3. `npm run build`.
4. `pm2 restart nextaibuilder-web-sdk`.

**After any process change:** `pm2 save`, then verify with `curl` against
both `https://nextaibuilder.com` and `https://sdk.nextaibuilder.com` (plus
whatever endpoint the actual change touched). There's no staging
environment to catch a mistake before this — the verification step is the
safety net, don't skip it.

## Before deploying `apps/api`: check what you're actually shipping

Run `git diff --stat` locally before rsyncing `apps/api` to the server.
This monorepo has had long stretches of unrelated, uncommitted work
sitting in the working tree at the same time as a specific feature being
shipped. Deploying the *whole* working tree once took production down for
several minutes: an unrelated pending change added a boot-time env
validation guard, and a pre-existing (unrelated) misconfigured production
env var meant the guard threw and crashed the entire process on startup —
not just the feature the validation was meant to protect.

The lesson isn't "never add startup validation" — it's: **if
`git diff --stat` shows changes beyond the current task, don't assume
they're safe to ship alongside it.** Either isolate and deploy only the
files the current task actually touches (hand-patch them onto the last
known-good server state if needed), or explicitly confirm with the user
that the rest of the pending diff is meant to go out too.

**Always back up before overwriting** — e.g.
`cp -r apps/api apps/api.bak.$(date +%s)`, placed **outside** the
`apps/` directory (a backup left inside `apps/` once broke
`npm install`/`npm ci` with a "duplicate workspace name" error, since npm
workspaces glob-matches everything under `apps/`).

## Brand assets

The `sdk.nextaibuilder.com` page carries the **nextaibuilder** site-level
brand identity (a spark/pixel-diamond mark + "aibuilder" wordmark) —
distinct from the "Product Builder Academy" brand used for the internal
app/course product elsewhere in this codebase (see the root `CLAUDE.md`
for that one). The nextaibuilder brand kit (colors, logo SVGs, a `BRAND.md`
with the palette) is **not part of this git repo** — it may exist
somewhere on the user's machine as a local folder of design assets. If you
need it and can't find it, ask the user rather than inventing brand colors
from scratch.
