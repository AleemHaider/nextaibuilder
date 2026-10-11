// Paddle webhook receiver — POST /api/v1/webhook/paddle
//
// Security model (same shape as webhook-stripe.ts):
//   - No JWT auth — Paddle signs every request (Paddle-Signature header, HMAC
//     over `${ts}:${rawBody}` with the destination's endpoint secret).
//   - The raw body is captured by a plugin-scoped content-type parser; the
//     SDK's unmarshal() verifies the signature + 5s timestamp tolerance.
//   - Handlers are idempotent: PaddlePayment.paddleEventId is unique and
//     activateEnrollment() uses the event id as its idempotency scope, so a
//     Paddle retry re-running the handler is a no-op.
//   - Processed inline (no queue). Paddle expects a 2xx within 5s and retries
//     on failure, and activation is a couple of Mongo writes + queue enqueues.

import type { FastifyInstance } from 'fastify'
import { Types } from 'mongoose'
import { EventName, type EventEntity } from '@paddle/paddle-node-sdk'
import type { TransactionCompletedEvent, TransactionPaymentFailedEvent } from '@paddle/paddle-node-sdk'
import { paddleWebhookVerifier } from '../lib/paddle.js'
import { PaddlePayment } from '../models/PaddlePayment.js'
import { Enrollment } from '../models/Enrollment.js'
import { User } from '../models/User.js'
import { activateEnrollment } from '../services/enrollmentService.js'

export const PADDLE_WEBHOOK_EVENT_ALLOWLIST = new Set<string>([
  EventName.TransactionCompleted,
  EventName.TransactionPaymentFailed,
])

interface EnrollmentCustomData {
  studentId?: string
  cohortId?: string
  paymentPlanId?: string
  planType?: string
}

function readCustomData(raw: unknown): EnrollmentCustomData {
  if (!raw || typeof raw !== 'object') return {}
  const cd = raw as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  return {
    studentId:     str(cd.studentId),
    cohortId:      str(cd.cohortId),
    paymentPlanId: str(cd.paymentPlanId),
    planType:      str(cd.planType),
  }
}

// ── transaction.completed ──────────────────────────────────────────────────
export async function handleTransactionCompleted(
  event: TransactionCompletedEvent,
  log: FastifyInstance['log'],
): Promise<void> {
  const txn = event.data
  const { studentId, cohortId, paymentPlanId, planType } = readCustomData(txn.customData)

  if (!studentId || !cohortId) {
    log.warn({ eventId: event.eventId, txn: txn.id }, '[Paddle] transaction.completed without studentId/cohortId custom_data — skipping')
    return
  }
  if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(cohortId)) {
    log.warn({ eventId: event.eventId, studentId, cohortId }, '[Paddle] malformed ObjectId in custom_data — skipping')
    return
  }
  const studentObjectId = new Types.ObjectId(studentId)
  const cohortObjectId  = new Types.ObjectId(cohortId)
  const planObjectId    = paymentPlanId && Types.ObjectId.isValid(paymentPlanId)
    ? new Types.ObjectId(paymentPlanId)
    : null

  const user = await User.findById(studentObjectId).select('email paddleCustomerId').lean()

  const { enrollment } = await activateEnrollment({
    studentId:        studentObjectId,
    cohortId:         cohortObjectId,
    paymentMethod:    'PADDLE',
    paymentPlanId:    planObjectId,
    studentEmail:     user?.email ?? null,
    idempotencyScope: event.eventId,
    email: {
      jobName:          'enrollment-confirmed',
      notificationType: 'ENROLLMENT_CONFIRMED',
    },
  })

  const grandTotal = txn.details?.totals?.grandTotal ?? txn.details?.totals?.total ?? '0'

  await PaddlePayment.findOneAndUpdate(
    { paddleEventId: event.eventId },
    {
      $setOnInsert: {
        enrollmentId:        enrollment._id,
        studentId:           studentObjectId,
        cohortId:            cohortObjectId,
        paymentPlanId:       planObjectId,
        paddleEventId:       event.eventId,
        paddleTransactionId: txn.id,
        paddleCustomerId:    txn.customerId ?? null,
        amount:              Number.parseInt(String(grandTotal), 10) || 0,
        currency:            String(txn.currencyCode ?? 'USD').toLowerCase(),
        status:              'SUCCEEDED',
        metadata:            { planType: planType ?? 'ONE_TIME', origin: txn.origin, invoiceNumber: txn.invoiceNumber },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  await Enrollment.findByIdAndUpdate(enrollment._id, {
    paddleCustomerId:    txn.customerId ?? user?.paddleCustomerId ?? null,
    paddleTransactionId: txn.id,
  })

  // Backfill the customer id on the user if the checkout created one
  // (e.g. the student paid before the API had a stored ctm_ id).
  if (txn.customerId && !user?.paddleCustomerId) {
    await User.findByIdAndUpdate(studentObjectId, { paddleCustomerId: txn.customerId })
  }

  log.info(
    { eventId: event.eventId, txn: txn.id, studentId, cohortId, enrollmentId: enrollment._id.toString() },
    '[Paddle] transaction.completed — enrollment activated',
  )
}

// ── transaction.payment_failed ─────────────────────────────────────────────
export async function handleTransactionPaymentFailed(
  event: TransactionPaymentFailedEvent,
  log: FastifyInstance['log'],
): Promise<void> {
  const txn = event.data
  const { studentId, cohortId, paymentPlanId, planType } = readCustomData(txn.customData)
  if (!studentId || !Types.ObjectId.isValid(studentId)) {
    log.warn({ eventId: event.eventId, txn: txn.id }, '[Paddle] payment_failed without a valid studentId — logged only')
    return
  }
  const lastPayment = txn.payments?.[txn.payments.length - 1]
  await PaddlePayment.findOneAndUpdate(
    { paddleEventId: event.eventId },
    {
      $setOnInsert: {
        studentId:           new Types.ObjectId(studentId),
        cohortId:            cohortId && Types.ObjectId.isValid(cohortId) ? new Types.ObjectId(cohortId) : null,
        paymentPlanId:       paymentPlanId && Types.ObjectId.isValid(paymentPlanId) ? new Types.ObjectId(paymentPlanId) : null,
        paddleEventId:       event.eventId,
        paddleTransactionId: txn.id,
        paddleCustomerId:    txn.customerId ?? null,
        amount:              Number.parseInt(String(txn.details?.totals?.grandTotal ?? '0'), 10) || 0,
        currency:            String(txn.currencyCode ?? 'USD').toLowerCase(),
        status:              'FAILED',
        metadata:            { planType: planType ?? 'ONE_TIME', errorCode: lastPayment?.errorCode ?? null },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  log.info({ eventId: event.eventId, txn: txn.id, studentId, errorCode: lastPayment?.errorCode }, '[Paddle] transaction.payment_failed recorded')
}

export async function dispatchPaddleEvent(event: EventEntity, log: FastifyInstance['log']): Promise<void> {
  switch (event.eventType) {
    case EventName.TransactionCompleted:
      return handleTransactionCompleted(event as TransactionCompletedEvent, log)
    case EventName.TransactionPaymentFailed:
      return handleTransactionPaymentFailed(event as TransactionPaymentFailedEvent, log)
    default:
      return
  }
}

// ── Route plugin ────────────────────────────────────────────────────────────
export async function paddleWebhookRoutes(fastify: FastifyInstance) {
  // Plugin-scoped raw-body capture (Fastify's default parser discards it).
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      try {
        ;(_req as typeof _req & { rawBody: Buffer }).rawBody = body as Buffer
        done(null, JSON.parse((body as Buffer).toString('utf8')))
      } catch (err) {
        done(err instanceof Error ? err : new Error(String(err)), undefined)
      }
    },
  )

  fastify.post('/paddle', async (request, reply) => {
    const signature = request.headers['paddle-signature']
    if (!signature || typeof signature !== 'string') {
      return reply.code(400).send({ error: 'MISSING_SIGNATURE', message: 'Paddle-Signature header is required.' })
    }

    const secret = process.env.PADDLE_WEBHOOK_SECRET ?? ''
    if (!secret) {
      fastify.log.error('[Paddle] PADDLE_WEBHOOK_SECRET is not set — cannot verify webhook')
      return reply.code(500).send({ error: 'CONFIGURATION_ERROR', message: 'Webhook not configured.' })
    }

    const rawBody = (request as typeof request & { rawBody?: Buffer }).rawBody
    if (!rawBody) {
      return reply.code(400).send({ error: 'MISSING_BODY', message: 'Raw body unavailable.' })
    }

    let event: EventEntity
    try {
      event = await paddleWebhookVerifier.webhooks.unmarshal(rawBody.toString('utf8'), secret, signature)
    } catch (err) {
      fastify.log.warn({ err: err instanceof Error ? err.message : String(err) }, '[Paddle] signature verification failed')
      return reply.code(400).send({ error: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed.' })
    }

    if (!PADDLE_WEBHOOK_EVENT_ALLOWLIST.has(event.eventType)) {
      fastify.log.info({ eventId: event.eventId, eventType: event.eventType }, '[Paddle] event acknowledged but skipped')
      return reply.send({ received: true, skipped: true })
    }

    try {
      await dispatchPaddleEvent(event, fastify.log)
    } catch (err) {
      // Non-2xx → Paddle retries (3x/15min in sandbox, 60x/3d live).
      fastify.log.error({ err, eventId: event.eventId, eventType: event.eventType }, '[Paddle] event processing failed')
      return reply.code(500).send({ error: 'PROCESSING_ERROR', message: 'Failed to process webhook. Paddle will retry.' })
    }

    return reply.send({ received: true })
  })
}
