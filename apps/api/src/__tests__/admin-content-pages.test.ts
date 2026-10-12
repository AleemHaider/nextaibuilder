/**
 * admin/content-pages.ts — CRUD + publish/unpublish for SEO/LLM content pages.
 *
 * Strategy mirrors admin-cohorts.test.ts: Mongoose models + the staticPages
 * disk-writer module are mocked, the route plugin is registered against a
 * fake FastifyInstance, and we drive each route handler directly (running
 * the real requireAdmin/requirePermission preHandlers against a mocked JWT
 * payload + User/SubAdminPermission lookups).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  FastifyInstance,
  FastifyRequest,
  preHandlerHookHandler,
  RouteHandlerMethod,
} from 'fastify'

// ── Mocks (hoisted) ────────────────────────────────────────────────────────

vi.mock('../models/ContentPage.js', () => ({
  ContentPage: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('../models/User.js', () => ({
  User: { findById: vi.fn() },
}))

vi.mock('../models/SubAdminPermission.js', () => ({
  SubAdminPermission: { findOne: vi.fn() },
}))

vi.mock('../lib/staticPages.js', () => ({
  writePublishedPage: vi.fn().mockResolvedValue(undefined),
  removePublishedPage: vi.fn().mockResolvedValue(undefined),
  regenerateIndexes: vi.fn().mockResolvedValue(undefined),
}))

// ── Imports after mocks ────────────────────────────────────────────────────

import { ContentPage } from '../models/ContentPage.js'
import { User } from '../models/User.js'
import { SubAdminPermission } from '../models/SubAdminPermission.js'
import { writePublishedPage, removePublishedPage, regenerateIndexes } from '../lib/staticPages.js'
import { adminContentPagesRoutes } from '../routes/admin/content-pages.js'

// ── Fake Fastify harness ────────────────────────────────────────────────────

const ADMIN_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const PAGE_ID = 'cccccccccccccccccccccccc'

type FakeReply = {
  sent: boolean
  _status: number | null
  _body: unknown
  code: (s: number) => FakeReply
  send: (b: unknown) => FakeReply
}

function makeReply(): FakeReply {
  const r: FakeReply = {
    sent: false,
    _status: null,
    _body: undefined,
    code(status) {
      r._status = status
      return r
    },
    send(body) {
      r._body = body
      r.sent = true
      return r
    },
  }
  return r
}

interface RegisteredRoute {
  preHandler?: preHandlerHookHandler
  handler: RouteHandlerMethod
}

async function buildFastify() {
  const routes: Record<string, RegisteredRoute> = {}

  const register = (method: string) =>
    vi.fn().mockImplementation((path: string, optsOrHandler: unknown, maybeHandler?: unknown) => {
      let preHandler: preHandlerHookHandler | undefined
      let handler: RouteHandlerMethod
      if (typeof optsOrHandler === 'function') {
        handler = optsOrHandler as RouteHandlerMethod
      } else {
        preHandler = (optsOrHandler as { preHandler?: preHandlerHookHandler }).preHandler
        handler = maybeHandler as RouteHandlerMethod
      }
      routes[`${method} ${path}`] = preHandler ? { preHandler, handler } : { handler }
    })

  const fastify = {
    get: register('GET'),
    post: register('POST'),
    patch: register('PATCH'),
    put: register('PUT'),
    delete: register('DELETE'),
    log: {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(),
      debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(),
    },
  } as unknown as FastifyInstance

  await adminContentPagesRoutes(fastify)
  return { routes }
}

function makeRequest(opts: {
  body?: unknown
  params?: Record<string, string>
  query?: Record<string, string>
  role?: 'ADMIN' | 'SUPER_ADMIN'
}): FastifyRequest {
  const req: Partial<FastifyRequest> & {
    body: unknown
    params: Record<string, string>
    query: Record<string, string>
    user: unknown
    jwtVerify: () => Promise<void>
  } = {
    body: opts.body,
    params: opts.params ?? {},
    query: opts.query ?? {},
    user: undefined,
    jwtVerify: vi.fn().mockImplementation(async function () {
      req.user = { sub: ADMIN_ID, role: opts.role ?? 'SUPER_ADMIN', email: 'a@x.io', iat: 0, exp: 0 }
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

describe('admin/content-pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(activeAdmin()) }),
    } as ReturnType<typeof User.findById>)
  })

  it('POST / creates a draft page with an auto-derived slug', async () => {
    vi.mocked(ContentPage.findOne).mockResolvedValueOnce(null)
    vi.mocked(ContentPage.create).mockResolvedValueOnce({
      id: PAGE_ID,
      title: 'How To Ship Fast',
      slug: 'how-to-ship-fast',
      section: 'guides',
      status: 'draft',
    } as Awaited<ReturnType<typeof ContentPage.create>>)

    const { routes } = await buildFastify()
    const route = routes['POST /']
    if (!route) throw new Error('POST / not registered')

    const req = makeRequest({
      body: {
        title: 'How To Ship Fast',
        section: 'guides',
        description: 'A guide',
        bodyHtml: '<p>hello</p>',
      },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(201)
    expect(ContentPage.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'how-to-ship-fast', status: 'draft' }),
    )
  })

  it('POST / rejects a slug collision with 409', async () => {
    vi.mocked(ContentPage.findOne).mockResolvedValueOnce({ id: 'existing' })

    const { routes } = await buildFastify()
    const route = routes['POST /']!
    const req = makeRequest({
      body: { title: 'Dup', slug: 'dup', section: 'guides', description: 'x', bodyHtml: '<p>x</p>' },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(409)
    expect(ContentPage.create).not.toHaveBeenCalled()
  })

  it('POST /:id/publish writes the static file and regenerates indexes', async () => {
    const pageDoc = {
      id: PAGE_ID,
      section: 'guides',
      slug: 'x',
      status: 'draft',
      publishedAt: null,
      save: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(ContentPage.findById).mockResolvedValueOnce(pageDoc as unknown as Awaited<ReturnType<typeof ContentPage.findById>>)

    const { routes } = await buildFastify()
    const route = routes['POST /:id/publish']!
    const req = makeRequest({ params: { id: PAGE_ID } })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(pageDoc.status).toBe('published')
    expect(pageDoc.save).toHaveBeenCalled()
    expect(writePublishedPage).toHaveBeenCalledWith(pageDoc)
    expect(regenerateIndexes).toHaveBeenCalled()
    expect(reply._status).toBeNull() // default 200 via .send()
    expect((reply._body as { success: boolean }).success).toBe(true)
  })

  it('POST /:id/unpublish removes the static file and regenerates indexes', async () => {
    const pageDoc = {
      id: PAGE_ID,
      section: 'resources',
      slug: 'y',
      status: 'published',
      save: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(ContentPage.findById).mockResolvedValueOnce(pageDoc as unknown as Awaited<ReturnType<typeof ContentPage.findById>>)

    const { routes } = await buildFastify()
    const route = routes['POST /:id/unpublish']!
    const req = makeRequest({ params: { id: PAGE_ID } })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(pageDoc.status).toBe('draft')
    expect(removePublishedPage).toHaveBeenCalledWith('resources', 'y')
    expect(regenerateIndexes).toHaveBeenCalled()
  })

  it('DELETE /:id 404s for a missing page', async () => {
    vi.mocked(ContentPage.findById).mockResolvedValueOnce(null)

    const { routes } = await buildFastify()
    const route = routes['DELETE /:id']!
    const req = makeRequest({ params: { id: PAGE_ID } })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(404)
  })

  it('rejects an ADMIN without the content-pages:publish grant with 403', async () => {
    vi.mocked(SubAdminPermission.findOne).mockReturnValueOnce({
      lean: () => Promise.resolve({ permissions: ['content-pages:read'] }),
    } as ReturnType<typeof SubAdminPermission.findOne>)

    const { routes } = await buildFastify()
    const route = routes['POST /:id/publish']!
    const req = makeRequest({ params: { id: PAGE_ID }, role: 'ADMIN' })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(403)
    expect(ContentPage.findById).not.toHaveBeenCalled()
    expect(writePublishedPage).not.toHaveBeenCalled()
  })

  it('rejects an invalid slug format with 400', async () => {
    const { routes } = await buildFastify()
    const route = routes['POST /']!
    const req = makeRequest({
      body: { title: 'Bad', slug: 'Not Valid Slug!', section: 'guides', description: 'x', bodyHtml: '<p>x</p>' },
    })
    const reply = makeReply()
    await runRoute(route, req, reply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
  })
})
