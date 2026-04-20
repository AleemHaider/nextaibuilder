/**
 * NAB-P0-5 — Multi-provider video support on the admin Lesson CRUD routes.
 *
 * Coverage:
 *   1. POST with only `videoUrl` auto-sets `videoProvider` from the detector.
 *   2. POST with an unknown URL → 400 with the friendly message.
 *   3. POST with only `loomUrl` (legacy writer) still works and mirrors
 *      into the new `videoUrl` + `videoProvider='LOOM'` shape.
 *   4. PATCH with a new YouTube URL flips the stored provider.
 *
 * Strategy
 * --------
 * Mirrors admin-courses-lesson-reorder.test.ts — models are mocked, the
 * route plugin registers against a fake Fastify, and we drive each route
 * handler directly.
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

vi.mock('../models/Lesson.js', () => ({
  Lesson: {
    countDocuments:   vi.fn(),
    bulkWrite:        vi.fn(),
    find:             vi.fn(),
    findOne:          vi.fn(),
    findOneAndUpdate: vi.fn(),
    create:           vi.fn(),
    deleteOne:        vi.fn(),
    exists:           vi.fn(),
  },
}))

vi.mock('../models/Module.js', () => ({
  Module: {
    countDocuments:   vi.fn(),
    bulkWrite:        vi.fn(),
    find:             vi.fn(),
    findOne:          vi.fn(),
    findOneAndUpdate: vi.fn(),
    create:           vi.fn(),
    deleteOne:        vi.fn(),
    exists:           vi.fn(),
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

vi.mock('../models/LiveSession.js',      () => ({ LiveSession:      {} }))
vi.mock('../models/PaymentPlan.js',      () => ({ PaymentPlan:      {} }))
vi.mock('../models/Enrollment.js',       () => ({ Enrollment:       {} }))
vi.mock('../models/User.js',             () => ({
  User: { findById: vi.fn() },
}))
vi.mock('../models/SubAdminPermission.js', () => ({
  SubAdminPermission: { findOne: vi.fn() },
}))

vi.mock('../lib/s3.js', () => ({
  uploadToS3:       vi.fn(),
  IS_S3_CONFIGURED: false,
}))

import { Lesson } from '../models/Lesson.js'
import { Module } from '../models/Module.js'
import { User } from '../models/User.js'
import { adminCoursesRoutes } from '../routes/admin/courses.js'

// ── Fake Fastify ───────────────────────────────────────────────────────────

const COHORT_ID = 'cccccccccccccccccccccccc'
const MODULE_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const LESSON_ID = '111111111111111111111111'
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

function makeRequest(opts: {
  body:    unknown
  params:  Record<string, string>
  user?:   { sub: string; role: string; email?: string; iat?: number; exp?: number }
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
    jwtVerify: vi.fn().mockImplementation(async function (this: unknown) {
      req.user = opts.user
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

function adminUser() {
  return { sub: ADMIN_ID, role: 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 } as const
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /:cohortId/modules/:moduleId/lessons — NAB-P0-5 video fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('auto-detects videoProvider from a YouTube URL when only videoUrl is supplied', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(Module.exists).mockResolvedValueOnce({ _id: MODULE_ID } as never)
    vi.mocked(Lesson.create).mockImplementationOnce(
      async (doc: unknown) =>
        ({
          ...(doc as object),
          _id: LESSON_ID,
          toJSON() { return { id: LESSON_ID, ...(doc as object) } },
        }) as never,
    )

    const { routes } = await buildFastify()
    const route = routes['POST /:cohortId/modules/:moduleId/lessons']!
    const req = makeRequest({
      body: {
        title: 'YouTube intro',
        type: 'VIDEO',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   adminUser(),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(201)
    const body = reply._body as { lesson: { videoProvider: string; videoUrl: string } }
    expect(body.lesson.videoProvider).toBe('YOUTUBE')
    expect(body.lesson.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    // Verify Lesson.create received the resolved fields.
    const createArg = (vi.mocked(Lesson.create).mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(createArg.videoProvider).toBe('YOUTUBE')
    expect(createArg.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('rejects an unknown provider URL with a 400 and friendly message', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(Module.exists).mockResolvedValueOnce({ _id: MODULE_ID } as never)

    const { routes } = await buildFastify()
    const route = routes['POST /:cohortId/modules/:moduleId/lessons']!
    const req = makeRequest({
      body: {
        title: 'Unknown',
        type: 'VIDEO',
        videoUrl: 'https://wistia.com/medias/xyz',
      },
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   adminUser(),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    const body = reply._body as { message: string }
    expect(body.message).toMatch(/Loom, YouTube, or Vimeo/i)
    expect(Lesson.create).not.toHaveBeenCalled()
  })

  it('back-compat: loomUrl-only payload mirrors into videoUrl + videoProvider=LOOM', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(Module.exists).mockResolvedValueOnce({ _id: MODULE_ID } as never)
    vi.mocked(Lesson.create).mockImplementationOnce(
      async (doc: unknown) =>
        ({
          ...(doc as object),
          _id: LESSON_ID,
          toJSON() { return { id: LESSON_ID, ...(doc as object) } },
        }) as never,
    )

    const { routes } = await buildFastify()
    const route = routes['POST /:cohortId/modules/:moduleId/lessons']!
    const req = makeRequest({
      body: {
        title: 'Legacy Loom',
        type: 'VIDEO',
        loomUrl: 'https://www.loom.com/share/abcdef',
      },
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID },
      user:   adminUser(),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(201)
    const createArg = (vi.mocked(Lesson.create).mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(createArg.videoUrl).toBe('https://www.loom.com/share/abcdef')
    expect(createArg.videoProvider).toBe('LOOM')
    expect(createArg.loomUrl).toBe('https://www.loom.com/share/abcdef')
  })
})

describe('PATCH /:cohortId/modules/:moduleId/lessons/:lessonId — NAB-P0-5 video fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('swapping videoUrl to a YouTube link updates both videoUrl and videoProvider', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(Lesson.findOneAndUpdate).mockReturnValueOnce({
      lean: () =>
        Promise.resolve({
          _id: LESSON_ID,
          title: 'Swap',
          type: 'VIDEO',
          videoProvider: 'YOUTUBE',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        }),
    } as ReturnType<typeof Lesson.findOneAndUpdate>)

    const { routes } = await buildFastify()
    const route = routes['PATCH /:cohortId/modules/:moduleId/lessons/:lessonId']!
    const req = makeRequest({
      body: {
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      params: { cohortId: COHORT_ID, moduleId: MODULE_ID, lessonId: LESSON_ID },
      user:   adminUser(),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBeNull() // default 200
    const callArgs = vi.mocked(Lesson.findOneAndUpdate).mock.calls[0] as unknown as [
      unknown,
      { $set: Record<string, unknown> },
      unknown,
    ]
    expect(callArgs[1].$set).toMatchObject({
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoProvider: 'YOUTUBE',
    })
  })
})
