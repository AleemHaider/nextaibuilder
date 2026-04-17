/**
 * PBA-269 — Migration: set isActive: true on all existing SetupStep documents
 *
 * Run:
 *   npx tsx scripts/migrate-isactive.ts up
 */

import 'dotenv/config'
import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGODB_URI ?? ''

if (!MONGO_URI) {
  console.error('MONGODB_URI environment variable is not set')
  process.exit(1)
}

async function up() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')

  const result = await mongoose.connection
    .collection('setupsteps')
    .updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true } },
    )

  console.log(`Migration complete. Modified ${result.modifiedCount} documents.`)
  await mongoose.disconnect()
}

const command = process.argv[2]

if (command === 'up') {
  up().catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
} else {
  console.error('Usage: npx tsx scripts/migrate-isactive.ts up')
  process.exit(1)
}
