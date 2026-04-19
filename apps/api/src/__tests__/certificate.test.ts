/**
 * Sprint 2 Story 7 — Public /api/v1/certificate/verify/:token route
 *
 * Strategy mirrors admin-courses-lesson-reorder.test.ts: mock Mongoose models
 * with vi.mock(), register the route plugin against a hand-rolled Fastify
 * fake that captures handlers, then invoke the handler directly with a fake
 * request/reply.
 *
 * Coverage:
 *   1. Found / VALID → 200 { valid: true, credential: {...} }
 *   2. Not found     → 200 { valid: false, credential: null } (NOT 404)
 *   3. REVOKED       → 200 { valid: false, credential.status === 'REVOKED' }
 *   4. Empty token   → 200 { valid: false, credential: null }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  FastifyInstance,
  FastifyRequest,
  RouteHandlerMethod,
} from 'fastify'

// ── Mocks (hoisted before route module import) ────────────────────────────

vi.mock('../models/Certificate.js', () => ({
  Certificate: {
    findOne: vi.fn(),
  },
}))

vi.mock('../models/User.js', () => ({
  User: {
    findById: vi.fn(),
  },
}))

vi.mock('../models/Cohort.js', () => ({
  Cohort: {
    findById: vi.fn(),
  },
}))

// Model imports come AFTER mocks so the mocked versions resolve.
import { Certificate } from '../models/Certificate.js'
import { User } from '../models/User.js'
import { Cohort } from '../models/Cohort.js'
import { certificateRoutes } from '../routes/certificate.js'

// ── Fake Fastify capture ──────────────────────────────────────────────────

type FakeReply = {
  sent: boolean
  _status: number | null
  _body: unknown
  status: (s: number) => FakeReply
  code: (s: number) => FakeReply
  send: (b: unknown) => FakeReply
}

function makeReply(): FakeReply {
  const r: FakeReply = {
    sent: false,
    _status: null,
    _body: undefined,
    status(s) {
      r._status = s
      return r
    },
    code(s) {
      r._status = s
      return r
    },
    send(b) {
      r._body = b
      r.sent = true
      return r
    },
  }
  return r
}

interface RegisteredRoute {
  handler: RouteHandlerMethod
}

async function buildFastify() {
  const routes: Record<string, RegisteredRoute> = {}

  const register = (method: string) =>
    vi.fn().mockImplementation(
      (path: string, optsOrHandler: unknown, maybeHandler?: unknown) => {
        const handler =
          typeof optsOrHandler === 'function'
            ? (optsOrHandler as RouteHandlerMethod)
            : (maybeHandler as RouteHandlerMethod)
        routes[`${method} ${path}`] = { handler }
      },
    )

  const fastify = {
    get: register('GET'),
  } as unknown as FastifyInstance

  await certificateRoutes(fastify)
  return { routes }
}

async function getVerifyRoute(): Promise<RegisteredRoute> {
  const { routes } = await buildFastify()
  const route = routes['GET /verify/:token']
  if (!route) throw new Error('verify route not registered')
  return route
}

function makeRequest(token: string): FastifyRequest {
  const req: Partial<FastifyRequest> & { params: Record<string, string> } = {
    params: { token },
  }
  return req as unknown as FastifyRequest
}

async function runRoute(route: RegisteredRoute, token: string) {
  const req = makeRequest(token)
  const reply = makeReply()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (route.handler as any)(req, reply)
  return reply
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /verify/:token — public certificate verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the credential when found and not revoked', async () => {
    const issuedAt = new Date('2024-06-01T12:00:00Z')
    vi.mocked(Certificate.findOne).mockReturnValueOnce({
      lean: () =>
        Promise.resolve({
          userId: 'u1',
          cohortId: 'c1',
          publicToken: 'pub-token',
          credentialId: 'NAB-2024-000042',
          issuedAt,
        }),
    } as ReturnType<typeof Certificate.findOne>)
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: () =>
        Promise.resolve({ firstName: 'Ada', lastName: 'Lovelace' }),
    } as ReturnType<typeof User.findById>)
    vi.mocked(Cohort.findById).mockReturnValueOnce({
      lean: () => Promise.resolve({ name: 'AI Builder Cohort 3' }),
    } as ReturnType<typeof Cohort.findById>)

    const route = await getVerifyRoute()
    const reply = await runRoute(route, 'NAB-2024-000042')

    expect(reply._status).toBe(200)
    expect(reply._body).toEqual({
      valid: true,
      credential: {
        credentialId: 'NAB-2024-000042',
        studentName: 'Ada Lovelace',
        cohortTitle: 'AI Builder Cohort 3',
        completedAt: null,
        issuedAt: issuedAt.toISOString(),
        status: 'VALID',
      },
    })
  })

  it('returns { valid: false, credential: null } with HTTP 200 when not found', async () => {
    vi.mocked(Certificate.findOne).mockReturnValueOnce({
      lean: () => Promise.resolve(null),
    } as ReturnType<typeof Certificate.findOne>)

    const route = await getVerifyRoute()
    const reply = await runRoute(route, 'NAB-NOPE-000000')

    // HTTP 200, not 404 — avoids leaking existence to scanners.
    expect(reply._status).toBe(200)
    expect(reply._body).toEqual({ valid: false, credential: null })
    // No need to call User / Cohort when nothing matched.
    expect(User.findById).not.toHaveBeenCalled()
    expect(Cohort.findById).not.toHaveBeenCalled()
  })

  it('reports REVOKED when the certificate status is REVOKED', async () => {
    const issuedAt = new Date('2024-01-15T00:00:00Z')
    vi.mocked(Certificate.findOne).mockReturnValueOnce({
      lean: () =>
        Promise.resolve({
          userId: 'u2',
          cohortId: null,
          credentialId: 'NAB-2024-000007',
          publicToken: 'pub-b',
          issuedAt,
          status: 'REVOKED',
        }),
    } as ReturnType<typeof Certificate.findOne>)
    vi.mocked(User.findById).mockReturnValueOnce({
      lean: () =>
        Promise.resolve({ firstName: 'Grace', lastName: 'Hopper' }),
    } as ReturnType<typeof User.findById>)

    const route = await getVerifyRoute()
    const reply = await runRoute(route, 'NAB-2024-000007')

    expect(reply._status).toBe(200)
    const body = reply._body as {
      valid: boolean
      credential: { status: string; credentialId: string }
    }
    expect(body.valid).toBe(false)
    expect(body.credential.status).toBe('REVOKED')
    expect(body.credential.credentialId).toBe('NAB-2024-000007')
  })

  it('treats an empty/whitespace token as not found without hitting the DB', async () => {
    const route = await getVerifyRoute()
    const reply = await runRoute(route, '   ')

    expect(reply._status).toBe(200)
    expect(reply._body).toEqual({ valid: false, credential: null })
    expect(Certificate.findOne).not.toHaveBeenCalled()
  })
})
