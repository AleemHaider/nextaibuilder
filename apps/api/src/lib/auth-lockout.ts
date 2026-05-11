// FIR-172 — Shared Redis-backed login lockout used by admin + student auth.
// Failed login attempts are counted per email; the counter expires after the
// configured window from first failure, locking the account for that window
// once the threshold is reached.

import { redis } from './redis.js'

const LOCKOUT_MAX_ATTEMPTS = 5
const LOCKOUT_TTL_SECONDS  = 15 * 60

function key(email: string): string {
  return `login_fail:${email}`
}

export async function checkLockout(email: string): Promise<boolean> {
  const count = await redis.get(key(email))
  return Number(count ?? 0) >= LOCKOUT_MAX_ATTEMPTS
}

export async function incrementFailCount(email: string): Promise<void> {
  const k = key(email)
  const count = await redis.incr(k)
  if (count === 1) {
    // First failure in the window — set TTL so the lockout window is fixed
    await redis.expire(k, LOCKOUT_TTL_SECONDS)
  }
}

export async function clearFailCount(email: string): Promise<void> {
  await redis.del(key(email))
}

export const LOCKOUT_WINDOW_MINUTES = LOCKOUT_TTL_SECONDS / 60
