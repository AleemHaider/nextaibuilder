// Worker-only entrypoint.
//
// Boots Mongo + the Socket.io Redis emitter (so worker-emitted events reach
// clients connected to the api process via the adapter), starts BullMQ
// workers, and idles. Use when running with ROLE=worker on a process
// separate from the HTTP API — required for horizontal scale so Stripe
// webhook + ML jobs aren't duplicated across api replicas.
//
// The default single-process deployment (ROLE=all in index.ts) still works
// unchanged; this file is the second-process target.

import { initSentry } from './lib/sentry.js'
initSentry()

import { connectMongoDB } from './lib/mongodb.js'
import { initSocketEmitter } from './lib/socket.js'
import { logger } from './lib/logger.js'
import { startScreenshotValidationWorker } from './workers/screenshotValidationWorker.js'
import { startScheduledEmailWorker } from './workers/scheduledEmailWorker.js'
import { startStripeWebhookWorker } from './workers/stripeWebhookWorker.js'
import { startInstallmentReminderWorker } from './workers/installmentReminderWorker.js'
import { startSlackInviteWorker } from './workers/slackInviteWorker.js'
import { startNotificationWorker } from './workers/notificationWorker.js'
import { startReEngagementCron } from './jobs/reEngagementCron.js'
import { startPaymentGraceSweepCron } from './jobs/paymentGraceSweep.js'

// BullMQ Worker handles collected so we can close them gracefully on deploy.
// Worker.close() stops accepting new jobs and waits for in-flight jobs to
// finish, so a SIGTERM during a deploy no longer kills jobs mid-side-effect
// (partial email batches, submissions stranded in ML_PROCESSING, etc.).
type Closeable = { close: () => Promise<unknown> }
const closeables: Closeable[] = []

async function start() {
  await connectMongoDB()

  // Emit-only Socket.io: no HTTP binding, just the Redis pub/sub adapter so
  // submission:updated etc. propagate to clients on the api process.
  initSocketEmitter()

  closeables.push(await startScreenshotValidationWorker())
  closeables.push(startScheduledEmailWorker())
  closeables.push(startStripeWebhookWorker())
  closeables.push(startInstallmentReminderWorker())
  closeables.push(startSlackInviteWorker())
  closeables.push(startNotificationWorker())
  closeables.push(startReEngagementCron())
  closeables.push(startPaymentGraceSweepCron())

  logger.info({ role: 'worker' }, 'Worker process ready — 6 BullMQ workers + reEngagement + payment-grace crons running')
}

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, '[worker] graceful shutdown — draining in-flight jobs')

  // Hard cap so a hung job can't block the deploy forever.
  const forceExit = setTimeout(() => {
    logger.warn('[worker] shutdown timed out after 25s — forcing exit')
    process.exit(1)
  }, 25_000)
  forceExit.unref()

  const results = await Promise.allSettled(closeables.map((c) => c.close()))
  for (const r of results) {
    if (r.status === 'rejected') logger.error({ err: r.reason }, '[worker] error closing a worker')
  }

  clearTimeout(forceExit)
  logger.info('[worker] all workers closed — exiting')
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

start().catch((err) => {
  logger.fatal({ err }, '[worker] start failed')
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  logger.fatal({ err }, '[worker] unhandledRejection')
})

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, '[worker] uncaughtException')
  process.exit(1)
})
