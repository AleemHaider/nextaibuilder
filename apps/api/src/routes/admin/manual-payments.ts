// FIR-47 — Admin: list manual payment requests
// FIR-48 — Admin: approve a manual payment request (creates enrollment)
// FIR-49 — Admin: reject a manual payment request

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Queue } from 'bullmq'
import { Types } from 'mongoose'
import { requireAdmin } from '../../middleware/authenticate.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { ManualPaymentRequest } from '../../models/ManualPaymentRequest.js'
import { Enrollment } from '../../models/Enrollment.js'
import { getPresignedReadUrl } from '../../lib/s3.js'
import { bullMQConnection } from '../../lib/redis.js'

// ── BullMQ queues ─────────────────────────────────────────────────────────
const emailNotificationsQueue = new Queue('email-notifications', {
  connection: bullMQConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

const slackInviteQueue = new Queue('slack-invite-queue', {
  connection: bullMQConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

// ── Zod schemas ───────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ALL']).default('PENDING'),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(50).default(20),
})

const approveBodySchema = z.object({
  note: z.string().max(1000).optional(),
})

const rejectBodySchema = z.object({
  reason: z.string().min(10, 'Rejection reason must be at least 10 characters.').max(1000),
})

type ListQuery   = z.infer<typeof listQuerySchema>
type ApproveBody = z.infer<typeof approveBodySchema>
type RejectBody  = z.infer<typeof rejectBodySchema>

// ── Route plugin ──────────────────────────────────────────────────────────
export async function adminManualPaymentsRoutes(fastify: FastifyInstance) {

  // ── GET / ── FIR-47: List manual payment requests ─────────────────────
  fastify.get<{ Querystring: ListQuery }>(
    '/',
    { preHandler: requireAdmin },
    async (request, reply) => {
      // Validate query params
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid query parameters.',
        })
      }

      const { status, page, limit } = parsed.data

      // Build MongoDB filter — ALL means no status filter
      const filter: Record<string, unknown> = status !== 'ALL' ? { status } : {}

      const [requests, total] = await Promise.all([
        ManualPaymentRequest.find(filter)
          .sort({ createdAt: 1 })          // FIFO review queue — oldest first
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('studentId', 'firstName lastName email avatarUrl')
          .populate('cohortId', 'name slug')
          .lean({ virtuals: true }),
        ManualPaymentRequest.countDocuments(filter),
      ])

      // Generate short-lived (1-hour) presigned GET URLs for each receipt in parallel
      const requestsWithUrls = await Promise.all(
        requests.map(async (req) => {
          const receiptUrl = await getPresignedReadUrl(req.s3Key, 3600).catch(() => null)
          return {
            ...req,
            receiptUrl,
          }
        }),
      )

      return reply.send({
        requests: requestsWithUrls,
        total,
        page,
        limit,
      })
    },
  )

  // ── POST /:id/approve ── FIR-48: Approve a manual payment request ──────
  fastify.post<{ Params: { id: string }; Body: ApproveBody }>(
    '/:id/approve',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { sub: adminId } = request.user as JwtPayload
      const { id } = request.params

      // Validate :id format
      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: 'Invalid request ID.',
        })
      }

      // Validate body
      const parsed = approveBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }

      const { note } = parsed.data

      // Load the request — must exist and be PENDING
      const manualRequest = await ManualPaymentRequest.findOne({
        _id:    new Types.ObjectId(id),
        status: 'PENDING',
      })

      if (!manualRequest) {
        return reply.code(404).send({
          error:   'NOT_FOUND',
          message: 'Manual payment request not found or already reviewed.',
        })
      }

      const now          = new Date()
      const adminObjectId = new Types.ObjectId(adminId)

      // Update ManualPaymentRequest to APPROVED
      manualRequest.status      = 'APPROVED'
      manualRequest.reviewedBy  = adminObjectId
      manualRequest.reviewedAt  = now
      if (note) manualRequest.rejectionReason = note  // reuse field for optional admin note

      // Upsert Enrollment — idempotent: if enrollment already exists, set it to ACTIVE
      const enrollment = await Enrollment.findOneAndUpdate(
        {
          studentId: manualRequest.studentId,
          cohortId:  manualRequest.cohortId,
        },
        {
          $set: {
            paymentMethod:   'MANUAL_RECEIPT',
            paymentStatus:   'PAID',
            status:          'ACTIVE',
            accessGrantedAt: now,
            enrolledBy:      adminObjectId,
            ...(manualRequest.paymentPlanId
              ? { paymentPlanId: manualRequest.paymentPlanId }
              : {}),
          },
          $setOnInsert: {
            studentId:            manualRequest.studentId,
            cohortId:             manualRequest.cohortId,
            lessonsCompleted:     0,
            completionPercentage: 0,
          },
        },
        { upsert: true, new: true },
      )

      // Link enrollment back to the ManualPaymentRequest
      manualRequest.enrollmentId = enrollment._id as Types.ObjectId
      await manualRequest.save()

      const enrollmentId = enrollment._id.toString()
      const studentId    = manualRequest.studentId.toString()
      const cohortId     = manualRequest.cohortId.toString()

      // Enqueue email notification (fire-and-forget)
      emailNotificationsQueue.add('manual-payment-approved', {
        type:      'MANUAL_PAYMENT_APPROVED',
        studentId,
        cohortId,
      }).catch((err: unknown) =>
        fastify.log.error({ err }, '[FIR-48] Failed to enqueue manual-payment-approved notification'),
      )

      // Enqueue Slack invite (fire-and-forget)
      slackInviteQueue.add('invite-to-slack', {
        enrollmentId,
        studentId,
        cohortId,
      }).catch((err: unknown) =>
        fastify.log.error({ err }, '[FIR-48] Failed to enqueue slack-invite-queue job'),
      )

      fastify.log.info(
        { requestId: id, enrollmentId, adminId, studentId, cohortId },
        '[FIR-48] Manual payment approved — enrollment activated',
      )

      return reply.code(200).send({
        success:      true,
        enrollmentId,
      })
    },
  )

  // ── POST /:id/reject ── FIR-49: Reject a manual payment request ────────
  fastify.post<{ Params: { id: string }; Body: RejectBody }>(
    '/:id/reject',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { sub: adminId } = request.user as JwtPayload
      const { id } = request.params

      // Validate :id format
      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: 'Invalid request ID.',
        })
      }

      // Validate body — reason is required and must be meaningful
      const parsed = rejectBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }

      const { reason } = parsed.data

      // Load the request — must exist and be PENDING
      const manualRequest = await ManualPaymentRequest.findOne({
        _id:    new Types.ObjectId(id),
        status: 'PENDING',
      })

      if (!manualRequest) {
        return reply.code(404).send({
          error:   'NOT_FOUND',
          message: 'Manual payment request not found or already reviewed.',
        })
      }

      // Update ManualPaymentRequest to REJECTED
      manualRequest.status          = 'REJECTED'
      manualRequest.reviewedBy      = new Types.ObjectId(adminId)
      manualRequest.reviewedAt      = new Date()
      manualRequest.rejectionReason = reason
      await manualRequest.save()

      const studentId = manualRequest.studentId.toString()
      const cohortId  = manualRequest.cohortId.toString()

      // Enqueue email notification (fire-and-forget)
      emailNotificationsQueue.add('manual-payment-rejected', {
        type:      'MANUAL_PAYMENT_REJECTED',
        studentId,
        cohortId,
        reason,
      }).catch((err: unknown) =>
        fastify.log.error({ err }, '[FIR-49] Failed to enqueue manual-payment-rejected notification'),
      )

      fastify.log.info(
        { requestId: id, adminId, studentId, cohortId },
        '[FIR-49] Manual payment rejected',
      )

      return reply.code(200).send({
        success: true,
      })
    },
  )
}
