// OAuth SSO routes — Google and Apple sign-in (SSO-only, no email/password)
import type { FastifyInstance, FastifyReply } from 'fastify'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { z } from 'zod'
import { User } from '../models/User.js'
import { RefreshToken } from '../models/RefreshToken.js'
import { ActivityLog } from '../models/ActivityLog.js'
import bcrypt from 'bcryptjs'


// ── Config ───────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ''
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID ?? ''

const ACCESS_TOKEN_TTL = 15 * 60
const REFRESH_TOKEN_TTL = 15 * 24 * 60 * 60 // 15 days

// ── Schemas ──────────────────────────────────────────────────────────────────

const googleTokenSchema = z.object({
  idToken:     z.string().min(1),
  inviteToken: z.string().optional(),
})

const appleTokenSchema = z.object({
  idToken: z.string().min(1),
  user: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
})

// ── Token helpers ────────────────────────────────────────────────────────────

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

  const rawRefresh  = crypto.randomBytes(48).toString('hex')
  const tokenHash   = await bcrypt.hash(rawRefresh, 10)
  const fastLookup  = crypto.createHash('sha256').update(rawRefresh).digest('hex')
  const expiresAt   = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)

  await RefreshToken.create({ userId, tokenHash, fastLookup, expiresAt })

  return { accessToken, rawRefresh }
}

function setRefreshCookie(reply: FastifyReply, rawRefresh: string) {
  reply.setCookie('nab_refresh', rawRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL,
  })
}

function userResponse(user: { _id: unknown; email: string; firstName: string; lastName: string; role: string; avatarUrl: string | null }) {
  return {
    id: user._id!.toString(),
    email: user.email,
    name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function oauthRoutes(fastify: FastifyInstance) {
  // ── Google Sign-In ────────────────────────────────────────────────────────
  const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

  fastify.post('/google', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const parsed = googleTokenSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'idToken is required.' })
    }

    let payload: { sub?: string; email?: string; given_name?: string; family_name?: string; picture?: string }
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: parsed.data.idToken,
        audience: GOOGLE_CLIENT_ID,
      })
      payload = ticket.getPayload() ?? {}
    } catch {
      return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Google token verification failed.' })
    }

    if (!payload.sub || !payload.email) {
      return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Token missing required claims.' })
    }

    // Find existing user by OAuth ID, or by email
    let user = await User.findOne({
      $or: [
        { oauthProvider: 'google', oauthId: payload.sub },
        { email: payload.email.toLowerCase() },
      ],
    })

    // PBA-336 — Invite activation + PBA-285 OAuth collision guard
    if (user && user.oauthId === null) {
      if (user.inviteStatus === 'REVOKED') {
        return reply.code(403).send({
          error:   'ACCOUNT_REVOKED',
          message: 'This account has been revoked. Contact your administrator.',
        })
      }

      if (user.inviteStatus === 'ACCEPTED') {
        // Account was created via invite but oauthId not yet written — treat as normal sign-in below
        // (falls through to the isNewUser = false branch)
      }

      if (user.inviteStatus === 'PENDING') {
        // Auto-activate: email match (via $or query) already proves ownership.
        // No invite token required — student can sign in directly from the login page.
        const nameUpdate: Record<string, string> = {}
        if (payload.given_name) {
          nameUpdate.firstName = payload.given_name
          nameUpdate.lastName  = payload.family_name ?? ''
        } else if (user.firstName === user.lastName && user.firstName !== '') {
          nameUpdate.lastName = ''
        }

        await User.findOneAndUpdate(
          { _id: user._id },
          {
            $set: {
              oauthProvider:    'google',
              oauthId:          payload.sub,
              avatarUrl:        payload.picture ?? user.avatarUrl,
              inviteStatus:     'ACCEPTED',
              inviteAcceptedAt: new Date(),
              lastActiveAt:     new Date(),
              ...nameUpdate,
            },
            $unset: {
              passwordSetToken:  '',
              passwordSetExpiry: '',
            },
          },
        )

        const activated = await User.findById(user._id)
        if (!activated) {
          return reply.code(500).send({ error: 'INTERNAL_ERROR' })
        }
        user = activated

        ActivityLog.create({
          userId:    user._id,
          actorId:   user._id,
          actorRole: 'student',
          type:      'invite_accepted',
          metadata:  { provider: 'google' },
        }).catch((err: unknown) =>
          console.error('[OAuth/Google] invite_accepted: failed to write ActivityLog', err),
        )
      }
    }

    if (!user) {
      return reply.code(403).send({
        error:   'NOT_ENROLLED',
        message: 'You are not enrolled in Product Builder Academy. Please contact your administrator.',
      })
    }


    const userId = user._id.toString()
    const { accessToken, rawRefresh } = await issueTokens(fastify, userId, user.email, user.role)

    await User.updateOne({ _id: user._id }, { lastActiveAt: new Date() })
    setRefreshCookie(reply, rawRefresh)

    // PBA-360: fire-and-forget — log student login (only for STUDENT role)
    if (user.role === 'STUDENT') {
      ActivityLog.create({
        userId:    user._id,
        actorId:   user._id,
        actorRole: 'student',
        type:      'login',
        metadata:  { provider: 'google' },
      }).catch((err: unknown) =>
        console.error('[OAuth/Google] login: failed to write ActivityLog', err),
      )
    }

    return reply.code(200).send({ accessToken, user: userResponse(user) })
  })

  // ── Apple Sign-In ─────────────────────────────────────────────────────────

  fastify.post('/apple', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const parsed = appleTokenSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'idToken is required.' })
    }

    let decoded: { sub?: string; email?: string }
    try {
      const appleKeys = await fetchApplePublicKeys()
      const header = JSON.parse(
        Buffer.from(parsed.data.idToken.split('.')[0], 'base64url').toString(),
      )
      const matchingKey = appleKeys.find((k: { kid: string }) => k.kid === header.kid)

      if (!matchingKey) {
        return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'No matching Apple key found.' })
      }

      const publicKey = createPublicKeyFromJWK(matchingKey)
      decoded = jwt.verify(parsed.data.idToken, publicKey, {
        algorithms: ['RS256'],
        audience: APPLE_CLIENT_ID,
        issuer: 'https://appleid.apple.com',
      }) as typeof decoded
    } catch {
      return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Apple token verification failed.' })
    }

    if (!decoded.sub || !decoded.email) {
      return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Token missing required claims.' })
    }

    // Apple only sends user name on FIRST sign-in
    const firstName = parsed.data.user?.firstName ?? 'User'
    const lastName = parsed.data.user?.lastName ?? ''

    let user = await User.findOne({
      $or: [
        { oauthProvider: 'apple', oauthId: decoded.sub },
        { email: decoded.email.toLowerCase() },
      ],
    })

    // OAuth collision guard for Apple email-matched accounts
    if (user && user.oauthId === null) {
      if (user.inviteStatus === 'REVOKED') {
        return reply.code(403).send({
          error:   'ACCOUNT_REVOKED',
          message: 'This account has been revoked. Contact your administrator.',
        })
      }

      if (user.inviteStatus === 'PENDING') {
        // Auto-activate: email match already proves ownership.
        const nameUpdate: Record<string, string> = {}
        if (firstName && firstName !== 'User') {
          nameUpdate.firstName = firstName
          nameUpdate.lastName  = lastName
        }

        await User.findOneAndUpdate(
          { _id: user._id },
          {
            $set: {
              oauthProvider:    'apple',
              oauthId:          decoded.sub,
              inviteStatus:     'ACCEPTED',
              inviteAcceptedAt: new Date(),
              lastActiveAt:     new Date(),
              ...nameUpdate,
            },
            $unset: {
              passwordSetToken:  '',
              passwordSetExpiry: '',
            },
          },
        )

        const activated = await User.findById(user._id)
        if (!activated) {
          return reply.code(500).send({ error: 'INTERNAL_ERROR' })
        }
        user = activated

        ActivityLog.create({
          userId:    user._id,
          actorId:   user._id,
          actorRole: 'student',
          type:      'invite_accepted',
          metadata:  { provider: 'apple' },
        }).catch((err: unknown) =>
          console.error('[OAuth/Apple] invite_accepted: failed to write ActivityLog', err),
        )
      }
    }

    if (!user) {
      return reply.code(403).send({
        error:   'NOT_ENROLLED',
        message: 'You are not enrolled in Product Builder Academy. Please contact your administrator.',
      })
    }


    const userId = user._id.toString()
    const { accessToken, rawRefresh } = await issueTokens(fastify, userId, user.email, user.role)

    await User.updateOne({ _id: user._id }, { lastActiveAt: new Date() })
    setRefreshCookie(reply, rawRefresh)

    // PBA-360: fire-and-forget — log student login (only for STUDENT role)
    if (user.role === 'STUDENT') {
      ActivityLog.create({
        userId:    user._id,
        actorId:   user._id,
        actorRole: 'student',
        type:      'login',
        metadata:  { provider: 'apple' },
      }).catch((err: unknown) =>
        console.error('[OAuth/Apple] login: failed to write ActivityLog', err),
      )
    }

    return reply.code(200).send({ accessToken, user: userResponse(user) })
  })
}

// ── Apple key helpers ────────────────────────────────────────────────────────

let cachedAppleKeys: Array<{ kid: string; kty: string; use: string; alg: string; n: string; e: string }> | null = null
let cacheExpiry = 0

async function fetchApplePublicKeys() {
  if (cachedAppleKeys && Date.now() < cacheExpiry) {
    return cachedAppleKeys
  }

  const res = await fetch('https://appleid.apple.com/auth/keys')
  const data = (await res.json()) as { keys: typeof cachedAppleKeys }
  cachedAppleKeys = data.keys
  cacheExpiry = Date.now() + 24 * 60 * 60 * 1000 // cache 24h
  return cachedAppleKeys!
}

function createPublicKeyFromJWK(jwk: { kty: string; n: string; e: string; kid: string }) {
  return crypto.createPublicKey({ key: jwk, format: 'jwk' })
}
