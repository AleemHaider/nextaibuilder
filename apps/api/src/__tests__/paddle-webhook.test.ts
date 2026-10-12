/**
 * Paddle webhook receiver — signature verification, allowlist, and the
 * transaction.completed → activateEnrollment path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import Fastify from 'fastify'

const state = vi.hoisted(() => ({
  activateEnrollmentCalls: [] as unknown[],
  paddlePaymentUpserts:    [] as unknown[],
  enrollmentUpdates:       [] as unknown[],
}))

vi.mock('../services/enrollmentService.js', () => ({
  activateEnrollment: vi.fn((input: unknown) => {
    state.activateEnrollmentCalls.push(input)
    return Promise.resolve({ enrollment: { _id: { toString: () => 'enr_mock' } } })
  }),
}))

vi.mock('../models/PaddlePayment.js', () => ({
  PaddlePayment: {
    findOneAndUpdate: vi.fn((filter: unknown, update: unknown) => {
      state.paddlePaymentUpserts.push({ filter, update })
      return Promise.resolve({})
    }),
  },
}))

vi.mock('../models/Enrollment.js', () => ({
  Enrollment: {
    findByIdAndUpdate: vi.fn((id: unknown, update: unknown) => {
      state.enrollmentUpdates.push({ id, update })
      return Promise.resolve({})
    }),
  },
}))

vi.mock('../models/User.js', () => ({
  User: {
    findById: vi.fn(() => ({ select: () => ({ lean: async () => ({ email: 'u@e.com', paddleCustomerId: null }) }) })),
    findByIdAndUpdate: vi.fn().mockResolvedValue({}),
  },
}))

const SECRET = 'pdl_ntfset_test_secret'

function sign(body: string, ts = Math.floor(Date.now() / 1000)): string {
  const h1 = createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex')
  return `ts=${ts};h1=${h1}`
}

function txnCompletedEvent(customData: Record<string, unknown> | null) {
  return {
    event_id:        'evt_01test',
    event_type:      'transaction.completed',
    occurred_at:     new Date().toISOString(),
    notification_id: 'ntf_01test',
    data: {
      id:              'txn_01test',
      status:          'completed',
      customer_id:     'ctm_01test',
      address_id:      null,
      business_id:     null,
      custom_data:     customData,
      currency_code:   'USD',
      origin:          'api',
      subscription_id: null,
      invoice_id:      null,
      invoice_number:  'INV-1',
      collection_mode: 'automatic',
      discount_id:     null,
      billing_details: null,
      billing_period:  null,
      items:           [],
      details: {
        tax_rates_used: [],
        totals: {
          subtotal: '2700', discount: '0', tax: '0', total: '2700', credit: '0',
          credit_to_balance: '0', balance: '0', grand_total: '2700', fee: null,
          earnings: null, currency_code: 'USD',
        },
        adjusted_totals: null, payout_totals: null, adjusted_payout_totals: null, line_items: [],
      },
      payments:   [],
      checkout:   null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      billed_at:  null,
      revised_at: null,
    },
  }
}

async function buildApp() {
  const { paddleWebhookRoutes } = await import('../routes/webhook-paddle.js')
  const app = Fastify({ logger: false })
  await app.register(paddleWebhookRoutes, { prefix: '/api/v1/webhook' })
  await app.ready()
  return app
}

describe('Paddle webhook receiver', () => {
  beforeEach(() => {
    process.env.PADDLE_WEBHOOK_SECRET = SECRET
    state.activateEnrollmentCalls = []
    state.paddlePaymentUpserts = []
    state.enrollmentUpdates = []
  })

  it('rejects requests without a Paddle-Signature header', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/v1/webhook/paddle', payload: {} })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('MISSING_SIGNATURE')
  })

  it('rejects a bad signature', async () => {
    const app = await buildApp()
    const body = JSON.stringify(txnCompletedEvent({}))
    const res = await app.inject({
      method: 'POST', url: '/api/v1/webhook/paddle',
      headers: { 'content-type': 'application/json', 'paddle-signature': 'ts=1;h1=deadbeef' },
      payload: body,
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('INVALID_SIGNATURE')
    expect(state.activateEnrollmentCalls).toHaveLength(0)
  })

  it('activates the enrollment on a correctly signed transaction.completed', async () => {
    const app = await buildApp()
    const studentId = '6a01bf480b69215b3ef28b00'
    const cohortId  = '6a01bf480b69215b3ef28bb5'
    const planId    = '6a01bf480b69215b3ef28bec'
    const body = JSON.stringify(txnCompletedEvent({ studentId, cohortId, paymentPlanId: planId, planType: 'ONE_TIME' }))
    const res = await app.inject({
      method: 'POST', url: '/api/v1/webhook/paddle',
      headers: { 'content-type': 'application/json', 'paddle-signature': sign(body) },
      payload: body,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ received: true })

    expect(state.activateEnrollmentCalls).toHaveLength(1)
    const call = state.activateEnrollmentCalls[0] as Record<string, unknown>
    expect(call.paymentMethod).toBe('PADDLE')
    expect(call.idempotencyScope).toBe('evt_01test')
    expect(String(call.studentId)).toBe(studentId)
    expect(String(call.cohortId)).toBe(cohortId)
    expect(String(call.paymentPlanId)).toBe(planId)

    expect(state.paddlePaymentUpserts).toHaveLength(1)
    const upsert = state.paddlePaymentUpserts[0] as { filter: { paddleEventId: string }; update: { $setOnInsert: Record<string, unknown> } }
    expect(upsert.filter.paddleEventId).toBe('evt_01test')
    expect(upsert.update.$setOnInsert.paddleTransactionId).toBe('txn_01test')
    expect(upsert.update.$setOnInsert.amount).toBe(2700)
    expect(upsert.update.$setOnInsert.currency).toBe('usd')
    expect(upsert.update.$setOnInsert.status).toBe('SUCCEEDED')

    expect(state.enrollmentUpdates).toHaveLength(1)
  })

  it('acks but skips a completed transaction without enrollment custom_data', async () => {
    const app = await buildApp()
    const body = JSON.stringify(txnCompletedEvent(null))
    const res = await app.inject({
      method: 'POST', url: '/api/v1/webhook/paddle',
      headers: { 'content-type': 'application/json', 'paddle-signature': sign(body) },
      payload: body,
    })
    expect(res.statusCode).toBe(200)
    expect(state.activateEnrollmentCalls).toHaveLength(0)
    expect(state.paddlePaymentUpserts).toHaveLength(0)
  })

  it('acks and skips event types outside the allowlist', async () => {
    const app = await buildApp()
    const ev = txnCompletedEvent({})
    ev.event_type = 'transaction.updated'
    const body = JSON.stringify(ev)
    const res = await app.inject({
      method: 'POST', url: '/api/v1/webhook/paddle',
      headers: { 'content-type': 'application/json', 'paddle-signature': sign(body) },
      payload: body,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ received: true, skipped: true })
    expect(state.activateEnrollmentCalls).toHaveLength(0)
  })
})
