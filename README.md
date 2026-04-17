# Product Builder Academy

A web application where students complete a structured, step-by-step product-building programme. Students submit screenshots at each step for AI-powered review, earn badges as they progress, and receive a certificate on completion. Admins manage cohorts, review submissions, and broadcast communications to students.

## Overview

nextaibuilder guides enrolled students through a sequential setup programme — from creating a business email to configuring payment processing. Each step requires a screenshot submission that is first validated by the Claude Vision AI model, then optionally reviewed by an admin. Progress is tracked in real time and surfaced on both student dashboards and admin panels.

**User roles:**

| Role | Capabilities |
|------|-------------|
| `STUDENT` | View assigned steps, submit screenshots, track progress, view badges and certificate |
| `ADMIN` | Review submissions, manage cohorts, view reports, send broadcast messages |
| `SUPER_ADMIN` | All admin capabilities plus user management |

## Monorepo Structure

```
ProductBuilderAcademy/
├── pba-app/          # React frontend (Vite + TypeScript + Tailwind CSS v4)
├── apps/api/         # Fastify REST API (TypeScript + MongoDB/Mongoose)
└── .github/          # CI/CD workflows (GitHub Actions)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, react-router v7 |
| Backend | Node.js 20, Fastify, TypeScript, Mongoose |
| Database | MongoDB 7+ |
| Auth | Google OAuth 2.0 (One Tap + popup), Apple Sign-In — SSO only |
| Async jobs | BullMQ + Redis |
| Storage | AWS S3 (screenshots, avatars) |
| AI | Anthropic Claude Vision API (screenshot validation) |
| Real-time | Socket.io (JWT-authenticated) |
| Email | Nodemailer (SMTP — Mailtrap for dev, SES for prod) |
| Infra | EC2, nginx, pm2 |

## Prerequisites

Ensure the following are available before starting:

- **Node.js 20+** — `node --version`
- **MongoDB** — local instance or [MongoDB Atlas](https://www.mongodb.com/atlas)
- **Redis** — local instance or a managed provider (required for BullMQ job queues)
- **AWS S3 bucket** — for screenshot and avatar storage
- **Google Cloud Console project** — OAuth 2.0 Client ID (web application type)
- **Apple Developer account** — Services ID with Sign In with Apple enabled
- **Anthropic API key** — for Claude Vision ML screenshot validation

## Quick Start — Running Locally

### 1. Clone the repository

```bash
git clone <repo-url>
cd ProductBuilderAcademy
```

### 2. Set up the API

```bash
cd apps/api
cp .env.example .env
# Open .env and fill in all required values (see apps/api/.env.example)

npm install
npm run dev
# API starts at http://localhost:4000
```

### 3. Seed the database

```bash
# From apps/api/
npm run db:seed
```

This creates the super admin user, a demo student, five setup steps, a demo cohort, and three achievement badges.

### 4. Set up the frontend

```bash
cd ../../pba-app
cp .env.example .env
# Open .env and fill in all required values (see pba-app/.env.example)

npm install
npm run dev
# Frontend starts at http://localhost:5173
```

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:4000 |
| API health | http://localhost:4000/health |

## Seed Credentials

The seed script (`apps/api/scripts/seed.ts`) creates the following accounts. These accounts use Google OAuth, so they must be signed in via "Continue with Google" using the corresponding Google account.

| Role | Email | Notes |
|------|-------|-------|
| Super Admin | `aleemhaider111@gmail.com` | Seeded with `oauthProvider: google`. Sign in with the matching Google account. |
| Demo Student | `student@example.com` | Enrolled in cohort `PBA-2024-Q1` with step 1 unlocked. |

> Note: Because authentication is SSO-only (no email/password), these accounts can only be accessed through Google Sign-In with the matching Google account. For local testing with the demo student account, ensure a Google account with that email exists, or update the seed script email to match a Google account you control.

## Environment Variables

Full documentation for each variable is in the respective `.env.example` file.

### `apps/api/.env` — API server

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | Yes | Port the API listens on (default `4000`) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | 64-character random hex string for signing JWTs |
| `COOKIE_SECRET` | Yes | 64-character random hex string for signing cookies |
| `REDIS_URL` | Yes | Redis connection URL for BullMQ |
| `AWS_ACCESS_KEY_ID` | Yes | AWS credentials for S3 |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS credentials for S3 |
| `AWS_REGION` | Yes | AWS region of the S3 bucket |
| `S3_BUCKET_NAME` | Yes | S3 bucket name for screenshots and avatars |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `APPLE_CLIENT_ID` | Yes | Apple Services ID |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude Vision |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Yes | SMTP credentials for transactional email |
| `FRONTEND_URL` | Yes | Frontend origin for CORS (e.g. `http://localhost:5173`) |

See [`apps/api/.env.example`](./apps/api/.env.example) for all variables and defaults.

### `pba-app/.env` — Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Base URL of the API server |
| `VITE_GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID (same as API) |
| `VITE_APPLE_CLIENT_ID` | Yes | Apple Services ID (same as API) |
| `VITE_APPLE_REDIRECT_URI` | Yes | Apple redirect URI registered in Apple Developer portal |
| `VITE_SUPPORT_EMAIL` | No | Support email shown on the Help page |
| `VITE_SUPPORT_SCHEDULING_URL` | No | Scheduling link (e.g. Calendly) on the Help page |

See [`pba-app/.env.example`](./pba-app/.env.example) for all variables and defaults.

## Key Architecture Decisions

**SSO-only authentication.** There is no email/password login. Users sign in exclusively via Google OAuth 2.0 (One Tap + popup fallback) or Apple Sign-In. New users are automatically registered on first sign-in.

**JWT access tokens + httpOnly refresh cookie.** Access tokens are short-lived (15 minutes) and sent as Bearer tokens. Refresh tokens are stored as bcrypt hashes in MongoDB and transmitted as httpOnly cookies (`nab_refresh`) scoped to `/api/auth`. Token rotation occurs on every refresh.

**ML-first screenshot validation.** On submission, a job is added to the `screenshot-validation-queue` (BullMQ + Redis). A worker calls the Anthropic Claude Vision API to score the screenshot against the step criteria. If the ML confidence score meets the threshold, the step is automatically approved or flagged for human review.

**Real-time updates via Socket.io.** After ML validation or admin review, the submission status is pushed to the student's private room (`student:<userId>`) over a JWT-authenticated Socket.io connection.

**BullMQ + Redis for async jobs.** Two queues handle background work:
- `screenshot-validation-queue` — ML validation of student screenshot submissions
- `scheduled-email-queue` — deferred transactional emails

## Available Scripts

### API (`apps/api/`)

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npm run dev` | Start with hot-reload (tsx watch) |
| Build | `npm run build` | Compile TypeScript to `dist/` |
| Start | `npm start` | Run compiled build |
| Seed | `npm run db:seed` | Seed admin, student, steps, cohort, badges |
| Type check | `npm run typecheck` | Run `tsc --noEmit` |
| Lint | `npm run lint` | Run ESLint |

### Frontend (`pba-app/`)

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npm run dev` | Start Vite dev server at :5173 |
| Build | `npm run build` | Production build to `dist/` |
| Preview | `npm run preview` | Preview production build locally |
| Type check | `npm run typecheck` | Run `tsc --noEmit` |
| Lint | `npm run lint` | Run ESLint |

## CI/CD

GitHub Actions workflows run on every PR and push to `main`.

**On pull requests:** lint, typecheck, and build for both `pba-app` and `apps/api`.

**On push to `main`:** build both apps and deploy to EC2 over SSH.

Required GitHub Actions secrets:

| Secret | Description |
|--------|-------------|
| `EC2_SSH_KEY` | Private SSH key for the EC2 instance |
| `EC2_HOST` | EC2 public hostname or IP |
| `EC2_USER` | SSH username (e.g. `ec2-user` or `ubuntu`) |
| `VITE_API_URL` | Injected at build time for the frontend |
| `VITE_GOOGLE_CLIENT_ID` | Injected at build time for the frontend |
| `VITE_APPLE_CLIENT_ID` | Injected at build time for the frontend |

## Project Links

- **Jira:** [PBA project](https://lifetimebusinessdashboard.atlassian.net) — issue tracking and sprint planning
- **Confluence:** PBA space on `lifetimebusinessdashboard.atlassian.net` — architecture decisions and runbooks
- **API Reference:** [`apps/api/README.md`](./apps/api/README.md)
