/**
 * Regression test for the email-notifications type/shape mismatch.
 *
 * Producers (enrollmentService, stripeWebhookWorker, manual-payment routes,
 * certificate issuer, admin course routes) enqueue UPPERCASE `type` values
 * with `studentId`/`cohortId` fields. The worker previously only matched
 * lowercase types with `userId`/`cohortName`, so every one of these jobs was
 * silently dropped (hit the `default` branch and reported success).
 *
 * These tests assert the worker now:
 *   - accepts `studentId` as the recipient and resolves `cohortId` → name,
 *   - handles all UPPERCASE types the codebase actually emits,
 *   - stamps the pre-created EmailLog row SENT via idempotencyKey,
 *   - skips a re-delivery whose idempotencyKey is already SENT.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  users:      new Map<string, { email: string }>(),
  cohorts:    new Map<string, { name: string; startDate: Date }>(),
  sentKeys:   new Set<string>(),
  sendEmail:  vi.fn().mockResolvedValue(undefined),
  updateOne:  vi.fn().mockResolvedValue({ acknowledged: true }),
}))

vi.mock('bullmq', () => ({
  Worker: class { on = vi.fn(); constructor(_n: string, _h: unknown, _o?: unknown) {} },
  Queue:  class { add = vi.fn(); constructor(_n: string, _o?: unknown) {} },
}))

vi.mock('../lib/redis.js', () => ({
  redis: { on: vi.fn(), duplicate: vi.fn() },
  bullMQConnection: { host: 'localhost', port: 6379 },
}))

vi.mock('../lib/mailer.js', () => ({
  sendEmail: (...args: unknown[]) => state.sendEmail(...args),
}))

vi.mock('../models/User.js', () => ({
  User: {
    findById: (id: string) => ({
      select: () => ({ lean: async () => state.users.get(id) ?? null }),
    }),
  },
}))

vi.mock('../models/Cohort.js', () => ({
  Cohort: {
    findById: (id: string) => ({
      select: () => ({ lean: async () => state.cohorts.get(id) ?? null }),
    }),
  },
}))

vi.mock('../models/EmailLog.js', () => ({
  EmailLog: {
    findOne: (q: { idempotencyKey?: string; status?: string }) => ({
      lean: async () =>
        q.idempotencyKey && q.status === 'SENT' && state.sentKeys.has(q.idempotencyKey)
          ? { _id: 'x' }
          : null,
    }),
    updateOne: (q: unknown, u: unknown) => {
      state.updateOne(q, u)
      return Promise.resolve({ acknowledged: true })
    },
  },
}))

import { processNotificationJob } from '../workers/notificationWorker.js'

beforeEach(() => {
  state.users.clear()
  state.cohorts.clear()
  state.sentKeys.clear()
  state.sendEmail.mockClear()
  state.updateOne.mockClear()
})

describe('notificationWorker — UPPERCASE producer shapes (regression)', () => {
  it('ENROLLMENT_CONFIRMED with studentId + cohortId resolves recipient + cohort name', async () => {
    state.users.set('s1', { email: 'stu@example.com' })
    state.cohorts.set('c1', { name: 'AI Cohort 3', startDate: new Date('2026-09-01T00:00:00Z') })

    await processNotificationJob({
      type: 'ENROLLMENT_CONFIRMED',
      studentId: 's1',
      cohortId: 'c1',
    })

    expect(state.sendEmail).toHaveBeenCalledOnce()
    const [to, subject, html] = state.sendEmail.mock.calls[0]!
    expect(to).toBe('stu@example.com')
    expect(subject).toBe("You're enrolled in AI Cohort 3!")
    expect(html).toContain('AI Cohort 3')
    expect(html).toContain('September 1, 2026')
  })

  it('PAYMENT_FAILED sends the dunning email with grace period', async () => {
    state.users.set('s2', { email: 'late@example.com' })
    state.cohorts.set('c2', { name: 'Builders', startDate: new Date('2026-01-01T00:00:00Z') })

    await processNotificationJob({
      type: 'PAYMENT_FAILED',
      studentId: 's2',
      cohortId: 'c2',
      gracePeriodHours: 48,
    })

    const [, subject, html] = state.sendEmail.mock.calls[0]!
    expect(subject).toContain('Builders')
    expect(html).toContain('48 hours')
  })

  it('CERTIFICATE_ISSUED includes the credential id', async () => {
    state.users.set('s3', { email: 'grad@example.com' })
    state.cohorts.set('c3', { name: 'Capstone', startDate: new Date('2026-01-01T00:00:00Z') })

    await processNotificationJob({
      type: 'CERTIFICATE_ISSUED',
      studentId: 's3',
      cohortId: 'c3',
      credentialId: 'NAB-2026-0042',
    })

    const html = state.sendEmail.mock.calls[0]![2] as string
    expect(html).toContain('NAB-2026-0042')
  })

  it('ENROLLMENT_SUSPENDED sends with reason (studentId, no cohortId)', async () => {
    state.users.set('s4', { email: 'susp@example.com' })

    await processNotificationJob({
      type: 'ENROLLMENT_SUSPENDED',
      studentId: 's4',
      reason: 'Chargeback received',
    })

    const [, , html] = state.sendEmail.mock.calls[0]!
    expect(state.sendEmail).toHaveBeenCalledOnce()
    expect(html).toContain('Chargeback received')
  })

  it('stamps the EmailLog row SENT when an idempotencyKey is present', async () => {
    state.users.set('s5', { email: 'idem@example.com' })
    state.cohorts.set('c5', { name: 'Idem Cohort', startDate: new Date('2026-01-01T00:00:00Z') })

    await processNotificationJob({
      type: 'ENROLLMENT_CONFIRMED',
      studentId: 's5',
      cohortId: 'c5',
      idempotencyKey: 'evt_abc:send-welcome-email',
    })

    expect(state.sendEmail).toHaveBeenCalledOnce()
    expect(state.updateOne).toHaveBeenCalledWith(
      { idempotencyKey: 'evt_abc:send-welcome-email' },
      { $set: { status: 'SENT', sentAt: expect.any(Date) } },
    )
  })

  it('skips re-delivery when the idempotencyKey is already SENT', async () => {
    state.users.set('s6', { email: 'dup@example.com' })
    state.sentKeys.add('evt_dup:send-welcome-email')

    await processNotificationJob({
      type: 'ENROLLMENT_CONFIRMED',
      studentId: 's6',
      cohortId: 'c6',
      idempotencyKey: 'evt_dup:send-welcome-email',
    })

    expect(state.sendEmail).not.toHaveBeenCalled()
  })

  it('escapes HTML in cohort name / reason (injection guard)', async () => {
    state.users.set('s7', { email: 'xss@example.com' })

    await processNotificationJob({
      type: 'MANUAL_PAYMENT_REJECTED',
      studentId: 's7',
      cohortName: '<script>alert(1)</script>',
      reason: '<img src=x onerror=alert(2)>',
    })

    const html = state.sendEmail.mock.calls[0]![2] as string
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img')
  })
})
