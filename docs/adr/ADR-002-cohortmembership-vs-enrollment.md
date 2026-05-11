---
# ADR-002: Keep CohortMembership and Enrollment as two models with explicit roles

**Status:** Accepted
**Date:** 2026-05-11
**Audit ref:** Architecture audit P1 #5

## Context

The backend has two Mongoose models that, at first glance, describe the same
relationship — "student is in cohort":

- **`CohortMembership`** — predates payment work. Schema:
  `{ userId, cohortId, completionStatus, joinedAt, enrolledAt }` with a
  single-field `userId` unique index (one membership per student).
- **`Enrollment`** — added during FIR Wave 2 to back paid enrollment. Schema:
  `{ studentId, cohortId, paymentPlanId, paymentMethod, paymentStatus, status,
  stripeSubscriptionId, lessonsCompleted, completionPercentage, idempotencyKey,
  ... }` with a compound `(studentId, cohortId)` unique index.

The audit flagged this as undocumented duality: both are written from admin
routes, both are read from student routes, and there is no sync script or
invariant that says which is canonical for which question. Anyone reading the
code for the first time has to grep both names to understand the data flow on
account creation, payment, or deletion.

Concretely, today:

| Question | Source of truth |
|---|---|
| "Which cohort is this student in?" (single-cohort assumption) | `CohortMembership` |
| "Does this student have paid, ACTIVE access to LMS lessons?" | `Enrollment` |
| "What payment method / Stripe subscription is on file?" | `Enrollment` |
| "Has this student completed the cohort? Should they appear on the dashboard?" | `CohortMembership.completionStatus` (PBA) **or** `Enrollment.status` (FIR) — depending on the route |

The two are written and deleted in tandem from a handful of places (admin
`invite-student`, admin `cohort-change`, student `profile.deleteAccount`), but
nothing in code enforces that they stay in sync. A row in one without a
corresponding row in the other is silently legal.

## Decision

**Keep both models. Document and enforce their roles. Do not collapse for now.**

- `CohortMembership` is the **roster** model. It answers "who belongs to which
  cohort?" — independent of payment state. PBA-era routes (student dashboard,
  admin roster, scheduled email worker, admin messages broadcast) read it.
- `Enrollment` is the **access + payment** model. It answers "is this student
  entitled to access lessons today, what did they pay, and how?" — FIR-era
  routes (LMS, checkout, Stripe webhooks, installment reminders) read it.

When a student is added or removed, **both** must be written. When access is
granted or revoked (payment received, refund, subscription cancelled), **only
Enrollment** changes. `CohortMembership.completionStatus` is the legacy
PBA-era completion flag and is **not** authoritative for FIR cohorts — FIR uses
`Enrollment.status === 'COMPLETED'`.

We do not collapse the two now because:

1. **Different cardinality contracts.** `CohortMembership` enforces a single
   active cohort per student via its unique `userId` index. `Enrollment`
   permits `(studentId, cohortId)` pairs and the compound index already
   supports multi-cohort enrollment, which the storefront roadmap will
   eventually use. Collapsing today would force us to either drop the
   one-cohort invariant prematurely or rebuild it as an application-level
   check.
2. **Risk of regression on read-heavy paths.** `CohortMembership.findOne({userId})`
   is on the hot path for the student dashboard. Replacing it with an
   `Enrollment` query that filters by `status` is a behaviour change (REVOKED
   students would disappear from screens that today still surface them) and
   touches PBA-era routes that have weak test coverage.
3. **Idempotency story is uneven.** `Enrollment` was hardened in FIR Wave 2
   Story K (`idempotencyKey` sparse unique, deterministic `{eventId}:{op}`
   format). `CohortMembership` has no such guard. Folding `CohortMembership`
   writes into the idempotent `enrollmentService` requires re-keying every
   PBA admin route — a separate body of work that should not be coupled to
   this ADR.

## Invariants (enforced by review until codified)

1. **Pair on create.** Any admin route that adds a student to a cohort writes
   **both** a `CohortMembership` and an `Enrollment` (creating either alone is
   a bug). The audit-driven `enrollmentService.activateEnrollment()` is
   responsible for `Enrollment` + downstream side effects; the route is
   responsible for the matching `CohortMembership.create({userId, cohortId})`.
2. **Pair on delete.** Account deletion (`student/profile.ts:deleteAccount`)
   removes **both** records and cancels any active Stripe subscription. This
   is already in place — see the profile-delete tests.
3. **`CohortMembership.completionStatus` is PBA-only.** FIR routes must read
   `Enrollment.status` for access decisions. The two fields are intentionally
   not mirrored.
4. **Stripe webhooks and payment lifecycle never touch `CohortMembership`.**
   Subscription cancel, refund, invoice failure, etc. flip `Enrollment.status`
   only. Removing a student from a cohort entirely is an admin action and
   touches both.
5. **Idempotency keys live on `Enrollment`.** Replay-safety on
   payment-triggered side effects (Slack invite, welcome email, installment
   reminders) is keyed by `Enrollment.idempotencyKey`, not by
   `CohortMembership`.

## Consequences

- **No code change required by this ADR.** It captures the current contract
  and turns implicit knowledge into a written invariant.
- **Future work to track.** When the storefront enables multi-cohort
  enrollment for a single student, `CohortMembership`'s unique-on-`userId`
  index becomes a blocker. That migration belongs in a follow-up ADR (likely
  "ADR-00X: collapse roster into Enrollment after multi-cohort GA"), not
  this one.
- **New routes** that touch student-cohort linkage are required to update
  **both** models on add/remove. Reviewers should reject PRs that write only
  one. A future static-analysis test (similar to the
  `requirePermission` enumeration test) can enforce this; not in scope here.
- **Drift detection.** A nightly job to flag `userId`s with mismatched
  `CohortMembership` ↔ `Enrollment` state would close the audit's "no sync
  enforcement" finding. Deferred — not blocking.

## Alternatives considered

1. **Collapse `CohortMembership` into `Enrollment` now.** Rejected for the
   three reasons above (cardinality, regression risk, idempotency unevenness).
   This is the long-term direction but not the right step today.
2. **Make `CohortMembership` a database view over `Enrollment`.** Mongoose
   does not natively support read-only views without aggregation pipelines,
   and migrating PBA routes to aggregation pipelines is more disruptive than
   leaving the model as-is.
3. **Mirror fields between the two models.** Rejected — mirroring without a
   sync transaction creates the exact drift the audit flagged. Two models
   with disjoint responsibilities is safer than two models with overlapping
   responsibilities.

## References

- Audit P1 #5 — "Two parallel models for student-cohort linkage, no documented
  invariant"
- `apps/api/src/models/CohortMembership.ts`
- `apps/api/src/models/Enrollment.ts`
- `apps/api/src/services/enrollmentService.ts` — idempotent activation path
- `apps/api/src/__tests__/profile-delete.test.ts` — pair-on-delete coverage
