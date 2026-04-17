/**
 * Unit tests for apps/api/src/middleware/authenticate.ts
 *
 * The two exported functions — authenticate() and requireAdmin() — are pure
 * request/reply handlers.  They depend only on:
 *   • request.jwtVerify()   (injected by @fastify/jwt)
 *   • request.user          (set by jwtVerify on success)
 *   • reply.code().send()
 *   • reply.sent            (boolean flag set after send())
 *
 * We build minimal hand-rolled fakes for FastifyRequest and FastifyReply so
 * that we never need a real Fastify server or any I/O.
 *
 * Critical regression test included:
 *   PBA-138 — requireAdmin must NOT call reply.send() a second time after
 *   authenticate() has already sent a 401.  The double-response bug was fixed
 *   by checking `reply.sent` before continuing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyRequest, FastifyReply } from 'fastify'

// Mock the User model so authenticate() never hits the database in unit tests.
// By default all mocked User.findById calls return an active user.
vi.mock('../models/User.js', () => ({
  User: {
    findById: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ isActive: true }),
      }),
    }),
  },
}))

import { authenticate, requireAdmin, requireStudent } from '../middleware/authenticate.js'
import type { JwtPayload } from '../middleware/authenticate.js'
import { User } from '../models/User.js'

// ---------------------------------------------------------------------------
// Fake builder helpers
// ---------------------------------------------------------------------------

/**
 * Build a fake FastifyRequest.
 * jwtVerify resolves by default; override to reject for error scenarios.
 */
function makeRequest(
  opts: {
    jwtVerify?: () => Promise<void>
    user?: Partial<JwtPayload>
  } = {},
): FastifyRequest {
  return {
    jwtVerify: opts.jwtVerify ?? vi.fn().mockResolvedValue(undefined),
    user: opts.user ?? {},
  } as unknown as FastifyRequest
}

/**
 * Build a fake FastifyReply that tracks sent state.
 * reply.code(n).send(body) sets reply.sent = true, matching Fastify behaviour.
 */
function makeReply(): FastifyReply & { _status: number | null; _body: unknown } {
  const reply = {
    sent: false,
    _status: null as number | null,
    _body: undefined as unknown,
    code(status: number) {
      this._status = status
      return this
    },
    send(body: unknown) {
      this._body = body
      this.sent = true
      return this
    },
  }
  return reply as FastifyReply & { _status: number | null; _body: unknown }
}

/** A valid student JWT payload */
function studentPayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: '64f1a2b3c4d5e6f7a8b9c0d1',
    email: 'student@example.com',
    role: 'STUDENT',
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// authenticate()
// ---------------------------------------------------------------------------
describe('authenticate()', () => {
  beforeEach(() => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ isActive: true }),
      }),
    } as ReturnType<typeof User.findById>)
  })

  // -------------------------------------------------------------------------
  it('should set request.user and NOT send a reply when JWT is valid', async () => {
    // Arrange — jwtVerify resolves and sets request.user (simulated by pre-populating user)
    const request = makeRequest({
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: studentPayload(),
    })
    const reply = makeReply()

    // Act
    await authenticate(request, reply)

    // Assert
    expect(request.jwtVerify).toHaveBeenCalledOnce()
    expect(reply.sent).toBe(false)   // no response was sent
    expect(reply._status).toBeNull() // status untouched
  })

  // -------------------------------------------------------------------------
  it('should send 401 when the Authorization header is missing', async () => {
    // Arrange — @fastify/jwt throws when no token is present
    const missingTokenError = new Error('No Authorization was found in request.headers')
    const request = makeRequest({
      jwtVerify: vi.fn().mockRejectedValue(missingTokenError),
    })
    const reply = makeReply()

    // Act
    await authenticate(request, reply)

    // Assert
    expect(reply.sent).toBe(true)
    expect(reply._status).toBe(401)
    expect(reply._body).toMatchObject({
      error: 'UNAUTHORIZED',
      message: 'Valid access token required.',
    })
  })

  // -------------------------------------------------------------------------
  it('should send 401 when the JWT has expired', async () => {
    // Arrange — @fastify/jwt throws a TokenExpiredError
    const expiredError = new Error('jwt expired')
    const request = makeRequest({
      jwtVerify: vi.fn().mockRejectedValue(expiredError),
    })
    const reply = makeReply()

    // Act
    await authenticate(request, reply)

    // Assert
    expect(reply.sent).toBe(true)
    expect(reply._status).toBe(401)
  })

  // -------------------------------------------------------------------------
  it('should send 401 when the JWT signature is invalid', async () => {
    // Arrange
    const badSignatureError = new Error('invalid signature')
    const request = makeRequest({
      jwtVerify: vi.fn().mockRejectedValue(badSignatureError),
    })
    const reply = makeReply()

    // Act
    await authenticate(request, reply)

    // Assert
    expect(reply.sent).toBe(true)
    expect(reply._status).toBe(401)
  })

  // -------------------------------------------------------------------------
  // CRIT-2: deactivated users must be blocked even with a valid JWT
  it('should send 401 when user account is deactivated (CRIT-2)', async () => {
    // Override User mock to return a deactivated user
    vi.mocked(User.findById).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ isActive: false }),
      }),
    } as ReturnType<typeof User.findById>)

    const request = makeRequest({
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: studentPayload(),
    })
    const reply = makeReply()

    await authenticate(request, reply)

    expect(reply.sent).toBe(true)
    expect(reply._status).toBe(401)
    expect(reply._body).toMatchObject({ error: 'UNAUTHORIZED' })
  })

  // -------------------------------------------------------------------------
  it('should send 401 when user no longer exists in DB', async () => {
    vi.mocked(User.findById).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as ReturnType<typeof User.findById>)

    const request = makeRequest({
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: studentPayload(),
    })
    const reply = makeReply()

    await authenticate(request, reply)

    expect(reply.sent).toBe(true)
    expect(reply._status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// requireAdmin()
// ---------------------------------------------------------------------------
describe('requireAdmin()', () => {
  beforeEach(() => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ isActive: true }),
      }),
    } as ReturnType<typeof User.findById>)
  })

  // -------------------------------------------------------------------------
  it('should pass through without sending a reply when user has ADMIN role', async () => {
    // Arrange
    const request = makeRequest({
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: studentPayload({ role: 'ADMIN' }),
    })
    const reply = makeReply()

    // Act
    await requireAdmin(request, reply)

    // Assert
    expect(reply.sent).toBe(false)
    expect(reply._status).toBeNull()
  })

  // -------------------------------------------------------------------------
  it('should pass through without sending a reply when user has SUPER_ADMIN role', async () => {
    // Arrange
    const request = makeRequest({
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: studentPayload({ role: 'SUPER_ADMIN' }),
    })
    const reply = makeReply()

    // Act
    await requireAdmin(request, reply)

    // Assert
    expect(reply.sent).toBe(false)
  })

  // -------------------------------------------------------------------------
  it('should send 403 when user role is STUDENT', async () => {
    // Arrange
    const request = makeRequest({
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: studentPayload({ role: 'STUDENT' }),
    })
    const reply = makeReply()

    // Act
    await requireAdmin(request, reply)

    // Assert
    expect(reply.sent).toBe(true)
    expect(reply._status).toBe(403)
    expect(reply._body).toMatchObject({
      error: 'FORBIDDEN',
      message: 'Admin access required.',
    })
  })

  // -------------------------------------------------------------------------
  it('should send 403 when user role is an arbitrary non-admin value', async () => {
    // Arrange — defensive test for unexpected role strings from a bad token
    const request = makeRequest({
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: studentPayload({ role: 'MODERATOR' }),
    })
    const reply = makeReply()

    // Act
    await requireAdmin(request, reply)

    // Assert
    expect(reply._status).toBe(403)
  })

  // -------------------------------------------------------------------------
  it('should send 401 (not 403) when the token itself is invalid', async () => {
    // Arrange — jwtVerify fails before role can be checked
    const request = makeRequest({
      jwtVerify: vi.fn().mockRejectedValue(new Error('jwt malformed')),
    })
    const reply = makeReply()

    // Act
    await requireAdmin(request, reply)

    // Assert
    expect(reply._status).toBe(401)
  })

  // -------------------------------------------------------------------------
  /**
   * CRITICAL REGRESSION — PBA-138 double-response bug.
   *
   * Before the fix, requireAdmin() called reply.send() TWICE when the token
   * was invalid:
   *   1. authenticate() sent the 401
   *   2. The role-check code ran anyway and sent a 403
   *
   * The fix: `if (reply.sent) return` after calling authenticate().
   * This test verifies that path is still correct.
   */
  it('should NOT send a second reply after authenticate() already sent 401 (double-response regression)', async () => {
    // Arrange — track every call to reply.code()
    const codeSpy = vi.fn().mockReturnThis()
    const sendSpy = vi.fn().mockImplementation(function (this: { sent: boolean }) {
      this.sent = true
      return this
    })

    const reply = {
      sent: false,
      _status: null,
      code: codeSpy,
      send: sendSpy,
    } as unknown as FastifyReply & { _status: number | null }

    const request = makeRequest({
      jwtVerify: vi.fn().mockRejectedValue(new Error('jwt expired')),
    })

    // Act
    await requireAdmin(request, reply)

    // Assert — reply.code() must have been called exactly once (for the 401)
    // A second call would indicate the 403 branch fired after the 401 was sent
    expect(codeSpy).toHaveBeenCalledTimes(1)
    expect(codeSpy).toHaveBeenCalledWith(401)
    expect(sendSpy).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// requireStudent() — CRIT-5
// ---------------------------------------------------------------------------
describe('requireStudent()', () => {
  beforeEach(() => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ isActive: true }),
      }),
    } as ReturnType<typeof User.findById>)
  })

  it('should pass through without sending a reply when user has STUDENT role', async () => {
    const request = makeRequest({
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: studentPayload({ role: 'STUDENT' }),
    })
    const reply = makeReply()

    await requireStudent(request, reply)

    expect(reply.sent).toBe(false)
    expect(reply._status).toBeNull()
  })

  it('should send 403 when user role is ADMIN', async () => {
    const request = makeRequest({
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: studentPayload({ role: 'ADMIN' }),
    })
    const reply = makeReply()

    await requireStudent(request, reply)

    expect(reply.sent).toBe(true)
    expect(reply._status).toBe(403)
    expect(reply._body).toMatchObject({
      error: 'FORBIDDEN',
      message: 'Student access required.',
    })
  })

  it('should send 403 when user role is SUPER_ADMIN', async () => {
    const request = makeRequest({
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: studentPayload({ role: 'SUPER_ADMIN' }),
    })
    const reply = makeReply()

    await requireStudent(request, reply)

    expect(reply.sent).toBe(true)
    expect(reply._status).toBe(403)
  })

  it('should send 401 (not 403) when the token is invalid', async () => {
    const request = makeRequest({
      jwtVerify: vi.fn().mockRejectedValue(new Error('jwt malformed')),
    })
    const reply = makeReply()

    await requireStudent(request, reply)

    expect(reply._status).toBe(401)
  })
})
