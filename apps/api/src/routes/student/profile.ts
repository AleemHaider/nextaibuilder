// PBA-315 — Student Profile & Settings API
// GET    /api/student/profile
// PATCH  /api/student/profile
// POST   /api/student/profile/avatar/presign
// PATCH  /api/student/profile/avatar
// PATCH  /api/student/profile/notifications
// PATCH  /api/student/profile/password
// DELETE /api/student/profile

import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireStudent } from '../../middleware/authenticate.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { User } from '../../models/User.js'
import { CohortMembership } from '../../models/CohortMembership.js'
import { StudentStep } from '../../models/StudentStep.js'
import { StepSubmission } from '../../models/StepSubmission.js'
import { UserBadge } from '../../models/UserBadge.js'
import { Certificate } from '../../models/Certificate.js'
import { s3, BUCKET_NAME, buildAvatarS3Key, IS_S3_CONFIGURED } from '../../lib/s3.js'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ── Constants ──────────────────────────────────────────────────────────────
const BCRYPT_ROUNDS = 12
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

// ── Validation schemas ─────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).trim(),
  lastName:  z.string().min(1, 'Last name is required').max(100).trim(),
})

const presignAvatarSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

const updateAvatarSchema = z.object({
  s3Key: z.string().min(1),
})

const notificationsSchema = z.object({
  setupReminders:       z.boolean().optional(),
  progressUpdates:      z.boolean().optional(),
  deadlineAlerts:       z.boolean().optional(),
  tipsAndEncouragement: z.boolean().optional(),
})

const changePasswordSchema = z.object({
  currentPassword:  z.string().min(1),
  newPassword:      z.string().min(8),
  confirmPassword:  z.string().min(1),
})

const deleteAccountSchema = z.object({
  password:     z.string().optional(),
  confirmation: z.string().optional(),
})

// ── Password strength validator ────────────────────────────────────────────

function isStrongPassword(password: string): boolean {
  // min 8 chars, 1 uppercase, 1 number
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)
}

// ── Route plugin ───────────────────────────────────────────────────────────

export async function studentProfileRoutes(fastify: FastifyInstance) {

  // ── GET /profile ───────────────────────────────────────────────────────
  fastify.get('/profile', { preHandler: requireStudent }, async (request, reply) => {
    const user = request.user as JwtPayload
    const userId = user.sub

    const dbUser = await User.findById(userId).select(
      'firstName lastName email avatarUrl oauthProvider passwordHash notifications',
    )

    if (!dbUser) {
      return reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'User not found.' })
    }

    // Resolve cohort membership
    const membership = await CohortMembership.findOne({ userId }).populate('cohortId')
    let cohort: { name: string; startDate: Date } | null = null
    if (membership?.cohortId) {
      const c = membership.cohortId as unknown as { name: string; startDate: Date }
      cohort = { name: c.name, startDate: c.startDate }
    }

    // Apply defaults for notifications if subdocument is absent (pre-migration users)
    const notifications = dbUser.notifications ?? {
      setupReminders:       true,
      progressUpdates:      true,
      deadlineAlerts:       true,
      tipsAndEncouragement: true,
    }

    return reply.send({
      id:            userId,
      firstName:     dbUser.firstName,
      lastName:      dbUser.lastName,
      email:         dbUser.email,
      avatarUrl:     dbUser.avatarUrl ?? null,
      oauthProvider: dbUser.oauthProvider ?? null,
      hasPassword:   !!dbUser.passwordHash,
      notifications: {
        setupReminders:       notifications.setupReminders       ?? true,
        progressUpdates:      notifications.progressUpdates      ?? true,
        deadlineAlerts:       notifications.deadlineAlerts        ?? true,
        tipsAndEncouragement: notifications.tipsAndEncouragement ?? true,
      },
      cohort,
    })
  })

  // ── PATCH /profile ─────────────────────────────────────────────────────
  fastify.patch<{ Body: { firstName?: string; lastName?: string } }>(
    '/profile',
    { preHandler: requireStudent },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const parse = updateProfileSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parse.error.flatten().fieldErrors,
        })
      }

      const { firstName, lastName } = parse.data
      const dbUser = await User.findByIdAndUpdate(
        user.sub,
        { $set: { firstName, lastName } },
        { new: true },
      )

      if (!dbUser) {
        return reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'User not found.' })
      }

      return reply.send({
        firstName: dbUser.firstName,
        lastName:  dbUser.lastName,
        avatarUrl: dbUser.avatarUrl ?? null,
      })
    },
  )

  // ── POST /profile/avatar/presign ───────────────────────────────────────
  fastify.post<{ Body: { contentType?: string } }>(
    '/profile/avatar/presign',
    { preHandler: requireStudent },
    async (request, reply) => {
      const user = request.user as JwtPayload

      const parse = presignAvatarSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({
          error:   'INVALID_CONTENT_TYPE',
          message: `contentType must be one of: ${ALLOWED_AVATAR_TYPES.join(', ')}`,
        })
      }

      const { contentType } = parse.data
      const s3Key = buildAvatarS3Key(user.sub, contentType)

      // When S3 is not configured (dev), point to local upload endpoint
      if (!IS_S3_CONFIGURED) {
        const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000'
        const presignedUrl = `${apiBase}/api/uploads/${s3Key}`
        return reply.send({ presignedUrl, s3Key })
      }

      const command = new PutObjectCommand({
        Bucket:     BUCKET_NAME,
        Key:        s3Key,
        ContentType: contentType,
      })

      const presignedUrl = await getSignedUrl(s3, command, {
        expiresIn: 300, // 5 min
      })

      return reply.send({ presignedUrl, s3Key })
    },
  )

  // ── PATCH /profile/avatar ──────────────────────────────────────────────
  fastify.patch<{ Body: { s3Key?: string } }>(
    '/profile/avatar',
    { preHandler: requireStudent },
    async (request, reply) => {
      const user = request.user as JwtPayload

      const parse = updateAvatarSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({
          error:   'MISSING_S3_KEY',
          message: 's3Key is required.',
        })
      }

      const { s3Key } = parse.data

      // Validate that the key belongs to this user (prevent path traversal / key spoofing)
      if (!s3Key.startsWith(`avatars/${user.sub}/`)) {
        return reply.code(400).send({
          error:   'INVALID_S3_KEY',
          message: 'Invalid s3Key — key does not belong to this user.',
        })
      }

      // Build the public/presigned URL. For simplicity, store the S3 key and let frontend fetch presigned URLs.
      // We store the direct path — avatar read URLs are generated on demand.
      let avatarUrl: string
      if (IS_S3_CONFIGURED) {
        const region = process.env.AWS_REGION ?? 'eu-west-2'
        const bucket = process.env.S3_BUCKET_NAME ?? 'pba-screenshots'
        avatarUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`
      } else {
        const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000'
        avatarUrl = `${apiBase}/api/uploads/${s3Key}`
      }

      const dbUser = await User.findByIdAndUpdate(
        user.sub,
        { $set: { avatarUrl } },
        { new: true },
      )

      if (!dbUser) {
        return reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'User not found.' })
      }

      return reply.send({ avatarUrl: dbUser.avatarUrl })
    },
  )

  // ── PATCH /profile/notifications ──────────────────────────────────────
  fastify.patch<{ Body: Record<string, unknown> }>(
    '/profile/notifications',
    { preHandler: requireStudent },
    async (request, reply) => {
      const user = request.user as JwtPayload

      const parse = notificationsSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid notification preferences.',
          details: parse.error.flatten().fieldErrors,
        })
      }

      const prefs = parse.data

      // Build a $set of only the provided fields using dot-notation to avoid
      // clobbering existing notification values not present in this request
      const setFields: Record<string, boolean> = {}
      if (prefs.setupReminders       !== undefined) setFields['notifications.setupReminders']       = prefs.setupReminders
      if (prefs.progressUpdates      !== undefined) setFields['notifications.progressUpdates']      = prefs.progressUpdates
      if (prefs.deadlineAlerts       !== undefined) setFields['notifications.deadlineAlerts']        = prefs.deadlineAlerts
      if (prefs.tipsAndEncouragement !== undefined) setFields['notifications.tipsAndEncouragement'] = prefs.tipsAndEncouragement

      if (Object.keys(setFields).length > 0) {
        await User.findByIdAndUpdate(user.sub, { $set: setFields })
      }

      return reply.code(204).send()
    },
  )

  // ── PATCH /profile/password ────────────────────────────────────────────
  fastify.patch<{ Body: { currentPassword?: string; newPassword?: string; confirmPassword?: string } }>(
    '/profile/password',
    {
      preHandler: requireStudent,
      config: {
        rateLimit: {
          max:        5,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request, reply) => {
      const user = request.user as JwtPayload

      const parse = changePasswordSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parse.error.flatten().fieldErrors,
        })
      }

      const { currentPassword, newPassword, confirmPassword } = parse.data

      const dbUser = await User.findById(user.sub).select('+passwordHash')
      if (!dbUser) {
        return reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'User not found.' })
      }

      // OAuth-only user with no password set
      if (dbUser.oauthProvider && !dbUser.passwordHash) {
        return reply.code(403).send({
          error:   'NO_PASSWORD_SET',
          message: 'This account uses social login and has no password. Use OAuth to sign in.',
        })
      }

      // Verify current password
      const passwordMatch = await bcrypt.compare(currentPassword, dbUser.passwordHash ?? '')
      if (!passwordMatch) {
        return reply.code(401).send({
          error:   'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect.',
        })
      }

      if (newPassword !== confirmPassword) {
        return reply.code(400).send({
          error:   'PASSWORD_MISMATCH',
          message: 'New passwords do not match.',
        })
      }

      if (!isStrongPassword(newPassword)) {
        return reply.code(400).send({
          error:   'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters and include one uppercase letter and one number.',
        })
      }

      const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
      await User.findByIdAndUpdate(user.sub, { $set: { passwordHash: newHash } })

      return reply.code(200).send({ message: 'Password updated.' })
    },
  )

  // ── DELETE /profile ────────────────────────────────────────────────────
  fastify.delete<{ Body: { password?: string; confirmation?: string } }>(
    '/profile',
    { preHandler: requireStudent },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const userId = user.sub

      const parse = deleteAccountSchema.safeParse(request.body ?? {})
      if (!parse.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
        })
      }

      const { password, confirmation } = parse.data

      const dbUser = await User.findById(userId).select('+passwordHash')
      if (!dbUser) {
        return reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'User not found.' })
      }

      // Determine verification method
      if (!dbUser.oauthProvider || dbUser.passwordHash) {
        // Password-auth user — require current password
        if (!password) {
          return reply.code(400).send({
            error:   'PASSWORD_REQUIRED',
            message: 'Your current password is required to delete your account.',
          })
        }

        const passwordMatch = await bcrypt.compare(password, dbUser.passwordHash ?? '')
        if (!passwordMatch) {
          return reply.code(401).send({
            error:   'INVALID_PASSWORD',
            message: 'Incorrect password.',
          })
        }
      } else {
        // OAuth-only user — require "DELETE" confirmation text
        if (confirmation !== 'DELETE') {
          return reply.code(400).send({
            error:   'CONFIRMATION_REQUIRED',
            message: 'Type DELETE to confirm account deletion.',
          })
        }
      }

      // Log before deleting
      fastify.log.info({ userId }, 'Student account deletion requested')

      // Cascade delete in order (child → parent)
      await StepSubmission.deleteMany({ userId })
      await StudentStep.deleteMany({ userId })
      await CohortMembership.deleteMany({ userId })
      await UserBadge.deleteMany({ userId })
      await Certificate.deleteMany({ userId })
      await User.findByIdAndDelete(userId)

      // Clear the refresh token cookie
      reply.clearCookie('nab_refresh', { path: '/api/auth' })

      return reply.code(200).send({ message: 'Account deleted.' })
    },
  )
}
