/**
 * Sprint 2 Story 10 (GAP-037) — Installment reminder emails.
 *
 * Verifies the enqueue contract for `scheduleInstallmentReminders`:
 *   - 3 jobs are enqueued on the installment-reminder-queue
 *   - Each carries `{ enrollmentId, installmentNumber: 1|2|3, dueAt }`
 *   - Delays are 30 / 60 / 90 days (in ms) from the anchor date
 *   - Each job has a deterministic jobId keyed by (enrollmentId, installmentNumber)
 *
 * Also verifies the per-job processor (`runInstallmentReminderJob`):
 *   - Skips when Enrollment is not ACTIVE (student cancelled)
 *   - Skips when an EmailLog with the idempotencyKey already exists
 *   - Writes an EmailLog with the expected idempotencyKey on happy path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

// ── In-memory stores ─────────────────────────────────────────────────────
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
          then: (o: (v: unknown) => unknown, r?: (e: unknown) => unknown) => resolvedPromise.then(o, r),
          catch: (r: (e: unknown) => unknown) => resolvedPromise.catch(r),
        }
      },
      findById: (id: unknown) => {
        const target = typeof id === 'string' ? new T.ObjectId(id) : id
        const doc = docs.find((d) => (d['_id'] as { equals: (o: unknown) => boolean }).equals(target)) ?? null
        // Support both .lean() and bare promise — chainable.
        const chain = {
          lean: async () => doc,
          select: () => ({
            lean: async () => doc,
          }),
          then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
            Promise.resolve(doc).then(onF, onR),
        }
        return chain
      },
      create: async (payload: Record<string, unknown>) => {
        const key = payload['idempotencyKey']
        if (typeof key === 'string' && docs.some((d) => d['idempotencyKey'] === key)) {
          const err = new Error('E11000') as Error & { code: number }
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
    enrollment:  makeStore(),
    cohort:      makeStore(),
    user:        makeStore(),
    emailLog:    makeStore(),
    paymentPlan: makeStore(),
  }
})

// Spy for queue.add — shared across tests via a hoisted handle.
const queueAddSpy = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'stub' }))

vi.mock('bullmq', () => {
  class Queue {
    add = queueAddSpy
    constructor(_n: string, _o?: unknown) {}
  }
  class Worker { on = vi.fn(); constructor(_n: string, _p?: unknown, _o?: unknown) {} }
  return { Queue, Worker }
})

vi.mock('../lib/redis.js', () => ({
  redis: { on: vi.fn() },
  bullMQConnection: { host: 'localhost', port: 6379 },
}))

vi.mock('../models/Enrollment.js', () => ({ Enrollment: stores.enrollment }))
vi.mock('../models/Cohort.js', () => ({ Cohort: stores.cohort }))
vi.mock('../models/User.js', () => ({ User: stores.user }))
vi.mock('../models/EmailLog.js', () => ({ EmailLog: stores.emailLog }))
vi.mock('../models/PaymentPlan.js', () => ({ PaymentPlan: stores.paymentPlan }))

const sendEmailSpy = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('../lib/mailer.js', () => ({ sendEmail: (...a: unknown[]) => sendEmailSpy(...a) }))

// ── Imports after mocks ──────────────────────────────────────────────────
import {
  scheduleInstallmentReminders,
  INSTALLMENT_REMINDER_DELAYS_MS,
  __testables,
} from '../workers/installmentReminderWorker.js'

const DAY_MS = 24 * 60 * 60 * 1000

describe('installment reminder worker (Sprint 2 Story 10 / GAP-037)', () => {
  beforeEach(() => {
    queueAddSpy.mockClear()
    sendEmailSpy.mockClear().mockResolvedValue(undefined)
    Object.values(stores).forEach((s) => { s.docs.length = 0 })
  })

  it('enqueues exactly 3 jobs with the expected delays and payload on scheduleInstallmentReminders', async () => {
    const enrollmentId = new Types.ObjectId()
    const anchor = new Date('2026-01-01T00:00:00.000Z')

    await scheduleInstallmentReminders(enrollmentId, anchor)

    expect(queueAddSpy).toHaveBeenCalledTimes(3)

    // Collect the 3 calls and sort by installmentNumber for stable assertions.
    const calls = queueAddSpy.mock.calls.slice().sort((a, b) => {
      const an = (a[1] as { installmentNumber: number }).installmentNumber
      const bn = (b[1] as { installmentNumber: number }).installmentNumber
      return an - bn
    })

    // ── installment 1 (30d) ────────────────────────────────────────────
    expect(calls[0]![0]).toBe('send-installment-reminder')
    expect(calls[0]![1]).toMatchObject({
      enrollmentId: enrollmentId.toString(),
      installmentNumber: 1,
      dueAt: new Date(anchor.getTime() + 30 * DAY_MS).toISOString(),
    })
    expect(calls[0]![2]).toMatchObject({
      delay: 30 * DAY_MS,
      jobId: `reminder-${enrollmentId.toString()}-1`,
    })

    // ── installment 2 (60d) ────────────────────────────────────────────
    expect(calls[1]![1]).toMatchObject({
      installmentNumber: 2,
      dueAt: new Date(anchor.getTime() + 60 * DAY_MS).toISOString(),
    })
    expect(calls[1]![2]).toMatchObject({ delay: 60 * DAY_MS, jobId: `reminder-${enrollmentId.toString()}-2` })

    // ── installment 3 (90d) ────────────────────────────────────────────
    expect(calls[2]![1]).toMatchObject({
      installmentNumber: 3,
      dueAt: new Date(anchor.getTime() + 90 * DAY_MS).toISOString(),
    })
    expect(calls[2]![2]).toMatchObject({ delay: 90 * DAY_MS, jobId: `reminder-${enrollmentId.toString()}-3` })
  })

  it('exposes INSTALLMENT_REMINDER_DELAYS_MS as [30d, 60d, 90d]', () => {
    expect(INSTALLMENT_REMINDER_DELAYS_MS).toEqual([30 * DAY_MS, 60 * DAY_MS, 90 * DAY_MS])
  })

  it('runInstallmentReminderJob skips when EmailLog already exists for the idempotencyKey', async () => {
    const enrollmentId = new Types.ObjectId()
    const idempotencyKey = `reminder-${enrollmentId.toString()}-2`

    // Seed an existing EmailLog — simulating a prior send.
    stores.emailLog.docs.push({
      _id: new Types.ObjectId(),
      idempotencyKey,
      emailType: 'URGENCY_REMINDER',
      status: 'SENT',
    })

    await __testables.runInstallmentReminderJob({
      enrollmentId: enrollmentId.toString(),
      installmentNumber: 2,
      dueAt: new Date().toISOString(),
    })

    // No new EmailLog inserted — still exactly the one we seeded.
    expect(stores.emailLog.docs).toHaveLength(1)
  })

  it('runInstallmentReminderJob skips when enrollment is no longer ACTIVE', async () => {
    const enrollmentId = new Types.ObjectId()
    const studentId    = new Types.ObjectId()

    stores.enrollment.docs.push({
      _id: enrollmentId,
      studentId,
      cohortId: new Types.ObjectId(),
      status: 'SUSPENDED',
      stripeSubscriptionId: 'sub_xyz',
    })

    await __testables.runInstallmentReminderJob({
      enrollmentId: enrollmentId.toString(),
      installmentNumber: 1,
      dueAt: new Date().toISOString(),
    })

    expect(stores.emailLog.docs).toHaveLength(0)
  })

  it('runInstallmentReminderJob writes an EmailLog with the idempotencyKey on happy path', async () => {
    const enrollmentId = new Types.ObjectId()
    const cohortId     = new Types.ObjectId()
    const studentId    = new Types.ObjectId()

    stores.enrollment.docs.push({
      _id: enrollmentId,
      studentId,
      cohortId,
      status: 'ACTIVE',
      stripeSubscriptionId: 'sub_happy',
    })
    stores.cohort.docs.push({
      _id: cohortId,
      name: 'Test Cohort',
    })
    stores.user.docs.push({
      _id: studentId,
      email: 'student@example.com',
    })

    await __testables.runInstallmentReminderJob({
      enrollmentId: enrollmentId.toString(),
      installmentNumber: 3,
      dueAt: new Date('2026-04-01').toISOString(),
    })

    // The email is actually sent (previously it was only logged, never sent).
    expect(sendEmailSpy).toHaveBeenCalledOnce()
    const [to, subject, html] = sendEmailSpy.mock.calls[0]!
    expect(to).toBe('student@example.com')
    expect(subject).toContain('Test Cohort')
    expect(html).toContain('installment 3 of 3')

    expect(stores.emailLog.docs).toHaveLength(1)
    const log = stores.emailLog.docs[0]!
    expect(log['idempotencyKey']).toBe(`reminder-${enrollmentId.toString()}-3`)
    expect(log['emailType']).toBe('URGENCY_REMINDER')
    expect(log['status']).toBe('SENT')
  })

  it('runInstallmentReminderJob does NOT stamp SENT when the send fails (so BullMQ can retry)', async () => {
    const enrollmentId = new Types.ObjectId()
    const cohortId     = new Types.ObjectId()
    const studentId    = new Types.ObjectId()

    stores.enrollment.docs.push({
      _id: enrollmentId, studentId, cohortId, status: 'ACTIVE', stripeSubscriptionId: 'sub_fail',
    })
    stores.cohort.docs.push({ _id: cohortId, name: 'Cohort' })
    stores.user.docs.push({ _id: studentId, email: 's@example.com' })
    sendEmailSpy.mockRejectedValueOnce(new Error('SMTP down'))

    await expect(
      __testables.runInstallmentReminderJob({
        enrollmentId: enrollmentId.toString(), installmentNumber: 1, dueAt: new Date().toISOString(),
      }),
    ).rejects.toThrow()

    // No EmailLog written → a retry will re-attempt the send.
    expect(stores.emailLog.docs).toHaveLength(0)
  })
})
