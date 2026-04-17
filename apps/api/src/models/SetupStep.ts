// PBA-136 — SetupStep model (Mongoose)
// PBA-269 — Added isActive field
// PBA-300 — Added estimatedMinutes, checklist, whyItMatters, quickReferenceChecklist, keyLinks, videoTranscript
import { Schema, model, Document, Model } from 'mongoose'

export interface IKeyLink {
  label: string
  url: string
}

export interface ISetupStep extends Document {
  title: string
  order: number
  description: string
  videoUrl: string | null
  screenshotCriteria: string
  isActive: boolean
  estimatedMinutes: number | null
  checklist: string[]
  whyItMatters: string | null
  quickReferenceChecklist: string[]
  keyLinks: IKeyLink[]
  videoTranscript: string | null
  createdAt: Date
  updatedAt: Date
}

const keyLinkSchema = new Schema<IKeyLink>(
  {
    label: { type: String, required: true },
    url:   { type: String, required: true },
  },
  { _id: false },
)

const setupStepSchema = new Schema<ISetupStep>(
  {
    title:                  { type: String,  required: true, trim: true },
    order:                  { type: Number,  required: true },
    description:            { type: String,  required: true },
    videoUrl:               { type: String,  default: null },
    screenshotCriteria:     { type: String,  required: true },
    isActive:               { type: Boolean, default: true },
    estimatedMinutes:       { type: Number,  default: null },
    checklist:              { type: [String], default: [] },
    whyItMatters:           { type: String,  default: null },
    quickReferenceChecklist:{ type: [String], default: [] },
    keyLinks:               { type: [keyLinkSchema], default: [] },
    videoTranscript:        { type: String,  default: null },
  },
  { timestamps: true },
)

setupStepSchema.index({ order: 1 })

setupStepSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const SetupStep: Model<ISetupStep> = model<ISetupStep>('SetupStep', setupStepSchema)
