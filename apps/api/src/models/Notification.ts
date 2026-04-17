// PBA-379 — Notification model (Mongoose)
import { Schema, model, Document, Model, Types } from 'mongoose'

export type NotificationType =
  | 'STEP_APPROVED'
  | 'STEP_REJECTED'
  | 'BADGE_EARNED'
  | 'BROADCAST'
  | 'DEADLINE_WARNING'

export interface INotification extends Document {
  userId: Types.ObjectId
  type: NotificationType
  title: string
  body: string
  read: boolean
  /** Optional deep-link target for client navigation */
  linkPath: string | null
  createdAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['STEP_APPROVED', 'STEP_REJECTED', 'BADGE_EARNED', 'BROADCAST', 'DEADLINE_WARNING'],
      required: true,
    },
    title:    { type: String, required: true, trim: true, maxlength: 200 },
    body:     { type: String, required: true, trim: true, maxlength: 1000 },
    read:     { type: Boolean, default: false },
    linkPath: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// Compound index for fast per-user inbox queries (sorted by recency, filtered by read status)
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 })

notificationSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const Notification: Model<INotification> = model<INotification>('Notification', notificationSchema)
