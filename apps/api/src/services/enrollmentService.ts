// Enrollment activation service.
//
// Centralises the "activate this enrollment" side-effect chain that was
// previously duplicated across:
//   • workers/stripeWebhookWorker.handlePaymentIntentSucceeded  (FIR-43)
//   • routes/admin/manual-payments.ts POST /:id/approve         (FIR-48)
//
// The chain has four steps:
//   1. Upsert the Enrollment record (status=ACTIVE, paymentStatus=PAID).
//   2. Enqueue a Slack-workspace invite (if we have an email to invite).
//   3. Enqueue a notification email (welcome / approval / etc.).
//   4. Return the (possibly upserted) enrollment to the caller.
//
// Idempotency: every downstream effect is guarded by an `idempotencyScope`
// the caller provides (a Stripe event.id, a manual-payment-request id, etc.).
// Replays of the same scope re-execute the upsert as a no-op and skip the
// queue enqueues entirely — matches the existing Stripe-path behaviour and
// fixes the prior gap where manual-payment approval re-clicks could create
// duplicate Slack invites + emails.

import { Queue } from 'bullmq'
import { Types, type HydratedDocument } from 'mongoose'
import { bullMQConnection } from '../lib/redis.js'
import { Enrollment, type IEnrollment } from '../models/Enrollment.js'
import { CohortMembership } from '../models/CohortMembership.js'
import { SlackInvite } from '../models/SlackInvite.js'
import { EmailLog } from '../models/EmailLog.js'
import { logger } from '../lib/logger.js'

// ── Queues ────────────────────────────────────────────────────────────────
// Singletons local to this service so callers don't each instantiate their
// own. BullMQ deduplicates client connections under the hood.

const slackInviteQueue = new Queue('slack-invite-queue', {
  connection: bullMQConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

const emailNotificationsQueue = new Queue('email-notifications', {
  connection: bullMQConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

// ── Inputs / outputs ──────────────────────────────────────────────────────

export interface ActivateEnrollmentInput {
  studentId:     Types.ObjectId
  cohortId:      Types.ObjectId
  paymentMethod: 'STRIPE' | 'PADDLE' | 'MANUAL_RECEIPT' | 'COUPON'
  /**
   * Payment status stamped on the enrollment. Defaults to 'PAID'.
   * Coupon-based (free) enrollments pass 'WAIVED'.
   */
  paymentStatus?: 'PAID' | 'WAIVED'
  paymentPlanId?: Types.ObjectId | null
  enrolledBy?:    Types.ObjectId | null
  /** The student's email. If null/undefined, the Slack invite step is skipped. */
  studentEmail:  string | null
  /**
   * Per-activation scope used to derive idempotency sub-keys for the slack
   * invite, the welcome email, and the enrollment-insert path. Two callers
   * with the same scope produce exactly one set of side effects.
   *
   * Stripe path:  `${event.id}` (e.g. `evt_1Nq…`)
   * Manual path:  `manual-payment-request:${request._id}`
   */
  idempotencyScope: string
  email: {
    /** BullMQ job name on email-notifications queue. */
    jobName: string
    /** Discriminator forwarded to notificationWorker. */
    notificationType: string
    /** Extra body fields passed verbatim to the job. */
    extra?: Record<string, unknown>
  }
}

export interface ActivateEnrollmentResult {
  enrollment: HydratedDocument<IEnrollment>
}

// ── Internal helpers ──────────────────────────────────────────────────────

/**
 * Replay-safe EmailLog upsert + queue enqueue. Creates a PENDING EmailLog
 * keyed by idempotencyKey; on duplicate key (replay) skips the enqueue.
 *
 * Exported so the Stripe worker's secondary handlers (invoice.payment_*,
 * subscription.deleted) can reuse it without re-implementing idempotency.
 */
export async function enqueueEmailWithIdempotency(
  userId: Types.ObjectId,
  emailType: 'WELCOME' | 'BROADCAST' | 'NUDGE' | 'URGENCY_REMINDER' | 'CHECK_IN' | 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'STEP_APPROVED' | 'STEP_REJECTED',
  idempotencyKey: string,
  jobName: string,
  jobData: Record<string, unknown>,
): Promise<void> {
  const existing = await EmailLog.findOne({ idempotencyKey }).lean()
  if (existing) {
    logger.info(`[EnrollmentService] EmailLog already exists for key=${idempotencyKey} — skipping enqueue`)
    return
  }

  try {
    await EmailLog.create({
      userId,
      emailType,
      status: 'PENDING',
      sentAt: null,
      idempotencyKey,
    })
  } catch (err: unknown) {
    const code = (err as { code?: number } | null)?.code
    if (code === 11000) {
      logger.info(`[EnrollmentService] EmailLog race on key=${idempotencyKey} — another process won, skipping`)
      return
    }
    throw err
  }

  await emailNotificationsQueue
    .add(jobName, { ...jobData, idempotencyKey })
    .catch((err: unknown) =>
      logger.error({ err, jobName }, '[EnrollmentService] Failed to enqueue email job'),
    )
}

/**
 * Replay-safe SlackInvite upsert + queue enqueue. Two-step pattern:
 *   1. Upsert the SlackInvite by idempotencyKey (status='PENDING').
 *   2. If doc already has status='SENT' → external call already done, skip.
 *      Otherwise enqueue. The slackInviteWorker flips status to SENT/FAILED.
 */
export async function enqueueSlackInviteWithIdempotency(
  studentId: Types.ObjectId,
  enrollmentId: Types.ObjectId,
  email: string,
  idempotencyKey: string,
): Promise<void> {
  const invite = await SlackInvite.findOneAndUpdate(
    { idempotencyKey },
    {
      $setOnInsert: {
        studentId,
        enrollmentId,
        email,
        status:        'PENDING',
        attempts:      0,
        idempotencyKey,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  if (invite.status === 'SENT') {
    logger.info(`[EnrollmentService] SlackInvite for key=${idempotencyKey} already SENT — skipping`)
    return
  }

  slackInviteQueue
    .add('invite-to-slack', {
      enrollmentId:  enrollmentId.toString(),
      userId:        studentId.toString(),
      slackInviteId: invite._id.toString(),
      email,
    })
    .catch((err: unknown) =>
      logger.error({ err }, '[EnrollmentService] Failed to enqueue slack-invite-queue job'),
    )
}

// ── Public entrypoint ─────────────────────────────────────────────────────

/**
 * Activate (or re-activate) an enrollment and fan out the standard
 * post-activation side effects: Slack workspace invite + notification email.
 *
 * All downstream effects are gated on `input.idempotencyScope` so replays
 * (Stripe webhook retry, double-click on Approve) produce exactly one set
 * of artifacts. The Enrollment upsert itself is idempotent on the
 * (studentId, cohortId) tuple.
 */
export async function activateEnrollment(
  input: ActivateEnrollmentInput,
): Promise<ActivateEnrollmentResult> {
  const enrollmentIdemKey = `${input.idempotencyScope}:create-enrollment`

  const enrollment = await Enrollment.findOneAndUpdate(
    { studentId: input.studentId, cohortId: input.cohortId },
    {
      $set: {
        paymentStatus:   input.paymentStatus ?? 'PAID',
        status:          'ACTIVE',
        accessGrantedAt: new Date(),
        paymentMethod:   input.paymentMethod,
        ...(input.paymentPlanId ? { paymentPlanId: input.paymentPlanId } : {}),
        ...(input.enrolledBy ? { enrolledBy: input.enrolledBy } : {}),
      },
      $setOnInsert: {
        studentId:            input.studentId,
        cohortId:             input.cohortId,
        lessonsCompleted:     0,
        completionPercentage: 0,
        idempotencyKey:       enrollmentIdemKey,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ) as HydratedDocument<IEnrollment>

  // Keep the legacy CohortMembership in sync — the student dashboard
  // (/api/student/dashboard) and the Setup Companion resolve the student's
  // cohort through CohortMembership, not Enrollment. Without this, a student
  // enrolled via Stripe / manual payment / coupon stays stuck on the
  // "cohort assignment coming soon" screen forever. userId is unique on the
  // collection (one membership per student), so an existing membership is
  // repointed at the newly activated cohort. Non-fatal: activation must not
  // fail because the legacy mirror couldn't be written.
  try {
    await CohortMembership.findOneAndUpdate(
      { userId: input.studentId },
      {
        $set:         { cohortId: input.cohortId },
        $setOnInsert: { userId: input.studentId },
      },
      { upsert: true, setDefaultsOnInsert: true },
    )
  } catch (err: unknown) {
    logger.error({ err }, '[EnrollmentService] Failed to upsert CohortMembership mirror')
  }

  if (input.studentEmail) {
    await enqueueSlackInviteWithIdempotency(
      input.studentId,
      enrollment._id as Types.ObjectId,
      input.studentEmail,
      `${input.idempotencyScope}:slack-invite`,
    )
  }

  await enqueueEmailWithIdempotency(
    input.studentId,
    'WELCOME',
    // Matches the historical Stripe-worker key suffix so existing
    // idempotency tests + already-issued EmailLog rows stay deterministic.
    `${input.idempotencyScope}:send-welcome-email`,
    input.email.jobName,
    {
      type:      input.email.notificationType,
      studentId: input.studentId.toString(),
      cohortId:  input.cohortId.toString(),
      ...(input.email.extra ?? {}),
    },
  )

  return { enrollment }
}

// Exported for unit tests — lets specs assert internal behaviour without
// going through the public surface.
export const __testables = {
  enqueueEmailWithIdempotency,
  enqueueSlackInviteWithIdempotency,
}
