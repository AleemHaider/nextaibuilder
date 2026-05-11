# Security Policy

## Supported versions

Only the `main` branch is supported. Older tags are not maintained.

## Reporting a vulnerability

Email **security@nextaibuilder.com** with:

- A description of the issue and its impact
- Reproduction steps (or a minimal proof-of-concept)
- The commit SHA you tested against

We aim to:

- Acknowledge within **2 business days**
- Provide an initial assessment within **5 business days**
- Ship a fix or mitigation within **30 days** for high/critical issues

Please do not file public GitHub issues for security reports. Coordinated disclosure is appreciated.

## Secret handling

`apps/api/.env` is **never** committed. The repo's root `.gitignore` excludes `.env` and `.env.local`. Before pushing, verify with:

```bash
git ls-files | grep -E '\.env($|\.local$)'   # must return nothing
```

If a secret is ever committed:

1. Rotate the credential **first** (see runbook below) — the leaked value must be invalidated before scrubbing.
2. Then scrub history with `git filter-repo` or BFG and force-push to the protected branch.
3. Notify any teammates who may have pulled the affected commit.

`apps/api/.env.example` is the canonical schema; keep keys in sync with code but never put real values there.

## Rotation runbook

Run all rotations from the principle of **rotate provider-side first, then update `.env`, then restart**. Order matters — if you update the env first the running process will fail closed.

### `JWT_SECRET` / `JWT_REFRESH_SECRET` / `COOKIE_SECRET`

1. Generate replacements: `openssl rand -hex 64` (one per secret).
2. Update `apps/api/.env` on every host (dev box, EC2).
3. `pm2 reload` / `docker compose up -d` the API. **All existing sessions become invalid** — users sign back in.
4. Optional: stagger by keeping `JWT_SECRET_PREVIOUS` for 24h and verifying tokens against either, then dropping the old.

### `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY`

1. Stripe Dashboard → Developers → API keys → Roll the secret key. Note the new key starts with `sk_live_` (prod) or `sk_test_` (dev).
2. The publishable key (`pk_*`) is **not** secret but rolls alongside if compromised.
3. Update `STRIPE_SECRET_KEY` in `.env` and the frontend env (`VITE_STRIPE_PUBLISHABLE_KEY`).
4. Stripe revokes the old key immediately on roll — schedule for off-peak.

### `STRIPE_WEBHOOK_SECRET`

1. Stripe Dashboard → Developers → Webhooks → endpoint → Reveal/Roll secret.
2. Update `.env` and redeploy **before** the roll's grace window ends or webhook events 400.
3. Use separate endpoints for `_TEST` vs `_LIVE`; never reuse a webhook secret across environments.

### `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`

Static keys are a long-term liability — plan to migrate to an EC2 instance profile (see `infra/iam-migration.md`, todo). In the meantime:

1. AWS IAM Console → Users → the deploy user → Security credentials → Create new access key.
2. Update `.env` on every host.
3. Restart API. Verify S3 uploads work.
4. Delete the old access key from IAM (do not just deactivate — deletion is the only revocation).

### `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

1. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Reset client secret.
2. Update `.env`. Redeploy.
3. The client ID is not secret; only roll if both have leaked.

### `APPLE_PRIVATE_KEY` / `APPLE_KEY_ID`

Apple's signing key is the most painful rotation — plan ahead.

1. Apple Developer → Certificates, Identifiers & Profiles → Keys → Generate new key with **Sign in with Apple** enabled. Save the `.p8` file and its **Key ID**.
2. Update `APPLE_PRIVATE_KEY` (entire `.p8` contents, including BEGIN/END lines, newlines preserved) and `APPLE_KEY_ID` in `.env`.
3. Redeploy. Apple's old key remains valid for ~6 months, so the cutover is non-breaking.
4. Revoke the old key in the developer portal once traffic confirms the new one works.

### `SMTP_PASS`, `SLACK_BOT_TOKEN`, `ANTHROPIC_API_KEY`

Rotate in the respective provider dashboard, update `.env`, redeploy. No grace window — they hard-cut.

## Pre-commit guard (recommended)

Until a `gitleaks` / `trufflehog` hook is wired, run this manually before any commit that touches `apps/api/`:

```bash
git diff --cached --name-only | xargs grep -lE '(sk_live_|sk_test_|AKIA[0-9A-Z]{16}|-----BEGIN PRIVATE KEY-----)' 2>/dev/null
```

If anything prints, abort and scrub the staged content.

## Production environment

- `.env` on EC2 lives at `/opt/nab/.env`. Permissions must be `chmod 600 root:root`.
- Secrets are **not** passed to Docker via `docker-compose.yml` literals; they come from the host `.env` via `env_file:` references.
- Frontend `VITE_*` variables are baked into the bundle at build time — anything in a `VITE_` var is public. Never put a server-side secret there.

## Backups

Production MongoDB is dumped to S3 nightly at 03:00 UTC via the `nab-backup.timer` systemd unit. The dump script + restore script + S3 lifecycle policy live in `infra/BACKUP-RUNBOOK.md` — install instructions in § 2, restore drill in § 4. **Run a restore drill against a sandbox cluster on the first of every month** — a backup that has never been restored is theoretical.
