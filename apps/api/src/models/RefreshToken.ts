// PBA-136 — RefreshToken model (Mongoose)
import { Schema, model, Document, Model, Types, SchemaTypes } from 'mongoose'

export interface IRefreshToken extends Document {
  userId: Types.ObjectId
  tokenHash: string
  fastLookup: string   // SHA-256(rawToken) — fast O(1) index lookup, avoids bcrypt loop
  expiresAt: Date
  revokedAt: Date | null
  createdAt: Date
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId:     { type: SchemaTypes.ObjectId, ref: 'User', required: true },
    tokenHash:  { type: String, required: true, unique: true },
    fastLookup: { type: String, required: true, unique: true },
    expiresAt:  { type: Date, required: true },
    revokedAt:  { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

refreshTokenSchema.index({ userId: 1 })
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL index

refreshTokenSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ;(ret as unknown as Record<string, unknown>)['id'] = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const RefreshToken: Model<IRefreshToken> = model<IRefreshToken>(
  'RefreshToken',
  refreshTokenSchema,
)
