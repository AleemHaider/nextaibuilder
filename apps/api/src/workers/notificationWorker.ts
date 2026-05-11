// FIR-68 — BullMQ notification worker: processes email-notifications
// FIR-69 — enrollment_confirmed email
// FIR-70 — receipt_received email
// FIR-71 — manual_approved / manual_rejected emails
// Also handles: re_engagement_nudge, broadcast

import { Worker } from 'bullmq'
import { bullMQConnection } from '../lib/redis.js'
import { sendEmail } from '../lib/mailer.js'
import { User } from '../models/User.js'
import { logger } from '../lib/logger.js'

const QUEUE_NAME = 'email-notifications'

// ── Job data discriminated union ──────────────────────────────────────────

export type NotificationJobData =
  | { type: 'enrollment_confirmed'; userId: string; enrollmentId: string; cohortName: string; startDate: string }
  | { type: 'receipt_received';     userId: string; cohortName: string }
  | { type: 'manual_approved';      userId: string; cohortName: string }
  | { type: 'manual_rejected';      userId: string; cohortName: string; reason?: string }
  | { type: 're_engagement_nudge';  userId: string; cohortName: string; completionPercentage: number; nudgeType: '3day' | '7day' }
  | { type: 'broadcast';            userId: string; subject: string; html: string }

// ── HTML layout wrapper ───────────────────────────────────────────────────

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f3f3f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:10px;padding:32px;">
          <tr><td style="font-family:inherit;font-size:15px;line-height:1.6;color:#1a2744;">
            ${content}
          </td></tr>
          <tr><td style="padding-top:32px;font-size:12px;color:#717182;border-top:1px solid #ececf0;margin-top:24px;">
            Product Builder Academy &mdash; You're receiving this because you enrolled in one of our cohorts.
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Email templates ───────────────────────────────────────────────────────

// FIR-69 — enrollment_confirmed
function enrollmentConfirmedHtml(cohortName: string, startDate: string): string {
  return layout(`
    <h2 style="color:#1a2744;margin:0 0 16px;">Welcome aboard!</h2>
    <p>You're officially enrolled in <strong>${cohortName}</strong>.</p>
    <p>Your course starts on <strong>${startDate}</strong>. Login to access your materials and get ready to build.</p>
    <p style="margin-top:24px;">
      <a href="${process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'}/dashboard"
         style="background:#1a2744;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Go to Dashboard
      </a>
    </p>
  `)
}

// FIR-70 — receipt_received
function receiptReceivedHtml(cohortName: string): string {
  return layout(`
    <h2 style="color:#1a2744;margin:0 0 16px;">Payment receipt received</h2>
    <p>We received your payment receipt for <strong>${cohortName}</strong>.</p>
    <p>Our team will review it within <strong>24 hours</strong>. We'll notify you once it's been verified.</p>
    <p>If you have any questions, reply to this email or contact our support team.</p>
  `)
}

// FIR-71 — manual_approved
function manualApprovedHtml(cohortName: string): string {
  return layout(`
    <h2 style="color:#1a2744;margin:0 0 16px;">Payment approved!</h2>
    <p>Your payment for <strong>${cohortName}</strong> has been approved.</p>
    <p>You now have <strong>full access</strong> to your course materials. Let's get building!</p>
    <p style="margin-top:24px;">
      <a href="${process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'}/dashboard"
         style="background:#1a2744;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Start Learning
      </a>
    </p>
  `)
}

// FIR-71 — manual_rejected
function manualRejectedHtml(cohortName: string, reason?: string): string {
  const reasonText = reason ?? 'Please contact support for more information.'
  return layout(`
    <h2 style="color:#d4183d;margin:0 0 16px;">Payment review update</h2>
    <p>Unfortunately, your payment for <strong>${cohortName}</strong> could not be verified.</p>
    <p><strong>Reason:</strong> ${reasonText}</p>
    <p>Please reach out to our support team if you believe this is an error or need assistance resubmitting your receipt.</p>
  `)
}

// FIR-170 — re_engagement_nudge
function reEngagementNudgeHtml(cohortName: string, completionPercentage: number): string {
  return layout(`
    <h2 style="color:#1a2744;margin:0 0 16px;">Keep going — you're so close!</h2>
    <p>Hey! You're <strong>${completionPercentage}%</strong> through <strong>${cohortName}</strong>.</p>
    <p>Don't stop now. Your next lesson is waiting for you.</p>
    <p style="margin-top:24px;">
      <a href="${process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'}/dashboard"
         style="background:#ff8c5a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Continue Learning
      </a>
    </p>
  `)
}

// ── Helper: look up user email ────────────────────────────────────────────

async function getUserEmail(userId: string): Promise<string | null> {
  const user = await User.findById(userId).select('email').lean()
  return user?.email ?? null
}

// ── Job processor ─────────────────────────────────────────────────────────

export async function processNotificationJob(data: NotificationJobData): Promise<void> {
  switch (data.type) {
    case 'enrollment_confirmed': {
      const email = await getUserEmail(data.userId)
      if (!email) { logger.warn(`[NotificationWorker] User not found: ${data.userId}`); return }
      await sendEmail(
        email,
        `You're enrolled in ${data.cohortName}!`,
        enrollmentConfirmedHtml(data.cohortName, data.startDate),
      )
      break
    }

    case 'receipt_received': {
      const email = await getUserEmail(data.userId)
      if (!email) { logger.warn(`[NotificationWorker] User not found: ${data.userId}`); return }
      await sendEmail(
        email,
        `Payment receipt received — ${data.cohortName}`,
        receiptReceivedHtml(data.cohortName),
      )
      break
    }

    case 'manual_approved': {
      const email = await getUserEmail(data.userId)
      if (!email) { logger.warn(`[NotificationWorker] User not found: ${data.userId}`); return }
      await sendEmail(
        email,
        `Payment approved — ${data.cohortName}`,
        manualApprovedHtml(data.cohortName),
      )
      break
    }

    case 'manual_rejected': {
      const email = await getUserEmail(data.userId)
      if (!email) { logger.warn(`[NotificationWorker] User not found: ${data.userId}`); return }
      await sendEmail(
        email,
        `Payment review update — ${data.cohortName}`,
        manualRejectedHtml(data.cohortName, data.reason),
      )
      break
    }

    case 're_engagement_nudge': {
      const email = await getUserEmail(data.userId)
      if (!email) { logger.warn(`[NotificationWorker] User not found: ${data.userId}`); return }
      await sendEmail(
        email,
        `Still with us? You're ${data.completionPercentage}% through ${data.cohortName}`,
        reEngagementNudgeHtml(data.cohortName, data.completionPercentage),
      )
      break
    }

    case 'broadcast': {
      const email = await getUserEmail(data.userId)
      if (!email) { logger.warn(`[NotificationWorker] User not found: ${data.userId}`); return }
      await sendEmail(email, data.subject, data.html)
      break
    }

    default: {
      // Runtime safety: log and skip unknown job types (TypeScript ensures exhaustiveness above)
      logger.warn('[NotificationWorker] Unknown job type received — skipping')
    }
  }
}

// ── Worker bootstrap ──────────────────────────────────────────────────────

export function startNotificationWorker() {
  logger.info('[NotificationWorker] Starting...')

  const worker = new Worker<NotificationJobData>(
    QUEUE_NAME,
    async (job) => {
      logger.info(`[NotificationWorker] Job ${job.id} START — type=${job.data.type} userId=${job.data.userId}`)
      await processNotificationJob(job.data)
      logger.info(`[NotificationWorker] Job ${job.id} DONE — type=${job.data.type}`)
    },
    {
      connection:  bullMQConnection,
      concurrency: 5,
    },
  )

  worker.on('failed', (job, err) => {
    if (!job) return
    logger.error(
      { err, jobId: job.id, type: job.data.type, userId: job.data.userId },
      '[NotificationWorker] Job failed',
    )
  })

  logger.info('[NotificationWorker] Started — concurrency=5 listening on email-notifications')
  return worker
}
