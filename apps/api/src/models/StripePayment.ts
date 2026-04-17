// FIR-17 — StripePayment model (append-only ledger)
import { Schema, model, Document, Model, Types } from 'mongoose'

export type StripePaymentStatus = 'SUCCEEDED' | 'FAILED' | 'REFUNDED'

export interface IStripePayment extends Document {
  enrollmentId: Types.ObjectId
  studentId: Types.ObjectId
  stripeEventId: string
  stripePaymentIntentId?: string
  stripeInvoiceId?: string
  amount: number
  currency: string
  status: StripePaymentStatus
  installmentNumber?: number
  metadata?: Record<string, unknown>
  /**
   * FIR Wave 2 Story K — Idempotency key for replay-safe side effects from the
   * Stripe webhook worker. Format: `{stripeEventId}:{operation}`. Nullable for
   * backward compat; unique sparse index so existing null-key docs coexist.
   * Note: `stripeEventId` is already `unique`; idempotencyKey gives us per-op
   * granularity (e.g. a single event could spawn multiple ledger rows).
   */
  idempotencyKey?: string | null
  createdAt: Date
}

const stripePaymentSchema = new Schema<IStripePayment>(
  {
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stripeEventId: { type: String, required: true, unique: true },
    stripePaymentIntentId: { type: String },
    stripeInvoiceId: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'usd', lowercase: true, trim: true },
    status: {
      type: String,
      enum: ['SUCCEEDED', 'FAILED', 'REFUNDED'],
      required: true,
    },
    installmentNumber: { type: Number },
    metadata: { type: Schema.Types.Mixed },
    // FIR Wave 2 Story K — idempotency key for stripeWebhookWorker replays
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

stripePaymentSchema.index({ stripeEventId: 1 }, { unique: true })
stripePaymentSchema.index({ enrollmentId: 1, createdAt: -1 })
stripePaymentSchema.index({ studentId: 1, createdAt: -1 })
// FIR Wave 2 Story K — unique sparse index
stripePaymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })

stripePaymentSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const StripePayment: Model<IStripePayment> = model<IStripePayment>(
  'StripePayment',
  stripePaymentSchema,
)
