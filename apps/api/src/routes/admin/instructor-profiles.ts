// NAB-P0-3 — Admin InstructorProfile CRUD + avatar upload
//
// Routes (all gated by requirePermission('courses:write') aside from the
// read-only LIST / GET which use 'courses:read'):
//
//   GET    /                — paginated list (default 20) with optional ?q=
//   GET    /:id             — single profile
//   POST   /                — create (Zod-validated body, unique userId)
//   PATCH  /:id             — partial update
//   DELETE /:id             — hard delete + unset from Cohort.instructorIds
//   POST   /:id/avatar      — multipart avatar upload (5 MB, jpeg/png/webp)
//
// The avatar upload mirrors the cover-upload handler in routes/admin/courses.ts:
// same mime gate, same size limit, same S3-vs-local fallback. Uploaded files
// live under `instructor-avatars/<profileId>/<ts>.<ext>` so a later cleanup
// job can reconcile keys against InstructorProfile.avatarKey.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { requirePermission } from '../../middleware/require-permission.js'
import { InstructorProfile } from '../../models/InstructorProfile.js'
import { Cohort } from '../../models/Cohort.js'
import { uploadToS3, IS_S3_CONFIGURED } from '../../lib/s3.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidOid(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

function imageExt(contentType: string): string {
  if (contentType === 'image/png')  return 'png'
  if (contentType === 'image/webp') return 'webp'
  return 'jpg'
}

// ── Zod schemas ────────────────────────────────────────────────────────────

const socialPlatformEnum = z.enum([
  'TWITTER',
  'LINKEDIN',
  'GITHUB',
  'YOUTUBE',
  'WEBSITE',
  'X',
])

const socialLinkSchema = z.object({
  platform: socialPlatformEnum,
  url:      z.string().trim().min(1).max(500),
})

const objectIdString = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid ObjectId.' })

const createProfileSchema = z.object({
  userId:      objectIdString,
  name:        z.string().trim().min(1).max(120),
  title:       z.string().trim().max(200).optional(),
  bio:         z.string().max(5000).optional(),
  socialLinks: z.array(socialLinkSchema).max(5).optional(),
})

const updateProfileSchema = z.object({
  name:        z.string().trim().min(1).max(120).optional(),
  title:       z.string().trim().max(200).optional(),
  bio:         z.string().max(5000).optional(),
  socialLinks: z.array(socialLinkSchema).max(5).optional(),
})

const listQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q:     z.string().trim().optional(),
})

// ── Route plugin ───────────────────────────────────────────────────────────

export async function adminInstructorProfilesRoutes(fastify: FastifyInstance) {

  // GET / — list with pagination + name/title search
  fastify.get<{ Querystring: z.infer<typeof listQuerySchema> }>(
    '/',
    { preHandler: requirePermission('courses:read') },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid query parameters.',
        })
      }
      const { page, limit, q } = parsed.data
      const skip = (page - 1) * limit

      const filter: Record<string, unknown> = {}
      if (q) {
        filter['$or'] = [
          { name:  { $regex: q, $options: 'i' } },
          { title: { $regex: q, $options: 'i' } },
        ]
      }

      const [profiles, total] = await Promise.all([
        InstructorProfile
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean({ virtuals: true }),
        InstructorProfile.countDocuments(filter),
      ])

      return reply.send({
        profiles: profiles.map((p) => ({
          id:          (p as unknown as { _id: Types.ObjectId })._id.toString(),
          userId:      (p.userId as Types.ObjectId).toString(),
          name:        p.name,
          title:       p.title ?? '',
          bio:         p.bio ?? '',
          avatarKey:   p.avatarKey ?? null,
          socialLinks: p.socialLinks ?? [],
          createdAt:   p.createdAt,
          updatedAt:   p.updatedAt,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    },
  )

  // GET /:id — single profile
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('courses:read') },
    async (request, reply) => {
      const { id } = request.params
      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid profile ID.' })
      }

      const profile = await InstructorProfile.findById(id).lean({ virtuals: true })
      if (!profile) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Profile not found.' })
      }

      return reply.send({
        profile: {
          id:          (profile as unknown as { _id: Types.ObjectId })._id.toString(),
          userId:      (profile.userId as Types.ObjectId).toString(),
          name:        profile.name,
          title:       profile.title ?? '',
          bio:         profile.bio ?? '',
          avatarKey:   profile.avatarKey ?? null,
          socialLinks: profile.socialLinks ?? [],
          createdAt:   profile.createdAt,
          updatedAt:   profile.updatedAt,
        },
      })
    },
  )

  // POST / — create
  fastify.post<{ Body: z.infer<typeof createProfileSchema> }>(
    '/',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const parsed = createProfileSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const data = parsed.data

      // Pre-check for a readable 409; the unique index is the hard guarantee.
      const dupe = await InstructorProfile.exists({ userId: data.userId })
      if (dupe) {
        return reply.code(409).send({
          error:   'USERID_CONFLICT',
          message: 'An instructor profile already exists for this user.',
        })
      }

      try {
        const profile = await InstructorProfile.create({
          userId:      new Types.ObjectId(data.userId),
          name:        data.name,
          title:       data.title ?? '',
          bio:         data.bio ?? '',
          socialLinks: data.socialLinks ?? [],
          avatarKey:   null,
        })
        return reply.code(201).send({ profile: profile.toJSON() })
      } catch (err) {
        // Race-safe: catch a duplicate-key error if two concurrent POSTs slip
        // past the exists() check.
        if ((err as { code?: number }).code === 11000) {
          return reply.code(409).send({
            error:   'USERID_CONFLICT',
            message: 'An instructor profile already exists for this user.',
          })
        }
        throw err
      }
    },
  )

  // PATCH /:id — partial update
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof updateProfileSchema> }>(
    '/:id',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { id } = request.params
      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid profile ID.' })
      }

      const parsed = updateProfileSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const data = parsed.data
      const patch: Record<string, unknown> = {}
      if (data.name        !== undefined) patch['name']        = data.name
      if (data.title       !== undefined) patch['title']       = data.title
      if (data.bio         !== undefined) patch['bio']         = data.bio
      if (data.socialLinks !== undefined) patch['socialLinks'] = data.socialLinks

      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: 'NO_CHANGES', message: 'No updateable fields provided.' })
      }

      const profile = await InstructorProfile.findByIdAndUpdate(
        id,
        { $set: patch },
        { new: true, runValidators: true },
      ).lean({ virtuals: true })

      if (!profile) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Profile not found.' })
      }

      return reply.send({ profile })
    },
  )

  // DELETE /:id — hard delete + sweep Cohort.instructorIds refs
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { id } = request.params
      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid profile ID.' })
      }

      const result = await InstructorProfile.deleteOne({ _id: id })
      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Profile not found.' })
      }

      // Sweep every Cohort that referenced this profile. $pull is idempotent
      // so running this against cohorts that don't reference the profile is
      // a no-op — but we still await so callers can rely on consistency.
      await Cohort.updateMany(
        { instructorIds: new Types.ObjectId(id) },
        { $pull: { instructorIds: new Types.ObjectId(id) } },
      )

      return reply.code(204).send()
    },
  )

  // POST /:id/avatar — multipart avatar upload
  fastify.post<{ Params: { id: string } }>(
    '/:id/avatar',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { id } = request.params
      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid profile ID.' })
      }

      const profileExists = await InstructorProfile.exists({ _id: id })
      if (!profileExists) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Profile not found.' })
      }

      let file: import('@fastify/multipart').MultipartFile | undefined
      try {
        file = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } })
      } catch {
        return reply.code(400).send({ error: 'UPLOAD_ERROR', message: 'Could not read uploaded file.' })
      }

      if (!file) {
        return reply.code(400).send({ error: 'NO_FILE', message: 'No file was uploaded.' })
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(file.mimetype)) {
        return reply.code(415).send({
          error:   'UNSUPPORTED_MEDIA_TYPE',
          message: 'Only JPEG, PNG, and WebP images are accepted.',
        })
      }

      const chunks: Buffer[] = []
      for await (const chunk of file.file) {
        chunks.push(chunk as Buffer)
      }
      const body = Buffer.concat(chunks)

      if (body.length > 5 * 1024 * 1024) {
        return reply.code(413).send({ error: 'FILE_TOO_LARGE', message: 'Avatar must be under 5 MB.' })
      }

      const ext = imageExt(file.mimetype)
      const s3Key = `instructor-avatars/${id}/${Date.now()}.${ext}`

      if (IS_S3_CONFIGURED) {
        await uploadToS3(s3Key, body, file.mimetype)
      } else {
        const filePath = resolve(process.cwd(), 'uploads', s3Key)
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, body)
      }

      await InstructorProfile.findByIdAndUpdate(id, { $set: { avatarKey: s3Key } })

      return reply.send({ avatarKey: s3Key })
    },
  )
}
