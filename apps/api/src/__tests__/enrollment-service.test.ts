/**
 * Unit tests for enrollmentService.{activateEnrollment, enqueueEmailWithIdempotency,
 * enqueueSlackInviteWithIdempotency} — the activation chain shared by the
 * Stripe webhook worker (FIR-43) and the manual-payment approval route (FIR-48).
 *
 * Existing coverage:
 *   • `stripe-webhook-worker-idempotency.test.ts` exercises the public surface
 *     end-to-end through the Stripe worker.
 *
 * What this file adds:
 *   • Direct unit coverage of the helpers (EmailLog / SlackInvite replay-safety).
 *   • The `studentEmail: null` branch (Slack invite skipped entirely).
 *   • The `SlackInvite.status === 'SENT'` early-return on replay.
 *   • The EmailLog duplicate-key race (E11000) swallow.
 *   • Idempotency-key suffix shape (`${scope}:slack-invite`,
 *     `${scope}:send-welcome-email`, `${scope}:create-enrollment`) — locked so
 *     a rename doesn't silently break replay matching against existing rows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

// ── Mock state ─────────────────────────────────────────────────────────────

const state = vi.hoisted(() => ({
  enrollmentUpserts: [] as Array<{ filter: unknown; update: unknown }>,
  emailLogs:         new Map<string, { idempotencyKey: string }>(),
  emailCreateCalls:  [] as Array<Record<string, unknown>>,
  emailCreateThrow:  null as Error | null,
  slackInvites:      new Map<string, { _id: Types.ObjectId; idempotencyKey: string; status: string }>(),
  // Captured BullMQ enqueues — keyed by queue name, value is array of {jobName, payload}.
  jobs: {
    'slack-invite-queue':  [] as Array<{ jobName: string; payload: Record<string, unknown> }>,
    'email-notifications': [] as Array<{ jobName: string; payload: Record<string, unknown> }>,
  } as Record<string, Array<{ jobName: string; payload: Record<string, unknown> }>>,
}))

vi.mock('../models/Enrollment.js', () => ({
  Enrollment: {
    findOneAndUpdate: vi.fn((filter: unknown, update: unknown) => {
      state.enrollmentUpserts.push({ filter, update })
      // Synthesize a hydrated-doc shape with an _id.
      const _id = new Types.ObjectId()
      return Promise.resolve({
        _id,
        studentId: (filter as { studentId: Types.ObjectId }).studentId,
        cohortId:  (filter as { cohortId: Types.ObjectId }).cohortId,
        status:    'ACTIVE',
        paymentStatus: 'PAID',
      })
    }),
  },
}))

vi.mock('../models/CohortMembership.js', () => ({
  CohortMembership: {
    // Legacy-dashboard mirror upsert — fire-and-forget from the service's
    // perspective; tests only need it to resolve.
    findOneAndUpdate: vi.fn(() => Promise.resolve(null)),
  },
}))

vi.mock('../models/EmailLog.js', () => ({
  EmailLog: {
    findOne: vi.fn((filter: unknown) => {
      const key = (filter as { idempotencyKey: string }).idempotencyKey
      const existing = state.emailLogs.get(key)
      return { lean: async () => existing ?? null }
    }),
    create: vi.fn(async (doc: Record<string, unknown>) => {
      if (state.emailCreateThrow) throw state.emailCreateThrow
      const key = doc['idempotencyKey'] as string
      if (state.emailLogs.has(key)) {
        const err = new Error('E11000 duplicate key') as Error & { code: number }
        err.code = 11000
        throw err
      }
      state.emailLogs.set(key, { idempotencyKey: key })
      state.emailCreateCalls.push(doc)
      return doc
    }),
  },
}))

vi.mock('../models/SlackInvite.js', () => ({
  SlackInvite: {
    findOneAndUpdate: vi.fn((filter: unknown, update: unknown) => {
      const key = (filter as { idempotencyKey: string }).idempotencyKey
      let doc = state.slackInvites.get(key)
      if (!doc) {
        const setOnInsert = (update as { $setOnInsert: Record<string, unknown> }).$setOnInsert
        doc = {
          _id: new Types.ObjectId(),
          idempotencyKey: key,
          status: (setOnInsert['status'] as string) ?? 'PENDING',
        }
        state.slackInvites.set(key, doc)
      }
      return Promise.resolve(doc)
    }),
  },
}))

vi.mock('bullmq', () => ({
  Queue: function MockQueue(name: string) {
    return {
      add: vi.fn((jobName: string, payload: Record<string, unknown>) => {
        if (!state.jobs[name]) state.jobs[name] = []
        state.jobs[name].push({ jobName, payload })
        return Promise.resolve({ id: `job-${state.jobs[name].length}` })
      }),
    }
  },
  Worker: function MockWorker() {
    return { on: vi.fn() }
  },
}))

vi.mock('../lib/redis.js', () => ({
  bullMQConnection: { host: 'localhost', port: 6379 },
  redis:            { get: vi.fn(), set: vi.fn() },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ── Imports after mocks ────────────────────────────────────────────────────

import {
  activateEnrollment,
  enqueueEmailWithIdempotency,
  enqueueSlackInviteWithIdempotency,
} from '../services/enrollmentService.js'

// ── Fixtures ───────────────────────────────────────────────────────────────

function fixedIds() {
  return {
    studentId: new Types.ObjectId(),
    cohortId:  new Types.ObjectId(),
  }
}

beforeEach(() => {
  state.enrollmentUpserts.length = 0
  state.emailLogs.clear()
  state.emailCreateCalls.length = 0
  state.emailCreateThrow = null
  state.slackInvites.clear()
  for (const k of Object.keys(state.jobs)) state.jobs[k].length = 0
})

// ── activateEnrollment ────────────────────────────────────────────────────

describe('enrollmentService — activateEnrollment', () => {

  it('upserts Enrollment + enqueues both Slack invite and welcome email on first call', async () => {
    const { studentId, cohortId } = fixedIds()

    await activateEnrollment({
      studentId,
      cohortId,
      paymentMethod:    'STRIPE',
      studentEmail:     'student@example.com',
      idempotencyScope: 'evt_abc',
      email: {
        jobName: 'process-notification',
        notificationType: 'WELCOME_AFTER_PAYMENT',
        extra: { eventId: 'evt_abc' },
      },
    })

    // Enrollment upsert — filter on (studentId, cohortId), $set status fields,
    // $setOnInsert pins the idempotencyKey to `${scope}:create-enrollment`.
    expect(state.enrollmentUpserts).toHaveLength(1)
    const { filter, update } = state.enrollmentUpserts[0] as {
      filter: { studentId: Types.ObjectId; cohortId: Types.ObjectId }
      update: { $set: Record<string, unknown>; $setOnInsert: Record<string, unknown> }
    }
    expect(String(filter.studentId)).toBe(String(studentId))
    expect(String(filter.cohortId)).toBe(String(cohortId))
    expect(update.$set['status']).toBe('ACTIVE')
    expect(update.$set['paymentStatus']).toBe('PAID')
    expect(update.$setOnInsert['idempotencyKey']).toBe('evt_abc:create-enrollment')

    // Slack invite enqueued with the right idempotency key suffix.
    expect(state.slackInvites.has('evt_abc:slack-invite')).toBe(true)
    expect(state.jobs['slack-invite-queue']).toHaveLength(1)
    expect(state.jobs['slack-invite-queue'][0]).toMatchObject({
      jobName: 'invite-to-slack',
      payload: expect.objectContaining({ email: 'student@example.com' }),
    })

    // Welcome email PENDING EmailLog created with the right key + enqueued.
    expect(state.emailLogs.has('evt_abc:send-welcome-email')).toBe(true)
    expect(state.jobs['email-notifications']).toHaveLength(1)
    expect(state.jobs['email-notifications'][0]).toMatchObject({
      jobName: 'process-notification',
      payload: expect.objectContaining({
        type:           'WELCOME_AFTER_PAYMENT',
        idempotencyKey: 'evt_abc:send-welcome-email',
        eventId:        'evt_abc',
      }),
    })
  })

  it('skips the Slack invite when studentEmail is null (no email to invite)', async () => {
    const { studentId, cohortId } = fixedIds()

    await activateEnrollment({
      studentId,
      cohortId,
      paymentMethod:    'MANUAL_RECEIPT',
      studentEmail:     null,
      idempotencyScope: 'manual-payment-request:abc',
      email: {
        jobName: 'process-notification',
        notificationType: 'MANUAL_PAYMENT_APPROVED',
      },
    })

    expect(state.slackInvites.size).toBe(0)
    expect(state.jobs['slack-invite-queue']).toHaveLength(0)
    // Email still goes out.
    expect(state.emailLogs.has('manual-payment-request:abc:send-welcome-email')).toBe(true)
    expect(state.jobs['email-notifications']).toHaveLength(1)
  })

  it('replay (same idempotencyScope twice) produces exactly one side-effect set', async () => {
    const { studentId, cohortId } = fixedIds()
    const args = {
      studentId,
      cohortId,
      paymentMethod:    'STRIPE' as const,
      studentEmail:     'student@example.com',
      idempotencyScope: 'evt_replay',
      email: {
        jobName: 'process-notification',
        notificationType: 'WELCOME_AFTER_PAYMENT',
      },
    }

    await activateEnrollment(args)
    await activateEnrollment(args)

    // Enrollment upserts run twice — but they're keyed on (studentId, cohortId)
    // so the row is the same; idempotency on writes is the DB's job.
    expect(state.enrollmentUpserts).toHaveLength(2)
    // Slack: second call finds the same idempotencyKey doc; queue add still
    // fires (the worker is the SENT gate), but the SlackInvite row count
    // stays at 1.
    expect(state.slackInvites.size).toBe(1)
    // Email: EmailLog already exists on replay → enqueue skipped entirely.
    expect(state.emailCreateCalls).toHaveLength(1)
    expect(state.jobs['email-notifications']).toHaveLength(1)
  })

  it('passes paymentPlanId and enrolledBy through to the $set update when provided', async () => {
    const { studentId, cohortId } = fixedIds()
    const planId = new Types.ObjectId()
    const adminId = new Types.ObjectId()

    await activateEnrollment({
      studentId,
      cohortId,
      paymentMethod:    'MANUAL_RECEIPT',
      paymentPlanId:    planId,
      enrolledBy:       adminId,
      studentEmail:     'a@b.com',
      idempotencyScope: 'manual-payment-request:xyz',
      email: {
        jobName: 'process-notification',
        notificationType: 'MANUAL_PAYMENT_APPROVED',
      },
    })

    const { update } = state.enrollmentUpserts[0] as {
      update: { $set: Record<string, unknown> }
    }
    expect(String(update.$set['paymentPlanId'])).toBe(String(planId))
    expect(String(update.$set['enrolledBy'])).toBe(String(adminId))
  })

  it('omits paymentPlanId / enrolledBy from $set when not provided (no nulls written)', async () => {
    const { studentId, cohortId } = fixedIds()

    await activateEnrollment({
      studentId,
      cohortId,
      paymentMethod:    'STRIPE',
      studentEmail:     'a@b.com',
      idempotencyScope: 'evt_no_plan',
      email: { jobName: 'process-notification', notificationType: 'WELCOME_AFTER_PAYMENT' },
    })

    const { update } = state.enrollmentUpserts[0] as {
      update: { $set: Record<string, unknown> }
    }
    expect(update.$set).not.toHaveProperty('paymentPlanId')
    expect(update.$set).not.toHaveProperty('enrolledBy')
  })
})

// ── enqueueSlackInviteWithIdempotency ─────────────────────────────────────

describe('enrollmentService — enqueueSlackInviteWithIdempotency', () => {

  it('skips the queue.add when the SlackInvite is already SENT (worker already delivered)', async () => {
    const { studentId } = fixedIds()
    const enrollmentId = new Types.ObjectId()
    const key = 'evt_sent:slack-invite'
    // Pre-seed a SENT invite — replay should be a no-op.
    state.slackInvites.set(key, {
      _id: new Types.ObjectId(), idempotencyKey: key, status: 'SENT',
    })

    await enqueueSlackInviteWithIdempotency(studentId, enrollmentId, 'a@b.com', key)

    expect(state.jobs['slack-invite-queue']).toHaveLength(0)
    // SlackInvite row preserved as-is — still exactly one entry, status SENT.
    expect(state.slackInvites.size).toBe(1)
    expect(state.slackInvites.get(key)!.status).toBe('SENT')
  })

  it('enqueues a fresh invite when no SlackInvite row exists yet', async () => {
    const { studentId } = fixedIds()
    const enrollmentId = new Types.ObjectId()

    await enqueueSlackInviteWithIdempotency(studentId, enrollmentId, 'a@b.com', 'fresh:slack-invite')

    expect(state.jobs['slack-invite-queue']).toHaveLength(1)
    const payload = state.jobs['slack-invite-queue'][0].payload as {
      slackInviteId: string; userId: string; email: string; enrollmentId: string
    }
    expect(payload.email).toBe('a@b.com')
    expect(payload.userId).toBe(String(studentId))
    expect(payload.enrollmentId).toBe(String(enrollmentId))
    expect(typeof payload.slackInviteId).toBe('string')
  })
})

// ── enqueueEmailWithIdempotency ───────────────────────────────────────────

describe('enrollmentService — enqueueEmailWithIdempotency', () => {

  it('skips when an EmailLog already exists for the key (replay-safe)', async () => {
    const { studentId } = fixedIds()
    const key = 'dupe:send-welcome-email'
    state.emailLogs.set(key, { idempotencyKey: key })

    await enqueueEmailWithIdempotency(
      studentId, 'WELCOME', key, 'process-notification', { type: 'WELCOME' },
    )

    expect(state.emailCreateCalls).toHaveLength(0)
    expect(state.jobs['email-notifications']).toHaveLength(0)
  })

  it('swallows E11000 duplicate-key race (another process won the insert)', async () => {
    const { studentId } = fixedIds()
    const key = 'race:send-welcome-email'
    // Simulate: findOne sees nothing → caller tries create() → DB rejects with 11000.
    state.emailCreateThrow = Object.assign(new Error('dup'), { code: 11000 })

    await expect(
      enqueueEmailWithIdempotency(
        studentId, 'WELCOME', key, 'process-notification', { type: 'WELCOME' },
      ),
    ).resolves.toBeUndefined()

    expect(state.jobs['email-notifications']).toHaveLength(0)
  })

  it('rethrows non-duplicate-key errors so the caller can fail the job', async () => {
    const { studentId } = fixedIds()
    state.emailCreateThrow = new Error('db down')

    await expect(
      enqueueEmailWithIdempotency(
        studentId, 'WELCOME', 'crash:send-welcome-email', 'process-notification', { type: 'WELCOME' },
      ),
    ).rejects.toThrow('db down')
  })

  it('threads idempotencyKey into the job payload so the worker can dedup downstream', async () => {
    const { studentId } = fixedIds()
    await enqueueEmailWithIdempotency(
      studentId, 'WELCOME', 'key123:send-welcome-email', 'process-notification',
      { type: 'WELCOME', extra: 1 },
    )

    expect(state.jobs['email-notifications']).toHaveLength(1)
    expect(state.jobs['email-notifications'][0].payload).toMatchObject({
      type: 'WELCOME',
      extra: 1,
      idempotencyKey: 'key123:send-welcome-email',
    })
  })
})
