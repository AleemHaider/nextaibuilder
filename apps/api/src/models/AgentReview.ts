// PBA-320 — AgentReview model for support agent call review system
import { Schema, model, Document, Model, Types } from 'mongoose'

export interface IAgentReview extends Document {
  studentId: Types.ObjectId
  agentId: Types.ObjectId
  callId: Types.ObjectId
  rating: number
  comment: string
  createdAt: Date
}

const agentReviewSchema = new Schema<IAgentReview>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    agentId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    callId:    { type: Schema.Types.ObjectId, ref: 'CallBooking', required: true, unique: true },
    rating:    { type: Number, required: true, min: 1, max: 5 },
    comment:   { type: String, required: true, maxlength: 500 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
)

agentReviewSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

// Indexes for efficient querying
agentReviewSchema.index({ agentId: 1, createdAt: -1 })
agentReviewSchema.index({ studentId: 1 })

export const AgentReview: Model<IAgentReview> = model<IAgentReview>('AgentReview', agentReviewSchema)
