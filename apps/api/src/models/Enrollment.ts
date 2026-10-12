// FIR-16 — Enrollment model
import { Schema, model, Document, Model, Types } from 'mongoose'

export type EnrollmentStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'COMPLETED'
export type PaymentMethod = 'STRIPE' | 'PADDLE' | 'MANUAL_RECEIPT' | 'MANUAL_ADMIN' | 'COUPON'
export type EnrollmentPaymentStatus = 'PAID' | 'PARTIAL' | 'FAILED' | 'WAIVED' | 'PENDING'

export interface IEnrollment extends Document {
  studentId: Types.ObjectId
  cohortId: Types.ObjectId
  paymentPlanId?: Types.ObjectId
  paymentMethod: PaymentMethod
  paymentStatus: EnrollmentPaymentStatus
  status: EnrollmentStatus
  stripeSubscriptionId?: string
  stripeCustomerId?: string
  // Paddle linkage (set by the Paddle webhook on transaction.completed)
  paddleCustomerId?: string | null
  paddleTransactionId?: string | null
  lessonsCompleted: number
  completionPercentage: number
  lastActivityAt?: Date
  accessGrantedAt?: Date
  /**
   * Set when an installment payment fails (invoice.payment_failed) to
   * now + GRACE_PERIOD_HOURS. A scheduled sweep suspends the enrollment once
   * this passes without the student catching up; a later successful payment
   * clears it. Null/absent means "no outstanding failed payment".
   */
  paymentGraceEndsAt?: Date | null
  enrolledBy?: Types.ObjectId
  /**
   * FIR Wave 2 Story K — Idempotency key for replay-safe side effects from the
   * Stripe webhook worker. Format: `{stripeEventId}:{operation}` (e.g.
   * `evt_abc:create-enrollment`). Nullable for backward compat with existing
   * docs; unique sparse index — existing null-key docs coexist peacefully.
   */
  idempotencyKey?: string | null
  createdAt: Date
  updatedAt: Date
}

const enrollmentSchema = new Schema<IEnrollment>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    paymentPlanId: { type: Schema.Types.ObjectId, ref: 'PaymentPlan' },
    paymentMethod: {
      type: String,
      enum: ['STRIPE', 'PADDLE', 'MANUAL_RECEIPT', 'MANUAL_ADMIN', 'COUPON'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PAID', 'PARTIAL', 'FAILED', 'WAIVED', 'PENDING'],
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'REVOKED', 'COMPLETED'],
      default: 'ACTIVE',
    },
    stripeSubscriptionId: { type: String },
    stripeCustomerId: { type: String },
    paddleCustomerId: { type: String, default: null },
    paddleTransactionId: { type: String, default: null },
    lessonsCompleted: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },
    lastActivityAt: { type: Date },
    accessGrantedAt: { type: Date },
    paymentGraceEndsAt: { type: Date, default: null },
    enrolledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    // FIR Wave 2 Story K — idempotency key for stripeWebhookWorker replays
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true },
)

enrollmentSchema.index({ studentId: 1, cohortId: 1 }, { unique: true })
enrollmentSchema.index({ cohortId: 1, status: 1 })
enrollmentSchema.index({ studentId: 1, status: 1 })
enrollmentSchema.index({ stripeSubscriptionId: 1 }, { sparse: true })
// FIR Wave 2 Story K — unique sparse index; null-valued existing docs coexist
enrollmentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })

enrollmentSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const Enrollment: Model<IEnrollment> = model<IEnrollment>('Enrollment', enrollmentSchema)
