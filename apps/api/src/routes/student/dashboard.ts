// PBA-149 — Student Dashboard API
// PBA-300 — estimatedMinutes added to step summary
// GET /api/student/dashboard
import type { FastifyInstance } from 'fastify'
import { requireStudent } from '../../middleware/authenticate.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { CohortMembership } from '../../models/CohortMembership.js'
import { Cohort } from '../../models/Cohort.js'
import { SetupStep } from '../../models/SetupStep.js'
import { StudentStep } from '../../models/StudentStep.js'
import type { StudentStepStatus } from '../../models/StudentStep.js'

export type DashboardState =
  | 'WELCOME'
  | 'IN_PROGRESS'
  | 'COMPLETE'
  | 'DEADLINE_MISSED'
  | 'NO_COHORT'

interface StepSummary {
  id: string
  title: string
  order: number
  estimatedMinutes: number | null
  status: StudentStepStatus | 'UNLOCKED'
  submissionId?: string
}

export async function dashboardRoutes(fastify: FastifyInstance) {
  // GET /api/student/dashboard
  fastify.get('/dashboard', { preHandler: requireStudent }, async (request, reply) => {
    const user = request.user as JwtPayload
    const userId = user.sub

    // 1. Resolve cohort membership
    const membership = await CohortMembership.findOne({ userId }).populate('cohortId')
    if (!membership || !membership.cohortId) {
      return reply.send({
        dashboardState: 'NO_COHORT' as DashboardState,
        student: { id: userId, email: user.email },
        cohort: null,
        steps: [],
        progressPercent: 0,
        completedSteps: 0,
        totalSteps: 0,
      })
    }

    const cohort = membership.cohortId as typeof membership.cohortId & {
      id: string; name: string; startDate: Date; endDate: Date
    }

    // Use endDate as the setup deadline (deadline = cohort end date for setup)
    const deadline = (cohort as unknown as { endDate: Date }).endDate
    const now = new Date()
    const deadlineMissed = deadline && now > deadline && membership.completionStatus !== 'COMPLETE'

    // 2. Fetch all setup steps (ordered) — PBA-269: only active steps
    // Use $ne: false so steps without the isActive field are included (treats missing as active)
    const allSteps = await SetupStep.find({ isActive: { $ne: false } }).sort({ order: 1 })
    const totalSteps = allSteps.length

    // 3. Fetch student step records
    const studentSteps = await StudentStep.find({ userId })
    const stepStatusMap = new Map<string, StudentStepStatus>()
    for (const ss of studentSteps) {
      stepStatusMap.set(ss.stepId.toString(), ss.status)
    }

    // 4. Compute effective statuses with unlock logic
    let completedSteps = 0
    const steps: StepSummary[] = []
    let prevComplete = true // first step unlocked by default

    for (const step of allSteps) {
      const stepId = step.id as string
      const rawStatus = stepStatusMap.get(stepId)

      let effectiveStatus: StudentStepStatus | 'UNLOCKED'
      if (rawStatus === 'COMPLETE' || rawStatus === 'OVERRIDE_PASS') {
        effectiveStatus = 'COMPLETE'
        completedSteps++
        prevComplete = true
      } else if (!prevComplete) {
        effectiveStatus = 'LOCKED'
        prevComplete = false
      } else if (rawStatus && rawStatus !== 'LOCKED') {
        effectiveStatus = rawStatus
        prevComplete = false
      } else {
        // Step is available but not started
        effectiveStatus = 'UNLOCKED'
        prevComplete = false
      }

      steps.push({
        id:               stepId,
        title:            step.title,
        order:            step.order,
        estimatedMinutes: step.estimatedMinutes,
        status:           effectiveStatus,
      })
    }

    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

    // 5. Compute dashboard state
    let dashboardState: DashboardState
    if (deadlineMissed) {
      dashboardState = 'DEADLINE_MISSED'
    } else if (completedSteps === 0) {
      dashboardState = 'WELCOME'
    } else if (completedSteps >= totalSteps) {
      dashboardState = 'COMPLETE'
    } else {
      dashboardState = 'IN_PROGRESS'
    }

    const cohortData = cohort as unknown as {
      id: string; name: string; startDate: Date; endDate: Date
    }

    return reply.send({
      dashboardState,
      student: { id: userId, email: user.email },
      cohort: {
        id: cohortData.id,
        name: cohortData.name,
        startDate: cohortData.startDate,
        deadline: deadline,
      },
      steps,
      progressPercent,
      completedSteps,
      totalSteps,
    })
  })
}
