// PBA-136 — UserBadge model (Mongoose)
// Records when a student earns a badge
import { Schema, model, Document, Model, Types } from 'mongoose'

export interface IUserBadge extends Document {
  userId: Types.ObjectId
  badgeId: Types.ObjectId
  earnedAt: Date
}

const userBadgeSchema = new Schema<IUserBadge>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    badgeId: { type: Schema.Types.ObjectId, ref: 'Badge', required: true },
    earnedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
)

userBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true })

userBadgeSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const UserBadge: Model<IUserBadge> = model<IUserBadge>('UserBadge', userBadgeSchema)
