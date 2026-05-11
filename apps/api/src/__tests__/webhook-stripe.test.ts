/**
 * Integration tests for apps/api/src/routes/webhook-stripe.ts
 * FIR-42 — Stripe webhook receiver
 *
 * Scope:
 *   - Exercise the registered POST /stripe handler end-to-end from a fake
 *     Fastify instance (same pattern used by oauth-sso.test.ts and
 *     oauth-invite.test.ts)
 *   - Drive the custom application/json content-type parser to populate
 *     request.rawBody (so signature verification can actually run)
 *   - Verify Stripe signatures with a REAL Stripe SDK call using
 *     stripe.webhooks.generateTestHeaderString(), so we exercise the exact
 *     production verification path
 *   - Confirm BullMQ enqueue behaviour by spying on the Queue.add method
 *     provided by the bullmq module mock
 *
 * What we mock:
 *   - bullmq          → so no real Redis is touched; Queue.add becomes a spy
 *   - ../lib/redis.js → bullMQConnection stub (bullmq mock ignores it anyway)
 *
 * What we do NOT mock:
 *   - The real Stripe SDK (../lib/stripe.js re-exports a real Stripe instance
 *     which we re-use for signature generation and verification)
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import Stripe from 'stripe'

// ── Env — must be set before any module that reads it is imported ──────────
const STRIPE_WEBHOOK_SECRET = 'whsec_test_1234567890'
beforeAll(() => {
  process.env['STRIPE_WEBHOOK_SECRET'] = STRIPE_WEBHOOK_SECRET
})

// ── Mocks (hoisted) ────────────────────────────────────────────────────────

// Mock BullMQ — Queue is a class whose instance exposes add()
vi.mock('bullmq', () => {
  const add = vi.fn().mockResolvedValue({ id: 'job-id-placeholder' })
  class Queue {
    add = add
    constructor(_name: string, _opts?: unknown) {}
  }
  return {
    Queue,
    __addSpy: add, // test-only handle to reach the spy
  }
})

// Mock redis lib to avoid real ioredis connection on import
vi.mock('../lib/redis.js', () => ({
  redis: { on: vi.fn() },
  bullMQConnection: { host: 'localhost', port: 6379 },
}))

// ── Imports after mocks ────────────────────────────────────────────────────
import * as BullMQ from 'bullmq'
import { stripeWebhookRoutes } from '../routes/webhook-stripe.js'

const addSpy = (BullMQ as unknown as { __addSpy: ReturnType<typeof vi.fn> }).__addSpy

// ── Fake Fastify helpers ───────────────────────────────────────────────────

type ContentTypeParser = (
  req: FastifyRequest,
  body: Buffer,
  done: (err: Error | null, parsed?: unknown) => void,
) => void

interface FakeFastify extends FastifyInstance {
  _routeHandler?: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  _parser?: ContentTypeParser
}

function makeReply(): FastifyReply & { _status: number | null; _body: unknown } {
  const r = {
    sent:    false,
    _status: null as number | null,
    _body:   undefined as unknown,
    code(status: number) { this._status = status; return this },
    send(body: unknown)  { this._body = body; this.sent = true; return this },
  }
  return r as FastifyReply & { _status: number | null; _body: unknown }
}

function makeFastify(): FakeFastify {
  const fastify: Partial<FakeFastify> = {
    log: {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
      fatal: vi.fn(), trace: vi.fn(), child: vi.fn(),
      level: 'info',
    } as unknown as FastifyInstance['log'],
  }
  // Capture the content-type parser
  fastify.addContentTypeParser = vi.fn(
    (_contentType: string, _opts: unknown, parser: ContentTypeParser) => {
      fastify._parser = parser
      return fastify as FastifyInstance
    },
  ) as unknown as FastifyInstance['addContentTypeParser']
  // Capture the POST /stripe handler
  fastify.post = vi.fn(
    (_path: string, handler: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>) => {
      fastify._routeHandler = handler
      return fastify as FastifyInstance
    },
  ) as unknown as FastifyInstance['post']
  return fastify as FakeFastify
}

/**
 * Run a request end-to-end: parse raw body via the captured parser (so
 * rawBody is attached to the request), then call the handler.
 */
async function runRequest(
  fastify: FakeFastify,
  rawBody: Buffer,
  headers: Record<string, string | undefined>,
): Promise<ReturnType<typeof makeReply>> {
  const reply = makeReply()

  // Build the request object WITHOUT rawBody first — the parser will attach it
  const request = { headers } as unknown as FastifyRequest

  // Run the content-type parser if the request declares JSON. This mirrors
  // Fastify's behaviour where the parser attaches rawBody + parsed body.
  if (fastify._parser && headers['content-type']?.includes('application/json')) {
    await new Promise<void>((resolve, reject) => {
      fastify._parser!(request, rawBody, (err, parsed) => {
        if (err) return reject(err)
        ;(request as unknown as { body: unknown }).body = parsed
        resolve()
      })
    })
  }

  if (!fastify._routeHandler) throw new Error('handler not registered')
  await fastify._routeHandler(request, reply)
  return reply
}

// ── Stripe signature helpers ───────────────────────────────────────────────

const stripeForSigning = new Stripe('sk_test_placeholder', { apiVersion: '2024-11-20.acacia' })

/**
 * Produce a valid stripe-signature header for the given payload + secret,
 * using the real Stripe SDK helper. This exercises the exact verification
 * path Stripe will use in production.
 */
function signPayload(payload: string, secret: string = STRIPE_WEBHOOK_SECRET, timestamp?: number) {
  return stripeForSigning.webhooks.generateTestHeaderString({
    payload,
    secret,
    // Defaults generated by the SDK are fine; we pin timestamp for determinism
    ...(timestamp !== undefined ? { timestamp } : {}),
  } as Parameters<typeof stripeForSigning.webhooks.generateTestHeaderString>[0])
}

// ── Event fixtures ─────────────────────────────────────────────────────────

function makeEvent(
  type: string,
  id: string = `evt_${Math.random().toString(36).slice(2, 10)}`,
  dataObject: Record<string, unknown> = { id: 'obj_123', amount: 2000 },
): Record<string, unknown> {
  return {
    id,
    object: 'event',
    api_version: '2024-11-20.acacia',
    created: Math.floor(Date.now() / 1000),
    type,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: { object: dataObject },
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /stripe (webhook receiver)', () => {
  let fastify: FakeFastify

  beforeEach(async () => {
    addSpy.mockClear()
    fastify = makeFastify()
    await stripeWebhookRoutes(fastify)
  })

  // ── a) Valid signature + raw body → 200 + enqueued ───────────────────────
  it('returns 200 and enqueues the job with jobId=event.id for a valid signature', async () => {
    const event = makeEvent('payment_intent.succeeded', 'evt_valid_001')
    const payload = JSON.stringify(event)
    const sig = signPayload(payload)

    const reply = await runRequest(fastify, Buffer.from(payload, 'utf8'), {
      'content-type':     'application/json',
      'stripe-signature': sig,
    })

    expect(reply._status).toBe(null) // default 200 — route never called .code()
    expect(reply._body).toEqual({ received: true })

    expect(addSpy).toHaveBeenCalledOnce()
    const [jobName, jobData, jobOpts] = addSpy.mock.calls[0] as [string, Record<string, unknown>, { jobId: string }]
    expect(jobName).toBe('payment_intent.succeeded')
    expect(jobData).toMatchObject({
      eventId:   'evt_valid_001',
      eventType: 'payment_intent.succeeded',
    })
    expect(jobOpts.jobId).toBe('evt_valid_001')
  })

  // ── b) Invalid signature → 400, NOT enqueued ─────────────────────────────
  it('returns 400 INVALID_SIGNATURE and does NOT enqueue when the signature is tampered', async () => {
    const event = makeEvent('payment_intent.succeeded')
    const payload = JSON.stringify(event)
    const goodSig = signPayload(payload)
    // Tamper: flip the last char of the signature portion
    const tampered = goodSig.replace(/.$/, (c) => (c === '0' ? '1' : '0'))

    const reply = await runRequest(fastify, Buffer.from(payload, 'utf8'), {
      'content-type':     'application/json',
      'stripe-signature': tampered,
    })

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_SIGNATURE')
    expect(addSpy).not.toHaveBeenCalled()
  })

  it('returns 400 INVALID_SIGNATURE when the body is modified after signing', async () => {
    // Classic replay/tamper scenario — signature is valid for a different payload
    const originalPayload = JSON.stringify(makeEvent('payment_intent.succeeded'))
    const sig = signPayload(originalPayload)
    const modifiedPayload = originalPayload.replace('"amount":2000', '"amount":999999')

    const reply = await runRequest(fastify, Buffer.from(modifiedPayload, 'utf8'), {
      'content-type':     'application/json',
      'stripe-signature': sig,
    })

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_SIGNATURE')
    expect(addSpy).not.toHaveBeenCalled()
  })

  // ── c) Missing stripe-signature header → 400 ─────────────────────────────
  it('returns 400 MISSING_SIGNATURE when the stripe-signature header is absent', async () => {
    const payload = JSON.stringify(makeEvent('payment_intent.succeeded'))

    const reply = await runRequest(fastify, Buffer.from(payload, 'utf8'), {
      'content-type': 'application/json',
      // no stripe-signature header
    })

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('MISSING_SIGNATURE')
    expect(addSpy).not.toHaveBeenCalled()
  })

  // ── d) Duplicate event.id → both enqueued, same jobId (BullMQ dedup) ─────
  it('enqueues with the same jobId on duplicate delivery (BullMQ handles idempotency)', async () => {
    const event = makeEvent('payment_intent.succeeded', 'evt_dup_001')
    const payload = JSON.stringify(event)
    const sig = signPayload(payload)

    const reply1 = await runRequest(fastify, Buffer.from(payload, 'utf8'), {
      'content-type':     'application/json',
      'stripe-signature': sig,
    })
    const reply2 = await runRequest(fastify, Buffer.from(payload, 'utf8'), {
      'content-type':     'application/json',
      'stripe-signature': sig,
    })

    expect(reply1._body).toEqual({ received: true })
    expect(reply2._body).toEqual({ received: true })

    expect(addSpy).toHaveBeenCalledTimes(2)
    const firstOpts  = addSpy.mock.calls[0]?.[2] as { jobId: string }
    const secondOpts = addSpy.mock.calls[1]?.[2] as { jobId: string }
    expect(firstOpts.jobId).toBe('evt_dup_001')
    expect(secondOpts.jobId).toBe('evt_dup_001')
    // Route-level dedup is intentionally delegated to BullMQ's unique-jobId semantics.
  })

  // ── e) Event types in the allowlist — all enqueued with correct jobName & jobId ───
  // `invoice.payment_succeeded` is the event the worker switch actually
  // handles (Stripe's modern `invoice.paid` is intentionally NOT in the
  // allowlist; see the security hardening commit).
  it.each([
    'payment_intent.succeeded',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
    'customer.subscription.deleted',
  ])('enqueues a %s event', async (eventType) => {
    const event = makeEvent(eventType, `evt_${eventType.replace(/\./g, '_')}`)
    const payload = JSON.stringify(event)
    const sig = signPayload(payload)

    const reply = await runRequest(fastify, Buffer.from(payload, 'utf8'), {
      'content-type':     'application/json',
      'stripe-signature': sig,
    })

    expect(reply._body).toEqual({ received: true })
    expect(addSpy).toHaveBeenCalledOnce()
    const [jobName, jobData, jobOpts] = addSpy.mock.calls[0] as [string, Record<string, unknown>, { jobId: string }]
    expect(jobName).toBe(eventType)
    expect(jobData['eventType']).toBe(eventType)
    expect(jobOpts.jobId).toBe(`evt_${eventType.replace(/\./g, '_')}`)
  })

  // ── e2) Allowlist: signed but unhandled event types → 200 skipped, no enqueue ──
  it('returns 200 skipped without enqueuing for event types not on the allowlist', async () => {
    const event = makeEvent('charge.refunded', 'evt_unhandled_001')
    const payload = JSON.stringify(event)
    const sig = signPayload(payload)

    const reply = await runRequest(fastify, Buffer.from(payload, 'utf8'), {
      'content-type':     'application/json',
      'stripe-signature': sig,
    })

    expect(reply._body).toEqual({ received: true, skipped: true })
    expect(addSpy).not.toHaveBeenCalled()
  })

  // ── f) Malformed JSON body with valid-looking signature ──────────────────
  it('rejects a malformed JSON body before reaching the handler (content-type parser throws)', async () => {
    // Parser is synchronous JSON.parse — it will fail on garbage and call done(err).
    // In real Fastify this produces a 400; we surface it via the parser rejection.
    const garbage = Buffer.from('{"not valid json', 'utf8')

    await expect(
      runRequest(fastify, garbage, {
        'content-type':     'application/json',
        'stripe-signature': 'whatever',
      }),
    ).rejects.toThrow()

    expect(addSpy).not.toHaveBeenCalled()
  })

  // ── Extra: STRIPE_WEBHOOK_SECRET unset → 500 ──────────────────────────────
  it('returns 500 CONFIGURATION_ERROR when STRIPE_WEBHOOK_SECRET is missing', async () => {
    const saved = process.env['STRIPE_WEBHOOK_SECRET']
    delete process.env['STRIPE_WEBHOOK_SECRET']
    try {
      const payload = JSON.stringify(makeEvent('payment_intent.succeeded'))
      // Any signature will do — the handler short-circuits before verification.
      const reply = await runRequest(fastify, Buffer.from(payload, 'utf8'), {
        'content-type':     'application/json',
        'stripe-signature': 't=1,v1=deadbeef',
      })

      expect(reply._status).toBe(500)
      expect((reply._body as { error: string }).error).toBe('CONFIGURATION_ERROR')
      expect(addSpy).not.toHaveBeenCalled()
    } finally {
      process.env['STRIPE_WEBHOOK_SECRET'] = saved
    }
  })

  // ── Extra: enqueue failure → 500 QUEUE_ERROR ─────────────────────────────
  it('returns 500 QUEUE_ERROR when BullMQ enqueue fails so Stripe will retry', async () => {
    addSpy.mockRejectedValueOnce(new Error('redis down'))

    const event   = makeEvent('payment_intent.succeeded', 'evt_queue_err')
    const payload = JSON.stringify(event)
    const sig     = signPayload(payload)

    const reply = await runRequest(fastify, Buffer.from(payload, 'utf8'), {
      'content-type':     'application/json',
      'stripe-signature': sig,
    })

    expect(reply._status).toBe(500)
    expect((reply._body as { error: string }).error).toBe('QUEUE_ERROR')
  })
})
