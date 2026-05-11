// FIR-155 — POST /api/auth/student/register  (self-serve sign-up)
// FIR-155 — POST /api/auth/student/login     (email + password sign-in)

import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { User } from '../models/User.js'
import { RefreshToken } from '../models/RefreshToken.js'
import { checkLockout, incrementFailCount, clearFailCount } from '../lib/auth-lockout.js'

// Constant-time dummy hash used to pad bcrypt.compare() when no user / no
// password / disabled account is found, preventing a login-timing oracle.
const TIMING_PAD_HASH = '$2a$12$invalidhashfortimingnormalization000000000000000000000000'

// ── Constants ──────────────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL  = 15 * 60            // 15 minutes
const REFRESH_TOKEN_TTL = 15 * 24 * 60 * 60  // 15 days
const BCRYPT_ROUNDS     = 12

// ── Validation schemas ─────────────────────────────────────────────────────

const registerSchema = z.object({
  email:     z.string().email().trim().toLowerCase(),
  password:  z.string().min(8),
  firstName: z.string().min(1).trim(),
  lastName:  z.string().trim().default(''),
})

const loginSchema = z.object({
  email:    z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
})

// ── Helpers ────────────────────────────────────────────────────────────────

function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)
}

async function issueFullTokens(
  fastify: FastifyInstance,
  userId: string,
  email: string,
  role: string,
) {
  const accessToken = fastify.jwt.sign(
    { sub: userId, email, role },
    { expiresIn: ACCESS_TOKEN_TTL },
  )

  const rawRefresh = crypto.randomBytes(48).toString('hex')
  const tokenHash  = await bcrypt.hash(rawRefresh, 10)
  const fastLookup = crypto.createHash('sha256').update(rawRefresh).digest('hex')
  const expiresAt  = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)

  await RefreshToken.create({ userId, tokenHash, fastLookup, expiresAt })

  return { accessToken, rawRefresh }
}

function buildUserResponse(user: {
  _id: unknown
  email: string
  firstName: string
  lastName: string
  role: string
  avatarUrl?: string | null
}) {
  return {
    id:        (user._id as { toString(): string }).toString(),
    email:     user.email,
    name:      `${user.firstName} ${user.lastName}`.trim(),
    firstName: user.firstName,
    lastName:  user.lastName,
    role:      user.role,
    avatarUrl: user.avatarUrl ?? null,
  }
}

// ── Route plugin ───────────────────────────────────────────────────────────

export async function authStudentRoutes(fastify: FastifyInstance) {

  // ── POST /register ── Self-serve student sign-up ────────────────────────
  fastify.post('/register', {
    config: {
      rateLimit: { max: 5, timeWindow: '15 minutes' },
    },
  }, async (request, reply) => {
    try {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error:   'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Invalid input.',
      })
    }
    const { email, password, firstName, lastName } = parsed.data

    if (!isStrongPassword(password)) {
      return reply.code(400).send({
        error:   'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters and include 1 uppercase letter and 1 number.',
      })
    }

    const existing = await User.findOne({ email })
    if (existing) {
      return reply.code(409).send({
        error:   'EMAIL_TAKEN',
        message: 'An account with this email already exists. Try signing in instead.',
      })
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = await User.create({
      email,
      firstName,
      lastName: lastName || firstName,
      role: 'STUDENT',
      isActive: true,
      passwordHash,
      twoFactorEnabled: false,
      inviteStatus: 'ACCEPTED',
      inviteAcceptedAt: new Date(),
    })

    const userId = user._id.toString()
    const { accessToken, rawRefresh } = await issueFullTokens(fastify, userId, email, 'STUDENT')

    reply.setCookie('nab_refresh', rawRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_TTL,
    })

    return reply.code(201).send({
      accessToken,
      user: buildUserResponse(user),
    })
    } catch (err: unknown) {
      fastify.log.error({ err }, '[register] unhandled error')
      return reply.code(500).send({
        error:   'INTERNAL_ERROR',
        message: 'An internal error occurred. Please try again.',
      })
    }
  })

  // ── POST /login ── Email + password sign-in ─────────────────────────────
  fastify.post('/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '15 minutes' },
    },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error:   'VALIDATION_ERROR',
        message: 'Please enter a valid email and password.',
      })
    }
    const { email, password } = parsed.data

    // FIR-172 — check Redis lockout before touching the DB
    if (await checkLockout(email)) {
      return reply.code(429).send({
        error:   'ACCOUNT_LOCKED',
        message: 'Account temporarily locked. Try again in 15 minutes.',
      })
    }

    const user = await User.findOne({ email, role: 'STUDENT' }).select('+passwordHash')

    // No user, no password (OAuth-only), or disabled account ⇒ treat as bad
    // credentials. We still run bcrypt.compare against a dummy hash so the
    // response time does not leak which branch we took (login-timing oracle).
    const noCredentials = !user || !user.passwordHash || !user.isActive
    const passwordMatch = await bcrypt.compare(
      password,
      noCredentials ? TIMING_PAD_HASH : user!.passwordHash!,
    )

    if (noCredentials || !passwordMatch) {
      await incrementFailCount(email)
      return reply.code(401).send({
        error:   'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      })
    }

    await clearFailCount(email)

    const userId = user!._id.toString()
    const { accessToken, rawRefresh } = await issueFullTokens(fastify, userId, email, 'STUDENT')

    reply.setCookie('nab_refresh', rawRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_TTL,
    })

    return reply.send({
      accessToken,
      user: buildUserResponse(user!),
    })
  })

  // ── POST /set-password ── kept for compatibility (still disabled) ────────
  fastify.post('/set-password', {
    config: {
      rateLimit: { max: 10, timeWindow: '15 minutes' },
    },
  }, async (_request, reply) => {
    return reply.code(410).send({
      error:   'DEPRECATED',
      message: 'Use POST /register to create an account.',
    })
  })
}
