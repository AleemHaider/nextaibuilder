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
// Needed to resolve subscription metadata on the first installment invoice
// (checkout stores studentId/cohortId/paymentPlanId on the subscription, not
// on any enrollment — the enrollment is created here on first payment).
import { stripe } from '../lib/stripe.js'

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
  subscription?:   string | { id: string }
  amount_paid:     number
  currency:        string
  payment_intent?: string
  // 2025+ API (pinned apiVersion 2026-03-25.dahlia) moved subscription context
  // off the top level onto `parent.subscription_details` and per-line details.
  subscription_details?: { metadata?: Record<string, string> }
  parent?: {
    subscription_details?: {
      subscription?: string | { id: string }
      metadata?: Record<string, string>
    }
  }
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
} from '../services/enrollmentService.js'

// ── Helper: resolve the subscription id from an invoice ───────────────────
// Stripe changed the invoice shape across API versions: the subscription id
// used to be `invoice.subscription` (top-level string) and is now nested under
// `invoice.parent.subscription_details.subscription` and per-line details.
// Check every known location so the handler works regardless of shape.
function extractSubscriptionId(invoice: StripeInvoiceData): string | null {
  const unwrap = (v: unknown): string | null =>
    typeof v === 'string' ? v
    : (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string')
      ? (v as { id: string }).id
      : null

  return (
    unwrap(invoice.subscription) ??
    unwrap(invoice.parent?.subscription_details?.subscription) ??
    unwrap(invoice.lines?.data?.[0]?.subscription) ??
    null
  )
}

// ── Helper: read subscription metadata embedded on the invoice, if present ──
function extractInvoiceSubscriptionMetadata(
  invoice: StripeInvoiceData,
): Record<string, string> | undefined {
  return (
    invoice.parent?.subscription_details?.metadata ??
    invoice.subscription_details?.metadata ??
    undefined
  )
}

// ── Helper: resolve student/cohort/plan context for a subscription ─────────
// Prefers metadata embedded on the invoice; falls back to retrieving the
// subscription from Stripe. Returns null if the context can't be resolved or
// is malformed (caller then skips without burning retries on a bad event).
async function resolveSubscriptionContext(
  subscriptionId: string,
  invoice: StripeInvoiceData,
): Promise<{
  studentObjectId: Types.ObjectId
  cohortObjectId:  Types.ObjectId
  paymentPlanId:   Types.ObjectId | null
} | null> {
  let meta = extractInvoiceSubscriptionMetadata(invoice)

  if (!meta?.studentId || !meta?.cohortId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      meta = sub.metadata as Record<string, string> | undefined
    } catch (err) {
      logger.error(
        { err, subscriptionId },
        '[Stripe Worker] Failed to retrieve subscription to resolve metadata',
      )
      return null
    }
  }

  const studentId     = meta?.studentId
  const cohortId      = meta?.cohortId
  const paymentPlanId = meta?.paymentPlanId

  if (
    !studentId || !cohortId ||
    !Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(cohortId)
  ) {
    logger.warn(
      { subscriptionId, studentId, cohortId },
      '[Stripe Worker] subscription metadata missing/invalid studentId or cohortId — skipping',
    )
    return null
  }

  return {
    studentObjectId: new Types.ObjectId(studentId),
    cohortObjectId:  new Types.ObjectId(cohortId),
    paymentPlanId:   paymentPlanId && Types.ObjectId.isValid(paymentPlanId)
      ? new Types.ObjectId(paymentPlanId)
      : null,
  }
}

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

  // Validate ObjectId shape BEFORE constructing — an invalid value here throws,
  // which propagates up to processEventWithGuard's catch and burns 5 retry
  // slots on a permanently-broken event. paymentPlanId is optional so it gets
  // the same treatment but doesn't gate the whole event.
  if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(cohortId)) {
    logger.warn(
      { eventId, studentId, cohortId, paymentIntentId: pi.id },
      '[Stripe Worker] payment_intent.succeeded: malformed ObjectId in metadata — skipping (will not retry)',
    )
    return
  }
  if (paymentPlanId && !Types.ObjectId.isValid(paymentPlanId)) {
    logger.warn(
      { eventId, paymentPlanId, paymentIntentId: pi.id },
      '[Stripe Worker] payment_intent.succeeded: malformed paymentPlanId in metadata — dropping field, continuing',
    )
  }

  const studentObjectId = new Types.ObjectId(studentId)
  const cohortObjectId  = new Types.ObjectId(cohortId)
  const validPaymentPlanId = paymentPlanId && Types.ObjectId.isValid(paymentPlanId)
    ? new Types.ObjectId(paymentPlanId)
    : null

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
    paymentPlanId:    validPaymentPlanId,
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

  const subscriptionId = extractSubscriptionId(invoice)
  if (!subscriptionId) {
    // Not a subscription invoice (e.g. a one-off invoice) — nothing to do.
    logger.info(
      `[Stripe Worker] invoice.payment_succeeded: no subscription on invoice ${invoice.id} — skipping`,
    )
    return
  }

  // Resolve the enrollment for this subscription.
  let enrollment = await Enrollment.findOne({ stripeSubscriptionId: subscriptionId })

  // First installment: the checkout flow creates the Stripe subscription but
  // NO enrollment (it stores studentId/cohortId/paymentPlanId on the
  // subscription's metadata). Create the enrollment now, from that metadata,
  // and stamp the subscription id so later installments + subscription.deleted
  // resolve it. (Previously this handler bailed out here, so installment
  // buyers were charged but never enrolled.)
  const isFirstInstallment = !enrollment
  if (!enrollment) {
    const ctx = await resolveSubscriptionContext(subscriptionId, invoice)
    if (!ctx) {
      // Metadata unresolvable — throw so BullMQ retries (transient Stripe
      // errors) rather than silently dropping a paid enrollment.
      throw new Error(
        `[Stripe Worker] invoice.payment_succeeded: could not resolve subscription context for ${subscriptionId}`,
      )
    }

    const user = await User.findById(ctx.studentObjectId)
      .select('stripeCustomerId email')
      .lean()

    const { enrollment: created } = await activateEnrollment({
      studentId:        ctx.studentObjectId,
      cohortId:         ctx.cohortObjectId,
      paymentMethod:    'STRIPE',
      paymentPlanId:    ctx.paymentPlanId,
      studentEmail:     user?.email ?? null,
      idempotencyScope: eventId,
      email: {
        jobName:          'enrollment-confirmed',
        notificationType: 'ENROLLMENT_CONFIRMED',
      },
    })
    enrollment = created

    await Enrollment.findByIdAndUpdate(enrollment._id, {
      $set: {
        stripeSubscriptionId: subscriptionId,
        ...(user?.stripeCustomerId ? { stripeCustomerId: user.stripeCustomerId } : {}),
      },
    })

    // Sprint 2 Story 10 (GAP-037) — schedule installment reminders once, on the
    // first successful installment payment. JobIds are deterministic so replays
    // won't double-enqueue.
    await scheduleInstallmentReminders(
      enrollment._id as Types.ObjectId,
      new Date(),
    ).catch((err: unknown) =>
      logger.error({ err }, '[Stripe Worker] Failed to schedule installment reminders:'),
    )
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
        stripePaymentIntentId: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : undefined,
        stripeInvoiceId:       invoice.id,
        amount:                invoice.amount_paid,
        currency:              invoice.currency,
        status:                'SUCCEEDED',
        // installmentNumber is derived post-insert below; set a placeholder
        // for new inserts and recompute. Replays won't re-enter this branch.
        installmentNumber:     await deriveInstallmentNumber(enrollment._id),
        metadata: { planType: 'INSTALLMENT', subscriptionId },
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

  // Keep access active and reconcile payment status. `activateEnrollment`
  // seeds status=ACTIVE + accessGrantedAt on first-installment creation; here
  // we make sure paymentStatus reflects PARTIAL until all 3 are collected.
  // A successful payment also clears any outstanding failed-payment grace
  // deadline so the sweep won't suspend a student who caught up.
  await Enrollment.findByIdAndUpdate(enrollment._id, {
    $set: {
      paymentStatus:      allPaid ? 'PAID' : 'PARTIAL',
      status:             'ACTIVE',
      paymentGraceEndsAt: null,
    },
  })

  logger.info(
    `[Stripe Worker] invoice.payment_succeeded: installment ${installmentNumber}/3 — ` +
    `enrollment=${enrollment._id.toString()} firstInstallment=${isFirstInstallment} allPaid=${allPaid}`,
  )
}

// ── Handler: invoice.payment_failed (INSTALLMENT — grace period) ──────────
// FIR-44
async function handleInvoicePaymentFailed(
  eventId: string,
  data:     Record<string, unknown>,
): Promise<void> {
  const invoice = data as unknown as StripeInvoiceData

  const subscriptionId = extractSubscriptionId(invoice)
  if (!subscriptionId) return

  const enrollment = await Enrollment.findOne({ stripeSubscriptionId: subscriptionId })
  if (!enrollment) {
    // No enrollment yet means the very first installment failed (checkout
    // creates no enrollment up front) — there's nothing to suspend.
    logger.warn(
      `[Stripe Worker] invoice.payment_failed: no enrollment for subscription ${subscriptionId} — skipping`,
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
        metadata: { planType: 'INSTALLMENT', subscriptionId },
        idempotencyKey:  paymentIdemKey,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // Set grace period — do not immediately suspend the student. Stamp a
  // deadline so the payment-grace sweep can suspend access if the student
  // doesn't catch up (previously nothing ever suspended a non-payer).
  const gracePeriodHours = Number(process.env.GRACE_PERIOD_HOURS ?? 72)
  await Enrollment.findByIdAndUpdate(enrollment._id, {
    $set: {
      paymentStatus:      'PARTIAL',
      paymentGraceEndsAt: new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000),
    },
  })

  // ── Payment-failed email (idempotent enqueue) ──────────────────────────
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

// ── Handler: charge.refunded (dashboard refunds) ──────────────────────────
// Refunds issued from the Stripe dashboard don't flow through the app's own
// refund service, so without this the StripePayment ledger stays SUCCEEDED and
// the student keeps access. Idempotent: re-running sets the same state.
async function handleChargeRefunded(
  _eventId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const charge = data as {
    payment_intent?: string
    amount?: number
    amount_refunded?: number
    refunded?: boolean
  }
  const piId = charge.payment_intent
  if (!piId) {
    logger.info('[Stripe Worker] charge.refunded: no payment_intent on charge — skipping')
    return
  }

  const payment = await StripePayment.findOne({ stripePaymentIntentId: piId })
  if (!payment) {
    logger.warn(`[Stripe Worker] charge.refunded: no StripePayment for PI ${piId} — skipping`)
    return
  }

  if (payment.status !== 'REFUNDED') {
    payment.status = 'REFUNDED'
    await payment.save()
  }

  const fullyRefunded =
    charge.refunded === true ||
    (charge.amount != null && charge.amount_refunded != null && charge.amount_refunded >= charge.amount)

  if (fullyRefunded && payment.enrollmentId) {
    await Enrollment.findByIdAndUpdate(payment.enrollmentId, { $set: { status: 'REVOKED' } })
    logger.warn(
      `[Stripe Worker] charge.refunded: enrollment ${payment.enrollmentId.toString()} REVOKED (PI ${piId})`,
    )
  }
}

// ── Handler: charge.dispute.created (chargebacks) ─────────────────────────
// A dispute isn't final (it can be won), so suspend access rather than revoke.
async function handleChargeDisputeCreated(
  _eventId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const dispute = data as { payment_intent?: string }
  const piId = dispute.payment_intent
  if (!piId) {
    logger.info('[Stripe Worker] charge.dispute.created: no payment_intent — skipping')
    return
  }

  const payment = await StripePayment.findOne({ stripePaymentIntentId: piId })
  if (!payment) {
    logger.warn(`[Stripe Worker] charge.dispute.created: no StripePayment for PI ${piId} — skipping`)
    return
  }

  if (payment.enrollmentId) {
    await Enrollment.findByIdAndUpdate(payment.enrollmentId, {
      $set: { status: 'SUSPENDED', paymentStatus: 'FAILED' },
    })
    logger.warn(
      `[Stripe Worker] charge.dispute.created: enrollment ${payment.enrollmentId.toString()} SUSPENDED pending dispute (PI ${piId})`,
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

      case 'charge.refunded':
        await handleChargeRefunded(eventId, data)
        break

      case 'charge.dispute.created':
        await handleChargeDisputeCreated(eventId, data)
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
  handleChargeRefunded,
  handleChargeDisputeCreated,
  idemKey,
  // Sprint 2 Story 10 (GAP-036) — upstream idempotency guard
  processEventWithGuard,
}
