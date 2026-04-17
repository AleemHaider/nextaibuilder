/**
 * PBA-316 — Migration: back-fill mlReasoning field on existing StepSubmission documents.
 *
 * UP:   Set mlReasoning: null on all submissions that don't have the field yet.
 * DOWN: Unset mlReasoning from all submissions.
 *
 * Usage:
 *   npx tsx scripts/migrate-ml-reasoning.ts up
 *   npx tsx scripts/migrate-ml-reasoning.ts down
 */

import 'dotenv/config'
import mongoose from 'mongoose'

// ── Inline schema (avoid full model import to keep migration self-contained) ──

const stepSubmissionSchema = new mongoose.Schema(
  { mlReasoning: { type: String, default: null } },
  { strict: false, timestamps: true },
)

const StepSubmission = mongoose.model('StepSubmission', stepSubmissionSchema)

// ── Helpers ──────────────────────────────────────────────────────────────────

async function connect(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI environment variable is not set.')
  await mongoose.connect(uri)
  console.log('[migrate-ml-reasoning] Connected to MongoDB.')
}

async function disconnect(): Promise<void> {
  await mongoose.disconnect()
  console.log('[migrate-ml-reasoning] Disconnected.')
}

// ── UP ────────────────────────────────────────────────────────────────────────

async function up(): Promise<void> {
  console.log('[migrate-ml-reasoning] Running UP migration...')

  const result = await StepSubmission.updateMany(
    { mlReasoning: { $exists: false } },
    { $set: { mlReasoning: null } },
  )

  console.log(
    `[migrate-ml-reasoning] Back-filled mlReasoning on ${result.modifiedCount} document(s).`,
  )
  console.log('[migrate-ml-reasoning] UP migration complete.')
}

// ── DOWN ──────────────────────────────────────────────────────────────────────

async function down(): Promise<void> {
  console.log('[migrate-ml-reasoning] Running DOWN migration...')

  const result = await StepSubmission.updateMany(
    { mlReasoning: { $exists: true } },
    { $unset: { mlReasoning: '' } },
  )

  console.log(
    `[migrate-ml-reasoning] Removed mlReasoning from ${result.modifiedCount} document(s).`,
  )
  console.log('[migrate-ml-reasoning] DOWN migration complete.')
}

// ── Entry point ───────────────────────────────────────────────────────────────

const direction = process.argv[2]

if (direction !== 'up' && direction !== 'down') {
  console.error('Usage: npx tsx scripts/migrate-ml-reasoning.ts <up|down>')
  process.exit(1)
}

connect()
  .then(() => (direction === 'up' ? up() : down()))
  .then(() => disconnect())
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[migrate-ml-reasoning] Migration failed:', err)
    process.exit(1)
  })
