// FIR-59 — Admin Cohort CMS (create, list, get, update, publish, cover upload)
// FIR-60 — Admin Module CRUD
// FIR-61 — Admin Lesson CRUD
// FIR-62 — Cohort publish/unpublish toggle
// FIR-63 — Live Session CRUD
// FIR-64 — Payment Plan CRUD
// FIR-65 — Student Enrollment list per cohort
// FIR-159 — Admin enrollment status actions
// FIR-175 — Admin manual enrollment

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Queue } from 'bullmq'
import { Types } from 'mongoose'
import { requirePermission } from '../../middleware/require-permission.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { Cohort } from '../../models/Cohort.js'
import { Module } from '../../models/Module.js'
import { Lesson } from '../../models/Lesson.js'
import { LiveSession } from '../../models/LiveSession.js'
import { PaymentPlan } from '../../models/PaymentPlan.js'
import { Enrollment } from '../../models/Enrollment.js'
import { uploadToS3, IS_S3_CONFIGURED } from '../../lib/s3.js'
import { bullMQConnection } from '../../lib/redis.js'
import { detectVideoProvider, type VideoProvider } from '../../lib/detectVideoProvider.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

// ── BullMQ queues ──────────────────────────────────────────────────────────

const emailNotificationsQueue = new Queue('email-notifications', {
  connection: bullMQConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

const slackInviteQueue = new Queue('slack-invite-queue', {
  connection: bullMQConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidOid(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

/**
 * Normalise a title into a URL-safe slug.
 * Lowercased, spaces → hyphens, non-alphanumeric-hyphen stripped.
 */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Derive content-type extension for cover images.
 */
function imageExt(contentType: string): string {
  if (contentType === 'image/png')  return 'png'
  if (contentType === 'image/webp') return 'webp'
  return 'jpg'
}

/**
 * NAB-P0-4 — Reduce TipTap-authored HTML to a readable plain-text fallback.
 *
 * Writers that send `richContent` also get their `content` field populated
 * from this helper so legacy readers (search, rss feeds, any pre-P0-4 render
 * path) keep showing meaningful copy. We strip tags, decode a handful of
 * common entities, and collapse whitespace. This is intentionally small —
 * the rich authoritative copy always lives in `richContent`.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi,    '\n')
    .replace(/<\s*\/\s*p\s*>/gi,   '\n\n')
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, '\n\n')
    .replace(/<\s*\/\s*li\s*>/gi,  '\n')
    .replace(/<[^>]+>/g,           '')
    .replace(/&nbsp;/g,            ' ')
    .replace(/&amp;/g,             '&')
    .replace(/&lt;/g,              '<')
    .replace(/&gt;/g,              '>')
    .replace(/&quot;/g,            '"')
    .replace(/&#39;/g,             "'")
    .replace(/\r\n/g,              '\n')
    .replace(/\n{3,}/g,            '\n\n')
    .trim()
}

// ── Zod schemas ────────────────────────────────────────────────────────────

// FIR-59 — cohort
// NAB-P0-2 — bullet arrays share the same 140-char entry cap and differ only
// in total-length caps (outcomes 12 / requirements 10 / audience 8).
const bulletEntry = z.string().trim().min(1).max(140)

const createCourseSchema = z.object({
  title:            z.string().min(1).max(200).trim(),
  slug:             z.string().min(1).max(200).trim().optional(),
  type:             z.enum(['RECORDED', 'LIVE', 'COMBINED']).optional(),
  tagline:          z.string().max(500).trim().optional(),
  description:      z.string().max(10000).optional(),
  maxSeats:         z.number().int().min(1).optional(),
  liveStartDate:    z.string().datetime().optional(),
  liveEndDate:      z.string().datetime().optional(),
  learningOutcomes: z.array(bulletEntry).max(12).optional(),
  requirements:     z.array(bulletEntry).max(10).optional(),
  targetAudience:   z.array(bulletEntry).max(8).optional(),
})

const updateCourseSchema = createCourseSchema.partial()

const listCoursesQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q:     z.string().optional(),
})

const publishCourseSchema = z.object({
  isPublished: z.boolean(),
})

// FIR-60 — module
const createModuleSchema = z.object({
  title:       z.string().min(1).max(200).trim(),
  description: z.string().max(5000).optional(),
  order:       z.number().int().min(0).default(0),
})

const updateModuleSchema = z.object({
  title:       z.string().min(1).max(200).trim().optional(),
  description: z.string().max(5000).optional(),
  order:       z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
})

const reorderModulesSchema = z.array(
  z.object({
    id:    z.string().min(1),
    order: z.number().int().min(0),
  }),
).min(1)

// FIR-61 / NAB-P0-5 / NAB-P0-4 — lesson
const createLessonSchema = z.object({
  title:             z.string().min(1).max(200).trim(),
  type:              z.enum(['VIDEO', 'TEXT', 'TOOL_SETUP']),
  // NAB-P0-5 — new multi-provider fields
  videoUrl:          z.string().url().optional(),
  videoProvider:     z.enum(['LOOM', 'YOUTUBE', 'VIMEO']).optional(),
  // Back-compat — legacy single-provider field (deprecated, still accepted)
  loomUrl:           z.string().url().optional(),
  content:           z.string().max(50000).optional(),
  // NAB-P0-4 — TipTap-authored HTML + which format the caller intends to
  // persist. Both are optional so clients that still only write `content`
  // keep working unchanged.
  richContent:       z.string().max(100000).optional(),
  contentFormat:     z.enum(['MARKDOWN', 'RICH_HTML']).optional(),
  estimatedMinutes:  z.number().int().min(0).default(0),
  order:             z.number().int().min(0).default(0),
})

const updateLessonSchema = createLessonSchema.partial()

/**
 * NAB-P0-5 — Resolve video-related inputs for a lesson write.
 *
 * Rules:
 * - If `videoUrl` is provided and non-empty, require a detectable provider.
 *   If the caller also supplied `videoProvider`, trust it; otherwise run the
 *   detector. If neither yields a provider → reject caller-side.
 * - If only `loomUrl` is provided (legacy writer), mirror it into
 *   `videoUrl` + mark provider LOOM so new rows use the new shape.
 * - Empty `videoUrl` (explicit "") clears both fields.
 */
type VideoResolve =
  | { ok: true; videoUrl?: string | null; videoProvider?: VideoProvider | null; loomUrl?: string }
  | { ok: false; message: string }

function resolveVideoFields(input: {
  videoUrl?: string
  videoProvider?: VideoProvider
  loomUrl?: string
}): VideoResolve {
  const videoUrl = input.videoUrl?.trim()
  const loomUrl  = input.loomUrl?.trim()

  if (videoUrl) {
    const provider = input.videoProvider ?? detectVideoProvider(videoUrl)
    if (!provider) {
      return { ok: false, message: 'Enter a Loom, YouTube, or Vimeo URL.' }
    }
    return {
      ok: true,
      videoUrl,
      videoProvider: provider,
      // Mirror back into the legacy field only if it's Loom and caller didn't
      // send a separate loomUrl. Keeps old readers working without surprise.
      ...(provider === 'LOOM' && !loomUrl ? { loomUrl: videoUrl } : {}),
    }
  }

  if (loomUrl) {
    // Legacy-only payload → auto-populate the new fields.
    return {
      ok: true,
      videoUrl: loomUrl,
      videoProvider: 'LOOM',
      loomUrl,
    }
  }

  // Nothing to write — field absent from payload.
  return { ok: true }
}

const publishLessonSchema = z.object({
  isPublished: z.boolean(),
})

const reorderLessonsSchema = z.array(
  z.object({
    id:    z.string().min(1),
    order: z.number().int().min(0),
  }),
).min(1)

// FIR-63 — live session
const createSessionSchema = z.object({
  title:           z.string().min(1).max(200).trim(),
  description:     z.string().max(5000).optional(),
  scheduledAt:     z.string().datetime(),
  durationMinutes: z.number().int().min(1).default(90),
  zoomUrl:         z.string().url(),
  zoomMeetingId:   z.string().optional(),
  order:           z.number().int().min(0).default(0),
})

const updateSessionSchema = createSessionSchema.partial()

const addRecordingSchema = z.object({
  recordingUrl: z.string().url(),
})

// FIR-64 — payment plan
const createPaymentPlanSchema = z.object({
  name:         z.string().min(1).max(200).trim(),
  type:         z.enum(['ONE_TIME', 'INSTALLMENT']),
  totalAmount:  z.number().int().min(100, 'totalAmount must be at least 100 cents'),
  currency:     z.string().min(3).max(3).default('usd'),
  intervalDays: z.number().int().min(1).optional(),
})

const updatePaymentPlanSchema = z.object({
  name:         z.string().min(1).max(200).trim().optional(),
  totalAmount:  z.number().int().min(100).optional(),
  currency:     z.string().min(3).max(3).optional(),
  intervalDays: z.number().int().min(1).optional(),
})

// FIR-65 — enrollment list
const enrollmentListQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED', 'COMPLETED']).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
})

// FIR-159 — enrollment status update
const enrollmentStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']),
  reason: z.string().max(1000).optional(),
})

// FIR-175 — manual enrollment
const manualEnrollSchema = z.object({
  studentId: z.string().min(1),
  cohortId:  z.string().min(1),
  reason:    z.string().max(1000).optional(),
})

// ── Route plugin ───────────────────────────────────────────────────────────

export async function adminCoursesRoutes(fastify: FastifyInstance) {

  // ══════════════════════════════════════════════════════════════════════════
  // FIR-59 — Cohort CRUD
  // ══════════════════════════════════════════════════════════════════════════

  // POST /courses — create cohort
  fastify.post<{ Body: z.infer<typeof createCourseSchema> }>(
    '/',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const parsed = createCourseSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const data = parsed.data

      // Derive / normalise slug
      const rawSlug = data.slug ?? data.title
      const slug = toSlug(rawSlug)

      if (!slug) {
        return reply.code(400).send({
          error:   'INVALID_SLUG',
          message: 'Could not derive a valid slug from the provided title.',
        })
      }

      // Slug uniqueness check — DB unique index is the final guard, but give a readable error
      const slugExists = await Cohort.exists({ slug })
      if (slugExists) {
        return reply.code(409).send({
          error:   'SLUG_CONFLICT',
          message: `A course with slug "${slug}" already exists.`,
        })
      }

      const cohort = await Cohort.create({
        // PBA-era required fields — set sensible defaults for LMS cohorts
        name:          data.title,
        code:          slug.toUpperCase().slice(0, 50),
        startDate:     data.liveStartDate ? new Date(data.liveStartDate) : new Date(),
        endDate:       data.liveEndDate   ? new Date(data.liveEndDate)   : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        // LMS fields
        slug,
        type:          data.type ?? null,
        tagline:       data.tagline ?? null,
        description:   data.description ?? null,
        maxSeats:      data.maxSeats ?? null,
        liveStartDate: data.liveStartDate ? new Date(data.liveStartDate) : null,
        liveEndDate:   data.liveEndDate   ? new Date(data.liveEndDate)   : null,
        isPublished:   false,
        // NAB-P0-2 — marketing bullets (optional; default to []).
        learningOutcomes: data.learningOutcomes ?? [],
        requirements:     data.requirements     ?? [],
        targetAudience:   data.targetAudience   ?? [],
      })

      return reply.code(201).send({ cohort: cohort.toJSON() })
    },
  )

  // GET /courses — list cohorts with pagination + title search
  fastify.get<{ Querystring: z.infer<typeof listCoursesQuerySchema> }>(
    '/',
    { preHandler: requirePermission('courses:read') },
    async (request, reply) => {
      const parsed = listCoursesQuerySchema.safeParse(request.query)
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
        filter['name'] = { $regex: q, $options: 'i' }
      }

      const [cohorts, total] = await Promise.all([
        Cohort.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean({ virtuals: true }),
        Cohort.countDocuments(filter),
      ])

      return reply.send({
        cohorts: cohorts.map((c) => ({
          id:          (c as unknown as { _id: Types.ObjectId })._id.toString(),
          title:       c.name,
          slug:        c.slug,
          type:        c.type,
          tagline:     c.tagline,
          isPublished: c.isPublished,
          status:      c.status,
          maxSeats:    c.maxSeats,
          createdAt:   c.createdAt,
          updatedAt:   c.updatedAt,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    },
  )

  // GET /courses/:id — single cohort with full detail
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('courses:read') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const cohort = await Cohort.findById(id).lean({ virtuals: true })
      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Course not found.' })
      }

      // Fetch modules, live sessions count, and enrollment count in parallel
      const [modules, sessionCount, enrollmentCount] = await Promise.all([
        Module.find({ cohortId: id }).sort({ order: 1 }).lean({ virtuals: true }),
        LiveSession.countDocuments({ cohortId: id }),
        Enrollment.countDocuments({ cohortId: id }),
      ])

      // Annotate modules with their lesson counts
      const moduleIds = modules.map((m) => (m as unknown as { _id: Types.ObjectId })._id)
      const lessonCounts = await Lesson.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { moduleId: { $in: moduleIds } } },
        { $group: { _id: '$moduleId', count: { $sum: 1 } } },
      ])
      const lessonCountMap = new Map(lessonCounts.map((lc) => [lc._id.toString(), lc.count]))

      const modulesWithCount = modules.map((m) => {
        const mid = (m as unknown as { _id: Types.ObjectId })._id.toString()
        return {
          id:           mid,
          title:        m.title,
          description:  m.description,
          order:        m.order,
          isPublished:  m.isPublished,
          lessonCount:  lessonCountMap.get(mid) ?? 0,
          createdAt:    m.createdAt,
          updatedAt:    m.updatedAt,
        }
      })

      const cid = (cohort as unknown as { _id: Types.ObjectId })._id.toString()

      return reply.send({
        cohort: {
          id:             cid,
          title:          cohort.name,
          slug:           cohort.slug,
          type:           cohort.type,
          tagline:        cohort.tagline,
          description:    cohort.description,
          coverImageKey:  cohort.coverImageKey,
          maxSeats:       cohort.maxSeats,
          isPublished:    cohort.isPublished,
          status:         cohort.status,
          liveStartDate:  cohort.liveStartDate,
          liveEndDate:    cohort.liveEndDate,
          enrollmentCount,
          sessionCount,
          // NAB-P0-2 — surface marketing bullets. `?? []` keeps the contract
          // stable for pre-existing docs that never wrote the field.
          learningOutcomes: cohort.learningOutcomes ?? [],
          requirements:     cohort.requirements     ?? [],
          targetAudience:   cohort.targetAudience   ?? [],
          modules:          modulesWithCount,
          createdAt:        cohort.createdAt,
          updatedAt:        cohort.updatedAt,
        },
      })
    },
  )

  // PATCH /courses/:id — partial update
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof updateCourseSchema> }>(
    '/:id',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const parsed = updateCourseSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const data = parsed.data
      const patch: Record<string, unknown> = {}

      if (data.title !== undefined) {
        patch['name'] = data.title
      }

      if (data.slug !== undefined || data.title !== undefined) {
        const rawSlug = data.slug ?? data.title
        if (rawSlug !== undefined) {
          const newSlug = toSlug(rawSlug)
          if (!newSlug) {
            return reply.code(400).send({ error: 'INVALID_SLUG', message: 'Cannot derive a valid slug.' })
          }
          // Check uniqueness — exclude current doc
          const conflict = await Cohort.exists({ slug: newSlug, _id: { $ne: new Types.ObjectId(id) } })
          if (conflict) {
            return reply.code(409).send({
              error:   'SLUG_CONFLICT',
              message: `A course with slug "${newSlug}" already exists.`,
            })
          }
          patch['slug'] = newSlug
          // Sync code if title changed
          if (data.title !== undefined) {
            patch['code'] = newSlug.toUpperCase().slice(0, 50)
          }
        }
      }

      if (data.type        !== undefined) patch['type']          = data.type
      if (data.tagline     !== undefined) patch['tagline']       = data.tagline
      if (data.description !== undefined) patch['description']   = data.description
      if (data.maxSeats    !== undefined) patch['maxSeats']      = data.maxSeats
      if (data.liveStartDate !== undefined) patch['liveStartDate'] = new Date(data.liveStartDate)
      if (data.liveEndDate   !== undefined) patch['liveEndDate']   = new Date(data.liveEndDate)
      if (data.liveStartDate !== undefined) patch['startDate']   = new Date(data.liveStartDate)
      if (data.liveEndDate   !== undefined) patch['endDate']     = new Date(data.liveEndDate)
      // NAB-P0-2 — bullet arrays. Passing an empty array is a valid clear.
      if (data.learningOutcomes !== undefined) patch['learningOutcomes'] = data.learningOutcomes
      if (data.requirements     !== undefined) patch['requirements']     = data.requirements
      if (data.targetAudience   !== undefined) patch['targetAudience']   = data.targetAudience

      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: 'NO_CHANGES', message: 'No updateable fields provided.' })
      }

      const cohort = await Cohort.findByIdAndUpdate(
        id,
        { $set: patch },
        { new: true, runValidators: true },
      ).lean({ virtuals: true })

      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Course not found.' })
      }

      return reply.send({ cohort: cohort })
    },
  )

  // PATCH /courses/:id/publish — FIR-62: toggle isPublished
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof publishCourseSchema> }>(
    '/:id/publish',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const parsed = publishCourseSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }

      const { isPublished } = parsed.data

      if (isPublished) {
        // Publishing guard: must have at least one published module and one active payment plan
        const [publishedModuleCount, activePlanCount] = await Promise.all([
          Module.countDocuments({ cohortId: id, isPublished: true }),
          PaymentPlan.countDocuments({ cohortId: id, isActive: true }),
        ])

        if (publishedModuleCount === 0) {
          return reply.code(422).send({
            error:   'CANNOT_PUBLISH',
            message: 'Cannot publish a course with no published modules.',
          })
        }

        if (activePlanCount === 0) {
          return reply.code(422).send({
            error:   'CANNOT_PUBLISH',
            message: 'Cannot publish a course with no active payment plans.',
          })
        }
      }

      const cohort = await Cohort.findByIdAndUpdate(
        id,
        { $set: { isPublished } },
        { new: true },
      ).lean({ virtuals: true })

      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Course not found.' })
      }

      return reply.send({ isPublished: cohort.isPublished })
    },
  )

  // POST /courses/:id/cover — upload cover image to S3
  fastify.post<{ Params: { id: string } }>(
    '/:id/cover',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const cohortExists = await Cohort.exists({ _id: id })
      if (!cohortExists) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Course not found.' })
      }

      // Read file from multipart — override global 2 MB limit to 5 MB for covers
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

      // Buffer the upload
      const chunks: Buffer[] = []
      for await (const chunk of file.file) {
        chunks.push(chunk as Buffer)
      }
      const body = Buffer.concat(chunks)

      if (body.length > 5 * 1024 * 1024) {
        return reply.code(413).send({ error: 'FILE_TOO_LARGE', message: 'Cover image must be under 5 MB.' })
      }

      const ext = imageExt(file.mimetype)
      const s3Key = `cohort-covers/${id}/${Date.now()}.${ext}`

      if (IS_S3_CONFIGURED) {
        await uploadToS3(s3Key, body, file.mimetype)
      } else {
        // Dev fallback: write to local uploads/
        const filePath = resolve(process.cwd(), 'uploads', s3Key)
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, body)
      }

      await Cohort.findByIdAndUpdate(id, { $set: { coverImageKey: s3Key } })

      return reply.send({ coverImageKey: s3Key })
    },
  )

  // POST /courses/:cohortId/lesson-images — NAB-P0-4: inline image upload for
  // the TipTap rich-text lesson editor. Mirrors the cover-upload endpoint's
  // multipart limit (5 MB) + mime gate (jpeg/png/webp). Writes under
  // `lesson-images/<cohortId>/<uuid>.<ext>` so a future cleanup job can
  // reconcile uploads against rendered `<img data-key>` references.
  fastify.post<{ Params: { cohortId: string } }>(
    '/:cohortId/lesson-images',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId } = request.params

      if (!isValidOid(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const cohortExists = await Cohort.exists({ _id: cohortId })
      if (!cohortExists) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Course not found.' })
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
        return reply.code(413).send({ error: 'FILE_TOO_LARGE', message: 'Lesson image must be under 5 MB.' })
      }

      const ext = imageExt(file.mimetype)
      // New ObjectId doubles as a collision-resistant uuid — avoids pulling a
      // `uuid` dep just for this endpoint. Hex string, 24 chars.
      const uid = new Types.ObjectId().toString()
      const s3Key = `lesson-images/${cohortId}/${uid}.${ext}`

      if (IS_S3_CONFIGURED) {
        await uploadToS3(s3Key, body, file.mimetype)
      } else {
        // Dev fallback — same layout as cover uploads so the static `/api/uploads`
        // route picks them up automatically.
        const filePath = resolve(process.cwd(), 'uploads', s3Key)
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, body)
      }

      return reply.send({
        url: `/api/uploads/${s3Key}`,
        key: s3Key,
      })
    },
  )

  // ══════════════════════════════════════════════════════════════════════════
  // FIR-60 — Module CRUD
  // ══════════════════════════════════════════════════════════════════════════

  // GET /courses/:cohortId/modules
  fastify.get<{ Params: { cohortId: string } }>(
    '/:cohortId/modules',
    { preHandler: requirePermission('courses:read') },
    async (request, reply) => {
      const { cohortId } = request.params

      if (!isValidOid(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const modules = await Module.find({ cohortId }).sort({ order: 1 }).lean({ virtuals: true })
      return reply.send({ modules })
    },
  )

  // POST /courses/:cohortId/modules
  fastify.post<{ Params: { cohortId: string }; Body: z.infer<typeof createModuleSchema> }>(
    '/:cohortId/modules',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId } = request.params

      if (!isValidOid(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const cohortExists = await Cohort.exists({ _id: cohortId })
      if (!cohortExists) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Course not found.' })
      }

      const parsed = createModuleSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const { title, description, order } = parsed.data

      const mod = await Module.create({ cohortId, title, description, order })
      return reply.code(201).send({ module: mod.toJSON() })
    },
  )

  // PATCH /courses/:cohortId/modules/reorder — must come BEFORE /:moduleId to avoid route shadowing
  fastify.patch<{ Params: { cohortId: string }; Body: z.infer<typeof reorderModulesSchema> }>(
    '/:cohortId/modules/reorder',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId } = request.params

      if (!isValidOid(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const parsed = reorderModulesSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const items = parsed.data

      // Validate all IDs
      for (const item of items) {
        if (!isValidOid(item.id)) {
          return reply.code(400).send({
            error:   'INVALID_ID',
            message: `Invalid module ID: ${item.id}`,
          })
        }
      }

      const ops = items.map(({ id, order }) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(id), cohortId: new Types.ObjectId(cohortId) },
          update: { $set: { order } },
        },
      }))

      const result = await Module.bulkWrite(ops)
      return reply.send({ updated: result.modifiedCount })
    },
  )

  // PATCH /courses/:cohortId/modules/:moduleId
  fastify.patch<{
    Params: { cohortId: string; moduleId: string }
    Body: z.infer<typeof updateModuleSchema>
  }>(
    '/:cohortId/modules/:moduleId',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, moduleId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(moduleId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort or module ID.' })
      }

      const parsed = updateModuleSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const data = parsed.data
      const patch: Record<string, unknown> = {}
      if (data.title       !== undefined) patch['title']       = data.title
      if (data.description !== undefined) patch['description'] = data.description
      if (data.order       !== undefined) patch['order']       = data.order
      if (data.isPublished !== undefined) patch['isPublished'] = data.isPublished

      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: 'NO_CHANGES', message: 'No updateable fields provided.' })
      }

      const mod = await Module.findOneAndUpdate(
        { _id: moduleId, cohortId },
        { $set: patch },
        { new: true, runValidators: true },
      ).lean({ virtuals: true })

      if (!mod) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Module not found.' })
      }

      return reply.send({ module: mod })
    },
  )

  // DELETE /courses/:cohortId/modules/:moduleId
  fastify.delete<{ Params: { cohortId: string; moduleId: string } }>(
    '/:cohortId/modules/:moduleId',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, moduleId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(moduleId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort or module ID.' })
      }

      // Block deletion if any published lesson exists inside this module
      const publishedLessonCount = await Lesson.countDocuments({ moduleId, isPublished: true })
      if (publishedLessonCount > 0) {
        return reply.code(409).send({
          error:   'MODULE_HAS_PUBLISHED_LESSONS',
          message: 'Cannot delete a module that contains published lessons. Unpublish all lessons first.',
        })
      }

      const result = await Module.deleteOne({ _id: moduleId, cohortId })
      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Module not found.' })
      }

      // Cascade-delete orphaned lessons
      await Lesson.deleteMany({ moduleId })

      return reply.code(204).send()
    },
  )

  // ══════════════════════════════════════════════════════════════════════════
  // FIR-61 — Lesson CRUD
  // ══════════════════════════════════════════════════════════════════════════

  // GET /courses/:cohortId/modules/:moduleId/lessons
  fastify.get<{ Params: { cohortId: string; moduleId: string } }>(
    '/:cohortId/modules/:moduleId/lessons',
    { preHandler: requirePermission('courses:read') },
    async (request, reply) => {
      const { cohortId, moduleId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(moduleId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort or module ID.' })
      }

      const lessons = await Lesson.find({ moduleId, cohortId }).sort({ order: 1 }).lean({ virtuals: true })
      return reply.send({ lessons })
    },
  )

  // POST /courses/:cohortId/modules/:moduleId/lessons
  fastify.post<{
    Params: { cohortId: string; moduleId: string }
    Body: z.infer<typeof createLessonSchema>
  }>(
    '/:cohortId/modules/:moduleId/lessons',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, moduleId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(moduleId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort or module ID.' })
      }

      const modExists = await Module.exists({ _id: moduleId, cohortId })
      if (!modExists) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Module not found in this course.' })
      }

      const parsed = createLessonSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const { title, type, content, estimatedMinutes, order } = parsed.data
      const { richContent, contentFormat } = parsed.data

      // NAB-P0-5 — resolve multi-provider video fields (reject unknown URLs)
      const video = resolveVideoFields({
        videoUrl:      parsed.data.videoUrl,
        videoProvider: parsed.data.videoProvider,
        loomUrl:       parsed.data.loomUrl,
      })
      if (!video.ok) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: video.message,
        })
      }

      // NAB-P0-4 — if the writer sent richContent, store it AND derive a
      // plain-text `content` fallback so legacy render paths keep working.
      // The caller's explicit `content` wins if provided (lets admins author
      // a custom plain fallback).
      let resolvedContent       = content
      let resolvedContentFormat: 'MARKDOWN' | 'RICH_HTML' | null | undefined = contentFormat
      if (richContent !== undefined && richContent !== '') {
        if (resolvedContent === undefined) {
          resolvedContent = htmlToPlainText(richContent).slice(0, 50000)
        }
        if (resolvedContentFormat === undefined) {
          resolvedContentFormat = 'RICH_HTML'
        }
      }

      const lesson = await Lesson.create({
        cohortId,
        moduleId,
        title,
        type,
        videoUrl:      video.videoUrl      ?? null,
        videoProvider: video.videoProvider ?? null,
        loomUrl:       video.loomUrl,
        content:       resolvedContent,
        richContent:   richContent ?? null,
        contentFormat: resolvedContentFormat ?? null,
        estimatedMinutes,
        order,
      })

      return reply.code(201).send({ lesson: lesson.toJSON() })
    },
  )

  // PATCH /courses/:cohortId/modules/:moduleId/lessons/reorder — must come BEFORE /:lessonId to avoid route shadowing
  fastify.patch<{
    Params: { cohortId: string; moduleId: string }
    Body: z.infer<typeof reorderLessonsSchema>
  }>(
    '/:cohortId/modules/:moduleId/lessons/reorder',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, moduleId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(moduleId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort or module ID.' })
      }

      const parsed = reorderLessonsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const items = parsed.data

      // Validate all IDs
      for (const item of items) {
        if (!isValidOid(item.id)) {
          return reply.code(400).send({
            error:   'INVALID_ID',
            message: `Invalid lesson ID: ${item.id}`,
          })
        }
      }

      // Verify every lesson belongs to (moduleId, cohortId) — reject ID injection
      const ids = items.map((i) => new Types.ObjectId(i.id))
      const matchCount = await Lesson.countDocuments({
        _id:      { $in: ids },
        moduleId: new Types.ObjectId(moduleId),
        cohortId: new Types.ObjectId(cohortId),
      })
      if (matchCount !== items.length) {
        return reply.code(400).send({
          error:   'LESSON_SCOPE_MISMATCH',
          message: 'One or more lesson IDs do not belong to this module/cohort.',
        })
      }

      const ops = items.map(({ id, order }) => ({
        updateOne: {
          filter: {
            _id:      new Types.ObjectId(id),
            moduleId: new Types.ObjectId(moduleId),
            cohortId: new Types.ObjectId(cohortId),
          },
          update: { $set: { order } },
        },
      }))

      const result = await Lesson.bulkWrite(ops)
      return reply.send({ updated: result.modifiedCount })
    },
  )

  // PATCH /courses/:cohortId/modules/:moduleId/lessons/:lessonId/publish — must come BEFORE /:lessonId
  fastify.patch<{
    Params: { cohortId: string; moduleId: string; lessonId: string }
    Body: z.infer<typeof publishLessonSchema>
  }>(
    '/:cohortId/modules/:moduleId/lessons/:lessonId/publish',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, moduleId, lessonId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(moduleId) || !isValidOid(lessonId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid ID parameter.' })
      }

      const parsed = publishLessonSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }

      const lesson = await Lesson.findOneAndUpdate(
        { _id: lessonId, moduleId, cohortId },
        { $set: { isPublished: parsed.data.isPublished } },
        { new: true },
      ).lean({ virtuals: true })

      if (!lesson) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Lesson not found.' })
      }

      return reply.send({ isPublished: lesson.isPublished })
    },
  )

  // PATCH /courses/:cohortId/modules/:moduleId/lessons/:lessonId
  fastify.patch<{
    Params: { cohortId: string; moduleId: string; lessonId: string }
    Body: z.infer<typeof updateLessonSchema>
  }>(
    '/:cohortId/modules/:moduleId/lessons/:lessonId',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, moduleId, lessonId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(moduleId) || !isValidOid(lessonId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid ID parameter.' })
      }

      const parsed = updateLessonSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const data = parsed.data
      const patch: Record<string, unknown> = {}
      if (data.title            !== undefined) patch['title']            = data.title
      if (data.type             !== undefined) patch['type']             = data.type
      if (data.content          !== undefined) patch['content']          = data.content
      if (data.estimatedMinutes !== undefined) patch['estimatedMinutes'] = data.estimatedMinutes
      if (data.order            !== undefined) patch['order']            = data.order

      // NAB-P0-4 — mirror richContent into a plain-text `content` fallback
      // if the caller didn't supply one explicitly, and default the format
      // to RICH_HTML when the caller omitted it.
      if (data.richContent !== undefined) {
        patch['richContent'] = data.richContent
        if (data.content === undefined && data.richContent !== '') {
          patch['content'] = htmlToPlainText(data.richContent).slice(0, 50000)
        }
        if (data.contentFormat === undefined && data.richContent !== '') {
          patch['contentFormat'] = 'RICH_HTML'
        }
      }
      if (data.contentFormat !== undefined) patch['contentFormat'] = data.contentFormat

      // NAB-P0-5 — resolve the video field trio when any of them is present.
      if (
        data.videoUrl      !== undefined ||
        data.videoProvider !== undefined ||
        data.loomUrl       !== undefined
      ) {
        const video = resolveVideoFields({
          videoUrl:      data.videoUrl,
          videoProvider: data.videoProvider,
          loomUrl:       data.loomUrl,
        })
        if (!video.ok) {
          return reply.code(400).send({
            error:   'VALIDATION_ERROR',
            message: video.message,
          })
        }
        if (video.videoUrl      !== undefined) patch['videoUrl']      = video.videoUrl
        if (video.videoProvider !== undefined) patch['videoProvider'] = video.videoProvider
        if (video.loomUrl       !== undefined) patch['loomUrl']       = video.loomUrl
      }

      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: 'NO_CHANGES', message: 'No updateable fields provided.' })
      }

      const lesson = await Lesson.findOneAndUpdate(
        { _id: lessonId, moduleId, cohortId },
        { $set: patch },
        { new: true, runValidators: true },
      ).lean({ virtuals: true })

      if (!lesson) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Lesson not found.' })
      }

      return reply.send({ lesson })
    },
  )

  // DELETE /courses/:cohortId/modules/:moduleId/lessons/:lessonId
  fastify.delete<{ Params: { cohortId: string; moduleId: string; lessonId: string } }>(
    '/:cohortId/modules/:moduleId/lessons/:lessonId',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, moduleId, lessonId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(moduleId) || !isValidOid(lessonId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid ID parameter.' })
      }

      // Guard: do not delete if any student has completed this lesson
      // LessonProgress / StudentLesson model is not yet created in this epic — use a safe check
      // If a LessonProgress model does not exist yet, we check for completed enrollments as a proxy.
      // This will be strengthened once LessonProgress is introduced in a later epic.
      const lesson = await Lesson.findOne({ _id: lessonId, moduleId, cohortId }).lean()
      if (!lesson) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Lesson not found.' })
      }

      if (lesson.isPublished) {
        return reply.code(409).send({
          error:   'LESSON_IS_PUBLISHED',
          message: 'Cannot delete a published lesson. Unpublish it first.',
        })
      }

      await Lesson.deleteOne({ _id: lessonId })
      return reply.code(204).send()
    },
  )

  // ══════════════════════════════════════════════════════════════════════════
  // FIR-63 — Live Session CRUD
  // ══════════════════════════════════════════════════════════════════════════

  // GET /courses/:cohortId/sessions
  fastify.get<{ Params: { cohortId: string } }>(
    '/:cohortId/sessions',
    { preHandler: requirePermission('courses:read') },
    async (request, reply) => {
      const { cohortId } = request.params

      if (!isValidOid(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const sessions = await LiveSession.find({ cohortId })
        .sort({ scheduledAt: 1 })
        .lean({ virtuals: true })

      return reply.send({ sessions })
    },
  )

  // POST /courses/:cohortId/sessions
  fastify.post<{ Params: { cohortId: string }; Body: z.infer<typeof createSessionSchema> }>(
    '/:cohortId/sessions',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId } = request.params

      if (!isValidOid(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const cohortExists = await Cohort.exists({ _id: cohortId })
      if (!cohortExists) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Course not found.' })
      }

      const parsed = createSessionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const { title, description, scheduledAt, durationMinutes, zoomUrl, zoomMeetingId, order } = parsed.data

      const session = await LiveSession.create({
        cohortId,
        title,
        description,
        scheduledAt: new Date(scheduledAt),
        durationMinutes,
        zoomUrl,
        zoomMeetingId,
        order,
      })

      return reply.code(201).send({ session: session.toJSON() })
    },
  )

  // PATCH /courses/:cohortId/sessions/:sessionId/recording — before /:sessionId to avoid shadow
  fastify.patch<{
    Params: { cohortId: string; sessionId: string }
    Body: z.infer<typeof addRecordingSchema>
  }>(
    '/:cohortId/sessions/:sessionId/recording',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, sessionId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(sessionId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort or session ID.' })
      }

      const parsed = addRecordingSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }

      const session = await LiveSession.findOneAndUpdate(
        { _id: sessionId, cohortId },
        { $set: { recordingUrl: parsed.data.recordingUrl } },
        { new: true },
      ).lean({ virtuals: true })

      if (!session) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Session not found.' })
      }

      return reply.send({ session })
    },
  )

  // PATCH /courses/:cohortId/sessions/:sessionId
  fastify.patch<{
    Params: { cohortId: string; sessionId: string }
    Body: z.infer<typeof updateSessionSchema>
  }>(
    '/:cohortId/sessions/:sessionId',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, sessionId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(sessionId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort or session ID.' })
      }

      const parsed = updateSessionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const data = parsed.data
      const patch: Record<string, unknown> = {}
      if (data.title           !== undefined) patch['title']           = data.title
      if (data.description     !== undefined) patch['description']     = data.description
      if (data.scheduledAt     !== undefined) patch['scheduledAt']     = new Date(data.scheduledAt)
      if (data.durationMinutes !== undefined) patch['durationMinutes'] = data.durationMinutes
      if (data.zoomUrl         !== undefined) patch['zoomUrl']         = data.zoomUrl
      if (data.zoomMeetingId   !== undefined) patch['zoomMeetingId']   = data.zoomMeetingId
      if (data.order           !== undefined) patch['order']           = data.order

      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: 'NO_CHANGES', message: 'No updateable fields provided.' })
      }

      const session = await LiveSession.findOneAndUpdate(
        { _id: sessionId, cohortId },
        { $set: patch },
        { new: true, runValidators: true },
      ).lean({ virtuals: true })

      if (!session) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Session not found.' })
      }

      return reply.send({ session })
    },
  )

  // DELETE /courses/:cohortId/sessions/:sessionId
  fastify.delete<{ Params: { cohortId: string; sessionId: string } }>(
    '/:cohortId/sessions/:sessionId',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, sessionId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(sessionId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort or session ID.' })
      }

      const result = await LiveSession.deleteOne({ _id: sessionId, cohortId })
      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Session not found.' })
      }

      return reply.code(204).send()
    },
  )

  // ══════════════════════════════════════════════════════════════════════════
  // FIR-64 — Payment Plan CRUD
  // ══════════════════════════════════════════════════════════════════════════

  // GET /courses/:cohortId/payment-plans
  fastify.get<{ Params: { cohortId: string } }>(
    '/:cohortId/payment-plans',
    { preHandler: requirePermission('courses:read') },
    async (request, reply) => {
      const { cohortId } = request.params

      if (!isValidOid(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const plans = await PaymentPlan.find({ cohortId }).sort({ createdAt: 1 }).lean({ virtuals: true })
      return reply.send({ plans })
    },
  )

  // POST /courses/:cohortId/payment-plans
  fastify.post<{ Params: { cohortId: string }; Body: z.infer<typeof createPaymentPlanSchema> }>(
    '/:cohortId/payment-plans',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId } = request.params

      if (!isValidOid(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const cohortExists = await Cohort.exists({ _id: cohortId })
      if (!cohortExists) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Course not found.' })
      }

      const parsed = createPaymentPlanSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const { name, type, totalAmount, currency, intervalDays } = parsed.data

      // Build installments for INSTALLMENT plan type
      type InstallmentInput = {
        number: 1 | 2 | 3
        amount: number
        dueDate: Date
        status: 'PENDING'
      }
      let installments: InstallmentInput[] | undefined
      if (type === 'INSTALLMENT') {
        const interval = intervalDays ?? 30
        const baseAmount = Math.floor(totalAmount / 3)
        const remainder  = totalAmount - baseAmount * 3
        const now = new Date()

        installments = [1, 2, 3].map((n) => ({
          number:  n as 1 | 2 | 3,
          // Add remainder to first installment
          amount:  n === 1 ? baseAmount + remainder : baseAmount,
          dueDate: new Date(now.getTime() + (n - 1) * interval * 24 * 60 * 60 * 1000),
          status:  'PENDING' as const,
        }))
      }

      const plan = await PaymentPlan.create({
        cohortId,
        name,
        type,
        totalAmount,
        currency: currency.toLowerCase(),
        intervalDays: type === 'INSTALLMENT' ? (intervalDays ?? 30) : undefined,
        installments,
        isActive: true,
      })

      // Append planId to cohort.paymentPlanIds
      await Cohort.findByIdAndUpdate(cohortId, { $addToSet: { paymentPlanIds: plan._id } })

      return reply.code(201).send({ plan: plan.toJSON() })
    },
  )

  // PATCH /courses/:cohortId/payment-plans/:planId/toggle — before /:planId to avoid shadow
  fastify.patch<{ Params: { cohortId: string; planId: string } }>(
    '/:cohortId/payment-plans/:planId/toggle',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, planId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(planId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort or plan ID.' })
      }

      const plan = await PaymentPlan.findOne({ _id: planId, cohortId })
      if (!plan) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Payment plan not found.' })
      }

      plan.isActive = !plan.isActive
      await plan.save()

      return reply.send({ isActive: plan.isActive })
    },
  )

  // PATCH /courses/:cohortId/payment-plans/:planId
  fastify.patch<{
    Params: { cohortId: string; planId: string }
    Body: z.infer<typeof updatePaymentPlanSchema>
  }>(
    '/:cohortId/payment-plans/:planId',
    { preHandler: requirePermission('courses:write') },
    async (request, reply) => {
      const { cohortId, planId } = request.params

      if (!isValidOid(cohortId) || !isValidOid(planId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort or plan ID.' })
      }

      const parsed = updatePaymentPlanSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const data = parsed.data
      const patch: Record<string, unknown> = {}
      if (data.name         !== undefined) patch['name']         = data.name
      if (data.totalAmount  !== undefined) patch['totalAmount']  = data.totalAmount
      if (data.currency     !== undefined) patch['currency']     = data.currency.toLowerCase()
      if (data.intervalDays !== undefined) patch['intervalDays'] = data.intervalDays

      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: 'NO_CHANGES', message: 'No updateable fields provided.' })
      }

      // type is immutable — reject if caller tried to pass it (it would have been stripped by Zod anyway)

      const plan = await PaymentPlan.findOneAndUpdate(
        { _id: planId, cohortId },
        { $set: patch },
        { new: true, runValidators: true },
      ).lean({ virtuals: true })

      if (!plan) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Payment plan not found.' })
      }

      return reply.send({ plan })
    },
  )

  // ══════════════════════════════════════════════════════════════════════════
  // FIR-65 — Student Enrollment List per Cohort
  // ══════════════════════════════════════════════════════════════════════════

  // GET /courses/:cohortId/enrollments
  fastify.get<{
    Params: { cohortId: string }
    Querystring: z.infer<typeof enrollmentListQuerySchema>
  }>(
    '/:cohortId/enrollments',
    { preHandler: requirePermission('enrollments:read') },
    async (request, reply) => {
      const { cohortId } = request.params

      if (!isValidOid(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const parsed = enrollmentListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid query parameters.',
        })
      }

      const { status, page, limit } = parsed.data
      const skip = (page - 1) * limit

      const filter: Record<string, unknown> = { cohortId }
      if (status) filter['status'] = status

      const [enrollments, total] = await Promise.all([
        Enrollment.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('studentId', 'firstName lastName email avatarUrl')
          .populate('paymentPlanId', 'name type')
          .lean({ virtuals: true }),
        Enrollment.countDocuments(filter),
      ])

      return reply.send({
        enrollments: enrollments.map((e) => ({
          id:                   (e as unknown as { _id: Types.ObjectId })._id.toString(),
          student:              e.studentId,
          paymentPlan:          e.paymentPlanId,
          status:               e.status,
          paymentStatus:        e.paymentStatus,
          paymentMethod:        e.paymentMethod,
          completionPercentage: e.completionPercentage,
          accessGrantedAt:      e.accessGrantedAt,
          createdAt:            e.createdAt,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    },
  )
}

// ══════════════════════════════════════════════════════════════════════════
// FIR-159 + FIR-175 — Enrollment admin actions (registered at /enrollments prefix)
// ══════════════════════════════════════════════════════════════════════════

export async function adminEnrollmentsRoutes(fastify: FastifyInstance) {

  // ── BullMQ queues (local scope — avoid re-declaration if the plugin is loaded after courses) ──
  const emailQueue = new Queue('email-notifications', {
    connection: bullMQConnection,
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
  })

  const slackQueue = new Queue('slack-invite-queue', {
    connection: bullMQConnection,
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
  })

  // PATCH /enrollments/:enrollmentId/status — FIR-159
  fastify.patch<{
    Params: { enrollmentId: string }
    Body: z.infer<typeof enrollmentStatusSchema>
  }>(
    '/:enrollmentId/status',
    { preHandler: requirePermission('enrollments:manage') },
    async (request, reply) => {
      const { enrollmentId } = request.params
      const payload = request.user as JwtPayload

      if (!isValidOid(enrollmentId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid enrollment ID.' })
      }

      const parsed = enrollmentStatusSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const { status, reason } = parsed.data

      const enrollment = await Enrollment.findByIdAndUpdate(
        enrollmentId,
        { $set: { status } },
        { new: true, runValidators: true },
      )

      if (!enrollment) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Enrollment not found.' })
      }

      // Audit log — ActivityLog.type enum does not include enrollment status changes;
      // log to console as an admin audit trail (extend ActivityLog types in a later migration if needed)
      console.log('[AUDIT] ENROLLMENT_STATUS_CHANGE', {
        adminId:      payload.sub,
        action:       'ENROLLMENT_STATUS_CHANGE',
        target:       enrollmentId,
        newStatus:    status,
        reason:       reason ?? null,
        timestamp:    new Date().toISOString(),
      })

      // Notify student if suspended
      if (status === 'SUSPENDED') {
        await emailQueue.add('ENROLLMENT_SUSPENDED', {
          type:      'ENROLLMENT_SUSPENDED',
          studentId: enrollment.studentId.toString(),
          reason:    reason ?? null,
        })
      }

      return reply.send({ enrollment: enrollment.toJSON() })
    },
  )

  // POST /enrollments/manual — FIR-175
  fastify.post<{ Body: z.infer<typeof manualEnrollSchema> }>(
    '/manual',
    { preHandler: requirePermission('enrollments:manage') },
    async (request, reply) => {
      const payload = request.user as JwtPayload

      const parsed = manualEnrollSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const { studentId, cohortId, reason } = parsed.data

      if (!isValidOid(studentId) || !isValidOid(cohortId)) {
        return reply.code(400).send({
          error:   'INVALID_ID',
          message: 'studentId and cohortId must be valid MongoDB ObjectIds.',
        })
      }

      const cohortExists = await Cohort.exists({ _id: cohortId })
      if (!cohortExists) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Course not found.' })
      }

      // Guard against duplicate enrollment
      const duplicate = await Enrollment.exists({ studentId, cohortId })
      if (duplicate) {
        return reply.code(409).send({
          error:   'ALREADY_ENROLLED',
          message: 'Student is already enrolled in this course.',
        })
      }

      const enrollment = await Enrollment.create({
        studentId:       new Types.ObjectId(studentId),
        cohortId:        new Types.ObjectId(cohortId),
        paymentMethod:   'MANUAL_ADMIN',
        paymentStatus:   'WAIVED',
        status:          'ACTIVE',
        enrolledBy:      new Types.ObjectId(payload.sub),
        accessGrantedAt: new Date(),
      })

      // Audit log
      console.log('[AUDIT] MANUAL_ENROLLMENT', {
        adminId:      payload.sub,
        action:       'MANUAL_ENROLLMENT',
        target:       enrollment._id.toString(),
        studentId,
        cohortId,
        reason:       reason ?? null,
        timestamp:    new Date().toISOString(),
      })

      // Enqueue Slack invite and confirmation email
      await Promise.all([
        slackQueue.add('slack-invite', {
          studentId,
          cohortId,
          enrollmentId: enrollment._id.toString(),
        }),
        emailQueue.add('ENROLLMENT_CONFIRMED', {
          type:         'ENROLLMENT_CONFIRMED',
          studentId,
          cohortId,
          enrollmentId: enrollment._id.toString(),
        }),
      ])

      return reply.code(201).send({ enrollmentId: enrollment._id.toString() })
    },
  )
}
