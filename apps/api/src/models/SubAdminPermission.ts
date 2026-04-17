// PBA-224 — SubAdminPermission Mongoose model
// One document per sub-admin user; stores the set of granted permissions.
// SUPER_ADMIN users bypass this table entirely (checked in requirePermission).

import { Schema, model, Document, Model, Types } from 'mongoose'
import { PERMISSIONS, type Permission } from '../lib/permissions.js'

export interface ISubAdminPermission extends Document {
  userId: Types.ObjectId
  permissions: Permission[]
  grantedBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const subAdminPermissionSchema = new Schema<ISubAdminPermission>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    permissions: {
      type: [String],
      enum: PERMISSIONS,
      default: [],
    },
    grantedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
)

subAdminPermissionSchema.index({ userId: 1 }, { unique: true })

subAdminPermissionSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const SubAdminPermission: Model<ISubAdminPermission> = model<ISubAdminPermission>(
  'SubAdminPermission',
  subAdminPermissionSchema,
)
