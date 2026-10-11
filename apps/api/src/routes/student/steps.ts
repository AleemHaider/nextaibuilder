// PBA-149 — Student Steps & Submissions API
// PBA-300 — New step content fields in GET /steps/:stepId response
// GET    /api/student/steps/:stepId
// POST   /api/student/steps/:stepId/presign
// POST   /api/student/steps/:stepId/submissions
// GET    /api/student/steps/:stepId/submission/latest

/**
 * Converts a Loom share or embed URL to a restricted embed URL.
 * Students receive the embed URL only — never the shareable link.
 */
function toStudentEmbedUrl(videoUrl: string | null): string | null {
  if (!videoUrl) return null
  const match = videoUrl.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/)
  if (!match?.[1]) return null
  return `https://www.loom.com/embed/${match[1]}`
}
import type { FastifyInstance } from 'fastify'
import { requireStudent } from '../../middleware/authenticate.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { SetupStep } from '../../models/SetupStep.js'
import { StudentStep } from '../../models/StudentStep.js'
import { StepSubmission } from '../../models/StepSubmission.js'
import { ActivityLog } from '../../models/ActivityLog.js'
import { User } from '../../models/User.js'
import { s3, BUCKET_NAME, getPresignedReadUrl, buildS3Key, IS_S3_CONFIGURED } from '../../lib/s3.js'
import { buildSignedLocalUploadUrl } from '../../lib/localUploadSigning.js'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Queue } from 'bullmq'
import { bullMQConnection } from '../../lib/redis.js'

const screenshotQueue = new Queue('screenshot-validation-queue', { connection: bullMQConnection })

// Rate limit: max 10 submissions per student per step per day
const DAILY_SUBMISSION_LIMIT = 10

async function getStudentStepStatus(userId: string, stepId: string): Promise<{
  status: string
  studentStepDoc: InstanceType<typeof StudentStep> | null
  isLocked: boolean
}> {
  // PBA-269: only active steps are visible to students
  const allSteps = await SetupStep.find({ isActive: { $ne: false } }).sort({ order: 1 })
  const targetStep = allSteps.find((s) => s.id === stepId)
  if (!targetStep) return { status: 'LOCKED', studentStepDoc: null, isLocked: true }

  const priorSteps = allSteps.filter((s) => s.order < targetStep.order)

  // Audit P1 #13 — previously did N `findOne` calls in a for-loop (one per
  // prior step). Now a single batched query + in-memory check, so the
  // student status endpoint cost is O(1) Mongo round-trips regardless of
  // how many steps the course has.
  if (priorSteps.length > 0) {
    const priorIds = priorSteps.map((s) => s._id)
    const priorRecords = await StudentStep.find({ userId, stepId: { $in: priorIds } })
      .select('stepId status')
      .lean()
    const statusByStepId = new Map<string, string>(
      priorRecords.map((r) => [
        (r.stepId as { toString(): string }).toString(),
        (r as { status: string }).status,
      ]),
    )

    for (const prior of priorSteps) {
      const priorStatus = statusByStepId.get(
        (prior._id as unknown as { toString(): string }).toString(),
      )
      if (!priorStatus || !['COMPLETE', 'OVERRIDE_PASS'].includes(priorStatus)) {
        return { status: 'LOCKED', studentStepDoc: null, isLocked: true }
      }
    }
  }

  const studentStepDoc = await StudentStep.findOne({ userId, stepId })
  const rawStatus = studentStepDoc?.status ?? 'UNLOCKED'
  // Stale LOCKED record left by reset — prerequisites are met so treat as UNLOCKED
  const status = rawStatus === 'LOCKED' ? 'UNLOCKED' : rawStatus
  return { status, studentStepDoc, isLocked: false }
}

export async function stepsRoutes(fastify: FastifyInstance) {
  // GET /api/student/steps/:stepId
  fastify.get<{ Params: { stepId: string } }>(
    '/steps/:stepId',
    { preHandler: requireStudent },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const { stepId } = request.params

      const step = await SetupStep.findById(stepId)
      if (!step) return reply.code(404).send({ error: 'STEP_NOT_FOUND', message: 'Step not found.' })

      const { status, isLocked } = await getStudentStepStatus(user.sub, stepId)
      if (isLocked) {
        return reply.code(403).send({ error: 'STEP_LOCKED', message: 'Complete the previous step to unlock this one.' })
      }

      // Fetch latest submission — exclude stale pre-reset submissions (PBA-397)
      const userForReset = await User.findById(user.sub, { progressResetAt: 1 }).lean()
      const submissionFilter: Record<string, unknown> = { userId: user.sub, stepId }
      if (userForReset?.progressResetAt) {
        submissionFilter.createdAt = { $gt: userForReset.progressResetAt }
      }
      const latestSubmission = await StepSubmission.findOne(
        submissionFilter,
        null,
        { sort: { createdAt: -1 } },
      )

      // Find prev/next step IDs — only among active steps
      const allSteps = await SetupStep.find({ isActive: { $ne: false } }).sort({ order: 1 })
      const idx = allSteps.findIndex((s) => s.id === stepId)
      const prevStepId = idx > 0 ? allSteps[idx - 1].id : null
      const nextStepId = idx < allSteps.length - 1 ? allSteps[idx + 1].id : null

      return reply.send({
        step: {
          id:                      step.id,
          title:                   step.title,
          order:                   step.order,
          description:             step.description,
          videoUrl:                toStudentEmbedUrl(step.videoUrl),
          screenshotCriteria:      step.screenshotCriteria,
          estimatedMinutes:        step.estimatedMinutes,
          checklist:               step.checklist,
          whyItMatters:            step.whyItMatters,
          quickReferenceChecklist: step.quickReferenceChecklist,
          keyLinks:                step.keyLinks,
          videoTranscript:         step.videoTranscript,
          status,
          latestSubmission: latestSubmission
            ? {
                id: latestSubmission.id,
                status: latestSubmission.status,
                mlFeedback: latestSubmission.mlFeedback,
                createdAt: latestSubmission.createdAt,
              }
            : null,
        },
        prevStepId,
        nextStepId,
      })
    },
  )

  // POST /api/student/steps/:stepId/presign
  fastify.post<{ Params: { stepId: string }; Body: { contentType?: string } }>(
    '/steps/:stepId/presign',
    { preHandler: requireStudent },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const { stepId } = request.params
      const { contentType } = request.body ?? {}

      // Validate step exists
      const step = await SetupStep.findById(stepId)
      if (!step) return reply.code(404).send({ error: 'STEP_NOT_FOUND', message: 'Step not found.' })

      // Validate step is not locked
      const { isLocked } = await getStudentStepStatus(user.sub, stepId)
      if (isLocked) {
        return reply.code(403).send({ error: 'STEP_LOCKED', message: 'Step is locked.' })
      }

      // Check no existing PENDING/ML_PROCESSING submission
      const existingPending = await StepSubmission.findOne({
        userId: user.sub,
        stepId,
        status: { $in: ['PENDING', 'ML_PROCESSING', 'HUMAN_REVIEW'] },
      })
      if (existingPending) {
        return reply.code(409).send({
          error: 'PENDING_SUBMISSION_EXISTS',
          message: 'A submission is already under review for this step.',
        })
      }

      // Count submissions today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayCount = await StepSubmission.countDocuments({
        userId: user.sub,
        stepId,
        createdAt: { $gte: todayStart },
      })
      if (todayCount >= DAILY_SUBMISSION_LIMIT) {
        return reply.code(429).send({ error: 'RATE_LIMIT', message: 'Maximum 10 submissions per step per day.' })
      }

      // Fetch attempt count
      const totalAttempts = await StepSubmission.countDocuments({ userId: user.sub, stepId })
      const s3Key = buildS3Key(user.sub, stepId, totalAttempts + 1)

      const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
      const resolvedContentType =
        contentType && ALLOWED_TYPES.includes(contentType) ? contentType : 'image/jpeg'

      // When S3 is not configured (dev), point to local upload endpoint with a
      // short-lived signature (mirrors the S3 presign — the raw endpoint is
      // otherwise an open, unauthenticated write).
      if (!IS_S3_CONFIGURED) {
        const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000'
        const presignedUrl = buildSignedLocalUploadUrl(apiBase, s3Key, 300)
        return reply.send({ presignedUrl, s3Key, contentType: resolvedContentType })
      }

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        ContentType: resolvedContentType,
      })
      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }) // 5 min

      return reply.send({ presignedUrl, s3Key, contentType: resolvedContentType })
    },
  )

  // POST /api/student/steps/:stepId/submissions
  fastify.post<{ Params: { stepId: string }; Body: { s3Key: string } }>(
    '/steps/:stepId/submissions',
    { preHandler: requireStudent },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const { stepId } = request.params
      const { s3Key } = request.body ?? {}

      if (!s3Key) {
        return reply.code(400).send({ error: 'MISSING_S3_KEY', message: 's3Key is required.' })
      }

      // CRIT-3: Validate the S3 key belongs to this user and step to prevent IDOR.
      // Keys are in the form: {prefix}screenshots/{userId}/{stepId}/... (prefix may be empty)
      const keyPrefix = process.env.S3_KEY_PREFIX ? `${process.env.S3_KEY_PREFIX}/` : ''
      const expectedPrefix = `${keyPrefix}screenshots/${user.sub}/${stepId}/`
      if (!s3Key.startsWith(expectedPrefix)) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'Invalid S3 key.' })
      }

      // Validate step
      const step = await SetupStep.findById(stepId)
      if (!step) return reply.code(404).send({ error: 'STEP_NOT_FOUND', message: 'Step not found.' })

      const { isLocked } = await getStudentStepStatus(user.sub, stepId)
      if (isLocked) {
        return reply.code(403).send({ error: 'STEP_LOCKED', message: 'Step is locked.' })
      }

      // 409 if already pending
      const existingPending = await StepSubmission.findOne({
        userId: user.sub,
        stepId,
        status: { $in: ['PENDING', 'ML_PROCESSING', 'HUMAN_REVIEW'] },
      })
      if (existingPending) {
        return reply.code(409).send({
          error: 'PENDING_SUBMISSION_EXISTS',
          message: 'A submission is already under review for this step.',
        })
      }

      // Upsert StudentStep record (PENDING_REVIEW)
      let studentStepDoc = await StudentStep.findOne({ userId: user.sub, stepId })
      if (!studentStepDoc) {
        studentStepDoc = await StudentStep.create({
          userId: user.sub,
          stepId,
          status: 'PENDING_REVIEW',
          attempts: 1,
          unlockedAt: new Date(),
        })
      } else {
        studentStepDoc.status = 'PENDING_REVIEW'
        studentStepDoc.attempts = (studentStepDoc.attempts ?? 0) + 1
        await studentStepDoc.save()
      }

      // Create submission record
      const submission = await StepSubmission.create({
        userId: user.sub,
        stepId,
        studentStepId: studentStepDoc._id,
        s3Key,
        status: 'PENDING',
      })

      // Enqueue ML validation job
      await screenshotQueue.add('validate-screenshot', {
        submissionId: submission.id as string,
        s3Key,
        stepId,
        userId: user.sub,
      })

      // PBA-360: fire-and-forget activity log
      ActivityLog.create({
        userId:    user.sub,
        actorId:   user.sub,
        actorRole: 'student',
        type:      'screenshot_submitted',
        metadata:  {
          stepId,
          stepOrder: step.order,
          submissionId: submission.id as string,
        },
      }).catch((err: unknown) =>
        fastify.log.error(err, '[student/steps] screenshot_submitted: failed to write ActivityLog'),
      )

      return reply.code(201).send({
        submissionId: submission.id,
        status: 'PENDING',
      })
    },
  )

  // GET /api/student/steps/:stepId/submission/latest
  fastify.get<{ Params: { stepId: string } }>(
    '/steps/:stepId/submission/latest',
    { preHandler: requireStudent },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const { stepId } = request.params

      const submission = await StepSubmission.findOne(
        { userId: user.sub, stepId },
        null,
        { sort: { createdAt: -1 } },
      )

      if (!submission) {
        return reply.code(404).send({ error: 'NO_SUBMISSION', message: 'No submission found for this step.' })
      }

      // Generate presigned GET URL for screenshot
      const screenshotUrl = await getPresignedReadUrl(submission.s3Key, 300)

      return reply.send({
        submission: {
          id: submission.id,
          status: submission.status,
          mlFeedback: submission.mlFeedback,
          mlScore: submission.mlScore,
          screenshotUrl,
          createdAt: submission.createdAt,
          reviewedAt: submission.reviewedAt,
        },
      })
    },
  )
}
