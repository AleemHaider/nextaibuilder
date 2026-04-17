// FIR-13 — Module model
import { Schema, model, Document, Model, Types } from 'mongoose'

export interface IModule extends Document {
  cohortId: Types.ObjectId
  title: string
  description?: string
  order: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

const moduleSchema = new Schema<IModule>(
  {
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    order: { type: Number, required: true, default: 0 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true },
)

moduleSchema.index({ cohortId: 1, order: 1 })

moduleSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const Module: Model<IModule> = model<IModule>('Module', moduleSchema)
