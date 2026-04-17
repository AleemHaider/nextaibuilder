// PBA-136 — MongoDB connection via Mongoose
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/pba_dev'

let isConnected = false

export async function connectMongoDB(): Promise<void> {
  if (isConnected) return

  mongoose.set('strictQuery', true)

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  })

  isConnected = true
  console.info('[MongoDB] connected to', MONGODB_URI)
}

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] connection error:', err.message)
  isConnected = false
})

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] disconnected')
  isConnected = false
})

export { mongoose }
