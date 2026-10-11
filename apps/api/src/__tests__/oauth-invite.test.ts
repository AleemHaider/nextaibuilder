/**
 * PBA-343 — Unit tests for the invite activation branch in POST /api/auth/oauth/google
 *
 * Test cases (8):
 *  1. Valid token + matching email → 200, user activated in DB
 *  2. Expired token → 400 INVALID_TOKEN
 *  3. Wrong token value → 400 INVALID_TOKEN
 *  4. Email mismatch → 403 EMAIL_MISMATCH
 *  5. ACCEPTED user with no oauthId → normal sign-in (200)
 *  6. Revoked → 403 ACCOUNT_REVOKED
 *  7. Invalid Google id_token → 401 INVALID_TOKEN
 *  8. No inviteToken + PENDING user → 403 INVITE_PENDING
 *
 * Strategy
 * --------
 * vi.mock factories are hoisted to the top of the compiled output, so they
 * cannot safely reference top-level `const` or `let` variables.  Instead we
 * store a shared vi.fn() inside the factory itself and expose it on the mocked
 * module so tests can access it after import.
 *
 * The pattern used here:
 *   - google-auth-library mock: constructor stores a vi.fn() on the module
 *     export so tests can call mockResolvedValueOnce / mockRejectedValueOnce.
 *   - User model: standard vi.mock with inline vi.fn() per method.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// ---------------------------------------------------------------------------
// Mocks — all vi.fn() are defined INSIDE the factory (hoisting-safe)
// ---------------------------------------------------------------------------

vi.mock('google-auth-library', () => {
  const verifyIdToken = vi.fn()
  return {
    OAuth2Client: function MockOAuth2Client() {
      return { verifyIdToken }
    },
    // Expose the shared mock so tests can import and control it
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

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed') },
}))

vi.mock('../services/emailService.js', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Import after mocks — order matters
// ---------------------------------------------------------------------------

import * as GoogleAuthLib from 'google-auth-library'
import { User } from '../models/User.js'
import { oauthRoutes } from '../routes/oauth.js'

// Access the shared verifyIdToken mock exposed by the factory
const mockVerifyIdToken = (GoogleAuthLib as unknown as { __verifyIdToken: ReturnType<typeof vi.fn> }).__verifyIdToken

// ---------------------------------------------------------------------------
// Fake Fastify helpers
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

async function getGoogleHandler() {
  const fastify = makeFastify()
  await oauthRoutes(fastify)
  const postMock = fastify.post as ReturnType<typeof vi.fn>
  const call = (postMock.mock.calls as unknown[][]).find((c) => c[0] === '/google')
  if (!call) throw new Error('POST /google route not registered')
  return call[2] as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
}

function makeRequest(body: Record<string, unknown>): FastifyRequest {
  return { body } as unknown as FastifyRequest
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_TOKEN   = 'abc123validtoken'
const FUTURE_EXPIRY = new Date(Date.now() + 3_600_000)
const PAST_EXPIRY   = new Date(Date.now() - 3_600_000)
const GOOGLE_SUB    = 'google-sub-123'
const USER_EMAIL    = 'student@example.com'

const BASE_PAYLOAD = {
  sub:            GOOGLE_SUB,
  email:          USER_EMAIL,
  email_verified: true,
  given_name:     'Jane',
  family_name:    'Doe',
  picture:        'https://example.com/photo.jpg',
}

function setValidGoogleToken(emailOverride?: string) {
  mockVerifyIdToken.mockResolvedValueOnce({
    getPayload: () => ({ ...BASE_PAYLOAD, ...(emailOverride ? { email: emailOverride } : {}) }),
  })
}

function setInvalidGoogleToken() {
  mockVerifyIdToken.mockRejectedValueOnce(new Error('invalid token'))
}

function pendingUser(overrides: Record<string, unknown> = {}) {
  return {
    _id:               { toString: () => 'user-id-1' },
    email:             USER_EMAIL,
    firstName:         'Jane',
    lastName:          'Doe',
    role:              'STUDENT',
    avatarUrl:         null,
    oauthId:           null,
    oauthProvider:     null,
    inviteStatus:      'PENDING',
    inviteAcceptedAt:  null,
    passwordSetToken:  VALID_TOKEN,
    passwordSetExpiry: FUTURE_EXPIRY,
    ...overrides,
  }
}

function activatedUser() {
  return {
    _id:           { toString: () => 'user-id-1' },
    email:         USER_EMAIL,
    firstName:     'Jane',
    lastName:      'Doe',
    role:          'STUDENT',
    avatarUrl:     'https://example.com/photo.jpg',
    oauthId:       GOOGLE_SUB,
    oauthProvider: 'google',
    inviteStatus:  'ACCEPTED',
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/oauth/google — invite activation branch (PBA-343)', () => {
  let handle: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

  beforeEach(async () => {
    mockVerifyIdToken.mockReset()
    vi.mocked(User.findOne).mockReset()
    vi.mocked(User.findOneAndUpdate).mockReset()
    vi.mocked(User.findById).mockReset()
    vi.mocked(User.create).mockReset()
    vi.mocked(User.updateOne).mockResolvedValue({} as never)

    handle = await getGoogleHandler()
  })

  // ── 1. Valid token + matching email → 200 + activated ─────────────────────

  it('1. returns 200 and activates the account when token and email are valid', async () => {
    setValidGoogleToken()
    vi.mocked(User.findOne).mockResolvedValueOnce(pendingUser())
    vi.mocked(User.findOneAndUpdate).mockResolvedValueOnce({} as never)
    vi.mocked(User.findById).mockResolvedValueOnce(activatedUser())

    const reply = makeReply()
    await handle(makeRequest({ idToken: 'valid-token', inviteToken: VALID_TOKEN }), reply)

    expect(reply._status).toBe(200)
    const body = reply._body as { accessToken: string; user: { email: string } }
    expect(body.accessToken).toBe('mock-access-token')
    expect(body.user.email).toBe(USER_EMAIL)

    expect(vi.mocked(User.findOneAndUpdate)).toHaveBeenCalledOnce()
    const [, updateDoc] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as [
      unknown,
      { $set: { inviteStatus: string; oauthId: string }; $unset: { passwordSetToken: string; passwordSetExpiry: string } },
    ]
    expect(updateDoc.$set.inviteStatus).toBe('ACCEPTED')
    expect(updateDoc.$set.oauthId).toBe(GOOGLE_SUB)
    expect(updateDoc.$unset.passwordSetToken).toBe('')
    expect(updateDoc.$unset.passwordSetExpiry).toBe('')
  })

  // ── 2. PENDING user with expired passwordSetExpiry → auto-activates (PBA-343+) ───────────────
  //
  // BEHAVIOUR CHANGE: The invite-token validation flow was replaced in PBA-343+ with
  // email-match-based auto-activation.  The server no longer checks passwordSetExpiry
  // or inviteToken content during OAuth sign-in.  A PENDING user is activated purely
  // on email ownership (proved by the OAuth provider's email claim).

  it('2. auto-activates a PENDING user even when passwordSetExpiry is in the past (no token check)', async () => {
    setValidGoogleToken()
    vi.mocked(User.findOne).mockResolvedValueOnce(pendingUser({ passwordSetExpiry: PAST_EXPIRY }))
    vi.mocked(User.findOneAndUpdate).mockResolvedValueOnce({} as never)
    vi.mocked(User.findById).mockResolvedValueOnce(activatedUser())

    const reply = makeReply()
    // inviteToken is still sent by older clients but is now ignored by the server
    await handle(makeRequest({ idToken: 'valid-token', inviteToken: VALID_TOKEN }), reply)

    expect(reply._status).toBe(200)
    expect(vi.mocked(User.findOneAndUpdate)).toHaveBeenCalledOnce()
    const [, updateDoc] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as [
      unknown,
      { $set: { inviteStatus: string } },
    ]
    expect(updateDoc.$set.inviteStatus).toBe('ACCEPTED')
  })

  // ── 3. PENDING user with wrong inviteToken → auto-activates (token is now ignored) ─────────
  //
  // Previously the server would reject a mismatched token.  After PBA-343+ the
  // inviteToken field is ignored entirely during OAuth activation.

  it('3. auto-activates a PENDING user even when inviteToken value does not match (token ignored)', async () => {
    // Arrange
    setValidGoogleToken()
    vi.mocked(User.findOne).mockResolvedValueOnce(pendingUser())
    vi.mocked(User.findOneAndUpdate).mockResolvedValueOnce({} as never)
    vi.mocked(User.findById).mockResolvedValueOnce(activatedUser())

    const reply = makeReply()

    // Act — passes a wrong token, but server no longer validates it
    await handle(makeRequest({ idToken: 'valid-token', inviteToken: 'wrong-token' }), reply)

    // Assert — PENDING user is activated regardless of token content
    expect(reply._status).toBe(200)
    expect(vi.mocked(User.findOneAndUpdate)).toHaveBeenCalledOnce()
    const [, updateDoc] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as [
      unknown,
      { $set: { inviteStatus: string } },
    ]
    expect(updateDoc.$set.inviteStatus).toBe('ACCEPTED')
  })

  // ── 4. Google email differs from invite email → user not found → 403 NOT_ENROLLED ────────
  //
  // When Google's email claim does not match any pre-registered user, sign-in is
  // blocked with 403 NOT_ENROLLED. Students must be added by admin before they can log in.

  it('4. returns 403 NOT_ENROLLED when Google email does not match any pre-registered user', async () => {
    setValidGoogleToken('different@example.com')
    // $or query finds no match for the different email
    vi.mocked(User.findOne).mockResolvedValueOnce(null)

    const reply = makeReply()
    await handle(makeRequest({ idToken: 'valid-token', inviteToken: VALID_TOKEN }), reply)

    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('NOT_ENROLLED')
    expect(vi.mocked(User.create)).not.toHaveBeenCalled()
    expect(vi.mocked(User.findOneAndUpdate)).not.toHaveBeenCalled()
  })

  // ── 5. ACCEPTED + no oauthId → normal sign-in ─────────────────────────────

  it('5. allows normal sign-in for ACCEPTED users even when oauthId is not yet set', async () => {
    setValidGoogleToken()
    vi.mocked(User.findOne).mockResolvedValueOnce(
      pendingUser({ inviteStatus: 'ACCEPTED', oauthId: null }),
    )

    const reply = makeReply()
    await handle(makeRequest({ idToken: 'valid-token', inviteToken: VALID_TOKEN }), reply)

    expect(reply._status).toBe(200)
    expect(vi.mocked(User.findOneAndUpdate)).not.toHaveBeenCalled()
  })

  // ── 6. Revoked → 403 ACCOUNT_REVOKED ──────────────────────────────────────

  it('6. returns 403 ACCOUNT_REVOKED for a revoked invite', async () => {
    setValidGoogleToken()
    vi.mocked(User.findOne).mockResolvedValueOnce(
      pendingUser({ inviteStatus: 'REVOKED', oauthId: null }),
    )

    const reply = makeReply()
    await handle(makeRequest({ idToken: 'valid-token', inviteToken: VALID_TOKEN }), reply)

    expect(reply._status).toBe(403)
    expect((reply._body as { error: string }).error).toBe('ACCOUNT_REVOKED')
    expect(vi.mocked(User.findOneAndUpdate)).not.toHaveBeenCalled()
  })

  // ── 7. Invalid Google token → 401 INVALID_TOKEN ───────────────────────────

  it('7. returns 401 INVALID_TOKEN when Google token verification throws', async () => {
    setInvalidGoogleToken()

    const reply = makeReply()
    await handle(makeRequest({ idToken: 'garbage-token', inviteToken: VALID_TOKEN }), reply)

    expect(reply._status).toBe(401)
    expect((reply._body as { error: string }).error).toBe('INVALID_TOKEN')
    expect(vi.mocked(User.findOne)).not.toHaveBeenCalled()
  })

  // ── 8. No inviteToken + PENDING → auto-activates (PBA-343+) ─────────────────
  //
  // BEHAVIOUR CHANGE: Previously a missing inviteToken returned 403 INVITE_PENDING.
  // After PBA-343+ the invite token is no longer required — a PENDING user is
  // auto-activated when their email matches the OAuth provider's email claim.

  it('8. auto-activates a PENDING user when no inviteToken is provided (direct login flow)', async () => {
    setValidGoogleToken()
    vi.mocked(User.findOne).mockResolvedValueOnce(pendingUser())
    vi.mocked(User.findOneAndUpdate).mockResolvedValueOnce({} as never)
    vi.mocked(User.findById).mockResolvedValueOnce(activatedUser())

    const reply = makeReply()
    await handle(makeRequest({ idToken: 'valid-token' }), reply)  // no inviteToken

    // Now returns 200 + activates the account
    expect(reply._status).toBe(200)
    expect(vi.mocked(User.findOneAndUpdate)).toHaveBeenCalledOnce()
    const [, updateDoc] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as [
      unknown,
      { $set: { inviteStatus: string } },
    ]
    expect(updateDoc.$set.inviteStatus).toBe('ACCEPTED')
  })
})
