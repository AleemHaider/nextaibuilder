// PBA-131 — Admin Cohorts API
// GET    /api/admin/cohorts                        — list all cohorts with studentCount
// POST   /api/admin/cohorts                        — create cohort
// GET    /api/admin/cohorts/:id                    — single cohort detail
// PATCH  /api/admin/cohorts/:id                    — update cohort
// GET    /api/admin/cohorts/:id/students           — members with progress
// POST   /api/admin/cohorts/:id/enroll             — enroll a student
// DELETE /api/admin/cohorts/:id/students/:userId   — remove a student

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requireAdmin } from '../../middleware/require-admin.js'
import { requirePermission } from '../../middleware/require-permission.js'
import { Cohort } from '../../models/Cohort.js'
import { CohortMembership } from '../../models/CohortMembership.js'
import { CohortStep } from '../../models/CohortStep.js'
import { StudentStep } from '../../models/StudentStep.js'
import { StepSubmission } from '../../models/StepSubmission.js'
import { User } from '../../models/User.js'

// ── Validation schemas ─────────────────────────────────────────────────────

const createCohortSchema = z.object({
  name:      z.string().min(1).max(200).trim(),
  code:      z.string().min(1).max(50).trim(),
  startDate: z.string().datetime({ message: 'startDate must be an ISO 8601 date-time string' }),
  endDate:   z.string().datetime({ message: 'endDate must be an ISO 8601 date-time string' }),
})

const updateCohortSchema = z.object({
  name:      z.string().min(1).max(200).trim().optional(),
  code:      z.string().min(1).max(50).trim().optional(),
  startDate: z.string().datetime().optional(),
  endDate:   z.string().datetime().optional(),
  status:    z.enum(['DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
})

const enrollSchema = z.object({
  email: z.string().email({ message: 'A valid email address is required.' }),
})

const reorderStepsSchema = z.object({
  stepIds: z.array(z.string().min(1)).min(1),
})

type CreateCohortBody  = z.infer<typeof createCohortSchema>
type UpdateCohortBody  = z.infer<typeof updateCohortSchema>
type EnrollBody        = z.infer<typeof enrollSchema>
type ReorderStepsBody  = z.infer<typeof reorderStepsSchema>

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

// ── Route plugin ───────────────────────────────────────────────────────────

export async function adminCohortsRoutes(fastify: FastifyInstance) {

  // ── GET / ── List cohorts ──────────────────────────────────────────────
  fastify.get(
    '/',
    { preHandler: requirePermission('cohorts:read') },
    async (_request, reply) => {
      const cohorts = await Cohort.find().sort({ createdAt: -1 }).lean({ virtuals: true })

      if (cohorts.length === 0) {
        return reply.send({ cohorts: [] })
      }

      const cohortIds = cohorts.map(
        (c) => (c as unknown as { _id: Types.ObjectId })._id,
      )

      // Student counts per cohort in one aggregation
      const studentCounts = await CohortMembership.aggregate([
        { $match: { cohortId: { $in: cohortIds } } },
        { $group: { _id: '$cohortId', count: { $sum: 1 } } },
      ])

      const countMap = new Map(
        studentCounts.map((s) => [s._id.toString(), s.count as number]),
      )

      const result = cohorts.map((c) => {
        const id = (c as unknown as { _id: Types.ObjectId })._id.toString()
        return {
          id:           id,
          name:         c.name,
          code:         c.code,
          status:       c.status,
          startDate:    c.startDate,
          endDate:      c.endDate,
          studentCount: countMap.get(id) ?? 0,
          createdAt:    c.createdAt,
          updatedAt:    c.updatedAt,
        }
      })

      return reply.send({ cohorts: result })
    },
  )

  // ── POST / ── Create cohort ────────────────────────────────────────────
  fastify.post<{ Body: CreateCohortBody }>(
    '/',
    { preHandler: requirePermission('cohorts:write') },
    async (request, reply) => {
      const parseResult = createCohortSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { name, code, startDate, endDate } = parseResult.data

      if (new Date(endDate) <= new Date(startDate)) {
        return reply.code(400).send({
          error:   'INVALID_DATE_RANGE',
          message: 'endDate must be after startDate.',
        })
      }

      // Duplicate code check (MongoDB unique index will also catch it, but give a nicer error)
      const existing = await Cohort.findOne({ code: code.toUpperCase() }).lean()
      if (existing) {
        return reply.code(409).send({
          error:   'CODE_CONFLICT',
          message: `A cohort with code "${code.toUpperCase()}" already exists.`,
        })
      }

      const cohort = await Cohort.create({
        name,
        code,
        startDate: new Date(startDate),
        endDate:   new Date(endDate),
      })

      return reply.code(201).send({ cohort: cohort.toJSON() })
    },
  )

  // ── GET /:id ── Single cohort ──────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('cohorts:read') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const cohort = await Cohort.findById(id).lean({ virtuals: true })
      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found.' })
      }

      const studentCount = await CohortMembership.countDocuments({ cohortId: id })

      return reply.send({
        cohort: {
          id:           (cohort as unknown as { _id: Types.ObjectId })._id.toString(),
          name:         cohort.name,
          code:         cohort.code,
          status:       cohort.status,
          startDate:    cohort.startDate,
          endDate:      cohort.endDate,
          studentCount,
          createdAt:    cohort.createdAt,
          updatedAt:    cohort.updatedAt,
        },
      })
    },
  )

  // ── PATCH /:id ── Update cohort ────────────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: UpdateCohortBody }>(
    '/:id',
    { preHandler: requirePermission('cohorts:write') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const parseResult = updateCohortSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const updates = parseResult.data

      // Inline permission check: changing status requires cohorts:manage-status in addition
      if (updates.status !== undefined) {
        const manageStatus = requirePermission('cohorts:manage-status')
        await manageStatus(request, reply)
        if (reply.sent) return
      }

      if (updates.startDate && updates.endDate) {
        if (new Date(updates.endDate) <= new Date(updates.startDate)) {
          return reply.code(400).send({
            error:   'INVALID_DATE_RANGE',
            message: 'endDate must be after startDate.',
          })
        }
      }

      const patch: Record<string, unknown> = {}
      if (updates.name)      patch['name']      = updates.name
      if (updates.code)      patch['code']      = updates.code.toUpperCase()
      if (updates.startDate) patch['startDate'] = new Date(updates.startDate)
      if (updates.endDate)   patch['endDate']   = new Date(updates.endDate)
      if (updates.status)    patch['status']    = updates.status

      const cohort = await Cohort.findByIdAndUpdate(
        id,
        { $set: patch },
        { new: true, runValidators: true },
      ).lean({ virtuals: true })

      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found.' })
      }

      return reply.send({
        cohort: {
          id:        (cohort as unknown as { _id: Types.ObjectId })._id.toString(),
          name:      cohort.name,
          code:      cohort.code,
          status:    cohort.status,
          startDate: cohort.startDate,
          endDate:   cohort.endDate,
          createdAt: cohort.createdAt,
          updatedAt: cohort.updatedAt,
        },
      })
    },
  )

  // ── GET /:id/students ── Members with progress ─────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/:id/students',
    { preHandler: requirePermission('cohorts:read') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const cohortExists = await Cohort.exists({ _id: id })
      if (!cohortExists) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found.' })
      }

      const memberships = await CohortMembership.find(
        { cohortId: id },
        { userId: 1, enrolledAt: 1 },
      ).lean()

      if (memberships.length === 0) {
        return reply.send({ students: [] })
      }

      const userIds = memberships.map((m) => m.userId)

      // Fetch users and total step count in parallel
      const [users, totalSteps] = await Promise.all([
        User.find(
          { _id: { $in: userIds } },
          { firstName: 1, lastName: 1, email: 1, avatarUrl: 1, lastActiveAt: 1 },
        ).lean({ virtuals: true }),
        // Total steps for this cohort (via CohortStep) or global SetupStep count as fallback
        CohortStep.countDocuments({ cohortId: id }).then((count) =>
          count > 0 ? count : import('../../models/SetupStep.js').then((m) => m.SetupStep.countDocuments()),
        ),
      ])

      // Completed steps per user (COMPLETE or OVERRIDE_PASS)
      const completedStepDocs = await StudentStep.aggregate([
        {
          $match: {
            userId: { $in: userIds },
            status: { $in: ['COMPLETE', 'OVERRIDE_PASS'] },
          },
        },
        {
          $group: {
            _id: '$userId',
            completedSteps: { $sum: 1 },
          },
        },
      ])

      const completedMap = new Map(
        completedStepDocs.map((d) => [d._id.toString(), d.completedSteps as number]),
      )

      const userMap = new Map(
        users.map((u) => [
          (u as unknown as { _id: Types.ObjectId })._id.toString(),
          u,
        ]),
      )

      const membershipMap = new Map(
        memberships.map((m) => [m.userId.toString(), m]),
      )

      const students = userIds.map((userId) => {
        const uid          = userId.toString()
        const user         = userMap.get(uid)
        const membership   = membershipMap.get(uid)
        const completedSteps = completedMap.get(uid) ?? 0
        const progressPercent = totalSteps > 0
          ? Math.round((completedSteps / (totalSteps as number)) * 100)
          : 0

        return {
          id:              uid,
          firstName:       user?.firstName ?? 'Unknown',
          lastName:        user?.lastName ?? '',
          email:           user?.email ?? '',
          avatarUrl:       user?.avatarUrl ?? null,
          completedSteps,
          totalSteps:      totalSteps as number,
          progressPercent,
          enrolledAt:      membership?.enrolledAt ?? null,
          lastActiveAt:    user?.lastActiveAt ?? null,
        }
      })

      return reply.send({ students })
    },
  )

  // ── POST /:id/enroll ── Enroll a student ───────────────────────────────
  fastify.post<{ Params: { id: string }; Body: EnrollBody }>(
    '/:id/enroll',
    { preHandler: requirePermission('students:enroll') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const parseResult = enrollSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { email } = parseResult.data

      // Look up user by email
      const cohortExists = await Cohort.exists({ _id: id })
      if (!cohortExists) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found.' })
      }

      const userDoc = await User.findOne({ email: email.toLowerCase() }, { _id: 1 }).lean()
      if (!userDoc) {
        return reply.code(404).send({ error: 'USER_NOT_FOUND', message: `No user found with email "${email}".` })
      }

      const userId = (userDoc as unknown as { _id: Types.ObjectId })._id

      // Upsert: create only if not already enrolled
      const existing = await CohortMembership.findOne({ userId, cohortId: id }).lean()
      if (existing) {
        return reply.code(409).send({
          error:   'ALREADY_ENROLLED',
          message: 'Student is already enrolled in this cohort.',
        })
      }

      const membership = await CohortMembership.create({
        userId,
        cohortId: id,
      })

      fastify.log.info(`[admin] Enrolled user=${userId} into cohort=${id}`)

      return reply.code(201).send({
        membership: {
          id:               (membership._id as Types.ObjectId).toString(),
          userId:           membership.userId.toString(),
          cohortId:         membership.cohortId.toString(),
          enrolledAt:       membership.enrolledAt,
          completionStatus: membership.completionStatus,
        },
      })
    },
  )

  // ── POST /:id/steps/reorder ── Reorder steps for a cohort ────────────
  fastify.post<{ Params: { id: string }; Body: ReorderStepsBody }>(
    '/:id/steps/reorder',
    { preHandler: requirePermission('cohorts:manage-steps') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      const parseResult = reorderStepsSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { stepIds } = parseResult.data

      const cohort = await Cohort.findById(id).lean()
      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found.' })
      }

      if ((cohort as unknown as { status: string }).status !== 'DRAFT') {
        return reply.code(409).send({
          error:   'COHORT_NOT_DRAFT',
          message: 'Steps can only be reordered on cohorts in DRAFT status.',
        })
      }

      // Upsert a CohortStep doc for each stepId, setting the order to its array index
      const operations = stepIds.map((stepId, index) => ({
        updateOne: {
          filter: {
            cohortId: new Types.ObjectId(id),
            stepId:   new Types.ObjectId(stepId),
          },
          update: {
            $set: { order: index },
          },
          upsert: true,
        },
      }))

      await CohortStep.bulkWrite(operations)

      fastify.log.info(`[admin] Reordered ${stepIds.length} steps for cohort=${id}`)

      return reply.send({ reordered: stepIds.length })
    },
  )

  // ── DELETE /:id/students/:userId ── Remove a student ──────────────────
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/:id/students/:userId',
    { preHandler: requirePermission('students:remove') },
    async (request, reply) => {
      const { id, userId } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohort ID.' })
      }

      if (!isValidObjectId(userId)) {
        return reply.code(400).send({ error: 'INVALID_USER_ID', message: 'Invalid userId.' })
      }

      const result = await CohortMembership.deleteOne({ cohortId: id, userId })

      if (result.deletedCount === 0) {
        return reply.code(404).send({
          error:   'NOT_FOUND',
          message: 'Membership not found — student may not be enrolled in this cohort.',
        })
      }

      fastify.log.info(`[admin] Removed user=${userId} from cohort=${id}`)

      return reply.code(204).send()
    },
  )
}
