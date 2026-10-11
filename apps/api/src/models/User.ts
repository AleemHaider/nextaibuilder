// User model (Mongoose) — SSO-only auth (Google + Apple)
// PBA-223: added isActive field; made oauthProvider/oauthId optional for invite-by-email sub-admins
// PBA-245: added passwordHash, twoFactorEnabled, passwordResetToken/Expiry, passwordSetToken/Expiry
// PBA-264: added inviteStatus and inviteAcceptedAt for sub-admin invitation tracking
// PBA-315: added notifications subdocument for student notification preferences
// PBA-318: added takesStudentCalls, schedulingUrl, isAvailableForCalls for support agent system
// FIR-23: added stripeCustomerId for Stripe customer linkage
import { Schema, model, Document, Model } from 'mongoose'

export type Role = 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN'
export type OAuthProvider = 'google' | 'apple'
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED'

export interface INotificationPreferences {
  setupReminders: boolean
  progressUpdates: boolean
  deadlineAlerts: boolean
  tipsAndEncouragement: boolean
}

export interface IUser extends Document {
  email: string
  firstName: string
  lastName: string
  role: Role
  isActive: boolean
  oauthProvider: OAuthProvider | null
  oauthId: string | null
  avatarUrl: string | null
  lastActiveAt: Date | null
  createdAt: Date
  updatedAt: Date
  // PBA-245 — password auth fields
  passwordHash?: string | null
  twoFactorEnabled: boolean
  passwordResetToken?: string | null
  passwordResetExpiry?: Date | null
  passwordSetToken?: string | null
  passwordSetExpiry?: Date | null
  // PBA-264 — invite status tracking (sub-admins only)
  inviteStatus: InviteStatus
  inviteAcceptedAt: Date | null
  // PBA-315 — notification preferences (students)
  notifications: INotificationPreferences
  // PBA-318 — support agent call booking fields
  takesStudentCalls: boolean
  schedulingUrl: string | null
  isAvailableForCalls: boolean
  // PBA-358 — coach nudge rate-limit tracking
  lastNudgedAt: Date | null
  // PBA-397 — timestamp of last progress reset; used to filter stale submissions
  progressResetAt?: Date | null
  // FIR-23 — Stripe customer linkage
  stripeCustomerId?: string | null
  // Paddle customer linkage (ctm_…)
  paddleCustomerId?: string | null
  // Sprint 4 Story 20 — soft-delete timestamp set by the student danger-zone
  // account-delete flow (POST /api/student/profile/delete). `null` means the
  // account is live; a Date means the account is tombstoned and the PII has
  // been anonymised. The middleware-level `isActive` guard still blocks
  // authentication, so a tombstoned user cannot log back in.
  deletedAt?: Date | null
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['STUDENT', 'ADMIN', 'SUPER_ADMIN'],
      default: 'STUDENT',
    },
    isActive: { type: Boolean, default: true },
    oauthProvider: { type: String, enum: ['google', 'apple'], default: null },
    oauthId: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    lastActiveAt: { type: Date, default: null },
    // PBA-245 — password auth fields
    passwordHash:        { type: String, default: null },
    twoFactorEnabled:    { type: Boolean, default: false },
    passwordResetToken:  { type: String, default: null },
    passwordResetExpiry: { type: Date,   default: null },
    passwordSetToken:    { type: String, default: null },
    passwordSetExpiry:   { type: Date,   default: null },
    // PBA-264 — invite status tracking (sub-admins only)
    // PBA-280 — extended to include REVOKED for student invite system
    inviteStatus:        { type: String, enum: ['PENDING', 'ACCEPTED', 'REVOKED'], default: 'PENDING' },
    inviteAcceptedAt:    { type: Date,   default: null },
    // PBA-315 — notification preferences (students)
    notifications: {
      setupReminders:       { type: Boolean, default: true },
      progressUpdates:      { type: Boolean, default: true },
      deadlineAlerts:       { type: Boolean, default: true },
      tipsAndEncouragement: { type: Boolean, default: true },
    },
    // PBA-318 — support agent call booking fields
    takesStudentCalls:   { type: Boolean, default: false },
    schedulingUrl:       { type: String, default: null },
    isAvailableForCalls: { type: Boolean, default: true },
    // PBA-358 — coach nudge rate-limit tracking
    lastNudgedAt:        { type: Date, default: null },
    // PBA-397 — timestamp of last progress reset; used to filter stale submissions
    progressResetAt:     { type: Date, default: null },
    // FIR-23 — Stripe customer linkage
    stripeCustomerId:    { type: String, default: null },
    paddleCustomerId:    { type: String, default: null },
    // Sprint 4 Story 20 — soft-delete timestamp (null = live, Date = tombstoned)
    deletedAt:           { type: Date, default: null },
  },
  { timestamps: true },
)

userSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
    // PBA-245 — never expose sensitive auth fields in JSON responses
    delete (ret as unknown as Record<string, unknown>)['passwordHash']
    delete (ret as unknown as Record<string, unknown>)['passwordResetToken']
    delete (ret as unknown as Record<string, unknown>)['passwordSetToken']
  },
})

userSchema.index(
  { oauthProvider: 1, oauthId: 1 },
  { unique: true, partialFilterExpression: { oauthProvider: { $type: 'string' }, oauthId: { $type: 'string' } } },
)
// PBA-245 — sparse indexes for token lookup (only index documents that have the token set)
userSchema.index({ passwordResetToken: 1 }, { sparse: true })
userSchema.index({ passwordSetToken: 1 },   { sparse: true })
// PBA-264 — sparse index for invite status filtering
userSchema.index({ inviteStatus: 1 },       { sparse: true })
// PBA-318 — sparse compound index for agent query
userSchema.index(
  { takesStudentCalls: 1, isAvailableForCalls: 1, schedulingUrl: 1 },
  { sparse: true },
)
// FIR-23 — sparse index for Stripe customer lookup
userSchema.index({ stripeCustomerId: 1 }, { sparse: true })

export const User: Model<IUser> = model<IUser>('User', userSchema)
