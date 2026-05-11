// PBA-248 — POST /api/auth/admin/login
// PBA-249 — POST /api/auth/admin/verify-otp
// PBA-250 — POST /api/auth/admin/set-password
// PBA-252 — POST /api/auth/admin/forgot-password + reset-password
// PBA-258 — POST /api/auth/admin/resend-otp
// FIR-172 — Account lockout via Redis on failed login/OTP attempts

import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { User } from '../models/User.js'
import { RefreshToken } from '../models/RefreshToken.js'
import { SubAdminPermission } from '../models/SubAdminPermission.js'
import { generateOtp, verifyOtp, deleteOtp } from '../lib/admin-otp.js'
import {
  sendEmail,
  adminOtpEmailTemplate,
  adminPasswordResetTemplate,
} from '../lib/email.js'
import { checkLockout, incrementFailCount, clearFailCount } from '../lib/auth-lockout.js'

// ── Constants ──────────────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL      = 15 * 60           // 15 minutes in seconds
const REFRESH_TOKEN_TTL     = 15 * 24 * 60 * 60  // 15 days in seconds
const PRE_AUTH_TOKEN_TTL    = 5 * 60             // 5 minutes in seconds
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000    // 1 hour in ms
const BCRYPT_ROUNDS         = 12

// ── Validation schemas ─────────────────────────────────────────────────────

const loginSchema = z.object({
  email:    z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
})

const verifyOtpSchema = z.object({
  preAuthToken: z.string().min(1),
  code:         z.string().length(6),
})

const setPasswordSchema = z.object({
  token:           z.string().min(1),
  password:        z.string().min(8),
  confirmPassword: z.string().min(1),
})

const forgotPasswordSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
})

const resetPasswordSchema = z.object({
  token:           z.string().min(1),
  password:        z.string().min(8),
  confirmPassword: z.string().min(1),
})

const resendOtpSchema = z.object({
  preAuthToken: z.string().min(1),
})

// ── Password strength validator ────────────────────────────────────────────

function isStrongPassword(password: string): boolean {
  // min 8 chars, 1 uppercase, 1 number
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)
}

// ── Token helpers ──────────────────────────────────────────────────────────

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

  const rawRefresh  = crypto.randomBytes(48).toString('hex')
  const tokenHash   = await bcrypt.hash(rawRefresh, 10)
  const fastLookup  = crypto.createHash('sha256').update(rawRefresh).digest('hex')
  const expiresAt   = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)

  await RefreshToken.create({ userId, tokenHash, fastLookup, expiresAt })

  return { accessToken, rawRefresh }
}

function signPreAuthToken(fastify: FastifyInstance, userId: string): string {
  return fastify.jwt.sign(
    { sub: userId, scope: 'pre-auth' },
    { expiresIn: PRE_AUTH_TOKEN_TTL },
  )
}

interface PreAuthPayload {
  sub: string
  scope: string
  iat: number
  exp: number
}

function verifyPreAuthToken(
  fastify: FastifyInstance,
  token: string,
): PreAuthPayload | null {
  try {
    const payload = fastify.jwt.verify<PreAuthPayload>(token)
    if (payload.scope !== 'pre-auth') return null
    return payload
  } catch {
    return null
  }
}

// ── Build full user response shape ─────────────────────────────────────────

async function buildUserResponse(userId: string) {
  const user = await User.findById(userId).select(
    'email firstName lastName role avatarUrl twoFactorEnabled',
  )
  if (!user) return null

  let permissions: string[] = []
  if (user.role === 'ADMIN') {
    const permDoc = await SubAdminPermission.findOne({ userId: user._id })
    permissions = permDoc?.permissions ?? []
  }

  return {
    id:               user._id.toString(),
    email:            user.email,
    name:             `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
    firstName:        user.firstName,
    lastName:         user.lastName,
    role:             user.role,
    avatarUrl:        user.avatarUrl ?? null,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
    permissions,
  }
}

// ── Route plugin ───────────────────────────────────────────────────────────

export async function authAdminRoutes(fastify: FastifyInstance) {

  // ── POST /login ── PBA-248 ─────────────────────────────────────────────
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.code(400).send({
        error:   'INVALID_BODY',
        message: 'Invalid request body.',
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const { email, password } = parseResult.data

    // FIR-172: check lockout before any DB work
    if (await checkLockout(email)) {
      return reply.code(429).send({
        error:   'ACCOUNT_LOCKED',
        message: 'Account temporarily locked. Try again in 15 minutes.',
      })
    }

    // Find admin user by email (case-insensitive via lowercase index)
    const user = await User.findOne({ email, role: { $in: ['ADMIN', 'SUPER_ADMIN'] } })
      .select('+passwordHash')

    const noCredentials = !user || !user.passwordHash

    // Always run bcrypt compare to prevent timing oracle, even on no-match
    const dummyHash = '$2a$12$invalidhashfortimingnormalization000000000000000000000000'
    const passwordMatch = await bcrypt.compare(
      password,
      noCredentials ? dummyHash : user!.passwordHash!,
    )

    if (noCredentials || !passwordMatch) {
      await incrementFailCount(email)
      return reply.code(401).send({
        error:   'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      })
    }

    if (!user!.isActive) {
      return reply.code(403).send({
        error:   'ACCOUNT_DEACTIVATED',
        message: 'Account deactivated.',
      })
    }

    // FIR-172: clear fail counter on successful password verification
    await clearFailCount(email)

    const userId = user!._id.toString()

    // SUPER_ADMIN always gets OTP; ADMIN only if twoFactorEnabled
    if (user!.twoFactorEnabled || user!.role === 'SUPER_ADMIN') {
      const code = await generateOtp(userId)
      if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
        fastify.log.warn({ email: user!.email, code }, '[auth-admin] DEV OTP (no SMTP configured) — do not use in prod')
      } else {
        sendEmail(
          user!.email,
          'Your admin verification code',
          adminOtpEmailTemplate(code, user!.firstName),
        ).catch((err: unknown) => fastify.log.error(err, '[auth-admin] Failed to send OTP email'))
      }

      const preAuthToken = signPreAuthToken(fastify, userId)

      return reply.code(200).send({
        twoFactorRequired: true,
        preAuthToken,
      })
    }

    // No OTP required — issue full token pair
    const { accessToken, rawRefresh } = await issueFullTokens(
      fastify,
      userId,
      user!.email,
      user!.role,
    )

    reply.setCookie('nab_refresh', rawRefresh, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/api/auth',
      maxAge:   REFRESH_TOKEN_TTL,
    })

    const userResponse = await buildUserResponse(userId)

    return reply.code(200).send({
      twoFactorRequired: false,
      accessToken,
      user:         userResponse,
    })
  })

  // ── POST /verify-otp ── PBA-249 ────────────────────────────────────────
  fastify.post('/verify-otp', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const parseResult = verifyOtpSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.code(400).send({
        error:   'INVALID_BODY',
        message: 'Invalid request body.',
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const { preAuthToken, code } = parseResult.data

    const payload = verifyPreAuthToken(fastify, preAuthToken)
    if (!payload) {
      return reply.code(401).send({
        error:   'OTP_EXPIRED',
        message: 'Pre-auth token is invalid or expired.',
      })
    }

    const userId = payload.sub

    // ── DEV BYPASS — remove before public launch ───────────────────────────
    const BYPASS_CODE = '123344'
    const isBypass = code === BYPASS_CODE
    // ───────────────────────────────────────────────────────────────────────

    const result = isBypass ? 'valid' : await verifyOtp(userId, code)

    if (result === 'expired') {
      return reply.code(401).send({
        error:   'OTP_EXPIRED',
        message: 'Verification code has expired. Please log in again.',
      })
    }

    if (result === 'locked') {
      return reply.code(429).send({
        error:   'OTP_LOCKED',
        message: 'Too many attempts. Request a new code.',
      })
    }

    if (result === 'invalid') {
      // FIR-172: count OTP failures against the email-based lockout too
      const userForEmail = await User.findById(userId).select('email').lean()
      if (userForEmail?.email) {
        await incrementFailCount(userForEmail.email)
      }
      return reply.code(401).send({
        error:   'OTP_INVALID',
        message: 'Invalid code.',
      })
    }

    // 'valid' — issue full token pair
    const user = await User.findById(userId).select('email role isActive')
    if (!user || !user.isActive) {
      return reply.code(403).send({
        error:   'ACCOUNT_DEACTIVATED',
        message: 'Account deactivated.',
      })
    }

    // FIR-172: clear fail counter on successful OTP verification
    await clearFailCount(user.email)

    const { accessToken, rawRefresh } = await issueFullTokens(
      fastify,
      userId,
      user.email,
      user.role,
    )

    reply.setCookie('nab_refresh', rawRefresh, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/api/auth',
      maxAge:   REFRESH_TOKEN_TTL,
    })

    const userResponse = await buildUserResponse(userId)

    return reply.code(200).send({
      requiresOtp: false,
      accessToken,
      user:         userResponse,
    })
  })

  // ── POST /set-password ── PBA-250 ──────────────────────────────────────
  fastify.post('/set-password', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const parseResult = setPasswordSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.code(400).send({
        error:   'INVALID_BODY',
        message: 'Invalid request body.',
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const { token, password, confirmPassword } = parseResult.data

    if (password !== confirmPassword) {
      return reply.code(400).send({
        error:   'PASSWORD_MISMATCH',
        message: 'Passwords do not match.',
      })
    }

    if (!isStrongPassword(password)) {
      return reply.code(400).send({
        error:   'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters and include one uppercase letter and one number.',
      })
    }

    const user = await User.findOne({
      passwordSetToken:  token,
      passwordSetExpiry: { $gt: new Date() },
    })

    if (!user) {
      return reply.code(400).send({
        error:   'INVALID_TOKEN',
        message: 'This link is invalid or has expired.',
      })
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    // PBA-264: atomically set inviteStatus to ACCEPTED alongside the passwordHash write
    await User.findByIdAndUpdate(user._id, {
      $set: {
        passwordHash,
        passwordSetToken:  null,
        passwordSetExpiry: null,
        inviteStatus:      'ACCEPTED',
        inviteAcceptedAt:  new Date(),
      },
    })

    return reply.code(200).send({
      message: 'Password set successfully. You can now log in.',
    })
  })

  // ── POST /forgot-password ── PBA-252 ───────────────────────────────────
  fastify.post('/forgot-password', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const parseResult = forgotPasswordSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.code(400).send({
        error:   'INVALID_BODY',
        message: 'Invalid request body.',
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const { email } = parseResult.data

    // Always return the same response to prevent user enumeration
    const GENERIC_RESPONSE = {
      message: 'If that email exists, a reset link has been sent.',
    }

    const user = await User.findOne({ email, role: { $in: ['ADMIN', 'SUPER_ADMIN'] } })

    if (user) {
      const resetToken  = crypto.randomBytes(32).toString('hex')
      const resetExpiry = new Date(Date.now() + PASSWORD_RESET_TTL_MS)

      await User.findByIdAndUpdate(user._id, {
        $set: {
          passwordResetToken:  resetToken,
          passwordResetExpiry: resetExpiry,
        },
      })

      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
      const resetUrl    = `${frontendUrl}/admin/reset-password?token=${resetToken}`

      sendEmail(
        user.email,
        'Reset your admin password',
        adminPasswordResetTemplate(user.firstName, resetUrl),
      ).catch((err: unknown) => fastify.log.error(err, '[auth-admin] Failed to send password reset email'))
    }

    return reply.code(200).send(GENERIC_RESPONSE)
  })

  // ── POST /reset-password ── PBA-252 ────────────────────────────────────
  fastify.post('/reset-password', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const parseResult = resetPasswordSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.code(400).send({
        error:   'INVALID_BODY',
        message: 'Invalid request body.',
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const { token, password, confirmPassword } = parseResult.data

    if (password !== confirmPassword) {
      return reply.code(400).send({
        error:   'PASSWORD_MISMATCH',
        message: 'Passwords do not match.',
      })
    }

    if (!isStrongPassword(password)) {
      return reply.code(400).send({
        error:   'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters and include one uppercase letter and one number.',
      })
    }

    const user = await User.findOne({
      passwordResetToken:  token,
      passwordResetExpiry: { $gt: new Date() },
    })

    if (!user) {
      return reply.code(400).send({
        error:   'INVALID_TOKEN',
        message: 'This link is invalid or has expired.',
      })
    }

    const userId      = user._id.toString()
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    await User.findByIdAndUpdate(userId, {
      $set: {
        passwordHash,
        passwordResetToken:  null,
        passwordResetExpiry: null,
      },
    })

    // Revoke all existing refresh tokens for this user
    await RefreshToken.deleteMany({ userId: user._id })

    // Clear any pending OTP
    await deleteOtp(userId)

    return reply.code(200).send({
      message: 'Password reset successfully.',
    })
  })

  // ── POST /resend-otp ── PBA-258 ────────────────────────────────────────
  fastify.post('/resend-otp', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '10 minutes',
      },
    },
  }, async (request, reply) => {
    const parseResult = resendOtpSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.code(400).send({
        error:   'INVALID_BODY',
        message: 'Invalid request body.',
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const { preAuthToken } = parseResult.data

    const payload = verifyPreAuthToken(fastify, preAuthToken)
    if (!payload) {
      return reply.code(401).send({
        error:   'OTP_EXPIRED',
        message: 'Pre-auth token is invalid or expired.',
      })
    }

    const userId = payload.sub
    const user   = await User.findById(userId).select('email firstName isActive')

    if (!user || !user.isActive) {
      return reply.code(403).send({
        error:   'ACCOUNT_DEACTIVATED',
        message: 'Account deactivated.',
      })
    }

    const code = await generateOtp(userId)
    if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
      fastify.log.warn({ email: user.email, code }, '[auth-admin] DEV OTP (no SMTP configured) — do not use in prod')
    } else {
      sendEmail(
        user.email,
        'Your admin verification code',
        adminOtpEmailTemplate(code, user.firstName),
      ).catch((err: unknown) => fastify.log.error(err, '[auth-admin] Failed to send resend OTP email'))
    }

    return reply.code(200).send({
      message: 'New verification code sent.',
    })
  })
}
