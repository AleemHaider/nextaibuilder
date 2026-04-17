// PBA-136 — StepSubmission model (Mongoose)
// A screenshot submission for a given student step
import { Schema, model, Document, Model, Types } from 'mongoose'

export type SubmissionStatus =
  | 'PENDING'
  | 'ML_PROCESSING'
  | 'HUMAN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

export interface IStepSubmission extends Document {
  userId: Types.ObjectId
  stepId: Types.ObjectId
  studentStepId: Types.ObjectId
  s3Key: string
  status: SubmissionStatus
  mlScore: number | null
  mlFeedback: string | null
  mlReasoning: string | null
  reviewedById: Types.ObjectId | null
  reviewedAt: Date | null
  reviewNote: string | null
  createdAt: Date
  updatedAt: Date
}

const stepSubmissionSchema = new Schema<IStepSubmission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stepId: { type: Schema.Types.ObjectId, ref: 'SetupStep', required: true },
    studentStepId: { type: Schema.Types.ObjectId, ref: 'StudentStep', required: true },
    s3Key: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ML_PROCESSING', 'HUMAN_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    mlScore: { type: Number, default: null },
    mlFeedback: { type: String, default: null },
    mlReasoning: { type: String, default: null },
    reviewedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: null },
  },
  { timestamps: true },
)

stepSubmissionSchema.index({ status: 1 }) // admin review queue
stepSubmissionSchema.index({ userId: 1, stepId: 1 })
stepSubmissionSchema.index({ userId: 1, stepId: 1, status: 1 }) // pending-check on every presign/submit

stepSubmissionSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const StepSubmission: Model<IStepSubmission> = model<IStepSubmission>(
  'StepSubmission',
  stepSubmissionSchema,
)
