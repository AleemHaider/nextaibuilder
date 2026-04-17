// PBA-136 — CohortStep model (Mongoose)
// Join table: maps a SetupStep to a Cohort with an explicit ordering
import { Schema, model, Document, Model, Types } from 'mongoose'

export interface ICohortStep extends Document {
  cohortId: Types.ObjectId
  stepId: Types.ObjectId
  order: number
}

const cohortStepSchema = new Schema<ICohortStep>(
  {
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    stepId: { type: Schema.Types.ObjectId, ref: 'SetupStep', required: true },
    order: { type: Number, required: true },
  },
  { timestamps: false },
)

cohortStepSchema.index({ cohortId: 1, stepId: 1 }, { unique: true })
cohortStepSchema.index({ cohortId: 1, order: 1 })

cohortStepSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const CohortStep: Model<ICohortStep> = model<ICohortStep>('CohortStep', cohortStepSchema)
