// Sprint 2 Story 10 (GAP-037) — Installment reminder emails.
//
// The installment plan cancels after ~96 days (3 × 32d billing cycles) but no
// reminder emails went out at months 1/2/3. This worker closes that gap by
// scheduling 3 delayed BullMQ jobs at enrollment time (installment 1 has
// already been paid, so the first reminder — "your next payment is coming
// up in 30 days" — is the first useful nudge).
//
// Scheduling contract (see scheduleInstallmentReminders):
//   30d → installment 2 reminder
//   60d → installment 3 reminder
//   90d → final confirmation (subscription will end at ~96d)
//
// The reminder content is an opaque string template — the mailer layer
// handles the actual HTML render. We only pass the data needed for the
// template: cohort title, installment amount, due date, and a link to the
// manage-subscription surface.
//
// Idempotency:
//   Each EmailLog row is keyed by `reminder-{enrollmentId}-{installmentNumber}`
//   which enforces single-send even if the enqueue fires multiple times (e.g.
//   a worker retry during handleInvoicePaymentSucceeded).

import { Worker, Queue } from 'bullmq'
import { Types } from 'mongoose'
import { bullMQConnection } from '../lib/redis.js'
import { Enrollment } from '../models/Enrollment.js'
import { Cohort } from '../models/Cohort.js'
import { User } from '../models/User.js'
import { EmailLog } from '../models/EmailLog.js'
import { PaymentPlan } from '../models/PaymentPlan.js'
import { sendEmail } from '../lib/mailer.js'
import { logger } from '../lib/logger.js'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const QUEUE_NAME = 'installment-reminder-queue'
const JOB_NAME   = 'send-installment-reminder'

// Wire: 30 days per installment reminder (billing cycle is ~32d so the
// reminder fires ~2 days before the charge attempt — enough lead time for
// the student to update a failing card).
const DAY_MS = 24 * 60 * 60 * 1000
export const INSTALLMENT_REMINDER_DELAYS_MS: [number, number, number] = [
  30 * DAY_MS,
  60 * DAY_MS,
  90 * DAY_MS,
]

// ── Job payload ──────────────────────────────────────────────────────────
export interface InstallmentReminderJobData {
  enrollmentId:      string
  installmentNumber: 1 | 2 | 3
  dueAt:             string  // ISO-8601
}

// ── Queue handle (also imported by stripeWebhookWorker for enqueue) ──────
let _queue: Queue<InstallmentReminderJobData> | null = null

export function getInstallmentReminderQueue(): Queue<InstallmentReminderJobData> {
  if (!_queue) {
    _queue = new Queue<InstallmentReminderJobData>(QUEUE_NAME, {
      connection: bullMQConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff:  { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 200 },
        removeOnFail:     { count: 100 },
      },
    })
  }
  return _queue
}

// Test seam: lets unit tests inject a stub queue (so they don't need Redis).
export function __setInstallmentReminderQueueForTests(q: unknown): void {
  _queue = q as Queue<InstallmentReminderJobData>
}

// ── Enqueue helper (called from stripeWebhookWorker on first installment) ─
// Schedules all 3 reminders in one shot. The per-job delay uses BullMQ's
// `delay` option; the JobId is deterministic so a second call with the same
// enrollmentId is a safe no-op.
export async function scheduleInstallmentReminders(
  enrollmentId:    Types.ObjectId,
  enrollmentDate?: Date,
): Promise<void> {
  const queue = getInstallmentReminderQueue()
  const anchor = enrollmentDate ?? new Date()

  for (let i = 0; i < INSTALLMENT_REMINDER_DELAYS_MS.length; i++) {
    const installmentNumber = (i + 1) as 1 | 2 | 3
    const delay = INSTALLMENT_REMINDER_DELAYS_MS[i]!
    const dueAt = new Date(anchor.getTime() + delay)

    try {
      await queue.add(
        JOB_NAME,
        {
          enrollmentId: enrollmentId.toString(),
          installmentNumber,
          dueAt: dueAt.toISOString(),
        },
        {
          delay,
          // Deterministic jobId — a retry of the stripeWebhookWorker won't
          // double-enqueue. BullMQ silently swallows duplicate jobIds.
          jobId: `reminder-${enrollmentId.toString()}-${installmentNumber}`,
        },
      )
    } catch (err) {
      logger.error(
        { err, installmentNumber, enrollmentId: enrollmentId.toString() },
        '[InstallmentReminderWorker] Failed to enqueue reminder',
      )
    }
  }

  logger.info(
    `[InstallmentReminderWorker] Scheduled 3 reminders for enrollment=${enrollmentId.toString()}` +
    ` (anchor=${anchor.toISOString()})`,
  )
}

// ── Template formatter (string, not HTML — mailer handles rendering) ─────
export function formatInstallmentReminder(args: {
  cohortTitle:       string
  installmentNumber: 1 | 2 | 3
  installmentAmount: number
  currency:          string
  dueAt:             Date
  manageUrl:         string
}): string {
  const { cohortTitle, installmentNumber, installmentAmount, currency, dueAt, manageUrl } = args
  const amountFormatted = new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(installmentAmount / 100)

  const dueAtFormatted = dueAt.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return [
    `Hi there,`,
    ``,
    `This is a reminder that installment ${installmentNumber} of 3 for ${cohortTitle} is coming up.`,
    ``,
    // Only show the amount when we could resolve it from the payment plan.
    ...(installmentAmount > 0 ? [`Amount: ${amountFormatted}`] : []),
    `Due: ${dueAtFormatted}`,
    ``,
    `We'll charge the card on file automatically. If you need to update your payment method, manage your subscription here:`,
    `${manageUrl}`,
    ``,
    `— The nextaibuilder team`,
  ].join('\n')
}

// ── Job processor ────────────────────────────────────────────────────────
// Runs when a scheduled reminder comes due. Guards:
//   1. Enrollment must still be ACTIVE (students who cancelled are skipped).
//   2. Idempotency — EmailLog with key `reminder-{enrollmentId}-{N}` blocks
//      duplicate sends from worker retries.
export async function runInstallmentReminderJob(
  data: InstallmentReminderJobData,
): Promise<void> {
  const { enrollmentId: enrollmentIdStr, installmentNumber, dueAt: dueAtStr } = data
  const idempotencyKey = `reminder-${enrollmentIdStr}-${installmentNumber}`

  // Guard 1: dedup via EmailLog idempotencyKey
  const existingLog = await EmailLog.findOne({ idempotencyKey }).lean()
  if (existingLog) {
    logger.info(
      `[InstallmentReminderWorker] Skip — EmailLog already exists for key=${idempotencyKey}`,
    )
    return
  }

  // Guard 2: load enrollment and confirm still ACTIVE
  const enrollmentId = new Types.ObjectId(enrollmentIdStr)
  const enrollment = await Enrollment.findById(enrollmentId).lean()
  if (!enrollment) {
    logger.warn(
      `[InstallmentReminderWorker] Enrollment ${enrollmentIdStr} not found — skipping reminder ${installmentNumber}`,
    )
    return
  }

  if (enrollment.status !== 'ACTIVE' || !enrollment.stripeSubscriptionId) {
    logger.info(
      `[InstallmentReminderWorker] Skip — enrollment=${enrollmentIdStr} status=${enrollment.status}` +
      ` sub=${enrollment.stripeSubscriptionId ?? 'none'}`,
    )
    return
  }

  // Resolve cohort title + user email (+ plan amount) for the template.
  const [cohort, user, plan] = await Promise.all([
    Cohort.findById(enrollment.cohortId).select('name').lean(),
    User.findById(enrollment.studentId).select('email').lean(),
    enrollment.paymentPlanId
      ? PaymentPlan.findById(enrollment.paymentPlanId).select('totalAmount currency').lean()
      : Promise.resolve(null),
  ])

  if (!cohort || !user) {
    logger.warn(
      `[InstallmentReminderWorker] Missing cohort or user for enrollment=${enrollmentIdStr} — skipping`,
    )
    return
  }

  // Build and SEND the reminder. (Previously this worker only stamped an
  // EmailLog row as SENT and never actually sent anything — students received
  // no payment reminders while the log claimed delivery.)
  const planDoc = plan as { totalAmount?: number; currency?: string } | null
  const installmentAmount = planDoc?.totalAmount ? Math.ceil(planDoc.totalAmount / 3) : 0
  const subject = `Installment ${installmentNumber} of 3 — ${cohort.name}`
  const body = formatInstallmentReminder({
    cohortTitle:       cohort.name,
    installmentNumber,
    installmentAmount,
    currency:          planDoc?.currency ?? 'usd',
    dueAt:             new Date(dueAtStr),
    manageUrl:         `${process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'}/dashboard`,
  })
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a2744;white-space:pre-wrap">${escapeHtml(body)}</div>`

  try {
    await sendEmail(user.email, subject, html)
  } catch (err) {
    // Do not stamp the EmailLog — throw so BullMQ retries. Because the row is
    // only written after a successful send, Guard 1 finds nothing on the retry
    // and re-attempts rather than being blocked.
    logger.error({ err, enrollmentId: enrollmentIdStr, installmentNumber }, '[InstallmentReminderWorker] send failed')
    throw err
  }

  // Stamp SENT only after a successful send.
  try {
    await EmailLog.create({
      userId:         enrollment.studentId,
      emailType:      'URGENCY_REMINDER',
      status:         'SENT',
      sentAt:         new Date(),
      recipientEmail: user.email,
      subject,
      idempotencyKey,
    })
  } catch (err: unknown) {
    const code = (err as { code?: number } | null)?.code
    if (code === 11000) {
      // Race with another worker — the other side already stamped it.
      logger.info(
        `[InstallmentReminderWorker] Race on key=${idempotencyKey} — another worker won`,
      )
      return
    }
    throw err
  }

  logger.info(
    `[InstallmentReminderWorker] Sent reminder ${installmentNumber}/3 for enrollment=${enrollmentIdStr}` +
    ` due=${dueAtStr}`,
  )
}

// ── Worker bootstrap ─────────────────────────────────────────────────────
export function startInstallmentReminderWorker() {
  const worker = new Worker<InstallmentReminderJobData>(
    QUEUE_NAME,
    async (job) => {
      logger.info(
        `[InstallmentReminderWorker] Job ${job.id} START — enrollment=${job.data.enrollmentId}` +
        ` installment=${job.data.installmentNumber}`,
      )
      await runInstallmentReminderJob(job.data)
    },
    {
      connection:  bullMQConnection,
      concurrency: 3,
    },
  )

  worker.on('failed', (job, err) => {
    if (!job) return
    logger.error(
      { err, jobId: job.id },
      '[InstallmentReminderWorker] Job failed',
    )
  })

  logger.info('[InstallmentReminderWorker] Started')
  return worker
}

// ── Internal exports for tests ───────────────────────────────────────────
export const __testables = {
  formatInstallmentReminder,
  runInstallmentReminderJob,
  QUEUE_NAME,
  JOB_NAME,
}
