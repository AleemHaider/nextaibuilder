/**
 * Regression test for the lesson-complete gating + unlock (audit C-1 / C-2).
 *
 * C-1: POST /lessons/:id/complete had NO ordering check — a student could
 *      complete any lesson out of order and mint a certificate.
 * C-2: completing a lesson never unlocked the next one, so honest sequential
 *      progression was impossible.
 *
 * The handler now:
 *   - rejects completing lesson N when N-1 isn't COMPLETED (403 LESSON_LOCKED),
 *   - on success, unlocks lesson N+1 (IN_PROGRESS).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

vi.mock('../middleware/authenticate.js', () => ({ requireStudent: async () => undefined }))
vi.mock('../models/Lesson.js', () => ({ Lesson: { findOne: vi.fn(), find: vi.fn(), countDocuments: vi.fn() } }))
vi.mock('../models/Enrollment.js', () => ({ Enrollment: { findOne: vi.fn(), findByIdAndUpdate: vi.fn() } }))
vi.mock('../models/Cohort.js', () => ({ Cohort: { findOne: vi.fn() } }))
vi.mock('../models/Module.js', () => ({ Module: { find: vi.fn() } }))
vi.mock('../models/StudentLesson.js', () => ({
  StudentLesson: { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn(), countDocuments: vi.fn() },
}))
vi.mock('../models/LiveSession.js', () => ({ LiveSession: { find: vi.fn() } }))
vi.mock('../models/Certificate.js', () => ({ Certificate: { findOne: vi.fn(), create: vi.fn(), countDocuments: vi.fn() } }))
vi.mock('../models/PaymentPlan.js', () => ({ PaymentPlan: { findOne: vi.fn() } }))
vi.mock('../models/User.js', () => ({ User: { findById: vi.fn() } }))
vi.mock('../models/SetupStep.js', () => ({ SetupStep: { findById: vi.fn(), countDocuments: vi.fn() } }))
vi.mock('../models/StudentStep.js', () => ({ StudentStep: { findOne: vi.fn(), create: vi.fn(), findOneAndUpdate: vi.fn() } }))
vi.mock('../models/StepSubmission.js', () => ({ StepSubmission: { findOne: vi.fn(), create: vi.fn(), countDocuments: vi.fn() } }))
vi.mock('bullmq', () => ({
  Queue: function () { return { add: vi.fn().mockResolvedValue({ id: 'j' }) } },
  Worker: function () { return { on: vi.fn() } },
}))
vi.mock('../lib/redis.js', () => ({ bullMQConnection: {}, redis: {} }))
vi.mock('../lib/s3.js', () => ({
  buildS3Key: vi.fn(), getPresignedPutUrl: vi.fn(), getPresignedReadUrl: vi.fn(),
}))

import { Lesson } from '../models/Lesson.js'
import { Enrollment } from '../models/Enrollment.js'
import { Module } from '../models/Module.js'
import { StudentLesson } from '../models/StudentLesson.js'
import { studentLmsRoutes } from '../routes/student/lms.js'

const USER_ID   = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const COHORT_ID = 'dddddddddddddddddddddddd'
const MOD_ID    = 'eeeeeeeeeeeeeeeeeeeeeeee'
const L1        = 'b1b1b1b1b1b1b1b1b1b1b1b1'
const L2        = 'b2b2b2b2b2b2b2b2b2b2b2b2'
const ENR_ID    = 'c1c1c1c1c1c1c1c1c1c1c1c1'

const selLean = (v: unknown) => ({ select: () => ({ lean: () => Promise.resolve(v) }) })

function makeReply() {
  const r = { _status: null as number | null, _body: undefined as unknown,
    code(s: number) { r._status = s; return r }, send(b: unknown) { r._body = b; return r } }
  return r
}
function makeRequest(params: Record<string, string>): FastifyRequest {
  return { body: {}, params, user: { sub: USER_ID, role: 'STUDENT' } } as unknown as FastifyRequest
}
async function getCompleteHandler() {
  const handlers: Record<string, unknown> = {}
  const fastify = {
    get: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    post: vi.fn((path: string, _o: unknown, h: unknown) => { handlers[`POST:${path}`] = h }),
    log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  } as unknown as FastifyInstance
  await studentLmsRoutes(fastify)
  return handlers['POST:/lessons/:lessonId/complete'] as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  // Ordered lessons: L1 (order 0), L2 (order 1) in module MOD (order 0)
  vi.mocked(Lesson.find).mockReturnValue(selLean([
    { _id: L1, moduleId: MOD_ID, order: 0 },
    { _id: L2, moduleId: MOD_ID, order: 1 },
  ]) as never)
  vi.mocked(Module.find).mockReturnValue(selLean([{ _id: MOD_ID, order: 0 }]) as never)
  vi.mocked(Enrollment.findOne).mockResolvedValue({ _id: ENR_ID, studentId: USER_ID, cohortId: COHORT_ID, status: 'ACTIVE' } as never)
  vi.mocked(Enrollment.findByIdAndUpdate).mockResolvedValue({} as never)
  vi.mocked(StudentLesson.findOneAndUpdate).mockResolvedValue({} as never)
  vi.mocked(StudentLesson.updateOne).mockResolvedValue({} as never)
  vi.mocked(Lesson.countDocuments).mockResolvedValue(2 as never)
  vi.mocked(StudentLesson.countDocuments).mockResolvedValue(1 as never)
})

describe('POST /lessons/:lessonId/complete — sequential gating', () => {
  it('C-1: rejects completing lesson 2 when lesson 1 is not COMPLETED', async () => {
    vi.mocked(Lesson.findOne).mockReturnValue(selLean({ cohortId: COHORT_ID, moduleId: MOD_ID }) as never)
    // prev (L1) not completed
    vi.mocked(StudentLesson.findOne).mockReturnValue(selLean({ status: 'IN_PROGRESS' }) as never)

    const handler = await getCompleteHandler()
    const reply = makeReply()
    await handler(makeRequest({ lessonId: L2 }), reply as unknown as FastifyReply)

    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('LESSON_LOCKED')
    // must NOT have marked anything complete
    expect(StudentLesson.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('C-2: completing lesson 1 succeeds and unlocks lesson 2 (IN_PROGRESS)', async () => {
    vi.mocked(Lesson.findOne).mockReturnValue(selLean({ cohortId: COHORT_ID, moduleId: MOD_ID }) as never)

    const handler = await getCompleteHandler()
    const reply = makeReply()
    await handler(makeRequest({ lessonId: L1 }), reply as unknown as FastifyReply)

    expect((reply._body as { success: boolean }).success).toBe(true)
    expect((reply._body as { completionPercentage: number }).completionPercentage).toBe(50)

    // next lesson unlocked: upsert seeds IN_PROGRESS, and a LOCKED→IN_PROGRESS bump is issued
    const unlockUpsert = vi.mocked(StudentLesson.findOneAndUpdate).mock.calls.find(
      (c) => (c[1] as { $setOnInsert?: { lessonId?: string; status?: string } })?.$setOnInsert?.lessonId?.toString() === L2,
    )
    expect(unlockUpsert).toBeTruthy()
    expect((unlockUpsert![1] as { $setOnInsert: { status: string } }).$setOnInsert.status).toBe('IN_PROGRESS')

    const bump = vi.mocked(StudentLesson.updateOne).mock.calls.find(
      (c) => (c[0] as { status?: string; lessonId?: string })?.status === 'LOCKED',
    )
    expect(bump).toBeTruthy()
  })

  it('completing lesson 2 succeeds when lesson 1 IS COMPLETED', async () => {
    vi.mocked(Lesson.findOne).mockReturnValue(selLean({ cohortId: COHORT_ID, moduleId: MOD_ID }) as never)
    vi.mocked(StudentLesson.findOne).mockReturnValue(selLean({ status: 'COMPLETED' }) as never)

    const handler = await getCompleteHandler()
    const reply = makeReply()
    await handler(makeRequest({ lessonId: L2 }), reply as unknown as FastifyReply)

    expect(reply._status).toBeNull()
    expect((reply._body as { success: boolean }).success).toBe(true)
  })
})
