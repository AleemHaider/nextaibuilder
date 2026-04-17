// PBA-136 — Certificate model (Mongoose)
// FIR-24: added cohortId, enrollmentId, certificateToken, credentialId
import { Schema, model, Document, Model, Types } from 'mongoose'
import crypto from 'node:crypto'

export interface ICertificate extends Document {
  userId: Types.ObjectId
  publicToken: string
  issuedAt: Date
  // FIR-24 — extended fields
  cohortId?: Types.ObjectId | null
  enrollmentId?: Types.ObjectId | null
  certificateToken?: string | null
  credentialId?: string | null
}

const certificateSchema = new Schema<ICertificate>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    publicToken: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
    },
    issuedAt: { type: Date, default: () => new Date() },
    // FIR-24 — extended fields
    cohortId: { type: Schema.Types.ObjectId, ref: 'Cohort', default: null },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', default: null },
    certificateToken: { type: String, default: null },
    credentialId: { type: String, default: null },
  },
  { timestamps: false },
)

// FIR-24 — new indexes
certificateSchema.index({ certificateToken: 1 }, { unique: true, sparse: true })
certificateSchema.index({ enrollmentId: 1 }, { sparse: true })
certificateSchema.index({ credentialId: 1 }, { unique: true, sparse: true })

certificateSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const Certificate: Model<ICertificate> = model<ICertificate>(
  'Certificate',
  certificateSchema,
)
