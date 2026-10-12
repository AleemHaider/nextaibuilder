/**
 * Tests for the charge.refunded + charge.dispute.created handlers (audit H-2).
 * Dashboard refunds and chargebacks previously had no handler, so access was
 * never revoked and the ledger stayed SUCCEEDED.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

const h = vi.hoisted(() => ({
  paymentFindOne:            vi.fn(),
  paymentSave:               vi.fn().mockResolvedValue(undefined),
  enrollmentFindByIdAndUpdate: vi.fn().mockResolvedValue({}),
}))

vi.mock('bullmq', () => ({
  Worker: class { on = vi.fn(); constructor() {} },
  Queue:  class { add = vi.fn(); constructor() {} },
}))
vi.mock('../lib/redis.js', () => ({ bullMQConnection: { host: 'localhost', port: 6379 } }))
vi.mock('../lib/stripe.js', () => ({ stripe: { subscriptions: { retrieve: vi.fn() } } }))
vi.mock('../services/enrollmentService.js', () => ({
  activateEnrollment: vi.fn(), enqueueEmailWithIdempotency: vi.fn(),
}))
vi.mock('../workers/installmentReminderWorker.js', () => ({ scheduleInstallmentReminders: vi.fn() }))
vi.mock('../models/StripePayment.js', () => ({
  StripePayment: {
    findOne: (...a: unknown[]) => h.paymentFindOne(...a),
    findOneAndUpdate: vi.fn(), countDocuments: vi.fn(),
  },
}))
vi.mock('../models/Enrollment.js', () => ({
  Enrollment: { findOne: vi.fn(), findByIdAndUpdate: (...a: unknown[]) => h.enrollmentFindByIdAndUpdate(...a) },
}))
vi.mock('../models/User.js', () => ({ User: { findById: vi.fn() } }))
vi.mock('../models/ProcessedStripeEvent.js', () => ({ ProcessedStripeEvent: { findOne: vi.fn(), findOneAndUpdate: vi.fn() } }))

import { __testables } from '../workers/stripeWebhookWorker.js'

const ENR = new Types.ObjectId()

beforeEach(() => {
  vi.clearAllMocks()
  h.enrollmentFindByIdAndUpdate.mockResolvedValue({})
})

describe('charge.refunded handler', () => {
  it('marks the payment REFUNDED and REVOKES access on a full refund', async () => {
    const payment = { status: 'SUCCEEDED', enrollmentId: ENR, amount: 5000, save: h.paymentSave }
    h.paymentFindOne.mockResolvedValue(payment)

    await __testables.handleChargeRefunded('evt_r1', {
      payment_intent: 'pi_1', amount: 5000, amount_refunded: 5000, refunded: true,
    })

    expect(payment.status).toBe('REFUNDED')
    expect(h.paymentSave).toHaveBeenCalled()
    expect(h.enrollmentFindByIdAndUpdate).toHaveBeenCalledWith(ENR, { $set: { status: 'REVOKED' } })
  })

  it('does NOT revoke access on a partial refund', async () => {
    const payment = { status: 'SUCCEEDED', enrollmentId: ENR, amount: 5000, save: h.paymentSave }
    h.paymentFindOne.mockResolvedValue(payment)

    await __testables.handleChargeRefunded('evt_r2', {
      payment_intent: 'pi_2', amount: 5000, amount_refunded: 1000, refunded: false,
    })

    expect(payment.status).toBe('REFUNDED')
    expect(h.enrollmentFindByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('skips when no StripePayment matches the payment_intent', async () => {
    h.paymentFindOne.mockResolvedValue(null)
    await __testables.handleChargeRefunded('evt_r3', { payment_intent: 'pi_missing', refunded: true })
    expect(h.enrollmentFindByIdAndUpdate).not.toHaveBeenCalled()
  })
})

describe('charge.dispute.created handler', () => {
  it('SUSPENDS access pending dispute resolution', async () => {
    h.paymentFindOne.mockResolvedValue({ enrollmentId: ENR })
    await __testables.handleChargeDisputeCreated('evt_d1', { payment_intent: 'pi_9' })
    expect(h.enrollmentFindByIdAndUpdate).toHaveBeenCalledWith(ENR, {
      $set: { status: 'SUSPENDED', paymentStatus: 'FAILED' },
    })
  })
})
