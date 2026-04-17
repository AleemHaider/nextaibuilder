/**
 * Regression tests for the Admin Student Invite flow
 * (apps/api/src/routes/admin/students.ts)
 *
 * Routes under test:
 *   POST /api/admin/students/invite           — create user with inviteStatus PENDING
 *   POST /api/admin/students/:id/resend-invite — generates a new token
 *   POST /api/admin/students/:id/revoke-invite — sets inviteStatus REVOKED
 *
 * Test cases:
 *  Invite (POST /invite)
 *   I1. Valid payload → creates User with inviteStatus=PENDING and CohortMembership → 201
 *   I2. Missing required field (email) → 400 INVALID_BODY
 *   I3. Invalid cohortId (not an ObjectId) → 400 INVALID_COHORT_ID
 *   I4. Duplicate email → 409 EMAIL_CONFLICT
 *   I5. Cohort not found → 404 COHORT_NOT_FOUND
 *   I6. CohortMembership creation fails → 500 INTERNAL_ERROR + orphaned User cleaned up
 *   I7. User creation fails → 500 INTERNAL_ERROR
 *
 *  Resend Invite (POST /:id/resend-invite)
 *   R1. PENDING student → updates passwordSetToken → 200
 *   R2. Invalid ID (not ObjectId) → 400 INVALID_ID
 *   R3. Student not found → 404 NOT_FOUND
 *   R4. ACCEPTED student → 400 INVITE_ALREADY_ACCEPTED
 *   R5. REVOKED student → 400 INVITE_REVOKED
 *
 *  Revoke Invite (POST /:id/revoke-invite)
 *   V1. PENDING student → sets inviteStatus=REVOKED, isActive=false → 200
 *   V2. Invalid ID → 400 INVALID_ID
 *   V3. Student not found → 404 NOT_FOUND
 *   V4. ACCEPTED student → 400 INVITE_ALREADY_ACCEPTED (cannot revoke)
 *
 * Strategy
 * --------
 * All Mongoose model calls are mocked. Route handlers are extracted from the
 * registered fastify.post() calls following the exact same pattern used in
 * oauth-invite.test.ts and authenticate.test.ts.
 *
 * requirePermission is mocked to a no-op so the preHandler guard is bypassed —
 * permission middleware has its own test coverage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../middleware/require-permission.js', () => ({
  requirePermission: () => async () => undefined,
}))

// Stub out the middleware import path used inside admin/students.ts
vi.mock('../middleware/require-permission.js', () => ({
  requirePermission: () => async () => undefined,
}))

vi.mock('../models/User.js', () => ({
  User: {
    findOne:           vi.fn(),
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    create:            vi.fn(),
    updateOne:         vi.fn(),
  },
}))

vi.mock('../models/Cohort.js', () => ({
  Cohort: {
    findById: vi.fn(),
  },
}))

vi.mock('../models/CohortMembership.js', () => ({
  CohortMembership: {
    findOne: vi.fn(),
    find:    vi.fn(),
    create:  vi.fn(),
  },
}))

vi.mock('../models/SetupStep.js', () => ({
  SetupStep: {
    find:    vi.fn(),
    findOne: vi.fn(),
  },
}))

vi.mock('../models/StudentStep.js', () => ({
  StudentStep: {
    find:         vi.fn(),
    findOne:      vi.fn(),
    updateMany:   vi.fn(),
    deleteOne:    vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock('../models/StepSubmission.js', () => ({
  StepSubmission: {
    find:    vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock('../models/ActivityLog.js', () => ({
  ActivityLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../lib/email.js', () => ({
  sendEmail:             vi.fn().mockResolvedValue(undefined),
  studentInviteTemplate: vi.fn().mockReturnValue('<html>invite</html>'),
  coachNudgeTemplate:    vi.fn().mockReturnValue('<html>nudge</html>'),
}))

vi.mock('../lib/s3.js', () => ({
  getPresignedReadUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned'),
}))

vi.mock('../lib/socket.js', () => ({
  emitProgressReset:        vi.fn(),
  emitSubmissionUpdated:    vi.fn(),
}))

vi.mock('../lib/student-health.js', () => ({
  computeStudentHealth: vi.fn().mockReturnValue({ status: 'on_track', score: 100 }),
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { User } from '../models/User.js'
import { Cohort } from '../models/Cohort.js'
import { CohortMembership } from '../models/CohortMembership.js'
import { adminStudentsRoutes } from '../routes/admin/students.js'

// ---------------------------------------------------------------------------
// Fake Fastify helpers
// ---------------------------------------------------------------------------

type FakeReply = {
  sent: boolean
  _status: number | null
  _body: unknown
  code: (s: number) => FakeReply
  send: (b: unknown) => FakeReply
}

function makeReply(): FakeReply {
  const r: FakeReply = {
    sent:    false,
    _status: null,
    _body:   undefined,
    code(status) { r._status = status; return r },
    send(body)   { r._body = body; r.sent = true; return r },
  }
  return r
}

// Valid 24-char hex ObjectId strings for actor/user IDs
const ADMIN_ACTOR_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6'

function makeRequest(
  body: Record<string, unknown>,
  params: Record<string, string> = {},
  user: Record<string, string> = { sub: ADMIN_ACTOR_ID, role: 'SUPER_ADMIN' },
): FastifyRequest {
  return { body, params, user } as unknown as FastifyRequest
}

/** Builds a fake FastifyInstance and registers all admin student routes on it */
async function buildFastify() {
  const routes: Record<string, Array<(...args: unknown[]) => Promise<unknown>>> = {}
  const fastify = {
    get:  vi.fn(),
    post: vi.fn().mockImplementation((path: string, _opts: unknown, handler: (...args: unknown[]) => Promise<unknown>) => {
      if (!routes[path]) routes[path] = []
      routes[path].push(handler)
    }),
    log: {
      info:  vi.fn(),
      error: vi.fn(),
      warn:  vi.fn(),
    },
    jwt: { sign: vi.fn().mockReturnValue('mock-access-token') },
  } as unknown as FastifyInstance

  await adminStudentsRoutes(fastify)
  return { fastify, routes }
}

/** Extract the handler for a given POST path */
async function getPostHandler(path: string) {
  const { routes } = await buildFastify()
  const handlers = routes[path]
  if (!handlers || handlers.length === 0) {
    throw new Error(`No handler registered for POST ${path}`)
  }
  return handlers[0] as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_COHORT_ID   = 'cccccccccccccccccccccccc'  // 24-char valid ObjectId
const VALID_STUDENT_ID  = 'aaaaaaaaaaaaaaaaaaaaaaa1'  // 24-char valid ObjectId
const VALID_STUDENT_ID2 = 'aaaaaaaaaaaaaaaaaaaaaaa2'

function makeStudentDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id:               { toString: () => VALID_STUDENT_ID },
    email:             'student@example.com',
    firstName:         'Bob',
    lastName:          'Jones',
    role:              'STUDENT',
    inviteStatus:      'PENDING',
    isActive:          true,
    passwordSetToken:  'old-token-abc',
    passwordSetExpiry: new Date(Date.now() + 3_600_000),
    ...overrides,
  }
}

function makeCohortDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id:  { toString: () => VALID_COHORT_ID },
    name: 'Cohort Alpha',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// POST /invite
// ---------------------------------------------------------------------------

describe('POST /api/admin/students/invite', () => {
  let handle: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

  beforeEach(async () => {
    vi.mocked(User.findOne).mockReset()
    vi.mocked(User.create).mockReset()
    vi.mocked(User.findByIdAndDelete).mockReset()
    vi.mocked(Cohort.findById).mockReset()
    vi.mocked(CohortMembership.create).mockReset()

    handle = await getPostHandler('/invite')
  })

  // ── I1: Valid payload → 201 with PENDING user ─────────────────────────────

  it('I1 should create a PENDING student and CohortMembership and return 201', async () => {
    // Arrange
    vi.mocked(User.findOne).mockResolvedValueOnce(null)           // no existing email
    vi.mocked(Cohort.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(makeCohortDoc()),
    } as ReturnType<typeof Cohort.findById>)
    const createdUser = makeStudentDoc()
    vi.mocked(User.create).mockResolvedValueOnce(createdUser as never)
    vi.mocked(CohortMembership.create).mockResolvedValueOnce({} as never)

    const req = makeRequest({
      firstName: 'Bob',
      lastName:  'Jones',
      email:     'student@example.com',
      cohortId:  VALID_COHORT_ID,
    })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(201)
    const body = reply._body as { student: Record<string, unknown> }
    expect(body.student.email).toBe('student@example.com')
    expect(body.student.inviteStatus).toBe('PENDING')

    // User created with PENDING status and no oauthId
    expect(vi.mocked(User.create)).toHaveBeenCalledOnce()
    expect(vi.mocked(User.create)).toHaveBeenCalledWith(expect.objectContaining({
      email:         'student@example.com',
      inviteStatus:  'PENDING',
      isActive:      true,
      oauthId:       null,
      oauthProvider: null,
    }))

    // CohortMembership also created
    expect(vi.mocked(CohortMembership.create)).toHaveBeenCalledOnce()
  })

  it('I1b should include a passwordSetToken and passwordSetExpiry on the created user', async () => {
    // Arrange
    vi.mocked(User.findOne).mockResolvedValueOnce(null)
    vi.mocked(Cohort.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(makeCohortDoc()),
    } as ReturnType<typeof Cohort.findById>)
    vi.mocked(User.create).mockResolvedValueOnce(makeStudentDoc() as never)
    vi.mocked(CohortMembership.create).mockResolvedValueOnce({} as never)

    const req = makeRequest({
      firstName: 'Bob',
      lastName:  'Jones',
      email:     'student@example.com',
      cohortId:  VALID_COHORT_ID,
    })
    const reply = makeReply()
    await handle(req, reply as unknown as FastifyReply)

    const createCall = vi.mocked(User.create).mock.calls[0][0] as Record<string, unknown>
    expect(typeof createCall['passwordSetToken']).toBe('string')
    expect((createCall['passwordSetToken'] as string).length).toBeGreaterThan(0)
    expect(createCall['passwordSetExpiry']).toBeInstanceOf(Date)
  })

  // ── I2: Missing required field → 400 INVALID_BODY ────────────────────────

  it('I2 should return 400 INVALID_BODY when email is missing', async () => {
    // Arrange — body missing email
    const req = makeRequest({ firstName: 'Bob', lastName: 'Jones', cohortId: VALID_COHORT_ID })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_BODY')
    expect(vi.mocked(User.findOne)).not.toHaveBeenCalled()
  })

  it('I2b should return 400 INVALID_BODY when email format is invalid', async () => {
    // Arrange
    const req = makeRequest({
      firstName: 'Bob',
      lastName:  'Jones',
      email:     'not-an-email',
      cohortId:  VALID_COHORT_ID,
    })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_BODY')
  })

  it('I2c should return 400 INVALID_BODY when firstName is empty string', async () => {
    // Arrange
    const req = makeRequest({
      firstName: '',
      lastName:  'Jones',
      email:     'student@example.com',
      cohortId:  VALID_COHORT_ID,
    })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_BODY')
  })

  // ── I3: Invalid cohortId → 400 INVALID_COHORT_ID ─────────────────────────

  it('I3 should return 400 INVALID_COHORT_ID when cohortId is not a valid ObjectId', async () => {
    // Arrange — email uniqueness check must not be reached either
    vi.mocked(User.findOne).mockResolvedValueOnce(null)
    const req = makeRequest({
      firstName: 'Bob',
      lastName:  'Jones',
      email:     'student@example.com',
      cohortId:  'not-a-valid-id',
    })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_COHORT_ID')
    expect(vi.mocked(User.create)).not.toHaveBeenCalled()
  })

  // ── I4: Duplicate email → 409 EMAIL_CONFLICT ──────────────────────────────

  it('I4 should return 409 EMAIL_CONFLICT when the email already exists in the system', async () => {
    // Arrange
    vi.mocked(User.findOne).mockResolvedValueOnce(makeStudentDoc() as never)  // existing user!

    const req = makeRequest({
      firstName: 'Bob',
      lastName:  'Jones',
      email:     'student@example.com',
      cohortId:  VALID_COHORT_ID,
    })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(409)
    expect((reply._body as { error: string }).error).toBe('EMAIL_CONFLICT')
    expect(vi.mocked(User.create)).not.toHaveBeenCalled()
  })

  // ── I5: Cohort not found → 404 COHORT_NOT_FOUND ───────────────────────────

  it('I5 should return 404 COHORT_NOT_FOUND when the cohortId references a non-existent cohort', async () => {
    // Arrange
    vi.mocked(User.findOne).mockResolvedValueOnce(null)
    vi.mocked(Cohort.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(null),  // cohort does not exist
    } as ReturnType<typeof Cohort.findById>)

    const req = makeRequest({
      firstName: 'Bob',
      lastName:  'Jones',
      email:     'student@example.com',
      cohortId:  VALID_COHORT_ID,
    })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(404)
    expect((reply._body as { error: string }).error).toBe('COHORT_NOT_FOUND')
    expect(vi.mocked(User.create)).not.toHaveBeenCalled()
  })

  // ── I6: CohortMembership creation fails → 500 + orphan cleanup ────────────

  it('I6 should return 500 INTERNAL_ERROR and delete the orphaned User when CohortMembership creation fails', async () => {
    // Arrange
    vi.mocked(User.findOne).mockResolvedValueOnce(null)
    vi.mocked(Cohort.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(makeCohortDoc()),
    } as ReturnType<typeof Cohort.findById>)
    const createdUser = makeStudentDoc()
    vi.mocked(User.create).mockResolvedValueOnce(createdUser as never)
    // CohortMembership.create throws
    vi.mocked(CohortMembership.create).mockRejectedValueOnce(new Error('DB write failed'))
    vi.mocked(User.findByIdAndDelete).mockResolvedValueOnce({} as never)

    const req = makeRequest({
      firstName: 'Bob',
      lastName:  'Jones',
      email:     'student@example.com',
      cohortId:  VALID_COHORT_ID,
    })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(500)
    expect((reply._body as { error: string }).error).toBe('INTERNAL_ERROR')

    // Compensating cleanup: orphaned user must be deleted
    expect(vi.mocked(User.findByIdAndDelete)).toHaveBeenCalledOnce()
  })

  // ── I7: User.create throws → 500 INTERNAL_ERROR ──────────────────────────

  it('I7 should return 500 INTERNAL_ERROR when User.create throws a database error', async () => {
    // Arrange
    vi.mocked(User.findOne).mockResolvedValueOnce(null)
    vi.mocked(Cohort.findById).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(makeCohortDoc()),
    } as ReturnType<typeof Cohort.findById>)
    vi.mocked(User.create).mockRejectedValueOnce(new Error('Mongoose validation error'))

    const req = makeRequest({
      firstName: 'Bob',
      lastName:  'Jones',
      email:     'student@example.com',
      cohortId:  VALID_COHORT_ID,
    })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(500)
    expect((reply._body as { error: string }).error).toBe('INTERNAL_ERROR')
  })
})

// ---------------------------------------------------------------------------
// POST /:id/resend-invite
// ---------------------------------------------------------------------------

describe('POST /api/admin/students/:id/resend-invite', () => {
  let handle: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

  beforeEach(async () => {
    vi.mocked(User.findById).mockReset()
    vi.mocked(User.findByIdAndUpdate).mockReset()
    vi.mocked(CohortMembership.findOne).mockReset()

    handle = await getPostHandler('/:id/resend-invite')
  })

  // ── R1: PENDING student → new token generated → 200 ─────────────────────

  it('R1 should generate a new passwordSetToken and return 200 for a PENDING student', async () => {
    // Arrange
    vi.mocked(User.findById).mockResolvedValueOnce(makeStudentDoc() as never)
    vi.mocked(User.findByIdAndUpdate).mockResolvedValueOnce({} as never)
    vi.mocked(CohortMembership.findOne).mockReturnValueOnce({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ cohortId: { name: 'Cohort Alpha' } }),
      }),
    } as ReturnType<typeof CohortMembership.findOne>)

    const req = makeRequest({}, { id: VALID_STUDENT_ID })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(200)
    expect((reply._body as { message: string }).message).toMatch(/resent/i)

    // Token update must have been called with a new string token
    expect(vi.mocked(User.findByIdAndUpdate)).toHaveBeenCalledOnce()
    const [, updateDoc] = vi.mocked(User.findByIdAndUpdate).mock.calls[0] as [
      unknown,
      { $set: { passwordSetToken: string; passwordSetExpiry: Date } },
    ]
    expect(typeof updateDoc.$set.passwordSetToken).toBe('string')
    expect(updateDoc.$set.passwordSetToken.length).toBeGreaterThan(0)
    expect(updateDoc.$set.passwordSetExpiry).toBeInstanceOf(Date)
  })

  // ── R2: Invalid ID → 400 INVALID_ID ──────────────────────────────────────

  it('R2 should return 400 INVALID_ID when the student ID is not a valid ObjectId', async () => {
    // Arrange
    const req = makeRequest({}, { id: 'not-valid-objectid' })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_ID')
    expect(vi.mocked(User.findById)).not.toHaveBeenCalled()
  })

  // ── R3: Student not found → 404 NOT_FOUND ────────────────────────────────

  it('R3 should return 404 NOT_FOUND when no student exists with the given ID', async () => {
    // Arrange
    vi.mocked(User.findById).mockResolvedValueOnce(null as never)

    const req = makeRequest({}, { id: VALID_STUDENT_ID })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(404)
    expect((reply._body as { error: string }).error).toBe('NOT_FOUND')
    expect(vi.mocked(User.findByIdAndUpdate)).not.toHaveBeenCalled()
  })

  // ── R4: ACCEPTED student → 400 INVITE_ALREADY_ACCEPTED ───────────────────

  it('R4 should return 400 INVITE_ALREADY_ACCEPTED when the student has already accepted', async () => {
    // Arrange
    vi.mocked(User.findById).mockResolvedValueOnce(
      makeStudentDoc({ inviteStatus: 'ACCEPTED' }) as never,
    )

    const req = makeRequest({}, { id: VALID_STUDENT_ID })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVITE_ALREADY_ACCEPTED')
    expect(vi.mocked(User.findByIdAndUpdate)).not.toHaveBeenCalled()
  })

  // ── R5: REVOKED student → 400 INVITE_REVOKED ─────────────────────────────

  it('R5 should return 400 INVITE_REVOKED when the invite has been revoked', async () => {
    // Arrange
    vi.mocked(User.findById).mockResolvedValueOnce(
      makeStudentDoc({ inviteStatus: 'REVOKED' }) as never,
    )

    const req = makeRequest({}, { id: VALID_STUDENT_ID })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVITE_REVOKED')
    expect(vi.mocked(User.findByIdAndUpdate)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// POST /:id/revoke-invite
// ---------------------------------------------------------------------------

describe('POST /api/admin/students/:id/revoke-invite', () => {
  let handle: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

  beforeEach(async () => {
    vi.mocked(User.findById).mockReset()
    vi.mocked(User.findByIdAndUpdate).mockReset()

    handle = await getPostHandler('/:id/revoke-invite')
  })

  // ── V1: PENDING student → REVOKED + isActive=false → 200 ─────────────────

  it('V1 should set inviteStatus=REVOKED and isActive=false for a PENDING student and return 200', async () => {
    // Arrange
    vi.mocked(User.findById).mockResolvedValueOnce(makeStudentDoc() as never)
    vi.mocked(User.findByIdAndUpdate).mockResolvedValueOnce({} as never)

    const req = makeRequest({}, { id: VALID_STUDENT_ID })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(200)
    expect((reply._body as { message: string }).message).toMatch(/revoked/i)

    // findByIdAndUpdate must have been called with the right payload
    expect(vi.mocked(User.findByIdAndUpdate)).toHaveBeenCalledOnce()
    const [, updateDoc] = vi.mocked(User.findByIdAndUpdate).mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ]
    expect(updateDoc.$set['inviteStatus']).toBe('REVOKED')
    expect(updateDoc.$set['isActive']).toBe(false)
    expect(updateDoc.$set['passwordSetToken']).toBeNull()
    expect(updateDoc.$set['passwordSetExpiry']).toBeNull()
  })

  // ── V2: Invalid ID → 400 INVALID_ID ──────────────────────────────────────

  it('V2 should return 400 INVALID_ID when the student ID is not a valid ObjectId', async () => {
    // Arrange
    const req = makeRequest({}, { id: 'invalid!' })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_ID')
    expect(vi.mocked(User.findById)).not.toHaveBeenCalled()
  })

  // ── V3: Student not found → 404 NOT_FOUND ────────────────────────────────

  it('V3 should return 404 NOT_FOUND when no student exists with the given ID', async () => {
    // Arrange
    vi.mocked(User.findById).mockResolvedValueOnce(null as never)

    const req = makeRequest({}, { id: VALID_STUDENT_ID })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(404)
    expect((reply._body as { error: string }).error).toBe('NOT_FOUND')
    expect(vi.mocked(User.findByIdAndUpdate)).not.toHaveBeenCalled()
  })

  // ── V4: ACCEPTED student → 400 INVITE_ALREADY_ACCEPTED ───────────────────

  it('V4 should return 400 INVITE_ALREADY_ACCEPTED when trying to revoke an accepted invite', async () => {
    // Arrange — accepted students cannot have their invite revoked
    vi.mocked(User.findById).mockResolvedValueOnce(
      makeStudentDoc({ inviteStatus: 'ACCEPTED' }) as never,
    )

    const req = makeRequest({}, { id: VALID_STUDENT_ID })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVITE_ALREADY_ACCEPTED')
    // No update should have been performed
    expect(vi.mocked(User.findByIdAndUpdate)).not.toHaveBeenCalled()
  })

  // ── Edge: Revoking an already-REVOKED invite ──────────────────────────────

  it('should successfully revoke a student that is already REVOKED (idempotent operation)', async () => {
    // Arrange — already revoked student; the route has no guard against double-revoke
    vi.mocked(User.findById).mockResolvedValueOnce(
      makeStudentDoc({ inviteStatus: 'REVOKED', isActive: false }) as never,
    )
    vi.mocked(User.findByIdAndUpdate).mockResolvedValueOnce({} as never)

    const req = makeRequest({}, { id: VALID_STUDENT_ID })
    const reply = makeReply()

    // Act
    await handle(req, reply as unknown as FastifyReply)

    // Assert — still 200 because REVOKED is not a blocking state for this endpoint
    expect(reply._status).toBe(200)
  })
})
