/**
 * PBA-315 — Migration: back-fill notifications subdocument on existing users.
 *
 * UP:
 *   - All users without a notifications field get the default preferences set.
 *
 * DOWN:
 *   - Unsets the notifications field on all users.
 *
 * Usage:
 *   npx tsx scripts/migrate-notifications.ts up
 *   npx tsx scripts/migrate-notifications.ts down
 */

import 'dotenv/config'
import mongoose from 'mongoose'

// ── Inline User model (avoid full model import to keep migration self-contained) ──

const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true })
const User = mongoose.model('User', userSchema)

// ── Helpers ──────────────────────────────────────────────────────────────────

async function connect(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI environment variable is not set.')
  await mongoose.connect(uri)
  console.log('[migrate-notifications] Connected to MongoDB.')
}

async function disconnect(): Promise<void> {
  await mongoose.disconnect()
  console.log('[migrate-notifications] Disconnected.')
}

// ── UP ────────────────────────────────────────────────────────────────────────

async function up(): Promise<void> {
  console.log('[migrate-notifications] Running UP migration...')

  const result = await User.updateMany(
    { notifications: { $exists: false } },
    {
      $set: {
        notifications: {
          setupReminders:       true,
          progressUpdates:      true,
          deadlineAlerts:       true,
          tipsAndEncouragement: true,
        },
      },
    },
  )

  console.log(
    `[migrate-notifications] Back-filled notifications on ${result.modifiedCount} user(s).`,
  )

  console.log('[migrate-notifications] UP migration complete.')
}

// ── DOWN ──────────────────────────────────────────────────────────────────────

async function down(): Promise<void> {
  console.log('[migrate-notifications] Running DOWN migration...')

  const result = await User.updateMany(
    { notifications: { $exists: true } },
    { $unset: { notifications: '' } },
  )

  console.log(
    `[migrate-notifications] Removed notifications from ${result.modifiedCount} user(s).`,
  )

  console.log('[migrate-notifications] DOWN migration complete.')
}

// ── Entry point ───────────────────────────────────────────────────────────────

const direction = process.argv[2]

if (direction !== 'up' && direction !== 'down') {
  console.error('Usage: npx tsx scripts/migrate-notifications.ts <up|down>')
  process.exit(1)
}

connect()
  .then(() => (direction === 'up' ? up() : down()))
  .then(() => disconnect())
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[migrate-notifications] Migration failed:', err)
    process.exit(1)
  })
