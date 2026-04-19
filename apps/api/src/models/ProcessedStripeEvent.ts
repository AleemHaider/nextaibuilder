// Sprint 2 Story 10 (GAP-036) — Upstream idempotency guard for Stripe webhook
// processing. Each row records a successfully (or unsuccessfully) processed
// Stripe event.id so the worker can short-circuit replays before re-running
// any side-effect handlers.
//
// Wave 2 Story K already layered per-operation idempotency keys into each
// side-effect model (Enrollment / StripePayment / SlackInvite / EmailLog).
// This collection is the coarser, event-level guard that sits above those —
// the worker checks here FIRST and returns early on a SUCCESS row.
//
// A TTL index removes rows after 90 days so the collection doesn't grow
// unbounded — Stripe won't replay events older than ~30 days anyway.

import { Schema, model, Document, Model } from 'mongoose'

export type ProcessedStripeEventOutcome = 'SUCCESS' | 'FAILED'

export interface IProcessedStripeEvent extends Document {
  stripeEventId: string
  eventType: string
  outcome: ProcessedStripeEventOutcome
  processedAt: Date
}

const processedStripeEventSchema = new Schema<IProcessedStripeEvent>(
  {
    stripeEventId: { type: String, required: true, unique: true },
    eventType:     { type: String, required: true },
    outcome: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      required: true,
    },
    processedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
)

// Unique index — the primary guard. A duplicate insert attempt raises E11000
// so we can detect races without a transaction.
processedStripeEventSchema.index({ stripeEventId: 1 }, { unique: true })

// TTL index — rows expire 90 days after processedAt. Stripe's own replay
// window is ~30 days so we keep a generous buffer for operator inspection.
processedStripeEventSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 },
)

processedStripeEventSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const ProcessedStripeEvent: Model<IProcessedStripeEvent> =
  model<IProcessedStripeEvent>('ProcessedStripeEvent', processedStripeEventSchema)
