// FIR-213 — Admin: list all enrollments with filters + pagination
// FIR-214 — Admin: cancel (revoke) an enrollment
// FIR-215 — Admin: transfer enrollment to a different cohort

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import type { PipelineStage } from 'mongoose'
import { authenticate } from '../../middleware/require-admin.js'
import { requirePermission } from '../../middleware/require-permission.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { Enrollment } from '../../models/Enrollment.js'
import { Cohort } from '../../models/Cohort.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidOid(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

// ── Zod schemas ────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page:          z.coerce.number().int().min(1).default(1),
  limit:         z.coerce.number().int().min(1).max(100).default(20),
  status:        z.enum(['ACTIVE', 'SUSPENDED', 'COMPLETED', 'REVOKED']).optional(),
  cohortId:      z.string().optional(),
  paymentStatus: z.enum(['PAID', 'PARTIAL', 'FAILED', 'WAIVED', 'PENDING']).optional(),
  search:        z.string().max(200).trim().optional(),
})

const transferBodySchema = z.object({
  targetCohortId: z.string().min(1),
  reason:         z.string().max(1000).optional(),
})

type ListQuery    = z.infer<typeof listQuerySchema>
type TransferBody = z.infer<typeof transferBodySchema>

// ── Route plugin ──────────────────────────────────────────────────────────

export async function firAdminEnrollmentsRoutes(fastify: FastifyInstance) {

  // ── GET / ── FIR-213: List all enrollments with filters ──────────────────
  fastify.get<{ Querystring: ListQuery }>(
    '/',
    { preHandler: [authenticate, requirePermission('enrollments:read')] },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid query parameters.',
        })
      }

      const { page, limit, status, cohortId, paymentStatus, search } = parsed.data
      const skip = (page - 1) * limit

      // Build match stage — start with direct enrollment filters
      const matchStage: Record<string, unknown> = {}
      if (status)        matchStage['status']        = status
      if (paymentStatus) matchStage['paymentStatus'] = paymentStatus
      if (cohortId) {
        if (!isValidOid(cohortId)) {
          return reply.code(400).send({ error: 'INVALID_ID', message: 'cohortId is not a valid ObjectId.' })
        }
        matchStage['cohortId'] = new Types.ObjectId(cohortId)
      }

      try {
        // Use aggregation to support search by student name/email
        const pipeline: PipelineStage[] = [
          { $match: matchStage },
          {
            $lookup: {
              from:         'users',
              localField:   'studentId',
              foreignField: '_id',
              as:           'student',
            },
          },
          { $unwind: { path: '$student', preserveNullAndEmptyArrays: false } },
          {
            $lookup: {
              from:         'cohorts',
              localField:   'cohortId',
              foreignField: '_id',
              as:           'cohort',
            },
          },
          { $unwind: { path: '$cohort', preserveNullAndEmptyArrays: false } },
        ]

        // Apply name/email search after the lookup
        if (search) {
          const regex = { $regex: search, $options: 'i' }
          pipeline.push({
            $match: {
              $or: [
                { 'student.firstName': regex },
                { 'student.lastName':  regex },
                { 'student.email':     regex },
              ],
            },
          } as PipelineStage)
        }

        // Count before slicing
        const countPipeline: PipelineStage[] = [...pipeline, { $count: 'total' } as PipelineStage]

        pipeline.push(
          { $sort: { createdAt: -1 } } as PipelineStage,
          { $skip: skip } as PipelineStage,
          { $limit: limit } as PipelineStage,
          {
            $project: {
              _id:           1,
              status:        1,
              paymentStatus: 1,
              paymentMethod: 1,
              createdAt:     1,
              updatedAt:     1,
              lessonsCompleted:     1,
              completionPercentage: 1,
              lastActivityAt:       1,
              accessGrantedAt:      1,
              student: {
                _id:       '$student._id',
                email:     '$student.email',
                firstName: '$student.firstName',
                lastName:  '$student.lastName',
              },
              cohort: {
                _id:  '$cohort._id',
                name: '$cohort.name',
                code: '$cohort.code',
              },
            },
          } as PipelineStage,
        )

        const [enrollments, countResult] = await Promise.all([
          Enrollment.aggregate(pipeline),
          Enrollment.aggregate(countPipeline),
        ])

        const total      = (countResult[0] as { total: number } | undefined)?.total ?? 0
        const totalPages = Math.ceil(total / limit)

        return reply.code(200).send({
          enrollments,
          total,
          page,
          totalPages,
        })
      } catch (err) {
        fastify.log.error(err, 'FIR-213 list enrollments error')
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch enrollments.' })
      }
    },
  )

  // ── PATCH /:id/cancel ── FIR-214: Cancel (revoke) an enrollment ──────────
  fastify.patch<{ Params: { id: string } }>(
    '/:id/cancel',
    { preHandler: [authenticate, requirePermission('enrollments:manage')] },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Enrollment id is not a valid ObjectId.' })
      }

      try {
        const enrollment = await Enrollment.findById(id)
        if (!enrollment) {
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Enrollment not found.' })
        }

        if (enrollment.status === 'REVOKED') {
          return reply.code(409).send({ error: 'ALREADY_REVOKED', message: 'Enrollment is already revoked.' })
        }

        enrollment.status = 'REVOKED'
        await enrollment.save()

        return reply.code(200).send({
          message:    'Enrollment revoked successfully.',
          enrollment: enrollment.toJSON(),
        })
      } catch (err) {
        fastify.log.error(err, 'FIR-214 cancel enrollment error')
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to cancel enrollment.' })
      }
    },
  )

  // ── POST /:id/transfer ── FIR-215: Transfer enrollment to a different cohort
  fastify.post<{ Params: { id: string }; Body: TransferBody }>(
    '/:id/transfer',
    { preHandler: [authenticate, requirePermission('enrollments:manage')] },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Enrollment id is not a valid ObjectId.' })
      }

      const parsed = transferBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }

      const { targetCohortId } = parsed.data

      if (!isValidOid(targetCohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'targetCohortId is not a valid ObjectId.' })
      }

      try {
        // Load existing enrollment
        const enrollment = await Enrollment.findById(id)
        if (!enrollment) {
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Enrollment not found.' })
        }

        // Validate target cohort exists
        const targetCohort = await Cohort.findById(targetCohortId).lean()
        if (!targetCohort) {
          return reply.code(404).send({ error: 'COHORT_NOT_FOUND', message: 'Target cohort not found.' })
        }

        // Prevent transfer to the same cohort
        if (enrollment.cohortId.toString() === targetCohortId) {
          return reply.code(409).send({
            error:   'SAME_COHORT',
            message: 'Student is already enrolled in the target cohort.',
          })
        }

        // Check student is not already enrolled in target cohort
        const existingEnrollment = await Enrollment.findOne({
          studentId: enrollment.studentId,
          cohortId:  new Types.ObjectId(targetCohortId),
        }).lean()

        if (existingEnrollment) {
          return reply.code(409).send({
            error:   'ALREADY_ENROLLED',
            message: 'Student is already enrolled in the target cohort.',
          })
        }

        // Revoke current enrollment
        enrollment.status = 'REVOKED'
        await enrollment.save()

        // Identify the acting admin from JWT
        const adminId = (request.user as JwtPayload).sub

        // Create new enrollment in target cohort
        const newEnrollment = await Enrollment.create({
          studentId:     enrollment.studentId,
          cohortId:      new Types.ObjectId(targetCohortId),
          paymentPlanId: enrollment.paymentPlanId,
          paymentMethod: enrollment.paymentMethod,
          paymentStatus: enrollment.paymentStatus,
          status:        'ACTIVE',
          enrolledBy:    new Types.ObjectId(adminId),
          accessGrantedAt: new Date(),
        })

        return reply.code(201).send({
          message:    'Enrollment transferred successfully.',
          enrollment: newEnrollment.toJSON(),
        })
      } catch (err) {
        fastify.log.error(err, 'FIR-215 transfer enrollment error')
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to transfer enrollment.' })
      }
    },
  )
}
