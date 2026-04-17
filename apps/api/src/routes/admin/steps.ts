// PBA-136 — Admin Step Library CRUD
// PBA-269 — isActive field + filter active steps from student endpoints
// PBA-271 — Loom URL validation
// PBA-272 — GET /api/admin/steps/:id
// PBA-273 — Max length on description and screenshotCriteria
// PBA-300 — estimatedMinutes, checklist, whyItMatters, quickReferenceChecklist, keyLinks, videoTranscript
// GET    /api/admin/steps         — list all steps sorted by order asc
// GET    /api/admin/steps/:id     — get single step by id
// POST   /api/admin/steps         — create a step
// PATCH  /api/admin/steps/:id     — update a step
// DELETE /api/admin/steps/:id     — delete a step (guarded: not used in active cohort)

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requirePermission } from '../../middleware/require-permission.js'
import { SetupStep } from '../../models/SetupStep.js'
import { CohortStep } from '../../models/CohortStep.js'
import { Cohort } from '../../models/Cohort.js'

// ── Loom URL validator ──────────────────────────────────────────────────────

const loomUrlSchema = z
  .string()
  .url()
  .refine(
    (u) => /^https:\/\/(www\.)?loom\.com\/(share|embed)\/[a-zA-Z0-9]+/.test(u),
    { message: 'videoUrl must be a valid Loom share or embed URL' },
  )
  .nullable()
  .optional()

// ── Validation schemas ─────────────────────────────────────────────────────

const keyLinkSchema = z.object({
  label: z.string().min(1).max(100),
  url:   z.string().url(),
})

const createStepSchema = z.object({
  title:                   z.string().min(1).max(300).trim(),
  description:             z.string().min(1).max(10000).trim(),
  screenshotCriteria:      z.string().min(1).max(600).trim(),
  videoUrl:                loomUrlSchema,
  order:                   z.number().int().min(0).optional(),
  isActive:                z.boolean().optional(),
  estimatedMinutes:        z.number().int().min(1).max(480).nullable().optional(),
  checklist:               z.array(z.string().min(1).max(200)).max(20).optional().default([]),
  whyItMatters:            z.string().max(2000).nullable().optional(),
  quickReferenceChecklist: z.array(z.string().min(1).max(200)).max(20).optional().default([]),
  keyLinks:                z.array(keyLinkSchema).max(10).optional().default([]),
  videoTranscript:         z.string().max(10000).nullable().optional(),
})

const updateStepSchema = z.object({
  title:                   z.string().min(1).max(300).trim().optional(),
  description:             z.string().min(1).max(10000).trim().optional(),
  screenshotCriteria:      z.string().min(1).max(600).trim().optional(),
  videoUrl:                loomUrlSchema,
  order:                   z.number().int().min(0).optional(),
  isActive:                z.boolean().optional(),
  estimatedMinutes:        z.number().int().min(1).max(480).nullable().optional(),
  checklist:               z.array(z.string().min(1).max(200)).max(20).optional(),
  whyItMatters:            z.string().max(2000).nullable().optional(),
  quickReferenceChecklist: z.array(z.string().min(1).max(200)).max(20).optional(),
  keyLinks:                z.array(keyLinkSchema).max(10).optional(),
  videoTranscript:         z.string().max(10000).nullable().optional(),
})

type CreateStepBody = z.infer<typeof createStepSchema>
type UpdateStepBody = z.infer<typeof updateStepSchema>

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

// ── Route plugin ───────────────────────────────────────────────────────────

export async function adminStepsRoutes(fastify: FastifyInstance) {

  // ── GET / ── List all steps ────────────────────────────────────────────
  fastify.get(
    '/',
    { preHandler: requirePermission('steps:read') },
    async (_request, reply) => {
      const steps = await SetupStep.find().sort({ order: 1 })

      return reply.send({ steps: steps.map((s) => s.toJSON()) })
    },
  )

  // ── GET /:id ── Get single step ────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('steps:read') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid step ID.' })
      }

      const step = await SetupStep.findById(id)
      if (!step) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Step not found.' })
      }

      return reply.send({ step: step.toJSON() })
    },
  )

  // ── POST / ── Create step ──────────────────────────────────────────────
  fastify.post<{ Body: CreateStepBody }>(
    '/',
    { preHandler: requirePermission('steps:write') },
    async (request, reply) => {
      const parseResult = createStepSchema.safeParse(request.body)
      if (!parseResult.success) {
        const fieldErrors = parseResult.error.flatten().fieldErrors
        // Emit a specific code for video URL violations
        if (fieldErrors['videoUrl']) {
          return reply.code(400).send({
            error:   'INVALID_VIDEO_URL',
            message: 'videoUrl must be a valid Loom share or embed URL',
            details: fieldErrors,
          })
        }
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: fieldErrors,
        })
      }

      const {
        title, description, screenshotCriteria, videoUrl, order, isActive,
        estimatedMinutes, checklist, whyItMatters, quickReferenceChecklist, keyLinks, videoTranscript,
      } = parseResult.data

      // If order not provided, append at end (max existing order + 1)
      let resolvedOrder = order
      if (resolvedOrder === undefined) {
        const last = await SetupStep.findOne().sort({ order: -1 }).lean()
        resolvedOrder = last
          ? (last as unknown as { order: number }).order + 1
          : 0
      }

      // If a specific order was requested, shift all steps at >= that position up by 1
      if (order !== undefined) {
        await SetupStep.updateMany(
          { order: { $gte: resolvedOrder } },
          { $inc: { order: 1 } },
        )
      }

      const step = await SetupStep.create({
        title,
        description,
        screenshotCriteria,
        videoUrl:                videoUrl ?? null,
        order:                   resolvedOrder,
        isActive:                isActive ?? true,
        estimatedMinutes:        estimatedMinutes ?? null,
        checklist:               checklist ?? [],
        whyItMatters:            whyItMatters ?? null,
        quickReferenceChecklist: quickReferenceChecklist ?? [],
        keyLinks:                keyLinks ?? [],
        videoTranscript:         videoTranscript ?? null,
      })

      fastify.log.info(`[admin] Created SetupStep id=${step._id.toString()} order=${resolvedOrder}`)

      return reply.code(201).send({ step: step.toJSON() })
    },
  )

  // ── PATCH /:id ── Update step ──────────────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: UpdateStepBody }>(
    '/:id',
    { preHandler: requirePermission('steps:write') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid step ID.' })
      }

      const parseResult = updateStepSchema.safeParse(request.body)
      if (!parseResult.success) {
        const fieldErrors = parseResult.error.flatten().fieldErrors
        if (fieldErrors['videoUrl']) {
          return reply.code(400).send({
            error:   'INVALID_VIDEO_URL',
            message: 'videoUrl must be a valid Loom share or embed URL',
            details: fieldErrors,
          })
        }
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: fieldErrors,
        })
      }

      const updates = parseResult.data

      const patch: Record<string, unknown> = {}
      if (updates.title                   !== undefined) patch['title']                   = updates.title
      if (updates.description             !== undefined) patch['description']             = updates.description
      if (updates.screenshotCriteria      !== undefined) patch['screenshotCriteria']      = updates.screenshotCriteria
      if (updates.videoUrl                !== undefined) patch['videoUrl']                = updates.videoUrl
      if (updates.order                   !== undefined) patch['order']                   = updates.order
      if (updates.isActive                !== undefined) patch['isActive']                = updates.isActive
      if (updates.estimatedMinutes        !== undefined) patch['estimatedMinutes']        = updates.estimatedMinutes
      if (updates.checklist               !== undefined) patch['checklist']               = updates.checklist
      if (updates.whyItMatters            !== undefined) patch['whyItMatters']            = updates.whyItMatters
      if (updates.quickReferenceChecklist !== undefined) patch['quickReferenceChecklist'] = updates.quickReferenceChecklist
      if (updates.keyLinks                !== undefined) patch['keyLinks']                = updates.keyLinks
      if (updates.videoTranscript         !== undefined) patch['videoTranscript']         = updates.videoTranscript

      const step = await SetupStep.findByIdAndUpdate(
        id,
        { $set: patch },
        { new: true, runValidators: true },
      )

      if (!step) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Step not found.' })
      }

      return reply.send({ step: step.toJSON() })
    },
  )

  // ── DELETE /:id ── Delete step ─────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('steps:delete') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid step ID.' })
      }

      const stepExists = await SetupStep.exists({ _id: id })
      if (!stepExists) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Step not found.' })
      }

      // Guard: block deletion if this step is referenced by any CohortStep whose cohort is ACTIVE
      const cohortStepDocs = await CohortStep.find({ stepId: id }, { cohortId: 1 }).lean()

      if (cohortStepDocs.length > 0) {
        const cohortIds = cohortStepDocs.map(
          (cs) => (cs as unknown as { cohortId: Types.ObjectId }).cohortId,
        )

        const activeCohort = await Cohort.findOne({
          _id:    { $in: cohortIds },
          status: 'ACTIVE',
        }).lean()

        if (activeCohort) {
          return reply.code(409).send({
            error:   'STEP_IN_ACTIVE_COHORT',
            message: 'This step is assigned to an active cohort and cannot be deleted.',
          })
        }
      }

      await SetupStep.deleteOne({ _id: id })

      fastify.log.info(`[admin] Deleted SetupStep id=${id}`)

      return reply.code(204).send()
    },
  )
}
