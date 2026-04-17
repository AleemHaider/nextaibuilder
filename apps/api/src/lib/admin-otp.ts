// PBA-246 — AdminOtp Redis store
// Key pattern: `admin:otp:{userId}`
// Value: JSON { code: string, attempts: number }
// TTL: 600 seconds (10 minutes)

import crypto from 'node:crypto'
import { redis } from './redis.js'

const OTP_TTL_SECONDS = 600
const MAX_ATTEMPTS    = 3
const KEY_PREFIX      = 'admin:otp:'

interface OtpRecord {
  code: string
  attempts: number
}

function otpKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

/**
 * Generate a 6-digit OTP for the given userId, store it in Redis with a
 * 600-second TTL, and return the plain code so the caller can email it.
 * Any existing OTP for this user is overwritten.
 */
export async function generateOtp(userId: string): Promise<string> {
  const code: string = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  const record: OtpRecord = { code, attempts: 0 }
  await redis.set(otpKey(userId), JSON.stringify(record), 'EX', OTP_TTL_SECONDS)
  return code
}

/**
 * Verify a user-supplied OTP code against the stored record.
 *
 * Returns:
 *   'valid'   — code matched; record has been deleted
 *   'invalid' — code did not match; attempts counter incremented (deleted if max reached)
 *   'locked'  — record was already at max attempts before this call (no match attempted)
 *   'expired' — no record found in Redis (TTL elapsed or never generated)
 */
export async function verifyOtp(
  userId: string,
  inputCode: string,
): Promise<'valid' | 'invalid' | 'locked' | 'expired'> {
  const raw = await redis.get(otpKey(userId))

  if (!raw) {
    return 'expired'
  }

  const record: OtpRecord = JSON.parse(raw) as OtpRecord

  // Already hit max attempts — treat as locked without consuming another attempt
  if (record.attempts >= MAX_ATTEMPTS) {
    await redis.del(otpKey(userId))
    return 'locked'
  }

  // Use timingSafeEqual to prevent timing oracle attacks
  const storedBuf = Buffer.from(record.code, 'utf8')
  const inputBuf  = Buffer.from(inputCode.padStart(storedBuf.length, '\0').slice(0, storedBuf.length), 'utf8')

  // Ensure both buffers are the same length for timingSafeEqual
  const storedPadded = Buffer.alloc(6)
  const inputPadded  = Buffer.alloc(6)
  Buffer.from(record.code.padStart(6, '0').slice(0, 6), 'utf8').copy(storedPadded)
  Buffer.from(inputCode.padStart(6, '0').slice(0, 6), 'utf8').copy(inputPadded)

  const isMatch = crypto.timingSafeEqual(storedPadded, inputPadded)

  if (isMatch) {
    await redis.del(otpKey(userId))
    return 'valid'
  }

  // Wrong code — increment attempts
  record.attempts += 1

  if (record.attempts >= MAX_ATTEMPTS) {
    // Lock out: delete the key so further calls return 'expired'
    await redis.del(otpKey(userId))
  } else {
    // Persist updated attempts count, preserving remaining TTL
    const ttl = await redis.ttl(otpKey(userId))
    const remainingTtl = ttl > 0 ? ttl : OTP_TTL_SECONDS
    await redis.set(otpKey(userId), JSON.stringify(record), 'EX', remainingTtl)
  }

  return 'invalid'
}

/**
 * Delete any pending OTP for the given userId.
 * Safe to call even if no OTP exists.
 */
export async function deleteOtp(userId: string): Promise<void> {
  await redis.del(otpKey(userId))
}
