// FIR-68 — BullMQ notification worker: processes email-notifications
// FIR-69 — enrollment_confirmed email
// FIR-70 — receipt_received email
// FIR-71 — manual_approved / manual_rejected emails
// Also handles: re_engagement_nudge, broadcast, certificate_issued,
//               enrollment_suspended, payment_failed
//
// NOTE (audit fix): producers historically enqueued two different payload
// shapes on this queue:
//   • the "worker-native" lowercase shape ({ type: 'enrollment_confirmed',
//     userId, cohortName, startDate, … }) used by reEngagementCron; and
//   • the UPPERCASE service shape ({ type: 'ENROLLMENT_CONFIRMED', studentId,
//     cohortId, … }) emitted by enrollmentService, the Stripe worker, the
//     manual-payment routes, the certificate issuer and admin course routes.
// The old switch only matched the lowercase shape, so every UPPERCASE job hit
// the `default` branch and was silently dropped while the job reported success
// (and its pre-created EmailLog row stayed PENDING forever, permanently
// blocking any re-send via the idempotency guard). This worker now normalises
// both shapes: it accepts `userId` OR `studentId`, and resolves `cohortName`/
// `startDate` from `cohortId` when only the id is supplied.

import { Worker } from 'bullmq'
import { bullMQConnection } from '../lib/redis.js'
import { sendEmail } from '../lib/mailer.js'
import { User } from '../models/User.js'
import { Cohort } from '../models/Cohort.js'
import { EmailLog } from '../models/EmailLog.js'
import { logger } from '../lib/logger.js'

const QUEUE_NAME = 'email-notifications'

// ── Job data ────────────────────────────────────────────────────────────────
// Permissive shape: `type` is matched case-insensitively and both the
// `userId`/`cohortName` and `studentId`/`cohortId` field pairs are accepted.

export interface NotificationJobData {
  type: string
  /** Recipient. Producers send either `userId` or `studentId`. */
  userId?: string
  studentId?: string
  /** Cohort context. `cohortName` is used directly; `cohortId` is resolved. */
  cohortName?: string
  cohortId?: string
  startDate?: string
  enrollmentId?: string
  reason?: string | null
  credentialId?: string
  gracePeriodHours?: number
  completionPercentage?: number
  nudgeType?: '3day' | '7day'
  subject?: string
  html?: string
  /** Present on service-layer sends; used to make the send idempotent and to
   *  reconcile the pre-created EmailLog row. */
  idempotencyKey?: string
  adminNotify?: boolean
  [key: string]: unknown
}

// ── HTML helpers ──────────────────────────────────────────────────────────

/** Escape user/admin/DB-supplied strings before interpolating into email HTML. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const APP_URL = () => process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'

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
  const startLine = startDate
    ? `<p>Your course starts on <strong>${esc(startDate)}</strong>. Login to access your materials and get ready to build.</p>`
    : `<p>Login to access your materials and get ready to build.</p>`
  return layout(`
    <h2 style="color:#1a2744;margin:0 0 16px;">Welcome aboard!</h2>
    <p>You're officially enrolled in <strong>${esc(cohortName)}</strong>.</p>
    ${startLine}
    <p style="margin-top:24px;">
      <a href="${APP_URL()}/dashboard"
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
    <p>We received your payment receipt for <strong>${esc(cohortName)}</strong>.</p>
    <p>Our team will review it within <strong>24 hours</strong>. We'll notify you once it's been verified.</p>
    <p>If you have any questions, reply to this email or contact our support team.</p>
  `)
}

// FIR-71 — manual_approved
function manualApprovedHtml(cohortName: string): string {
  return layout(`
    <h2 style="color:#1a2744;margin:0 0 16px;">Payment approved!</h2>
    <p>Your payment for <strong>${esc(cohortName)}</strong> has been approved.</p>
    <p>You now have <strong>full access</strong> to your course materials. Let's get building!</p>
    <p style="margin-top:24px;">
      <a href="${APP_URL()}/dashboard"
         style="background:#1a2744;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Start Learning
      </a>
    </p>
  `)
}

// FIR-71 — manual_rejected
function manualRejectedHtml(cohortName: string, reason?: string | null): string {
  const reasonText = reason ? esc(reason) : 'Please contact support for more information.'
  return layout(`
    <h2 style="color:#d4183d;margin:0 0 16px;">Payment review update</h2>
    <p>Unfortunately, your payment for <strong>${esc(cohortName)}</strong> could not be verified.</p>
    <p><strong>Reason:</strong> ${reasonText}</p>
    <p>Please reach out to our support team if you believe this is an error or need assistance resubmitting your receipt.</p>
  `)
}

// FIR-170 — re_engagement_nudge
function reEngagementNudgeHtml(cohortName: string, completionPercentage: number): string {
  return layout(`
    <h2 style="color:#1a2744;margin:0 0 16px;">Keep going — you're so close!</h2>
    <p>Hey! You're <strong>${esc(completionPercentage)}%</strong> through <strong>${esc(cohortName)}</strong>.</p>
    <p>Don't stop now. Your next lesson is waiting for you.</p>
    <p style="margin-top:24px;">
      <a href="${APP_URL()}/dashboard"
         style="background:#ff8c5a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Continue Learning
      </a>
    </p>
  `)
}

// certificate_issued
function certificateIssuedHtml(cohortName: string, credentialId: string): string {
  return layout(`
    <h2 style="color:#1a2744;margin:0 0 16px;">🎉 Your certificate is ready!</h2>
    <p>Congratulations on completing <strong>${esc(cohortName)}</strong>.</p>
    <p>Your credential ID is <strong>${esc(credentialId)}</strong>. You can view and share your certificate from your dashboard.</p>
    <p style="margin-top:24px;">
      <a href="${APP_URL()}/dashboard"
         style="background:#1a2744;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        View Certificate
      </a>
    </p>
  `)
}

// enrollment_suspended
function enrollmentSuspendedHtml(cohortName: string, reason?: string | null): string {
  const reasonLine = reason ? `<p><strong>Reason:</strong> ${esc(reason)}</p>` : ''
  return layout(`
    <h2 style="color:#d4183d;margin:0 0 16px;">Access to your cohort is paused</h2>
    <p>Your access to <strong>${esc(cohortName)}</strong> has been suspended.</p>
    ${reasonLine}
    <p>Please contact our support team to resolve this and restore your access.</p>
  `)
}

// payment_failed
function paymentFailedHtml(cohortName: string, gracePeriodHours: number): string {
  const grace = Number.isFinite(gracePeriodHours) ? gracePeriodHours : 72
  return layout(`
    <h2 style="color:#d4183d;margin:0 0 16px;">We couldn't process your installment</h2>
    <p>A payment for <strong>${esc(cohortName)}</strong> didn't go through.</p>
    <p>Please update your payment method within <strong>${esc(grace)} hours</strong> to keep your access active.</p>
    <p style="margin-top:24px;">
      <a href="${APP_URL()}/dashboard"
         style="background:#ff8c5a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Update Payment
      </a>
    </p>
  `)
}

// ── Lookups ─────────────────────────────────────────────────────────────────

async function getUserEmail(userId: string): Promise<string | null> {
  const user = await User.findById(userId).select('email').lean()
  return (user as { email?: string } | null)?.email ?? null
}

/** Resolve display cohort name + formatted start date, from either the
 *  supplied `cohortName`/`startDate` or by looking up `cohortId`. */
async function resolveCohort(
  data: NotificationJobData,
): Promise<{ cohortName: string; startDate: string }> {
  if (data.cohortName) {
    return { cohortName: data.cohortName, startDate: data.startDate ?? '' }
  }
  if (data.cohortId) {
    const cohort = await Cohort.findById(data.cohortId).select('name startDate').lean()
    const c = cohort as { name?: string; startDate?: Date } | null
    return {
      cohortName: c?.name ?? 'your cohort',
      startDate: c?.startDate
        ? new Date(c.startDate).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
          })
        : '',
    }
  }
  return { cohortName: 'your cohort', startDate: data.startDate ?? '' }
}

/** Normalise the many `type` spellings producers emit to one canonical key. */
function canonicalType(type: string): string {
  switch (type) {
    case 'enrollment_confirmed':
    case 'ENROLLMENT_CONFIRMED':    return 'enrollment_confirmed'
    case 'receipt_received':
    case 'MANUAL_PAYMENT_SUBMITTED': return 'receipt_received'
    case 'manual_approved':
    case 'MANUAL_PAYMENT_APPROVED':  return 'manual_approved'
    case 'manual_rejected':
    case 'MANUAL_PAYMENT_REJECTED':  return 'manual_rejected'
    case 're_engagement_nudge':      return 're_engagement_nudge'
    case 'broadcast':                return 'broadcast'
    case 'CERTIFICATE_ISSUED':       return 'certificate_issued'
    case 'ENROLLMENT_SUSPENDED':     return 'enrollment_suspended'
    case 'PAYMENT_FAILED':           return 'payment_failed'
    default:                         return 'unknown'
  }
}

// ── Job processor ─────────────────────────────────────────────────────────

/** Build the { subject, html } for a job, or null if the type is unsupported. */
async function buildEmail(
  data: NotificationJobData,
): Promise<{ subject: string; html: string } | null> {
  const kind = canonicalType(data.type)

  switch (kind) {
    case 'enrollment_confirmed': {
      const { cohortName, startDate } = await resolveCohort(data)
      return {
        subject: `You're enrolled in ${cohortName}!`,
        html: enrollmentConfirmedHtml(cohortName, startDate),
      }
    }
    case 'receipt_received': {
      const { cohortName } = await resolveCohort(data)
      return {
        subject: `Payment receipt received — ${cohortName}`,
        html: receiptReceivedHtml(cohortName),
      }
    }
    case 'manual_approved': {
      const { cohortName } = await resolveCohort(data)
      return {
        subject: `Payment approved — ${cohortName}`,
        html: manualApprovedHtml(cohortName),
      }
    }
    case 'manual_rejected': {
      const { cohortName } = await resolveCohort(data)
      return {
        subject: `Payment review update — ${cohortName}`,
        html: manualRejectedHtml(cohortName, data.reason),
      }
    }
    case 're_engagement_nudge': {
      const { cohortName } = await resolveCohort(data)
      const pct = data.completionPercentage ?? 0
      return {
        subject: `Still with us? You're ${pct}% through ${cohortName}`,
        html: reEngagementNudgeHtml(cohortName, pct),
      }
    }
    case 'certificate_issued': {
      const { cohortName } = await resolveCohort(data)
      return {
        subject: `Your ${cohortName} certificate is ready 🎉`,
        html: certificateIssuedHtml(cohortName, data.credentialId ?? ''),
      }
    }
    case 'enrollment_suspended': {
      const { cohortName } = await resolveCohort(data)
      return {
        subject: `Your access to ${cohortName} is paused`,
        html: enrollmentSuspendedHtml(cohortName, data.reason),
      }
    }
    case 'payment_failed': {
      const { cohortName } = await resolveCohort(data)
      return {
        subject: `Payment failed — action needed for ${cohortName}`,
        html: paymentFailedHtml(cohortName, data.gracePeriodHours ?? 72),
      }
    }
    case 'broadcast': {
      if (!data.subject || !data.html) return null
      return { subject: data.subject, html: data.html }
    }
    default:
      return null
  }
}

export async function processNotificationJob(data: NotificationJobData): Promise<void> {
  const userId = data.userId ?? data.studentId
  if (!userId) {
    logger.warn({ type: data.type }, '[NotificationWorker] Job missing userId/studentId — skipping')
    return
  }

  if (canonicalType(data.type) === 'unknown') {
    logger.warn({ type: data.type }, '[NotificationWorker] Unknown job type received — skipping')
    return
  }

  // Idempotent send: if a service-layer producer already marked this key SENT,
  // don't re-send on a BullMQ retry / Stripe re-delivery.
  if (data.idempotencyKey) {
    const alreadySent = await EmailLog.findOne({
      idempotencyKey: data.idempotencyKey,
      status: 'SENT',
    }).lean()
    if (alreadySent) {
      logger.info(`[NotificationWorker] idempotencyKey=${data.idempotencyKey} already SENT — skipping`)
      return
    }
  }

  const email = await getUserEmail(userId)
  if (!email) {
    logger.warn(`[NotificationWorker] User not found: ${userId}`)
    return
  }

  const built = await buildEmail(data)
  if (!built) {
    logger.warn({ type: data.type }, '[NotificationWorker] Could not build email (unsupported/missing fields) — skipping')
    return
  }

  try {
    await sendEmail(email, built.subject, built.html)
  } catch (err) {
    // Mark the pre-created EmailLog row FAILED (if any) and rethrow so BullMQ
    // retries with backoff.
    if (data.idempotencyKey) {
      await EmailLog.updateOne(
        { idempotencyKey: data.idempotencyKey },
        { $set: { status: 'FAILED' } },
      ).catch(() => {})
    }
    throw err
  }

  // Reconcile the pre-created EmailLog row so it doesn't sit PENDING forever
  // (and so the idempotency guard above works on future replays).
  if (data.idempotencyKey) {
    await EmailLog.updateOne(
      { idempotencyKey: data.idempotencyKey },
      { $set: { status: 'SENT', sentAt: new Date() } },
    ).catch((err) =>
      logger.error({ err, idempotencyKey: data.idempotencyKey },
        '[NotificationWorker] Failed to stamp EmailLog SENT'),
    )
  }
}

// ── Worker bootstrap ──────────────────────────────────────────────────────

export function startNotificationWorker() {
  logger.info('[NotificationWorker] Starting...')

  const worker = new Worker<NotificationJobData>(
    QUEUE_NAME,
    async (job) => {
      const userId = job.data.userId ?? job.data.studentId
      logger.info(`[NotificationWorker] Job ${job.id} START — type=${job.data.type} userId=${userId}`)
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
      { err, jobId: job.id, type: job.data.type, userId: job.data.userId ?? job.data.studentId },
      '[NotificationWorker] Job failed',
    )
  })

  logger.info('[NotificationWorker] Started — concurrency=5 listening on email-notifications')
  return worker
}
