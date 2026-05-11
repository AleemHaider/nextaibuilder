// FIR-170 — Daily re-engagement email cron job
// Runs at 09:00 UTC via BullMQ repeatable job.
// Finds ACTIVE enrollments with incomplete progress, checks Redis for rate-limiting,
// and queues nudge emails at the 3-day and 7-day thresholds.

import { Worker, Queue } from 'bullmq'
import { bullMQConnection, redis } from '../lib/redis.js'
import { Enrollment } from '../models/Enrollment.js'
import { Cohort } from '../models/Cohort.js'
import { StudentLesson } from '../models/StudentLesson.js'
import type { NotificationJobData } from '../workers/notificationWorker.js'
import { logger } from '../lib/logger.js'

const CRON_QUEUE_NAME  = 're-engagement-cron-queue'
const CRON_JOB_NAME    = 're-engagement-daily'

const emailNotificationsQueue = new Queue<NotificationJobData>('email-notifications', {
  connection: bullMQConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

// ── Core cron logic ────────────────────────────────────────────────────────

async function runReEngagementCheck(): Promise<void> {
  logger.info('[ReEngagementCron] Running daily re-engagement check')

  const now = new Date()

  // All ACTIVE enrollments that haven't hit 100% yet
  const enrollments = await Enrollment.find({
    status: 'ACTIVE',
    completionPercentage: { $lt: 100 },
  })
    .select('studentId cohortId completionPercentage')
    .lean()

  if (enrollments.length === 0) {
    logger.info('[ReEngagementCron] No eligible enrollments — done')
    return
  }

  // Pre-fetch cohort names in bulk
  const cohortIds = [...new Set(enrollments.map((e) => e.cohortId.toString()))]
  const cohorts = await Cohort.find({ _id: { $in: cohortIds } })
    .select('_id name')
    .lean()
  const cohortMap = new Map(cohorts.map((c) => [c._id.toString(), c.name]))

  let nudged3  = 0
  let nudged7  = 0
  let skipped  = 0

  for (const enrollment of enrollments) {
    const userId       = enrollment.studentId.toString()
    const enrollmentId = enrollment._id.toString()
    const cohortName   = cohortMap.get(enrollment.cohortId.toString()) ?? 'your course'
    const completion   = enrollment.completionPercentage

    // Redis rate-limit key — prevents re-sending during the TTL window
    const redisKey = `re_engage:${userId}:${enrollmentId}`
    const alreadySent = await redis.get(redisKey)
    if (alreadySent) {
      skipped++
      continue
    }

    // Find the most recent StudentLesson update for this enrollment
    const latestLesson = await StudentLesson.findOne(
      { enrollmentId: enrollment._id, status: { $in: ['IN_PROGRESS', 'COMPLETED'] } },
      { updatedAt: 1 },
      { sort: { updatedAt: -1 } },
    ).lean()

    if (!latestLesson) {
      skipped++
      continue
    }

    const msSinceLesson   = now.getTime() - latestLesson.updatedAt.getTime()
    const daysSinceLesson = Math.floor(msSinceLesson / (1000 * 60 * 60 * 24))

    if (daysSinceLesson >= 7) {
      await emailNotificationsQueue.add('re-engagement-nudge', {
        type:                're_engagement_nudge',
        userId,
        cohortName,
        completionPercentage: completion,
        nudgeType:           '7day',
      })
      // 8-day TTL to prevent double-sending in the same window
      await redis.set(redisKey, '7day', 'EX', 8 * 24 * 60 * 60)
      nudged7++
    } else if (daysSinceLesson >= 3) {
      await emailNotificationsQueue.add('re-engagement-nudge', {
        type:                're_engagement_nudge',
        userId,
        cohortName,
        completionPercentage: completion,
        nudgeType:           '3day',
      })
      // 4-day TTL to prevent double-sending in the same window
      await redis.set(redisKey, '3day', 'EX', 4 * 24 * 60 * 60)
      nudged3++
    } else {
      skipped++
    }
  }

  logger.info(
    `[ReEngagementCron] Done — nudged3=${nudged3} nudged7=${nudged7} skipped=${skipped}`,
  )
}

// ── Worker + repeatable job registration ──────────────────────────────────

export function startReEngagementCron() {
  const queue = new Queue(CRON_QUEUE_NAME, { connection: bullMQConnection })

  queue
    .add(
      CRON_JOB_NAME,
      {},
      {
        repeat: { pattern: '0 9 * * *' }, // daily at 09:00 UTC
        jobId:  CRON_JOB_NAME,
      },
    )
    .then(() => {
      logger.info('[ReEngagementCron] Repeatable job registered — cron: 0 9 * * *')
    })
    .catch((err: unknown) => {
      logger.error({ err: err }, '[ReEngagementCron] Failed to register repeatable job:')
    })

  const worker = new Worker(
    CRON_QUEUE_NAME,
    async () => {
      await runReEngagementCheck()
    },
    {
      connection:  bullMQConnection,
      concurrency: 1,
    },
  )

  worker.on('completed', (job) => {
    logger.info(`[ReEngagementCron] Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, '[ReEngagementCron] Job failed')
  })

  logger.info('[ReEngagementCron] Started')
  return worker
}
