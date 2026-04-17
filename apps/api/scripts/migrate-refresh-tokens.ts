// Clears refresh tokens that predate the fastLookup field.
// These tokens can no longer be used for refresh/logout anyway
// since the new code expects fastLookup to exist.
// Users will simply be asked to log in again (one-time).
//
// Run: npx tsx --env-file=.env scripts/migrate-refresh-tokens.ts

import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27018/pba_dev'

await mongoose.connect(MONGO_URI)

const result = await mongoose.connection.db!
  .collection('refreshtokens')
  .deleteMany({ fastLookup: { $exists: false } })

console.log(`Removed ${result.deletedCount} old refresh token(s) without fastLookup.`)
console.log('Affected users will be prompted to log in again — one-time only.')

await mongoose.disconnect()
