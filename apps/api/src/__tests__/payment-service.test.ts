/**
 * Unit tests for paymentService.issueRefund — the refund logic extracted
 * from routes/admin/fir-payments.ts POST /:id/refund.
 *
 * Covers both stripe + manual paths with their error envelopes, the
 * Stripe-SDK best-effort behaviour (DB still flips even if Stripe API
 * fails), and the missing-Stripe-config graceful-degrade path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

const state = vi.hoisted(() => ({
  stripePayments:  new Map<string, Record<string, unknown> & { save: () => Promise<void>; toJSON: () => Record<string, unknown> }>(),
  manualPayments:  new Map<string, Record<string, unknown> & { save: () => Promise<void>; toJSON: () => Record<string, unknown> }>(),
  stripeCreate:    vi.fn(),
  revokeEnrollment: vi.fn().mockResolvedValue({}),
  originalSecret:  process.env.STRIPE_SECRET_KEY,
}))

vi.mock('../models/StripePayment.js', () => ({
  StripePayment: {
    findById: (id: unknown) => Promise.resolve(state.stripePayments.get(String(id)) ?? null),
  },
}))

vi.mock('../models/ManualPaymentRequest.js', () => ({
  ManualPaymentRequest: {
    findById: (id: unknown) => Promise.resolve(state.manualPayments.get(String(id)) ?? null),
  },
}))

vi.mock('../models/Enrollment.js', () => ({
  Enrollment: {
    findByIdAndUpdate: (...args: unknown[]) => state.revokeEnrollment(...args),
  },
}))

vi.mock('../lib/stripe.js', () => ({
  stripe: {
    refunds: {
      create: (args: unknown) => state.stripeCreate(args),
    },
  },
}))

vi.mock('../lib/redis.js', () => ({
  redis: { on: vi.fn() },
  bullMQConnection: { host: 'localhost', port: 6379 },
}))

import { issueRefund, REFUND_FAILURE_STATUS } from '../services/paymentService.js'

// ── Test helpers ──────────────────────────────────────────────────────────

function seedStripePayment(opts: { status?: string; paymentIntentId?: string | null; amount?: number; enrollmentId?: Types.ObjectId } = {}) {
  const _id = new Types.ObjectId()
  const doc = {
    _id,
    status: opts.status ?? 'SUCCEEDED',
    amount: opts.amount ?? 100_000, // cents ($1000) — large enough for the cap
    enrollmentId: opts.enrollmentId,
    stripePaymentIntentId: opts.paymentIntentId === null
      ? null
      : (opts.paymentIntentId ?? 'pi_test_abc'),
    save: vi.fn(async function (this: typeof doc) { /* in-memory */ }),
    toJSON: vi.fn(function (this: typeof doc) {
      return { _id: this._id.toString(), status: this.status }
    }),
  }
  state.stripePayments.set(_id.toString(), doc)
  return doc
}

function seedManualPayment(opts: { status?: string } = {}) {
  const _id = new Types.ObjectId()
  const doc = {
    _id,
    status:           opts.status ?? 'APPROVED',
    rejectionReason:  null as string | null,
    reviewedAt:       null as Date | null,
    save: vi.fn(async function (this: typeof doc) { /* in-memory */ }),
    toJSON: vi.fn(function (this: typeof doc) {
      return { _id: this._id.toString(), status: this.status, rejectionReason: this.rejectionReason }
    }),
  }
  state.manualPayments.set(_id.toString(), doc)
  return doc
}

beforeEach(() => {
  state.stripePayments.clear()
  state.manualPayments.clear()
  state.stripeCreate.mockReset()
  state.revokeEnrollment.mockReset().mockResolvedValue({})
  process.env.STRIPE_SECRET_KEY = 'sk_test_present'
})

// ── Validation ────────────────────────────────────────────────────────────

describe('paymentService — issueRefund', () => {

  it('rejects invalid ObjectId before touching the DB', async () => {
    const result = await issueRefund({
      type: 'stripe', paymentId: 'not-a-valid-id', amount: 100, reason: 'oops',
    })
    expect(result).toEqual({ ok: false, code: 'INVALID_ID', message: expect.stringContaining('ObjectId') })
    expect(REFUND_FAILURE_STATUS['INVALID_ID']).toBe(400)
  })

  // ── Stripe path ──

  it('stripe: not found → NOT_FOUND', async () => {
    const result = await issueRefund({
      type: 'stripe', paymentId: new Types.ObjectId().toString(), amount: 50, reason: 'gone',
    })
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('stripe: already REFUNDED → ALREADY_REFUNDED (409)', async () => {
    const p = seedStripePayment({ status: 'REFUNDED' })
    const result = await issueRefund({
      type: 'stripe', paymentId: p._id.toString(), amount: 50, reason: 'dupe',
    })
    expect(result).toMatchObject({ ok: false, code: 'ALREADY_REFUNDED' })
    expect(REFUND_FAILURE_STATUS['ALREADY_REFUNDED']).toBe(409)
    expect(p.save).not.toHaveBeenCalled()
    expect(state.stripeCreate).not.toHaveBeenCalled()
  })

  it('stripe: happy path → SDK called with cents, status flipped to REFUNDED', async () => {
    const p = seedStripePayment({ paymentIntentId: 'pi_ABC' })
    state.stripeCreate.mockResolvedValueOnce({ id: 're_xxx' })

    const result = await issueRefund({
      type: 'stripe', paymentId: p._id.toString(), amount: 49.99, reason: 'customer-request',
    })

    expect(state.stripeCreate).toHaveBeenCalledWith({
      payment_intent: 'pi_ABC',
      amount:         4999, // cents
      reason:         'requested_by_customer',
    })
    expect(p.status).toBe('REFUNDED')
    expect(p.save).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      ok:      true,
      type:    'stripe',
      payment: expect.objectContaining({ status: 'REFUNDED' }),
    })
  })

  it('stripe: SDK throws → fails loudly, DB NOT flipped (no phantom refund)', async () => {
    const p = seedStripePayment({ paymentIntentId: 'pi_BAD' })
    state.stripeCreate.mockRejectedValueOnce(new Error('Stripe down'))

    const result = await issueRefund({
      type: 'stripe', paymentId: p._id.toString(), amount: 100, reason: 'force',
    })

    expect(state.stripeCreate).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ ok: false, code: 'STRIPE_REFUND_FAILED' })
    expect(REFUND_FAILURE_STATUS['STRIPE_REFUND_FAILED']).toBe(502)
    // row untouched so the operator can retry
    expect(p.status).toBe('SUCCEEDED')
    expect(p.save).not.toHaveBeenCalled()
    expect(state.revokeEnrollment).not.toHaveBeenCalled()
  })

  it('stripe: refund exceeding the original charge → INVALID_AMOUNT (over-refund guard)', async () => {
    // charge is $50 (5000 cents); admin fat-fingers the cents value as dollars
    const p = seedStripePayment({ amount: 5000 })

    const result = await issueRefund({
      type: 'stripe', paymentId: p._id.toString(), amount: 5000, reason: 'oops',
    })

    expect(result).toMatchObject({ ok: false, code: 'INVALID_AMOUNT' })
    expect(REFUND_FAILURE_STATUS['INVALID_AMOUNT']).toBe(400)
    expect(state.stripeCreate).not.toHaveBeenCalled()
    expect(p.save).not.toHaveBeenCalled()
  })

  it('stripe: full refund revokes the linked enrollment', async () => {
    const enrollmentId = new Types.ObjectId()
    const p = seedStripePayment({ amount: 5000, enrollmentId })
    state.stripeCreate.mockResolvedValueOnce({ id: 're_full' })

    const result = await issueRefund({
      type: 'stripe', paymentId: p._id.toString(), amount: 50, reason: 'full refund',
    })

    expect(result.ok).toBe(true)
    expect(p.status).toBe('REFUNDED')
    expect(state.revokeEnrollment).toHaveBeenCalledWith(enrollmentId, { $set: { status: 'REVOKED' } })
  })

  it('stripe: partial refund does NOT revoke access', async () => {
    const enrollmentId = new Types.ObjectId()
    const p = seedStripePayment({ amount: 5000, enrollmentId })
    state.stripeCreate.mockResolvedValueOnce({ id: 're_partial' })

    await issueRefund({
      type: 'stripe', paymentId: p._id.toString(), amount: 10, reason: 'partial',
    })

    expect(p.status).toBe('REFUNDED')
    expect(state.revokeEnrollment).not.toHaveBeenCalled()
  })

  it('stripe: no paymentIntentId → DB flipped without SDK call (legacy rows)', async () => {
    const p = seedStripePayment({ paymentIntentId: null })

    const result = await issueRefund({
      type: 'stripe', paymentId: p._id.toString(), amount: 50, reason: 'legacy',
    })

    expect(state.stripeCreate).not.toHaveBeenCalled()
    expect(p.status).toBe('REFUNDED')
    expect(result.ok).toBe(true)
  })

  it('stripe: STRIPE_SECRET_KEY unset → DB flipped without SDK call', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const p = seedStripePayment()

    const result = await issueRefund({
      type: 'stripe', paymentId: p._id.toString(), amount: 50, reason: 'no-key',
    })

    expect(state.stripeCreate).not.toHaveBeenCalled()
    expect(p.status).toBe('REFUNDED')
    expect(result.ok).toBe(true)
  })

  // ── Manual path ──

  it('manual: not found → NOT_FOUND', async () => {
    const result = await issueRefund({
      type: 'manual', paymentId: new Types.ObjectId().toString(), reason: 'gone',
    })
    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' })
  })

  it('manual: already REJECTED → ALREADY_REJECTED (409)', async () => {
    const p = seedManualPayment({ status: 'REJECTED' })
    const result = await issueRefund({
      type: 'manual', paymentId: p._id.toString(), reason: 'dupe',
    })
    expect(result).toMatchObject({ ok: false, code: 'ALREADY_REJECTED' })
    expect(REFUND_FAILURE_STATUS['ALREADY_REJECTED']).toBe(409)
    expect(p.save).not.toHaveBeenCalled()
  })

  it('manual: happy path → status REJECTED + reason + reviewedAt', async () => {
    const p = seedManualPayment({ status: 'APPROVED' })

    const result = await issueRefund({
      type: 'manual', paymentId: p._id.toString(), reason: 'refunding per customer ticket #1234',
    })

    expect(p.status).toBe('REJECTED')
    expect(p.rejectionReason).toBe('refunding per customer ticket #1234')
    expect(p.reviewedAt).toBeInstanceOf(Date)
    expect(p.save).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      ok:      true,
      type:    'manual',
      payment: expect.objectContaining({ status: 'REJECTED' }),
    })
  })
})
