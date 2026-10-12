// One-off: create (or reset) a password-auth ADMIN account for the Claude
// agent to use against /api/admin/* routes, plus a SubAdminPermission grant
// scoped to course/cohort/pricing management. Deliberately role: ADMIN with
// twoFactorEnabled: false (not SUPER_ADMIN) — SUPER_ADMIN always requires an
// email OTP on login, and this account has no monitored inbox to receive one.
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { PERMISSIONS } from '../src/lib/permissions.js'

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27018/pba_dev'
const EMAIL = 'claude-agent@nextaibuilder.com'
const BCRYPT_ROUNDS = 12

// Scoped to what the server's currently-deployed permissions.ts actually
// enumerates (it predates the local repo's cohorts:*/steps:* additions —
// granting those would fail the SubAdminPermission enum validator).
const GRANTED_PERMISSIONS = [
  'courses:read', 'courses:write', 'courses:delete', 'courses:publish',
  'courses:manage-sessions', 'courses:manage-steps',
  'payments:read', 'enrollments:read',
] as const

for (const p of GRANTED_PERMISSIONS) {
  if (!(PERMISSIONS as readonly string[]).includes(p)) {
    throw new Error(`Unknown permission in grant list: ${p}`)
  }
}

await mongoose.connect(MONGO_URI)
const db = mongoose.connection.db!

const superAdmin = await db.collection('users').findOne({ role: 'SUPER_ADMIN' })
if (!superAdmin) {
  console.error('No SUPER_ADMIN found to attribute the permission grant to.')
  process.exit(1)
}

const rawPassword = crypto.randomBytes(18).toString('base64url')
const passwordHash = await bcrypt.hash(rawPassword, BCRYPT_ROUNDS)

const result = await db.collection('users').findOneAndUpdate(
  { email: EMAIL },
  {
    $set: {
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      twoFactorEnabled: false,
      inviteStatus: 'ACCEPTED',
      inviteAcceptedAt: new Date(),
    },
    $setOnInsert: {
      email: EMAIL,
      firstName: 'Claude',
      lastName: 'Agent',
      oauthProvider: null,
      oauthId: null,
    },
  },
  { upsert: true, returnDocument: 'after' },
)
const user = result!

await db.collection('subadminpermissions').findOneAndUpdate(
  { userId: user._id },
  {
    $set: {
      permissions: GRANTED_PERMISSIONS,
      grantedBy: superAdmin._id,
      updatedAt: new Date(),
    },
    $setOnInsert: { userId: user._id, createdAt: new Date() },
  },
  { upsert: true },
)

console.log('ADMIN_EMAIL=' + EMAIL)
console.log('ADMIN_PASSWORD=' + rawPassword)
console.log('USER_ID=' + user._id.toString())

await mongoose.disconnect()
