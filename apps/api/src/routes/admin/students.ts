// PBA-131 — Admin Students API
// GET  /api/admin/students                     — paginated, filterable, searchable student list
// GET  /api/admin/students/:id                 — full student profile with step-by-step progress
// POST /api/admin/students/invite              — invite a student (PBA-282)
// POST /api/admin/students/batch-invite        — batch invite up to 20 students (PBA-365)
// POST /api/admin/students/csv-import          — CSV bulk import up to 100 rows (PBA-366)
// POST /api/admin/students/:id/resend-invite   — resend invite email (PBA-283)
// POST /api/admin/students/:id/revoke-invite   — revoke a pending invite (PBA-284)
// POST /api/admin/students/:id/nudge           — send coach nudge email (PBA-358)
// POST /api/admin/students/:id/transfer        — transfer student to a different cohort (PBA-387)
// POST /api/admin/students/:id/reset-progress  — soft-reset all step progress (PBA-388)
//
// PBA-350 — Replace active/inactive filter with health-status taxonomy
// PBA-351 — computeStudentHealth + health fields on list and detail responses
// PBA-352 — currentStep field on list response
// PBA-362 — submissions array on detail response
// PBA-367 — sortBy / sortDir params on list endpoint

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import crypto from 'node:crypto'
import { requirePermission } from '../../middleware/require-permission.js'
import { User } from '../../models/User.js'
import { Cohort } from '../../models/Cohort.js'
import { CohortMembership } from '../../models/CohortMembership.js'
import { SetupStep } from '../../models/SetupStep.js'
import { StudentStep } from '../../models/StudentStep.js'
import { StepSubmission } from '../../models/StepSubmission.js'
import { ActivityLog } from '../../models/ActivityLog.js'
import { sendEmail, studentInviteTemplate, coachNudgeTemplate } from '../../lib/email.js'
import { getPresignedReadUrl } from '../../lib/s3.js'
import {
  computeStudentHealth,
  type HealthStatus,
  type CohortDeadlineInput,
} from '../../lib/student-health.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { emitProgressReset } from '../../lib/socket.js'

// ── Validation schemas ─────────────────────────────────────────────────────

const inviteStudentSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName:  z.string().min(1).max(100).trim(),
  email:     z.string().email().trim().toLowerCase(),
  cohortId:  z.string().min(1),
})

const listQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  cohortId: z.string().optional(),
  // PBA-350: replaced active/inactive with health-status taxonomy
  status:   z.enum(['on_track', 'at_risk', 'blocked', 'completed']).optional(),
  q:        z.string().max(200).optional(),
  // PBA-367: sort params
  sortBy:   z.enum(['lastActiveAt', 'name', 'progress']).default('lastActiveAt'),
  sortDir:  z.enum(['asc', 'desc']).default('desc'),
})

type ListQuery = z.infer<typeof listQuerySchema>

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

// ── Route plugin ───────────────────────────────────────────────────────────

export async function adminStudentsRoutes(fastify: FastifyInstance) {

  // ── GET / ── List students ─────────────────────────────────────────────
  fastify.get<{ Querystring: Record<string, string> }>(
    '/',
    { preHandler: requirePermission('students:read') },
    async (request, reply) => {
      const parseResult = listQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_QUERY',
          message: 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { page, limit, cohortId, status, q, sortBy, sortDir }: ListQuery = parseResult.data
      const skip = (page - 1) * limit

      // ── Resolve user IDs from cohort filter ──
      let filteredUserIds: Types.ObjectId[] | null = null

      if (cohortId) {
        if (!isValidObjectId(cohortId)) {
          return reply.code(400).send({
            error:   'INVALID_COHORT_ID',
            message: 'Invalid cohortId.',
          })
        }

        const memberships = await CohortMembership.find(
          { cohortId },
          { userId: 1 },
        ).lean()

        filteredUserIds = memberships.map((m) => m.userId as Types.ObjectId)

        if (filteredUserIds.length === 0) {
          return reply.send({
            students: [],
            total: 0, page, limit, totalPages: 0,
          })
        }
      }

      // ── Build User query filter ──
      const userFilter: Record<string, unknown> = { role: 'STUDENT' }

      if (filteredUserIds) {
        userFilter['_id'] = { $in: filteredUserIds }
      }

      if (q && q.trim().length > 0) {
        const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(escaped, 'i')
        userFilter['$or'] = [
          { firstName: regex },
          { lastName:  regex },
          { email:     regex },
        ]
      }

      // PBA-350: health-status filter is computed in-memory (cross-collection);
      // fetch all matching users first, then filter + paginate after health computation.

      const users = await User.find(userFilter, {
        firstName:    1,
        lastName:     1,
        email:        1,
        role:         1,
        avatarUrl:    1,
        lastActiveAt: 1,
        inviteStatus: 1,
        createdAt:    1,
      })
        .lean({ virtuals: true })

      if (users.length === 0) {
        return reply.send({
          students: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        })
      }

      const userIds = users.map(
        (u) => (u as unknown as { _id: Types.ObjectId })._id,
      )

      // Cohort memberships + endDate for health computation (PBA-351)
      const memberships = await CohortMembership.find(
        { userId: { $in: userIds } },
        { userId: 1, cohortId: 1 },
      )
        .populate('cohortId', 'name endDate')
        .lean({ virtuals: true })

      const cohortNameMap     = new Map<string, string>()
      const cohortIdMap       = new Map<string, string>()
      const cohortDeadlineMap = new Map<string, CohortDeadlineInput>()

      for (const m of memberships) {
        const uid = m.userId.toString()
        if (!cohortNameMap.has(uid)) {
          const c = m.cohortId as unknown as {
            name?: string
            _id?: { toString(): string }
            endDate?: Date
          }
          cohortNameMap.set(uid, c?.name ?? 'Unknown')
          cohortIdMap.set(uid, c?._id?.toString() ?? '')
          if (c?.endDate) {
            cohortDeadlineMap.set(uid, { endDate: c.endDate })
          }
        }
      }

      // Completed steps per user
      const completedDocs = await StudentStep.aggregate([
        {
          $match: {
            userId: { $in: userIds },
            status: { $in: ['COMPLETE', 'OVERRIDE_PASS'] },
          },
        },
        { $group: { _id: '$userId', completedSteps: { $sum: 1 } } },
      ])

      const completedMap = new Map(
        completedDocs.map((d) => [d._id.toString(), d.completedSteps as number]),
      )

      // PBA-352: lowest-order incomplete step per user
      const incompleteStepDocs = await StudentStep.aggregate([
        {
          $match: {
            userId: { $in: userIds },
            status: { $in: ['UNLOCKED', 'IN_REVIEW', 'NEEDS_REVISION'] },
          },
        },
        {
          $lookup: {
            from:         'setupsteps',
            localField:   'stepId',
            foreignField: '_id',
            as:           'stepInfo',
          },
        },
        { $unwind: '$stepInfo' },
        { $sort: { 'stepInfo.order': 1 } },
        {
          $group: {
            _id:        '$userId',
            stepNumber: { $first: '$stepInfo.order' },
            title:      { $first: '$stepInfo.title' },
          },
        },
      ])

      const currentStepMap = new Map<string, { stepNumber: number; title: string }>(
        incompleteStepDocs.map((d) => [
          (d._id as Types.ObjectId).toString(),
          { stepNumber: d.stepNumber as number, title: d.title as string },
        ]),
      )

      // Total step count (global)
      const totalSteps = await SetupStep.countDocuments()

      // Build full student rows with health status (PBA-350/351/352)
      type StudentRow = {
        id: string
        firstName: string
        lastName: string
        email: string
        role: string
        avatarUrl: string | null
        joinedAt: Date
        cohort: { id: string; name: string } | null
        completedSteps: number
        totalSteps: number
        progressPercent: number
        lastActiveAt: Date | null
        inviteStatus: string
        healthStatus: HealthStatus
        daysUntilDeadline: number | null
        stepsRemaining: number
        daysSinceActive: number | null
        currentStep: { stepNumber: number; title: string } | null
      }

      const allStudents: StudentRow[] = users.map((u) => {
        const uid            = (u as unknown as { _id: Types.ObjectId })._id.toString()
        const completedSteps = completedMap.get(uid) ?? 0
        const progressPercent = totalSteps > 0
          ? Math.round((completedSteps / totalSteps) * 100)
          : 0

        const health = computeStudentHealth(
          {
            lastActiveAt:   u.lastActiveAt ?? null,
            completedSteps,
            totalSteps,
          },
          cohortDeadlineMap.get(uid) ?? null,
        )

        return {
          id:                uid,
          firstName:         u.firstName,
          lastName:          u.lastName,
          email:             u.email,
          role:              u.role,
          avatarUrl:         u.avatarUrl ?? null,
          joinedAt:          u.createdAt,
          cohort: (() => {
            const name = cohortNameMap.get(uid)
            const id   = cohortIdMap.get(uid)
            return name && id ? { id, name } : null
          })(),
          completedSteps,
          totalSteps,
          progressPercent,
          lastActiveAt:      u.lastActiveAt ?? null,
          inviteStatus:      (u as unknown as { inviteStatus?: string }).inviteStatus ?? 'ACCEPTED',
          healthStatus:      health.healthStatus,
          daysUntilDeadline: health.daysUntilDeadline,
          stepsRemaining:    health.stepsRemaining,
          daysSinceActive:   health.daysSinceActive,
          currentStep:       currentStepMap.get(uid) ?? null,
        }
      })

      // PBA-367: apply sorting before health-status filter
      const dir = sortDir === 'asc' ? 1 : -1
      allStudents.sort((a, b) => {
        if (sortBy === 'name') {
          const lastCmp = a.lastName.localeCompare(b.lastName)
          if (lastCmp !== 0) return lastCmp * dir
          return a.firstName.localeCompare(b.firstName) * dir
        }
        if (sortBy === 'progress') {
          return (a.progressPercent - b.progressPercent) * dir
        }
        // default: lastActiveAt — nulls sort last regardless of direction
        if (a.lastActiveAt === null && b.lastActiveAt === null) return 0
        if (a.lastActiveAt === null) return 1
        if (b.lastActiveAt === null) return -1
        return (a.lastActiveAt.getTime() - b.lastActiveAt.getTime()) * dir
      })

      // PBA-350: apply health status filter in-memory
      const filteredStudents = status
        ? allStudents.filter((s) => s.healthStatus === status)
        : allStudents

      const total    = filteredStudents.length
      const students = filteredStudents.slice(skip, skip + limit)

      return reply.send({
        students,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    },
  )

  // ── GET /:id ── Full student profile ───────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('students:read') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid student ID.' })
      }

      const user = await User.findById(id).lean({ virtuals: true })
      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Student not found.' })
      }

      const userId = (user as unknown as { _id: Types.ObjectId })._id

      // Cohort membership — include endDate for health computation (PBA-351)
      const membership = await CohortMembership.findOne({ userId })
        .populate('cohortId', 'name code status startDate endDate')
        .lean({ virtuals: true })

      const cohortRaw = membership?.cohortId as unknown as {
        _id?: { toString(): string }
        name?: string
        code?: string
        status?: string
        startDate?: Date
        endDate?: Date
      } | null

      const cohortInfo = cohortRaw
        ? {
            id:        cohortRaw._id?.toString() ?? '',
            name:      cohortRaw.name      ?? '',
            code:      cohortRaw.code      ?? '',
            status:    cohortRaw.status    ?? '',
            startDate: cohortRaw.startDate ?? null,
            endDate:   cohortRaw.endDate   ?? null,
            enrolledAt: membership?.enrolledAt ?? null,
          }
        : null

      // All setup steps in order
      const allSteps = await SetupStep.find().sort({ order: 1 }).lean({ virtuals: true })

      if (allSteps.length === 0) {
        return reply.send({
          id:           userId.toString(),
          firstName:    user.firstName,
          lastName:     user.lastName,
          email:        user.email,
          avatarUrl:    user.avatarUrl ?? null,
          role:         user.role,
          lastActiveAt: user.lastActiveAt ?? null,
          joinedAt:     user.createdAt,
          createdAt:    user.createdAt,
          inviteStatus: user.inviteStatus,
          cohort:       cohortInfo,
          progress: {
            completedSteps:    0,
            totalSteps:        0,
            progressPercent:   0,
            healthStatus:      'on_track' as HealthStatus,
            daysUntilDeadline: null,
            stepsRemaining:    0,
            daysSinceActive:   null,
          },
          stepProgress: [],
          submissions:  [],
        })
      }

      const stepIds = allSteps.map(
        (s) => (s as unknown as { _id: Types.ObjectId })._id,
      )

      // PBA-362: fetch ALL submissions + latest-per-step in parallel
      const [studentSteps, latestSubmissions, allSubmissions] = await Promise.all([
        StudentStep.find({ userId, stepId: { $in: stepIds } }).lean(),
        StepSubmission.aggregate([
          { $match: { userId, stepId: { $in: stepIds } } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id:        '$stepId',
              id:         { $first: '$_id' },
              status:     { $first: '$status' },
              mlScore:    { $first: '$mlScore' },
              mlFeedback: { $first: '$mlFeedback' },
              reviewNote: { $first: '$reviewNote' },
              createdAt:  { $first: '$createdAt' },
            },
          },
        ]),
        StepSubmission.find({ userId, stepId: { $in: stepIds } })
          .sort({ createdAt: -1 })
          .populate('stepId', 'title order')
          .populate('reviewedById', 'firstName lastName')
          .lean({ virtuals: true }),
      ])

      const studentStepMap = new Map(
        studentSteps.map((ss) => {
          const raw = ss as unknown as { _id: Types.ObjectId; stepId: { toString(): string } }
          return [raw.stepId.toString(), { ...ss, studentStepId: raw._id.toString() }]
        }),
      )

      const submissionMap = new Map(
        latestSubmissions.map((sub) => [
          (sub._id as Types.ObjectId).toString(),
          sub,
        ]),
      )

      const steps = allSteps.map((step) => {
        const sid       = (step as unknown as { _id: Types.ObjectId })._id.toString()
        const ss        = studentStepMap.get(sid)
        const latestSub = submissionMap.get(sid)

        return {
          studentStepId: ss?.studentStepId ?? null,
          stepId:        sid,
          title:         step.title,
          order:         step.order,
          description:   step.description,
          videoUrl:      step.videoUrl ?? null,
          status:        ss?.status      ?? 'LOCKED',
          attempts:      ss?.attempts    ?? 0,
          unlockedAt:    ss?.unlockedAt  ?? null,
          completedAt:   ss?.completedAt ?? null,
          latestSubmission: latestSub
            ? {
                id:         (latestSub.id as Types.ObjectId).toString(),
                status:     latestSub.status as string,
                mlScore:    latestSub.mlScore as number | null,
                mlFeedback: latestSub.mlFeedback as string | null,
                reviewNote: latestSub.reviewNote as string | null,
                createdAt:  latestSub.createdAt as Date,
              }
            : null,
        }
      })

      const completedSteps = steps.filter(
        (s) => s.status === 'COMPLETE' || s.status === 'OVERRIDE_PASS',
      ).length

      // PBA-351: compute health for the detail view
      const health = computeStudentHealth(
        {
          lastActiveAt:   user.lastActiveAt ?? null,
          completedSteps,
          totalSteps:     allSteps.length,
        },
        cohortRaw?.endDate ? { endDate: cohortRaw.endDate } : null,
      )

      // PBA-362: shape the full submissions array (with presigned screenshot URLs)
      const submissions = await Promise.all(allSubmissions.map(async (sub) => {
        const stepPopulated = sub.stepId as unknown as {
          _id: Types.ObjectId
          title?: string
          order?: number
        }
        const reviewerPopulated = sub.reviewedById as unknown as {
          _id?: Types.ObjectId
          firstName?: string
          lastName?: string
        } | null

        const screenshotUrl = sub.s3Key ? await getPresignedReadUrl(sub.s3Key) : null

        return {
          id:            (sub as unknown as { _id: Types.ObjectId })._id.toString(),
          stepId:        stepPopulated._id.toString(),
          stepTitle:     stepPopulated.title ?? null,
          stepOrder:     stepPopulated.order ?? null,
          s3Key:         sub.s3Key,
          screenshotUrl,
          status:        sub.status,
          mlScore:       sub.mlScore,
          mlFeedback:    sub.mlFeedback,
          mlReasoning:   sub.mlReasoning,
          reviewNote:    sub.reviewNote,
          reviewedAt:    sub.reviewedAt,
          reviewedBy:    reviewerPopulated
            ? {
                id:        reviewerPopulated._id?.toString() ?? null,
                firstName: reviewerPopulated.firstName ?? null,
                lastName:  reviewerPopulated.lastName  ?? null,
              }
            : null,
          createdAt:     sub.createdAt,
        }
      }))

      // Flatten into a single object matching AdminStudentDetail shape
      return reply.send({
        // Top-level student fields (AdminStudent base)
        id:               userId.toString(),
        firstName:        user.firstName,
        lastName:         user.lastName,
        email:            user.email,
        avatarUrl:        user.avatarUrl ?? null,
        role:             user.role,
        lastActiveAt:     user.lastActiveAt ?? null,
        joinedAt:         user.createdAt,
        createdAt:        user.createdAt,
        inviteStatus:     user.inviteStatus,
        inviteAcceptedAt: user.inviteAcceptedAt ?? null,
        cohort:           cohortInfo,
        // AdminStudentDetail extensions
        progress: {
          completedSteps,
          totalSteps:        allSteps.length,
          progressPercent:   allSteps.length > 0
            ? Math.round((completedSteps / allSteps.length) * 100)
            : 0,
          healthStatus:      health.healthStatus,
          daysUntilDeadline: health.daysUntilDeadline,
          stepsRemaining:    health.stepsRemaining,
          daysSinceActive:   health.daysSinceActive,
        },
        stepProgress: steps,
        submissions,
      })
    },
  )

  // ── POST /invite ── PBA-282 ─────────────────────────────────────────────
  fastify.post(
    '/invite',
    { preHandler: requirePermission('students:invite') },
    async (request, reply) => {
      const parseResult = inviteStudentSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { firstName, lastName, email, cohortId } = parseResult.data

      if (!isValidObjectId(cohortId)) {
        return reply.code(400).send({
          error:   'INVALID_COHORT_ID',
          message: 'Invalid cohortId.',
        })
      }

      // Check email uniqueness (any role)
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return reply.code(409).send({
          error:   'EMAIL_CONFLICT',
          message: 'A user with this email already exists.',
        })
      }

      // Validate cohort exists
      const cohort = await Cohort.findById(cohortId).lean()
      if (!cohort) {
        return reply.code(404).send({
          error:   'COHORT_NOT_FOUND',
          message: 'Cohort not found.',
        })
      }

      const passwordSetToken  = crypto.randomBytes(32).toString('hex')
      const passwordSetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

      // Create User then CohortMembership — compensating delete if membership fails
      let newUser: InstanceType<typeof User> | null = null

      try {
        newUser = await User.create({
          firstName,
          lastName,
          email,
          role:              'STUDENT',
          inviteStatus:      'PENDING',
          isActive:          true,
          oauthProvider:     null,
          oauthId:           null,
          passwordSetToken,
          passwordSetExpiry,
        })
      } catch (err) {
        fastify.log.error(err, '[admin/students] invite: failed to create user')
        return reply.code(500).send({
          error:   'INTERNAL_ERROR',
          message: 'Failed to create student invite.',
        })
      }

      try {
        await CohortMembership.create({
          userId:   newUser._id,
          cohortId: new Types.ObjectId(cohortId),
        })
      } catch (err) {
        // Compensating delete — remove the orphaned user
        await User.findByIdAndDelete(newUser._id).catch((e: unknown) =>
          fastify.log.error(e, '[admin/students] invite: failed to clean up orphaned user'),
        )
        fastify.log.error(err, '[admin/students] invite: failed to create cohort membership')
        return reply.code(500).send({
          error:   'INTERNAL_ERROR',
          message: 'Failed to create student invite.',
        })
      }

      // Send invite email fire-and-forget
      const frontendUrl    = process.env.FRONTEND_URL ?? 'http://localhost:5173'
      const setPasswordUrl = `${frontendUrl}/student/accept-invite?token=${passwordSetToken}`
      const cohortName     = (cohort as unknown as { name?: string }).name ?? 'your cohort'

      sendEmail(
        email,
        "You've been invited to Product Builder Academy",
        studentInviteTemplate(firstName, cohortName, setPasswordUrl),
      ).catch((err: unknown) =>
        fastify.log.error(err, '[admin/students] Failed to send student invite email'),
      )

      const u = newUser as InstanceType<typeof User>

      // PBA-360: fire-and-forget activity log
      const inviteActor = request.user as JwtPayload
      ActivityLog.create({
        userId:    u._id,
        actorId:   new Types.ObjectId(inviteActor.sub),
        actorRole: inviteActor.role === 'SUPER_ADMIN' ? 'admin' : 'sub_admin',
        type:      'invite_sent',
        metadata:  { email: u.email },
      }).catch((err: unknown) =>
        fastify.log.error(err, '[admin/students] invite: failed to write ActivityLog'),
      )

      return reply.code(201).send({
        student: {
          id:           u._id.toString(),
          firstName:    u.firstName,
          lastName:     u.lastName,
          email:        u.email,
          cohortId,
          inviteStatus: u.inviteStatus,
        },
      })
    },
  )

  // ── POST /:id/resend-invite ── PBA-283 ──────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/:id/resend-invite',
    { preHandler: requirePermission('students:invite') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid student ID.' })
      }

      const user = await User.findById(id)
      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Student not found.' })
      }

      if (user.inviteStatus === 'ACCEPTED') {
        return reply.code(400).send({
          error:   'INVITE_ALREADY_ACCEPTED',
          message: 'This student has already accepted their invite.',
        })
      }

      if (user.inviteStatus === 'REVOKED') {
        return reply.code(400).send({
          error:   'INVITE_REVOKED',
          message: 'This invite has been revoked and cannot be resent.',
        })
      }

      const passwordSetToken  = crypto.randomBytes(32).toString('hex')
      const passwordSetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await User.findByIdAndUpdate(id, {
        $set: { passwordSetToken, passwordSetExpiry },
      })

      // Fetch cohort name for email
      const membership = await CohortMembership.findOne({ userId: user._id })
        .populate('cohortId', 'name')
        .lean({ virtuals: true })

      const cohortRaw  = membership?.cohortId as unknown as { name?: string } | null
      const cohortName = cohortRaw?.name ?? 'your cohort'

      const frontendUrl    = process.env.FRONTEND_URL ?? 'http://localhost:5173'
      const setPasswordUrl = `${frontendUrl}/student/accept-invite?token=${passwordSetToken}`

      sendEmail(
        user.email,
        "You've been invited to Product Builder Academy",
        studentInviteTemplate(user.firstName, cohortName, setPasswordUrl),
      ).catch((err: unknown) =>
        fastify.log.error(err, '[admin/students] Failed to resend student invite email'),
      )

      return reply.code(200).send({ message: 'Invite resent.' })
    },
  )

  // ── POST /:id/revoke-invite ── PBA-284 ──────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/:id/revoke-invite',
    { preHandler: requirePermission('students:invite') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid student ID.' })
      }

      const user = await User.findById(id)
      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Student not found.' })
      }

      if (user.inviteStatus === 'ACCEPTED') {
        return reply.code(400).send({
          error:   'INVITE_ALREADY_ACCEPTED',
          message: 'Cannot revoke an invite that has already been accepted.',
        })
      }

      await User.findByIdAndUpdate(id, {
        $set: {
          isActive:          false,
          inviteStatus:      'REVOKED',
          passwordSetToken:  null,
          passwordSetExpiry: null,
        },
      })

      // PBA-360: fire-and-forget activity log
      const revokeActor = request.user as JwtPayload
      ActivityLog.create({
        userId:    user._id,
        actorId:   new Types.ObjectId(revokeActor.sub),
        actorRole: revokeActor.role === 'SUPER_ADMIN' ? 'admin' : 'sub_admin',
        type:      'invite_revoked',
        metadata:  {},
      }).catch((err: unknown) =>
        fastify.log.error(err, '[admin/students] revoke-invite: failed to write ActivityLog'),
      )

      return reply.code(200).send({ message: 'Invite revoked.' })
    },
  )

  // ── POST /:id/nudge ── PBA-358 ───────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/:id/nudge',
    { preHandler: requirePermission('students:read') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid student ID.' })
      }

      const user = await User.findById(id)
      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Student not found.' })
      }

      if (user.role !== 'STUDENT') {
        return reply.code(400).send({
          error:   'NOT_A_STUDENT',
          message: 'The specified user is not a student.',
        })
      }

      // Rate-limit: only one nudge per 24-hour window
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
      if (user.lastNudgedAt && Date.now() - user.lastNudgedAt.getTime() < TWENTY_FOUR_HOURS_MS) {
        return reply.code(429).send({
          error:   'RATE_LIMITED',
          message: 'This student was nudged recently. Try again in 24 hours.',
        })
      }

      // Record the nudge timestamp before sending to minimise duplicate sends on retry
      await User.findByIdAndUpdate(id, { $set: { lastNudgedAt: new Date() } })

      sendEmail(
        user.email,
        'A message from your coach at Product Builder Academy',
        coachNudgeTemplate(user.firstName),
      ).catch((err: unknown) =>
        fastify.log.error(err, '[admin/students] Failed to send nudge email'),
      )

      // PBA-360: fire-and-forget activity log
      const nudgeActor = request.user as JwtPayload
      ActivityLog.create({
        userId:    user._id,
        actorId:   new Types.ObjectId(nudgeActor.sub),
        actorRole: nudgeActor.role === 'SUPER_ADMIN' ? 'admin' : 'sub_admin',
        type:      'nudge_sent',
        metadata:  { sentBy: nudgeActor.sub },
      }).catch((err: unknown) =>
        fastify.log.error(err, '[admin/students] nudge: failed to write ActivityLog'),
      )

      return reply.code(200).send({ message: 'Nudge sent.' })
    },
  )

  // ── POST /batch-invite ── PBA-365 ────────────────────────────────────────
  // NOTE: must be registered before /:id routes so Fastify matches the literal
  // segment "batch-invite" before treating it as a param.
  fastify.post(
    '/batch-invite',
    { preHandler: requirePermission('students:invite') },
    async (request, reply) => {
      const batchInviteSchema = z.object({
        emails:   z.array(z.string().email().trim().toLowerCase()).min(1).max(20),
        cohortId: z.string().min(1),
      })

      const parseResult = batchInviteSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { emails, cohortId } = parseResult.data

      if (!isValidObjectId(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_COHORT_ID', message: 'Invalid cohortId.' })
      }

      const cohort = await Cohort.findById(cohortId).lean()
      if (!cohort) {
        return reply.code(404).send({ error: 'COHORT_NOT_FOUND', message: 'Cohort not found.' })
      }

      const cohortName  = (cohort as unknown as { name?: string }).name ?? 'your cohort'

      type InviteResult = {
        email:   string
        status:  'invited' | 'skipped'
        reason?: string
      }

      const results: InviteResult[] = []

      // Process sequentially to avoid race conditions on duplicate emails
      for (const email of emails) {
        const existing = await User.findOne({ email }).lean()
        if (existing) {
          results.push({ email, status: 'skipped', reason: 'already_exists' })
          continue
        }

        const passwordSetToken  = crypto.randomBytes(32).toString('hex')
        const passwordSetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

        // Derive placeholder name from email local-part (e.g. "jane.doe" → "Jane", "Doe")
        const localPart  = email.split('@')[0].replace(/[._+-]/g, ' ').trim()
        const nameParts  = localPart.split(' ').filter(Boolean)
        const firstName  = nameParts[0] ?? 'Student'
        const lastName   = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-'

        let newUser: InstanceType<typeof User> | null = null
        try {
          newUser = await User.create({
            firstName,
            lastName,
            email,
            role:              'STUDENT',
            inviteStatus:      'PENDING',
            isActive:          true,
            oauthProvider:     null,
            oauthId:           null,
            passwordSetToken,
            passwordSetExpiry,
          })
        } catch (err) {
          fastify.log.error(err, `[admin/students] batch-invite: failed to create user for ${email}`)
          results.push({ email, status: 'skipped', reason: 'create_failed' })
          continue
        }

        try {
          await CohortMembership.create({
            userId:   newUser._id,
            cohortId: new Types.ObjectId(cohortId),
          })
        } catch (err) {
          await User.findByIdAndDelete(newUser._id).catch((e: unknown) =>
            fastify.log.error(e, '[admin/students] batch-invite: failed to clean up orphaned user'),
          )
          fastify.log.error(err, `[admin/students] batch-invite: failed to create membership for ${email}`)
          results.push({ email, status: 'skipped', reason: 'create_failed' })
          continue
        }

        // PBA-360: fire-and-forget activity log per invited student
        const batchActor = request.user as JwtPayload
        ActivityLog.create({
          userId:    newUser._id,
          actorId:   new Types.ObjectId(batchActor.sub),
          actorRole: batchActor.role === 'SUPER_ADMIN' ? 'admin' : 'sub_admin',
          type:      'invite_sent',
          metadata:  { email },
        }).catch((err: unknown) =>
          fastify.log.error(err, `[admin/students] batch-invite: failed to write ActivityLog for ${email}`),
        )

        results.push({ email, status: 'invited' })
      }

      const invited = results.filter((r) => r.status === 'invited').length
      const skipped = results.filter((r) => r.status === 'skipped').length
      const errors  = results
        .filter((r) => r.status === 'skipped' && r.reason === 'create_failed')
        .map((r) => r.email)

      return reply.code(200).send({ invited, skipped, errors, results })
    },
  )

  // ── POST /csv-import ── PBA-366 ──────────────────────────────────────────
  fastify.post(
    '/csv-import',
    { preHandler: requirePermission('students:invite') },
    async (request, reply) => {
      // Fastify multipart support — parse the uploaded file
      const data = await (request as unknown as {
        file: () => Promise<{
          filename: string
          mimetype: string
          toBuffer: () => Promise<Buffer>
        } | undefined>
      }).file()

      if (!data) {
        return reply.code(400).send({ error: 'MISSING_FILE', message: 'No file uploaded.' })
      }

      const buffer  = await data.toBuffer()
      const csvText = buffer.toString('utf-8')

      const MAX_ROWS = 100

      // Parse CSV manually — no external packages
      const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

      if (lines.length < 2) {
        return reply.code(400).send({
          error:   'INVALID_CSV',
          message: 'CSV must have a header row and at least one data row.',
        })
      }

      // Validate header row
      const header = lines[0].toLowerCase().split(',').map((h) => h.trim())
      const firstNameIdx = header.indexOf('firstname')
      const lastNameIdx  = header.indexOf('lastname')
      const emailIdx     = header.indexOf('email')

      if (firstNameIdx === -1 || lastNameIdx === -1 || emailIdx === -1) {
        return reply.code(400).send({
          error:   'INVALID_CSV_HEADER',
          message: 'CSV header must contain: firstName, lastName, email',
        })
      }

      const dataLines = lines.slice(1, MAX_ROWS + 1)

      // Validate cohortId from query param or body
      // CSV import requires cohortId passed as a query parameter
      const csvImportQuerySchema = z.object({
        cohortId: z.string().min(1),
      })
      const qParse = csvImportQuerySchema.safeParse(request.query)
      if (!qParse.success) {
        return reply.code(400).send({
          error:   'MISSING_COHORT_ID',
          message: 'cohortId query parameter is required.',
        })
      }

      const { cohortId } = qParse.data

      if (!isValidObjectId(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_COHORT_ID', message: 'Invalid cohortId.' })
      }

      const cohort = await Cohort.findById(cohortId).lean()
      if (!cohort) {
        return reply.code(404).send({ error: 'COHORT_NOT_FOUND', message: 'Cohort not found.' })
      }

      const cohortName  = (cohort as unknown as { name?: string }).name ?? 'your cohort'
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'

      // Simple email regex for row-level validation
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      let imported = 0
      let skipped  = 0
      const errors: { row: number; reason: string }[] = []

      for (let i = 0; i < dataLines.length; i++) {
        const rowNum = i + 2 // 1-based, accounting for header
        const cols   = dataLines[i].split(',').map((c) => c.trim())

        const firstName = cols[firstNameIdx] ?? ''
        const lastName  = cols[lastNameIdx]  ?? ''
        const email     = (cols[emailIdx] ?? '').toLowerCase()

        if (!firstName) {
          errors.push({ row: rowNum, reason: 'Missing firstName' })
          continue
        }
        if (!lastName) {
          errors.push({ row: rowNum, reason: 'Missing lastName' })
          continue
        }
        if (!email || !EMAIL_RE.test(email)) {
          errors.push({ row: rowNum, reason: 'Invalid or missing email' })
          continue
        }

        const existing = await User.findOne({ email }).lean()
        if (existing) {
          skipped++
          continue
        }

        const passwordSetToken  = crypto.randomBytes(32).toString('hex')
        const passwordSetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

        let newUser: InstanceType<typeof User> | null = null
        try {
          newUser = await User.create({
            firstName,
            lastName,
            email,
            role:              'STUDENT',
            inviteStatus:      'PENDING',
            isActive:          true,
            oauthProvider:     null,
            oauthId:           null,
            passwordSetToken,
            passwordSetExpiry,
          })
        } catch (err) {
          fastify.log.error(err, `[admin/students] csv-import: failed to create user row ${rowNum}`)
          errors.push({ row: rowNum, reason: 'Failed to create user' })
          continue
        }

        try {
          await CohortMembership.create({
            userId:   newUser._id,
            cohortId: new Types.ObjectId(cohortId),
          })
        } catch (err) {
          await User.findByIdAndDelete(newUser._id).catch((e: unknown) =>
            fastify.log.error(e, '[admin/students] csv-import: failed to clean up orphaned user'),
          )
          fastify.log.error(err, `[admin/students] csv-import: failed to create membership row ${rowNum}`)
          errors.push({ row: rowNum, reason: 'Failed to create cohort membership' })
          continue
        }

        const setPasswordUrl = `${frontendUrl}/student/accept-invite?token=${passwordSetToken}`
        sendEmail(
          email,
          "You've been invited to Product Builder Academy",
          studentInviteTemplate(firstName, cohortName, setPasswordUrl),
        ).catch((err: unknown) =>
          fastify.log.error(err, `[admin/students] csv-import: failed to send invite row ${rowNum}`),
        )

        imported++
      }

      return reply.code(200).send({ imported, skipped, errors })
    },
  )

  // ── GET /:id/activity-log ── PBA-360 ─────────────────────────────────────
  fastify.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/:id/activity-log',
    { preHandler: requirePermission('students:read') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid student ID.' })
      }

      // Validate student exists
      const student = await User.findById(id, { _id: 1, role: 1 }).lean()
      if (!student || student.role !== 'STUDENT') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Student not found.' })
      }

      const activityLogQuerySchema = z.object({
        page:  z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        type:  z.string().optional(),
      })

      const parseResult = activityLogQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_QUERY',
          message: 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { page, limit, type } = parseResult.data
      const skip = (page - 1) * limit

      const filter: Record<string, unknown> = {
        userId: new Types.ObjectId(id),
      }

      if (type) {
        filter['type'] = type
      }

      const [events, total] = await Promise.all([
        ActivityLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('actorId', 'firstName lastName role')
          .lean({ virtuals: true }),
        ActivityLog.countDocuments(filter),
      ])

      const shaped = events.map((ev) => {
        const actor = ev.actorId as unknown as {
          _id?: unknown
          firstName?: string
          lastName?: string
          role?: string
        } | null

        let actorName: string | null = null
        if (actor && actor.firstName) {
          actorName = `${actor.firstName}${actor.lastName ? ` ${actor.lastName}` : ''}`.trim()
        }

        return {
          id:        (ev as unknown as { _id: Types.ObjectId })._id.toString(),
          type:      ev.type,
          actorName,
          actorRole: ev.actorRole,
          metadata:  ev.metadata,
          createdAt: ev.createdAt,
        }
      })

      return reply.send({
        events: shaped,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    },
  )

  // ── POST /:id/transfer ── PBA-387 — Transfer student to a different cohort ──
  fastify.post<{ Params: { id: string } }>(
    '/:id/transfer',
    { preHandler: requirePermission('students:override') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid student ID.' })
      }

      const transferSchema = z.object({
        cohortId: z.string().min(1),
      })
      const parseResult = transferSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'cohortId is required.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { cohortId } = parseResult.data

      if (!isValidObjectId(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_COHORT_ID', message: 'Invalid cohortId.' })
      }

      const [student, targetCohort] = await Promise.all([
        User.findById(id, { _id: 1, role: 1 }).lean(),
        Cohort.findById(cohortId, { _id: 1, name: 1 }).lean(),
      ])

      if (!student || student.role !== 'STUDENT') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Student not found.' })
      }

      if (!targetCohort) {
        return reply.code(404).send({ error: 'COHORT_NOT_FOUND', message: 'Target cohort not found.' })
      }

      // Find existing membership — required to know fromCohortId
      const membership = await CohortMembership.findOne({ userId: id })
      if (!membership) {
        return reply.code(404).send({ error: 'MEMBERSHIP_NOT_FOUND', message: 'Student is not enrolled in any cohort.' })
      }

      const fromCohortId = membership.cohortId.toString()
      const toCohortId   = (targetCohort as unknown as { _id: Types.ObjectId })._id.toString()

      if (fromCohortId === toCohortId) {
        return reply.code(400).send({ error: 'SAME_COHORT', message: 'Student is already in the target cohort.' })
      }

      // Update membership in-place — keeps existing StudentStep records intact
      membership.cohortId = new Types.ObjectId(cohortId)
      await membership.save()

      // Write ActivityLog — fire-and-forget
      const transferActor = request.user as JwtPayload
      ActivityLog.create({
        userId:    new Types.ObjectId(id),
        actorId:   new Types.ObjectId(transferActor.sub),
        actorRole: transferActor.role === 'SUPER_ADMIN' ? 'admin' : 'sub_admin',
        type:      'cohort_transfer',
        metadata:  { fromCohortId, toCohortId },
      }).catch((err: unknown) =>
        fastify.log.error(err, '[admin/students] transfer: failed to write ActivityLog'),
      )

      fastify.log.info(
        `[admin] Student transfer: student=${id} ${fromCohortId} → ${toCohortId} ` +
        `actor=${transferActor.sub}`,
      )

      return reply.code(200).send({
        message:  'Student transferred successfully.',
        cohortId: toCohortId,
      })
    },
  )

  // ── POST /:id/reset-progress ── PBA-388 — Soft-reset all step progress ──────
  fastify.post<{ Params: { id: string } }>(
    '/:id/reset-progress',
    { preHandler: requirePermission('students:override') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid student ID.' })
      }

      const student = await User.findById(id, { _id: 1, role: 1 }).lean()
      if (!student || student.role !== 'STUDENT') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Student not found.' })
      }

      // Soft-reset: set status to LOCKED, attempts to 0, overrideNote to null
      // Submissions array is intentionally preserved
      const result = await StudentStep.updateMany(
        { userId: new Types.ObjectId(id) },
        {
          $set: {
            status:       'LOCKED',
            attempts:     0,
            completedAt:  null,
            unlockedAt:   null,
          },
        },
      )

      await User.findByIdAndUpdate(id, {
        $set: { progressResetAt: new Date(), lastActiveAt: null }
      })

      const stepsReset = result.modifiedCount

      // PBA-389: Restore Step 1 to the virtual UNLOCKED state (no record = accessible).
      // After updateMany every step has status LOCKED, including Step 1 which has no
      // prerequisites. Deleting its StudentStep record returns it to the natural
      // "no record" state so the student can re-enter the course.
      const membership = await CohortMembership.findOne(
        { userId: new Types.ObjectId(id) },
        { cohortId: 1 },
      ).lean()

      if (membership) {
        const firstStep = await SetupStep.findOne(
          { cohortId: membership.cohortId },
          { _id: 1 },
        )
          .sort({ order: 1 })
          .lean()

        if (firstStep) {
          await StudentStep.deleteOne({
            userId:  new Types.ObjectId(id),
            stepId:  firstStep._id,
          })
        }
      }

      // Write ActivityLog — fire-and-forget
      const resetActor = request.user as JwtPayload
      ActivityLog.create({
        userId:    new Types.ObjectId(id),
        actorId:   new Types.ObjectId(resetActor.sub),
        actorRole: resetActor.role === 'SUPER_ADMIN' ? 'admin' : 'sub_admin',
        type:      'progress_reset',
        metadata:  { stepsReset },
      }).catch((err: unknown) =>
        fastify.log.error(err, '[admin/students] reset-progress: failed to write ActivityLog'),
      )

      fastify.log.info(
        `[admin] Progress reset: student=${id} stepsReset=${stepsReset} actor=${resetActor.sub}`,
      )

      // Notify the student's browser to clear its React Query cache immediately
      emitProgressReset(id)

      return reply.code(200).send({
        message:    'Progress reset successfully.',
        stepsReset,
      })
    },
  )
}
