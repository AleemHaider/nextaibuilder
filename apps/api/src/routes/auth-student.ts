// FIR-155 — POST /api/auth/student/register  (self-serve sign-up)
// FIR-155 — POST /api/auth/student/login     (email + password sign-in)

import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { User } from '../models/User.js'
import { RefreshToken } from '../models/RefreshToken.js'

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
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: msg })
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

    const user = await User.findOne({ email, role: 'STUDENT' })

    if (!user) {
      return reply.code(401).send({
        error:   'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      })
    }

    // OAuth-only account (no password set)
    if (!user.passwordHash) {
      return reply.code(401).send({
        error:   'USE_OAUTH',
        message: 'This account was created with Google. Please use the "Continue with Google" button.',
      })
    }

    if (!user.isActive) {
      return reply.code(401).send({
        error:   'ACCOUNT_DISABLED',
        message: 'Your account has been disabled. Please contact support.',
      })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.code(401).send({
        error:   'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      })
    }

    const userId = user._id.toString()
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
      user: buildUserResponse(user),
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
