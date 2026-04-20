// PBA-136 — Cohort model (Mongoose)
// FIR-22: added type, slug, tagline, description, coverImageKey, paymentPlanIds, maxSeats,
//         isPublished, enrollmentCount, liveStartDate, liveEndDate
import { Schema, model, Document, Model, Types } from 'mongoose'

export type CohortStatus = 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
export type CohortType = 'RECORDED' | 'LIVE' | 'COMBINED'

export interface ICohort extends Document {
  name: string
  code: string
  startDate: Date
  endDate: Date
  status: CohortStatus
  createdAt: Date
  updatedAt: Date
  // FIR-22 — extended fields
  type?: CohortType | null
  slug?: string | null
  tagline?: string | null
  description?: string | null
  coverImageKey?: string | null
  paymentPlanIds?: Types.ObjectId[]
  maxSeats?: number | null
  isPublished?: boolean
  enrollmentCount?: number
  liveStartDate?: Date | null
  liveEndDate?: Date | null
  // NAB-P0-2 — course marketing content arrays
  learningOutcomes?: string[]
  requirements?: string[]
  targetAudience?: string[]
}

const cohortSchema = new Schema<ICohort>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED'],
      default: 'DRAFT',
    },
    // FIR-22 — extended fields
    type: {
      type: String,
      enum: ['RECORDED', 'LIVE', 'COMBINED'],
      default: null,
    },
    slug: { type: String, lowercase: true, trim: true, default: null },
    tagline: { type: String, trim: true, default: null },
    description: { type: String, default: null },
    coverImageKey: { type: String, default: null },
    paymentPlanIds: [{ type: Schema.Types.ObjectId, ref: 'PaymentPlan' }],
    maxSeats: { type: Number, default: null },
    isPublished: { type: Boolean, default: false },
    enrollmentCount: { type: Number, default: 0 },
    liveStartDate: { type: Date, default: null },
    liveEndDate: { type: Date, default: null },
    // NAB-P0-2 — learning outcomes / requirements / target audience.
    // Mongoose applies defaults lazily on load, so existing documents without
    // the field will still return [] via `get` access once loaded. We also
    // mirror the API-side caps (12/10/8, each ≤140 chars) as schema-level
    // validators so direct Mongoose writes (e.g. from workers/migrations)
    // cannot bypass the contract.
    learningOutcomes: {
      type: [{ type: String, trim: true, maxlength: 140 }],
      default: [],
      validate: {
        validator: (v: string[]) => !Array.isArray(v) || v.length <= 12,
        message: 'learningOutcomes supports at most 12 entries.',
      },
    },
    requirements: {
      type: [{ type: String, trim: true, maxlength: 140 }],
      default: [],
      validate: {
        validator: (v: string[]) => !Array.isArray(v) || v.length <= 10,
        message: 'requirements supports at most 10 entries.',
      },
    },
    targetAudience: {
      type: [{ type: String, trim: true, maxlength: 140 }],
      default: [],
      validate: {
        validator: (v: string[]) => !Array.isArray(v) || v.length <= 8,
        message: 'targetAudience supports at most 8 entries.',
      },
    },
  },
  { timestamps: true },
)

// FIR-22 — new indexes
cohortSchema.index({ slug: 1 }, { unique: true, sparse: true })
cohortSchema.index({ isPublished: 1, type: 1 })

cohortSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const Cohort: Model<ICohort> = model<ICohort>('Cohort', cohortSchema)
