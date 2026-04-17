// PBA-136 — AuditLog model (Mongoose)
import { Schema, model, Document, Model, Types } from 'mongoose'

export interface IAuditLog extends Document {
  adminId: Types.ObjectId
  action: string
  targetType: string
  targetId: string
  note: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    adminId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action:     { type: String, required: true },
    targetType: { type: String, required: true },
    targetId:   { type: String, required: true },
    note:       { type: String, default: null },
    metadata:   { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

auditLogSchema.index({ adminId: 1 })
auditLogSchema.index({ targetType: 1, targetId: 1 })
auditLogSchema.index({ adminId: 1, createdAt: -1 }) // admin audit trail queries
auditLogSchema.index({ targetId: 1 })               // per-submission audit lookups

auditLogSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const AuditLog: Model<IAuditLog> = model<IAuditLog>('AuditLog', auditLogSchema)
