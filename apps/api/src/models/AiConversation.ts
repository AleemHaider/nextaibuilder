// PBA-316 — AiConversation model
// Stores multi-turn troubleshooter conversations between a student and Claude.
// Messages contain only text (never image bytes).
// Auto-expires after 90 days via TTL index on createdAt.
import { Schema, model, Document, Model, Types } from 'mongoose'

export interface IAiMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export interface IAiConversation extends Document {
  userId: Types.ObjectId
  stepId: Types.ObjectId
  type: 'TROUBLESHOOT'
  messages: IAiMessage[]
  createdAt: Date
  updatedAt: Date
}

const aiMessageSchema = new Schema<IAiMessage>(
  {
    role:      { type: String, enum: ['user', 'assistant'], required: true },
    content:   { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
)

const aiConversationSchema = new Schema<IAiConversation>(
  {
    userId:   { type: Schema.Types.ObjectId, ref: 'User',      required: true },
    stepId:   { type: Schema.Types.ObjectId, ref: 'SetupStep', required: true },
    type:     { type: String, enum: ['TROUBLESHOOT'], required: true },
    messages: { type: [aiMessageSchema], default: [] },
  },
  { timestamps: true },
)

aiConversationSchema.index({ userId: 1, stepId: 1 })
aiConversationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }) // 90 days TTL

aiConversationSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toString()
    delete (ret as unknown as Record<string, unknown>)['_id']
    delete (ret as unknown as Record<string, unknown>)['__v']
  },
})

export const AiConversation: Model<IAiConversation> = model<IAiConversation>(
  'AiConversation',
  aiConversationSchema,
)
