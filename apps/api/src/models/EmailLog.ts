// PBA-136 — EmailLog model (Mongoose)
import { Schema, model, Document, Model, Types } from 'mongoose'

export type EmailType =
  | 'WELCOME'
  | 'VERIFY_EMAIL'
  | 'RESET_PASSWORD'
  | 'STEP_APPROVED'
  | 'STEP_REJECTED'
  | 'CHECK_IN'
  | 'URGENCY_REMINDER'
  | 'NUDGE'
  | 'BROADCAST'

export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED' | 'SKIPPED'

export interface IEmailLog extends Document {
  userId: Types.ObjectId
  emailType: EmailType
  status: EmailStatus
  sentAt: Date | null
  createdAt: Date
  // Optional fields populated for BROADCAST emails
  recipientEmail?: string | null
  subject?: string | null
  recipientType?: 'COHORT' | 'INDIVIDUAL' | null
  recipientLabel?: string | null
  /**
   * FIR Wave 2 Story K — Idempotency key for replay-safe email sends from the
   * Stripe webhook worker. Format: `{stripeEventId}:{emailType}` (e.g.
   * `evt_abc:send-welcome-email`). Before SMTP dispatch we check for an
   * existing EmailLog with the same key; if present, skip the send.
   */
  idempotencyKey?: string | null
}

const emailLogSchema = new Schema<IEmailLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emailType: {
      type: String,
      enum: [
        'WELCOME',
        'VERIFY_EMAIL',
        'RESET_PASSWORD',
        'STEP_APPROVED',
        'STEP_REJECTED',
        'CHECK_IN',
        'URGENCY_REMINDER',
        'NUDGE',
        'BROADCAST',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED', 'BOUNCED', 'SKIPPED'],
      default: 'PENDING',
    },
    sentAt:         { type: Date,   default: null },
    recipientEmail: { type: String, default: null },
    subject:        { type: String, default: null },
    recipientType:  { type: String, enum: ['COHORT', 'INDIVIDUAL'], default: null },
    recipientLabel: { type: String, default: null },
    // FIR Wave 2 Story K — idempotency key for stripeWebhookWorker replays
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

emailLogSchema.index({ userId: 1 })
emailLogSchema.index({ userId: 1, emailType: 1, status: 1, sentAt: 1 }) // sentWithin() check in emailService
// FIR Wave 2 Story K — unique sparse index
emailLogSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })

emailLogSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const EmailLog: Model<IEmailLog> = model<IEmailLog>('EmailLog', emailLogSchema)
