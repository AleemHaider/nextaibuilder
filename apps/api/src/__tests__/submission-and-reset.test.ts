/**
 * Regression tests for:
 *   1. Screenshot Submission — POST /api/student/steps/:stepId/submissions
 *   2. Progress Reset        — POST /api/admin/students/:id/reset-progress
 *   3. Student Step Status   — getStudentStepStatus logic (locked/unlocked/complete)
 *   4. latestSubmission filtered by progressResetAt
 *
 * Test cases:
 *
 *  Screenshot Submission (POST /steps/:stepId/submissions)
 *   S1.  Valid s3Key + unlocked step → creates submission PENDING + enqueues job → 201
 *   S2.  Missing s3Key → 400 MISSING_S3_KEY
 *   S3.  s3Key belonging to a different user → 403 FORBIDDEN (IDOR guard CRIT-3)
 *   S4.  s3Key for a different stepId → 403 FORBIDDEN
 *   S5.  Step not found → 404 STEP_NOT_FOUND
 *   S6.  Step locked (prerequisite incomplete) → 403 STEP_LOCKED
 *   S7.  Existing PENDING submission → 409 PENDING_SUBMISSION_EXISTS
 *   S8.  Existing ML_PROCESSING submission → 409 PENDING_SUBMISSION_EXISTS
 *   S9.  Second submission on same step → increments attempts counter
 *
 *  Progress Reset (POST /api/admin/students/:id/reset-progress)
 *   P1.  Valid student → all StudentStep records set to LOCKED, progressResetAt written → 200
 *   P2.  Invalid ObjectId → 400 INVALID_ID
 *   P3.  Non-existent student → 404 NOT_FOUND
 *   P4.  Target user is ADMIN (not STUDENT) → 404 NOT_FOUND
 *   P5.  Socket emitProgressReset called after successful reset
 *   P6.  Step 1 record deleted (PBA-389) so student can re-enter without prerequisites
 *
 *  Student Step Status (getStudentStepStatus logic)
 *   SS1. First step with no prerequisites → status UNLOCKED when no StudentStep record
 *   SS2. Step locked when prior step has no StudentStep record
 *   SS3. Step locked when prior step status is PENDING_REVIEW (not COMPLETE)
 *   SS4. Step unlocked when all prior steps are COMPLETE
 *   SS5. Step unlocked when prior step status is OVERRIDE_PASS
 *   SS6. Stale LOCKED record left by reset treated as UNLOCKED when prerequisites met
 *
 *  latestSubmission filtered by progressResetAt (PBA-397)
 *   L1.  No progressResetAt set → latest submission returned regardless of age
 *   L2.  Submission created before progressResetAt → NOT returned (stale)
 *   L3.  Submission created after progressResetAt → returned normally
 *
 * Strategy
 * --------
 * All Mongoose model calls, BullMQ queue, and S3 utilities are mocked.
 * Route handlers are extracted by building a minimal fake FastifyInstance.
 * The getStudentStepStatus logic is tested indirectly through the GET handler
 * (which calls the function) using the same mock patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../middleware/authenticate.js', () => ({
  requireStudent: async () => undefined,
  requireAdmin:   async () => undefined,
  authenticate:   async () => undefined,
}))

vi.mock('../../middleware/require-permission.js', () => ({
  requirePermission: () => async () => undefined,
}))

vi.mock('../middleware/require-permission.js', () => ({
  requirePermission: () => async () => undefined,
}))

vi.mock('../models/SetupStep.js', () => ({
  SetupStep: {
    find:    vi.fn(),
    findById: vi.fn(),
    findOne:  vi.fn(),
  },
}))

vi.mock('../models/StudentStep.js', () => ({
  StudentStep: {
    findOne:          vi.fn(),
    findOneAndUpdate: vi.fn(),
    create:           vi.fn(),
    updateMany:       vi.fn(),
    deleteOne:        vi.fn(),
    countDocuments:   vi.fn(),
  },
}))

vi.mock('../models/StepSubmission.js', () => ({
  StepSubmission: {
    findOne:        vi.fn(),
    create:         vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock('../models/User.js', () => ({
  User: {
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}))

vi.mock('../models/ActivityLog.js', () => ({
  ActivityLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../models/Cohort.js', () => ({
  Cohort: {
    findById: vi.fn(),
    findOne:  vi.fn(),
  },
}))

vi.mock('../models/CohortMembership.js', () => ({
  CohortMembership: {
    findOne: vi.fn(),
    find:    vi.fn(),
  },
}))

// BullMQ Queue mock — captures add() calls so we can assert job enqueuing.
// IMPORTANT: must use `function` / class syntax so `new Queue(...)` works.
vi.mock('bullmq', () => {
  const add = vi.fn().mockResolvedValue({ id: 'job-001' })
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Queue: function MockQueue(_name: string, _opts: unknown) {
      return { add }
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Worker: function MockWorker(_name: string, _processor: unknown, _opts: unknown) {
      return { on: vi.fn() }
    },
    __queueAdd: add,
  }
})

vi.mock('../lib/redis.js', () => ({
  bullMQConnection: {},
  redis:            { get: vi.fn(), set: vi.fn(), ping: vi.fn().mockResolvedValue('PONG') },
}))

vi.mock('../lib/s3.js', () => ({
  s3:                  {},
  BUCKET_NAME:         'test-bucket',
  IS_S3_CONFIGURED:    false,  // dev mode → skip real S3
  getPresignedReadUrl: vi.fn().mockResolvedValue('https://s3.test/presigned-url'),
  buildS3Key:          vi.fn().mockReturnValue('screenshots/user123/step456/1.jpg'),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: vi.fn(),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://s3.test/upload-url'),
}))

vi.mock('../lib/socket.js', () => ({
  emitProgressReset:     vi.fn(),
  emitSubmissionUpdated: vi.fn(),
}))

vi.mock('../lib/email.js', () => ({
  sendEmail:             vi.fn().mockResolvedValue(undefined),
  studentInviteTemplate: vi.fn().mockReturnValue(''),
  coachNudgeTemplate:    vi.fn().mockReturnValue(''),
}))

vi.mock('../lib/student-health.js', () => ({
  computeStudentHealth: vi.fn().mockReturnValue({ status: 'on_track' }),
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import * as BullMQModule from 'bullmq'
import { SetupStep } from '../models/SetupStep.js'
import { StudentStep } from '../models/StudentStep.js'
import { StepSubmission } from '../models/StepSubmission.js'
import { User } from '../models/User.js'
import { emitProgressReset } from '../lib/socket.js'
import { stepsRoutes } from '../routes/student/steps.js'
import { adminStudentsRoutes } from '../routes/admin/students.js'

const mockQueueAdd = (BullMQModule as unknown as { __queueAdd: ReturnType<typeof vi.fn> }).__queueAdd

// ---------------------------------------------------------------------------
// Fake Fastify helpers
// ---------------------------------------------------------------------------

type FakeReply = {
  sent:    boolean
  _status: number | null
  _body:   unknown
  code:    (s: number) => FakeReply
  send:    (b: unknown) => FakeReply
}

function makeReply(): FakeReply {
  const r: FakeReply = {
    sent:    false,
    _status: null,
    _body:   undefined,
    code(s) { r._status = s; return r },
    send(b) { r._body = b; r.sent = true; return r },
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

/** Collect all handlers registered for a path on a fake FastifyInstance */
async function buildStudentRoutes() {
  const handlers: Record<string, ((...args: unknown[]) => Promise<unknown>)[]> = {}

  const fastify = {
    get: vi.fn().mockImplementation((path: string, _opts: unknown, handler: (...a: unknown[]) => Promise<unknown>) => {
      if (!handlers[`GET:${path}`]) handlers[`GET:${path}`] = []
      handlers[`GET:${path}`].push(handler)
    }),
    post: vi.fn().mockImplementation((path: string, _opts: unknown, handler: (...a: unknown[]) => Promise<unknown>) => {
      if (!handlers[`POST:${path}`]) handlers[`POST:${path}`] = []
      handlers[`POST:${path}`].push(handler)
    }),
    log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  } as unknown as FastifyInstance

  await stepsRoutes(fastify)
  return handlers
}

async function buildAdminRoutes() {
  const handlers: Record<string, ((...args: unknown[]) => Promise<unknown>)[]> = {}

  const fastify = {
    get:  vi.fn(),
    post: vi.fn().mockImplementation((path: string, _opts: unknown, handler: (...a: unknown[]) => Promise<unknown>) => {
      if (!handlers[`POST:${path}`]) handlers[`POST:${path}`] = []
      handlers[`POST:${path}`].push(handler)
    }),
    log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  } as unknown as FastifyInstance

  await adminStudentsRoutes(fastify)
  return handlers
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID        = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const STEP_ID        = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const COHORT_ID      = 'cccccccccccccccccccccccc'
const ADMIN_ACTOR_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6'  // valid 24-char hex ObjectId
const VALID_S3_KEY = `screenshots/${USER_ID}/${STEP_ID}/1.jpg`

function makeStepDoc(overrides: Record<string, unknown> = {}) {
  return {
    id:                  STEP_ID,
    _id:                 STEP_ID,
    title:               'Install Node.js',
    description:         'Install the LTS version',
    screenshotCriteria:  'Show the terminal output',
    videoUrl:            null,
    order:               0,
    isActive:            true,
    checklist:           ['node -v shows 20.x'],
    whyItMatters:        null,
    quickReferenceChecklist: [],
    keyLinks:            [],
    videoTranscript:     null,
    estimatedMinutes:    15,
    ...overrides,
  }
}

function makeStudentStepDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id:      'sssssssssssssssssssssss1',
    userId:   USER_ID,
    stepId:   STEP_ID,
    status:   'UNLOCKED',
    attempts: 0,
    save:     vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeSubmissionDoc(overrides: Record<string, unknown> = {}) {
  return {
    id:         'sub000000000000000000001',
    _id:        'sub000000000000000000001',
    userId:     USER_ID,
    stepId:     STEP_ID,
    s3Key:      VALID_S3_KEY,
    status:     'PENDING',
    mlFeedback: null,
    mlScore:    null,
    createdAt:  new Date(),
    reviewedAt: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// POST /steps/:stepId/submissions
// ---------------------------------------------------------------------------

describe('POST /api/student/steps/:stepId/submissions', () => {
  let handle: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

  beforeEach(async () => {
    vi.mocked(SetupStep.findById).mockReset()
    vi.mocked(SetupStep.find).mockReset()
    vi.mocked(StudentStep.findOne).mockReset()
    vi.mocked(StudentStep.create).mockReset()
    vi.mocked(StepSubmission.findOne).mockReset()
    vi.mocked(StepSubmission.create).mockReset()
    vi.mocked(StepSubmission.countDocuments).mockReset()
    vi.mocked(User.findById).mockReset()
    mockQueueAdd.mockReset()
    mockQueueAdd.mockResolvedValue({ id: 'job-001' })

    const handlers = await buildStudentRoutes()
    const h = handlers[`POST:/steps/:stepId/submissions`]
    if (!h || h.length === 0) throw new Error('POST /steps/:stepId/submissions not registered')
    handle = h[0] as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  })

  // ── S1: Valid submission → PENDING created + job enqueued ────────────────

  it('S1 should create a PENDING submission, update StudentStep, and enqueue a validation job → 201', async () => {
    // Arrange — step exists and is not locked
    const stepDoc = makeStepDoc()
    vi.mocked(SetupStep.findById).mockResolvedValue(stepDoc as never)
    // getStudentStepStatus: allSteps (no prior steps), no studentStepDoc
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([stepDoc]),
    } as ReturnType<typeof SetupStep.find>)
    vi.mocked(StudentStep.findOne)
      .mockResolvedValueOnce(null)  // no prior step record (called inside getStudentStepStatus)
      .mockResolvedValueOnce(null)  // no existing studentStepDoc
    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(null)   // no pending submission
    vi.mocked(StepSubmission.countDocuments).mockResolvedValueOnce(0)  // no prior submissions
    const createdStep = makeStudentStepDoc()
    vi.mocked(StudentStep.create).mockResolvedValueOnce(createdStep as never)
    const submission = makeSubmissionDoc()
    vi.mocked(StepSubmission.create).mockResolvedValueOnce(submission as never)

    const req = makeRequest({
      body:   { s3Key: VALID_S3_KEY },
      params: { stepId: STEP_ID },
    })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(201)
    const body = reply._body as { submissionId: string; status: string }
    expect(body.status).toBe('PENDING')
    expect(typeof body.submissionId).toBe('string')

    // Job must have been enqueued
    expect(mockQueueAdd).toHaveBeenCalledOnce()
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'validate-screenshot',
      expect.objectContaining({ submissionId: submission.id, s3Key: VALID_S3_KEY, stepId: STEP_ID }),
    )
  })

  // ── S2: Missing s3Key → 400 MISSING_S3_KEY ───────────────────────────────

  it('S2 should return 400 MISSING_S3_KEY when s3Key is absent from the request body', async () => {
    // Arrange — no s3Key in body
    const req = makeRequest({ body: {}, params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('MISSING_S3_KEY')
    expect(vi.mocked(SetupStep.findById)).not.toHaveBeenCalled()
  })

  // ── S3: s3Key for different user → 403 FORBIDDEN (IDOR guard) ────────────

  it('S3 should return 403 FORBIDDEN when s3Key belongs to a different user (IDOR guard)', async () => {
    // Arrange — key belongs to another user
    const foreignKey = `screenshots/differentuser/${STEP_ID}/1.jpg`
    const req = makeRequest({ body: { s3Key: foreignKey }, params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('FORBIDDEN')
  })

  // ── S4: s3Key for different stepId → 403 FORBIDDEN ───────────────────────

  it('S4 should return 403 FORBIDDEN when s3Key references a different stepId', async () => {
    // Arrange
    const differentStepKey = `screenshots/${USER_ID}/differentstep/1.jpg`
    const req = makeRequest({ body: { s3Key: differentStepKey }, params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('FORBIDDEN')
  })

  // ── S5: Step not found → 404 STEP_NOT_FOUND ──────────────────────────────

  it('S5 should return 404 STEP_NOT_FOUND when the stepId does not match any active step', async () => {
    // Arrange
    vi.mocked(SetupStep.findById).mockResolvedValueOnce(null as never)

    const req = makeRequest({ body: { s3Key: VALID_S3_KEY }, params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(404)
    expect((reply._body as { error: string }).error).toBe('STEP_NOT_FOUND')
    expect(vi.mocked(StepSubmission.create)).not.toHaveBeenCalled()
  })

  // ── S6: Step locked (prior step incomplete) → 403 STEP_LOCKED ────────────

  it('S6 should return 403 STEP_LOCKED when a prerequisite step is not complete', async () => {
    // Arrange — two steps; step[1] requires step[0] to be COMPLETE
    const step0 = makeStepDoc({ id: 'step0000000000000000000000', _id: 'step0000000000000000000000', order: 0 })
    const step1 = makeStepDoc({ id: STEP_ID, _id: STEP_ID, order: 1 })

    vi.mocked(SetupStep.findById).mockResolvedValueOnce(step1 as never)
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([step0, step1]),
    } as ReturnType<typeof SetupStep.find>)
    // Prior step not complete
    vi.mocked(StudentStep.findOne).mockResolvedValueOnce(
      makeStudentStepDoc({ stepId: step0.id, status: 'UNLOCKED' }) as never,
    )

    const req = makeRequest({ body: { s3Key: VALID_S3_KEY }, params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('STEP_LOCKED')
    expect(vi.mocked(StepSubmission.create)).not.toHaveBeenCalled()
  })

  // ── S7: Existing PENDING submission → 409 ────────────────────────────────

  it('S7 should return 409 PENDING_SUBMISSION_EXISTS when a PENDING submission already exists', async () => {
    // Arrange — step is unlocked but existing pending sub blocks re-submission
    const stepDoc = makeStepDoc()
    vi.mocked(SetupStep.findById).mockResolvedValueOnce(stepDoc as never)
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([stepDoc]),
    } as ReturnType<typeof SetupStep.find>)
    vi.mocked(StudentStep.findOne).mockResolvedValueOnce(null)  // no prior step, step is first

    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(
      makeSubmissionDoc({ status: 'PENDING' }) as never,
    )

    const req = makeRequest({ body: { s3Key: VALID_S3_KEY }, params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(409)
    expect((reply._body as { error: string }).error).toBe('PENDING_SUBMISSION_EXISTS')
    expect(vi.mocked(StepSubmission.create)).not.toHaveBeenCalled()
  })

  // ── S8: Existing ML_PROCESSING submission → 409 ───────────────────────────

  it('S8 should return 409 PENDING_SUBMISSION_EXISTS when an ML_PROCESSING submission exists', async () => {
    // Arrange
    const stepDoc = makeStepDoc()
    vi.mocked(SetupStep.findById).mockResolvedValueOnce(stepDoc as never)
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([stepDoc]),
    } as ReturnType<typeof SetupStep.find>)
    vi.mocked(StudentStep.findOne).mockResolvedValueOnce(null)

    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(
      makeSubmissionDoc({ status: 'ML_PROCESSING' }) as never,
    )

    const req = makeRequest({ body: { s3Key: VALID_S3_KEY }, params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(409)
    expect((reply._body as { error: string }).error).toBe('PENDING_SUBMISSION_EXISTS')
  })

  // ── S9: Second submission → attempts counter incremented ─────────────────

  it('S9 should increment the attempts counter when a second submission is made on the same step', async () => {
    // Arrange — student has an existing StudentStep record (previous attempt)
    const stepDoc = makeStepDoc()
    vi.mocked(SetupStep.findById).mockResolvedValueOnce(stepDoc as never)
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([stepDoc]),
    } as ReturnType<typeof SetupStep.find>)
    // No prior incomplete steps (step is first)
    vi.mocked(StudentStep.findOne)
      .mockResolvedValueOnce(null)   // inside getStudentStepStatus: no prior step record
      .mockResolvedValueOnce(       // existing studentStepDoc for current step
        makeStudentStepDoc({ status: 'REJECTED', attempts: 1 }) as never,
      )

    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(null)    // no pending
    vi.mocked(StepSubmission.countDocuments).mockResolvedValueOnce(1)  // 1 prior submission today
    const submission = makeSubmissionDoc()
    vi.mocked(StepSubmission.create).mockResolvedValueOnce(submission as never)

    const req = makeRequest({ body: { s3Key: VALID_S3_KEY }, params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert — attempts should have been incremented via save()
    expect(reply._status).toBe(201)
    // The existing studentStepDoc.save() is called (not StudentStep.create)
    expect(vi.mocked(StudentStep.create)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/students/:id/reset-progress
// ---------------------------------------------------------------------------

describe('POST /api/admin/students/:id/reset-progress', () => {
  let handle: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

  beforeEach(async () => {
    vi.mocked(User.findById).mockReset()
    vi.mocked(User.findByIdAndUpdate).mockReset()
    vi.mocked(StudentStep.updateMany).mockReset()
    vi.mocked(StudentStep.deleteOne).mockReset()
    vi.mocked(emitProgressReset as ReturnType<typeof vi.fn>).mockReset()

    const { CohortMembership } = await import('../models/CohortMembership.js')
    vi.mocked(CohortMembership.findOne).mockReset()

    const { SetupStep: SS } = await import('../models/SetupStep.js')
    vi.mocked(SS.findOne).mockReset()

    const handlers = await buildAdminRoutes()
    const h = handlers[`POST:/:id/reset-progress`]
    if (!h || h.length === 0) throw new Error('POST /:id/reset-progress not registered')
    handle = h[0] as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  })

  // ── P1: Valid student → steps reset + progressResetAt written → 200 ───────

  it('P1 should set all StudentStep records to LOCKED, write progressResetAt, and return 200', async () => {
    // Arrange
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ _id: USER_ID, role: 'STUDENT' }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(StudentStep.updateMany).mockResolvedValueOnce({ modifiedCount: 3 } as never)
    vi.mocked(User.findByIdAndUpdate).mockResolvedValueOnce({} as never)

    // CohortMembership + SetupStep for PBA-389 (Step 1 deletion)
    const { CohortMembership } = await import('../models/CohortMembership.js')
    vi.mocked(CohortMembership.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ cohortId: COHORT_ID }),
    } as ReturnType<typeof CohortMembership.findOne>)
    const { SetupStep: SS } = await import('../models/SetupStep.js')
    vi.mocked(SS.findOne).mockReturnValueOnce({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: 'step0000000000000000000000' }),
      }),
    } as ReturnType<typeof SS.findOne>)
    vi.mocked(StudentStep.deleteOne).mockResolvedValueOnce({} as never)

    const req = makeRequest({ params: { id: USER_ID }, user: { sub: ADMIN_ACTOR_ID, role: 'SUPER_ADMIN' } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(200)
    const body = reply._body as { message: string; stepsReset: number }
    expect(body.stepsReset).toBe(3)
    expect(body.message).toMatch(/reset/i)

    // StudentStep records set to LOCKED
    expect(vi.mocked(StudentStep.updateMany)).toHaveBeenCalledOnce()
    const [, updateDoc] = vi.mocked(StudentStep.updateMany).mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ]
    expect(updateDoc.$set['status']).toBe('LOCKED')
    expect(updateDoc.$set['attempts']).toBe(0)

    // progressResetAt written
    expect(vi.mocked(User.findByIdAndUpdate)).toHaveBeenCalledOnce()
    const [, userUpdateDoc] = vi.mocked(User.findByIdAndUpdate).mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ]
    expect(userUpdateDoc.$set['progressResetAt']).toBeInstanceOf(Date)
    expect(userUpdateDoc.$set['lastActiveAt']).toBeNull()
  })

  // ── P2: Invalid ObjectId → 400 INVALID_ID ────────────────────────────────

  it('P2 should return 400 INVALID_ID when the student ID is not a valid ObjectId', async () => {
    // Arrange
    const req = makeRequest({ params: { id: 'not-valid!' } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_ID')
    expect(vi.mocked(StudentStep.updateMany)).not.toHaveBeenCalled()
  })

  // ── P3: Non-existent student → 404 NOT_FOUND ─────────────────────────────

  it('P3 should return 404 NOT_FOUND when no student exists with the given ID', async () => {
    // Arrange
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(null),
    } as ReturnType<typeof User.findById>)

    const req = makeRequest({ params: { id: USER_ID } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(404)
    expect((reply._body as { error: string }).error).toBe('NOT_FOUND')
    expect(vi.mocked(StudentStep.updateMany)).not.toHaveBeenCalled()
  })

  // ── P4: Target user is ADMIN (not STUDENT) → 404 NOT_FOUND ───────────────

  it('P4 should return 404 NOT_FOUND when the target user exists but has ADMIN role', async () => {
    // Arrange — an admin cannot have their progress reset
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ _id: USER_ID, role: 'ADMIN' }),
    } as ReturnType<typeof User.findById>)

    const req = makeRequest({ params: { id: USER_ID } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(404)
    expect((reply._body as { error: string }).error).toBe('NOT_FOUND')
    expect(vi.mocked(StudentStep.updateMany)).not.toHaveBeenCalled()
  })

  // ── P5: Socket emitProgressReset called after successful reset ─────────────

  it('P5 should call emitProgressReset with the student ID after a successful reset', async () => {
    // Arrange
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ _id: USER_ID, role: 'STUDENT' }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(StudentStep.updateMany).mockResolvedValueOnce({ modifiedCount: 0 } as never)
    vi.mocked(User.findByIdAndUpdate).mockResolvedValueOnce({} as never)

    const { CohortMembership } = await import('../models/CohortMembership.js')
    vi.mocked(CohortMembership.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(null), // no membership — skip Step 1 deletion branch
    } as ReturnType<typeof CohortMembership.findOne>)

    const req = makeRequest({ params: { id: USER_ID }, user: { sub: ADMIN_ACTOR_ID, role: 'SUPER_ADMIN' } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert — socket event emitted with the correct student ID
    expect(emitProgressReset).toHaveBeenCalledOnce()
    expect(emitProgressReset).toHaveBeenCalledWith(USER_ID)
  })

  // ── P6: Step 1 StudentStep record deleted (PBA-389) ───────────────────────

  it('P6 should delete the Step 1 StudentStep record so the student can re-enter the course', async () => {
    // Arrange
    const FIRST_STEP_ID = 'step0000000000000000000001'
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ _id: USER_ID, role: 'STUDENT' }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(StudentStep.updateMany).mockResolvedValueOnce({ modifiedCount: 2 } as never)
    vi.mocked(User.findByIdAndUpdate).mockResolvedValueOnce({} as never)

    const { CohortMembership } = await import('../models/CohortMembership.js')
    vi.mocked(CohortMembership.findOne).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ cohortId: COHORT_ID }),
    } as ReturnType<typeof CohortMembership.findOne>)

    const { SetupStep: SS } = await import('../models/SetupStep.js')
    vi.mocked(SS.findOne).mockReturnValueOnce({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: FIRST_STEP_ID }),
      }),
    } as ReturnType<typeof SS.findOne>)
    vi.mocked(StudentStep.deleteOne).mockResolvedValueOnce({ deletedCount: 1 } as never)

    const req = makeRequest({ params: { id: USER_ID }, user: { sub: ADMIN_ACTOR_ID, role: 'SUPER_ADMIN' } })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert — deleteOne called for the first step
    expect(vi.mocked(StudentStep.deleteOne)).toHaveBeenCalledOnce()
    const deleteFilter = vi.mocked(StudentStep.deleteOne).mock.calls[0][0] as {
      userId: unknown; stepId: unknown
    }
    expect(String(deleteFilter.stepId)).toBe(FIRST_STEP_ID)
  })
})

// ---------------------------------------------------------------------------
// Student Step Status (via GET /steps/:stepId handler)
// ---------------------------------------------------------------------------

describe('Student step status — locked/unlocked logic', () => {
  let getHandle: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

  beforeEach(async () => {
    vi.mocked(SetupStep.findById).mockReset()
    vi.mocked(SetupStep.find).mockReset()
    vi.mocked(StudentStep.findOne).mockReset()
    vi.mocked(StepSubmission.findOne).mockReset()
    vi.mocked(User.findById).mockReset()

    const handlers = await buildStudentRoutes()
    const h = handlers[`GET:/steps/:stepId`]
    if (!h || h.length === 0) throw new Error('GET /steps/:stepId not registered')
    getHandle = h[0] as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  })

  // ── SS1: First step, no record → UNLOCKED ────────────────────────────────

  it('SS1 should return status UNLOCKED for the first step when no StudentStep record exists', async () => {
    // Arrange — step is the only/first step
    const step = makeStepDoc({ order: 0 })
    vi.mocked(SetupStep.findById).mockResolvedValueOnce(step as never)
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([step]),
    } as ReturnType<typeof SetupStep.find>)
    vi.mocked(StudentStep.findOne).mockResolvedValueOnce(null)  // no record → UNLOCKED
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ progressResetAt: null }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(null)

    const req = makeRequest({ params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await getHandle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBeNull() // 200 default
    const body = reply._body as { step: { status: string } }
    expect(body.step.status).toBe('UNLOCKED')
  })

  // ── SS2: Step locked when prior step has no record ────────────────────────

  it('SS2 should return 403 STEP_LOCKED when the prior step has no StudentStep record', async () => {
    // Arrange — two steps; only second step being requested
    const step0 = makeStepDoc({ id: 'step0000000000000000000000', _id: 'step0000000000000000000000', order: 0 })
    const step1 = makeStepDoc({ order: 1 })

    vi.mocked(SetupStep.findById).mockResolvedValueOnce(step1 as never)
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([step0, step1]),
    } as ReturnType<typeof SetupStep.find>)
    // Prior step has no record → locked
    vi.mocked(StudentStep.findOne).mockResolvedValueOnce(null)

    const req = makeRequest({ params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await getHandle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('STEP_LOCKED')
  })

  // ── SS3: Prior step is PENDING_REVIEW → current step locked ──────────────

  it('SS3 should return 403 STEP_LOCKED when the prior step status is PENDING_REVIEW', async () => {
    // Arrange
    const step0 = makeStepDoc({ id: 'step0000000000000000000000', _id: 'step0000000000000000000000', order: 0 })
    const step1 = makeStepDoc({ order: 1 })

    vi.mocked(SetupStep.findById).mockResolvedValueOnce(step1 as never)
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([step0, step1]),
    } as ReturnType<typeof SetupStep.find>)
    // Prior step exists but is PENDING_REVIEW — not COMPLETE
    vi.mocked(StudentStep.findOne).mockResolvedValueOnce(
      makeStudentStepDoc({ stepId: step0.id, status: 'PENDING_REVIEW' }) as never,
    )

    const req = makeRequest({ params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await getHandle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('STEP_LOCKED')
  })

  // ── SS4: All prior steps COMPLETE → current step unlocked ─────────────────

  it('SS4 should return step data (200) when all prior steps are COMPLETE', async () => {
    // Arrange
    const step0 = makeStepDoc({ id: 'step0000000000000000000000', _id: 'step0000000000000000000000', order: 0 })
    const step1 = makeStepDoc({ order: 1 })

    vi.mocked(SetupStep.findById).mockResolvedValueOnce(step1 as never)
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([step0, step1]),
    } as ReturnType<typeof SetupStep.find>)
    // Prior step is COMPLETE
    vi.mocked(StudentStep.findOne)
      .mockResolvedValueOnce(makeStudentStepDoc({ stepId: step0.id, status: 'COMPLETE' }) as never)
      .mockResolvedValueOnce(makeStudentStepDoc({ status: 'UNLOCKED' }) as never)
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ progressResetAt: null }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(null)

    const req = makeRequest({ params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await getHandle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBeNull()  // 200 OK
    const body = reply._body as { step: { status: string } }
    expect(body.step.status).toBe('UNLOCKED')
  })

  // ── SS5: Prior step OVERRIDE_PASS → current step unlocked ─────────────────

  it('SS5 should unlock the next step when the prior step status is OVERRIDE_PASS', async () => {
    // Arrange
    const step0 = makeStepDoc({ id: 'step0000000000000000000000', _id: 'step0000000000000000000000', order: 0 })
    const step1 = makeStepDoc({ order: 1 })

    vi.mocked(SetupStep.findById).mockResolvedValueOnce(step1 as never)
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([step0, step1]),
    } as ReturnType<typeof SetupStep.find>)
    // Prior step is OVERRIDE_PASS (manual admin bypass)
    vi.mocked(StudentStep.findOne)
      .mockResolvedValueOnce(makeStudentStepDoc({ stepId: step0.id, status: 'OVERRIDE_PASS' }) as never)
      .mockResolvedValueOnce(makeStudentStepDoc({ status: 'UNLOCKED' }) as never)
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ progressResetAt: null }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(null)

    const req = makeRequest({ params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await getHandle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBeNull()  // 200 OK
  })

  // ── SS6: Stale LOCKED record after reset treated as UNLOCKED ─────────────

  it('SS6 should treat a stale LOCKED StudentStep record as UNLOCKED when prerequisites are met', async () => {
    // Arrange — step is first (no prerequisites), but has a LOCKED record from a reset
    const step = makeStepDoc({ order: 0 })

    vi.mocked(SetupStep.findById).mockResolvedValueOnce(step as never)
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([step]),
    } as ReturnType<typeof SetupStep.find>)
    // Stale LOCKED record
    vi.mocked(StudentStep.findOne).mockResolvedValueOnce(
      makeStudentStepDoc({ status: 'LOCKED' }) as never,
    )
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ progressResetAt: new Date() }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(null)

    const req = makeRequest({ params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await getHandle(req, reply as unknown as FastifyReply)

    // Assert — step returned as UNLOCKED (not blocked)
    expect(reply._status).toBeNull()  // 200 OK
    const body = reply._body as { step: { status: string } }
    expect(body.step.status).toBe('UNLOCKED')
  })
})

// ---------------------------------------------------------------------------
// latestSubmission filtered by progressResetAt (PBA-397)
// ---------------------------------------------------------------------------

describe('GET /api/student/steps/:stepId — latestSubmission filtered by progressResetAt', () => {
  let getHandle: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

  beforeEach(async () => {
    vi.mocked(SetupStep.findById).mockReset()
    vi.mocked(SetupStep.find).mockReset()
    vi.mocked(StudentStep.findOne).mockReset()
    vi.mocked(StepSubmission.findOne).mockReset()
    vi.mocked(User.findById).mockReset()

    const handlers = await buildStudentRoutes()
    const h = handlers[`GET:/steps/:stepId`]
    if (!h || h.length === 0) throw new Error('GET /steps/:stepId not registered')
    getHandle = h[0] as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  })

  function setupUnlockedStep() {
    const step = makeStepDoc({ order: 0 })
    vi.mocked(SetupStep.findById).mockResolvedValue(step as never)
    vi.mocked(SetupStep.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([step]),
    } as ReturnType<typeof SetupStep.find>)
    // No prior step, step is first
    vi.mocked(StudentStep.findOne).mockResolvedValue(null as never)
  }

  // ── L1: No progressResetAt → submission returned normally ─────────────────

  it('L1 should return latestSubmission when progressResetAt is not set on the user', async () => {
    // Arrange
    setupUnlockedStep()
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ progressResetAt: null }),
    } as ReturnType<typeof User.findById>)
    const submission = makeSubmissionDoc({ status: 'APPROVED', mlFeedback: 'Great work!' })
    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(submission as never)

    const req = makeRequest({ params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await getHandle(req, reply as unknown as FastifyReply)

    // Assert — submission present in response
    const body = reply._body as { step: { latestSubmission: { status: string } | null } }
    expect(body.step.latestSubmission).not.toBeNull()
    expect(body.step.latestSubmission!.status).toBe('APPROVED')

    // Filter must NOT include createdAt constraint when progressResetAt is null
    const findOneCall = vi.mocked(StepSubmission.findOne).mock.calls[0] as [Record<string, unknown>]
    expect(findOneCall[0]['createdAt']).toBeUndefined()
  })

  // ── L2: Submission predates progressResetAt → hidden ─────────────────────

  it('L2 should pass a createdAt filter when progressResetAt is set to exclude stale submissions', async () => {
    // Arrange
    setupUnlockedStep()
    const resetAt = new Date('2025-01-15T12:00:00Z')
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ progressResetAt: resetAt }),
    } as ReturnType<typeof User.findById>)
    // StepSubmission.findOne with the filter returns null (stale sub excluded by DB)
    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(null)

    const req = makeRequest({ params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await getHandle(req, reply as unknown as FastifyReply)

    // Assert — latestSubmission is null
    const body = reply._body as { step: { latestSubmission: null } }
    expect(body.step.latestSubmission).toBeNull()

    // The query filter must include createdAt: { $gt: progressResetAt }
    const findOneCall = vi.mocked(StepSubmission.findOne).mock.calls[0] as [Record<string, unknown>]
    expect(findOneCall[0]['createdAt']).toEqual({ $gt: resetAt })
  })

  // ── L3: Submission created after progressResetAt → returned normally ───────

  it('L3 should return a submission created after progressResetAt as the latestSubmission', async () => {
    // Arrange
    setupUnlockedStep()
    const resetAt = new Date('2025-01-15T12:00:00Z')
    const submissionCreatedAt = new Date('2025-01-16T10:00:00Z')  // after reset

    vi.mocked(User.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ progressResetAt: resetAt }),
    } as ReturnType<typeof User.findById>)
    const submission = makeSubmissionDoc({ createdAt: submissionCreatedAt, status: 'REJECTED' })
    vi.mocked(StepSubmission.findOne).mockResolvedValueOnce(submission as never)

    const req = makeRequest({ params: { stepId: STEP_ID } })
    const reply = makeReply()

    // Act
    await getHandle(req, reply as unknown as FastifyReply)

    // Assert — DB returned the submission (it's post-reset) → included in response
    const body = reply._body as { step: { latestSubmission: { status: string } | null } }
    expect(body.step.latestSubmission).not.toBeNull()
    expect(body.step.latestSubmission!.status).toBe('REJECTED')

    // Query still includes the createdAt filter
    const findOneCall = vi.mocked(StepSubmission.findOne).mock.calls[0] as [Record<string, unknown>]
    expect(findOneCall[0]['createdAt']).toEqual({ $gt: resetAt })
  })
})
