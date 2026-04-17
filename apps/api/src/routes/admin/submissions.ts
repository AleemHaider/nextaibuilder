// PBA-130 — Admin Review Queue API
// GET    /api/admin/submissions          — paginated list, filterable by status/cohort/step
// GET    /api/admin/submissions/stats    — review queue stats (PBA-302)
// GET    /api/admin/submissions/:id      — single submission with student info & screenshot URL
// PATCH  /api/admin/submissions/:id/review — admin approve or reject

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { type JwtPayload } from '../../middleware/require-admin.js'
import { requirePermission } from '../../middleware/require-permission.js'
import { StepSubmission } from '../../models/StepSubmission.js'
import { StudentStep } from '../../models/StudentStep.js'
import { User } from '../../models/User.js'
import { CohortMembership } from '../../models/CohortMembership.js'
import { AuditLog } from '../../models/AuditLog.js'
import { getPresignedReadUrl } from '../../lib/s3.js'
import { emitSubmissionUpdated } from '../../lib/socket.js'
import { checkAndAwardBadges, checkAndAwardCertificate } from '../../services/badges.js'
import { sendStepApprovedEmail, sendStepRejectedEmail } from '../../services/emailService.js'
import { createNotification } from '../../services/notificationService.js'

// ── Validation schemas ─────────────────────────────────────────────────────

const listQuerySchema = z.object({
  status: z
    .enum(['PENDING', 'ML_PROCESSING', 'HUMAN_REVIEW', 'APPROVED', 'REJECTED'])
    .optional(),
  cohortId: z.string().optional(),
  stepId:   z.string().optional(),
  search:   z.string().max(100).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
})

const reviewBodySchema = z.object({
  status:    z.enum(['APPROVED', 'REJECTED']),
  adminNote: z.string().max(2000).optional(),
})

type ListQuery  = z.infer<typeof listQuerySchema>
type ReviewBody = z.infer<typeof reviewBodySchema>

// ── Route plugin ───────────────────────────────────────────────────────────

export async function adminSubmissionsRoutes(fastify: FastifyInstance) {

  // ── GET / ── List submissions ──────────────────────────────────────────
  fastify.get<{ Querystring: Record<string, string> }>(
    '/',
    { preHandler: requirePermission('submissions:read') },
    async (request, reply) => {
      const parseResult = listQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_QUERY',
          message: 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { status, cohortId, stepId, search, page, limit }: ListQuery = parseResult.data
      const skip = (page - 1) * limit

      const filter: Record<string, unknown> = {}
      if (status) filter['status'] = status
      if (stepId)  filter['stepId'] = stepId

      if (cohortId) {
        const memberships = await CohortMembership.find({ cohortId }, { userId: 1 }).lean()
        if (memberships.length === 0) {
          return reply.send({
            submissions: [],
            total:      0,
            page,
            limit,
            totalPages: 0,
          })
        }
        filter['userId'] = { $in: memberships.map((m) => m.userId) }
      }

      // PBA-303 — search by student name or email
      if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        const matchingUsers = await User.find(
          { $or: [{ email: regex }, { firstName: regex }, { lastName: regex }] },
          { _id: 1 },
        ).lean()
        filter['userId'] = { $in: matchingUsers.map((u) => u._id) }
      }

      const [submissions, total] = await Promise.all([
        StepSubmission.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('userId', 'email firstName lastName avatarUrl')
          .populate('stepId', 'title order')
          .lean({ virtuals: true }),
        StepSubmission.countDocuments(filter),
      ])

      return reply.send({
        submissions: submissions.map((s) => {
          const student = s.userId as unknown as {
            _id: unknown; email: string; firstName: string; lastName: string; avatarUrl: string | null
          }
          const step = s.stepId as unknown as {
            _id: unknown; title: string; order: number
          }
          return {
            id:         (s._id as unknown as { toString(): string }).toString(),
            status:     s.status,
            mlScore:    s.mlScore,
            mlFeedback: s.mlFeedback,
            adminNote:  s.reviewNote,
            reviewedAt: s.reviewedAt,
            createdAt:  s.createdAt,
            updatedAt:  s.updatedAt,
            student: {
              id:        student._id ? String(student._id) : undefined,
              email:     student.email,
              firstName: student.firstName,
              lastName:  student.lastName,
              avatarUrl: student.avatarUrl ?? null,
            },
            step: {
              id:    step._id ? String(step._id) : undefined,
              title: step.title,
              order: step.order,
            },
          }
        }),
        // PBA-301: flat pagination fields (no nested pagination object)
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    },
  )

  // ── GET /stats ── Review queue statistics (PBA-302) ────────────────────
  // IMPORTANT: must be registered before GET /:id to avoid ":id" swallowing "stats"
  fastify.get(
    '/stats',
    { preHandler: requirePermission('submissions:read') },
    async (_request, reply) => {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const [totalPending, approvedToday, rejectedToday, mlScoreResult] = await Promise.all([
        StepSubmission.countDocuments({ status: 'HUMAN_REVIEW' }),
        StepSubmission.countDocuments({ status: 'APPROVED', reviewedAt: { $gte: startOfDay } }),
        StepSubmission.countDocuments({ status: 'REJECTED', reviewedAt: { $gte: startOfDay } }),
        StepSubmission.aggregate([
          {
            $match: {
              status: { $in: ['APPROVED', 'REJECTED', 'HUMAN_REVIEW'] },
              mlScore: { $ne: null },
            },
          },
          { $group: { _id: null, avg: { $avg: '$mlScore' } } },
        ]),
      ])

      return reply.send({
        totalPending,
        approvedToday,
        rejectedToday,
        avgMlScore: mlScoreResult[0]?.avg ?? null,
      })
    },
  )

  // ── GET /:id ── Single submission detail ───────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('submissions:read') },
    async (request, reply) => {
      const { id } = request.params

      const submission = await StepSubmission.findById(id)
        .populate('userId',       'email firstName lastName avatarUrl role')
        .populate('stepId',       'title order screenshotCriteria description')
        .populate('reviewedById', 'email firstName lastName')

      if (!submission) {
        return reply.code(404).send({
          error:   'SUBMISSION_NOT_FOUND',
          message: 'Submission not found.',
        })
      }

      // Generate presigned read URL (15 min) — non-fatal if S3 is unconfigured
      let screenshotUrl: string | null = null
      try {
        screenshotUrl = await getPresignedReadUrl(submission.s3Key, 900)
      } catch {
        fastify.log.warn(
          `[admin] Failed to generate presigned URL for s3Key=${submission.s3Key}`,
        )
      }

      const studentStep = await StudentStep.findOne({
        userId: submission.userId,
        stepId: submission.stepId,
      }).lean()

      const student  = submission.userId as unknown as {
        id: string; email: string; firstName: string; lastName: string
        avatarUrl: string | null; role: string
      }
      const step     = submission.stepId as unknown as {
        id: string; title: string; order: number
        screenshotCriteria: string; description: string
      }
      const reviewer = submission.reviewedById as unknown as {
        id: string; email: string; firstName: string; lastName: string
      } | null

      // Guard: if populate failed (referenced doc was deleted), return 500
      if (!student?.email || !step?.title) {
        return reply.code(500).send({
          error:   'POPULATE_FAILED',
          message: 'Submission references a deleted student or step.',
        })
      }

      // PBA-301: flat detail response — merge submission, student, step, reviewedBy into one object
      return reply.send({
        id:           submission.id as string,
        status:       submission.status,
        screenshotUrl,
        mlScore:      submission.mlScore,
        mlFeedback:   submission.mlFeedback,
        mlReasoning:  submission.mlReasoning,
        adminNote:    submission.reviewNote,   // translate reviewNote → adminNote at serializer layer
        reviewedAt:   submission.reviewedAt,
        createdAt:    submission.createdAt,
        updatedAt:    submission.updatedAt,
        student: {
          id:        student.id,
          email:     student.email,
          firstName: student.firstName,
          lastName:  student.lastName,
          avatarUrl: student.avatarUrl ?? null,
          attempts:  studentStep?.attempts ?? 0,
        },
        step: {
          id:                 step.id,
          title:              step.title,
          order:              step.order,
          screenshotCriteria: step.screenshotCriteria,
          description:        step.description,
        },
        attemptCount: studentStep?.attempts ?? 0,
        cohort:       null,   // StepSubmission has no cohortId
        reviewedBy: reviewer
          ? {
              id:        reviewer.id,
              email:     reviewer.email,
              firstName: reviewer.firstName,
              lastName:  reviewer.lastName,
            }
          : null,
      })
    },
  )

  // ── PATCH /:id/review ── Approve or reject ─────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: ReviewBody }>(
    '/:id/review',
    { preHandler: requirePermission('submissions:review') },
    async (request, reply) => {
      const admin = request.user as JwtPayload
      const { id } = request.params

      const parseResult = reviewBodySchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { status: newStatus, adminNote } = parseResult.data

      const submission = await StepSubmission.findById(id)
      if (!submission) {
        return reply.code(404).send({
          error:   'SUBMISSION_NOT_FOUND',
          message: 'Submission not found.',
        })
      }

      if (submission.status === 'ML_PROCESSING') {
        return reply.code(409).send({
          error:   'SUBMISSION_PROCESSING',
          message: 'Submission is still being processed by ML. Please wait.',
        })
      }

      const previousStatus = submission.status

      submission.status       = newStatus
      submission.reviewedById = admin.sub as unknown as typeof submission.reviewedById
      submission.reviewedAt   = new Date()
      submission.reviewNote   = adminNote ?? null
      await submission.save()

      // Cascade to StudentStep
      if (newStatus === 'APPROVED') {
        await StudentStep.findOneAndUpdate(
          { userId: submission.userId, stepId: submission.stepId },
          { status: 'OVERRIDE_PASS', completedAt: new Date() },
          { upsert: true },
        )
      } else {
        await StudentStep.findOneAndUpdate(
          { userId: submission.userId, stepId: submission.stepId },
          { status: 'IN_PROGRESS' },
        )
      }

      // Fire-and-forget badge/certificate check on admin approval (PBA-128)
      if (newStatus === 'APPROVED') {
        const studentId = submission.userId.toString()
        checkAndAwardBadges(studentId).catch((err) =>
          fastify.log.error({ err }, `[admin] checkAndAwardBadges failed for user ${studentId}`),
        )
        checkAndAwardCertificate(studentId).catch((err) =>
          fastify.log.error({ err }, `[admin] checkAndAwardCertificate failed for user ${studentId}`),
        )
      }

      // Fire-and-forget: notify student via email (PBA-134) and in-app (PBA-381)
      {
        const studentId = submission.userId.toString()
        const stepRef   = submission.stepId as unknown as { title?: string }
        const stepTitle = stepRef?.title ?? 'Setup step'

        if (newStatus === 'APPROVED') {
          sendStepApprovedEmail(studentId, stepTitle).catch((err) =>
            fastify.log.error({ err }, `[admin] sendStepApprovedEmail failed for user ${studentId}`),
          )
          void createNotification({
            userId:   studentId,
            type:     'STEP_APPROVED',
            title:    'Step approved',
            body:     `Your submission for "${stepTitle}" has been approved.`,
            linkPath: '/steps',
          })
        } else {
          const feedback = adminNote ?? 'Your submission did not meet the requirements.'
          sendStepRejectedEmail(studentId, stepTitle, feedback).catch((err) =>
            fastify.log.error({ err }, `[admin] sendStepRejectedEmail failed for user ${studentId}`),
          )
          void createNotification({
            userId:   studentId,
            type:     'STEP_REJECTED',
            title:    'Step needs revision',
            body:     `Your submission for "${stepTitle}" needs revision. ${feedback}`,
            linkPath: '/steps',
          })
        }
      }

      // Audit trail
      await AuditLog.create({
        adminId:    admin.sub,
        action:     newStatus === 'APPROVED' ? 'SUBMISSION_APPROVED' : 'SUBMISSION_REJECTED',
        targetType: 'StepSubmission',
        targetId:   id,
        note:       adminNote ?? null,
      })

      // Real-time push to student
      emitSubmissionUpdated(submission.userId.toString(), {
        submissionId: id,
        status:       newStatus,
        mlFeedback:   submission.mlFeedback,
        mlScore:      submission.mlScore,
      })

      fastify.log.info(
        `[admin] submission=${id} reviewed by admin=${admin.sub}: ${previousStatus} → ${newStatus}`,
      )

      return reply.send({
        id:         submission.id as string,
        status:     submission.status,
        reviewedAt: submission.reviewedAt,
        adminNote:  submission.reviewNote,
      })
    },
  )
}
