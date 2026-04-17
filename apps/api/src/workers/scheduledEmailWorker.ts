// PBA-134 — Scheduled email worker: daily nudge + urgency emails via BullMQ repeatable jobs
import { Worker, Queue } from 'bullmq'
import { bullMQConnection } from '../lib/redis.js'
import { CohortMembership } from '../models/CohortMembership.js'
import { Cohort } from '../models/Cohort.js'
import { StepSubmission } from '../models/StepSubmission.js'
import { sendNudgeEmail, sendUrgencyEmail } from '../services/emailService.js'
import { createNotification } from '../services/notificationService.js'
import { User } from '../models/User.js'

const QUEUE_NAME = 'scheduled-email-queue'
const JOB_NAME  = 'daily-email-check'

// ── Job processor ──────────────────────────────────────────────────────────

async function runDailyEmailCheck(): Promise<void> {
  console.info('[ScheduledEmailWorker] Running daily email check')

  const now = new Date()

  // Fetch all active cohorts
  const activeCohorts = await Cohort.find({ status: 'ACTIVE' }).lean()
  if (activeCohorts.length === 0) {
    console.info('[ScheduledEmailWorker] No active cohorts — nothing to do')
    return
  }

  const cohortIds = activeCohorts.map((c) => c._id)

  // Fetch all memberships in active cohorts (excluding COMPLETE members)
  const memberships = await CohortMembership.find({
    cohortId: { $in: cohortIds },
    completionStatus: { $ne: 'COMPLETE' },
  }).lean()

  if (memberships.length === 0) {
    console.info('[ScheduledEmailWorker] No active memberships — nothing to do')
    return
  }

  // Build a map of cohortId → cohort endDate for urgency emails
  const cohortMap = new Map(activeCohorts.map((c) => [c._id.toString(), c]))

  let nudgeCount   = 0
  let urgencyCount = 0
  let skippedCount = 0

  for (const membership of memberships) {
    const userId   = membership.userId.toString()
    const cohortId = membership.cohortId.toString()
    const cohort   = cohortMap.get(cohortId)

    // Resolve lastActiveAt from User record
    const user = await User.findById(userId, { lastActiveAt: 1, notifications: 1 }).lean()
    if (!user) {
      skippedCount++
      continue
    }

    // Fall back to most recent submission if user has no lastActiveAt
    let lastActive: Date | null = user.lastActiveAt ?? null

    if (!lastActive) {
      const latestSubmission = await StepSubmission.findOne(
        { userId: membership.userId },
        { createdAt: 1 },
        { sort: { createdAt: -1 } },
      ).lean()
      if (latestSubmission) {
        lastActive = latestSubmission.createdAt
      }
    }

    if (!lastActive) {
      // Never active at all — treat as inactive since enrollment
      lastActive = membership.joinedAt ?? new Date()
    }

    const msInactive       = now.getTime() - lastActive!.getTime()
    const daysSinceActive  = Math.floor(msInactive / (1000 * 60 * 60 * 24))

    if (daysSinceActive >= 7) {
      // 7+ days inactive → urgency
      const deadline = cohort
        ? cohort.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'your cohort end date'

      sendUrgencyEmail(userId, deadline).catch((err) =>
        console.error(`[ScheduledEmailWorker] sendUrgencyEmail failed for user=${userId}:`, err),
      )
      void createNotification({
        userId,
        type:     'DEADLINE_WARNING',
        title:    'Cohort deadline approaching',
        body:     `Your cohort ends on ${deadline}. Complete your steps before the deadline.`,
        linkPath: '/steps',
      })
      urgencyCount++
    } else if (daysSinceActive >= 3) {
      // 3–6 days inactive → nudge
      sendNudgeEmail(userId, daysSinceActive).catch((err) =>
        console.error(`[ScheduledEmailWorker] sendNudgeEmail failed for user=${userId}:`, err),
      )
      nudgeCount++
    } else {
      skippedCount++
    }
  }

  console.info(
    `[ScheduledEmailWorker] Done — nudges=${nudgeCount} urgency=${urgencyCount} skipped=${skippedCount}`,
  )
}

// ── Worker + repeatable job registration ───────────────────────────────────

export function startScheduledEmailWorker() {
  // Register the repeatable job on the queue
  const queue = new Queue(QUEUE_NAME, { connection: bullMQConnection })

  queue
    .add(
      JOB_NAME,
      {},
      {
        repeat: { pattern: '0 9 * * *' }, // daily at 09:00 UTC
        jobId:  JOB_NAME,                  // stable ID prevents duplicate repeatables
      },
    )
    .then(() => {
      console.info('[ScheduledEmailWorker] Repeatable job registered — cron: 0 9 * * *')
    })
    .catch((err: unknown) => {
      console.error('[ScheduledEmailWorker] Failed to register repeatable job:', err)
    })

  // Worker that processes the queue
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await runDailyEmailCheck()
    },
    {
      connection: bullMQConnection,
      concurrency: 1,
    },
  )

  worker.on('completed', (job) => {
    console.info(`[ScheduledEmailWorker] Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[ScheduledEmailWorker] Job ${job?.id} failed:`, err.message)
  })

  console.info('[ScheduledEmailWorker] Started')
  return worker
}
