// Flash promo — "X% off for the next N hours" per browser session.
//
// The clock starts the first time a browser calls GET /api/v1/storefront/promo
// (the storefront/pricing UI does this on load). We remember the start time in
// a SIGNED session cookie so the client can't extend or restart it by editing
// the cookie; closing the browser ends the session and a new visit gets a new
// window. Checkout routes call getFlashPromo() and apply the same discount
// server-side, so the ticker in the UI and the amount charged always agree.
//
// Env:
//   FLASH_PROMO_PERCENT  default 50   (0 disables the promo entirely)
//   FLASH_PROMO_HOURS    default 2
import type { FastifyReply, FastifyRequest } from 'fastify'

export const FLASH_PROMO_COOKIE = 'nab_promo'

export interface FlashPromo {
  active: boolean
  percentOff: number
  windowHours: number
  startedAt: string | null
  expiresAt: string | null
}

export function flashPromoConfig(): { percent: number; hours: number } {
  const percent = Number.parseInt(process.env.FLASH_PROMO_PERCENT ?? '50', 10)
  const hours   = Number.parseFloat(process.env.FLASH_PROMO_HOURS ?? '2')
  return {
    percent: Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0,
    hours:   Number.isFinite(hours) && hours > 0 ? hours : 2,
  }
}

function readStartedAt(request: FastifyRequest): number | null {
  const raw = request.cookies?.[FLASH_PROMO_COOKIE]
  if (!raw) return null
  const unsigned = request.unsignCookie(raw)
  if (!unsigned.valid || !unsigned.value) return null
  const ms = Number.parseInt(unsigned.value, 10)
  return Number.isFinite(ms) && ms > 0 && ms <= Date.now() ? ms : null
}

/**
 * Returns the current promo state for this browser. When `start` is true and
 * no window exists yet, a new window is started and the cookie is set.
 */
export function getFlashPromo(
  request: FastifyRequest,
  reply: FastifyReply | null,
  opts: { start?: boolean; now?: number } = {},
): FlashPromo {
  const { percent, hours } = flashPromoConfig()
  const now = opts.now ?? Date.now()
  const windowMs = hours * 60 * 60 * 1000

  if (percent <= 0) {
    return { active: false, percentOff: 0, windowHours: hours, startedAt: null, expiresAt: null }
  }

  let startedAt = readStartedAt(request)
  if (startedAt === null && opts.start && reply) {
    startedAt = now
    reply.setCookie(FLASH_PROMO_COOKIE, String(startedAt), {
      signed:   true,
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      path:     '/',
      // No maxAge → session cookie: a new browser session restarts the window.
    })
  }

  if (startedAt === null) {
    return { active: false, percentOff: percent, windowHours: hours, startedAt: null, expiresAt: null }
  }

  const expiresAtMs = startedAt + windowMs
  return {
    active:      now < expiresAtMs,
    percentOff:  percent,
    windowHours: hours,
    startedAt:   new Date(startedAt).toISOString(),
    expiresAt:   new Date(expiresAtMs).toISOString(),
  }
}

/** Applies the promo to an amount in the lowest currency unit (cents). */
export function applyFlashPromo(amount: number, promo: FlashPromo): number {
  if (!promo.active || promo.percentOff <= 0) return Math.round(amount)
  return Math.max(0, Math.round(amount * (100 - promo.percentOff) / 100))
}
