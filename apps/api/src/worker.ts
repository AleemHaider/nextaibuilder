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

async function start() {
  await connectMongoDB()

  // Emit-only Socket.io: no HTTP binding, just the Redis pub/sub adapter so
  // submission:updated etc. propagate to clients on the api process.
  initSocketEmitter()

  void startScreenshotValidationWorker()
  startScheduledEmailWorker()
  startStripeWebhookWorker()
  startInstallmentReminderWorker()
  startSlackInviteWorker()
  startNotificationWorker()
  startReEngagementCron()

  logger.info({ role: 'worker' }, 'Worker process ready — 6 BullMQ workers + reEngagement cron running')
}

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
