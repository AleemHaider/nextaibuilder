// FIR-43 — Stripe webhook event processor (ONE_TIME payment flows)
// FIR-44 — Stripe webhook event processor (INSTALLMENT subscription flows)
//
// Consumes 'stripe-webhook-queue'. Each job carries:
//   { eventId, eventType, data } — the raw Stripe event data.object
//
// Event handlers:
//   payment_intent.succeeded     → ONE_TIME enrollment activation
//   invoice.payment_succeeded    → INSTALLMENT per-payment tracking
//   invoice.payment_failed       → INSTALLMENT grace period handling
//   customer.subscription.deleted → subscription lifecycle close
//
// FIR Wave 2 Story K — Idempotency keys on side-effect models.
//   BullMQ dedupes the initial enqueue via `jobId: event.id`, but a worker
//   crash mid-process can trigger a retry that re-executes side effects.
//   Each side effect is now gated on a deterministic idempotencyKey of the
//   form `{eventId}:{operation}`. The unique sparse index on each model
//   (Enrollment, StripePayment, SlackInvite, EmailLog) makes every replay
//   a no-op at the storage layer.

import { Worker } from 'bullmq'
import { bullMQConnection } from '../lib/redis.js'
import { Enrollment } from '../models/Enrollment.js'
import { StripePayment } from '../models/StripePayment.js'
import { User } from '../models/User.js'
// Sprint 2 Story 10 (GAP-036) — upstream idempotency guard
import { ProcessedStripeEvent } from '../models/ProcessedStripeEvent.js'
// Sprint 2 Story 10 (GAP-037) — installment reminder scheduling
import { scheduleInstallmentReminders } from './installmentReminderWorker.js'
import { Types } from 'mongoose'
import type { StripeWebhookJobData } from '../routes/webhook-stripe.js'
import { logger } from '../lib/logger.js'
// Service-layer extraction: Enrollment + Slack + welcome-email side effects.
import { activateEnrollment } from '../services/enrollmentService.js'

// ── Idempotency-key helpers ───────────────────────────────────────────────
// Key format: `{stripeEventId}:{operation}` — deterministic + human-readable,
// so operators grepping Mongo can trace a replay back to the Stripe event.
const idemKey = (eventId: string, op: string) => `${eventId}:${op}`

// ── Type definitions for Stripe event data shapes ─────────────────────────

interface StripePaymentIntentData {
  id:       string
  amount:   number
  currency: string
  metadata: {
    cohortId?:      string
    paymentPlanId?: string
    studentId?:     string
    planType?:      string
  }
}

interface StripeInvoiceData {
  id:              string
  subscription?:   string
  amount_paid:     number
  currency:        string
  payment_intent?: string
  // Stripe sends 'lines.data[0].period' for invoice line item details
  lines?: {
    data: Array<{
      metadata?: Record<string, string>
      subscription?: string
    }>
  }
  metadata?: Record<string, string>
}

interface StripeSubscriptionData {
  id:       string
  status:   string
  metadata: Record<string, string>
}

// ── Helper: derive installment number from paid invoice count ────────────
// We count existing StripePayment records for this enrollment to determine
// which installment number this invoice represents (1-based).
async function deriveInstallmentNumber(enrollmentId: Types.ObjectId): Promise<number> {
  const count = await StripePayment.countDocuments({
    enrollmentId,
    status: 'SUCCEEDED',
  })
  // Next installment = existing paid count + 1, capped at 3
  return Math.min(count + 1, 3)
}

// Idempotency-keyed helpers moved to ../services/enrollmentService.
import {
  enqueueEmailWithIdempotency,
  enqueueSlackInviteWithIdempotency,
} from '../services/enrollmentService.js'

// ── Handler: payment_intent.succeeded (ONE_TIME) ──────────────────────────
// FIR-43
async function handlePaymentIntentSucceeded(
  eventId: string,
  data:     Record<string, unknown>,
): Promise<void> {
  const pi = data as unknown as StripePaymentIntentData
  const { cohortId, paymentPlanId, studentId, planType } = pi.metadata ?? {}

  if (planType !== 'ONE_TIME') {
    // invoice.payment_succeeded covers INSTALLMENT first payments — skip here
    logger.info(`[Stripe Worker] payment_intent.succeeded: planType=${planType ?? 'unknown'} — skipping (not ONE_TIME)`)
    return
  }

  if (!cohortId || !studentId) {
    logger.warn(`[Stripe Worker] payment_intent.succeeded: missing metadata on PI ${pi.id} — skipping`)
    return
  }

  const studentObjectId = new Types.ObjectId(studentId)
  const cohortObjectId  = new Types.ObjectId(cohortId)

  // Fetch user once — stripeCustomerId is copied onto the enrollment, and
  // email is needed for the Slack-invite step inside the service.
  const user = await User.findById(studentObjectId).select('stripeCustomerId email').lean()

  // ── Enrollment + Slack invite + welcome email (service-layer extraction)
  // Idempotency scope = `${eventId}` so every replay deterministically
  // produces the same set of sub-keys (`:create-enrollment`, `:slack-invite`,
  // `:welcome-email`) and lands on the same upsert no-ops.
  const { enrollment } = await activateEnrollment({
    studentId:        studentObjectId,
    cohortId:         cohortObjectId,
    paymentMethod:    'STRIPE',
    paymentPlanId:    paymentPlanId ? new Types.ObjectId(paymentPlanId) : null,
    studentEmail:     user?.email ?? null,
    idempotencyScope: eventId,
    email: {
      jobName:          'enrollment-confirmed',
      notificationType: 'ENROLLMENT_CONFIRMED',
    },
  })

  // ── StripePayment ledger row (Stripe-specific, stays in the worker) ────
  // Replay-safe: atomic upsert keyed on idempotencyKey. The existing
  // stripeEventId unique index also guards against duplicates at the DB
  // level, but the idempotencyKey gives us per-operation granularity.
  const paymentIdemKey = idemKey(eventId, 'create-stripe-payment')
  await StripePayment.findOneAndUpdate(
    { idempotencyKey: paymentIdemKey },
    {
      $setOnInsert: {
        enrollmentId:          enrollment._id,
        studentId:             studentObjectId,
        stripeEventId:         eventId,
        stripePaymentIntentId: pi.id,
        amount:                pi.amount,
        currency:              pi.currency,
        status:                'SUCCEEDED',
        metadata:              { planType: 'ONE_TIME', cohortId, paymentPlanId },
        idempotencyKey:        paymentIdemKey,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // Copy stripeCustomerId onto the enrollment for fast lookups later.
  if (user?.stripeCustomerId) {
    await Enrollment.findByIdAndUpdate(enrollment._id, { stripeCustomerId: user.stripeCustomerId })
  }

  logger.info(
    `[Stripe Worker] payment_intent.succeeded: enrollment activated — student=${studentId} cohort=${cohortId} enrollment=${enrollment._id.toString()}`,
  )
}

// ── Handler: invoice.payment_succeeded (INSTALLMENT) ─────────────────────
// FIR-44
async function handleInvoicePaymentSucceeded(
  eventId: string,
  data:     Record<string, unknown>,
): Promise<void> {
  const invoice = data as unknown as StripeInvoiceData

  if (!invoice.subscription) {
    // Not a subscription invoice — skip (could be a one-time invoice)
    return
  }

  // Resolve enrollment by stripeSubscriptionId.
  let enrollment = await Enrollment.findOne({ stripeSubscriptionId: invoice.subscription })

  if (!enrollment) {
    logger.warn(
      `[Stripe Worker] invoice.payment_succeeded: no enrollment found for subscription ${invoice.subscription}` +
      ` — skipping (enrollment will be activated via payment_intent.succeeded)`,
    )
    return
  }

  // Stamp the subscriptionId on enrollment if not already set (first payment scenario)
  if (!enrollment.stripeSubscriptionId) {
    enrollment = await Enrollment.findByIdAndUpdate(
      enrollment._id,
      { $set: { stripeSubscriptionId: invoice.subscription } },
      { new: true },
    )
    if (!enrollment) return
  }

  // ── StripePayment ledger row (replay-safe upsert) ──────────────────────
  const paymentIdemKey = idemKey(eventId, 'create-stripe-payment')
  const paymentDoc = await StripePayment.findOneAndUpdate(
    { idempotencyKey: paymentIdemKey },
    {
      $setOnInsert: {
        enrollmentId:          enrollment._id,
        studentId:             enrollment.studentId,
        stripeEventId:         eventId,
        stripePaymentIntentId: invoice.payment_intent ?? undefined,
        stripeInvoiceId:       invoice.id,
        amount:                invoice.amount_paid,
        currency:              invoice.currency,
        status:                'SUCCEEDED',
        // installmentNumber is derived post-insert below; set a placeholder
        // for new inserts and recompute. Replays won't re-enter this branch.
        installmentNumber:     await deriveInstallmentNumber(enrollment._id),
        metadata: { planType: 'INSTALLMENT', subscriptionId: invoice.subscription },
        idempotencyKey:        paymentIdemKey,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const installmentNumber = paymentDoc.installmentNumber ?? 1

  // Count how many installments are now SUCCEEDED
  const paidCount = await StripePayment.countDocuments({
    enrollmentId: enrollment._id,
    status:       'SUCCEEDED',
  })
  const allPaid = paidCount >= 3

  // Build update payload
  const enrollmentUpdate: Record<string, unknown> = {
    paymentStatus: allPaid ? 'PAID' : 'PARTIAL',
  }

  // Grant access on first installment payment
  if (installmentNumber === 1) {
    enrollmentUpdate['status']          = 'ACTIVE'
    enrollmentUpdate['accessGrantedAt'] = new Date()
  }

  await Enrollment.findByIdAndUpdate(enrollment._id, { $set: enrollmentUpdate })

  // Send enrollment confirmation email + Slack invite on first installment
  if (installmentNumber === 1) {
    await enqueueEmailWithIdempotency(
      enrollment.studentId,
      'WELCOME',
      idemKey(eventId, 'send-welcome-email'),
      'enrollment-confirmed',
      {
        type:      'ENROLLMENT_CONFIRMED',
        studentId: enrollment.studentId.toString(),
        cohortId:  enrollment.cohortId.toString(),
      },
    )

    const user = await User.findById(enrollment.studentId).select('email').lean()
    if (user?.email) {
      await enqueueSlackInviteWithIdempotency(
        enrollment.studentId,
        enrollment._id as Types.ObjectId,
        user.email,
        idemKey(eventId, 'slack-invite'),
      )
    }

    // Sprint 2 Story 10 (GAP-037) — schedule installment reminders on first
    // successful installment payment. JobIds are deterministic so replays
    // won't double-enqueue.
    await scheduleInstallmentReminders(
      enrollment._id as Types.ObjectId,
      new Date(),
    ).catch((err: unknown) =>
      logger.error({ err: err }, '[Stripe Worker] Failed to schedule installment reminders:'),
    )
  }

  logger.info(
    `[Stripe Worker] invoice.payment_succeeded: installment ${installmentNumber}/3 — enrollment=${enrollment._id.toString()} allPaid=${allPaid}`,
  )
}

// ── Handler: invoice.payment_failed (INSTALLMENT — grace period) ──────────
// FIR-44
async function handleInvoicePaymentFailed(
  eventId: string,
  data:     Record<string, unknown>,
): Promise<void> {
  const invoice = data as unknown as StripeInvoiceData

  if (!invoice.subscription) return

  const enrollment = await Enrollment.findOne({ stripeSubscriptionId: invoice.subscription })
  if (!enrollment) {
    logger.warn(
      `[Stripe Worker] invoice.payment_failed: no enrollment for subscription ${invoice.subscription}`,
    )
    return
  }

  // Derive which installment failed (next unpaid one)
  const installmentNumber = await deriveInstallmentNumber(enrollment._id)

  // ── StripePayment ledger row — FAILED (replay-safe upsert) ─────────────
  const paymentIdemKey = idemKey(eventId, 'create-stripe-payment-failed')
  await StripePayment.findOneAndUpdate(
    { idempotencyKey: paymentIdemKey },
    {
      $setOnInsert: {
        enrollmentId:    enrollment._id,
        studentId:       enrollment.studentId,
        stripeEventId:   eventId,
        stripeInvoiceId: invoice.id,
        amount:          invoice.amount_paid,
        currency:        invoice.currency,
        status:          'FAILED',
        installmentNumber,
        metadata: { planType: 'INSTALLMENT', subscriptionId: invoice.subscription },
        idempotencyKey:  paymentIdemKey,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // Set grace period — do not immediately suspend the student
  await Enrollment.findByIdAndUpdate(enrollment._id, {
    $set: { paymentStatus: 'PARTIAL' },
  })

  // ── Payment-failed email (idempotent enqueue) ──────────────────────────
  const gracePeriodHours = Number(process.env.GRACE_PERIOD_HOURS ?? 72)
  await enqueueEmailWithIdempotency(
    enrollment.studentId,
    'URGENCY_REMINDER',
    idemKey(eventId, 'send-payment-failed-email'),
    'payment-failed',
    {
      type:             'PAYMENT_FAILED',
      studentId:        enrollment.studentId.toString(),
      cohortId:         enrollment.cohortId.toString(),
      gracePeriodHours,
    },
  )

  logger.warn(
    `[Stripe Worker] invoice.payment_failed: installment ${installmentNumber} failed — enrollment=${enrollment._id.toString()} grace=${gracePeriodHours}h`,
  )
}

// ── Handler: customer.subscription.deleted ────────────────────────────────
// FIR-44
async function handleSubscriptionDeleted(
  data: Record<string, unknown>,
): Promise<void> {
  const sub = data as unknown as StripeSubscriptionData

  const enrollment = await Enrollment.findOne({ stripeSubscriptionId: sub.id })
  if (!enrollment) {
    logger.info(`[Stripe Worker] customer.subscription.deleted: no enrollment for subscription ${sub.id}`)
    return
  }

  // Check how many installments were successfully paid
  const paidCount = await StripePayment.countDocuments({
    enrollmentId: enrollment._id,
    status:       'SUCCEEDED',
  })

  if (paidCount >= 3) {
    // All 3 installments paid — subscription naturally expired. Enrollment stays ACTIVE.
    logger.info(
      `[Stripe Worker] customer.subscription.deleted: all 3 installments paid — enrollment stays ACTIVE (sub=${sub.id})`,
    )
  } else {
    // Subscription cancelled before completion — suspend access.
    // $set is naturally idempotent (same target state on replay).
    await Enrollment.findByIdAndUpdate(enrollment._id, {
      $set: { status: 'SUSPENDED', paymentStatus: 'PARTIAL' },
    })
    logger.warn(
      `[Stripe Worker] customer.subscription.deleted: only ${paidCount}/3 paid — enrollment SUSPENDED (sub=${sub.id})`,
    )
  }
}

// ── Sprint 2 Story 10 (GAP-036) — upstream idempotency guard ─────────────
// Check ProcessedStripeEvent FIRST. If the event already has a SUCCESS row,
// return immediately — BullMQ considers this a success and no side effects
// re-run. On exception, record with FAILED so operators can inspect, and
// re-throw so BullMQ's retry-with-backoff logic still fires.
async function processEventWithGuard(
  eventId:   string,
  eventType: string,
  data:      Record<string, unknown>,
  jobId:     string | undefined,
): Promise<void> {
  // ── Step 1: upstream dedup check ──────────────────────────────────────
  const existing = await ProcessedStripeEvent.findOne({ stripeEventId: eventId }).lean()
  if (existing && existing.outcome === 'SUCCESS') {
    logger.info(
      `[Stripe Worker] Job ${jobId} SKIP — eventId=${eventId} already processed at ${
        existing.processedAt instanceof Date
          ? existing.processedAt.toISOString()
          : String(existing.processedAt)
      }`,
    )
    return
  }

  try {
    switch (eventType) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(eventId, data)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(eventId, data)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(eventId, data)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(data)
        break

      default:
        // Log and discard unhandled event types gracefully. We still record a
        // SUCCESS row so Stripe retries of the same event short-circuit.
        logger.info(`[Stripe Worker] Unhandled event type: ${eventType} — skipping`)
    }

    // ── Step 2: record SUCCESS ──────────────────────────────────────────
    // Upsert-on-conflict via findOneAndUpdate handles the race where two
    // workers see a missing row simultaneously — the second upsert flips the
    // existing FAILED row to SUCCESS.
    await ProcessedStripeEvent.findOneAndUpdate(
      { stripeEventId: eventId },
      {
        $set: {
          outcome:     'SUCCESS',
          processedAt: new Date(),
          eventType,
        },
        $setOnInsert: { stripeEventId: eventId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    logger.info(`[Stripe Worker] Job ${jobId} DONE — eventId=${eventId} type=${eventType}`)
  } catch (err) {
    // Record the failure so operators have a trail. We use an upsert so
    // repeated failures don't explode with duplicate-key errors. BullMQ
    // still sees the throw and retries per the configured policy.
    try {
      await ProcessedStripeEvent.findOneAndUpdate(
        { stripeEventId: eventId },
        {
          $set: {
            outcome:     'FAILED',
            processedAt: new Date(),
            eventType,
          },
          $setOnInsert: { stripeEventId: eventId },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    } catch (recordErr) {
      // Swallow record-failure errors so we don't mask the original cause.
      logger.error(
        { err: recordErr, eventId },
        '[Stripe Worker] Failed to record FAILED ProcessedStripeEvent',
      )
    }

    logger.error(
      { err, jobId, eventId, eventType },
      '[Stripe Worker] Job FAILED',
    )
    throw err
  }
}

// ── Worker bootstrap ───────────────────────────────────────────────────────
export function startStripeWebhookWorker() {
  // Startup connectivity check
  logger.info('[Stripe Worker] Starting...')

  const hasWebhookSecret = !!(process.env.STRIPE_WEBHOOK_SECRET?.trim())
  const hasStripeKey     = !!(process.env.STRIPE_SECRET_KEY?.trim())

  if (!hasStripeKey)     logger.warn('[Stripe Worker] STRIPE_SECRET_KEY not set — Stripe API calls will fail')
  if (!hasWebhookSecret) logger.warn('[Stripe Worker] STRIPE_WEBHOOK_SECRET not set — webhook verification will fail')

  const worker = new Worker<StripeWebhookJobData>(
    'stripe-webhook-queue',
    async (job) => {
      const { eventId, eventType, data } = job.data

      logger.info(`[Stripe Worker] Job ${job.id} START — eventId=${eventId} type=${eventType}`)

      // Sprint 2 Story 10 (GAP-036) — upstream idempotency guard.
      // Short-circuit before invoking handlers if we've already successfully
      // processed this event. FAILED rows fall through so BullMQ's retry
      // logic (3x exponential) can have another go.
      await processEventWithGuard(eventId, eventType, data, job.id)
    },
    {
      connection:  bullMQConnection,
      concurrency: 5,
      settings: {
        backoffStrategy: (attemptsMade: number) => attemptsMade * 3000,
      },
    },
  )

  // Surface terminal failures for operational visibility
  worker.on('failed', (job, err) => {
    if (!job) return
    logger.error(
      { err, jobId: job.id, eventId: job.data.eventId, eventType: job.data.eventType },
      '[Stripe Worker] Job exhausted retries',
    )
  })

  logger.info('[Stripe Worker] Started — concurrency=5 listening on stripe-webhook-queue')
  return worker
}

// ── Internal exports for tests ────────────────────────────────────────────
// FIR Wave 2 Story K — exposed so the idempotency smoke test can invoke
// handlers directly without a running Redis/BullMQ connection.
export const __testables = {
  handlePaymentIntentSucceeded,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  idemKey,
  // Sprint 2 Story 10 (GAP-036) — upstream idempotency guard
  processEventWithGuard,
}
