/**
 * NAB-P0-2 — Cohort marketing-bullet arrays
 *
 * Covers the Zod validation rules added to the admin course schemas and the
 * Mongoose-level defaults on the Cohort model. Specifically:
 *
 *   - `learningOutcomes` accepts up to 12 entries, each ≤ 140 chars
 *   - `requirements`     accepts up to 10 entries, each ≤ 140 chars
 *   - `targetAudience`   accepts up to  8 entries, each ≤ 140 chars
 *   - All three fields are optional on create + update
 *   - Mongoose defaults each field to [] so existing docs that predate the
 *     migration can still round-trip through the API
 *
 * Strategy mirrors admin-courses-lesson-reorder.test.ts: Mongoose models are
 * mocked, the route plugin is registered against a fake FastifyInstance, and
 * we drive PATCH /:id to exercise the Zod schema.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  FastifyInstance,
  FastifyRequest,
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

vi.mock('../models/Cohort.js', () => ({
  Cohort: {
    find:              vi.fn(),
    findOne:           vi.fn(),
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create:            vi.fn(),
    exists:            vi.fn(),
  },
}))

vi.mock('../models/Module.js',       () => ({ Module:       {} }))
vi.mock('../models/Lesson.js',       () => ({ Lesson:       {} }))
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
  uploadToS3:       vi.fn(),
  IS_S3_CONFIGURED: false,
}))

// NAB-P0-5 added this helper; admin/courses.ts imports it at module load even
// though the cohort-PATCH path doesn't exercise it.
vi.mock('../lib/detectVideoProvider.js', () => ({
  detectVideoProvider: vi.fn(() => null),
}))

// ── Imports after mocks ────────────────────────────────────────────────────

import { Cohort } from '../models/Cohort.js'
import { User } from '../models/User.js'
import { adminCoursesRoutes } from '../routes/admin/courses.js'

// ── Fake Fastify harness ───────────────────────────────────────────────────

const COHORT_ID = 'cccccccccccccccccccccccc'
const ADMIN_ID  = 'aaaaaaaaaaaaaaaaaaaaaaaa'

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

async function getPatchRoute() {
  const { routes } = await buildFastify()
  const route = routes['PATCH /:id']
  if (!route) throw new Error('PATCH /:id route not registered')
  return route
}

function makeRequest(body: unknown, params: Record<string, string>): FastifyRequest {
  const req: Partial<FastifyRequest> & {
    body:   unknown
    params: Record<string, string>
    user:   unknown
    jwtVerify: () => Promise<void>
  } = {
    body,
    params,
    user:   undefined,
    jwtVerify: vi.fn().mockImplementation(async function () {
      req.user = { sub: ADMIN_ID, role: 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 }
    }),
  }
  return req as unknown as FastifyRequest
}

async function runRoute(route: RegisteredRoute, req: FastifyRequest, reply: FakeReply) {
  if (route.preHandler) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (route.preHandler as any)(req, reply)
    if (reply.sent) return
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (route.handler as any)(req, reply)
}

function activeAdmin() {
  return { isActive: true }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('NAB-P0-2 — PATCH /:id marketing bullets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts valid learningOutcomes, requirements, targetAudience', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(Cohort.findByIdAndUpdate).mockReturnValueOnce({
      lean: () =>
        Promise.resolve({
          _id:              COHORT_ID,
          name:             'Test Course',
          slug:             'test-course',
          learningOutcomes: ['Ship a product'],
          requirements:     ['Some JS'],
          targetAudience:   ['Founders'],
        }),
    } as unknown as ReturnType<typeof Cohort.findByIdAndUpdate>)

    const route = await getPatchRoute()
    const req = makeRequest(
      {
        learningOutcomes: ['Ship a product', 'Build with AI'],
        requirements:     ['Basic JavaScript'],
        targetAudience:   ['Founders', 'Indie makers'],
      },
      { id: COHORT_ID },
    )
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBeNull()
    expect(Cohort.findByIdAndUpdate).toHaveBeenCalledOnce()
    const patchArg = vi.mocked(Cohort.findByIdAndUpdate).mock.calls[0]?.[1] as {
      $set: Record<string, unknown>
    }
    expect(patchArg.$set['learningOutcomes']).toEqual(['Ship a product', 'Build with AI'])
    expect(patchArg.$set['requirements']).toEqual(['Basic JavaScript'])
    expect(patchArg.$set['targetAudience']).toEqual(['Founders', 'Indie makers'])
  })

  it('accepts an empty array (explicit clear)', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(Cohort.findByIdAndUpdate).mockReturnValueOnce({
      lean: () =>
        Promise.resolve({
          _id:  COHORT_ID,
          name: 'Test',
          slug: 'test',
        }),
    } as unknown as ReturnType<typeof Cohort.findByIdAndUpdate>)

    const route = await getPatchRoute()
    const req = makeRequest(
      { learningOutcomes: [], requirements: [], targetAudience: [] },
      { id: COHORT_ID },
    )
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBeNull()
    const patchArg = vi.mocked(Cohort.findByIdAndUpdate).mock.calls[0]?.[1] as {
      $set: Record<string, unknown>
    }
    expect(patchArg.$set['learningOutcomes']).toEqual([])
    expect(patchArg.$set['requirements']).toEqual([])
    expect(patchArg.$set['targetAudience']).toEqual([])
  })

  it('rejects learningOutcomes with more than 12 entries', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)

    const route = await getPatchRoute()
    const req = makeRequest(
      { learningOutcomes: Array.from({ length: 13 }, (_, i) => `outcome ${i}`) },
      { id: COHORT_ID },
    )
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
    expect(Cohort.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('rejects requirements with more than 10 entries', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)

    const route = await getPatchRoute()
    const req = makeRequest(
      { requirements: Array.from({ length: 11 }, (_, i) => `req ${i}`) },
      { id: COHORT_ID },
    )
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
    expect(Cohort.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('rejects targetAudience with more than 8 entries', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)

    const route = await getPatchRoute()
    const req = makeRequest(
      { targetAudience: Array.from({ length: 9 }, (_, i) => `audience ${i}`) },
      { id: COHORT_ID },
    )
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
    expect(Cohort.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('rejects an entry longer than 140 chars', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)

    const route = await getPatchRoute()
    const longEntry = 'x'.repeat(141)
    const req = makeRequest(
      { learningOutcomes: [longEntry] },
      { id: COHORT_ID },
    )
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
    expect(Cohort.findByIdAndUpdate).not.toHaveBeenCalled()
  })
})

describe('NAB-P0-2 — Cohort schema defaults', () => {
  it('defaults each bullet array to [] on a freshly-built doc', async () => {
    // Import after vi.unmock so we get the real schema.
    vi.resetModules()
    vi.doUnmock('../models/Cohort.js')
    const { Cohort: RealCohort } = await import('../models/Cohort.js')

    // `new Model(...)` hits the schema defaults without any DB connection.
    const doc = new RealCohort({
      name:      'X',
      code:      'X',
      startDate: new Date(),
      endDate:   new Date(),
    })

    expect(doc.learningOutcomes).toEqual([])
    expect(doc.requirements).toEqual([])
    expect(doc.targetAudience).toEqual([])
  })
})
