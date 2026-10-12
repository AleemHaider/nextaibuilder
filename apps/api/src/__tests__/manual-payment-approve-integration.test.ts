/**
 * Integration test for POST /admin/manual-payments/:id/approve.
 *
 * Why this exists
 * ---------------
 * The unit tests already cover:
 *   - enrollment-service.test.ts: activateEnrollment internals (mocked models)
 *   - stripe-webhook-worker-idempotency.test.ts: Stripe → service end-to-end
 *
 * What's missing: the *manual-payment* path through the same service.
 * That path is the one with the historical re-click duplicate-invite
 * regression that the service extraction was meant to kill — we owe it
 * a real wiring test rather than trusting symmetry with Stripe.
 *
 * Strategy
 * --------
 * Build a fake FastifyInstance + drive the route handler directly.
 * Stub the Mongoose models and BullMQ queue with in-memory doubles that
 * enforce the same uniqueness invariants the production indexes do.
 * Call the handler twice with the same :id (simulating a re-click) and
 * assert exactly one Enrollment row, one SlackInvite row, one EmailLog
 * row come out.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Types } from 'mongoose'

// ── In-memory model state ──────────────────────────────────────────────────

const state = vi.hoisted(() => ({
  manualRequests: new Map<string, Record<string, unknown> & { save: () => Promise<void> }>(),
  enrollments:    [] as Array<Record<string, unknown>>,
  slackInvites:   new Map<string, Record<string, unknown>>(),
  emailLogs:      new Map<string, Record<string, unknown>>(),
  users:          new Map<string, { _id: Types.ObjectId; email: string }>(),
  queueJobs: {
    'slack-invite-queue':  [] as Array<{ jobName: string; payload: Record<string, unknown> }>,
    'email-notifications': [] as Array<{ jobName: string; payload: Record<string, unknown> }>,
  } as Record<string, Array<{ jobName: string; payload: Record<string, unknown> }>>,
}))

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../middleware/authenticate.js', () => ({
  authenticate: async () => undefined,
}))

vi.mock('../middleware/require-permission.js', () => ({
  requirePermission: () => async () => undefined,
}))

vi.mock('../models/ManualPaymentRequest.js', () => ({
  ManualPaymentRequest: {
    findOne: vi.fn((filter: { _id: Types.ObjectId; status: string }) => {
      const doc = state.manualRequests.get(String(filter._id))
      // Mirror the production query: only return the row if its status matches.
      if (doc && (doc['status'] as string) === filter.status) return Promise.resolve(doc)
      return Promise.resolve(null)
    }),
    // Atomic claim: flip PENDING→APPROVED and return the doc, or null if the
    // status no longer matches (concurrent / repeat approval).
    findOneAndUpdate: vi.fn((
      filter: { _id: Types.ObjectId; status: string },
      update: { $set: Record<string, unknown> },
    ) => {
      const doc = state.manualRequests.get(String(filter._id))
      if (!doc || (doc['status'] as string) !== filter.status) return Promise.resolve(null)
      Object.assign(doc, update.$set)
      return Promise.resolve(doc)
    }),
  },
}))

vi.mock('../models/User.js', () => ({
  User: {
    findById: (id: unknown) => ({
      select: () => ({
        lean: async () => state.users.get(String(id)) ?? null,
      }),
    }),
  },
}))

vi.mock('../models/Enrollment.js', () => ({
  Enrollment: {
    findOne: vi.fn((filter: { studentId: Types.ObjectId; cohortId: Types.ObjectId }) => {
      const key = `${String(filter.studentId)}:${String(filter.cohortId)}`
      return Promise.resolve(state.enrollments.find((r) => (r as { _key: string })._key === key) ?? null)
    }),
    findOneAndUpdate: vi.fn((
      filter: { studentId: Types.ObjectId; cohortId: Types.ObjectId },
      update: { $set: Record<string, unknown>; $setOnInsert: Record<string, unknown> },
    ) => {
      const key = `${String(filter.studentId)}:${String(filter.cohortId)}`
      let row = state.enrollments.find((r) => (r as { _key: string })._key === key)
      if (!row) {
        row = {
          _key: key,
          _id:  new Types.ObjectId(),
          ...update.$setOnInsert,
          ...update.$set,
        }
        state.enrollments.push(row)
      } else {
        // $set always runs on existing rows; $setOnInsert is ignored.
        Object.assign(row, update.$set)
      }
      return Promise.resolve(row)
    }),
  },
}))

vi.mock('../models/SlackInvite.js', () => ({
  SlackInvite: {
    findOneAndUpdate: vi.fn((
      filter: { idempotencyKey: string },
      update: { $setOnInsert: Record<string, unknown> },
    ) => {
      let row = state.slackInvites.get(filter.idempotencyKey)
      if (!row) {
        row = {
          _id: new Types.ObjectId(),
          ...update.$setOnInsert,
          idempotencyKey: filter.idempotencyKey,
        }
        state.slackInvites.set(filter.idempotencyKey, row)
      }
      return Promise.resolve(row)
    }),
  },
}))

vi.mock('../models/CohortMembership.js', () => ({
  CohortMembership: {
    // Legacy-dashboard mirror upsert inside activateEnrollment — resolves
    // without touching a real connection.
    findOneAndUpdate: vi.fn(() => Promise.resolve(null)),
  },
}))

vi.mock('../models/EmailLog.js', () => ({
  EmailLog: {
    findOne: (filter: { idempotencyKey: string }) => ({
      lean: async () => state.emailLogs.get(filter.idempotencyKey) ?? null,
    }),
    create: vi.fn(async (doc: Record<string, unknown>) => {
      const key = doc['idempotencyKey'] as string
      if (state.emailLogs.has(key)) {
        // Mirror MongoDB's unique-index E11000 on a duplicate insert.
        const err = new Error('E11000 duplicate key') as Error & { code: number }
        err.code = 11000
        throw err
      }
      state.emailLogs.set(key, doc)
      return doc
    }),
  },
}))

vi.mock('bullmq', () => ({
  Queue: function MockQueue(name: string) {
    return {
      add: vi.fn((jobName: string, payload: Record<string, unknown>) => {
        if (!state.queueJobs[name]) state.queueJobs[name] = []
        state.queueJobs[name].push({ jobName, payload })
        return Promise.resolve({ id: `job-${state.queueJobs[name].length}` })
      }),
    }
  },
  Worker: function () { return { on: vi.fn() } },
}))

vi.mock('../lib/redis.js', () => ({
  bullMQConnection: { host: 'localhost', port: 6379 },
  redis:            { get: vi.fn(), set: vi.fn() },
}))

vi.mock('../lib/s3.js', () => ({
  getPresignedReadUrl: vi.fn().mockResolvedValue('https://s3.test/presigned'),
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}))

// ── Imports after mocks ────────────────────────────────────────────────────

import { adminManualPaymentsRoutes } from '../routes/admin/manual-payments.js'

// ── Fake Fastify ───────────────────────────────────────────────────────────

type FakeReply = {
  _status: number | null
  _body:   unknown
  code:    (s: number) => FakeReply
  send:    (b: unknown) => FakeReply
}

function makeReply(): FakeReply {
  const reply: FakeReply = {
    _status: null,
    _body:   undefined,
    code(s)  { reply._status = s; return reply },
    send(b)  { reply._body = b;  return reply },
  }
  return reply
}

function makeRequest(opts: {
  params?: Record<string, string>
  body?:   Record<string, unknown>
  user?:   Record<string, string>
}): FastifyRequest {
  return {
    params: opts.params ?? {},
    body:   opts.body   ?? {},
    user:   opts.user   ?? { sub: ADMIN_ID, role: 'SUPER_ADMIN' },
  } as unknown as FastifyRequest
}

async function buildHandlers() {
  const handlers: Record<string, ((...args: unknown[]) => Promise<unknown>)[]> = {}
  const fastify = {
    get:  vi.fn(),
    post: vi.fn().mockImplementation((path: string, _opts: unknown, handler: (...a: unknown[]) => Promise<unknown>) => {
      if (!handlers[`POST:${path}`]) handlers[`POST:${path}`] = []
      handlers[`POST:${path}`].push(handler)
    }),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as FastifyInstance

  await adminManualPaymentsRoutes(fastify)
  return handlers
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const ADMIN_ID    = new Types.ObjectId().toString()
const STUDENT_ID  = new Types.ObjectId().toString()
const COHORT_ID   = new Types.ObjectId().toString()

function seedManualRequest(opts: { id?: string; status?: string } = {}) {
  const _id = opts.id ? new Types.ObjectId(opts.id) : new Types.ObjectId()
  const doc = {
    _id,
    studentId:        new Types.ObjectId(STUDENT_ID),
    cohortId:         new Types.ObjectId(COHORT_ID),
    paymentPlanId:    null as Types.ObjectId | null,
    status:           opts.status ?? 'PENDING',
    reviewedBy:       null as Types.ObjectId | null,
    reviewedAt:       null as Date | null,
    rejectionReason:  null as string | null,
    enrollmentId:     null as Types.ObjectId | null,
    save: vi.fn(async function (this: Record<string, unknown>) { /* in-memory */ }),
  }
  state.manualRequests.set(_id.toString(), doc as Record<string, unknown> & { save: () => Promise<void> })
  state.users.set(STUDENT_ID, { _id: new Types.ObjectId(STUDENT_ID), email: 'student@example.com' })
  return doc
}

beforeEach(() => {
  state.manualRequests.clear()
  state.enrollments.length = 0
  state.slackInvites.clear()
  state.emailLogs.clear()
  state.users.clear()
  for (const k of Object.keys(state.queueJobs)) state.queueJobs[k].length = 0
})

// ── The integration test ──────────────────────────────────────────────────

describe('POST /admin/manual-payments/:id/approve — service integration', () => {

  it('H-10: links to an existing ACTIVE/PAID enrollment without re-activating (no double-charge overwrite)', async () => {
    const handlers = await buildHandlers()
    const handle = handlers['POST:/:id/approve'][0] as
      (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

    // Student already paid (e.g. via Stripe) → active, paid enrollment exists.
    const existingId = new Types.ObjectId()
    state.enrollments.push({
      _key:          `${STUDENT_ID}:${COHORT_ID}`,
      _id:           existingId,
      status:        'ACTIVE',
      paymentStatus: 'PAID',
      paymentMethod: 'STRIPE',
    } as unknown as Record<string, unknown>)

    const doc = seedManualRequest()
    const reply = makeReply()
    await handle(
      makeRequest({ params: { id: doc._id.toString() }, body: {} }),
      reply as unknown as FastifyReply,
    )

    expect(reply._status).toBe(200)
    expect((reply._body as { alreadyEnrolled?: boolean }).alreadyEnrolled).toBe(true)
    expect((reply._body as { enrollmentId: string }).enrollmentId).toBe(existingId.toString())

    // Request was claimed + linked to the existing enrollment.
    expect(doc.status).toBe('APPROVED')
    expect(doc.enrollmentId?.toString()).toBe(existingId.toString())

    // Crucially: NO re-activation → no overwrite, no duplicate side effects.
    expect(state.enrollments).toHaveLength(1)
    expect(state.slackInvites.size).toBe(0)
    expect(state.emailLogs.size).toBe(0)
    expect(state.queueJobs['email-notifications']).toHaveLength(0)
  })

  it('happy path: 200 + Enrollment + Slack invite + approval email', async () => {
    const handlers = await buildHandlers()
    const handle = handlers['POST:/:id/approve'][0] as
      (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

    const doc = seedManualRequest()
    const req = makeRequest({ params: { id: doc._id.toString() }, body: { note: 'looks good' } })
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(200)
    expect((reply._body as { success: boolean; enrollmentId: string }).success).toBe(true)
    expect(typeof (reply._body as { enrollmentId: string }).enrollmentId).toBe('string')

    // The manual-payment row was flipped to APPROVED + linked.
    expect(doc.status).toBe('APPROVED')
    expect(doc.reviewedBy?.toString()).toBe(ADMIN_ID)
    expect(doc.rejectionReason).toBe('looks good')  // optional note stored
    expect(doc.enrollmentId).not.toBeNull()
    expect(doc.save).toHaveBeenCalled()

    // Exactly one of each side-effect row.
    expect(state.enrollments).toHaveLength(1)
    expect(state.slackInvites.size).toBe(1)
    expect(state.emailLogs.size).toBe(1)

    // Idempotency-key suffixes use the manual-payment-request scope.
    const scopePrefix = `manual-payment-request:${doc._id.toString()}`
    expect([...state.slackInvites.keys()][0]).toBe(`${scopePrefix}:slack-invite`)
    expect([...state.emailLogs.keys()][0]).toBe(`${scopePrefix}:send-welcome-email`)

    // Queues each saw exactly one enqueue.
    expect(state.queueJobs['slack-invite-queue']).toHaveLength(1)
    expect(state.queueJobs['email-notifications']).toHaveLength(1)
    expect(state.queueJobs['email-notifications'][0]).toMatchObject({
      jobName: 'manual-payment-approved',
      payload: expect.objectContaining({ type: 'MANUAL_PAYMENT_APPROVED' }),
    })
  })

  it('re-click protection: second Approve on the same id produces no duplicate side effects', async () => {
    // Regression guard for the bug the service extraction was built to fix:
    // before the extraction, raw queue.add() calls fired on every click,
    // leaving the user with N Slack invites and N welcome emails for N clicks.
    const handlers = await buildHandlers()
    const handle = handlers['POST:/:id/approve'][0] as
      (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

    const doc = seedManualRequest()

    // First click — succeeds, flips status to APPROVED.
    await handle(
      makeRequest({ params: { id: doc._id.toString() }, body: {} }),
      makeReply() as unknown as FastifyReply,
    )

    // Snapshot the side-effect counts after the first call.
    const enrollmentsAfter1   = state.enrollments.length
    const slackInvitesAfter1  = state.slackInvites.size
    const emailLogsAfter1     = state.emailLogs.size
    const slackJobsAfter1     = state.queueJobs['slack-invite-queue'].length
    const emailJobsAfter1     = state.queueJobs['email-notifications'].length

    // Second click — the row is now APPROVED so the route's PENDING-only
    // findOne returns null and the handler short-circuits to 404. That's
    // the *outer* defense; the *inner* defense (the service idempotency
    // keys) is exercised by the Stripe replay test. Both layers are
    // belt-and-suspenders against the duplicate-invite regression.
    const reply2 = makeReply()
    await handle(
      makeRequest({ params: { id: doc._id.toString() }, body: {} }),
      reply2 as unknown as FastifyReply,
    )

    expect(reply2._status).toBe(404)
    expect((reply2._body as { error: string }).error).toBe('NOT_FOUND')

    // Crucially: no new side effects.
    expect(state.enrollments).toHaveLength(enrollmentsAfter1)
    expect(state.slackInvites.size).toBe(slackInvitesAfter1)
    expect(state.emailLogs.size).toBe(emailLogsAfter1)
    expect(state.queueJobs['slack-invite-queue']).toHaveLength(slackJobsAfter1)
    expect(state.queueJobs['email-notifications']).toHaveLength(emailJobsAfter1)
  })

  it('skips the Slack invite when the student has no email on file', async () => {
    const handlers = await buildHandlers()
    const handle = handlers['POST:/:id/approve'][0] as
      (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

    const doc = seedManualRequest()
    state.users.delete(STUDENT_ID)  // no email lookup hit

    await handle(
      makeRequest({ params: { id: doc._id.toString() }, body: {} }),
      makeReply() as unknown as FastifyReply,
    )

    // Enrollment + approval email still fire; Slack invite is the only step that needs email.
    expect(state.enrollments).toHaveLength(1)
    expect(state.emailLogs.size).toBe(1)
    expect(state.slackInvites.size).toBe(0)
    expect(state.queueJobs['slack-invite-queue']).toHaveLength(0)
  })

  it('rejects an invalid :id with 400 VALIDATION_ERROR before touching the DB', async () => {
    const handlers = await buildHandlers()
    const handle = handlers['POST:/:id/approve'][0] as
      (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

    const reply = makeReply()
    await handle(
      makeRequest({ params: { id: 'not-an-objectid' }, body: {} }),
      reply as unknown as FastifyReply,
    )

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
    expect(state.enrollments).toHaveLength(0)
  })

  it('rejects a non-existent request id with 404 NOT_FOUND', async () => {
    const handlers = await buildHandlers()
    const handle = handlers['POST:/:id/approve'][0] as
      (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

    const reply = makeReply()
    await handle(
      makeRequest({ params: { id: new Types.ObjectId().toString() }, body: {} }),
      reply as unknown as FastifyReply,
    )

    expect(reply._status).toBe(404)
    expect((reply._body as { error: string }).error).toBe('NOT_FOUND')
  })

  it('rejects a note longer than 1000 chars with 400 VALIDATION_ERROR (zod schema)', async () => {
    const handlers = await buildHandlers()
    const handle = handlers['POST:/:id/approve'][0] as
      (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

    const doc = seedManualRequest()
    const reply = makeReply()
    await handle(
      makeRequest({
        params: { id: doc._id.toString() },
        body:   { note: 'a'.repeat(1001) },
      }),
      reply as unknown as FastifyReply,
    )

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
    // No side effects because we bailed before activating.
    expect(state.enrollments).toHaveLength(0)
  })
})
