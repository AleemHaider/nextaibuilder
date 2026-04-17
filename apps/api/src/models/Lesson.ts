// FIR-14 — Lesson model
import { Schema, model, Document, Model, Types } from 'mongoose'

export type LessonType = 'VIDEO' | 'TEXT' | 'TOOL_SETUP'

export interface ILesson extends Document {
  moduleId: Types.ObjectId
  cohortId: Types.ObjectId
  title: string
  type: LessonType
  order: number
  isPublished: boolean
  freePreview: boolean
  estimatedMinutes: number
  // VIDEO
  loomUrl?: string
  transcript?: string
  // TEXT
  content?: string
  // TOOL_SETUP
  setupStepId?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const lessonSchema = new Schema<ILesson>(
  {
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['VIDEO', 'TEXT', 'TOOL_SETUP'],
      required: true,
    },
    order: { type: Number, required: true, default: 0 },
    isPublished: { type: Boolean, default: false },
    freePreview: { type: Boolean, default: false },
    estimatedMinutes: { type: Number, default: 0 },
    // VIDEO fields
    loomUrl: { type: String, trim: true },
    transcript: { type: String },
    // TEXT fields
    content: { type: String, maxlength: 50000 },
    // TOOL_SETUP fields
    setupStepId: { type: Schema.Types.ObjectId, ref: 'SetupStep' },
  },
  { timestamps: true },
)

lessonSchema.index({ moduleId: 1, order: 1 })
lessonSchema.index({ cohortId: 1 })

lessonSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const Lesson: Model<ILesson> = model<ILesson>('Lesson', lessonSchema)
