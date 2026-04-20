// FIR-14 — Lesson model
// NAB-P0-5 — Multi-provider video support: added videoProvider / videoUrl /
// videoDurationSeconds. The legacy `loomUrl` field is kept for back-compat
// (marked @deprecated); a pre-save hook mirrors it into the new fields when
// older writers only populate `loomUrl`.
// NAB-P0-4 — Rich-text authoring: added `richContent` (HTML ≤100k) and
// `contentFormat` ('MARKDOWN' | 'RICH_HTML') for the TipTap-backed editor.
// Legacy `content` is kept verbatim; writers that populate `richContent`
// also write a plain-text fallback into `content` so older render paths
// keep working without a migration.
import { Schema, model, Document, Model, Types } from 'mongoose'

export type LessonType = 'VIDEO' | 'TEXT' | 'TOOL_SETUP'
export type VideoProvider = 'LOOM' | 'YOUTUBE' | 'VIMEO'
export type ContentFormat = 'MARKDOWN' | 'RICH_HTML'

export interface ILesson extends Document {
  moduleId: Types.ObjectId
  cohortId: Types.ObjectId
  title: string
  type: LessonType
  order: number
  isPublished: boolean
  freePreview: boolean
  estimatedMinutes: number
  // VIDEO — generic, multi-provider (NAB-P0-5)
  videoProvider?: VideoProvider | null
  videoUrl?: string | null
  videoDurationSeconds?: number | null
  /** @deprecated Use `videoUrl` + `videoProvider` instead. Retained for back-compat only. */
  loomUrl?: string
  transcript?: string
  // TEXT
  content?: string
  /** NAB-P0-4 — TipTap-authored HTML body (sanitized at render time). */
  richContent?: string | null
  /** NAB-P0-4 — distinguishes a plain-text / legacy `content` from a rich body. */
  contentFormat?: ContentFormat | null
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
    // VIDEO fields — new multi-provider shape (NAB-P0-5)
    videoProvider: {
      type: String,
      enum: ['LOOM', 'YOUTUBE', 'VIMEO', null],
      default: null,
    },
    videoUrl:             { type: String, trim: true, default: null },
    videoDurationSeconds: { type: Number, default: null },
    // VIDEO — legacy
    /** @deprecated */
    loomUrl: { type: String, trim: true },
    transcript: { type: String },
    // TEXT fields
    content:     { type: String, maxlength: 50000 },
    // NAB-P0-4 — Rich HTML body (TipTap). Larger cap than plain-text `content`
    // because the HTML envelope adds overhead even for modestly-sized lessons.
    richContent: { type: String, maxlength: 100000, default: null },
    // NAB-P0-4 — Null until a writer actually picks a format; legacy docs
    // written via the pre-P0-4 routes stay null.
    contentFormat: {
      type: String,
      enum: ['MARKDOWN', 'RICH_HTML', null],
      default: null,
    },
    // TOOL_SETUP fields
    setupStepId: { type: Schema.Types.ObjectId, ref: 'SetupStep' },
  },
  { timestamps: true },
)

lessonSchema.index({ moduleId: 1, order: 1 })
lessonSchema.index({ cohortId: 1 })

// ── Back-compat migration (writer-side) ──────────────────────────────────
// If a document is saved with only the legacy `loomUrl` field populated and
// no `videoUrl`, mirror the URL into `videoUrl` and mark the provider as
// LOOM. This keeps historic data usable without a one-off batch script —
// documents migrate lazily as they are edited.
lessonSchema.pre('save', function migrateLoomUrl(next) {
  const doc = this as ILesson
  if (!doc.videoUrl && doc.loomUrl) {
    doc.videoUrl = doc.loomUrl
    if (!doc.videoProvider) doc.videoProvider = 'LOOM'
  }
  next()
})

lessonSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const Lesson: Model<ILesson> = model<ILesson>('Lesson', lessonSchema)
