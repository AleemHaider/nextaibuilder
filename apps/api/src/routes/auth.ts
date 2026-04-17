// Auth API: refresh, logout, me (SSO-only — login/register handled by oauth.ts)
import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { User } from '../models/User.js'
import { RefreshToken } from '../models/RefreshToken.js'
import { SubAdminPermission } from '../models/SubAdminPermission.js'
import { authenticate } from '../middleware/authenticate.js'

// ── Token helpers ─────────────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL  = 15 * 60          // 15 minutes in seconds
const REFRESH_TOKEN_TTL = 15 * 24 * 60 * 60 // 15 days in seconds

async function issueTokens(
  fastify: FastifyInstance,
  userId: string,
  email: string,
  role: string,
) {
  const accessToken = fastify.jwt.sign(
    { sub: userId, email, role },
    { expiresIn: ACCESS_TOKEN_TTL },
  )

  // Refresh token: random 48-byte hex, stored as bcrypt hash + SHA-256 fast lookup
  const rawRefresh  = crypto.randomBytes(48).toString('hex')
  const tokenHash   = await bcrypt.hash(rawRefresh, 10)
  const fastLookup  = crypto.createHash('sha256').update(rawRefresh).digest('hex')
  const expiresAt   = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)

  await RefreshToken.create({ userId, tokenHash, fastLookup, expiresAt })

  return { accessToken, rawRefresh }
}

async function issueRefreshToken(userId: string) {
  const rawRefresh  = crypto.randomBytes(48).toString('hex')
  const tokenHash   = await bcrypt.hash(rawRefresh, 10)
  const fastLookup  = crypto.createHash('sha256').update(rawRefresh).digest('hex')
  const expiresAt   = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)

  await RefreshToken.create({ userId, tokenHash, fastLookup, expiresAt })

  return rawRefresh
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/refresh
  fastify.post('/refresh', {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const rawRefresh = (request.cookies as Record<string, string>)['nab_refresh']

    if (!rawRefresh) {
      return reply.code(401).send({
        error: 'NO_REFRESH_TOKEN',
        message: 'Refresh token not found.',
      })
    }

    // Fast O(1) lookup via SHA-256 index, then single bcrypt verify for security
    const fastLookup = crypto.createHash('sha256').update(rawRefresh).digest('hex')
    const matched = await RefreshToken.findOne({
      fastLookup,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).populate<{ userId: { _id: unknown; email: string; role: string; isActive: boolean } }>(
      'userId',
      'email role isActive',
    )

    if (!matched || !(await bcrypt.compare(rawRefresh, matched.tokenHash))) {
      return reply.code(401).send({
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired.',
      })
    }

    // PBA-227: block deactivated users before issuing new tokens
    const populatedUser = matched.userId as unknown as {
      _id: unknown
      email: string
      role: string
      isActive: boolean
    }

    if (populatedUser.isActive === false) {
      // Revoke the token so it cannot be replayed
      await RefreshToken.updateOne({ _id: matched._id }, { revokedAt: new Date() })
      return reply.code(403).send({
        error: 'ACCOUNT_DEACTIVATED',
        message: 'Your account has been deactivated. Please contact an administrator.',
      })
    }

    // Only rotate the refresh token when it has less than 2 days remaining.
    // Rotating on every request causes a race condition: rapid page refreshes
    // send the same cookie concurrently, the second request sees the already-
    // revoked token and signs the user out.
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
    const shouldRotate = matched.expiresAt.getTime() - Date.now() < TWO_DAYS_MS

    const accessToken = fastify.jwt.sign(
      { sub: populatedUser._id!.toString(), email: populatedUser.email, role: populatedUser.role },
      { expiresIn: ACCESS_TOKEN_TTL },
    )

    if (shouldRotate) {
      // Rotate: revoke old token, issue a fresh refresh token + cookie
      await RefreshToken.updateOne({ _id: matched._id }, { revokedAt: new Date() })

      const newRawRefresh = await issueRefreshToken(populatedUser._id!.toString())

      reply.setCookie('nab_refresh', newRawRefresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: REFRESH_TOKEN_TTL,
      })
    }

    return reply.code(200).send({ accessToken })
  })

  // POST /api/auth/logout
  fastify.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    const rawRefresh = (request.cookies as Record<string, string>)['nab_refresh']

    if (rawRefresh) {
      // Single indexed query — no bcrypt loop needed for revocation
      const fastLookup = crypto.createHash('sha256').update(rawRefresh).digest('hex')
      await RefreshToken.updateOne({ fastLookup, revokedAt: null }, { revokedAt: new Date() })
    }

    reply.clearCookie('nab_refresh', { path: '/api/auth' })
    return reply.code(200).send({ message: 'Logged out.' })
  })

  // GET /api/auth/me — protected route
  fastify.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const payload = request.user as { sub: string }

    const user = await User.findById(payload.sub).select(
      'id email firstName lastName role avatarUrl lastActiveAt createdAt twoFactorEnabled inviteStatus',
    )

    if (!user) {
      return reply.code(404).send({ error: 'USER_NOT_FOUND' })
    }

    // PBA-233: resolve permissions for the user
    // SUPER_ADMIN bypasses the permissions table — frontend uses role check
    let permissions: string[] = []
    if (user.role === 'ADMIN') {
      const permDoc = await SubAdminPermission.findOne({ userId: user._id })
      permissions = permDoc?.permissions ?? []
    }

    // PBA-289: include inviteStatus for STUDENT role users
    const responseUser: Record<string, unknown> = {
      id: user._id.toString(),
      email: user.email,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      twoFactorEnabled: user.twoFactorEnabled ?? false,  // PBA-254
      permissions,
    }

    if (user.role === 'STUDENT') {
      responseUser['inviteStatus'] = user.inviteStatus
    }

    // Return user directly (not wrapped) — frontend AuthContext expects AuthUser at root
    return reply.code(200).send(responseUser)
  })
}
