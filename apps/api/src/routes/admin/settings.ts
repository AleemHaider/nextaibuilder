// PBA-132 — Admin Settings API
// GET   /api/admin/settings/profile — return calling admin's own User document
// PATCH /api/admin/settings/profile — update firstName, lastName
// POST  /api/admin/settings/avatar  — upload avatar to S3, update user avatarUrl
// PBA-253 — POST /api/admin/settings/2fa/enable
//           POST /api/admin/settings/2fa/enable/confirm
//           POST /api/admin/settings/2fa/disable

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { type JwtPayload } from '../../middleware/require-admin.js'
import { requirePermission } from '../../middleware/require-permission.js'
import { User } from '../../models/User.js'
import { AuditLog } from '../../models/AuditLog.js'
import { s3, BUCKET_NAME } from '../../lib/s3.js'
import { generateOtp, verifyOtp } from '../../lib/admin-otp.js'
import { sendEmail, adminOtpEmailTemplate } from '../../lib/email.js'

// ── Constants ──────────────────────────────────────────────────────────────

const AVATAR_MAX_BYTES     = 2 * 1024 * 1024 // 2 MB
const ALLOWED_MIME_TYPES   = new Set(['image/jpeg', 'image/png'])
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
}

// ── Validation schemas ─────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName:  z.string().min(1).max(100).trim().optional(),
}).refine(
  (data) => data.firstName !== undefined || data.lastName !== undefined,
  { message: 'At least one field (firstName or lastName) must be provided.' },
)

type UpdateProfileBody = z.infer<typeof updateProfileSchema>

// ── Route plugin ───────────────────────────────────────────────────────────

export async function adminSettingsRoutes(fastify: FastifyInstance) {

  // ── GET /profile ── Admin's own profile ───────────────────────────────
  fastify.get(
    '/profile',
    { preHandler: requirePermission('settings:read-own-profile') },
    async (request, reply) => {
      const admin = request.user as JwtPayload

      const user = await User.findById(admin.sub, {
        email:       1,
        firstName:   1,
        lastName:    1,
        avatarUrl:   1,
        role:        1,
        createdAt:   1,
      }).lean({ virtuals: true })

      if (!user) {
        return reply.code(404).send({
          error:   'USER_NOT_FOUND',
          message: 'Admin user not found.',
        })
      }

      return reply.send({
        profile: {
          id:        admin.sub,
          email:     user.email,
          firstName: user.firstName,
          lastName:  user.lastName,
          avatarUrl: user.avatarUrl ?? null,
          role:      user.role,
          createdAt: user.createdAt,
        },
      })
    },
  )

  // ── PATCH /profile ── Update firstName / lastName ─────────────────────
  fastify.patch<{ Body: UpdateProfileBody }>(
    '/profile',
    { preHandler: requirePermission('settings:read-own-profile') },
    async (request, reply) => {
      const admin = request.user as JwtPayload

      const parseResult = updateProfileSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { firstName, lastName } = parseResult.data

      const patch: Record<string, string> = {}
      if (firstName !== undefined) patch['firstName'] = firstName
      if (lastName  !== undefined) patch['lastName']  = lastName

      const user = await User.findByIdAndUpdate(
        admin.sub,
        { $set: patch },
        { new: true, runValidators: true },
      ).lean({ virtuals: true })

      if (!user) {
        return reply.code(404).send({
          error:   'USER_NOT_FOUND',
          message: 'Admin user not found.',
        })
      }

      fastify.log.info(`[admin/settings] Profile updated for admin=${admin.sub}`)

      return reply.send({
        profile: {
          id:        admin.sub,
          email:     user.email,
          firstName: user.firstName,
          lastName:  user.lastName,
          avatarUrl: user.avatarUrl ?? null,
          role:      user.role,
          createdAt: user.createdAt,
        },
      })
    },
  )

  // ── POST /avatar ── Upload avatar to S3 ───────────────────────────────
  fastify.post(
    '/avatar',
    { preHandler: requirePermission('settings:read-own-profile') },
    async (request, reply) => {
      const admin = request.user as JwtPayload

      // Parse the multipart upload
      let fileData: Buffer | null = null
      let mimeType: string | null = null

      try {
        const data = await request.file()

        if (!data) {
          return reply.code(400).send({
            error:   'NO_FILE',
            message: 'No file uploaded.',
          })
        }

        mimeType = data.mimetype

        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
          return reply.code(400).send({
            error:   'INVALID_FILE_TYPE',
            message: 'Only image/jpeg and image/png files are accepted.',
          })
        }

        // Read into buffer so we can check size before uploading
        const chunks: Buffer[] = []
        let totalBytes = 0

        for await (const chunk of data.file) {
          totalBytes += chunk.length
          if (totalBytes > AVATAR_MAX_BYTES) {
            return reply.code(413).send({
              error:   'FILE_TOO_LARGE',
              message: 'Avatar must be 2 MB or smaller.',
            })
          }
          chunks.push(chunk)
        }

        fileData = Buffer.concat(chunks)
      } catch (err) {
        fastify.log.error({ err }, '[admin/settings] Failed to parse multipart upload')
        return reply.code(400).send({
          error:   'UPLOAD_ERROR',
          message: 'Failed to process file upload.',
        })
      }

      if (!fileData || !mimeType) {
        return reply.code(400).send({
          error:   'NO_FILE',
          message: 'No file data received.',
        })
      }

      let avatarUrl: string
      let s3Key: string | undefined

      const s3Configured =
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY

      if (s3Configured) {
        const ext = MIME_TO_EXT[mimeType] ?? 'jpg'
        s3Key     = `avatars/${admin.sub}/${Date.now()}.${ext}`

        try {
          await s3.send(
            new PutObjectCommand({
              Bucket:      BUCKET_NAME,
              Key:         s3Key,
              Body:        fileData,
              ContentType: mimeType,
            }),
          )
        } catch (err) {
          fastify.log.error({ err }, `[admin/settings] S3 upload failed for key=${s3Key}`)
          return reply.code(502).send({
            error:   'S3_UPLOAD_FAILED',
            message: 'Failed to upload avatar to storage.',
          })
        }

        avatarUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`
      } else {
        // S3 not configured — store as base64 data URL directly in DB
        avatarUrl = `data:${mimeType};base64,${fileData.toString('base64')}`
        fastify.log.warn('[admin/settings] S3 not configured, storing avatar as base64 data URL')
      }

      const user = await User.findByIdAndUpdate(
        admin.sub,
        { $set: { avatarUrl } },
        { new: true },
      ).lean()

      if (!user) {
        return reply.code(404).send({
          error:   'USER_NOT_FOUND',
          message: 'Admin user not found.',
        })
      }

      fastify.log.info(
        `[admin/settings] Avatar updated for admin=${admin.sub} key=${s3Key ?? 'base64'}`,
      )

      return reply.send({ avatarUrl })
    },
  )

  // ── POST /2fa/enable ── Initiate 2FA enable — send OTP ─────────────────
  // PBA-253
  fastify.post(
    '/2fa/enable',
    { preHandler: requirePermission('settings:read-own-profile') },
    async (request, reply) => {
      const admin = request.user as JwtPayload

      const user = await User.findById(admin.sub).select('email firstName')
      if (!user) {
        return reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'Admin user not found.' })
      }

      const code = await generateOtp(admin.sub)
      sendEmail(
        user.email,
        'Your admin verification code',
        adminOtpEmailTemplate(code, user.firstName),
      ).catch((err: unknown) => fastify.log.error(err, '[admin/settings] Failed to send 2FA enable OTP'))

      return reply.code(200).send({
        message: 'Verification code sent to your email.',
      })
    },
  )

  // ── POST /2fa/enable/confirm ── Confirm OTP to enable 2FA ──────────────
  // PBA-253
  const confirmOtpSchema = z.object({ code: z.string().length(6) })

  fastify.post<{ Body: { code: string } }>(
    '/2fa/enable/confirm',
    { preHandler: requirePermission('settings:read-own-profile') },
    async (request, reply) => {
      const admin       = request.user as JwtPayload
      const parseResult = confirmOtpSchema.safeParse(request.body)

      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { code } = parseResult.data
      const result   = await verifyOtp(admin.sub, code)

      if (result === 'expired') {
        return reply.code(401).send({ error: 'OTP_EXPIRED', message: 'Code has expired. Request a new one.' })
      }
      if (result === 'locked') {
        return reply.code(429).send({ error: 'OTP_LOCKED', message: 'Too many attempts. Request a new code.' })
      }
      if (result === 'invalid') {
        return reply.code(401).send({ error: 'OTP_INVALID', message: 'Invalid code.' })
      }

      // 'valid' — enable 2FA
      await User.findByIdAndUpdate(admin.sub, { $set: { twoFactorEnabled: true } })

      await AuditLog.create({
        adminId:    new Types.ObjectId(admin.sub),
        action:     '2FA_ENABLED',
        targetType: 'User',
        targetId:   admin.sub,
        note:       null,
        metadata:   null,
      })

      fastify.log.info(`[admin/settings] 2FA enabled for admin=${admin.sub}`)

      return reply.code(200).send({ message: '2FA enabled successfully.' })
    },
  )

  // ── POST /2fa/disable ── Disable 2FA (ADMIN only, requires OTP) ────────
  // PBA-253
  fastify.post<{ Body: { code?: string } }>(
    '/2fa/disable',
    { preHandler: requirePermission('settings:read-own-profile') },
    async (request, reply) => {
      const admin = request.user as JwtPayload

      // SUPER_ADMIN cannot disable 2FA
      if (admin.role === 'SUPER_ADMIN') {
        return reply.code(403).send({
          error:   'FORBIDDEN',
          message: '2FA cannot be disabled for Super Admin.',
        })
      }

      const body        = (request.body ?? {}) as { code?: string }
      const { code }    = body

      const user = await User.findById(admin.sub).select('email firstName twoFactorEnabled')
      if (!user) {
        return reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'Admin user not found.' })
      }

      // If no code supplied, generate an OTP and ask the client to confirm
      if (!code) {
        const otpCode = await generateOtp(admin.sub)
        sendEmail(
          user.email,
          'Your admin verification code',
          adminOtpEmailTemplate(otpCode, user.firstName),
        ).catch((err: unknown) => fastify.log.error(err, '[admin/settings] Failed to send 2FA disable OTP'))

        return reply.code(200).send({ requiresOtp: true })
      }

      const result = await verifyOtp(admin.sub, code)

      if (result === 'expired') {
        return reply.code(401).send({ error: 'OTP_EXPIRED', message: 'Code has expired. Request a new one.' })
      }
      if (result === 'locked') {
        return reply.code(429).send({ error: 'OTP_LOCKED', message: 'Too many attempts. Request a new code.' })
      }
      if (result === 'invalid') {
        return reply.code(401).send({ error: 'OTP_INVALID', message: 'Invalid code.' })
      }

      // 'valid' — disable 2FA
      await User.findByIdAndUpdate(admin.sub, { $set: { twoFactorEnabled: false } })

      await AuditLog.create({
        adminId:    new Types.ObjectId(admin.sub),
        action:     '2FA_DISABLED',
        targetType: 'User',
        targetId:   admin.sub,
        note:       null,
        metadata:   null,
      })

      fastify.log.info(`[admin/settings] 2FA disabled for admin=${admin.sub}`)

      return reply.code(200).send({ message: '2FA disabled successfully.' })
    },
  )
}
