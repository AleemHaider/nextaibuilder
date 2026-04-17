// FIR-20 — StudentLesson model (progress scoped by enrollmentId)
import { Schema, model, Document, Model, Types } from 'mongoose'

export type LessonStatus = 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED'

export interface IStudentLesson extends Document {
  studentId: Types.ObjectId
  enrollmentId: Types.ObjectId
  lessonId: Types.ObjectId
  cohortId: Types.ObjectId
  status: LessonStatus
  watchPositionSeconds?: number
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const studentLessonSchema = new Schema<IStudentLesson>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    status: {
      type: String,
      enum: ['LOCKED', 'IN_PROGRESS', 'COMPLETED'],
      default: 'LOCKED',
    },
    watchPositionSeconds: { type: Number },
    completedAt: { type: Date },
  },
  { timestamps: true },
)

studentLessonSchema.index({ enrollmentId: 1, lessonId: 1 }, { unique: true })
studentLessonSchema.index({ enrollmentId: 1, status: 1 })
studentLessonSchema.index({ studentId: 1, cohortId: 1 })

studentLessonSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const StudentLesson: Model<IStudentLesson> = model<IStudentLesson>(
  'StudentLesson',
  studentLessonSchema,
)
