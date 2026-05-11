/**
 * Stripe webhook hardening — two defense-in-depth checks added after the
 * security review.
 *
 * 1. Event-type allowlist at the receiver: signed-but-unhandled events
 *    return 200/skipped without touching BullMQ or Mongo.
 * 2. Metadata validation in handlePaymentIntentSucceeded: malformed
 *    ObjectIds in event.data.object.metadata short-circuit before
 *    `new Types.ObjectId(...)` throws and burns retry slots.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

const state = vi.hoisted(() => ({
  activateEnrollmentCalls: [] as unknown[],
  loggerWarnCalls:         [] as Array<{ obj: unknown; msg: string }>,
}))

vi.mock('../services/enrollmentService.js', () => ({
  activateEnrollment: vi.fn((input: unknown) => {
    state.activateEnrollmentCalls.push(input)
    return Promise.resolve({
      enrollment: {
        _id:       { toString: () => 'enr_mock' },
        studentId: (input as { studentId: unknown }).studentId,
        cohortId:  (input as { cohortId: unknown }).cohortId,
      },
    })
  }),
  enqueueEmailWithIdempotency:       vi.fn(),
  enqueueSlackInviteWithIdempotency: vi.fn(),
}))

vi.mock('../models/Enrollment.js', () => ({
  Enrollment: {
    findOne:          vi.fn(),
    findById:         vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}))

vi.mock('../models/StripePayment.js', () => ({
  StripePayment: {
    findOne:          vi.fn(),
    findOneAndUpdate: vi.fn().mockResolvedValue({ installmentNumber: 1 }),
    countDocuments:   vi.fn().mockResolvedValue(0),
  },
}))

vi.mock('../models/User.js', () => ({
  User: {
    findById: vi.fn(() => ({ select: () => ({ lean: async () => ({ email: 'u@e.com', stripeCustomerId: null }) }) })),
  },
}))

vi.mock('../models/ProcessedStripeEvent.js', () => ({
  ProcessedStripeEvent: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}))

vi.mock('bullmq', () => ({
  Queue:  function () { return { add: vi.fn() } },
  Worker: function () { return { on: vi.fn() } },
}))

vi.mock('../lib/redis.js', () => ({
  bullMQConnection: { host: 'localhost', port: 6379 },
  redis:            {},
}))

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn((obj: unknown, msg?: string) => {
      state.loggerWarnCalls.push({ obj, msg: msg ?? String(obj) })
    }),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}))

vi.mock('./installmentReminderWorker.js', () => ({
  scheduleInstallmentReminders: vi.fn().mockResolvedValue(undefined),
}))

// ── Imports after mocks ────────────────────────────────────────────────────

import { STRIPE_WEBHOOK_EVENT_ALLOWLIST } from '../routes/webhook-stripe.js'
import { __testables } from '../workers/stripeWebhookWorker.js'
import { activateEnrollment } from '../services/enrollmentService.js'

beforeEach(() => {
  state.activateEnrollmentCalls.length = 0
  state.loggerWarnCalls.length = 0
  vi.mocked(activateEnrollment).mockClear()
})

// ── Allowlist ──────────────────────────────────────────────────────────────

describe('Stripe webhook event-type allowlist', () => {

  it('exposes exactly the 4 event types the worker switch handles', () => {
    expect(STRIPE_WEBHOOK_EVENT_ALLOWLIST).toEqual(new Set([
      'payment_intent.succeeded',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'customer.subscription.deleted',
    ]))
  })

  it('rejects ad-hoc events not the worker handles (e.g. charge.refunded)', () => {
    expect(STRIPE_WEBHOOK_EVENT_ALLOWLIST.has('charge.refunded')).toBe(false)
    expect(STRIPE_WEBHOOK_EVENT_ALLOWLIST.has('customer.created')).toBe(false)
    expect(STRIPE_WEBHOOK_EVENT_ALLOWLIST.has('invoice.created')).toBe(false)
  })

  // Sanity: allowlist size matches the worker switch.
  it('list size matches the four handlers in stripeWebhookWorker switch', () => {
    expect(STRIPE_WEBHOOK_EVENT_ALLOWLIST.size).toBe(4)
  })
})

// ── handlePaymentIntentSucceeded metadata validation ─────────────────────

describe('handlePaymentIntentSucceeded — metadata validation', () => {

  function makePiData(metadata: Record<string, string>) {
    return {
      id:       'pi_test_123',
      amount:   9999,
      currency: 'usd',
      metadata,
    } as unknown as Record<string, unknown>
  }

  it('skips when studentId is malformed (no activateEnrollment, no throw, no retry burn)', async () => {
    await __testables.handlePaymentIntentSucceeded(
      'evt_malformed_student',
      makePiData({ planType: 'ONE_TIME', studentId: 'not-a-real-id', cohortId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }),
    )

    expect(vi.mocked(activateEnrollment)).not.toHaveBeenCalled()
    // Warning logged with eventId for trace.
    expect(state.loggerWarnCalls.some((c) =>
      typeof c.msg === 'string' && c.msg.includes('malformed ObjectId'),
    )).toBe(true)
  })

  it('skips when cohortId is malformed', async () => {
    await __testables.handlePaymentIntentSucceeded(
      'evt_malformed_cohort',
      makePiData({ planType: 'ONE_TIME', studentId: 'aaaaaaaaaaaaaaaaaaaaaaaa', cohortId: 'garbage' }),
    )
    expect(vi.mocked(activateEnrollment)).not.toHaveBeenCalled()
  })

  it('drops malformed paymentPlanId but still activates (it is optional)', async () => {
    await __testables.handlePaymentIntentSucceeded(
      'evt_bad_plan',
      makePiData({
        planType:      'ONE_TIME',
        studentId:     'aaaaaaaaaaaaaaaaaaaaaaaa',
        cohortId:      'bbbbbbbbbbbbbbbbbbbbbbbb',
        paymentPlanId: 'not-an-objectid',
      }),
    )

    expect(vi.mocked(activateEnrollment)).toHaveBeenCalledOnce()
    const call = state.activateEnrollmentCalls[0] as { paymentPlanId: unknown }
    // Malformed plan ID dropped to null, not propagated as a bad ObjectId.
    expect(call.paymentPlanId).toBeNull()
  })

  it('passes through a well-formed paymentPlanId unchanged', async () => {
    const planId = 'cccccccccccccccccccccccc'
    await __testables.handlePaymentIntentSucceeded(
      'evt_ok',
      makePiData({
        planType:      'ONE_TIME',
        studentId:     'aaaaaaaaaaaaaaaaaaaaaaaa',
        cohortId:      'bbbbbbbbbbbbbbbbbbbbbbbb',
        paymentPlanId: planId,
      }),
    )

    expect(vi.mocked(activateEnrollment)).toHaveBeenCalledOnce()
    const call = state.activateEnrollmentCalls[0] as { paymentPlanId: { toString: () => string } | null }
    expect(call.paymentPlanId).not.toBeNull()
    expect(String(call.paymentPlanId)).toBe(planId)
  })

  it('skips when metadata is missing studentId entirely (existing behaviour preserved)', async () => {
    await __testables.handlePaymentIntentSucceeded(
      'evt_missing',
      makePiData({ planType: 'ONE_TIME', cohortId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }),
    )
    expect(vi.mocked(activateEnrollment)).not.toHaveBeenCalled()
  })

  it('skips non-ONE_TIME planType (handled by invoice.payment_succeeded instead)', async () => {
    await __testables.handlePaymentIntentSucceeded(
      'evt_installment_pi',
      makePiData({
        planType:  'INSTALLMENT',
        studentId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        cohortId:  'bbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    )
    expect(vi.mocked(activateEnrollment)).not.toHaveBeenCalled()
  })
})
