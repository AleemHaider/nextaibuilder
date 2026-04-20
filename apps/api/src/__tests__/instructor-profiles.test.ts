/**
 * NAB-P0-3 — Admin InstructorProfile CRUD + avatar upload.
 *
 * Coverage:
 *   1. POST   /        — happy-path create
 *   2. POST   /        — 409 when a profile already exists for the userId
 *   3. POST   /        — 400 validation error on an invalid userId
 *   4. GET    /        — returns a paginated list of profiles
 *   5. PATCH  /:id     — partial update, only listed fields patched
 *   6. DELETE /:id     — hard-delete + $pull sweep of Cohort.instructorIds
 *   7. POST   /:id/avatar — happy-path jpeg upload
 *   8. POST   /:id/avatar — 415 on unsupported mime
 *   9. POST   /:id/avatar — 413 on oversized body
 *
 * Strategy mirrors lesson-image-upload.test.ts: Mongoose models and fs are
 * mocked, the route plugin is registered against a fake Fastify, and each
 * handler is driven directly.
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

vi.mock('../models/InstructorProfile.js', () => ({
  InstructorProfile: {
    find:              vi.fn(),
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create:            vi.fn(),
    exists:            vi.fn(),
    countDocuments:    vi.fn(),
    deleteOne:         vi.fn(),
  },
}))

vi.mock('../models/Cohort.js', () => ({
  Cohort: {
    updateMany: vi.fn(),
  },
}))

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

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir:     vi.fn().mockResolvedValue(undefined),
}))

import { InstructorProfile } from '../models/InstructorProfile.js'
import { Cohort } from '../models/Cohort.js'
import { User } from '../models/User.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { uploadToS3 } from '../lib/s3.js'
import { adminInstructorProfilesRoutes } from '../routes/admin/instructor-profiles.js'

const writeFileMock = vi.mocked(writeFile)
const mkdirMock     = vi.mocked(mkdir)
const uploadToS3Mock = vi.mocked(uploadToS3)

// ── Fake Fastify harness ───────────────────────────────────────────────────

const PROFILE_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const USER_ID    = 'cccccccccccccccccccccccc'
const ADMIN_ID   = 'aaaaaaaaaaaaaaaaaaaaaaaa'

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
  await adminInstructorProfilesRoutes(fastify)
  return { fastify, routes }
}

function makeMultipartFile(buf: Buffer, mimetype: string) {
  return {
    mimetype,
    file: (async function* () {
      yield buf
    })(),
  }
}

function makeRequest(opts: {
  params?:      Record<string, string>
  body?:        unknown
  query?:       Record<string, string>
  file?:        ReturnType<typeof makeMultipartFile> | null
  user?:        { sub: string; role: string; email?: string; iat?: number; exp?: number }
}): FastifyRequest {
  const req: Partial<FastifyRequest> & {
    body:   unknown
    params: Record<string, string>
    query:  Record<string, string>
    user:   unknown
    file:   (opts?: unknown) => Promise<unknown>
    jwtVerify: () => Promise<void>
  } = {
    body:   opts.body ?? {},
    params: opts.params ?? {},
    query:  opts.query ?? {},
    user:   undefined,
    file:   vi.fn().mockImplementation(async () => opts.file ?? undefined),
    jwtVerify: vi.fn().mockImplementation(async function () {
      req.user = opts.user ?? adminUser()
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

describe('NAB-P0-3 — POST /instructor-profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
  })

  it('creates a profile and returns 201 on the happy path', async () => {
    vi.mocked(InstructorProfile.exists).mockResolvedValueOnce(null as never)
    vi.mocked(InstructorProfile.create).mockResolvedValueOnce({
      toJSON: () => ({
        id:     PROFILE_ID,
        userId: USER_ID,
        name:   'Jane Doe',
        title:  'Senior Engineer',
        bio:    '',
        avatarKey:   null,
        socialLinks: [],
      }),
    } as never)

    const { routes } = await buildFastify()
    const route = routes['POST /']!
    const req = makeRequest({
      body: { userId: USER_ID, name: 'Jane Doe', title: 'Senior Engineer' },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(201)
    const b = reply._body as { profile: { id: string; name: string } }
    expect(b.profile.name).toBe('Jane Doe')
    expect(InstructorProfile.create).toHaveBeenCalledOnce()
  })

  it('returns 409 when a profile already exists for this userId', async () => {
    vi.mocked(InstructorProfile.exists).mockResolvedValueOnce({ _id: PROFILE_ID } as never)

    const { routes } = await buildFastify()
    const route = routes['POST /']!
    const req = makeRequest({
      body: { userId: USER_ID, name: 'Jane Doe' },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(409)
    expect((reply._body as { error: string }).error).toBe('USERID_CONFLICT')
    expect(InstructorProfile.create).not.toHaveBeenCalled()
  })

  it('returns 400 VALIDATION_ERROR when userId is not a valid ObjectId', async () => {
    const { routes } = await buildFastify()
    const route = routes['POST /']!
    const req = makeRequest({
      body: { userId: 'not-an-oid', name: 'Jane Doe' },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
    expect(InstructorProfile.create).not.toHaveBeenCalled()
  })

  it('returns 400 when name is empty', async () => {
    const { routes } = await buildFastify()
    const route = routes['POST /']!
    const req = makeRequest({
      body: { userId: USER_ID, name: '' },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)
    expect(reply._status).toBe(400)
  })
})

describe('NAB-P0-3 — GET /instructor-profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
  })

  it('returns a paginated list of profiles', async () => {
    const profiles = [{
      _id: PROFILE_ID,
      userId: USER_ID,
      name: 'Jane',
      title: '',
      bio: '',
      avatarKey: null,
      socialLinks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }]
    const query = {
      sort:  () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve(profiles) }) }) }),
    } as never
    vi.mocked(InstructorProfile.find).mockReturnValueOnce(query)
    vi.mocked(InstructorProfile.countDocuments).mockResolvedValueOnce(1 as never)

    const { routes } = await buildFastify()
    const route = routes['GET /']!
    const req = makeRequest({ query: {} })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBeNull() // no explicit code set = 200
    const b = reply._body as { total: number; profiles: Array<{ id: string }> }
    expect(b.total).toBe(1)
    expect(b.profiles[0].id).toBe(PROFILE_ID)
  })
})

describe('NAB-P0-3 — PATCH /instructor-profiles/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
  })

  it('applies only the listed fields and returns the updated profile', async () => {
    vi.mocked(InstructorProfile.findByIdAndUpdate).mockReturnValueOnce({
      lean: () => Promise.resolve({
        _id: PROFILE_ID,
        userId: USER_ID,
        name: 'Jane',
        title: 'New Title',
        bio: '',
        avatarKey: null,
        socialLinks: [],
      }),
    } as never)

    const { routes } = await buildFastify()
    const route = routes['PATCH /:id']!
    const req = makeRequest({
      params: { id: PROFILE_ID },
      body:   { title: 'New Title' },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBeNull()
    expect(InstructorProfile.findByIdAndUpdate).toHaveBeenCalledOnce()
    const patchArg = vi.mocked(InstructorProfile.findByIdAndUpdate).mock.calls[0]?.[1] as {
      $set: Record<string, unknown>
    }
    expect(patchArg.$set).toEqual({ title: 'New Title' })
  })

  it('returns 400 when no updateable fields are provided', async () => {
    const { routes } = await buildFastify()
    const route = routes['PATCH /:id']!
    const req = makeRequest({
      params: { id: PROFILE_ID },
      body:   {},
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('NO_CHANGES')
  })
})

describe('NAB-P0-3 — DELETE /instructor-profiles/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
  })

  it('hard-deletes + sweeps Cohort.instructorIds', async () => {
    vi.mocked(InstructorProfile.deleteOne).mockResolvedValueOnce({ deletedCount: 1 } as never)
    vi.mocked(Cohort.updateMany).mockResolvedValueOnce({ modifiedCount: 1 } as never)

    const { routes } = await buildFastify()
    const route = routes['DELETE /:id']!
    const req = makeRequest({ params: { id: PROFILE_ID } })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(204)
    expect(InstructorProfile.deleteOne).toHaveBeenCalledOnce()
    expect(Cohort.updateMany).toHaveBeenCalledOnce()
    // $pull + filter by the same ObjectId.
    const [filter, update] = vi.mocked(Cohort.updateMany).mock.calls[0]
    expect((filter as { instructorIds: unknown }).instructorIds.toString()).toBe(PROFILE_ID)
    expect((update as { $pull: { instructorIds: unknown } }).$pull.instructorIds.toString()).toBe(PROFILE_ID)
  })
})

describe('NAB-P0-3 — POST /instructor-profiles/:id/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
  })

  it('accepts a jpeg and returns { avatarKey } under the right prefix', async () => {
    vi.mocked(InstructorProfile.exists).mockResolvedValueOnce({ _id: PROFILE_ID } as never)
    vi.mocked(InstructorProfile.findByIdAndUpdate).mockResolvedValueOnce({} as never)

    const { routes } = await buildFastify()
    const route = routes['POST /:id/avatar']!
    const req = makeRequest({
      params: { id: PROFILE_ID },
      file:   makeMultipartFile(Buffer.from('jpeg-bytes'), 'image/jpeg'),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBeNull()
    const b = reply._body as { avatarKey: string }
    expect(b.avatarKey).toMatch(new RegExp(`^instructor-avatars/${PROFILE_ID}/\\d+\\.jpg$`))
    // Local fallback write path since IS_S3_CONFIGURED = false.
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(mkdirMock).toHaveBeenCalledTimes(1)
    expect(uploadToS3Mock).not.toHaveBeenCalled()
  })

  it('rejects an unsupported mime with 415', async () => {
    vi.mocked(InstructorProfile.exists).mockResolvedValueOnce({ _id: PROFILE_ID } as never)

    const { routes } = await buildFastify()
    const route = routes['POST /:id/avatar']!
    const req = makeRequest({
      params: { id: PROFILE_ID },
      file:   makeMultipartFile(Buffer.from('plain text'), 'text/plain'),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(415)
    expect((reply._body as { error: string }).error).toBe('UNSUPPORTED_MEDIA_TYPE')
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized body with 413', async () => {
    vi.mocked(InstructorProfile.exists).mockResolvedValueOnce({ _id: PROFILE_ID } as never)

    const { routes } = await buildFastify()
    const route = routes['POST /:id/avatar']!
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 0)
    const req = makeRequest({
      params: { id: PROFILE_ID },
      file:   makeMultipartFile(oversized, 'image/png'),
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(413)
    expect((reply._body as { error: string }).error).toBe('FILE_TOO_LARGE')
  })
})
