// PBA-136 — StudentStep model (Mongoose)
// Tracks a single student's progress on a specific setup step
import { Schema, model, Document, Model, Types } from 'mongoose'

export type StudentStepStatus =
  | 'LOCKED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'COMPLETE'
  | 'OVERRIDE_PASS'
  | 'OVERRIDE_FAIL'

export interface IStudentStep extends Document {
  userId: Types.ObjectId
  stepId: Types.ObjectId
  status: StudentStepStatus
  attempts: number
  unlockedAt: Date | null
  completedAt: Date | null
}

const studentStepSchema = new Schema<IStudentStep>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stepId: { type: Schema.Types.ObjectId, ref: 'SetupStep', required: true },
    status: {
      type: String,
      enum: ['LOCKED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETE', 'OVERRIDE_PASS', 'OVERRIDE_FAIL'],
      default: 'LOCKED',
    },
    attempts: { type: Number, default: 0 },
    unlockedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: false },
)

studentStepSchema.index({ userId: 1, stepId: 1 }, { unique: true })
studentStepSchema.index({ userId: 1, status: 1 }) // badge service and dashboard queries

studentStepSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const StudentStep: Model<IStudentStep> = model<IStudentStep>(
  'StudentStep',
  studentStepSchema,
)
