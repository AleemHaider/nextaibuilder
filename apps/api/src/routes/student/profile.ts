// PBA-315 — Student Profile & Settings API
// GET    /api/student/profile
// PATCH  /api/student/profile
// POST   /api/student/profile/avatar/presign
// PATCH  /api/student/profile/avatar
// PATCH  /api/student/profile/notifications
// PATCH  /api/student/profile/password
// DELETE /api/student/profile                 — legacy hard-delete (PBA-315)
// POST   /api/student/profile/delete          — soft-delete / anonymise
//                                               (Sprint 4 Story 20)

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
import { RefreshToken } from '../../models/RefreshToken.js'
import { Enrollment } from '../../models/Enrollment.js'
import { stripe } from '../../lib/stripe.js'
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

// Sprint 4 Story 20 — danger-zone soft-delete schema. The student types
// "DELETE MY ACCOUNT" or their own email into a confirmation Input. We
// require the literal string so an automated client or a mis-wired button
// can't wipe an account by accident.
const softDeleteAccountSchema = z.object({
  confirmation: z.string().min(1, 'Confirmation is required.'),
})

const SOFT_DELETE_TOKEN = 'DELETE MY ACCOUNT'

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

  // ── POST /profile/delete ── Sprint 4 Story 20 (student danger zone) ────
  //
  // Soft-delete / anonymise flow. Unlike the legacy DELETE /profile above
  // (which hard-deletes every child record), this endpoint preserves
  // enrollments, StripePayment, EmailLog and Certificate rows — those hold
  // the immutable financial + audit truth the finance team needs for
  // refunds and tax. The User document itself is tombstoned by:
  //   • isActive = false            → authenticate() middleware blocks future logins
  //   • deletedAt = now              → explicit tombstone timestamp
  //   • email, firstName, lastName, oauthId, oauthProvider, passwordHash
  //                                  → overwritten with anonymised placeholders
  //     so there's no residual PII on the row.
  //
  // Side effects (best-effort, wrapped in try/catch so a Stripe outage or
  // placeholder API key doesn't block the local tombstone):
  //   • stripe.subscriptions.cancel() for every active Enrollment subscription
  //   • RefreshToken.deleteMany() so every sessioned device is revoked
  //
  // The request is gated behind a confirmation body — the student must
  // type either the literal string "DELETE MY ACCOUNT" or their own email.
  // Any other value → 400 CONFIRMATION_MISMATCH. This mirrors GitHub's
  // org-delete UX and prevents a stray click or broken button from wiping
  // the account.
  fastify.post<{ Body: { confirmation?: string } }>(
    '/profile/delete',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: userId } = request.user as JwtPayload

      const parse = softDeleteAccountSchema.safeParse(request.body ?? {})
      if (!parse.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Confirmation is required.',
          details: parse.error.flatten().fieldErrors,
        })
      }
      const { confirmation } = parse.data

      const dbUser = await User.findById(userId)
      if (!dbUser) {
        return reply.code(404).send({
          error:   'USER_NOT_FOUND',
          message: 'User not found.',
        })
      }

      // Already tombstoned — treat as 404 so repeated calls are idempotent
      // without leaking "this account used to exist" metadata.
      if (dbUser.deletedAt) {
        return reply.code(404).send({
          error:   'USER_NOT_FOUND',
          message: 'User not found.',
        })
      }

      // Guard: must match either the literal token or the user's email.
      // Trim + case-insensitive email comparison matches how humans actually
      // type these in a stressed "I'm deleting my account" moment.
      const trimmed = confirmation.trim()
      const matchesToken = trimmed === SOFT_DELETE_TOKEN
      const matchesEmail = trimmed.toLowerCase() === (dbUser.email ?? '').toLowerCase()
      if (!matchesToken && !matchesEmail) {
        return reply.code(400).send({
          error:   'CONFIRMATION_MISMATCH',
          message: `Type "${SOFT_DELETE_TOKEN}" or your email to confirm.`,
        })
      }

      fastify.log.info({ userId }, 'Student account soft-delete requested')

      // ── Cancel active Stripe subscriptions (best-effort) ────────────────
      // We load the enrollments fresh so an active row that was created
      // between request parse and now is still caught. Cancel failures are
      // logged and swallowed — a placeholder STRIPE_SECRET_KEY in dev or a
      // Stripe outage must not block the local tombstone.
      try {
        const activeEnrollments = await Enrollment.find({
          studentId: userId,
          stripeSubscriptionId: { $exists: true, $ne: null },
          status: 'ACTIVE',
        }).select('stripeSubscriptionId')

        for (const enr of activeEnrollments) {
          const subId = enr.stripeSubscriptionId
          if (!subId) continue
          try {
            await stripe.subscriptions.cancel(subId)
          } catch (err) {
            fastify.log.warn(
              { userId, subId, err: (err as Error).message },
              'Stripe subscription cancel failed during account delete — continuing',
            )
          }
        }
      } catch (err) {
        fastify.log.warn(
          { userId, err: (err as Error).message },
          'Failed to enumerate Stripe subscriptions for cancellation — continuing',
        )
      }

      // ── Revoke all refresh tokens (force-logout every device) ───────────
      try {
        await RefreshToken.deleteMany({ userId })
      } catch (err) {
        fastify.log.warn(
          { userId, err: (err as Error).message },
          'RefreshToken.deleteMany failed during account delete — continuing',
        )
      }

      // ── Anonymise PII + tombstone ───────────────────────────────────────
      // The anon-local TLD is a reserved sink that will never accept real
      // mail, so if any worker tries to send to this address it will bounce
      // loudly rather than silently reach a real inbox.
      const tombstoneEmail = `deleted-${userId}@anon.local`
      await User.findByIdAndUpdate(userId, {
        $set: {
          email:         tombstoneEmail,
          firstName:     'Deleted',
          lastName:      'User',
          oauthId:       null,
          oauthProvider: null,
          passwordHash:  null,
          isActive:      false,
          deletedAt:     new Date(),
        },
      })

      // Clear the refresh cookie on this browser too — the deleteMany above
      // revoked every server-side token, but the cookie still sits in the
      // client until we explicitly clear it.
      reply.clearCookie('nab_refresh', { path: '/api/auth' })

      return reply.code(200).send({ deleted: true })
    },
  )
}
