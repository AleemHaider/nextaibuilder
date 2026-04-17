// FIR-42 — Stripe webhook receiver
// POST /api/v1/webhook/stripe
//
// Security model:
//   - No JWT auth — Stripe signs the payload with STRIPE_WEBHOOK_SECRET
//   - Raw body MUST be read before Fastify parses it — we use a scoped
//     content-type parser inside this plugin to capture rawBody and still
//     pass the parsed JSON to request.body for convenience
//   - All processing is async (enqueued to BullMQ); this handler always
//     returns immediately with { received: true } after enqueuing

import type { FastifyInstance } from 'fastify'
import { Queue } from 'bullmq'
import { bullMQConnection } from '../lib/redis.js'
import { stripe } from '../lib/stripe.js'

// ── Queue definition ────────────────────────────────────────────────────────
// The queue is defined here so the plugin can enqueue without importing the worker.
// The worker in stripeWebhookWorker.ts listens on the same queue name.
const stripeWebhookQueue = new Queue('stripe-webhook-queue', {
  connection: bullMQConnection,
  defaultJobOptions: {
    attempts:  5,
    backoff: { type: 'exponential', delay: 3000 },
    // Keep a sliding window of recent completed/failed jobs for observability
    removeOnComplete: { count: 500 },
    removeOnFail:     { count: 200 },
  },
})

// ── Stripe webhook event job payload ───────────────────────────────────────
export interface StripeWebhookJobData {
  eventId:   string
  eventType: string
  data:      Record<string, unknown>
}

// ── Route plugin ────────────────────────────────────────────────────────────
export async function stripeWebhookRoutes(fastify: FastifyInstance) {

  // Override Fastify's default JSON body parser for this plugin scope.
  // We need the raw buffer for Stripe signature verification; Fastify's
  // default parser discards it. The custom parser:
  //   1. Reads the raw buffer
  //   2. Stores it on request.rawBody (used by stripe.webhooks.constructEvent)
  //   3. Parses the JSON into request.body as Fastify would normally
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      try {
        // Attach raw buffer so the route handler can access it for sig verification
        ;(_req as typeof _req & { rawBody: Buffer }).rawBody = body as Buffer
        // Parse body normally so request.body is available
        const parsed: unknown = JSON.parse((body as Buffer).toString('utf8'))
        done(null, parsed)
      } catch (err) {
        done(err instanceof Error ? err : new Error(String(err)), undefined)
      }
    },
  )

  // ── POST /stripe ── Receive and enqueue Stripe webhook events ────────────
  fastify.post('/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature']

    if (!sig || typeof sig !== 'string') {
      return reply.code(400).send({ error: 'MISSING_SIGNATURE', message: 'stripe-signature header is required.' })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''
    if (!webhookSecret) {
      fastify.log.error('[FIR-42] STRIPE_WEBHOOK_SECRET is not set — cannot verify webhook')
      return reply.code(500).send({ error: 'CONFIGURATION_ERROR', message: 'Webhook not configured.' })
    }

    const rawBody = (request as typeof request & { rawBody?: Buffer }).rawBody
    if (!rawBody) {
      fastify.log.error('[FIR-42] rawBody missing — content-type parser may not have run')
      return reply.code(400).send({ error: 'MISSING_BODY', message: 'Raw body unavailable.' })
    }

    // Verify the Stripe signature — this is the critical security check
    let event: import('stripe').Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      fastify.log.warn({ err: errMsg }, '[FIR-42] Stripe signature verification failed')
      return reply.code(400).send({ error: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed.' })
    }

    // Enqueue the event for async processing — do NOT process synchronously here.
    // Processing in-band would delay Stripe's 30-second webhook timeout.
    try {
      const jobData: StripeWebhookJobData = {
        eventId:   event.id,
        eventType: event.type,
        data:      event.data.object as Record<string, unknown>,
      }

      await stripeWebhookQueue.add(event.type, jobData, {
        // Use eventId as deduplication key to prevent double-processing on Stripe retries
        jobId: event.id,
      })

      fastify.log.info({ eventId: event.id, eventType: event.type }, '[FIR-42] Stripe event enqueued')
    } catch (err) {
      // If enqueue fails, return 500 so Stripe retries delivery
      fastify.log.error({ err, eventId: event.id }, '[FIR-42] Failed to enqueue Stripe event')
      return reply.code(500).send({ error: 'QUEUE_ERROR', message: 'Failed to process webhook. Stripe will retry.' })
    }

    // Always return 200 immediately after enqueuing
    return reply.send({ received: true })
  })
}
