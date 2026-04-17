// PBA legacy model — stub for backward compatibility
import { Schema, model, Document, Model, Types } from 'mongoose'

export interface ICohortMembership extends Document {
  userId: Types.ObjectId
  cohortId: Types.ObjectId
  completionStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'DEADLINE_MISSED'
  joinedAt: Date
}

const cohortMembershipSchema = new Schema<ICohortMembership>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    completionStatus: {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'DEADLINE_MISSED'],
      default: 'NOT_STARTED',
    },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
)

cohortMembershipSchema.index({ userId: 1 }, { unique: true })
cohortMembershipSchema.index({ cohortId: 1 })

cohortMembershipSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const CohortMembership: Model<ICohortMembership> = model<ICohortMembership>(
  'CohortMembership',
  cohortMembershipSchema,
)
