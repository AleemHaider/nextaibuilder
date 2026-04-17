/**
 * FIR Wave 2 Story K — Idempotency smoke test for stripeWebhookWorker.
 *
 * Scope:
 *   Invoke the internal `handlePaymentIntentSucceeded` handler twice with the
 *   same Stripe event.id (simulating a worker retry after a mid-process crash)
 *   and assert each side-effect model only contains one document with the
 *   expected idempotencyKey. This proves the `unique sparse index` + the
 *   `findOneAndUpdate({idempotencyKey}, {$setOnInsert}, {upsert:true})`
 *   pattern in the worker is replay-safe.
 *
 * What we mock:
 *   - bullmq        → Queue.add becomes a spy, no real Redis
 *   - ../lib/redis.js → bullMQConnection stub
 *   - ../models/* → in-memory Mongoose-model doubles that enforce the
 *                   idempotencyKey uniqueness constraint the same way the
 *                   real MongoDB unique sparse index would
 *
 * What we do NOT mock:
 *   - The worker itself — we import __testables directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

// ── In-memory stores keyed by collection ─────────────────────────────────
// Each mocked model exposes findOneAndUpdate / findOne / findById /
// countDocuments / create / findByIdAndUpdate with the minimum behaviour
// needed by the worker. The idempotencyKey uniqueness is enforced by
// keying lookups on that field explicitly.

// vi.hoisted lifts these store factories above the (also-hoisted) vi.mock
// factories so they're defined in time to be captured by the mocks.
const stores = vi.hoisted(() => {
  // Duplicated in-line because the hoisted block runs before any imports.
  // Keep the shape identical to makeStore() below.
  const { Types: T } = require('mongoose')

  function matches(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
    for (const [k, v] of Object.entries(filter)) {
      if (v && typeof v === 'object' && typeof (v as { equals?: unknown }).equals === 'function') {
        const docVal = doc[k]
        if (
          !docVal ||
          typeof (docVal as { equals?: unknown }).equals !== 'function' ||
          !(docVal as { equals: (o: unknown) => boolean }).equals(v)
        ) return false
      } else if (doc[k] !== v) {
        return false
      }
    }
    return true
  }

  function makeStoreHoisted() {
    const docs: Array<Record<string, unknown>> = []
    return {
      docs,
      // Return a chainable thenable so both `await findOne(...)` and
      // `await findOne(...).lean()` work (the worker uses both forms).
      findOne: (filter: Record<string, unknown>) => {
        const result = docs.find((d) => matches(d, filter)) ?? null
        const resolvedPromise = Promise.resolve(result)
        return {
          lean: () => resolvedPromise,
          then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            resolvedPromise.then(onFulfilled, onRejected),
          catch: (onRejected: (e: unknown) => unknown) =>
            resolvedPromise.catch(onRejected),
        }
      },
      findById: async (id: unknown) => {
        const target = typeof id === 'string' ? new T.ObjectId(id) : id
        return docs.find((d) => (d['_id'] as { equals: (o: unknown) => boolean }).equals(target)) ?? null
      },
      findOneAndUpdate: async (
        filter: Record<string, unknown>,
        update: { $set?: Record<string, unknown>; $setOnInsert?: Record<string, unknown> },
        opts: { upsert?: boolean; new?: boolean } = {},
      ) => {
        let existing = docs.find((d) => matches(d, filter))
        const inserted = !existing
        if (!existing && opts.upsert) {
          existing = { _id: new T.ObjectId(), ...(update.$setOnInsert ?? {}) }
          docs.push(existing)
        }
        if (existing && !inserted && update.$set) Object.assign(existing, update.$set)
        else if (existing && inserted && update.$set) Object.assign(existing, update.$set)
        return opts.new !== false ? (existing ?? null) : existing
      },
      findByIdAndUpdate: async (
        id: unknown,
        update: { $set?: Record<string, unknown> } | Record<string, unknown>,
      ) => {
        const target = typeof id === 'string' ? new T.ObjectId(id) : id
        const doc = docs.find((d) => (d['_id'] as { equals: (o: unknown) => boolean }).equals(target))
        if (!doc) return null
        const $set = (update as { $set?: Record<string, unknown> }).$set
        if ($set) Object.assign(doc, $set)
        else Object.assign(doc, update)
        return doc
      },
      countDocuments: async (filter: Record<string, unknown>) =>
        docs.filter((d) => matches(d, filter)).length,
      create: async (payload: Record<string, unknown>) => {
        const key = payload['idempotencyKey']
        if (typeof key === 'string' && docs.some((d) => d['idempotencyKey'] === key)) {
          const err = new Error('E11000 duplicate key') as Error & { code: number }
          err.code = 11000
          throw err
        }
        const doc = { _id: new T.ObjectId(), ...payload }
        docs.push(doc)
        return doc
      },
    }
  }

  return {
    enrollment:    makeStoreHoisted(),
    stripePayment: makeStoreHoisted(),
    slackInvite:   makeStoreHoisted(),
    emailLog:      makeStoreHoisted(),
    user:          makeStoreHoisted(),
  }
})

const enrollmentStore    = stores.enrollment
const stripePaymentStore = stores.stripePayment
const slackInviteStore   = stores.slackInvite
const emailLogStore      = stores.emailLog
const userStore          = stores.user

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('bullmq', () => {
  const add = vi.fn().mockResolvedValue({ id: 'job-id-placeholder' })
  class Queue { add = add; constructor(_n: string, _o?: unknown) {} }
  class Worker { on = vi.fn(); constructor(_n: string, _p?: unknown, _o?: unknown) {} }
  return { Queue, Worker, __addSpy: add }
})

vi.mock('../lib/redis.js', () => ({
  redis: { on: vi.fn() },
  bullMQConnection: { host: 'localhost', port: 6379 },
}))

vi.mock('../models/Enrollment.js', () => ({ Enrollment: stores.enrollment }))
vi.mock('../models/StripePayment.js', () => ({ StripePayment: stores.stripePayment }))
vi.mock('../models/SlackInvite.js', () => ({ SlackInvite: stores.slackInvite }))
vi.mock('../models/EmailLog.js', () => ({ EmailLog: stores.emailLog }))

// User.findById(...).select(...).lean() chain
vi.mock('../models/User.js', () => ({
  User: {
    findById: (id: unknown) => ({
      select: () => ({
        lean: async () => {
          const { Types: T } = require('mongoose')
          const target = typeof id === 'string' ? new T.ObjectId(id) : id
          return stores.user.docs.find(
            (d: Record<string, unknown>) => (d['_id'] as { equals: (o: unknown) => boolean }).equals(target),
          ) ?? null
        },
      }),
    }),
  },
}))

// ── Import worker AFTER mocks are registered ─────────────────────────────
import { __testables } from '../workers/stripeWebhookWorker.js'

// ── Tests ────────────────────────────────────────────────────────────────

describe('stripeWebhookWorker — idempotency smoke test (FIR Wave 2 Story K)', () => {
  let studentId: Types.ObjectId
  let cohortId:  Types.ObjectId

  beforeEach(() => {
    // Reset all in-memory stores + spies
    enrollmentStore.docs.length    = 0
    stripePaymentStore.docs.length = 0
    slackInviteStore.docs.length   = 0
    emailLogStore.docs.length      = 0
    userStore.docs.length          = 0

    studentId = new Types.ObjectId()
    cohortId  = new Types.ObjectId()

    // Seed a user so the worker can look up email / stripeCustomerId
    userStore.docs.push({
      _id: studentId,
      email: 'student@example.com',
      stripeCustomerId: 'cus_test_123',
    })
  })

  it('invoking handlePaymentIntentSucceeded twice with the same eventId creates exactly one Enrollment, one StripePayment, one SlackInvite, and one EmailLog', async () => {
    const eventId = 'evt_idempotent_001'
    const piData = {
      id:       'pi_test_123',
      amount:   29900,
      currency: 'usd',
      metadata: {
        planType:  'ONE_TIME',
        studentId: studentId.toString(),
        cohortId:  cohortId.toString(),
      },
    }

    // First invocation — all side effects fire, all docs inserted.
    await __testables.handlePaymentIntentSucceeded(eventId, piData as unknown as Record<string, unknown>)

    expect(enrollmentStore.docs).toHaveLength(1)
    expect(stripePaymentStore.docs).toHaveLength(1)
    expect(slackInviteStore.docs).toHaveLength(1)
    expect(emailLogStore.docs).toHaveLength(1)

    // Keys match the expected `{eventId}:{operation}` format.
    expect(enrollmentStore.docs[0]!['idempotencyKey']).toBe(`${eventId}:create-enrollment`)
    expect(stripePaymentStore.docs[0]!['idempotencyKey']).toBe(`${eventId}:create-stripe-payment`)
    expect(slackInviteStore.docs[0]!['idempotencyKey']).toBe(`${eventId}:slack-invite`)
    expect(emailLogStore.docs[0]!['idempotencyKey']).toBe(`${eventId}:send-welcome-email`)

    // Second invocation (simulating BullMQ retry after mid-process crash) —
    // every side effect should be a no-op at the storage layer.
    await __testables.handlePaymentIntentSucceeded(eventId, piData as unknown as Record<string, unknown>)

    expect(enrollmentStore.docs).toHaveLength(1)
    expect(stripePaymentStore.docs).toHaveLength(1)
    expect(slackInviteStore.docs).toHaveLength(1)
    expect(emailLogStore.docs).toHaveLength(1)
  })

  it('key format is `{eventId}:{operation}` — verified via idemKey helper', () => {
    expect(__testables.idemKey('evt_abc', 'create-enrollment')).toBe('evt_abc:create-enrollment')
    expect(__testables.idemKey('evt_xyz', 'slack-invite')).toBe('evt_xyz:slack-invite')
  })
})
