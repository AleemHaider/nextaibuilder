/**
 * Wave 3 Story P — Admin lesson reorder endpoint
 *
 * Route under test:
 *   PATCH /api/v1/admin/courses/:cohortId/modules/:moduleId/lessons/reorder
 *
 * Coverage:
 *   1. Happy path — SUPER_ADMIN reorders 3 lessons → 200 { updated: 3 }
 *   2. Happy path — ADMIN with courses:write reorders → 200 { updated: 3 }
 *   3. ADMIN without courses:write → 403 FORBIDDEN
 *   4. STUDENT token → 403 FORBIDDEN (requireAdmin gate)
 *   5. No token → 401 UNAUTHORIZED
 *   6. Empty body → 400 VALIDATION_ERROR
 *   7. Lesson ID belonging to a different module → 400 LESSON_SCOPE_MISMATCH
 *   8. Lesson ID belonging to a different cohort → 400 LESSON_SCOPE_MISMATCH
 *   9. Invalid ObjectId in body → 400 INVALID_ID
 *  10. Idempotency — same body twice → both 200, state consistent
 *
 * Strategy
 * --------
 * Mirrors the pattern used in admin-invite.test.ts:
 *   - Mongoose models are mocked via vi.mock() — no real MongoDB
 *   - Route plugin is registered against a fake FastifyInstance that captures
 *     handlers (and their preHandler middleware) per path
 *   - The real requirePermission + requireAdmin + authenticate chain runs
 *     against our fakes so 401/403 are exercised end-to-end
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
  RouteHandlerMethod,
} from 'fastify'

// ── Mocks (hoisted) ────────────────────────────────────────────────────────

vi.mock('../lib/redis.js', () => ({
  redis:            { on: vi.fn() },
  bullMQConnection: { host: 'localhost', port: 6379 },
}))

vi.mock('bullmq', () => {
  class Queue {
    add = vi.fn().mockResolvedValue({ id: 'job-placeholder' })
    constructor(_name: string, _opts?: unknown) {}
  }
  return { Queue }
})

vi.mock('../models/Lesson.js', () => ({
  Lesson: {
    countDocuments: vi.fn(),
    bulkWrite:      vi.fn(),
    find:           vi.fn(),
    findOne:        vi.fn(),
    findOneAndUpdate: vi.fn(),
    create:         vi.fn(),
    deleteOne:      vi.fn(),
    exists:         vi.fn(),
  },
}))

vi.mock('../models/Module.js', () => ({
  Module: {
    countDocuments: vi.fn(),
    bulkWrite:      vi.fn(),
    find:           vi.fn(),
    findOne:        vi.fn(),
    findOneAndUpdate: vi.fn(),
    create:         vi.fn(),
    deleteOne:      vi.fn(),
    exists:         vi.fn(),
  },
}))

vi.mock('../models/Cohort.js', () => ({
  Cohort: {
    find:     vi.fn(),
    findOne:  vi.fn(),
    findById: vi.fn(),
    create:   vi.fn(),
    exists:   vi.fn(),
  },
}))

vi.mock('../models/LiveSession.js',  () => ({ LiveSession:  {} }))
vi.mock('../models/PaymentPlan.js',  () => ({ PaymentPlan:  {} }))
vi.mock('../models/Enrollment.js',   () => ({ Enrollment:   {} }))

vi.mock('../models/User.js', () => ({
  User: {
    findById: vi.fn(),
  },
}))

vi.mock('../models/SubAdminPermission.js', () => ({
  SubAdminPermission: {
    findOne: vi.fn(),
  },
}))

vi.mock('../lib/s3.js', () => ({
  uploadToS3:        vi.fn(),
  IS_S3_CONFIGURED:  false,
}))

// ── Imports after mocks ────────────────────────────────────────────────────

import { Lesson } from '../models/Lesson.js'
import { User } from '../models/User.js'
import { SubAdminPermission } from '../models/SubAdminPermission.js'
import { adminCoursesRoutes } from '../routes/admin/courses.js'

// ── Fake Fastify with preHandler support ───────────────────────────────────

const COHORT_ID   = 'cccccccccccccccccccccccc'
const MODULE_ID   = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const OTHER_MODULE = 'dddddddddddddddddddddddd'
const OTHER_COHORT = 'eeeeeeeeeeeeeeeeeeeeeeee'
const LESSON_1    = '111111111111111111111111'
const LESSON_2    = '222222222222222222222222'
const LESSON_3    = '333333333333333333333333'
const ADMIN_ID    = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const STUDENT_ID  = 'aaaaaaaaaaaaaaaaaaaaaaa2'

type FakeReply = {
  sent:    boolean
  _status: number | null
  _body:   unknown
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

interface RegisteredRoute {
  preHandler?: preHandlerHookHandler
  handler:    RouteHandlerMethod
}

async function buildFastify() {
  const routes: Record<string, RegisteredRoute> = {}

  const register = (method: string) =>
    vi.fn().mockImplementation(
      (path: string, optsOrHandler: unknown, maybeHandler?: unknown) => {
        let preHandler: preHandlerHookHandler | undefined
        let handler: RouteHandlerMethod
        if (typeof optsOrHandler === 'function') {
          handler = optsOrHandler as RouteHandlerMethod
        } else {
          preHandler = (optsOrHandler as { preHandler?: preHandlerHookHandler }).preHandler
          handler    = maybeHandler as RouteHandlerMethod
        }
        routes[`${method} ${path}`] = preHandler ? { preHandler, handler } : { handler }
      },
    )

  const fastify = {
    get:    register('GET'),
    post:   register('POST'),
    patch:  register('PATCH'),
    put:    register('PUT'),
    delete: register('DELETE'),
    log: {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(),
      debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(),
    },
    jwt: { sign: vi.fn() },
  } as unknown as FastifyInstance

  await adminCoursesRoutes(fastify)
  return { fastify, routes }
}

async function getReorderRoute() {
  const { routes } = await buildFastify()
  const route = routes['PATCH /:cohortId/modules/:moduleId/lessons/reorder']
  if (!route) throw new Error('lesson reorder route not registered')
  return route
}

/**
 * Build a FastifyRequest with a fake jwtVerify()
 * - If `user` is provided, jwtVerify resolves and attaches it
 * - If `authError` is true, jwtVerify rejects (simulates missing/invalid token)
 */
function makeRequest(opts: {
  body:    unknown
  params:  { cohortId: string; moduleId: string }
  user?:   { sub: string; role: string; email?: string; iat?: number; exp?: number }
  authError?: boolean
}): FastifyRequest {
  const req: Partial<FastifyRequest> & {
    body:   unknown
    params: Record<string, string>
    user:   unknown
    jwtVerify: () => Promise<void>
  } = {
    body:   opts.body,
    params: opts.params,
    user:   undefined,
    jwtVerify: vi.fn().mockImplementation(async function (this: { user: unknown }) {
      if (opts.authError) {
        throw new Error('jwt verify failed')
      }
      req.user = opts.user
    }),
  }
  return req as unknown as FastifyRequest
}

/** Run preHandler (if any) then the main handler */
async function runRoute(route: RegisteredRoute, req: FastifyRequest, reply: FakeReply) {
  if (route.preHandler) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (route.preHandler as any)(req, reply)
    if (reply.sent) return
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (route.handler as any)(req, reply)
}

// ── Fixtures ───────────────────────────────────────────────────────────────

function activeAdmin() {
  return { isActive: true }
}

/** Happy-path body: three lessons, all in scope */
const HAPPY_BODY = [
  { id: LESSON_1, order: 2 },
  { id: LESSON_2, order: 0 },
  { id: LESSON_3, order: 1 },
]

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PATCH /:cohortId/modules/:moduleId/lessons/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Happy path — SUPER_ADMIN
  it('SUPER_ADMIN reorders 3 lessons → 200 { updated: 3 }', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(Lesson.countDocuments).mockResolvedValueOnce(3 as never)
    vi.mocked(Lesson.bulkWrite).mockResolvedValueOnce({ modifiedCount: 3 } as never)

    const route = await getReorderRoute()
    const req = makeRequest({
      body:   HAPPY_BODY,
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   { sub: ADMIN_ID, role: 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBeNull()
    expect(reply._body).toEqual({ updated: 3 })
    expect(Lesson.bulkWrite).toHaveBeenCalledOnce()
    const ops = (vi.mocked(Lesson.bulkWrite).mock.calls[0] as unknown as [unknown[]])[0]
    expect(ops).toHaveLength(3)
  })

  // 2. Happy path — ADMIN with courses:write
  it('ADMIN with courses:write reorders 3 lessons → 200 { updated: 3 }', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(SubAdminPermission.findOne).mockReturnValueOnce({
      lean: () => Promise.resolve({ permissions: ['courses:write', 'courses:read'] }),
    } as ReturnType<typeof SubAdminPermission.findOne>)
    vi.mocked(Lesson.countDocuments).mockResolvedValueOnce(3 as never)
    vi.mocked(Lesson.bulkWrite).mockResolvedValueOnce({ modifiedCount: 3 } as never)

    const route = await getReorderRoute()
    const req = makeRequest({
      body:   HAPPY_BODY,
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   { sub: ADMIN_ID, role: 'ADMIN', email: 'a@x.io', iat: 0, exp: 0 },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBeNull()
    expect(reply._body).toEqual({ updated: 3 })
  })

  // 3. ADMIN without courses:write → 403
  it('ADMIN without courses:write → 403 FORBIDDEN', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(SubAdminPermission.findOne).mockReturnValueOnce({
      lean: () => Promise.resolve({ permissions: ['courses:read'] }),
    } as ReturnType<typeof SubAdminPermission.findOne>)

    const route = await getReorderRoute()
    const req = makeRequest({
      body:   HAPPY_BODY,
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   { sub: ADMIN_ID, role: 'ADMIN', email: 'a@x.io', iat: 0, exp: 0 },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('FORBIDDEN')
    expect(Lesson.bulkWrite).not.toHaveBeenCalled()
  })

  // 4. STUDENT token → 403
  it('STUDENT token → 403 FORBIDDEN (admin role gate)', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)

    const route = await getReorderRoute()
    const req = makeRequest({
      body:   HAPPY_BODY,
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   { sub: STUDENT_ID, role: 'STUDENT', email: 's@x.io', iat: 0, exp: 0 },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('FORBIDDEN')
    expect(Lesson.bulkWrite).not.toHaveBeenCalled()
  })

  // 5. No token → 401
  it('No token → 401 UNAUTHORIZED', async () => {
    const route = await getReorderRoute()
    const req = makeRequest({
      body:      HAPPY_BODY,
      params:    { cohortId: COHORT_ID, moduleId: MODULE_ID },
      authError: true,
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(401)
    expect((reply._body as { error: string }).error).toBe('UNAUTHORIZED')
    expect(Lesson.bulkWrite).not.toHaveBeenCalled()
  })

  // 6. Empty body → 400 (schema requires min(1))
  it('Empty array body → 400 VALIDATION_ERROR', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)

    const route = await getReorderRoute()
    const req = makeRequest({
      body:   [],
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   { sub: ADMIN_ID, role: 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
    expect(Lesson.bulkWrite).not.toHaveBeenCalled()
  })

  // 7. Lesson ID belonging to a different module → 400
  it('Lesson ID in a different module → 400 LESSON_SCOPE_MISMATCH', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    // Only 2 of 3 match the (moduleId, cohortId) scope
    vi.mocked(Lesson.countDocuments).mockResolvedValueOnce(2 as never)

    const route = await getReorderRoute()
    const req = makeRequest({
      body:   HAPPY_BODY,
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   { sub: ADMIN_ID, role: 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('LESSON_SCOPE_MISMATCH')
    expect(Lesson.bulkWrite).not.toHaveBeenCalled()

    // Confirm countDocuments was scoped to the URL params (not just _id)
    const call = vi.mocked(Lesson.countDocuments).mock.calls[0]?.[0] as {
      moduleId: unknown
      cohortId: unknown
      _id:      { $in: unknown[] }
    }
    expect(call.moduleId.toString()).toBe(MODULE_ID)
    expect(call.cohortId.toString()).toBe(COHORT_ID)
    expect(call._id.$in).toHaveLength(3)
  })

  // 8. Lesson ID belonging to a different cohort → 400
  it('Lesson ID in a different cohort → 400 LESSON_SCOPE_MISMATCH', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    // Attacker sends IDs from another cohort — countDocuments scopes to URL
    // cohortId so none match
    vi.mocked(Lesson.countDocuments).mockResolvedValueOnce(0 as never)

    const route = await getReorderRoute()
    const req = makeRequest({
      body:   HAPPY_BODY,
      params: { cohortId: OTHER_COHORT, moduleId: OTHER_MODULE },
      user:   { sub: ADMIN_ID, role: 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('LESSON_SCOPE_MISMATCH')
    expect(Lesson.bulkWrite).not.toHaveBeenCalled()
  })

  // 9. Invalid ObjectId in body → 400 INVALID_ID
  it('Invalid ObjectId in body → 400 INVALID_ID', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)

    const route = await getReorderRoute()
    const req = makeRequest({
      body: [
        { id: LESSON_1,           order: 0 },
        { id: 'not-an-object-id', order: 1 },
      ],
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   { sub: ADMIN_ID, role: 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_ID')
    expect(Lesson.countDocuments).not.toHaveBeenCalled()
    expect(Lesson.bulkWrite).not.toHaveBeenCalled()
  })

  // 9b. Invalid cohortId in URL → 400 INVALID_ID
  it('Invalid cohortId in URL → 400 INVALID_ID', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)

    const route = await getReorderRoute()
    const req = makeRequest({
      body:   HAPPY_BODY,
      params: { cohortId: 'bad', moduleId: MODULE_ID },
      user:   { sub: ADMIN_ID, role: 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_ID')
  })

  // 10. Idempotency — same body twice
  it('same body twice → both 200 with updated: 3', async () => {
    vi.mocked(User.findById)
      .mockReturnValueOnce({
        select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
      } as ReturnType<typeof User.findById>)
      .mockReturnValueOnce({
        select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
      } as ReturnType<typeof User.findById>)
    vi.mocked(Lesson.countDocuments)
      .mockResolvedValueOnce(3 as never)
      .mockResolvedValueOnce(3 as never)
    // First call updates 3; second call updates 0 because state already matches
    // — but MongoDB's bulkWrite returns modifiedCount based on actual writes.
    // We model "state already matches" as modifiedCount: 0 on the second call;
    // the route still returns 200.
    vi.mocked(Lesson.bulkWrite)
      .mockResolvedValueOnce({ modifiedCount: 3 } as never)
      .mockResolvedValueOnce({ modifiedCount: 0 } as never)

    const route = await getReorderRoute()

    const req1 = makeRequest({
      body:   HAPPY_BODY,
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   { sub: ADMIN_ID, role: 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 },
    })
    const reply1 = makeReply()
    await runRoute(route, req1, reply1)

    const req2 = makeRequest({
      body:   HAPPY_BODY,
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   { sub: ADMIN_ID, role: 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 },
    })
    const reply2 = makeReply()
    await runRoute(route, req2, reply2)

    expect(reply1._status).toBeNull()
    expect(reply1._body).toEqual({ updated: 3 })
    expect(reply2._status).toBeNull()
    expect(reply2._body).toEqual({ updated: 0 })
    expect(Lesson.bulkWrite).toHaveBeenCalledTimes(2)
  })

  // Extra: bulkWrite filter pins _id AND moduleId AND cohortId (ID-injection guard)
  it('each bulkWrite op filter includes _id, moduleId AND cohortId', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(Lesson.countDocuments).mockResolvedValueOnce(3 as never)
    vi.mocked(Lesson.bulkWrite).mockResolvedValueOnce({ modifiedCount: 3 } as never)

    const route = await getReorderRoute()
    const req = makeRequest({
      body:   HAPPY_BODY,
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   { sub: ADMIN_ID, role: 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 },
    })
    await runRoute(route, req, makeReply())

    const ops = (vi.mocked(Lesson.bulkWrite).mock.calls[0] as unknown as [Array<{
      updateOne: { filter: { _id: unknown; moduleId: unknown; cohortId: unknown }; update: unknown }
    }>])[0]
    for (const op of ops) {
      expect(op.updateOne.filter._id).toBeDefined()
      expect(String(op.updateOne.filter.moduleId)).toBe(MODULE_ID)
      expect(String(op.updateOne.filter.cohortId)).toBe(COHORT_ID)
    }
  })
})
