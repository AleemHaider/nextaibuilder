/**
 * Sprint 4 Story 20 — Student soft-delete danger zone
 *
 * Route under test:
 *   POST /api/student/profile/delete
 *     body: { confirmation: "DELETE MY ACCOUNT" | "<user email>" }
 *
 * Contract (see routes/student/profile.ts for the full rationale):
 *   • Invalid / missing confirmation   → 400 INVALID_BODY | CONFIRMATION_MISMATCH
 *   • User not found                   → 404 USER_NOT_FOUND
 *   • User already soft-deleted        → 404 USER_NOT_FOUND (idempotent tombstone)
 *   • Happy path                       → 200 { deleted: true }
 *     side-effects:
 *       - Stripe subscriptions cancelled for every ACTIVE enrollment
 *       - All RefreshToken rows for the user are deleted
 *       - User doc is anonymised + isActive=false + deletedAt=<now>
 *     Stripe cancel failures are swallowed (best-effort) so a placeholder
 *     STRIPE_SECRET_KEY in dev or a Stripe outage can't block the tombstone.
 *
 * Strategy is the same as notifications.test.ts — no real Fastify, no real
 * Mongoose. Every model + Stripe is vi.mock()'d and the route handler is
 * captured by a fake fastify and invoked directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Types } from 'mongoose'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../middleware/authenticate.js', () => ({
  requireStudent: async () => undefined,
}))

vi.mock('../models/User.js', () => ({
  User: {
    findById:          vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}))

vi.mock('../models/CohortMembership.js', () => ({
  CohortMembership: {
    findOne:    vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
  },
}))

vi.mock('../models/StudentStep.js', () => ({
  StudentStep: {
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
  },
}))

vi.mock('../models/StepSubmission.js', () => ({
  StepSubmission: {
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
  },
}))

vi.mock('../models/UserBadge.js', () => ({
  UserBadge: {
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
  },
}))

vi.mock('../models/Certificate.js', () => ({
  Certificate: {
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
  },
}))

vi.mock('../models/RefreshToken.js', () => ({
  RefreshToken: {
    deleteMany: vi.fn(),
  },
}))

vi.mock('../models/Enrollment.js', () => ({
  Enrollment: {
    find: vi.fn(),
  },
}))

vi.mock('../lib/stripe.js', () => ({
  stripe: {
    subscriptions: {
      cancel: vi.fn(),
    },
  },
}))

// S3 is imported at the top of profile.ts for avatar uploads. Stub it out so
// the import doesn't drag in AWS SDK at test time.
vi.mock('../lib/s3.js', () => ({
  s3:                {},
  BUCKET_NAME:       'test-bucket',
  buildAvatarS3Key:  (uid: string) => `avatars/${uid}/test.jpg`,
  IS_S3_CONFIGURED:  false,
}))

vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: vi.fn(),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned'),
}))

// Imports after mocks
import { User } from '../models/User.js'
import { RefreshToken } from '../models/RefreshToken.js'
import { Enrollment } from '../models/Enrollment.js'
import { stripe } from '../lib/stripe.js'
import { studentProfileRoutes } from '../routes/student/profile.js'

// ---------------------------------------------------------------------------
// Fake Fastify helpers
// ---------------------------------------------------------------------------

type Method = 'get' | 'post' | 'patch' | 'delete' | 'put'
type Handler = (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

type FakeReply = {
  sent: boolean
  _status: number | null
  _body: unknown
  _cookiesCleared: string[]
  code: (s: number) => FakeReply
  send: (b: unknown) => FakeReply
  clearCookie: (name: string, _opts?: unknown) => FakeReply
}

function makeReply(): FakeReply {
  const r: FakeReply = {
    sent: false,
    _status: null,
    _body: undefined,
    _cookiesCleared: [],
    code(status) {
      r._status = status
      return r
    },
    send(body) {
      r._body = body
      r.sent = true
      return r
    },
    clearCookie(name) {
      r._cookiesCleared.push(name)
      return r
    },
  }
  return r
}

function makeRequest(
  body: Record<string, unknown>,
  user: Record<string, string> = { sub: new Types.ObjectId().toString(), role: 'STUDENT' },
): FastifyRequest {
  return { body, user, params: {} } as unknown as FastifyRequest
}

async function buildFastify() {
  const routes: Record<string, Handler> = {}

  const register = (method: Method) =>
    vi.fn().mockImplementation(
      (path: string, _opts: unknown, handler: Handler) => {
        routes[`${method.toUpperCase()} ${path}`] = handler
      },
    )

  const fastify = {
    get:    register('get'),
    post:   register('post'),
    patch:  register('patch'),
    delete: register('delete'),
    put:    register('put'),
    log:    { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as FastifyInstance

  await studentProfileRoutes(fastify)
  return { fastify, routes }
}

async function getHandler(key: string): Promise<Handler> {
  const { routes } = await buildFastify()
  const h = routes[key]
  if (!h) throw new Error(`No handler registered for ${key}`)
  return h
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = new Types.ObjectId().toString()

function makeUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id:          new Types.ObjectId(USER_ID),
    email:        'student@example.com',
    firstName:    'Sam',
    lastName:     'Student',
    isActive:     true,
    deletedAt:    null,
    oauthId:      null,
    oauthProvider: null,
    passwordHash: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/student/profile/delete', () => {
  let handle: Handler

  beforeEach(async () => {
    vi.mocked(User.findById).mockReset()
    vi.mocked(User.findByIdAndUpdate).mockReset()
    vi.mocked(RefreshToken.deleteMany).mockReset().mockResolvedValue({ deletedCount: 1 } as never)
    vi.mocked(Enrollment.find).mockReset()
    vi.mocked(stripe.subscriptions.cancel).mockReset()
    handle = await getHandler('POST /profile/delete')
  })

  // ── Happy path (canonical token) ─────────────────────────────────────────
  it('soft-deletes the user, cancels Stripe subs, and revokes refresh tokens', async () => {
    vi.mocked(User.findById).mockResolvedValueOnce(makeUserDoc() as never)
    vi.mocked(Enrollment.find).mockReturnValueOnce({
      select: vi.fn().mockResolvedValue([
        { stripeSubscriptionId: 'sub_abc' },
        { stripeSubscriptionId: 'sub_def' },
      ]),
    } as unknown as ReturnType<typeof Enrollment.find>)
    vi.mocked(stripe.subscriptions.cancel).mockResolvedValue({} as never)
    vi.mocked(User.findByIdAndUpdate).mockResolvedValueOnce({} as never)

    const req = makeRequest(
      { confirmation: 'DELETE MY ACCOUNT' },
      { sub: USER_ID, role: 'STUDENT' },
    )
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._body).toEqual({ deleted: true })

    // Both subscriptions cancelled
    expect(vi.mocked(stripe.subscriptions.cancel)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(stripe.subscriptions.cancel)).toHaveBeenCalledWith('sub_abc')
    expect(vi.mocked(stripe.subscriptions.cancel)).toHaveBeenCalledWith('sub_def')

    // Refresh tokens nuked
    expect(vi.mocked(RefreshToken.deleteMany)).toHaveBeenCalledWith({ userId: USER_ID })

    // User anonymised + tombstoned
    const updateCall = vi.mocked(User.findByIdAndUpdate).mock.calls[0]
    expect(updateCall[0]).toBe(USER_ID)
    const setFields = (updateCall[1] as { $set: Record<string, unknown> }).$set
    expect(setFields.email).toBe(`deleted-${USER_ID}@anon.local`)
    expect(setFields.firstName).toBe('Deleted')
    expect(setFields.lastName).toBe('User')
    expect(setFields.oauthId).toBeNull()
    expect(setFields.oauthProvider).toBeNull()
    expect(setFields.passwordHash).toBeNull()
    expect(setFields.isActive).toBe(false)
    expect(setFields.deletedAt).toBeInstanceOf(Date)

    // Cookie cleared so the current browser session is invalidated
    expect(reply._cookiesCleared).toContain('nab_refresh')
  })

  // ── Happy path (email as confirmation) ───────────────────────────────────
  it('accepts the user email as the confirmation string (case-insensitive)', async () => {
    vi.mocked(User.findById).mockResolvedValueOnce(
      makeUserDoc({ email: 'Student@Example.com' }) as never,
    )
    vi.mocked(Enrollment.find).mockReturnValueOnce({
      select: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof Enrollment.find>)
    vi.mocked(User.findByIdAndUpdate).mockResolvedValueOnce({} as never)

    const req = makeRequest(
      { confirmation: 'student@example.com' },
      { sub: USER_ID, role: 'STUDENT' },
    )
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._body).toEqual({ deleted: true })
    expect(vi.mocked(User.findByIdAndUpdate)).toHaveBeenCalledOnce()
  })

  // ── Wrong confirmation ───────────────────────────────────────────────────
  it('returns 400 CONFIRMATION_MISMATCH when the string does not match', async () => {
    vi.mocked(User.findById).mockResolvedValueOnce(makeUserDoc() as never)

    const req = makeRequest(
      { confirmation: 'delete plz' },
      { sub: USER_ID, role: 'STUDENT' },
    )
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('CONFIRMATION_MISMATCH')
    // Critically, no destructive call fires
    expect(vi.mocked(User.findByIdAndUpdate)).not.toHaveBeenCalled()
    expect(vi.mocked(RefreshToken.deleteMany)).not.toHaveBeenCalled()
    expect(vi.mocked(stripe.subscriptions.cancel)).not.toHaveBeenCalled()
  })

  // ── Missing / empty body ─────────────────────────────────────────────────
  it('returns 400 INVALID_BODY when confirmation is missing', async () => {
    const req = makeRequest({}, { sub: USER_ID, role: 'STUDENT' })
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_BODY')
  })

  // ── User not found ───────────────────────────────────────────────────────
  it('returns 404 USER_NOT_FOUND when the user does not exist', async () => {
    vi.mocked(User.findById).mockResolvedValueOnce(null as never)

    const req = makeRequest(
      { confirmation: 'DELETE MY ACCOUNT' },
      { sub: USER_ID, role: 'STUDENT' },
    )
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(404)
    expect((reply._body as { error: string }).error).toBe('USER_NOT_FOUND')
  })

  // ── Already soft-deleted (idempotent tombstone) ──────────────────────────
  it('returns 404 when the user is already soft-deleted', async () => {
    vi.mocked(User.findById).mockResolvedValueOnce(
      makeUserDoc({ deletedAt: new Date() }) as never,
    )

    const req = makeRequest(
      { confirmation: 'DELETE MY ACCOUNT' },
      { sub: USER_ID, role: 'STUDENT' },
    )
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(404)
    // Importantly we don't double-cancel already-cancelled Stripe subs
    expect(vi.mocked(stripe.subscriptions.cancel)).not.toHaveBeenCalled()
    expect(vi.mocked(User.findByIdAndUpdate)).not.toHaveBeenCalled()
  })

  // ── Stripe failure is non-fatal ──────────────────────────────────────────
  it('still soft-deletes the user when Stripe subscription cancel throws', async () => {
    vi.mocked(User.findById).mockResolvedValueOnce(makeUserDoc() as never)
    vi.mocked(Enrollment.find).mockReturnValueOnce({
      select: vi.fn().mockResolvedValue([{ stripeSubscriptionId: 'sub_broken' }]),
    } as unknown as ReturnType<typeof Enrollment.find>)
    vi.mocked(stripe.subscriptions.cancel).mockRejectedValueOnce(
      new Error('No such subscription: sub_broken'),
    )
    vi.mocked(User.findByIdAndUpdate).mockResolvedValueOnce({} as never)

    const req = makeRequest(
      { confirmation: 'DELETE MY ACCOUNT' },
      { sub: USER_ID, role: 'STUDENT' },
    )
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    // The endpoint should NOT propagate the Stripe error — local tombstone
    // wins.
    expect(reply._body).toEqual({ deleted: true })
    expect(vi.mocked(User.findByIdAndUpdate)).toHaveBeenCalledOnce()
    expect(vi.mocked(RefreshToken.deleteMany)).toHaveBeenCalledOnce()
  })
})
