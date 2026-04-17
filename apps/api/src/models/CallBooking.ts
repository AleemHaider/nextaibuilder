// PBA-319 — CallBooking model for support agent call booking system
import { Schema, model, Document, Model, Types } from 'mongoose'

export type CallBookingStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface ICallBooking extends Document {
  studentId: Types.ObjectId
  agentId: Types.ObjectId
  status: CallBookingStatus
  schedulingUrl: string
  bookedAt: Date
  completedAt: Date | null
  cancelledAt: Date | null
}

const callBookingSchema = new Schema<ICallBooking>(
  {
    studentId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    agentId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status:       { type: String, enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' },
    schedulingUrl: { type: String, required: true },
    bookedAt:     { type: Date, default: () => new Date() },
    completedAt:  { type: Date, default: null },
    cancelledAt:  { type: Date, default: null },
  },
  { timestamps: false },
)

callBookingSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

// Indexes for efficient querying
callBookingSchema.index({ studentId: 1, status: 1 })
callBookingSchema.index({ agentId: 1, status: 1 })
callBookingSchema.index({ agentId: 1, completedAt: -1 })

export const CallBooking: Model<ICallBooking> = model<ICallBooking>('CallBooking', callBookingSchema)
