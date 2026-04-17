// fix-duplicate-names.ts
// Fixes students whose firstName === lastName (caused by batch-invite
// deriving placeholder names from single-part email local-parts).
//
// Run: tsx --env-file=.env scripts/fix-duplicate-names.ts
//
// What it does:
//   • Finds all STUDENT users where firstName === lastName (case-insensitive)
//   • Clears lastName to '' so the name displays as a single token
//   • Prints a report of every user changed
//   • Dry-run mode by default — pass --apply to actually write to DB

import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27018/pba_dev'
const DRY_RUN   = !process.argv.includes('--apply')

await mongoose.connect(MONGO_URI)
const db = mongoose.connection.db!

if (DRY_RUN) {
  console.log('DRY RUN — no changes will be written. Pass --apply to save.\n')
}

// Find students where firstName === lastName (exact match, case-insensitive)
const affected = await db.collection('users').find({
  role: 'STUDENT',
  $expr: {
    $eq: [
      { $toLower: '$firstName' },
      { $toLower: '$lastName'  },
    ],
  },
}).toArray()

if (affected.length === 0) {
  console.log('No affected users found. Nothing to fix.')
  await mongoose.disconnect()
  process.exit(0)
}

console.log(`Found ${affected.length} user(s) with duplicated first/last name:\n`)

for (const u of affected) {
  console.log(`  ${u.email}  →  "${u.firstName}" "${u.lastName}"  [${u.inviteStatus}]`)
}

if (!DRY_RUN) {
  const ids = affected.map((u) => u._id)
  const result = await db.collection('users').updateMany(
    { _id: { $in: ids } },
    { $set: { lastName: '' } },
  )
  console.log(`\nUpdated ${result.modifiedCount} user(s). lastName cleared to ''.`)
} else {
  console.log(`\nRun with --apply to clear lastName for these ${affected.length} user(s).`)
}

await mongoose.disconnect()
