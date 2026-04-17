// PBA-136 — Badge model (Mongoose)
import { Schema, model, Document, Model } from 'mongoose'

export interface IBadge extends Document {
  name: string
  description: string
  iconUrl: string
  triggerCriteria: string // e.g. "steps_completed:5"
}

const badgeSchema = new Schema<IBadge>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    iconUrl: { type: String, required: true },
    triggerCriteria: { type: String, required: true },
  },
  { timestamps: false },
)

badgeSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const Badge: Model<IBadge> = model<IBadge>('Badge', badgeSchema)
