# PBA API — Fastify Backend

REST API for Product Builder Academy. Built with Node.js 20, Fastify, TypeScript, and Mongoose (MongoDB).

## Table of Contents

1. [Setup and Running](#setup-and-running)
2. [Authentication](#authentication)
3. [Endpoint Reference](#endpoint-reference)
   - [Auth](#auth-apiauthx)
   - [OAuth](#oauth-apiauthoauthx)
   - [Student — Dashboard](#student--dashboard)
   - [Student — Steps](#student--steps)
   - [Student — Achievements](#student--achievements)
   - [Admin — Dashboard](#admin--dashboard)
   - [Admin — Submissions](#admin--submissions)
   - [Admin — Cohorts](#admin--cohorts)
   - [Admin — Students](#admin--students)
   - [Admin — Reports](#admin--reports)
   - [Admin — Messages](#admin--messages)
   - [Admin — Settings](#admin--settings)
   - [Health](#health)
4. [WebSocket Events](#websocket-events)
5. [BullMQ Queues](#bullmq-queues)
6. [Environment Variables](#environment-variables)
7. [Database Models](#database-models)

---

## Setup and Running

### Prerequisites

- Node.js 20+
- MongoDB 7+ (local or Atlas)
- Redis 7+ (for BullMQ job queues)
- AWS S3 bucket (for screenshots and avatars)
- Google Cloud project with an OAuth 2.0 Client ID
- Apple Developer account with a Services ID (Sign In with Apple)
- Anthropic API key (Claude Vision for ML screenshot validation)

### Initial setup

```bash
cd apps/api
cp .env.example .env
# Fill in all required values in .env

npm install
npm run db:seed   # seed admin, demo student, steps, cohort, badges
npm run dev       # starts at http://localhost:4000
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot-reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run db:seed` | Seed the database with initial data |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | Run ESLint |

---

## Authentication

PBA uses **SSO-only authentication** — there is no email/password login. Users sign in via Google OAuth 2.0 or Apple Sign-In.

### Token scheme

| Token | Lifetime | Delivery |
|-------|----------|----------|
| **Access token** (JWT) | 15 minutes | Response body — send as `Authorization: Bearer <token>` |
| **Refresh token** | 7 days | httpOnly cookie `nab_refresh`, path `/api/auth`, SameSite=Lax |

The JWT payload contains `{ sub, email, role }`. On every call to `POST /api/auth/refresh`, the refresh token is rotated (old token revoked, new token issued).

### Auth header

All protected endpoints require:

```
Authorization: Bearer <accessToken>
```

Admin endpoints additionally require the JWT `role` claim to be `ADMIN` or `SUPER_ADMIN`.

---

## Endpoint Reference

### Auth (`/api/auth/*`)

#### POST /api/auth/refresh

Rotate the refresh token and issue a new access token. No Bearer token required — reads the `nab_refresh` cookie.

**Request:** No body required.

**Response `200`:**
```json
{ "accessToken": "<new JWT>" }
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 401 | `NO_REFRESH_TOKEN` | Cookie missing |
| 401 | `INVALID_REFRESH_TOKEN` | Token invalid or expired |

**Example:**
```bash
curl -X POST http://localhost:4000/api/auth/refresh \
  --cookie "nab_refresh=<token>"
```

---

#### POST /api/auth/logout

Revoke the current refresh token and clear the cookie. Requires a valid Bearer access token.

**Auth:** Bearer token required.

**Request:** No body required.

**Response `200`:**
```json
{ "message": "Logged out." }
```

**Example:**
```bash
curl -X POST http://localhost:4000/api/auth/logout \
  -H "Authorization: Bearer <accessToken>" \
  --cookie "nab_refresh=<token>"
```

---

#### GET /api/auth/me

Return the authenticated user's profile.

**Auth:** Bearer token required.

**Response `200`:**
```json
{
  "user": {
    "id": "64a1...",
    "email": "user@example.com",
    "firstName": "Alex",
    "lastName": "Johnson",
    "role": "STUDENT",
    "avatarUrl": "https://...",
    "lastActiveAt": "2024-03-10T12:00:00.000Z",
    "createdAt": "2024-02-01T09:00:00.000Z"
  }
}
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 404 | `USER_NOT_FOUND` | User deleted from database since token was issued |

---

### OAuth (`/api/auth/oauth/*`)

#### POST /api/auth/oauth/google

Exchange a Google ID token for PBA access and refresh tokens. Creates a new user account on first sign-in and sends a welcome email.

**Auth:** None.

**Request body:**
```json
{ "idToken": "<Google ID token from Google Identity Services>" }
```

**Response `200`:**
```json
{
  "accessToken": "<JWT>",
  "user": {
    "id": "64a1...",
    "email": "user@gmail.com",
    "firstName": "Alex",
    "lastName": "Johnson",
    "role": "STUDENT",
    "avatarUrl": "https://lh3.googleusercontent.com/..."
  }
}
```

Sets `nab_refresh` httpOnly cookie.

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `VALIDATION_ERROR` | `idToken` missing |
| 401 | `INVALID_TOKEN` | Google token verification failed or missing claims |

**Example:**
```bash
curl -X POST http://localhost:4000/api/auth/oauth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "<google-id-token>"}'
```

---

#### POST /api/auth/oauth/apple

Exchange an Apple ID token for PBA access and refresh tokens. Creates a new user account on first sign-in. Apple only sends the user's name on the very first sign-in, so `user.firstName` and `user.lastName` are optional.

**Auth:** None.

**Request body:**
```json
{
  "idToken": "<Apple ID token>",
  "user": {
    "firstName": "Alex",
    "lastName": "Johnson"
  }
}
```

`user` is optional and only present on the first Apple sign-in.

**Response `200`:**
```json
{
  "accessToken": "<JWT>",
  "user": {
    "id": "64a1...",
    "email": "user@privaterelay.appleid.com",
    "firstName": "Alex",
    "lastName": "Johnson",
    "role": "STUDENT",
    "avatarUrl": null
  }
}
```

Sets `nab_refresh` httpOnly cookie.

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `VALIDATION_ERROR` | `idToken` missing |
| 401 | `INVALID_TOKEN` | Apple token verification failed, no matching key, or missing claims |

---

### Student — Dashboard

#### GET /api/student/dashboard

Return the authenticated student's dashboard state, cohort info, and step progress summary.

**Auth:** Bearer token required.

**Response `200`:**
```json
{
  "dashboardState": "IN_PROGRESS",
  "student": { "id": "64a1...", "email": "student@example.com" },
  "cohort": {
    "id": "64b2...",
    "name": "Q1 2024 Cohort",
    "startDate": "2024-03-01T00:00:00.000Z",
    "deadline": "2024-06-30T00:00:00.000Z"
  },
  "steps": [
    { "id": "64c3...", "title": "Set Up Your Business Email", "order": 1, "status": "COMPLETE" },
    { "id": "64c4...", "title": "Create Your Business Website", "order": 2, "status": "IN_PROGRESS" },
    { "id": "64c5...", "title": "Set Up Your CRM", "order": 3, "status": "LOCKED" }
  ],
  "progressPercent": 20,
  "completedSteps": 1,
  "totalSteps": 5
}
```

**`dashboardState` values:**

| Value | Meaning |
|-------|---------|
| `WELCOME` | Enrolled but no steps started |
| `IN_PROGRESS` | At least one step completed, not all done, deadline not missed |
| `COMPLETE` | All steps completed |
| `DEADLINE_MISSED` | Cohort deadline passed before completion |
| `NO_COHORT` | Student is not enrolled in any cohort |

**`status` values for steps:**

| Value | Meaning |
|-------|---------|
| `LOCKED` | Previous step not yet completed |
| `UNLOCKED` | Available but not started |
| `IN_PROGRESS` | Started but no submission yet |
| `PENDING_REVIEW` | Screenshot submitted, awaiting ML or human review |
| `COMPLETE` | ML or admin approved |
| `OVERRIDE_PASS` | Admin manually approved |
| `OVERRIDE_FAIL` | Admin manually rejected |

---

### Student — Steps

#### GET /api/student/steps/:stepId

Return full details for a single step, including the student's current status and latest submission summary.

**Auth:** Bearer token required.

**Path params:** `stepId` — MongoDB ObjectId of the step.

**Response `200`:**
```json
{
  "step": {
    "id": "64c3...",
    "title": "Set Up Your Business Email",
    "order": 1,
    "description": "Create a professional email address using your domain name...",
    "videoUrl": null,
    "screenshotCriteria": "Screenshot should show a Gmail or similar inbox with a custom domain email address...",
    "status": "IN_PROGRESS",
    "latestSubmission": {
      "id": "64d1...",
      "status": "PENDING",
      "mlFeedback": null,
      "createdAt": "2024-03-10T12:00:00.000Z"
    }
  },
  "prevStepId": null,
  "nextStepId": "64c4..."
}
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 403 | `STEP_LOCKED` | Previous steps not yet completed |
| 404 | `STEP_NOT_FOUND` | Step ID does not exist |

---

#### POST /api/student/steps/:stepId/presign

Generate a presigned S3 PUT URL for uploading a screenshot directly from the browser. The URL expires in 5 minutes.

Rate limited to 10 submissions per student per step per day.

**Auth:** Bearer token required.

**Path params:** `stepId`

**Request:** No body required.

**Response `200`:**
```json
{
  "presignedUrl": "https://pba-screenshots.s3.amazonaws.com/...",
  "s3Key": "screenshots/<userId>/<stepId>/attempt-3.png"
}
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 403 | `STEP_LOCKED` | Step is locked |
| 404 | `STEP_NOT_FOUND` | Step ID does not exist |
| 409 | `PENDING_SUBMISSION_EXISTS` | A submission is already under review for this step |
| 429 | `RATE_LIMIT` | Maximum 10 submissions per step per day reached |

**Example:**
```bash
curl -X POST http://localhost:4000/api/student/steps/64c3.../presign \
  -H "Authorization: Bearer <accessToken>"
```

---

#### POST /api/student/steps/:stepId/submissions

Create a submission record after uploading the screenshot to S3. Enqueues the submission onto the `screenshot-validation-queue` for ML review.

**Auth:** Bearer token required.

**Path params:** `stepId`

**Request body:**
```json
{ "s3Key": "screenshots/<userId>/<stepId>/attempt-3.png" }
```

**Response `201`:**
```json
{ "submissionId": "64d1...", "status": "PENDING" }
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `MISSING_S3_KEY` | `s3Key` not provided |
| 403 | `STEP_LOCKED` | Step is locked |
| 404 | `STEP_NOT_FOUND` | Step ID does not exist |
| 409 | `PENDING_SUBMISSION_EXISTS` | Submission already under review |

**Example:**
```bash
curl -X POST http://localhost:4000/api/student/steps/64c3.../submissions \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"s3Key": "screenshots/64a1/64c3/attempt-1.png"}'
```

---

#### GET /api/student/steps/:stepId/submission/latest

Return the most recent submission for the given step, including a presigned S3 GET URL (valid for 5 minutes) for viewing the screenshot.

**Auth:** Bearer token required.

**Path params:** `stepId`

**Response `200`:**
```json
{
  "submission": {
    "id": "64d1...",
    "status": "APPROVED",
    "mlFeedback": "The screenshot clearly shows a custom domain inbox. Criteria met.",
    "mlScore": 0.92,
    "screenshotUrl": "https://pba-screenshots.s3.amazonaws.com/...?X-Amz-Expires=300...",
    "createdAt": "2024-03-10T12:00:00.000Z",
    "reviewedAt": "2024-03-10T12:00:15.000Z"
  }
}
```

**`status` values for submissions:**

| Value | Meaning |
|-------|---------|
| `PENDING` | Queued, ML not yet started |
| `ML_PROCESSING` | Claude Vision is evaluating the screenshot |
| `HUMAN_REVIEW` | ML inconclusive, flagged for admin review |
| `APPROVED` | Passed (ML or admin) |
| `REJECTED` | Failed (ML or admin) |

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 404 | `NO_SUBMISSION` | No submission exists for this step |

---

### Student — Achievements

#### GET /api/student/badges

Return all badges in the system, each annotated with whether the authenticated student has earned it.

**Auth:** Bearer token required.

**Response `200`:**
```json
{
  "badges": [
    {
      "id": "64e1...",
      "name": "First Step",
      "description": "Completed your first setup step",
      "iconUrl": "/badges/first-step.svg",
      "triggerCriteria": "steps_completed:1",
      "earned": true,
      "earnedAt": "2024-03-10T12:05:00.000Z"
    },
    {
      "id": "64e2...",
      "name": "Halfway There",
      "description": "Completed 50% of setup steps",
      "iconUrl": "/badges/halfway.svg",
      "triggerCriteria": "steps_completed:3",
      "earned": false,
      "earnedAt": null
    }
  ]
}
```

---

#### GET /api/student/certificate

Return the authenticated student's certificate, or `null` if not yet earned. A certificate is issued automatically when all steps are completed.

**Auth:** Bearer token required.

**Response `200` (certificate earned):**
```json
{
  "certificate": {
    "id": "64f1...",
    "publicToken": "a3b8c2d9...",
    "issuedAt": "2024-06-15T14:00:00.000Z",
    "studentName": "Alex Johnson",
    "cohortName": "Q1 2024 Cohort"
  }
}
```

**Response `200` (not yet earned):**
```json
{ "certificate": null }
```

---

### Admin — Dashboard

All admin endpoints require a JWT with `role: ADMIN` or `role: SUPER_ADMIN`.

#### GET /api/admin/stats

Return summary counters for the admin dashboard.

**Auth:** Bearer token required (Admin).

**Response `200`:**
```json
{
  "activeStudents": 42,
  "pendingReviews": 7,
  "completionRate": 24,
  "activeCohorts": 2
}
```

| Field | Description |
|-------|-------------|
| `activeStudents` | Students with `STUDENT` role enrolled in an active cohort |
| `pendingReviews` | Submissions with status `PENDING` or `HUMAN_REVIEW` |
| `completionRate` | Percentage of active students who have completed all steps (integer 0–100) |
| `activeCohorts` | Cohorts with status `ACTIVE` |

---

#### GET /api/admin/at-risk

Return students who have not submitted anything in the last 7 days. Paginated.

**Auth:** Bearer token required (Admin).

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Results per page (max 100) |

**Response `200`:**
```json
{
  "students": [
    {
      "id": "64a1...",
      "firstName": "Alex",
      "lastName": "Johnson",
      "email": "student@example.com",
      "avatarUrl": null,
      "cohort": { "id": "64b2...", "name": "Q1 2024 Cohort" },
      "lastActiveAt": "2024-03-01T08:00:00.000Z",
      "daysInactive": 9
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

`daysInactive` is `999` if the student has never submitted.

---

### Admin — Submissions

#### GET /api/admin/submissions

List all submissions with filtering and pagination.

**Auth:** Bearer token required (Admin).

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by submission status: `PENDING`, `ML_PROCESSING`, `HUMAN_REVIEW`, `APPROVED`, `REJECTED` |
| `cohortId` | string | Filter to submissions from students in a specific cohort |
| `stepId` | string | Filter to submissions for a specific step |
| `page` | integer | Page number (default `1`) |
| `limit` | integer | Results per page (default `20`, max `100`) |

**Response `200`:**
```json
{
  "submissions": [
    {
      "id": "64d1...",
      "status": "HUMAN_REVIEW",
      "mlScore": 0.45,
      "mlFeedback": "The screenshot appears to show a personal Gmail account, not a custom domain...",
      "reviewNote": null,
      "reviewedAt": null,
      "createdAt": "2024-03-10T12:00:00.000Z",
      "updatedAt": "2024-03-10T12:00:10.000Z",
      "student": {
        "id": "64a1...",
        "email": "student@example.com",
        "firstName": "Alex",
        "lastName": "Johnson",
        "avatarUrl": null
      },
      "step": { "id": "64c3...", "title": "Set Up Your Business Email", "order": 1 }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 38, "totalPages": 2 }
}
```

---

#### GET /api/admin/submissions/:id

Return full details for a single submission including a presigned screenshot URL (valid 15 minutes), student progress info, and reviewer identity.

**Auth:** Bearer token required (Admin).

**Path params:** `id` — submission MongoDB ObjectId.

**Response `200`:**
```json
{
  "submission": {
    "id": "64d1...",
    "status": "HUMAN_REVIEW",
    "s3Key": "screenshots/64a1/64c3/attempt-1.png",
    "screenshotUrl": "https://pba-screenshots.s3.amazonaws.com/...?X-Amz-Expires=900...",
    "mlScore": 0.45,
    "mlFeedback": "The screenshot appears to show a personal Gmail account...",
    "reviewNote": null,
    "reviewedAt": null,
    "createdAt": "2024-03-10T12:00:00.000Z",
    "updatedAt": "2024-03-10T12:00:10.000Z"
  },
  "student": {
    "id": "64a1...",
    "email": "student@example.com",
    "firstName": "Alex",
    "lastName": "Johnson",
    "avatarUrl": null,
    "role": "STUDENT",
    "attempts": 2,
    "stepStatus": "PENDING_REVIEW",
    "unlockedAt": "2024-03-05T09:00:00.000Z",
    "completedAt": null
  },
  "step": {
    "id": "64c3...",
    "title": "Set Up Your Business Email",
    "order": 1,
    "screenshotCriteria": "Screenshot should show a Gmail or similar inbox with a custom domain...",
    "description": "Create a professional email address using your domain name..."
  },
  "reviewedBy": null
}
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 404 | `SUBMISSION_NOT_FOUND` | Submission ID does not exist |

---

#### PATCH /api/admin/submissions/:id/review

Approve or reject a submission. Cascades status to the student's `StudentStep` record, fires notification emails, updates badges and certificates if approved, and emits a real-time Socket.io event.

**Auth:** Bearer token required (Admin).

**Path params:** `id` — submission MongoDB ObjectId.

**Request body:**
```json
{
  "status": "APPROVED",
  "adminNote": "Great — the custom domain is clearly visible."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `"APPROVED"` or `"REJECTED"` | Yes | Review decision |
| `adminNote` | string (max 2000 chars) | No | Feedback shown to the student |

**Response `200`:**
```json
{
  "submission": {
    "id": "64d1...",
    "status": "APPROVED",
    "reviewedAt": "2024-03-10T14:30:00.000Z",
    "reviewNote": "Great — the custom domain is clearly visible."
  }
}
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_BODY` | Validation failure |
| 404 | `SUBMISSION_NOT_FOUND` | Submission ID does not exist |
| 409 | `SUBMISSION_PROCESSING` | ML is still processing — cannot review yet |

---

### Admin — Cohorts

#### GET /api/admin/cohorts

List all cohorts with student counts.

**Auth:** Bearer token required (Admin).

**Response `200`:**
```json
{
  "cohorts": [
    {
      "id": "64b2...",
      "name": "Q1 2024 Cohort",
      "code": "PBA-2024-Q1",
      "status": "ACTIVE",
      "startDate": "2024-03-01T00:00:00.000Z",
      "endDate": "2024-06-30T00:00:00.000Z",
      "studentCount": 18,
      "createdAt": "2024-02-15T10:00:00.000Z",
      "updatedAt": "2024-02-15T10:00:00.000Z"
    }
  ]
}
```

---

#### POST /api/admin/cohorts

Create a new cohort. The code is automatically uppercased and must be unique.

**Auth:** Bearer token required (Admin).

**Request body:**
```json
{
  "name": "Q2 2024 Cohort",
  "code": "PBA-2024-Q2",
  "startDate": "2024-07-01T00:00:00.000Z",
  "endDate": "2024-09-30T00:00:00.000Z"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 1–200 chars |
| `code` | string | Yes | 1–50 chars, unique |
| `startDate` | ISO 8601 datetime | Yes | Must be before `endDate` |
| `endDate` | ISO 8601 datetime | Yes | Must be after `startDate` |

New cohorts are created with status `DRAFT`.

**Response `201`:** Full cohort document.

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_BODY` | Validation failure |
| 400 | `INVALID_DATE_RANGE` | `endDate` is not after `startDate` |
| 409 | `CODE_CONFLICT` | A cohort with this code already exists |

---

#### GET /api/admin/cohorts/:id

Return a single cohort with its student count.

**Auth:** Bearer token required (Admin).

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_ID` | `id` is not a valid ObjectId |
| 404 | `NOT_FOUND` | Cohort does not exist |

---

#### PATCH /api/admin/cohorts/:id

Update cohort fields. All fields are optional. `code` is uppercased automatically.

**Auth:** Bearer token required (Admin).

**Request body (all fields optional):**
```json
{
  "name": "Q1 2024 Cohort (Updated)",
  "code": "PBA-2024-Q1-B",
  "startDate": "2024-03-01T00:00:00.000Z",
  "endDate": "2024-07-31T00:00:00.000Z",
  "status": "COMPLETED"
}
```

`status` must be one of: `DRAFT`, `UPCOMING`, `ACTIVE`, `COMPLETED`, `ARCHIVED`.

**Response `200`:** Updated cohort document (without `studentCount`).

---

#### GET /api/admin/cohorts/:id/students

Return all students enrolled in the cohort with their progress.

**Auth:** Bearer token required (Admin).

**Response `200`:**
```json
{
  "students": [
    {
      "userId": "64a1...",
      "name": "Alex Johnson",
      "email": "student@example.com",
      "completedSteps": 2,
      "totalSteps": 5,
      "progressPercent": 40,
      "enrolledAt": "2024-03-01T09:00:00.000Z",
      "lastActiveAt": "2024-03-10T12:00:00.000Z"
    }
  ]
}
```

---

#### POST /api/admin/cohorts/:id/enroll

Enroll an existing user in a cohort.

**Auth:** Bearer token required (Admin).

**Request body:**
```json
{ "userId": "64a1..." }
```

**Response `201`:**
```json
{
  "membership": {
    "id": "64g1...",
    "userId": "64a1...",
    "cohortId": "64b2...",
    "enrolledAt": "2024-03-10T14:00:00.000Z",
    "completionStatus": "NOT_STARTED"
  }
}
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_ID` / `INVALID_USER_ID` | Invalid ObjectId format |
| 404 | `NOT_FOUND` | Cohort not found |
| 404 | `USER_NOT_FOUND` | User not found |
| 409 | `ALREADY_ENROLLED` | Student is already in this cohort |

---

#### DELETE /api/admin/cohorts/:id/students/:userId

Remove a student from a cohort.

**Auth:** Bearer token required (Admin).

**Response `204`:** No content.

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_ID` / `INVALID_USER_ID` | Invalid ObjectId format |
| 404 | `NOT_FOUND` | Membership not found |

---

### Admin — Students

#### GET /api/admin/students

Paginated, filterable, searchable list of all students.

**Auth:** Bearer token required (Admin).

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | Page number (default `1`) |
| `limit` | integer | Results per page (default `20`, max `100`) |
| `cohortId` | string | Filter to students enrolled in a specific cohort |
| `status` | `active` or `inactive` | `active` = `lastActiveAt` within 30 days; `inactive` = older or null |
| `q` | string (max 200 chars) | Search by first name, last name, or email (case-insensitive) |

**Response `200`:**
```json
{
  "students": [
    {
      "id": "64a1...",
      "firstName": "Alex",
      "lastName": "Johnson",
      "email": "student@example.com",
      "avatarUrl": null,
      "cohortName": "Q1 2024 Cohort",
      "cohortId": "64b2...",
      "completedSteps": 2,
      "totalSteps": 5,
      "progressPercent": 40,
      "lastActiveAt": "2024-03-10T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

---

#### GET /api/admin/students/:id

Return a full student profile with step-by-step progress and the latest submission per step.

**Auth:** Bearer token required (Admin).

**Response `200`:**
```json
{
  "student": {
    "id": "64a1...",
    "firstName": "Alex",
    "lastName": "Johnson",
    "email": "student@example.com",
    "avatarUrl": null,
    "role": "STUDENT",
    "lastActiveAt": "2024-03-10T12:00:00.000Z",
    "createdAt": "2024-02-01T09:00:00.000Z"
  },
  "cohort": {
    "id": "64b2...",
    "name": "Q1 2024 Cohort",
    "code": "PBA-2024-Q1",
    "status": "ACTIVE",
    "startDate": "2024-03-01T00:00:00.000Z",
    "endDate": "2024-06-30T00:00:00.000Z",
    "enrolledAt": "2024-03-01T09:00:00.000Z"
  },
  "progress": {
    "completedSteps": 2,
    "totalSteps": 5,
    "progressPercent": 40
  },
  "steps": [
    {
      "stepId": "64c3...",
      "title": "Set Up Your Business Email",
      "order": 1,
      "description": "Create a professional email address...",
      "videoUrl": null,
      "status": "COMPLETE",
      "attempts": 1,
      "unlockedAt": "2024-03-01T09:00:00.000Z",
      "completedAt": "2024-03-05T10:30:00.000Z",
      "latestSubmission": {
        "id": "64d1...",
        "status": "APPROVED",
        "mlScore": 0.92,
        "mlFeedback": "Criteria met.",
        "reviewNote": null,
        "createdAt": "2024-03-05T10:00:00.000Z"
      }
    }
  ]
}
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_ID` | Not a valid ObjectId |
| 404 | `NOT_FOUND` | Student not found |

---

### Admin — Reports

#### GET /api/admin/reports/progress

Cohort-level completion statistics including per-step pass rates.

**Auth:** Bearer token required (Admin).

**Response `200`:**
```json
{
  "reports": [
    {
      "cohortId": "64b2...",
      "cohortName": "Q1 2024 Cohort",
      "totalStudents": 18,
      "completedStudents": 4,
      "avgProgressPercent": 52,
      "stepPassRates": [
        { "stepId": "64c3...", "stepTitle": "Set Up Your Business Email", "passRate": 88 },
        { "stepId": "64c4...", "stepTitle": "Create Your Business Website", "passRate": 71 },
        { "stepId": "64c5...", "stepTitle": "Set Up Your CRM", "passRate": null }
      ]
    }
  ]
}
```

`passRate` is `null` if no submissions have been reviewed yet for that step.

---

#### GET /api/admin/reports/submissions

Submission volume statistics for the last 30 days, plus today's counts and ML accuracy.

**Auth:** Bearer token required (Admin).

**Response `200`:**
```json
{
  "totalSubmissions": 183,
  "approvedToday": 5,
  "rejectedToday": 2,
  "pendingNow": 7,
  "mlAccuracyRate": 87,
  "submissionsByDay": [
    { "date": "2024-02-10", "count": 3 },
    { "date": "2024-02-11", "count": 8 }
  ]
}
```

`mlAccuracyRate` is `null` if no submissions have both an ML score and a final admin decision. `submissionsByDay` contains an entry for every day in the last 30, even if `count` is `0`.

---

#### GET /api/admin/reports/export

Export all student progress as a CSV file download.

**Auth:** Bearer token required (Admin).

**Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="pba-progress-export.csv"`

CSV columns: `Student Name`, `Email`, `Cohort`, `Completed Steps`, `Total Steps`, `Progress %`, `Last Active`, `Enrolled At`

**Example:**
```bash
curl -o export.csv \
  -H "Authorization: Bearer <accessToken>" \
  http://localhost:4000/api/admin/reports/export
```

---

### Admin — Messages

#### POST /api/admin/messages/broadcast

Send a broadcast email to all students in a cohort, or to a single student. Each send is logged in `EmailLog`.

**Auth:** Bearer token required (Admin).

**Request body:**
```json
{
  "recipientType": "cohort",
  "recipientId": "64b2...",
  "subject": "Important update about your cohort",
  "body": "Hi everyone,\n\nWe wanted to let you know..."
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `recipientType` | `"cohort"` or `"student"` | Yes | |
| `recipientId` | string | Yes | MongoDB ObjectId of cohort or user |
| `subject` | string | Yes | 1–500 chars |
| `body` | string | Yes | 1–50,000 chars; newlines render as separate `<p>` tags in the HTML email |

**Response `200`:**
```json
{ "sent": 18, "failed": 0 }
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_BODY` | Validation failure |
| 400 | `INVALID_RECIPIENT_ID` | Not a valid ObjectId |
| 404 | `USER_NOT_FOUND` | Student not found (when `recipientType: "student"`) |

---

#### GET /api/admin/messages/history

Paginated history of all broadcast emails sent.

**Auth:** Bearer token required (Admin).

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Results per page (max 100) |

**Response `200`:**
```json
{
  "history": [
    {
      "id": "64h1...",
      "recipientEmail": "student@example.com",
      "subject": "Important update about your cohort",
      "status": "SENT",
      "sentAt": "2024-03-10T15:00:00.000Z",
      "createdAt": "2024-03-10T14:59:58.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 54, "totalPages": 3 }
}
```

`status` values: `PENDING`, `SENT`, `FAILED`.

---

### Admin — Settings

#### GET /api/admin/settings/profile

Return the calling admin's own profile.

**Auth:** Bearer token required (Admin).

**Response `200`:**
```json
{
  "profile": {
    "id": "64a0...",
    "email": "admin@example.com",
    "firstName": "Aleem",
    "lastName": "Haider",
    "avatarUrl": "https://pba-screenshots.s3.amazonaws.com/avatars/64a0/...",
    "role": "SUPER_ADMIN",
    "createdAt": "2024-01-01T09:00:00.000Z"
  }
}
```

---

#### PATCH /api/admin/settings/profile

Update the admin's first name and/or last name. At least one field must be provided.

**Auth:** Bearer token required (Admin).

**Request body:**
```json
{
  "firstName": "Aleem",
  "lastName": "Haider"
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| `firstName` | string (optional) | 1–100 chars |
| `lastName` | string (optional) | 1–100 chars |

**Response `200`:** Updated profile (same shape as GET /profile).

---

#### POST /api/admin/settings/avatar

Upload a new avatar image (`multipart/form-data`). The file is stored in S3 at `avatars/<adminId>/<timestamp>.<ext>` and the user's `avatarUrl` is updated.

**Auth:** Bearer token required (Admin).

**Request:** `multipart/form-data` with a file field. Accepted MIME types: `image/jpeg`, `image/png`. Maximum size: 2 MB.

**Response `200`:**
```json
{ "avatarUrl": "https://pba-screenshots.s3.amazonaws.com/avatars/64a0/1710082800000.jpg" }
```

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `NO_FILE` | No file in the request |
| 400 | `INVALID_FILE_TYPE` | File is not `image/jpeg` or `image/png` |
| 413 | `FILE_TOO_LARGE` | File exceeds 2 MB |
| 502 | `S3_UPLOAD_FAILED` | S3 upload error |

---

### Health

#### GET /health

Basic health check. No auth required.

**Response `200`:**
```json
{ "status": "ok", "timestamp": "2024-03-10T14:00:00.000Z" }
```

#### GET /api/health

Identical to `GET /health`. No auth required.

---

## WebSocket Events

The API exposes a Socket.io server on the same HTTP server as Fastify.

### Connecting

The client must provide a valid JWT access token in the Socket.io handshake `auth` object:

```js
const socket = io('http://localhost:4000', {
  auth: { token: '<accessToken>' }
})
```

On connection, the server verifies the JWT and joins the socket to the private room `student:<userId>`. Connections with invalid or missing tokens are rejected.

### Events emitted by the server

#### `submission:updated`

Sent to the authenticated student's private room (`student:<userId>`) when a submission status changes — either after ML validation completes or after an admin review.

**Payload:**
```json
{
  "submissionId": "64d1...",
  "status": "APPROVED",
  "mlFeedback": "Criteria met. Custom domain is clearly visible.",
  "mlScore": 0.92
}
```

| Field | Type | Description |
|-------|------|-------------|
| `submissionId` | string | MongoDB ObjectId of the submission |
| `status` | string | New submission status (`APPROVED`, `REJECTED`, `HUMAN_REVIEW`, etc.) |
| `mlFeedback` | string or null | Claude Vision feedback text |
| `mlScore` | number or null | Confidence score 0–1 from Claude Vision |

#### `admin:submission:updated`

Broadcast to **all** connected sockets (admins monitoring the review queue in real time) when any submission changes.

**Payload:**
```json
{
  "userId": "64a1...",
  "submissionId": "64d1...",
  "status": "APPROVED",
  "mlFeedback": "Criteria met.",
  "mlScore": 0.92
}
```

---

## BullMQ Queues

Both queues use the Redis connection configured via `REDIS_URL`.

### `screenshot-validation-queue`

Enqueued by `POST /api/student/steps/:stepId/submissions`. Each job calls the Anthropic Claude Vision API to evaluate the screenshot against the step's `screenshotCriteria`.

**Job payload:**
```json
{
  "submissionId": "64d1...",
  "s3Key": "screenshots/64a1/64c3/attempt-1.png",
  "stepId": "64c3...",
  "userId": "64a1..."
}
```

On completion, the worker updates the `StepSubmission` status, awards badges/certificates if passing, and emits `submission:updated` via Socket.io.

### `scheduled-email-queue`

Used for deferred transactional emails. Jobs are created by the email service and processed by a dedicated worker that calls the SMTP service.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | `development` or `production` |
| `PORT` | Yes | `4000` | Port the API listens on |
| `HOST` | Yes | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | No | `info` | Fastify log level (`trace`, `debug`, `info`, `warn`, `error`) |
| `FRONTEND_URL` | Yes | `http://localhost:5173` | Allowed CORS origin and Socket.io origin |
| `MONGODB_URI` | Yes | — | MongoDB connection string |
| `JWT_SECRET` | Yes | — | 64-char random hex string for signing access tokens |
| `COOKIE_SECRET` | Yes | — | 64-char random hex string for signing cookies |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection URL for BullMQ |
| `AWS_ACCESS_KEY_ID` | Yes | — | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | Yes | — | AWS credentials |
| `AWS_REGION` | Yes | `eu-west-2` | AWS region of the S3 bucket |
| `S3_BUCKET_NAME` | Yes | `pba-screenshots` | S3 bucket for screenshots and avatars |
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth 2.0 Client ID |
| `APPLE_CLIENT_ID` | Yes | — | Apple Services ID |
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key for Claude Vision |
| `ML_CONFIDENCE_THRESHOLD` | No | `80` | Minimum ML score (0–100) to auto-approve |
| `ML_WORKER_CONCURRENCY` | No | `3` | Number of concurrent ML validation jobs |
| `SMTP_HOST` | Yes | `smtp.mailtrap.io` | SMTP server hostname |
| `SMTP_PORT` | Yes | `587` | SMTP server port |
| `SMTP_USER` | Yes | — | SMTP username |
| `SMTP_PASS` | Yes | — | SMTP password |
| `EMAIL_FROM` | Yes | `noreply@productbuilderacademy.com` | Sender address for transactional emails |
| `SUPPORT_SCHEDULING_URL` | No | — | Calendly or equivalent URL for support bookings |

See [`.env.example`](./.env.example) for the full template.

---

## Database Models

The API uses 13 Mongoose models:

| Model | Collection | Description |
|-------|------------|-------------|
| `User` | `users` | All user accounts (students, admins, super admins) — SSO only, no passwords |
| `RefreshToken` | `refreshtokens` | Bcrypt-hashed refresh tokens with expiry and revocation timestamp |
| `Cohort` | `cohorts` | Student intake cohorts with start/end dates and lifecycle status |
| `CohortMembership` | `cohortmemberships` | Enrolment record linking a user to a cohort |
| `SetupStep` | `setupsteps` | Global catalogue of programme steps (title, description, screenshot criteria) |
| `CohortStep` | `cohortsteps` | Assignment of a `SetupStep` to a specific cohort with ordering |
| `StudentStep` | `studentsteps` | Per-student progress record for each step (status, attempts, timestamps) |
| `StepSubmission` | `stepsubmissions` | Individual screenshot submission with ML score, feedback, and admin review |
| `Badge` | `badges` | Achievement badge definitions with trigger criteria |
| `UserBadge` | `userbadges` | Record of a badge earned by a specific student |
| `Certificate` | `certificates` | Completion certificate issued when all steps pass, with a public verification token |
| `EmailLog` | `emaillogs` | Log of all transactional and broadcast emails with delivery status |
| `AuditLog` | `auditlogs` | Admin action trail (submission approvals, rejections, etc.) |
