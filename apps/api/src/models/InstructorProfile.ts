// NAB-P0-3 — InstructorProfile model
//
// Captures the public-facing instructor identity that storefront cohort
// detail pages render (name, title, bio, headshot, social links). Linked
// back to a User via `userId` so we can surface admin authorship for
// analytics / audit, but the storefront never needs that link — the
// profile doc is the single source of truth for the instructor card.
import { Schema, model, Document, Model, Types } from 'mongoose'

export type InstructorSocialPlatform =
  | 'TWITTER'
  | 'LINKEDIN'
  | 'GITHUB'
  | 'YOUTUBE'
  | 'WEBSITE'
  | 'X'

export interface IInstructorSocialLink {
  platform: InstructorSocialPlatform
  url: string
}

export interface IInstructorProfile extends Document {
  userId: Types.ObjectId
  name: string
  title: string
  // Stored as HTML post-sanitize. Rendered with DOMPurify on the storefront
  // via sanitizeHtml() — do not trust this field blindly.
  bio: string
  avatarKey: string | null
  socialLinks: IInstructorSocialLink[]
  createdAt: Date
  updatedAt: Date
}

const socialLinkSchema = new Schema<IInstructorSocialLink>(
  {
    platform: {
      type: String,
      enum: ['TWITTER', 'LINKEDIN', 'GITHUB', 'YOUTUBE', 'WEBSITE', 'X'],
      required: true,
    },
    url: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false },
)

const instructorProfileSchema = new Schema<IInstructorProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    title:     { type: String, trim: true, maxlength: 200, default: '' },
    bio:       { type: String, maxlength: 5000, default: '' },
    avatarKey: { type: String, default: null },
    socialLinks: {
      type: [socialLinkSchema],
      default: [],
      validate: {
        validator: (v: IInstructorSocialLink[]) =>
          !Array.isArray(v) || v.length <= 5,
        message: 'socialLinks supports at most 5 entries.',
      },
    },
  },
  { timestamps: true },
)

instructorProfileSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const InstructorProfile: Model<IInstructorProfile> =
  model<IInstructorProfile>('InstructorProfile', instructorProfileSchema)
