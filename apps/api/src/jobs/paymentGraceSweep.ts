// Payment-grace suspension sweep.
//
// When an installment payment fails, invoice.payment_failed stamps
// `paymentGraceEndsAt = now + GRACE_PERIOD_HOURS` on the enrollment but leaves
// access ACTIVE (a grace window for the student to fix their card). Nothing
// used to suspend access once that window elapsed — a student who paid 1 of 3
// installments and then stopped kept full access indefinitely. This hourly
// sweep suspends any enrollment whose grace deadline has passed without the
// student catching up. A subsequent successful payment clears the deadline
// (see stripeWebhookWorker.handleInvoicePaymentSucceeded), so recovered
// students are never swept.

import { Worker, Queue } from 'bullmq'
import { bullMQConnection } from '../lib/redis.js'
import { Enrollment } from '../models/Enrollment.js'
import type { NotificationJobData } from '../workers/notificationWorker.js'
import { logger } from '../lib/logger.js'

const CRON_QUEUE_NAME = 'payment-grace-sweep-queue'
const CRON_JOB_NAME   = 'payment-grace-sweep'

const emailNotificationsQueue = new Queue<NotificationJobData>('email-notifications', {
  connection: bullMQConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

// ── Core sweep logic ───────────────────────────────────────────────────────

/** Suspend enrollments past their payment-grace deadline. Returns the count. */
export async function runPaymentGraceSweep(): Promise<number> {
  const now = new Date()

  // ACTIVE enrollments with an outstanding failed payment whose grace elapsed.
  const overdue = await Enrollment.find({
    status:             'ACTIVE',
    paymentStatus:      { $nin: ['PAID', 'WAIVED'] },
    paymentGraceEndsAt: { $ne: null, $lte: now },
  })
    .select('_id studentId cohortId')
    .lean()

  if (overdue.length === 0) {
    logger.info('[PaymentGraceSweep] No overdue enrollments — done')
    return 0
  }

  let suspended = 0
  for (const enrollment of overdue) {
    // Guarded update: only suspend if it's still ACTIVE and still overdue, so a
    // payment that lands mid-sweep isn't clobbered.
    const res = await Enrollment.updateOne(
      { _id: enrollment._id, status: 'ACTIVE', paymentGraceEndsAt: { $ne: null, $lte: now } },
      { $set: { status: 'SUSPENDED' } },
    )
    if ((res.modifiedCount ?? 0) === 0) continue
    suspended++

    await emailNotificationsQueue
      .add('enrollment-suspended', {
        type:      'ENROLLMENT_SUSPENDED',
        studentId: enrollment.studentId.toString(),
        cohortId:  enrollment.cohortId.toString(),
        reason:    'A payment is overdue. Update your payment method to restore access.',
      })
      .catch((err: unknown) =>
        logger.error({ err, enrollmentId: enrollment._id.toString() }, '[PaymentGraceSweep] failed to enqueue suspension email'),
      )
  }

  logger.warn(`[PaymentGraceSweep] Suspended ${suspended}/${overdue.length} overdue enrollment(s)`)
  return suspended
}

// ── Worker + repeatable job registration ──────────────────────────────────

export function startPaymentGraceSweepCron() {
  const queue = new Queue(CRON_QUEUE_NAME, { connection: bullMQConnection })

  queue
    .add(
      CRON_JOB_NAME,
      {},
      {
        repeat: { pattern: '0 * * * *' }, // hourly
        jobId:  CRON_JOB_NAME,
      },
    )
    .then(() => logger.info('[PaymentGraceSweep] Repeatable job registered — cron: 0 * * * *'))
    .catch((err: unknown) => logger.error({ err }, '[PaymentGraceSweep] Failed to register repeatable job'))

  const worker = new Worker(
    CRON_QUEUE_NAME,
    async () => { await runPaymentGraceSweep() },
    { connection: bullMQConnection, concurrency: 1 },
  )

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, '[PaymentGraceSweep] Job failed')
  })

  logger.info('[PaymentGraceSweep] Started')
  return worker
}
