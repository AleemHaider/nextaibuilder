# PBA Deployment Runbook

**Environment:** DEV
**Last updated:** 2026-03-12

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [First-Time Server Setup](#2-first-time-server-setup)
3. [GitHub Actions Secrets Setup](#3-github-actions-secrets-setup)
4. [Routine Deployment (Automated)](#4-routine-deployment-automated)
5. [Manual Deployment](#5-manual-deployment)
6. [Environment Variables — Updating Secrets](#6-environment-variables--updating-secrets)
7. [Monitoring and Logs](#7-monitoring-and-logs)
8. [Rollback Procedure](#8-rollback-procedure)
9. [Health Check](#9-health-check)
10. [SSL / HTTPS Setup (Future)](#10-ssl--https-setup-future)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Architecture Overview

```
Internet
   │
   ▼
nginx (port 83)
   ├── /api/*  →  reverse proxy  →  Fastify API (port 4000)
   └── /*      →  static files  →  /var/www/pba/
                                         (React SPA)

Fastify API (pm2 process: pba-api)
   ├── MongoDB Atlas (remote)
   ├── Redis (localhost:6379, BullMQ workers)
   └── Socket.IO (shared HTTP port 4000)
```

| Component | Value |
|-----------|-------|
| EC2 host (DEV) | `ec2-98-80-75-197.compute-1.amazonaws.com` |
| nginx listen port | `83` |
| Fastify API port | `4000` |
| Frontend static root | `/var/www/pba/` |
| API install root | `/opt/pba/api/` |
| pm2 process name | `pba-api` |
| API entry point | `/opt/pba/api/dist/index.js` |

**CI/CD trigger:** push to `main` branch runs the GitHub Actions pipeline defined in `.github/workflows/ci-cd.yml`. Pull requests against `main` run CI (lint, type-check, build) only — no deployment.

---

## 2. First-Time Server Setup

Perform these steps once on a fresh Ubuntu EC2 instance. SSH in first:

```bash
ssh -i "dev-pba.pem" ubuntu@ec2-98-80-75-197.compute-1.amazonaws.com
```

### 2.1 Install Node.js 20 via nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
node -v   # should print v20.x.x
```

### 2.2 Install pm2

```bash
npm install -g pm2
pm2 -v
```

### 2.3 Install nginx

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2.4 Install Redis

Redis is required for BullMQ (screenshot validation worker and scheduled email worker).

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping   # should return PONG
```

### 2.5 Create directory structure

```bash
sudo mkdir -p /var/www/pba
sudo mkdir -p /opt/pba/api/dist

# Give the ubuntu user ownership so rsync and pm2 can write without sudo
sudo chown -R ubuntu:ubuntu /var/www/pba
sudo chown -R ubuntu:ubuntu /opt/pba
```

### 2.6 Configure nginx

Create the site configuration:

```bash
sudo nano /etc/nginx/sites-available/pba
```

Paste the following complete configuration:

```nginx
server {
    listen 83;
    server_name ec2-98-80-75-197.compute-1.amazonaws.com;

    # ── Frontend (React SPA) ────────────────────────────────────────
    root /var/www/pba;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # ── API reverse proxy ───────────────────────────────────────────
    location /api/ {
        proxy_pass         http://localhost:4000;
        proxy_http_version 1.1;

        # WebSocket / Socket.IO support
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # ── Gzip ────────────────────────────────────────────────────────
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1024;
}
```

Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/pba /etc/nginx/sites-enabled/pba
sudo nginx -t          # verify config syntax
sudo systemctl reload nginx
```

### 2.7 Create the API .env file

```bash
nano /opt/pba/api/.env
```

Populate it with all required variables (reference `apps/api/.env.example`):

```dotenv
# Server
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
LOG_LEVEL=info

# Frontend URL (for CORS)
FRONTEND_URL=http://ec2-98-80-75-197.compute-1.amazonaws.com:83

# Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/pba_prod?retryWrites=true&w=majority

# JWT — must be a strong 64-char random hex string in production
JWT_SECRET=<64-char-random-hex>
COOKIE_SECRET=<64-char-random-hex>

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379

# AWS S3 (screenshot uploads)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-west-2
S3_BUCKET_NAME=pba-screenshots

# OAuth — Google
GOOGLE_CLIENT_ID=

# OAuth — Apple
APPLE_CLIENT_ID=

# Anthropic (Claude Vision)
ANTHROPIC_API_KEY=
ML_CONFIDENCE_THRESHOLD=80
ML_WORKER_CONCURRENCY=3

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@productbuilderacademy.com

# Support / scheduling
SUPPORT_SCHEDULING_URL=https://calendly.com/your-link
```

> **Warning:** `JWT_SECRET` and `COOKIE_SECRET` must be set to strong values in production. The API server will refuse to start if either is missing or still set to the placeholder string `change-me-in-production`.

To generate a secure 64-character hex string:

```bash
openssl rand -hex 32
```

### 2.8 Start the API with pm2

Before running this step, ensure you have deployed the built `dist/` directory to `/opt/pba/api/dist/` and run `npm ci --omit=dev` in `/opt/pba/api/`.

```bash
cd /opt/pba/api
pm2 start dist/index.js \
  --name pba-api \
  --interpreter node \
  --env NODE_ENV=production
```

Verify it started:

```bash
pm2 status
pm2 logs pba-api --lines 20
```

### 2.9 Persist pm2 across reboots

```bash
pm2 save
pm2 startup
```

`pm2 startup` will print a command to run with `sudo`. Copy and execute that command exactly as printed. It registers a systemd unit so pm2 (and all saved processes) restart automatically after an EC2 reboot.

---

## 3. GitHub Actions Secrets Setup

Navigate to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

Configure every secret listed below. Missing secrets will cause the deploy job to fail.

| Secret name | Value | Notes |
|-------------|-------|-------|
| `EC2_SSH_KEY` | Full contents of `dev-pba.pem` | Include `-----BEGIN RSA PRIVATE KEY-----` header/footer |
| `EC2_HOST` | `ec2-98-80-75-197.compute-1.amazonaws.com` | Public hostname of the DEV instance |
| `EC2_USER` | `ubuntu` | Default user for Ubuntu AMIs |
| `VITE_API_URL` | e.g. `http://ec2-98-80-75-197.compute-1.amazonaws.com:83` | Baked into the frontend build at compile time — no trailing slash |
| `VITE_GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud Console | Must match `GOOGLE_CLIENT_ID` in the API `.env` |
| `VITE_APPLE_CLIENT_ID` | Services ID from Apple Developer portal | Must match `APPLE_CLIENT_ID` in the API `.env` |

> **Note:** Secrets are scoped to the `dev` GitHub Actions environment (see `environment: dev` in the deploy job). Ensure the secrets are added to that environment, not only to the repository level, or add them at both levels.

---

## 4. Routine Deployment (Automated)

### Trigger

Any push to the `main` branch automatically starts the CI/CD pipeline. Pull requests against `main` run CI only — the deploy job does not execute on PRs.

### Pipeline jobs

The pipeline runs three jobs in order:

```
ci-frontend ──┐
              ├──▶ deploy
ci-api ───────┘
```

**Job 1 — Frontend CI** (`pba-app/`)
1. Install dependencies: `npm ci`
2. Lint: `npm run lint`
3. Type-check: `npx tsc --noEmit`
4. Build: `npm run build` (injects `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_APPLE_CLIENT_ID` from secrets)
5. Upload `pba-app/dist/` as artifact `frontend-dist` (retained 1 day)

**Job 2 — API CI** (`apps/api/`)
1. Install dependencies: `npm ci`
2. Type-check: `npx tsc --noEmit`
3. Build: `npm run build`
4. Upload `apps/api/dist/` as artifact `api-dist` (retained 1 day)

**Job 3 — Deploy to EC2 (DEV)**

Runs only when both CI jobs pass and the event is a push to `main`.

1. Download build artifacts from Jobs 1 and 2
2. Configure SSH agent with `EC2_SSH_KEY`
3. Add EC2 host to known hosts via `ssh-keyscan`
4. **Sync frontend:** `rsync` `pba-app/dist/` → `/var/www/pba/` (with `--delete` to remove stale files)
5. **Sync API dist:** `rsync` `apps/api/dist/` → `/opt/pba/api/dist/` (with `--delete`, excludes `node_modules`)
6. **Sync package manifests:** `rsync` `package.json` and `package-lock.json` → `/opt/pba/api/`
7. SSH into EC2 and run:
   ```bash
   cd /opt/pba/api
   npm ci --omit=dev
   pm2 restart pba-api --update-env   # or pm2 start if process doesn't exist yet
   pm2 save
   ```
8. **Health check:** waits 30 seconds then hits `http://<EC2_HOST>:83/api/health` up to 3 times with a 10-second gap between retries. Returns HTTP 200 on success; the job fails if all three attempts fail.
9. **Failure notification:** if any step fails, the run URL and commit SHA are printed to the job log.

### Concurrency

The pipeline uses a concurrency group per branch. If a new push arrives while a run is in progress for the same branch, the in-progress run is cancelled and the new one starts. This prevents stale builds from racing.

---

## 5. Manual Deployment

Use this procedure when you need to deploy outside of GitHub Actions (e.g., hotfixing directly on the server, or when the pipeline is unavailable).

### SSH into the server

```bash
ssh -i "dev-pba.pem" ubuntu@ec2-98-80-75-197.compute-1.amazonaws.com
```

### Restart the API (if only reloading config or env)

```bash
cd /opt/pba/api
pm2 restart pba-api --update-env
```

### Deploy a local build manually

Run these commands from your local machine (in the repository root):

```bash
# 1. Build the frontend
cd pba-app
npm ci
VITE_API_URL=http://ec2-98-80-75-197.compute-1.amazonaws.com:83 npm run build
cd ..

# 2. Build the API
cd apps/api
npm ci
npm run build
cd ../..

# 3. Sync frontend to server
rsync -avz --delete \
  pba-app/dist/ \
  ubuntu@ec2-98-80-75-197.compute-1.amazonaws.com:/var/www/pba/

# 4. Sync API dist and package files to server
rsync -avz --delete --exclude='node_modules' \
  apps/api/dist/ \
  ubuntu@ec2-98-80-75-197.compute-1.amazonaws.com:/opt/pba/api/dist/

rsync -avz \
  apps/api/package.json \
  apps/api/package-lock.json \
  ubuntu@ec2-98-80-75-197.compute-1.amazonaws.com:/opt/pba/api/

# 5. SSH in and finish the deployment
ssh -i "dev-pba.pem" ubuntu@ec2-98-80-75-197.compute-1.amazonaws.com \
  "cd /opt/pba/api && npm ci --omit=dev && pm2 restart pba-api --update-env && pm2 save"
```

---

## 6. Environment Variables — Updating Secrets

The API process reads environment variables from `/opt/pba/api/.env` at startup. Changes to that file take effect only after a pm2 restart.

### Procedure

```bash
# 1. SSH into the server
ssh -i "dev-pba.pem" ubuntu@ec2-98-80-75-197.compute-1.amazonaws.com

# 2. Edit the .env file
nano /opt/pba/api/.env

# 3. Save and exit (Ctrl+O, Enter, Ctrl+X in nano)

# 4. Restart pm2 to pick up the new values
pm2 restart pba-api --update-env
```

> **Warning:** Always restart pm2 after editing `.env`. pm2 caches environment variables at process startup — the running process will not see file changes until it is restarted. Skipping the restart means the old values remain active.

### Production secret validation

The API enforces non-placeholder secrets at boot when `NODE_ENV=production`:

- `JWT_SECRET` must be set and must not equal `change-me-in-production`
- `COOKIE_SECRET` must be set and must not equal `change-me-in-production`

The process will throw and exit immediately if either check fails, which surfaces as a pm2 restart loop. Check `pm2 logs pba-api --err` to confirm.

---

## 7. Monitoring and Logs

### pm2 process management

```bash
# Live log stream (stdout + stderr)
pm2 logs pba-api

# Last 100 lines of error logs only
pm2 logs pba-api --err --lines 100

# Process status (uptime, restarts, memory, CPU)
pm2 status

# Interactive CPU and memory monitor
pm2 monit
```

### nginx logs

```bash
# Live access log
sudo tail -f /var/log/nginx/access.log

# Live error log
sudo tail -f /var/log/nginx/error.log
```

### System service status

```bash
# nginx service health
sudo systemctl status nginx

# Redis service health
sudo systemctl status redis-server
```

---

## 8. Rollback Procedure

There is currently no artifact-based automated rollback. Ticket **PBA-198** tracks the implementation of automated rollback. Until that is resolved, use the manual procedure below.

### Steps

1. **Identify the last good commit** on your local machine:

   ```bash
   git log --oneline
   ```

2. **Check out that commit** locally:

   ```bash
   git checkout <commit-sha>
   ```

3. **Build both the frontend and API** (see [Manual Deployment](#5-manual-deployment), steps 1–2).

4. **Sync the built output to the server** (see [Manual Deployment](#5-manual-deployment), steps 3–4).

5. **Restart the API on the server:**

   ```bash
   ssh -i "dev-pba.pem" ubuntu@ec2-98-80-75-197.compute-1.amazonaws.com \
     "cd /opt/pba/api && npm ci --omit=dev && pm2 restart pba-api --update-env && pm2 save"
   ```

6. **Verify the health check** (see [Health Check](#9-health-check)).

7. **Return to the tip of main** on your local machine once the rollback is confirmed:

   ```bash
   git checkout main
   ```

> **Note:** After a rollback, create a revert commit on `main` rather than leaving the branch behind the bad commit. This ensures the CI/CD pipeline does not immediately re-deploy the broken code.

---

## 9. Health Check

Both the direct API port and the nginx proxy expose the health endpoint.

| Route | URL | When to use |
|-------|-----|-------------|
| Via nginx (standard) | `http://ec2-98-80-75-197.compute-1.amazonaws.com:83/api/health` | Normal health verification; tests the full request path |
| Direct to API | `http://ec2-98-80-75-197.compute-1.amazonaws.com:4000/health` | Isolate API from nginx; useful when debugging proxy issues |

### Expected response

Both endpoints return the same shape:

```json
{
  "status": "ok",
  "timestamp": "2026-03-12T10:00:00.000Z"
}
```

HTTP status code: `200 OK`

### Manual health check

```bash
curl -s http://ec2-98-80-75-197.compute-1.amazonaws.com:83/api/health | jq .
```

---

## 10. SSL / HTTPS Setup (Future)

SSL is not yet configured on the DEV environment. The application currently serves traffic over plain HTTP on port 83.

When a domain name is assigned, configure HTTPS using Let's Encrypt and Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
sudo systemctl reload nginx
```

Certbot will automatically update the nginx site config and schedule renewal via a systemd timer. After SSL is enabled:

- Update `FRONTEND_URL` in `/opt/pba/api/.env` to use `https://`
- Update `VITE_API_URL` in GitHub Actions secrets to use `https://`
- Update the Google OAuth `Authorised JavaScript origins` and `Authorised redirect URIs` in Google Cloud Console
- Update the Apple Developer portal Return URLs for Sign In with Apple

---

## 11. Troubleshooting

### API won't start or keeps restarting

**Symptoms:** `pm2 status` shows `errored` or a high restart count.

**Steps:**
```bash
pm2 logs pba-api --err --lines 50
```

Common causes:
- **Missing or invalid `JWT_SECRET` / `COOKIE_SECRET`** — the server throws immediately in production if either is absent or still the placeholder. Set correct values in `/opt/pba/api/.env` and restart.
- **MongoDB connection failure** — check that the EC2 public IP is in the MongoDB Atlas Network Access allowlist. The error message will contain `MongoServerSelectionError` or `ECONNREFUSED`.
- **Redis not running** — BullMQ workers fail to connect. See the Redis fix below.

---

### Health check returns non-200 or times out

**Steps:**
```bash
# 1. Check nginx is running
sudo systemctl status nginx

# 2. Check pm2 is running
pm2 status

# 3. Try the direct API endpoint (bypasses nginx)
curl -s http://localhost:4000/health

# 4. Check nginx error log for proxy errors
sudo tail -n 50 /var/log/nginx/error.log
```

If `localhost:4000/health` responds but `localhost:83/api/health` does not, the issue is in nginx configuration.

---

### Frontend shows a blank page

**Symptoms:** The browser loads the page but nothing renders; the React app is not mounting.

**Steps:**
1. Open browser DevTools → Console. Look for a network error against the API URL.
2. Confirm `VITE_API_URL` in the GitHub Actions secrets is set to the correct value and that the frontend was rebuilt after any change.
3. Verify nginx is serving files from `/var/www/pba/`:
   ```bash
   ls /var/www/pba/
   ```
   You should see `index.html`, `assets/`, and other build output. If the directory is empty, the rsync step did not run.
4. Check that nginx `try_files` is configured to fall back to `index.html` (required for React Router client-side routing).

---

### Redis connection refused

**Symptoms:** Log lines containing `ECONNREFUSED 127.0.0.1:6379` or BullMQ worker errors.

```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server
redis-cli ping   # should return PONG
```

---

### MongoDB Atlas connection timeout

**Symptoms:** `MongoServerSelectionError: connection timed out` in pm2 logs.

The most common cause is the EC2 instance's public IP not being in the MongoDB Atlas Network Access allowlist.

1. Find the EC2 public IP:
   ```bash
   curl -s ifconfig.me
   ```
2. Log in to [MongoDB Atlas](https://cloud.mongodb.com) → **Network Access** → **Add IP Address** → paste the IP → confirm.
3. Restart the API:
   ```bash
   pm2 restart pba-api --update-env
   ```
