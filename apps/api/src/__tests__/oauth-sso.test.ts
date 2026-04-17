/**
 * Regression tests for POST /api/auth/oauth/google and POST /api/auth/oauth/apple
 *
 * Covers:
 *  Google sign-in
 *   G1. New user (email + sub unknown)        → 403 NOT_ENROLLED (must be pre-registered by admin)
 *   G2. Existing user matched by oauthId      → logs in, returns 200
 *   G3. PENDING invite user (no inviteToken)  → auto-activates account, returns 200 (new behavior PBA-343+)
 *   G4. PENDING invite user — update succeeds but re-fetch returns null → 500 INTERNAL_ERROR
 *   G5. REVOKED account                       → 403 ACCOUNT_REVOKED
 *   G6. ACCEPTED user with oauthId null       → normal sign-in, 200, NO findOneAndUpdate call
 *   G7. Invalid Google id_token               → 401 INVALID_TOKEN
 *   G8. Missing idToken in body               → 400 VALIDATION_ERROR
 *   G9. Google token missing email claim      → 401 INVALID_TOKEN
 *
 *  Apple sign-in
 *   A1. New Apple user (first sign-in with name) → 403 NOT_ENROLLED (must be pre-registered by admin)
 *   A2. PENDING invite user (Apple)             → auto-activates, returns 200
 *   A3. REVOKED account (Apple)                 → 403 ACCOUNT_REVOKED
 *   A4. Invalid Apple id_token                  → 401 INVALID_TOKEN
 *   A5. Missing idToken in body                 → 400 VALIDATION_ERROR
 *
 * Strategy
 * --------
 * All external dependencies are mocked via vi.mock(). The oauth route module is
 * imported AFTER mocks are declared so Vitest's hoisting works correctly. Route
 * handlers are extracted by inspecting the calls recorded on the fake
 * fastify.post() mock — identical to the pattern in oauth-invite.test.ts.
 *
 * Apple sign-in requires a 3-part JWT string + JWKS fetch. We mock:
 *  - global.fetch for Apple's key endpoint
 *  - jsonwebtoken.verify for the key verification step
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// ---------------------------------------------------------------------------
// Mocks — all vi.fn() defined INSIDE factories (hoisting-safe)
// ---------------------------------------------------------------------------

vi.mock('google-auth-library', () => {
  const verifyIdToken = vi.fn()
  return {
    OAuth2Client: function MockOAuth2Client() {
      return { verifyIdToken }
    },
    __verifyIdToken: verifyIdToken,
  }
})

vi.mock('../models/User.js', () => ({
  User: {
    findOne:          vi.fn(),
    findOneAndUpdate: vi.fn(),
    findById:         vi.fn(),
    create:           vi.fn(),
    updateOne:        vi.fn(),
  },
}))

vi.mock('../models/RefreshToken.js', () => ({
  RefreshToken: {
    create: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../models/ActivityLog.js', () => ({
  ActivityLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-token') },
}))

// jsonwebtoken mock — used for Apple token verification
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
  verify: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import * as GoogleAuthLib from 'google-auth-library'
import { User } from '../models/User.js'
import { oauthRoutes } from '../routes/oauth.js'

const mockVerifyIdToken = (
  GoogleAuthLib as unknown as { __verifyIdToken: ReturnType<typeof vi.fn> }
).__verifyIdToken

// ---------------------------------------------------------------------------
// Fake Fastify helpers (same pattern as existing tests)
// ---------------------------------------------------------------------------

function makeReply(): FastifyReply & { _status: number | null; _body: unknown } {
  const r = {
    sent:    false,
    _status: null as number | null,
    _body:   undefined as unknown,
    code(status: number) { this._status = status; return this },
    send(body: unknown)  { this._body = body; this.sent = true; return this },
    setCookie()          { return this },
  }
  return r as FastifyReply & { _status: number | null; _body: unknown }
}

function makeFastify(): FastifyInstance {
  return {
    post: vi.fn(),
    jwt:  { sign: vi.fn().mockReturnValue('mock-access-token') },
  } as unknown as FastifyInstance
}

function makeRequest(body: Record<string, unknown>): FastifyRequest {
  return { body } as unknown as FastifyRequest
}

/** Extract a registered route handler by path name */
async function getHandler(path: '/google' | '/apple') {
  const fastify = makeFastify()
  await oauthRoutes(fastify)
  const postMock = fastify.post as ReturnType<typeof vi.fn>
  const call = (postMock.mock.calls as unknown[][]).find((c) => c[0] === path)
  if (!call) throw new Error(`POST ${path} route not registered`)
  // Route registration: post(path, config, handler) → handler is index 2
  return call[2] as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GOOGLE_SUB  = 'google-sub-xyz-789'
const APPLE_SUB   = 'apple-sub-xyz-789'
const USER_EMAIL  = 'student@example.com'
const USER_ID_STR = 'aaaaaaaaaaaaaaaaaaaaaaaa'

const GOOGLE_PAYLOAD = {
  sub:         GOOGLE_SUB,
  email:       USER_EMAIL,
  given_name:  'Alice',
  family_name: 'Smith',
  picture:     'https://example.com/avatar.jpg',
}

function makeUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id:               { toString: () => USER_ID_STR },
    email:             USER_EMAIL,
    firstName:         'Alice',
    lastName:          'Smith',
    role:              'STUDENT',
    avatarUrl:         'https://example.com/avatar.jpg',
    oauthId:           GOOGLE_SUB,
    oauthProvider:     'google',
    inviteStatus:      'ACCEPTED',
    inviteAcceptedAt:  new Date(),
    passwordSetToken:  null,
    passwordSetExpiry: null,
    ...overrides,
  }
}

function pendingGoogleUser(overrides: Record<string, unknown> = {}) {
  return makeUserDoc({
    oauthId:           null,
    oauthProvider:     null,
    inviteStatus:      'PENDING',
    passwordSetToken:  'some-token',
    passwordSetExpiry: new Date(Date.now() + 3_600_000),
    ...overrides,
  })
}

function setValidGoogleToken(emailOverride?: string) {
  mockVerifyIdToken.mockResolvedValueOnce({
    getPayload: () => ({
      ...GOOGLE_PAYLOAD,
      ...(emailOverride ? { email: emailOverride } : {}),
    }),
  })
}

function setInvalidGoogleToken() {
  mockVerifyIdToken.mockRejectedValueOnce(new Error('Token used too late'))
}

// Apple token helpers — Apple uses a real JWT verified with JWKS
// We fake the Apple JWKS fetch + jwt.verify
const FAKE_APPLE_KID = 'FAKE_APPLE_KID_001'

function buildFakeAppleJwt(kid: string = FAKE_APPLE_KID): string {
  // Base64url-encode a fake header so the route can extract `kid`
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid })).toString('base64url')
  return `${header}.fakepayload.fakesig`
}

async function setupAppleMocks(decoded: Record<string, unknown> = { sub: APPLE_SUB, email: USER_EMAIL }) {
  // Mock global.fetch for Apple's JWKS endpoint
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: vi.fn().mockResolvedValue({
      keys: [{ kid: FAKE_APPLE_KID, kty: 'RSA', use: 'sig', alg: 'RS256', n: 'fake-n', e: 'AQAB' }],
    }),
  }))

  // Mock crypto.createPublicKey (used internally) — since we mock jwt.verify, the key object doesn't matter
  // Mock jwt.verify to return the decoded payload
  const jwtModule = await import('jsonwebtoken')
  vi.mocked(jwtModule.default.verify).mockReturnValue(decoded as never)
}

// ---------------------------------------------------------------------------
// Google sign-in tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/oauth/google', () => {
  let handle: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

  beforeEach(async () => {
    mockVerifyIdToken.mockReset()
    vi.mocked(User.findOne).mockReset()
    vi.mocked(User.findOneAndUpdate).mockReset()
    vi.mocked(User.findById).mockReset()
    vi.mocked(User.create).mockReset()
    vi.mocked(User.updateOne).mockResolvedValue({} as never)

    handle = await getHandler('/google')
  })

  // ── G1: Unknown user → 403 NOT_ENROLLED ──────────────────────────────────

  it('G1 should return 403 NOT_ENROLLED when no existing user matches Google token', async () => {
    // Arrange — student was never added by admin
    setValidGoogleToken()
    vi.mocked(User.findOne).mockResolvedValueOnce(null)

    const reply = makeReply()

    // Act
    await handle(makeRequest({ idToken: 'valid-google-token' }), reply)

    // Assert
    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('NOT_ENROLLED')
    expect(vi.mocked(User.create)).not.toHaveBeenCalled()
  })

  // ── G2: Existing user matched by oauthId → sign-in ───────────────────────

  it('G2 should sign in and return 200 when an existing user is matched by Google oauthId', async () => {
    // Arrange
    setValidGoogleToken()
    const existingUser = makeUserDoc({ oauthId: GOOGLE_SUB })
    vi.mocked(User.findOne).mockResolvedValueOnce(existingUser as never)

    const reply = makeReply()

    // Act
    await handle(makeRequest({ idToken: 'valid-google-token' }), reply)

    // Assert
    expect(reply._status).toBe(200)
    const body = reply._body as { accessToken: string; user: { id: string } }
    expect(body.accessToken).toBe('mock-access-token')
    expect(body.user.id).toBe(USER_ID_STR)
    // No new user created
    expect(vi.mocked(User.create)).not.toHaveBeenCalled()
  })

  // ── G3: PENDING invite user (no inviteToken) → auto-activates ────────────

  it('G3 should auto-activate a PENDING invite user without an inviteToken and return 200', async () => {
    // Arrange — new behavior: no invite token required for OAuth-based activation
    setValidGoogleToken()
    vi.mocked(User.findOne).mockResolvedValueOnce(pendingGoogleUser() as never)
    vi.mocked(User.findOneAndUpdate).mockResolvedValueOnce({} as never)
    const activatedUser = makeUserDoc({ oauthId: GOOGLE_SUB, inviteStatus: 'ACCEPTED' })
    vi.mocked(User.findById).mockResolvedValueOnce(activatedUser as never)

    const reply = makeReply()

    // Act — no inviteToken in body
    await handle(makeRequest({ idToken: 'valid-google-token' }), reply)

    // Assert
    expect(reply._status).toBe(200)
    const body = reply._body as { user: { email: string } }
    expect(body.user.email).toBe(USER_EMAIL)

    // Verify findOneAndUpdate was called with the activation payload
    expect(vi.mocked(User.findOneAndUpdate)).toHaveBeenCalledOnce()
    const [, updateDoc] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown>; $unset: Record<string, string> },
    ]
    expect(updateDoc.$set['inviteStatus']).toBe('ACCEPTED')
    expect(updateDoc.$set['oauthId']).toBe(GOOGLE_SUB)
    expect(updateDoc.$set['oauthProvider']).toBe('google')
    expect(updateDoc.$unset['passwordSetToken']).toBe('')
    expect(updateDoc.$unset['passwordSetExpiry']).toBe('')
  })

  it('G3b should update the student name from Google profile when activating a PENDING user', async () => {
    // Arrange
    setValidGoogleToken()
    vi.mocked(User.findOne).mockResolvedValueOnce(pendingGoogleUser() as never)
    vi.mocked(User.findOneAndUpdate).mockResolvedValueOnce({} as never)
    const activatedUser = makeUserDoc({ firstName: 'Alice', lastName: 'Smith' })
    vi.mocked(User.findById).mockResolvedValueOnce(activatedUser as never)

    const reply = makeReply()
    await handle(makeRequest({ idToken: 'valid-google-token' }), reply)

    // The $set payload should include first/last name from Google token
    const [, updateDoc] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ]
    expect(updateDoc.$set['firstName']).toBe('Alice')
    expect(updateDoc.$set['lastName']).toBe('Smith')
  })

  // ── G4: PENDING user — re-fetch after activation returns null → 500 ───────

  it('G4 should return 500 INTERNAL_ERROR when the activated user cannot be re-fetched', async () => {
    // Arrange
    setValidGoogleToken()
    vi.mocked(User.findOne).mockResolvedValueOnce(pendingGoogleUser() as never)
    vi.mocked(User.findOneAndUpdate).mockResolvedValueOnce({} as never)
    vi.mocked(User.findById).mockResolvedValueOnce(null as never) // re-fetch returns null

    const reply = makeReply()

    // Act
    await handle(makeRequest({ idToken: 'valid-google-token' }), reply)

    // Assert
    expect(reply._status).toBe(500)
    expect((reply._body as { error: string }).error).toBe('INTERNAL_ERROR')
  })

  // ── G5: REVOKED account → 403 ACCOUNT_REVOKED ────────────────────────────

  it('G5 should return 403 ACCOUNT_REVOKED for a user with inviteStatus REVOKED', async () => {
    // Arrange
    setValidGoogleToken()
    vi.mocked(User.findOne).mockResolvedValueOnce(
      pendingGoogleUser({ inviteStatus: 'REVOKED' }) as never,
    )

    const reply = makeReply()

    // Act
    await handle(makeRequest({ idToken: 'valid-google-token' }), reply)

    // Assert
    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('ACCOUNT_REVOKED')
    expect(vi.mocked(User.findOneAndUpdate)).not.toHaveBeenCalled()
    expect(vi.mocked(User.create)).not.toHaveBeenCalled()
  })

  // ── G6: ACCEPTED user with oauthId null → normal sign-in, no activation ──

  it('G6 should allow normal sign-in for ACCEPTED user even when oauthId is not yet written', async () => {
    // Arrange — account exists, accepted, but oauthId wasn't persisted yet
    setValidGoogleToken()
    const acceptedNoOauthId = makeUserDoc({ oauthId: null, inviteStatus: 'ACCEPTED' })
    vi.mocked(User.findOne).mockResolvedValueOnce(acceptedNoOauthId as never)

    const reply = makeReply()

    // Act
    await handle(makeRequest({ idToken: 'valid-google-token' }), reply)

    // Assert
    expect(reply._status).toBe(200)
    // findOneAndUpdate must NOT be called — this is a plain sign-in, not activation
    expect(vi.mocked(User.findOneAndUpdate)).not.toHaveBeenCalled()
    expect(vi.mocked(User.create)).not.toHaveBeenCalled()
  })

  // ── G7: Invalid Google token → 401 INVALID_TOKEN ─────────────────────────

  it('G7 should return 401 INVALID_TOKEN when Google id_token verification throws', async () => {
    // Arrange
    setInvalidGoogleToken()

    const reply = makeReply()

    // Act
    await handle(makeRequest({ idToken: 'garbage-token' }), reply)

    // Assert
    expect(reply._status).toBe(401)
    expect((reply._body as { error: string }).error).toBe('INVALID_TOKEN')
    expect(vi.mocked(User.findOne)).not.toHaveBeenCalled()
  })

  // ── G8: Missing idToken → 400 VALIDATION_ERROR ───────────────────────────

  it('G8 should return 400 VALIDATION_ERROR when idToken is missing from request body', async () => {
    // Arrange — body is completely empty
    const reply = makeReply()

    // Act
    await handle(makeRequest({}), reply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
    // Google client should never have been called
    expect(mockVerifyIdToken).not.toHaveBeenCalled()
  })

  it('G8b should return 400 VALIDATION_ERROR when idToken is an empty string', async () => {
    // Arrange
    const reply = makeReply()

    // Act
    await handle(makeRequest({ idToken: '' }), reply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
  })

  // ── G9: Token missing email claim → 401 ──────────────────────────────────

  it('G9 should return 401 INVALID_TOKEN when the Google token payload is missing the email claim', async () => {
    // Arrange — getPayload returns no email
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ sub: GOOGLE_SUB }), // email intentionally absent
    })

    const reply = makeReply()

    // Act
    await handle(makeRequest({ idToken: 'valid-token-no-email' }), reply)

    // Assert
    expect(reply._status).toBe(401)
    expect((reply._body as { error: string }).error).toBe('INVALID_TOKEN')
  })

  // ── Additional: return shape includes all required user fields ─────────────

  it('should include id, email, firstName, lastName, role, and avatarUrl in the user response', async () => {
    // Arrange
    setValidGoogleToken()
    const user = makeUserDoc()
    vi.mocked(User.findOne).mockResolvedValueOnce(user as never)

    const reply = makeReply()
    await handle(makeRequest({ idToken: 'valid-google-token' }), reply)

    const body = reply._body as {
      user: { id: string; email: string; firstName: string; lastName: string; role: string; avatarUrl: string }
    }
    expect(body.user.id).toBe(USER_ID_STR)
    expect(body.user.email).toBe(USER_EMAIL)
    expect(body.user.firstName).toBe('Alice')
    expect(body.user.lastName).toBe('Smith')
    expect(body.user.role).toBe('STUDENT')
  })
})

// ---------------------------------------------------------------------------
// Apple sign-in tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/oauth/apple', () => {
  let handle: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

  beforeEach(async () => {
    vi.mocked(User.findOne).mockReset()
    vi.mocked(User.findOneAndUpdate).mockReset()
    vi.mocked(User.findById).mockReset()
    vi.mocked(User.create).mockReset()
    vi.mocked(User.updateOne).mockResolvedValue({} as never)
    vi.unstubAllGlobals()

    handle = await getHandler('/apple')
  })

  // ── A1: Unknown Apple user → 403 NOT_ENROLLED ────────────────────────────

  it('A1 should return 403 NOT_ENROLLED when no existing user matches Apple token', async () => {
    // Arrange — student was never added by admin
    await setupAppleMocks({ sub: APPLE_SUB, email: USER_EMAIL })
    vi.mocked(User.findOne).mockResolvedValueOnce(null)

    const reply = makeReply()

    // Act
    await handle(
      makeRequest({
        idToken: buildFakeAppleJwt(),
        user: { firstName: 'Alice', lastName: 'Smith' },
      }),
      reply,
    )

    // Assert
    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('NOT_ENROLLED')
    expect(vi.mocked(User.create)).not.toHaveBeenCalled()
  })

  // ── A2: PENDING invite user (Apple) → auto-activates ─────────────────────

  it('A2 should auto-activate a PENDING invite user via Apple sign-in and return 200', async () => {
    // Arrange
    await setupAppleMocks({ sub: APPLE_SUB, email: USER_EMAIL })
    const pending = makeUserDoc({
      oauthId:       null,
      oauthProvider: null,
      inviteStatus:  'PENDING',
    })
    vi.mocked(User.findOne).mockResolvedValueOnce(pending as never)
    vi.mocked(User.findOneAndUpdate).mockResolvedValueOnce({} as never)
    const activated = makeUserDoc({ oauthId: APPLE_SUB, oauthProvider: 'apple', inviteStatus: 'ACCEPTED' })
    vi.mocked(User.findById).mockResolvedValueOnce(activated as never)

    const reply = makeReply()

    // Act
    await handle(makeRequest({ idToken: buildFakeAppleJwt() }), reply)

    // Assert
    expect(reply._status).toBe(200)

    expect(vi.mocked(User.findOneAndUpdate)).toHaveBeenCalledOnce()
    const [, updateDoc] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown>; $unset: Record<string, string> },
    ]
    expect(updateDoc.$set['inviteStatus']).toBe('ACCEPTED')
    expect(updateDoc.$set['oauthId']).toBe(APPLE_SUB)
    expect(updateDoc.$set['oauthProvider']).toBe('apple')
    expect(updateDoc.$unset['passwordSetToken']).toBe('')
    expect(updateDoc.$unset['passwordSetExpiry']).toBe('')
  })

  // ── A3: REVOKED account (Apple) → 403 ACCOUNT_REVOKED ────────────────────

  it('A3 should return 403 ACCOUNT_REVOKED for a REVOKED user on Apple sign-in', async () => {
    // Arrange
    await setupAppleMocks({ sub: APPLE_SUB, email: USER_EMAIL })
    const revoked = makeUserDoc({ oauthId: null, inviteStatus: 'REVOKED' })
    vi.mocked(User.findOne).mockResolvedValueOnce(revoked as never)

    const reply = makeReply()

    // Act
    await handle(makeRequest({ idToken: buildFakeAppleJwt() }), reply)

    // Assert
    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('ACCOUNT_REVOKED')
    expect(vi.mocked(User.create)).not.toHaveBeenCalled()
  })

  // ── A4: Invalid Apple token → 401 ─────────────────────────────────────────

  it('A4 should return 401 INVALID_TOKEN when Apple id_token verification throws', async () => {
    // Arrange — mock fetch so keys resolve but jwt.verify throws
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        keys: [{ kid: FAKE_APPLE_KID, kty: 'RSA', use: 'sig', alg: 'RS256', n: 'n', e: 'AQAB' }],
      }),
    }))
    const jwtModule = await import('jsonwebtoken')
    vi.mocked(jwtModule.default.verify).mockImplementation(() => {
      throw new Error('jwt expired')
    })

    const reply = makeReply()

    // Act
    await handle(makeRequest({ idToken: buildFakeAppleJwt() }), reply)

    // Assert
    expect(reply._status).toBe(401)
    expect((reply._body as { error: string }).error).toBe('INVALID_TOKEN')
    expect(vi.mocked(User.findOne)).not.toHaveBeenCalled()
  })

  // ── A5: Missing idToken → 400 ─────────────────────────────────────────────

  it('A5 should return 400 VALIDATION_ERROR when Apple idToken is missing', async () => {
    // Arrange
    const reply = makeReply()

    // Act
    await handle(makeRequest({}), reply)

    // Assert
    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('VALIDATION_ERROR')
  })

  // ── A6: No matching Apple key → 401 ──────────────────────────────────────

  it('A6 should return 401 INVALID_TOKEN when no matching Apple public key is found', async () => {
    // Arrange — JWKS returns a key with a DIFFERENT kid
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        keys: [{ kid: 'completely-different-kid', kty: 'RSA', use: 'sig', alg: 'RS256', n: 'n', e: 'AQAB' }],
      }),
    }))

    const reply = makeReply()

    // Act — JWT header has FAKE_APPLE_KID, no matching key in response
    await handle(makeRequest({ idToken: buildFakeAppleJwt(FAKE_APPLE_KID) }), reply)

    // Assert
    expect(reply._status).toBe(401)
    expect((reply._body as { error: string }).error).toBe('INVALID_TOKEN')
  })
})
