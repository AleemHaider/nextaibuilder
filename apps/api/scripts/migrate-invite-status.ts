/**
 * PBA-264 — Migration: back-fill inviteStatus on existing sub-admin (ADMIN role) users.
 *
 * UP:
 *   - ADMIN users with passwordHash set  → inviteStatus: 'ACCEPTED', inviteAcceptedAt: updatedAt
 *   - ADMIN users without passwordHash   → inviteStatus: 'PENDING'
 *
 * DOWN:
 *   - Unsets inviteStatus and inviteAcceptedAt on all ADMIN users
 *
 * Usage:
 *   npx tsx scripts/migrate-invite-status.ts up
 *   npx tsx scripts/migrate-invite-status.ts down
 */

import 'dotenv/config'
import mongoose from 'mongoose'

// ── Inline User model (avoid full model import to keep migration self-contained) ──

const userSchema = new mongoose.Schema(
  {
    role:             String,
    passwordHash:     { type: String, default: null },
    inviteStatus:     { type: String, default: null },
    inviteAcceptedAt: { type: Date,   default: null },
    updatedAt:        Date,
  },
  { timestamps: true },
)

const User = mongoose.model('User', userSchema)

// ── Helpers ──────────────────────────────────────────────────────────────────

async function connect(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI environment variable is not set.')
  await mongoose.connect(uri)
  console.log('[migrate-invite-status] Connected to MongoDB.')
}

async function disconnect(): Promise<void> {
  await mongoose.disconnect()
  console.log('[migrate-invite-status] Disconnected.')
}

// ── UP ────────────────────────────────────────────────────────────────────────

async function up(): Promise<void> {
  console.log('[migrate-invite-status] Running UP migration...')

  // 1. Back-fill ACCEPTED for ADMIN users who already have a passwordHash
  const acceptedResult = await User.updateMany(
    {
      role:         'ADMIN',
      passwordHash: { $ne: null },
      // Only update if not already set (idempotent)
      inviteStatus: { $ne: 'ACCEPTED' },
    },
    [
      {
        $set: {
          inviteStatus:     'ACCEPTED',
          // Use updatedAt as a best-effort accepted-at timestamp
          inviteAcceptedAt: '$updatedAt',
        },
      },
    ],
  )

  console.log(
    `[migrate-invite-status] Marked ${acceptedResult.modifiedCount} ADMIN user(s) as ACCEPTED.`,
  )

  // 2. Back-fill PENDING for ADMIN users without a passwordHash
  const pendingResult = await User.updateMany(
    {
      role:         'ADMIN',
      $or: [{ passwordHash: null }, { passwordHash: { $exists: false } }],
      // Only update if not already set (idempotent)
      inviteStatus: { $ne: 'PENDING' },
    },
    {
      $set: {
        inviteStatus:     'PENDING',
        inviteAcceptedAt: null,
      },
    },
  )

  console.log(
    `[migrate-invite-status] Marked ${pendingResult.modifiedCount} ADMIN user(s) as PENDING.`,
  )

  console.log('[migrate-invite-status] UP migration complete.')
}

// ── DOWN ──────────────────────────────────────────────────────────────────────

async function down(): Promise<void> {
  console.log('[migrate-invite-status] Running DOWN migration...')

  const result = await User.updateMany(
    { role: 'ADMIN' },
    {
      $unset: {
        inviteStatus:     '',
        inviteAcceptedAt: '',
      },
    },
  )

  console.log(
    `[migrate-invite-status] Unset inviteStatus/inviteAcceptedAt on ${result.modifiedCount} ADMIN user(s).`,
  )

  console.log('[migrate-invite-status] DOWN migration complete.')
}

// ── Entry point ───────────────────────────────────────────────────────────────

const direction = process.argv[2]

if (direction !== 'up' && direction !== 'down') {
  console.error('Usage: npx tsx scripts/migrate-invite-status.ts <up|down>')
  process.exit(1)
}

connect()
  .then(() => (direction === 'up' ? up() : down()))
  .then(() => disconnect())
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[migrate-invite-status] Migration failed:', err)
    process.exit(1)
  })
