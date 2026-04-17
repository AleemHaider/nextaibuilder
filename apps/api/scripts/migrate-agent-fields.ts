// PBA-318 — Migration: add takesStudentCalls, schedulingUrl, isAvailableForCalls to admin users
// Usage:
//   npx tsx scripts/migrate-agent-fields.ts up
//   npx tsx scripts/migrate-agent-fields.ts down

import mongoose from 'mongoose'
import { config } from 'dotenv'

config()

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/pba'

async function up() {
  console.log('Running migration UP: adding agent fields to ADMIN users...')

  const result = await mongoose.connection.db
    ?.collection('users')
    .updateMany(
      {
        role: { $in: ['ADMIN', 'SUPER_ADMIN'] },
        takesStudentCalls: { $exists: false },
      },
      {
        $set: {
          takesStudentCalls: false,
          schedulingUrl: null,
          isAvailableForCalls: true,
        },
      },
    )

  console.log(`Migration UP complete. Modified ${result?.modifiedCount ?? 0} users.`)
}

async function down() {
  console.log('Running migration DOWN: removing agent fields from all users...')

  const result = await mongoose.connection.db
    ?.collection('users')
    .updateMany(
      { takesStudentCalls: { $exists: true } },
      {
        $unset: {
          takesStudentCalls: '',
          schedulingUrl: '',
          isAvailableForCalls: '',
        },
      },
    )

  console.log(`Migration DOWN complete. Modified ${result?.modifiedCount ?? 0} users.`)
}

async function main() {
  const direction = process.argv[2]

  if (direction !== 'up' && direction !== 'down') {
    console.error('Usage: npx tsx scripts/migrate-agent-fields.ts [up|down]')
    process.exit(1)
  }

  await mongoose.connect(MONGO_URI)
  console.log(`Connected to MongoDB: ${MONGO_URI}`)

  if (direction === 'up') {
    await up()
  } else {
    await down()
  }

  await mongoose.disconnect()
  console.log('Disconnected from MongoDB.')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
