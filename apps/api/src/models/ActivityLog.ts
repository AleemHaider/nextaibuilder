// PBA-360 — ActivityLog model
// Tracks meaningful student-scoped lifecycle events for the Activity Log tab.
// Actors can be admins, students, or null (system/automated events).

import { Schema, model, Document, Model, Types } from 'mongoose'

// ── Event type union ────────────────────────────────────────────────────────

export type ActivityLogType =
  | 'step_unlocked'
  | 'step_completed'
  | 'step_override_pass'
  | 'step_override_fail'
  | 'screenshot_submitted'
  | 'screenshot_approved'
  | 'screenshot_rejected'
  | 'nudge_sent'
  | 'invite_sent'
  | 'invite_accepted'
  | 'invite_revoked'
  | 'cohort_enrolled'
  | 'cohort_removed'
  | 'cohort_transferred'
  | 'cohort_transfer'
  | 'progress_reset'
  | 'login'
  | 'profile_updated'

export type ActorRole = 'student' | 'admin' | 'sub_admin' | 'system'

// ── Interface ───────────────────────────────────────────────────────────────

export interface IActivityLog extends Document {
  userId:    Types.ObjectId               // the student this event belongs to
  actorId:   Types.ObjectId | null        // who triggered it (null = system/automated)
  actorRole: ActorRole
  type:      ActivityLogType
  metadata:  Record<string, unknown>
  createdAt: Date
}

// ── Schema ──────────────────────────────────────────────────────────────────

const activityLogSchema = new Schema<IActivityLog>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    actorId: {
      type:    Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },
    actorRole: {
      type:     String,
      enum:     ['student', 'admin', 'sub_admin', 'system'] satisfies ActorRole[],
      required: true,
    },
    type: {
      type:     String,
      enum:     [
        'step_unlocked',
        'step_completed',
        'step_override_pass',
        'step_override_fail',
        'screenshot_submitted',
        'screenshot_approved',
        'screenshot_rejected',
        'nudge_sent',
        'invite_sent',
        'invite_accepted',
        'invite_revoked',
        'cohort_enrolled',
        'cohort_removed',
        'cohort_transferred',
        'cohort_transfer',
        'progress_reset',
        'login',
        'profile_updated',
      ] satisfies ActivityLogType[],
      required: true,
    },
    metadata: {
      type:    Schema.Types.Mixed,
      default: {},
    },
  },
  {
    // updatedAt not needed — activity log entries are append-only
    timestamps: { createdAt: true, updatedAt: false },
  },
)

// Compound index — the primary query pattern: all events for a student, newest first
activityLogSchema.index({ userId: 1, createdAt: -1 })

activityLogSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const ActivityLog: Model<IActivityLog> = model<IActivityLog>('ActivityLog', activityLogSchema)
