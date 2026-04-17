// FIR-15 — PaymentPlan model
import { Schema, model, Document, Model, Types } from 'mongoose'

export type PlanType = 'ONE_TIME' | 'INSTALLMENT'
export type InstallmentNumber = 1 | 2 | 3
export type InstallmentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'GRACE'

export interface IInstallment {
  number: InstallmentNumber
  amount: number
  dueDate: Date
  status: InstallmentStatus
  stripePaymentIntentId?: string
  paidAt?: Date
}

export interface IPaymentPlan extends Document {
  cohortId: Types.ObjectId
  name: string
  type: PlanType
  currency: string
  totalAmount: number
  isActive: boolean
  // INSTALLMENT only
  installments?: IInstallment[]
  intervalDays?: number
  createdAt: Date
  updatedAt: Date
}

const installmentSchema = new Schema<IInstallment>(
  {
    number: { type: Number, enum: [1, 2, 3], required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'GRACE'],
      default: 'PENDING',
    },
    stripePaymentIntentId: { type: String },
    paidAt: { type: Date },
  },
  { _id: false },
)

const paymentPlanSchema = new Schema<IPaymentPlan>(
  {
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['ONE_TIME', 'INSTALLMENT'],
      required: true,
    },
    currency: { type: String, default: 'usd', lowercase: true, trim: true },
    totalAmount: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    // INSTALLMENT only
    installments: { type: [installmentSchema] },
    intervalDays: { type: Number, default: 30 },
  },
  { timestamps: true },
)

paymentPlanSchema.index({ cohortId: 1, type: 1 })

paymentPlanSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const PaymentPlan: Model<IPaymentPlan> = model<IPaymentPlan>('PaymentPlan', paymentPlanSchema)
