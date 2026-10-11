/**
 * Sprint 2 Story 10 (GAP-036) — upstream idempotency guard.
 *
 * Scope:
 *   The Wave 2 story K test verifies the *per-operation* idempotency keys on
 *   the side-effect models. This story adds a coarser, event-level guard —
 *   the ProcessedStripeEvent collection — that short-circuits the handler
 *   switch before any side effects run when the same stripeEventId has
 *   already been processed.
 *
 *   This test calls `processEventWithGuard` directly:
 *     1. Seed a SUCCESS ProcessedStripeEvent row.
 *     2. Invoke the guard with the matching eventId.
 *     3. Assert no side effects run (handler spy count = 0).
 *     4. Assert the function returns successfully (no exception).
 *
 *   Also verifies the happy-path: a fresh eventId proceeds through the
 *   handler and is recorded with outcome=SUCCESS at the end.
 *
 * What we mock:
 *   - bullmq        → Queue.add is a spy, no real Redis
 *   - ../lib/redis  → bullMQConnection stub
 *   - All side-effect models (so we can assert zero writes on replay)
 *   - ProcessedStripeEvent — backed by an in-memory store
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

// ── In-memory stores (hoisted so mock factories can capture them) ────────

const stores = vi.hoisted(() => {
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

  function makeStore() {
    const docs: Array<Record<string, unknown>> = []
    return {
      docs,
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
        if (existing && update.$set) Object.assign(existing, update.$set)
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
    enrollment:    makeStore(),
    stripePayment: makeStore(),
    slackInvite:   makeStore(),
    emailLog:      makeStore(),
    user:          makeStore(),
    processed:     makeStore(),
  }
})

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
vi.mock('../models/CohortMembership.js', () => ({
  CohortMembership: { findOneAndUpdate: vi.fn(() => Promise.resolve(null)) },
}))
vi.mock('../models/StripePayment.js', () => ({ StripePayment: stores.stripePayment }))
vi.mock('../models/SlackInvite.js', () => ({ SlackInvite: stores.slackInvite }))
vi.mock('../models/EmailLog.js', () => ({ EmailLog: stores.emailLog }))
vi.mock('../models/ProcessedStripeEvent.js', () => ({ ProcessedStripeEvent: stores.processed }))

// User chain: findById(...).select(...).lean()
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

// Cohort + installment reminder worker — avoid touching real BullMQ / mongoose.
vi.mock('../models/Cohort.js', () => ({ Cohort: { findById: () => ({ select: () => ({ lean: async () => null }) }) } }))
vi.mock('../workers/installmentReminderWorker.js', () => ({
  scheduleInstallmentReminders: vi.fn().mockResolvedValue(undefined),
}))

// ── Import AFTER mocks ───────────────────────────────────────────────────
import { __testables } from '../workers/stripeWebhookWorker.js'

// ── Tests ────────────────────────────────────────────────────────────────

describe('stripeWebhookWorker — upstream idempotency guard (Sprint 2 Story 10 / GAP-036)', () => {
  let studentId: Types.ObjectId
  let cohortId:  Types.ObjectId

  beforeEach(() => {
    Object.values(stores).forEach((s) => {
      s.docs.length = 0
    })

    studentId = new Types.ObjectId()
    cohortId  = new Types.ObjectId()

    stores.user.docs.push({
      _id: studentId,
      email: 'student@example.com',
      stripeCustomerId: 'cus_test_123',
    })
  })

  it('skips processing entirely when ProcessedStripeEvent already has a SUCCESS row', async () => {
    const eventId = 'evt_already_processed_001'

    // Seed a SUCCESS row — simulating a previously completed run.
    stores.processed.docs.push({
      _id: new Types.ObjectId(),
      stripeEventId: eventId,
      eventType:     'payment_intent.succeeded',
      outcome:       'SUCCESS',
      processedAt:   new Date(),
    })

    const piData = {
      id:       'pi_test_skipped',
      amount:   29900,
      currency: 'usd',
      metadata: {
        planType:  'ONE_TIME',
        studentId: studentId.toString(),
        cohortId:  cohortId.toString(),
      },
    }

    // Invoke the guard — should short-circuit without calling any side effects.
    await expect(
      __testables.processEventWithGuard(
        eventId,
        'payment_intent.succeeded',
        piData as unknown as Record<string, unknown>,
        'job-id-1',
      ),
    ).resolves.toBeUndefined()

    // No Enrollment / StripePayment / etc should have been written.
    expect(stores.enrollment.docs).toHaveLength(0)
    expect(stores.stripePayment.docs).toHaveLength(0)
    expect(stores.slackInvite.docs).toHaveLength(0)
    expect(stores.emailLog.docs).toHaveLength(0)

    // The pre-seeded ProcessedStripeEvent row is still the only one.
    expect(stores.processed.docs).toHaveLength(1)
    expect(stores.processed.docs[0]!['outcome']).toBe('SUCCESS')
  })

  it('processes a fresh event end-to-end and records a ProcessedStripeEvent SUCCESS row', async () => {
    const eventId = 'evt_fresh_002'
    const piData = {
      id:       'pi_test_fresh',
      amount:   29900,
      currency: 'usd',
      metadata: {
        planType:  'ONE_TIME',
        studentId: studentId.toString(),
        cohortId:  cohortId.toString(),
      },
    }

    await __testables.processEventWithGuard(
      eventId,
      'payment_intent.succeeded',
      piData as unknown as Record<string, unknown>,
      'job-id-2',
    )

    // Side effects ran exactly once.
    expect(stores.enrollment.docs).toHaveLength(1)
    expect(stores.stripePayment.docs).toHaveLength(1)

    // ProcessedStripeEvent was upserted with SUCCESS outcome.
    expect(stores.processed.docs).toHaveLength(1)
    const row = stores.processed.docs[0]!
    expect(row['stripeEventId']).toBe(eventId)
    expect(row['eventType']).toBe('payment_intent.succeeded')
    expect(row['outcome']).toBe('SUCCESS')
  })

  it('on handler exception records ProcessedStripeEvent with outcome=FAILED and re-throws', async () => {
    const eventId = 'evt_failing_003'

    // Craft a payload that will trigger an exception inside the handler —
    // a missing cohortId with an otherwise valid ONE_TIME shape makes the
    // worker log+return, not throw. Instead, force the exception by
    // stubbing the enrollment upsert to throw.
    const originalFindOneAndUpdate = stores.enrollment.findOneAndUpdate
    stores.enrollment.findOneAndUpdate = (async () => {
      throw new Error('simulated DB failure')
    }) as typeof stores.enrollment.findOneAndUpdate

    try {
      await expect(
        __testables.processEventWithGuard(
          eventId,
          'payment_intent.succeeded',
          {
            id: 'pi_fail',
            amount: 100,
            currency: 'usd',
            metadata: {
              planType:  'ONE_TIME',
              studentId: studentId.toString(),
              cohortId:  cohortId.toString(),
            },
          } as unknown as Record<string, unknown>,
          'job-id-3',
        ),
      ).rejects.toThrow('simulated DB failure')
    } finally {
      stores.enrollment.findOneAndUpdate = originalFindOneAndUpdate
    }

    // A FAILED row was recorded so operators can inspect.
    expect(stores.processed.docs).toHaveLength(1)
    expect(stores.processed.docs[0]!['outcome']).toBe('FAILED')
    expect(stores.processed.docs[0]!['stripeEventId']).toBe(eventId)
  })
})
