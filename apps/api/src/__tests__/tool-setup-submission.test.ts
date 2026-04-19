// Sprint 2 Story 12 — Tool-setup screenshot validation (LMS adapter).
//
// Tests the new lesson-scoped endpoints added to student/lms.ts that wrap
// the existing PBA StepSubmission + screenshot-validation-queue plumbing.
//
// Contract exercised:
//   T1. POST /lessons/:lessonId/tool-setup-submission enqueues a BullMQ job
//       with { submissionId, s3Key, stepId, userId } and returns 201.
//   T2. Rejects when the lesson is not TOOL_SETUP → 400 NOT_TOOL_SETUP.
//   T3. Rejects when the lesson has no linked SetupStep → 409.
//   T4. Rejects when the student is not enrolled → 403 NOT_ENROLLED.
//   T5. IDOR guard — an s3Key that doesn't match the caller → 403 FORBIDDEN.
//   T6. GET /lessons/:lessonId/tool-setup-submission/latest maps DB statuses
//       (HUMAN_REVIEW, ML_PROCESSING) to the UI vocabulary (UNDER_REVIEW,
//       VALIDATING). This proves the dev-without-ANTHROPIC_API_KEY path
//       surfaces UNDER_REVIEW cleanly.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../middleware/authenticate.js', () => ({
  requireStudent: async () => undefined,
}))

vi.mock('../models/Lesson.js', () => ({
  Lesson: {
    findOne: vi.fn(),
    find:    vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock('../models/Enrollment.js', () => ({
  Enrollment: {
    find:    vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}))

vi.mock('../models/Cohort.js', () => ({
  Cohort: {
    findOne: vi.fn(),
  },
}))

vi.mock('../models/Module.js', () => ({
  Module: {
    find:    vi.fn(),
    findOne: vi.fn(),
  },
}))

vi.mock('../models/StudentLesson.js', () => ({
  StudentLesson: {
    findOne:          vi.fn(),
    find:             vi.fn(),
    findOneAndUpdate: vi.fn(),
    countDocuments:   vi.fn(),
  },
}))

vi.mock('../models/LiveSession.js', () => ({
  LiveSession: { find: vi.fn() },
}))

vi.mock('../models/Certificate.js', () => ({
  Certificate: {
    find:           vi.fn(),
    findOne:        vi.fn(),
    create:         vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock('../models/PaymentPlan.js', () => ({
  PaymentPlan: { findOne: vi.fn() },
}))

vi.mock('../models/User.js', () => ({
  User: {
    findById: vi.fn(),
  },
}))

vi.mock('../models/SetupStep.js', () => ({
  SetupStep: {
    findById: vi.fn(),
  },
}))

vi.mock('../models/StudentStep.js', () => ({
  StudentStep: {
    findOne:          vi.fn(),
    create:           vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}))

vi.mock('../models/StepSubmission.js', () => ({
  StepSubmission: {
    findOne:        vi.fn(),
    create:         vi.fn(),
    countDocuments: vi.fn(),
  },
}))

// BullMQ Queue — capture add() calls so we can assert enqueuing.
vi.mock('bullmq', () => {
  const add = vi.fn().mockResolvedValue({ id: 'job-001' })
  return {
    Queue: function MockQueue(_name: string, _opts: unknown) {
      return { add }
    },
    Worker: function MockWorker() { return { on: vi.fn() } },
    __queueAdd: add,
  }
})

vi.mock('../lib/redis.js', () => ({
  bullMQConnection: {},
  redis:            {},
}))

vi.mock('../lib/s3.js', () => ({
  buildS3Key: vi.fn((userId: string, stepId: string, attempt: number) =>
    `screenshots/${userId}/${stepId}/t-${attempt}.png`,
  ),
  getPresignedPutUrl:  vi.fn().mockResolvedValue('https://s3.test/put-url'),
  getPresignedReadUrl: vi.fn().mockResolvedValue('https://s3.test/read-url'),
}))

// ── Imports after mocks ────────────────────────────────────────────────────

import * as BullMQModule from 'bullmq'
import { Lesson } from '../models/Lesson.js'
import { Enrollment } from '../models/Enrollment.js'
import { StudentStep } from '../models/StudentStep.js'
import { StepSubmission } from '../models/StepSubmission.js'
import { studentLmsRoutes } from '../routes/student/lms.js'

const mockQueueAdd = (BullMQModule as unknown as {
  __queueAdd: ReturnType<typeof vi.fn>
}).__queueAdd

// ── Fake Fastify helpers ──────────────────────────────────────────────────

type FakeReply = {
  _status: number | null
  _body:   unknown
  code:    (s: number) => FakeReply
  send:    (b: unknown) => FakeReply
}

function makeReply(): FakeReply {
  const r: FakeReply = {
    _status: null,
    _body:   undefined,
    code(s) { r._status = s; return r },
    send(b) { r._body = b; return r },
  }
  return r
}

function makeRequest(
  opts: {
    body?:   Record<string, unknown>
    params?: Record<string, string>
    user?:   Record<string, string>
  } = {},
): FastifyRequest {
  return {
    body:   opts.body   ?? {},
    params: opts.params ?? {},
    user:   opts.user   ?? { sub: USER_ID, role: 'STUDENT' },
  } as unknown as FastifyRequest
}

async function buildRoutes(): Promise<
  Record<string, ((req: FastifyRequest, reply: FastifyReply) => Promise<unknown>)[]>
> {
  const handlers: Record<string, ((req: FastifyRequest, reply: FastifyReply) => Promise<unknown>)[]> = {}
  const fastify = {
    get: vi.fn().mockImplementation((path: string, _opts: unknown, handler: unknown) => {
      handlers[`GET:${path}`] ??= []
      handlers[`GET:${path}`].push(handler as typeof handlers[string][number])
    }),
    post: vi.fn().mockImplementation((path: string, _opts: unknown, handler: unknown) => {
      handlers[`POST:${path}`] ??= []
      handlers[`POST:${path}`].push(handler as typeof handlers[string][number])
    }),
    patch: vi.fn(),
    delete: vi.fn(),
    log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  } as unknown as FastifyInstance

  await studentLmsRoutes(fastify)
  return handlers
}

// ── Fixtures ──────────────────────────────────────────────────────────────

// Valid 24-char hex ObjectIds so Types.ObjectId.isValid passes.
const USER_ID    = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const LESSON_ID  = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const SETUP_STEP_ID = 'cccccccccccccccccccccccc'
const COHORT_ID  = 'dddddddddddddddddddddddd'

function makeLesson(overrides: Record<string, unknown> = {}) {
  return {
    _id:         LESSON_ID,
    cohortId:    COHORT_ID,
    type:        'TOOL_SETUP',
    isPublished: true,
    setupStepId: SETUP_STEP_ID,
    ...overrides,
  }
}

function makeEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    _id:       'enr000000000000000000001',
    studentId: USER_ID,
    cohortId:  COHORT_ID,
    status:    'ACTIVE',
    ...overrides,
  }
}

// ──────────────────────────────────────────────────────────────────────────

describe('Sprint 2 Story 12 — tool-setup LMS submission adapter', () => {
  let submit: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  let getLatest: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

  beforeEach(async () => {
    vi.mocked(Lesson.findOne).mockReset()
    vi.mocked(Enrollment.findOne).mockReset()
    vi.mocked(StudentStep.findOne).mockReset()
    vi.mocked(StudentStep.create).mockReset()
    vi.mocked(StepSubmission.findOne).mockReset()
    vi.mocked(StepSubmission.create).mockReset()
    vi.mocked(StepSubmission.countDocuments).mockReset()
    mockQueueAdd.mockReset()
    mockQueueAdd.mockResolvedValue({ id: 'job-001' })

    const handlers = await buildRoutes()
    const submitHandlers = handlers['POST:/lessons/:lessonId/tool-setup-submission']
    const getHandlers    = handlers['GET:/lessons/:lessonId/tool-setup-submission/latest']
    if (!submitHandlers?.[0] || !getHandlers?.[0]) {
      throw new Error('Tool-setup routes not registered')
    }
    submit    = submitHandlers[0]
    getLatest = getHandlers[0]
  })

  // ------------------------------------------------------------------------

  it('T1 enqueues a BullMQ job with { submissionId, s3Key, stepId, userId } and returns 201', async () => {
    // Lesson lookup — `.lean()` is chained, so the mock returns a thenable.
    vi.mocked(Lesson.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(makeLesson()),
    } as unknown as ReturnType<typeof Lesson.findOne>)
    vi.mocked(Enrollment.findOne).mockResolvedValueOnce(makeEnrollment() as never)
    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(null) // no pending
    vi.mocked(StudentStep.findOne).mockResolvedValueOnce(null)
    vi.mocked(StudentStep.create).mockResolvedValueOnce({
      _id: 'ss0001', status: 'PENDING_REVIEW', attempts: 1,
    } as never)
    vi.mocked(StepSubmission.create).mockResolvedValueOnce({
      id: 'sub-99', _id: 'sub-99', s3Key: `screenshots/${USER_ID}/${SETUP_STEP_ID}/1.png`,
    } as never)

    const req = makeRequest({
      params: { lessonId: LESSON_ID },
      body:   { s3Key: `screenshots/${USER_ID}/${SETUP_STEP_ID}/1.png` },
    })
    const reply = makeReply()

    await submit(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(201)
    expect((reply._body as { status: string }).status).toBe('VALIDATING')
    expect(mockQueueAdd).toHaveBeenCalledOnce()
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'validate-screenshot',
      expect.objectContaining({
        submissionId: 'sub-99',
        s3Key:        `screenshots/${USER_ID}/${SETUP_STEP_ID}/1.png`,
        stepId:       SETUP_STEP_ID,
        userId:       USER_ID,
        lessonId:     LESSON_ID,
      }),
    )
  })

  // ------------------------------------------------------------------------

  it('T2 returns 400 NOT_TOOL_SETUP when the lesson is a VIDEO lesson', async () => {
    vi.mocked(Lesson.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(makeLesson({ type: 'VIDEO', setupStepId: undefined })),
    } as unknown as ReturnType<typeof Lesson.findOne>)

    const req = makeRequest({
      params: { lessonId: LESSON_ID },
      body:   { s3Key: `screenshots/${USER_ID}/${SETUP_STEP_ID}/1.png` },
    })
    const reply = makeReply()

    await submit(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('NOT_TOOL_SETUP')
    expect(mockQueueAdd).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------------

  it('T3 returns 409 NO_SETUP_STEP_LINKED when the TOOL_SETUP lesson has no setupStepId', async () => {
    vi.mocked(Lesson.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(makeLesson({ setupStepId: undefined })),
    } as unknown as ReturnType<typeof Lesson.findOne>)

    const req = makeRequest({
      params: { lessonId: LESSON_ID },
      body:   { s3Key: `screenshots/${USER_ID}/${SETUP_STEP_ID}/1.png` },
    })
    const reply = makeReply()

    await submit(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(409)
    expect((reply._body as { error: string }).error).toBe('NO_SETUP_STEP_LINKED')
    expect(mockQueueAdd).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------------

  it('T4 returns 403 NOT_ENROLLED when the caller is not enrolled in the cohort', async () => {
    vi.mocked(Lesson.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(makeLesson()),
    } as unknown as ReturnType<typeof Lesson.findOne>)
    vi.mocked(Enrollment.findOne).mockResolvedValueOnce(null as never)

    const req = makeRequest({
      params: { lessonId: LESSON_ID },
      body:   { s3Key: `screenshots/${USER_ID}/${SETUP_STEP_ID}/1.png` },
    })
    const reply = makeReply()

    await submit(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('NOT_ENROLLED')
    expect(mockQueueAdd).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------------

  it('T5 returns 403 FORBIDDEN when the s3Key does not belong to the caller + step (IDOR guard)', async () => {
    vi.mocked(Lesson.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(makeLesson()),
    } as unknown as ReturnType<typeof Lesson.findOne>)
    vi.mocked(Enrollment.findOne).mockResolvedValueOnce(makeEnrollment() as never)

    const req = makeRequest({
      params: { lessonId: LESSON_ID },
      body:   { s3Key: `screenshots/some-other-user/${SETUP_STEP_ID}/1.png` },
    })
    const reply = makeReply()

    await submit(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('FORBIDDEN')
    expect(mockQueueAdd).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------------

  it('T6 maps DB HUMAN_REVIEW → UI UNDER_REVIEW when the latest submission is returned', async () => {
    vi.mocked(Lesson.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(makeLesson()),
    } as unknown as ReturnType<typeof Lesson.findOne>)
    vi.mocked(Enrollment.findOne).mockResolvedValueOnce(makeEnrollment() as never)
    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce({
      id:         'sub-1',
      s3Key:      `screenshots/${USER_ID}/${SETUP_STEP_ID}/1.png`,
      status:     'HUMAN_REVIEW',
      mlFeedback: 'Automated validation unavailable — pending human review.',
      mlScore:    null,
      createdAt:  new Date(),
      reviewedAt: new Date(),
    } as never)

    const req   = makeRequest({ params: { lessonId: LESSON_ID } })
    const reply = makeReply()

    await getLatest(req, reply as unknown as FastifyReply)

    const body = reply._body as { submission: { status: string; rawStatus: string } | null }
    expect(body.submission).not.toBeNull()
    expect(body.submission!.status).toBe('UNDER_REVIEW')
    expect(body.submission!.rawStatus).toBe('HUMAN_REVIEW')
  })

  it('T6b maps DB ML_PROCESSING → UI VALIDATING', async () => {
    vi.mocked(Lesson.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(makeLesson()),
    } as unknown as ReturnType<typeof Lesson.findOne>)
    vi.mocked(Enrollment.findOne).mockResolvedValueOnce(makeEnrollment() as never)
    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce({
      id:         'sub-2',
      s3Key:      `screenshots/${USER_ID}/${SETUP_STEP_ID}/1.png`,
      status:     'ML_PROCESSING',
      mlFeedback: null,
      mlScore:    null,
      createdAt:  new Date(),
      reviewedAt: null,
    } as never)

    const req   = makeRequest({ params: { lessonId: LESSON_ID } })
    const reply = makeReply()

    await getLatest(req, reply as unknown as FastifyReply)

    const body = reply._body as { submission: { status: string } | null }
    expect(body.submission!.status).toBe('VALIDATING')
  })
})
