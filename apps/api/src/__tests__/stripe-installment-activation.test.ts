/**
 * Regression test for the installment activation dead-code bug.
 *
 * Before the fix, `handleInvoicePaymentSucceeded` resolved the enrollment by
 * `stripeSubscriptionId` — a field NOTHING ever wrote — and bailed out when it
 * was missing. Checkout creates the Stripe subscription but no enrollment, so
 * installment buyers were charged and never enrolled.
 *
 * These tests assert the handler now activates the enrollment on the first
 * installment (from the subscription's metadata), stamps the subscription id,
 * and does NOT re-activate on later installments.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

const studentId = new Types.ObjectId().toString()
const cohortId  = new Types.ObjectId().toString()
const planId    = new Types.ObjectId().toString()

const h = vi.hoisted(() => ({
  activateEnrollment:         vi.fn(),
  scheduleReminders:          vi.fn().mockResolvedValue(undefined),
  subscriptionsRetrieve:      vi.fn(),
  enrollmentFindOne:          vi.fn(),
  enrollmentFindByIdAndUpdate: vi.fn().mockResolvedValue({}),
  paymentCountDocuments:      vi.fn().mockResolvedValue(0),
}))

vi.mock('bullmq', () => ({
  Worker: class { on = vi.fn(); constructor() {} },
  Queue:  class { add = vi.fn(); constructor() {} },
}))
vi.mock('../lib/redis.js', () => ({ bullMQConnection: { host: 'localhost', port: 6379 } }))

vi.mock('../services/enrollmentService.js', () => ({
  activateEnrollment: (...a: unknown[]) => h.activateEnrollment(...a),
  enqueueEmailWithIdempotency: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../workers/installmentReminderWorker.js', () => ({
  scheduleInstallmentReminders: (...a: unknown[]) => h.scheduleReminders(...a),
}))

vi.mock('../lib/stripe.js', () => ({
  stripe: { subscriptions: { retrieve: (...a: unknown[]) => h.subscriptionsRetrieve(...a) } },
}))

vi.mock('../models/Enrollment.js', () => ({
  Enrollment: {
    findOne:           (...a: unknown[]) => h.enrollmentFindOne(...a),
    findByIdAndUpdate: (...a: unknown[]) => h.enrollmentFindByIdAndUpdate(...a),
  },
}))

vi.mock('../models/StripePayment.js', () => ({
  StripePayment: {
    findOneAndUpdate: vi.fn().mockResolvedValue({ _id: new Types.ObjectId(), installmentNumber: 1 }),
    countDocuments:   (...a: unknown[]) => h.paymentCountDocuments(...a),
  },
}))

vi.mock('../models/User.js', () => ({
  User: { findById: () => ({ select: () => ({ lean: async () => ({ email: 'stu@example.com', stripeCustomerId: 'cus_1' }) }) }) },
}))

vi.mock('../models/ProcessedStripeEvent.js', () => ({ ProcessedStripeEvent: { findOne: vi.fn(), findOneAndUpdate: vi.fn() } }))

import { __testables } from '../workers/stripeWebhookWorker.js'

beforeEach(() => {
  vi.clearAllMocks()
  h.scheduleReminders.mockResolvedValue(undefined)
  h.enrollmentFindByIdAndUpdate.mockResolvedValue({})
  h.paymentCountDocuments.mockResolvedValue(0)
  h.activateEnrollment.mockResolvedValue({
    enrollment: { _id: new Types.ObjectId(), studentId: new Types.ObjectId(studentId), cohortId: new Types.ObjectId(cohortId) },
  })
})

describe('handleInvoicePaymentSucceeded — installment activation', () => {
  it('first installment (2025 API shape: metadata embedded on invoice.parent) activates the enrollment', async () => {
    h.enrollmentFindOne.mockResolvedValue(null) // no enrollment yet

    await __testables.handleInvoicePaymentSucceeded('evt_1', {
      id: 'in_1',
      amount_paid: 30000,
      currency: 'usd',
      parent: {
        subscription_details: {
          subscription: 'sub_123',
          metadata: { studentId, cohortId, paymentPlanId: planId, planType: 'INSTALLMENT' },
        },
      },
    })

    expect(h.activateEnrollment).toHaveBeenCalledOnce()
    const arg = h.activateEnrollment.mock.calls[0]![0] as Record<string, unknown>
    expect((arg.studentId as Types.ObjectId).toString()).toBe(studentId)
    expect((arg.cohortId as Types.ObjectId).toString()).toBe(cohortId)
    expect(arg.paymentMethod).toBe('STRIPE')
    expect(arg.idempotencyScope).toBe('evt_1')

    // subscription id stamped so later installments resolve the enrollment
    const stamp = h.enrollmentFindByIdAndUpdate.mock.calls.find(
      (c) => (c[1] as { $set?: { stripeSubscriptionId?: string } })?.$set?.stripeSubscriptionId === 'sub_123',
    )
    expect(stamp).toBeTruthy()
    expect(h.scheduleReminders).toHaveBeenCalledOnce()
    // no Stripe API round-trip needed when metadata is embedded
    expect(h.subscriptionsRetrieve).not.toHaveBeenCalled()
  })

  it('first installment (legacy top-level subscription, no embedded metadata) retrieves the subscription for metadata', async () => {
    h.enrollmentFindOne.mockResolvedValue(null)
    h.subscriptionsRetrieve.mockResolvedValue({ metadata: { studentId, cohortId, paymentPlanId: planId } })

    await __testables.handleInvoicePaymentSucceeded('evt_2', {
      id: 'in_2',
      subscription: 'sub_456',
      amount_paid: 30000,
      currency: 'usd',
    })

    expect(h.subscriptionsRetrieve).toHaveBeenCalledWith('sub_456')
    expect(h.activateEnrollment).toHaveBeenCalledOnce()
  })

  it('later installment (enrollment already exists) does NOT re-activate', async () => {
    h.enrollmentFindOne.mockResolvedValue({
      _id: new Types.ObjectId(),
      studentId: new Types.ObjectId(studentId),
      cohortId: new Types.ObjectId(cohortId),
      stripeSubscriptionId: 'sub_789',
    })

    await __testables.handleInvoicePaymentSucceeded('evt_3', {
      id: 'in_3',
      subscription: 'sub_789',
      amount_paid: 30000,
      currency: 'usd',
    })

    expect(h.activateEnrollment).not.toHaveBeenCalled()
    expect(h.scheduleReminders).not.toHaveBeenCalled()
    // payment status still reconciled
    expect(h.enrollmentFindByIdAndUpdate).toHaveBeenCalled()
  })

  it('throws (so BullMQ retries) when a first-installment subscription context cannot be resolved', async () => {
    h.enrollmentFindOne.mockResolvedValue(null)
    h.subscriptionsRetrieve.mockResolvedValue({ metadata: {} }) // no studentId/cohortId

    await expect(
      __testables.handleInvoicePaymentSucceeded('evt_4', {
        id: 'in_4',
        subscription: 'sub_bad',
        amount_paid: 30000,
        currency: 'usd',
      }),
    ).rejects.toThrow()

    expect(h.activateEnrollment).not.toHaveBeenCalled()
  })
})
