/**
 * NAB-P0-4 — Lesson-image upload endpoint.
 *
 * Endpoint: POST /:cohortId/lesson-images — multipart single-image upload
 * used by the TipTap rich-text editor. Mirrors the cover-upload gate (5 MB
 * cap, jpeg/png/webp only) and writes under
 * `lesson-images/<cohortId>/<uuid>.<ext>` in S3 or the dev `uploads/` dir.
 *
 * Coverage:
 *   1. Happy path — jpeg accepted, returns `{ url, key }` with the right
 *      prefix, body is written (via the mocked fs.writeFile since S3 is off).
 *   2. Mime rejection — text/plain → 415.
 *   3. Size rejection — body > 5 MB → 413.
 *   4. No-file rejection — multipart with no file → 400.
 *
 * Strategy mirrors admin-courses-lesson-video.test.ts: models + fs are
 * mocked, the routes plugin is registered against a fake Fastify, and each
 * handler is driven directly with a fabricated request.
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
  Lesson: { exists: vi.fn(), countDocuments: vi.fn() },
}))
vi.mock('../models/Module.js', () => ({
  Module: { exists: vi.fn(), countDocuments: vi.fn() },
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
vi.mock('../models/LiveSession.js', () => ({ LiveSession: {} }))
vi.mock('../models/PaymentPlan.js', () => ({ PaymentPlan: {} }))
vi.mock('../models/Enrollment.js',  () => ({ Enrollment:  {} }))
vi.mock('../models/User.js', () => ({
  User: { findById: vi.fn() },
}))
vi.mock('../models/SubAdminPermission.js', () => ({
  SubAdminPermission: { findOne: vi.fn() },
}))

vi.mock('../lib/s3.js', () => ({
  uploadToS3:       vi.fn(),
  IS_S3_CONFIGURED: false,
}))

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir:     vi.fn().mockResolvedValue(undefined),
}))

import { Cohort } from '../models/Cohort.js'
import { User } from '../models/User.js'
import { uploadToS3 } from '../lib/s3.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { adminCoursesRoutes } from '../routes/admin/courses.js'

const uploadToS3Mock = vi.mocked(uploadToS3)
const writeFileMock  = vi.mocked(writeFile)
const mkdirMock      = vi.mocked(mkdir)

// ── Fake Fastify ───────────────────────────────────────────────────────────

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

// Minimal multipart-file stub: a `file` async-iterable that yields one chunk
// plus a mimetype. Matches the surface our handler actually reads.
function makeMultipartFile(buf: Buffer, mimetype: string) {
  return {
    mimetype,
    file: (async function* () {
      yield buf
    })(),
  }
}

function makeRequest(opts: {
  params:  Record<string, string>
  file?:   ReturnType<typeof makeMultipartFile> | null
  user?:   { sub: string; role: string; email?: string; iat?: number; exp?: number }
}): FastifyRequest {
  const req: Partial<FastifyRequest> & {
    body:   unknown
    params: Record<string, string>
    user:   unknown
    file:   (opts?: unknown) => Promise<unknown>
    jwtVerify: () => Promise<void>
  } = {
    body:   {},
    params: opts.params,
    user:   undefined,
    file: vi.fn().mockImplementation(async () => opts.file ?? undefined),
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

describe('POST /:cohortId/lesson-images — NAB-P0-4', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Auth preHandler reads the admin + permission check; return an active
    // admin for every test.
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
  })

  it('happy path — a jpeg upload returns { url, key } with the expected prefix', async () => {
    vi.mocked(Cohort.exists).mockResolvedValueOnce({ _id: COHORT_ID } as never)

    const { routes } = await buildFastify()
    const route = routes['POST /:cohortId/lesson-images']!
    const body  = Buffer.from('binary-jpeg-bytes')
    const req = makeRequest({
      params: { cohortId: COHORT_ID },
      file:   makeMultipartFile(body, 'image/jpeg'),
      user:   adminUser(),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    // Default success code is 200 (not explicitly set by the handler).
    expect(reply._status).toBeNull()
    const b = reply._body as { url: string; key: string }
    expect(b.key).toMatch(
      new RegExp(`^lesson-images/${COHORT_ID}/[a-f0-9]{24}\\.jpg$`),
    )
    expect(b.url).toBe(`/api/uploads/${b.key}`)
    // Local fallback write path exercised since IS_S3_CONFIGURED=false.
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(mkdirMock).toHaveBeenCalledTimes(1)
    expect(uploadToS3Mock).not.toHaveBeenCalled()
  })

  it('rejects an unsupported mime type with 415', async () => {
    vi.mocked(Cohort.exists).mockResolvedValueOnce({ _id: COHORT_ID } as never)

    const { routes } = await buildFastify()
    const route = routes['POST /:cohortId/lesson-images']!
    const req = makeRequest({
      params: { cohortId: COHORT_ID },
      file:   makeMultipartFile(Buffer.from('not an image'), 'text/plain'),
      user:   adminUser(),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(415)
    const b = reply._body as { error: string }
    expect(b.error).toBe('UNSUPPORTED_MEDIA_TYPE')
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized body with 413', async () => {
    vi.mocked(Cohort.exists).mockResolvedValueOnce({ _id: COHORT_ID } as never)

    const { routes } = await buildFastify()
    const route = routes['POST /:cohortId/lesson-images']!
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 0) // 5 MB + 1 byte
    const req = makeRequest({
      params: { cohortId: COHORT_ID },
      file:   makeMultipartFile(oversized, 'image/png'),
      user:   adminUser(),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(413)
    const b = reply._body as { error: string }
    expect(b.error).toBe('FILE_TOO_LARGE')
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('rejects a request with no file attached (400)', async () => {
    vi.mocked(Cohort.exists).mockResolvedValueOnce({ _id: COHORT_ID } as never)

    const { routes } = await buildFastify()
    const route = routes['POST /:cohortId/lesson-images']!
    const req = makeRequest({
      params: { cohortId: COHORT_ID },
      file:   null,
      user:   adminUser(),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    const b = reply._body as { error: string }
    expect(b.error).toBe('NO_FILE')
  })

  it('rejects an unknown cohort ID with 404', async () => {
    vi.mocked(Cohort.exists).mockResolvedValueOnce(null as never)

    const { routes } = await buildFastify()
    const route = routes['POST /:cohortId/lesson-images']!
    const req = makeRequest({
      params: { cohortId: COHORT_ID },
      file:   makeMultipartFile(Buffer.from('bytes'), 'image/jpeg'),
      user:   adminUser(),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(404)
    const b = reply._body as { error: string }
    expect(b.error).toBe('NOT_FOUND')
  })
})
