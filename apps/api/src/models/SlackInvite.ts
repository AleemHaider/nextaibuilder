// FIR-21 — SlackInvite model
import { Schema, model, Document, Model, Types } from 'mongoose'

export type SlackInviteStatus = 'PENDING' | 'SENT' | 'FAILED' | 'ACCEPTED'

export interface ISlackInvite extends Document {
  studentId: Types.ObjectId
  enrollmentId: Types.ObjectId
  email: string
  status: SlackInviteStatus
  attempts: number
  lastAttemptAt?: Date
  errorMessage?: string
  /**
   * FIR Wave 2 Story K — Idempotency key for replay-safe side effects from the
   * Stripe webhook worker. Format: `{stripeEventId}:slack-invite`. The Slack
   * API call itself is external, so the worker uses a 2-step pattern: upsert
   * a PENDING doc by idempotencyKey, then dispatch the external call only if
   * status !== 'SENT'.
   */
  idempotencyKey?: string | null
  createdAt: Date
  updatedAt: Date
}

const slackInviteSchema = new Schema<ISlackInvite>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED', 'ACCEPTED'],
      default: 'PENDING',
    },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    errorMessage: { type: String },
    // FIR Wave 2 Story K — idempotency key for stripeWebhookWorker replays
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true },
)

slackInviteSchema.index({ studentId: 1, enrollmentId: 1 }, { unique: true })
slackInviteSchema.index({ status: 1, attempts: 1 })
// FIR Wave 2 Story K — unique sparse index
slackInviteSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })

slackInviteSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const SlackInvite: Model<ISlackInvite> = model<ISlackInvite>('SlackInvite', slackInviteSchema)
