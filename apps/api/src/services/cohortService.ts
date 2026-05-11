// Cohort service — lifecycle transitions extracted from
// routes/admin/courses.ts PATCH /:id/publish.
//
// Centralises the invariants the audit flagged as "scattered string
// comparisons, not explicit FSMs" (architecture audit P1 #7). A cohort
// can be published only when it has:
//   • at least one published Module (covers "publishing requires ≥N modules")
//   • at least one active PaymentPlan (you can't sell a cohort with no price)
//
// Unpublishing has no invariants — operators can always retract a cohort
// from the storefront. Existing enrollments are intentionally unaffected
// (already-purchased students keep their LMS access).
//
// The service returns a discriminated result the caller maps to HTTP, the
// same pattern used by paymentService.

import { Types } from 'mongoose'
import { Cohort } from '../models/Cohort.js'
import { Module } from '../models/Module.js'
import { PaymentPlan } from '../models/PaymentPlan.js'

// ── Inputs / outputs ──────────────────────────────────────────────────────

export type CohortLifecycleFailureCode =
  | 'INVALID_ID'        // 400
  | 'NOT_FOUND'         // 404
  | 'CANNOT_PUBLISH'    // 422 — invariant violation

export type CohortLifecycleResult =
  | { ok: true;  cohort: { id: string; isPublished: boolean } }
  | { ok: false; code: CohortLifecycleFailureCode; message: string }

export const COHORT_LIFECYCLE_FAILURE_STATUS: Record<CohortLifecycleFailureCode, number> = {
  INVALID_ID:     400,
  NOT_FOUND:      404,
  CANNOT_PUBLISH: 422,
}

// ── Publish guards ────────────────────────────────────────────────────────

interface PublishabilityCheck {
  ok: true
}
interface PublishabilityFail {
  ok: false
  message: string
}

/**
 * Lightweight surface that lets callers check publishability without actually
 * mutating the cohort — useful for surfacing "can't publish yet because…"
 * hints on the admin UI before the operator clicks Publish.
 */
export async function checkCohortPublishable(
  cohortId: string,
): Promise<PublishabilityCheck | PublishabilityFail> {
  if (!Types.ObjectId.isValid(cohortId)) {
    return { ok: false, message: 'Invalid cohort ID.' }
  }

  const [publishedModuleCount, activePlanCount] = await Promise.all([
    Module.countDocuments({ cohortId, isPublished: true }),
    PaymentPlan.countDocuments({ cohortId, isActive: true }),
  ])

  if (publishedModuleCount === 0) {
    return { ok: false, message: 'Cannot publish a course with no published modules.' }
  }
  if (activePlanCount === 0) {
    return { ok: false, message: 'Cannot publish a course with no active payment plans.' }
  }
  return { ok: true }
}

// ── Public entrypoints ────────────────────────────────────────────────────

/**
 * Toggle a cohort's `isPublished` flag. When publishing, enforces the two
 * invariants (≥1 published module, ≥1 active payment plan) up front and
 * surfaces a precise reason if either fails. Unpublishing skips both
 * checks — operators can always retract a cohort from the storefront.
 */
export async function setCohortPublished(
  cohortId: string,
  isPublished: boolean,
): Promise<CohortLifecycleResult> {
  if (!Types.ObjectId.isValid(cohortId)) {
    return { ok: false, code: 'INVALID_ID', message: 'Invalid cohort ID.' }
  }

  if (isPublished) {
    const checked = await checkCohortPublishable(cohortId)
    if (!checked.ok) {
      return { ok: false, code: 'CANNOT_PUBLISH', message: checked.message }
    }
  }

  const cohort = await Cohort.findByIdAndUpdate(
    cohortId,
    { $set: { isPublished } },
    { new: true },
  ).lean({ virtuals: true })

  if (!cohort) {
    return { ok: false, code: 'NOT_FOUND', message: 'Course not found.' }
  }

  return {
    ok: true,
    cohort: {
      id:          (cohort as { _id: { toString(): string } })._id.toString(),
      isPublished: (cohort as { isPublished: boolean }).isPublished,
    },
  }
}
