// PBA-131 — Admin Dashboard Stats API
// GET /api/admin/stats     — summary counters for the dashboard
// GET /api/admin/at-risk   — students with no submission in the last 7 days

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requirePermission } from '../../middleware/require-permission.js'
import { User } from '../../models/User.js'
import { Cohort } from '../../models/Cohort.js'
import { CohortMembership } from '../../models/CohortMembership.js'
import { StudentStep } from '../../models/StudentStep.js'
import { StepSubmission } from '../../models/StepSubmission.js'
import { SetupStep } from '../../models/SetupStep.js'
import { Types } from 'mongoose'

// ── Validation schemas ─────────────────────────────────────────────────────

const atRiskQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

type AtRiskQuery = z.infer<typeof atRiskQuerySchema>

// ── Route plugin ───────────────────────────────────────────────────────────

export async function adminDashboardRoutes(fastify: FastifyInstance) {

  // ── GET /stats ── Summary stats ────────────────────────────────────────
  fastify.get(
    '/stats',
    { preHandler: requirePermission('analytics:read') },
    async (_request, reply) => {
      // 1. Cohorts: all non-archived (DRAFT, UPCOMING, ACTIVE, COMPLETED)
      const activeCohorts = await Cohort.countDocuments({ status: { $ne: 'ARCHIVED' } })

      // 2. Active students: STUDENT users enrolled in any non-archived cohort
      const activeCohortIds = await Cohort.find(
        { status: { $ne: 'ARCHIVED' } },
        { _id: 1 },
      ).lean()
      const activeCohortObjectIds = activeCohortIds.map((c) => c._id)

      const activeStudentMemberships = await CohortMembership.distinct('userId', {
        cohortId: { $in: activeCohortObjectIds },
      })

      // Filter to only STUDENT-role users
      const activeStudents = await User.countDocuments({
        _id: { $in: activeStudentMemberships },
        role: 'STUDENT',
      })

      // 3. Pending reviews: PENDING or HUMAN_REVIEW submissions
      const pendingReviews = await StepSubmission.countDocuments({
        status: { $in: ['PENDING', 'HUMAN_REVIEW'] },
      })

      // 4. Completion rate: % of STUDENT users who have completed ALL steps
      //    A student is "complete" if every StudentStep for their userId
      //    is COMPLETE or OVERRIDE_PASS (and they have at least one).
      const totalStepCount = await SetupStep.countDocuments()

      let completionRate = 0
      if (totalStepCount > 0 && activeStudents > 0) {
        // Students who have exactly totalStepCount steps in terminal state
        const completedStudentDocs = await StudentStep.aggregate([
          {
            $match: { status: { $in: ['COMPLETE', 'OVERRIDE_PASS'] } },
          },
          {
            $group: {
              _id: '$userId',
              completedCount: { $sum: 1 },
            },
          },
          {
            $match: { completedCount: { $gte: totalStepCount } },
          },
          {
            $count: 'total',
          },
        ])

        const completedCount = completedStudentDocs[0]?.total ?? 0
        completionRate = Math.round((completedCount / activeStudents) * 100)
      }

      return reply.send({
        activeStudents,
        pendingReviews,
        completionRate,
        activeCohorts,
      })
    },
  )

  // ── GET /at-risk ── Students with no submission in last 7 days ─────────
  fastify.get<{ Querystring: Record<string, string> }>(
    '/at-risk',
    { preHandler: requirePermission('analytics:read') },
    async (request, reply) => {
      const parseResult = atRiskQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_QUERY',
          message: 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { page, limit }: AtRiskQuery = parseResult.data
      const skip = (page - 1) * limit

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      // Students who have submitted something in the last 7 days
      const recentlyActiveUserIds = await StepSubmission.distinct('userId', {
        createdAt: { $gte: sevenDaysAgo },
      })

      // All STUDENT users enrolled in any cohort (i.e. they started the program)
      const enrolledMemberships = await CohortMembership.find({}, { userId: 1, cohortId: 1 }).lean()

      const enrolledUserIds = [
        ...new Set(enrolledMemberships.map((m) => m.userId.toString())),
      ]

      // At-risk = enrolled students NOT in the recently active set
      const recentlyActiveSet = new Set(
        recentlyActiveUserIds.map((id) => id.toString()),
      )

      const atRiskUserIds = enrolledUserIds
        .filter((id) => !recentlyActiveSet.has(id))
        .map((id) => new Types.ObjectId(id))

      const total = atRiskUserIds.length
      const pagedAtRiskIds = atRiskUserIds.slice(skip, skip + limit)

      if (pagedAtRiskIds.length === 0) {
        return reply.send({ students: [], total, page, limit, totalPages: 0 })
      }

      // Fetch user details
      const users = await User.find(
        { _id: { $in: pagedAtRiskIds }, role: 'STUDENT' },
        { firstName: 1, lastName: 1, email: 1, avatarUrl: 1 },
      ).lean({ virtuals: true })

      // Last submission date per user
      const lastSubmissions = await StepSubmission.aggregate([
        { $match: { userId: { $in: pagedAtRiskIds } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$userId',
            lastSubmissionDate: { $first: '$createdAt' },
          },
        },
      ])

      const lastSubmissionMap = new Map(
        lastSubmissions.map((s) => [s._id.toString(), s.lastSubmissionDate as Date]),
      )

      // Cohort info per user (most recent membership)
      const cohortMemberships = await CohortMembership.find(
        { userId: { $in: pagedAtRiskIds } },
        { userId: 1, cohortId: 1 },
      )
        .populate<{ cohortId: { _id: unknown; name: string } }>('cohortId', '_id name')
        .lean({ virtuals: true })

      const cohortMap = new Map<string, { id: string; name: string }>()
      for (const m of cohortMemberships) {
        const uid = m.userId.toString()
        if (!cohortMap.has(uid) && m.cohortId) {
          cohortMap.set(uid, {
            id:   (m.cohortId._id as { toString(): string }).toString(),
            name: m.cohortId.name,
          })
        }
      }

      const userMap = new Map(
        users.map((u) => [
          (u as unknown as { _id: { toString(): string } })._id.toString(),
          u,
        ]),
      )

      const now = Date.now()
      const students = pagedAtRiskIds.map((objectId) => {
        const id = objectId.toString()
        const user = userMap.get(id)
        const lastActiveAt = lastSubmissionMap.get(id) ?? null
        const daysInactive = lastActiveAt
          ? Math.floor((now - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
          : 999

        return {
          id,
          firstName:   user?.firstName ?? 'Unknown',
          lastName:    user?.lastName  ?? '',
          email:       user?.email     ?? '',
          avatarUrl:   user?.avatarUrl ?? null,
          cohort:      cohortMap.get(id) ?? null,
          lastActiveAt: lastActiveAt?.toISOString() ?? null,
          daysInactive,
        }
      })

      return reply.send({
        students,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    },
  )
}
