// FIR-66 — BullMQ worker that processes slack-invite-queue jobs.
// Calls the Slack Bot API to invite a user to the workspace, then
// updates the SlackInvite record to SENT or FAILED accordingly.

import { Worker, Queue } from 'bullmq'
import { bullMQConnection } from '../lib/redis.js'
import { sendSlackInvite } from '../lib/slack.js'
import { SlackInvite } from '../models/SlackInvite.js'
import { Types } from 'mongoose'
import { logger } from '../lib/logger.js'

const QUEUE_NAME = 'slack-invite-queue'
const RETRY_DELAY_MS = 5 * 60 * 1000 // 5 minutes

export interface SlackInviteJobData {
  userId: string
  email: string
  slackInviteId: string
}

// Self-reference to re-queue failed jobs with delay
const slackInviteQueue = new Queue<SlackInviteJobData>(QUEUE_NAME, {
  connection: bullMQConnection,
})

// Exported for unit tests — invoke directly without spinning up Redis/BullMQ.
// `jobId` is informational; pass any string in tests.
export async function processSlackInviteJob(
  jobId: string,
  data: SlackInviteJobData,
  retryQueue: Pick<Queue<SlackInviteJobData>, 'add'> = slackInviteQueue,
): Promise<void> {
  const { userId, email, slackInviteId } = data

  logger.info(`[SlackInviteWorker] Job ${jobId} START — userId=${userId} email=${email}`)

  const invite = Types.ObjectId.isValid(slackInviteId)
    ? await SlackInvite.findById(slackInviteId)
    : null

  if (!invite) {
    logger.warn(`[SlackInviteWorker] SlackInvite not found: ${slackInviteId} — skipping`)
    return
  }

  if (invite.status === 'SENT') {
    logger.info(`[SlackInviteWorker] SlackInvite ${slackInviteId} already SENT — skipping`)
    return
  }

  try {
    await sendSlackInvite(email)

    await SlackInvite.findByIdAndUpdate(invite._id, {
      $set:   { status: 'SENT', lastAttemptAt: new Date() },
      $unset: { errorMessage: '' },
      $inc:   { attempts: 1 },
    })

    logger.info(`[SlackInviteWorker] Job ${jobId} DONE — invite sent to ${email}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const nextRetryCount = invite.attempts + 1

    await SlackInvite.findByIdAndUpdate(invite._id, {
      $set: {
        status:        'FAILED',
        lastAttemptAt: new Date(),
        errorMessage:  message,
      },
      $inc: { attempts: 1 },
    })

    logger.error({ err: message, jobId, attempt: nextRetryCount }, '[SlackInviteWorker] Job FAILED')

    // Re-queue with 5-minute delay if under the retry threshold
    if (nextRetryCount < MAX_RETRIES) {
      await retryQueue.add(
        'retry-slack-invite',
        { userId, email, slackInviteId },
        { delay: RETRY_DELAY_MS },
      )
      logger.info(`[SlackInviteWorker] Re-queued job for ${email} with ${RETRY_DELAY_MS}ms delay`)
    } else {
      logger.warn(`[SlackInviteWorker] Max retries reached for ${email} — no further attempts`)
    }
  }
}

export const MAX_RETRIES = 3

export function startSlackInviteWorker() {
  logger.info('[SlackInviteWorker] Starting...')

  const worker = new Worker<SlackInviteJobData>(
    QUEUE_NAME,
    (job) => processSlackInviteJob(String(job.id ?? ''), job.data),
    {
      connection:  bullMQConnection,
      concurrency: 3,
    },
  )

  worker.on('failed', (job, err) => {
    if (!job) return
    logger.error(
      { err, jobId: job.id, userId: job.data.userId },
      '[SlackInviteWorker] Job exhausted retries',
    )
  })

  logger.info('[SlackInviteWorker] Started — listening on slack-invite-queue')
  return worker
}
