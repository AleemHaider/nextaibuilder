// FIR-19 — LiveSession model
import { Schema, model, Document, Model, Types } from 'mongoose'

export interface ILiveSession extends Document {
  cohortId: Types.ObjectId
  title: string
  description?: string
  scheduledAt: Date
  durationMinutes: number
  zoomUrl: string
  zoomMeetingId?: string
  recordingUrl?: string
  order: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

const liveSessionSchema = new Schema<ILiveSession>(
  {
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 90 },
    zoomUrl: { type: String, required: true, trim: true },
    zoomMeetingId: { type: String, trim: true },
    recordingUrl: { type: String, trim: true },
    order: { type: Number, required: true, default: 0 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true },
)

liveSessionSchema.index({ cohortId: 1, scheduledAt: 1 })
liveSessionSchema.index({ cohortId: 1, order: 1 })

liveSessionSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const LiveSession: Model<ILiveSession> = model<ILiveSession>('LiveSession', liveSessionSchema)
