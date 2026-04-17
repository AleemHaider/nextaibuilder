// FIR-66 — BullMQ worker that processes slack-invite-queue jobs.
// Calls the Slack Bot API to invite a user to the workspace, then
// updates the SlackInvite record to SENT or FAILED accordingly.

import { Worker, Queue } from 'bullmq'
import { bullMQConnection } from '../lib/redis.js'
import { sendSlackInvite } from '../lib/slack.js'
import { SlackInvite } from '../models/SlackInvite.js'
import { Types } from 'mongoose'

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

export function startSlackInviteWorker() {
  console.info('[SlackInviteWorker] Starting...')

  const worker = new Worker<SlackInviteJobData>(
    QUEUE_NAME,
    async (job) => {
      const { userId, email, slackInviteId } = job.data

      console.info(`[SlackInviteWorker] Job ${job.id} START — userId=${userId} email=${email}`)

      // Load the SlackInvite record — skip gracefully if already SENT
      const invite = Types.ObjectId.isValid(slackInviteId)
        ? await SlackInvite.findById(slackInviteId)
        : null

      if (!invite) {
        console.warn(`[SlackInviteWorker] SlackInvite not found: ${slackInviteId} — skipping`)
        return
      }

      if (invite.status === 'SENT') {
        console.info(`[SlackInviteWorker] SlackInvite ${slackInviteId} already SENT — skipping`)
        return
      }

      try {
        await sendSlackInvite(email)

        await SlackInvite.findByIdAndUpdate(invite._id, {
          $set:   { status: 'SENT', lastAttemptAt: new Date() },
          $unset: { errorMessage: '' },
          $inc:   { attempts: 1 },
        })

        console.info(`[SlackInviteWorker] Job ${job.id} DONE — invite sent to ${email}`)
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

        console.error(`[SlackInviteWorker] Job ${job.id} FAILED (attempt ${nextRetryCount}):`, message)

        // Re-queue with 5-minute delay if under the retry threshold
        if (nextRetryCount < 3) {
          await slackInviteQueue.add(
            'retry-slack-invite',
            { userId, email, slackInviteId },
            { delay: RETRY_DELAY_MS },
          )
          console.info(`[SlackInviteWorker] Re-queued job for ${email} with ${RETRY_DELAY_MS}ms delay`)
        } else {
          console.warn(`[SlackInviteWorker] Max retries reached for ${email} — no further attempts`)
        }
      }
    },
    {
      connection:  bullMQConnection,
      concurrency: 3,
    },
  )

  worker.on('failed', (job, err) => {
    if (!job) return
    console.error(
      `[SlackInviteWorker] Job ${job.id} exhausted retries — userId=${job.data.userId}:`,
      err,
    )
  })

  console.info('[SlackInviteWorker] Started — listening on slack-invite-queue')
  return worker
}
