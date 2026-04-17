// FIR-18 — ManualPaymentRequest model
import { Schema, model, Document, Model, Types } from 'mongoose'

export type ManualPaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface IManualPaymentRequest extends Document {
  studentId: Types.ObjectId
  cohortId: Types.ObjectId
  paymentPlanId?: Types.ObjectId
  s3Key: string
  receiptUrl?: string
  note?: string
  amount?: number
  status: ManualPaymentStatus
  reviewedBy?: Types.ObjectId
  reviewedAt?: Date
  rejectionReason?: string
  enrollmentId?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const manualPaymentRequestSchema = new Schema<IManualPaymentRequest>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    paymentPlanId: { type: Schema.Types.ObjectId, ref: 'PaymentPlan' },
    s3Key: { type: String, required: true, trim: true },
    receiptUrl: { type: String },
    note: { type: String, trim: true },
    amount: { type: Number },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment' },
  },
  { timestamps: true },
)

manualPaymentRequestSchema.index({ studentId: 1, cohortId: 1, status: 1 })
manualPaymentRequestSchema.index({ status: 1, createdAt: 1 })

manualPaymentRequestSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const ManualPaymentRequest: Model<IManualPaymentRequest> = model<IManualPaymentRequest>(
  'ManualPaymentRequest',
  manualPaymentRequestSchema,
)
