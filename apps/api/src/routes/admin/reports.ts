// PBA-132 — Admin Reports API
// GET /api/admin/reports/progress    — cohort-level completion stats
// GET /api/admin/reports/submissions — submission volume stats (last 30 days)
// GET /api/admin/reports/export      — CSV export of all student progress

import type { FastifyInstance } from 'fastify'
import { Types } from 'mongoose'
import { requirePermission } from '../../middleware/require-permission.js'
import { Cohort } from '../../models/Cohort.js'
import { CohortMembership } from '../../models/CohortMembership.js'
import { CohortStep } from '../../models/CohortStep.js'
import { StudentStep } from '../../models/StudentStep.js'
import { StepSubmission } from '../../models/StepSubmission.js'
import { SetupStep } from '../../models/SetupStep.js'
import { User } from '../../models/User.js'

// ── Route plugin ───────────────────────────────────────────────────────────

export async function adminReportsRoutes(fastify: FastifyInstance) {

  // ── GET /progress ── Cohort-level completion stats ─────────────────────
  fastify.get(
    '/progress',
    { preHandler: requirePermission('reports:read') },
    async (_request, reply) => {
      const cohorts = await Cohort.find().sort({ createdAt: -1 }).lean({ virtuals: true })

      if (cohorts.length === 0) {
        return reply.send({ reports: [] })
      }

      const cohortIds = cohorts.map(
        (c) => (c as unknown as { _id: Types.ObjectId })._id,
      )

      // Total students per cohort
      const membershipCounts = await CohortMembership.aggregate<{
        _id: Types.ObjectId
        total: number
        userIds: Types.ObjectId[]
      }>([
        { $match: { cohortId: { $in: cohortIds } } },
        {
          $group: {
            _id: '$cohortId',
            total: { $sum: 1 },
            userIds: { $push: '$userId' },
          },
        },
      ])

      const membershipMap = new Map(
        membershipCounts.map((m) => [m._id.toString(), m]),
      )

      // Total global step count (fallback when no CohortStep rows exist)
      const globalStepCount = await SetupStep.countDocuments()

      // Steps per cohort (from CohortStep), keyed by cohortId
      const cohortStepCounts = await CohortStep.aggregate<{
        _id: Types.ObjectId
        count: number
        stepIds: Types.ObjectId[]
      }>([
        { $match: { cohortId: { $in: cohortIds } } },
        {
          $group: {
            _id: '$cohortId',
            count: { $sum: 1 },
            stepIds: { $push: '$stepId' },
          },
        },
      ])

      const cohortStepMap = new Map(
        cohortStepCounts.map((cs) => [cs._id.toString(), cs]),
      )

      // All SetupStep titles keyed by id (for step pass-rate labels)
      const allSteps = await SetupStep.find({}, { title: 1 }).lean({ virtuals: true })
      const stepTitleMap = new Map(
        allSteps.map((s) => [
          (s as unknown as { _id: Types.ObjectId })._id.toString(),
          s.title,
        ]),
      )

      // Collect all distinct userIds across all cohorts
      const allUserIds = membershipCounts.flatMap((m) => m.userIds)

      // Per-user completed step count (one aggregation, not per cohort)
      const completedPerUser = await StudentStep.aggregate<{
        _id: Types.ObjectId
        completed: number
      }>([
        {
          $match: {
            userId: { $in: allUserIds },
            status: { $in: ['COMPLETE', 'OVERRIDE_PASS'] },
          },
        },
        { $group: { _id: '$userId', completed: { $sum: 1 } } },
      ])

      const completedPerUserMap = new Map(
        completedPerUser.map((d) => [d._id.toString(), d.completed]),
      )

      // Step-level pass rates: approved submissions / (approved + rejected) per step
      const stepPassRateAgg = await StepSubmission.aggregate<{
        _id: Types.ObjectId
        approved: number
        rejected: number
      }>([
        { $match: { status: { $in: ['APPROVED', 'REJECTED'] } } },
        {
          $group: {
            _id: '$stepId',
            approved: {
              $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] },
            },
          },
        },
      ])

      const stepPassRateMap = new Map(
        stepPassRateAgg.map((s) => [s._id.toString(), s]),
      )

      const reports = cohorts.map((cohort) => {
        const cohortId = (cohort as unknown as { _id: Types.ObjectId })._id.toString()
        const membership   = membershipMap.get(cohortId)
        const totalStudents = membership?.total ?? 0
        const userIds       = membership?.userIds ?? []

        const cohortStepEntry = cohortStepMap.get(cohortId)
        const totalSteps      = cohortStepEntry ? cohortStepEntry.count : globalStepCount
        const stepIds         = cohortStepEntry
          ? cohortStepEntry.stepIds.map((id) => id.toString())
          : allSteps.map((s) => (s as unknown as { _id: Types.ObjectId })._id.toString())

        // Compute completed students and avg progress
        let completedStudents   = 0
        let totalProgressPoints = 0

        for (const uid of userIds) {
          const completed    = completedPerUserMap.get(uid.toString()) ?? 0
          const pct          = totalSteps > 0 ? (completed / totalSteps) * 100 : 0
          totalProgressPoints += pct
          if (completed >= totalSteps && totalSteps > 0) {
            completedStudents++
          }
        }

        const avgProgressPercent =
          totalStudents > 0
            ? Math.round(totalProgressPoints / totalStudents)
            : 0

        // Step pass rates for this cohort's steps
        const stepPassRates = stepIds.map((stepId) => {
          const stats   = stepPassRateMap.get(stepId)
          const total   = (stats?.approved ?? 0) + (stats?.rejected ?? 0)
          const passRate = total > 0 ? Math.round(((stats?.approved ?? 0) / total) * 100) : null
          return {
            stepId,
            stepTitle: stepTitleMap.get(stepId) ?? 'Unknown Step',
            passRate,
          }
        })

        return {
          cohortId,
          cohortName: cohort.name,
          totalStudents,
          completedStudents,
          avgProgressPercent,
          stepPassRates,
        }
      })

      return reply.send({ reports })
    },
  )

  // ── GET /submissions ── Submission volume stats ────────────────────────
  fastify.get(
    '/submissions',
    { preHandler: requirePermission('reports:read') },
    async (_request, reply) => {
      const now   = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      const thirtyDaysAgo = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)

      const [
        totalSubmissions,
        approvedToday,
        rejectedToday,
        pendingNow,
        byDayAgg,
        mlAccuracyAgg,
      ] = await Promise.all([
        StepSubmission.countDocuments(),
        StepSubmission.countDocuments({
          status:     'APPROVED',
          reviewedAt: { $gte: today, $lt: todayEnd },
        }),
        StepSubmission.countDocuments({
          status:     'REJECTED',
          reviewedAt: { $gte: today, $lt: todayEnd },
        }),
        StepSubmission.countDocuments({
          status: { $in: ['PENDING', 'ML_PROCESSING', 'HUMAN_REVIEW'] },
        }),

        // Submissions per day over last 30 days
        StepSubmission.aggregate<{ _id: string; count: number }>([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // ML accuracy: where both mlScore exists and admin made a final decision
        // Agreement = ML verdict (score >= 0.5 → approved) matches admin decision
        StepSubmission.aggregate<{ total: number; agreed: number }>([
          {
            $match: {
              mlScore: { $ne: null },
              status:  { $in: ['APPROVED', 'REJECTED'] },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              agreed: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        {
                          $and: [
                            { $gte: ['$mlScore', 0.5] },
                            { $eq: ['$status', 'APPROVED'] },
                          ],
                        },
                        {
                          $and: [
                            { $lt: ['$mlScore', 0.5] },
                            { $eq: ['$status', 'REJECTED'] },
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ])

      const mlStats     = mlAccuracyAgg[0]
      const mlAccuracyRate =
        mlStats && mlStats.total > 0
          ? Math.round((mlStats.agreed / mlStats.total) * 100)
          : null

      // Fill in every day over last 30 even if count is 0
      const dayMap = new Map(byDayAgg.map((d) => [d._id, d.count]))
      const submissionsByDay: { date: string; count: number }[] = []
      for (let i = 0; i < 30; i++) {
        const d    = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000)
        const key  = d.toISOString().slice(0, 10)
        submissionsByDay.push({ date: key, count: dayMap.get(key) ?? 0 })
      }

      return reply.send({
        totalSubmissions,
        approvedToday,
        rejectedToday,
        pendingNow,
        mlAccuracyRate,
        submissionsByDay,
      })
    },
  )

  // ── GET /export ── CSV export of all student progress ─────────────────
  fastify.get(
    '/export',
    { preHandler: requirePermission('reports:export') },
    async (_request, reply) => {
      // Fetch all memberships with user and cohort in a single pipeline
      const memberships = await CohortMembership.aggregate<{
        userId: Types.ObjectId
        cohortId: Types.ObjectId
        enrolledAt: Date
        user: {
          firstName: string
          lastName:  string
          email:     string
          lastActiveAt: Date | null
        }[]
        cohort: { name: string }[]
      }>([
        {
          $lookup: {
            from:         'users',
            localField:   'userId',
            foreignField: '_id',
            as:           'user',
            pipeline: [
              { $project: { firstName: 1, lastName: 1, email: 1, lastActiveAt: 1 } },
            ],
          },
        },
        {
          $lookup: {
            from:         'cohorts',
            localField:   'cohortId',
            foreignField: '_id',
            as:           'cohort',
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        { $sort: { enrolledAt: 1 } },
      ])

      if (memberships.length === 0) {
        void reply.header('Content-Type', 'text/csv')
        void reply.header(
          'Content-Disposition',
          'attachment; filename="pba-progress-export.csv"',
        )
        return reply.send(
          'Student Name,Email,Cohort,Completed Steps,Total Steps,Progress %,Last Active,Enrolled At\r\n',
        )
      }

      // Total global step count
      const totalSteps = await SetupStep.countDocuments()

      // All userIds from memberships
      const userIds = memberships.map((m) => m.userId)

      // Completed steps per user in one aggregation
      const completedDocs = await StudentStep.aggregate<{
        _id: Types.ObjectId
        completed: number
      }>([
        {
          $match: {
            userId: { $in: userIds },
            status: { $in: ['COMPLETE', 'OVERRIDE_PASS'] },
          },
        },
        { $group: { _id: '$userId', completed: { $sum: 1 } } },
      ])

      const completedMap = new Map(
        completedDocs.map((d) => [d._id.toString(), d.completed]),
      )

      // Build CSV
      const header =
        'Student Name,Email,Cohort,Completed Steps,Total Steps,Progress %,Last Active,Enrolled At\r\n'

      const rows = memberships.map((m) => {
        const user          = m.user[0]
        const cohort        = m.cohort[0]
        const name          = user ? `${user.firstName} ${user.lastName}` : 'Unknown'
        const email         = user?.email ?? ''
        const cohortName    = cohort?.name ?? ''
        const completed     = completedMap.get(m.userId.toString()) ?? 0
        const progressPct   = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0
        const lastActive    = user?.lastActiveAt
          ? new Date(user.lastActiveAt).toISOString()
          : ''
        const enrolledAt    = m.enrolledAt ? new Date(m.enrolledAt).toISOString() : ''

        // Escape fields that may contain commas
        const escape = (v: string) =>
          v.includes(',') || v.includes('"') || v.includes('\n')
            ? `"${v.replace(/"/g, '""')}"`
            : v

        return [
          escape(name),
          escape(email),
          escape(cohortName),
          completed,
          totalSteps,
          progressPct,
          lastActive,
          enrolledAt,
        ].join(',')
      })

      const csv = header + rows.join('\r\n') + '\r\n'

      void reply.header('Content-Type', 'text/csv')
      void reply.header(
        'Content-Disposition',
        'attachment; filename="pba-progress-export.csv"',
      )
      return reply.send(csv)
    },
  )
}
