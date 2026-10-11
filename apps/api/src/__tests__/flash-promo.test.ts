/**
 * Flash promo — per-session "X% off for N hours" window, signed-cookie backed.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { getFlashPromo, applyFlashPromo, FLASH_PROMO_COOKIE } from '../lib/flashPromo.js'

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(fastifyCookie, { secret: 'test-cookie-secret' })
  app.get('/promo', async (request, reply) => reply.send(getFlashPromo(request, reply, { start: true })))
  app.get('/peek', async (request, reply) => reply.send(getFlashPromo(request, null)))
  await app.ready()
  return app
}

describe('flash promo', () => {
  beforeEach(() => {
    process.env.FLASH_PROMO_PERCENT = '50'
    process.env.FLASH_PROMO_HOURS = '2'
  })

  it('starts a 2-hour window on first visit and sets a signed session cookie', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promo' })
    const body = res.json()
    expect(body.active).toBe(true)
    expect(body.percentOff).toBe(50)
    const started = new Date(body.startedAt).getTime()
    const expires = new Date(body.expiresAt).getTime()
    expect(expires - started).toBe(2 * 60 * 60 * 1000)
    const cookie = res.cookies.find((c) => c.name === FLASH_PROMO_COOKIE)
    expect(cookie).toBeDefined()
    expect(cookie!.value).toContain('.') // signed: value.signature
    expect((cookie as { maxAge?: number }).maxAge).toBeUndefined() // session cookie
  })

  it('keeps the same window on subsequent visits with the cookie', async () => {
    const app = await buildApp()
    const first = await app.inject({ method: 'GET', url: '/promo' })
    const cookie = first.cookies.find((c) => c.name === FLASH_PROMO_COOKIE)!
    const second = await app.inject({ method: 'GET', url: '/peek', cookies: { [cookie.name]: cookie.value } })
    expect(second.json().expiresAt).toBe(first.json().expiresAt)
    expect(second.json().active).toBe(true)
  })

  it('ignores a tampered cookie (no window until restarted)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/peek', cookies: { [FLASH_PROMO_COOKIE]: `${Date.now()}.forgedsignature` } })
    expect(res.json().active).toBe(false)
    expect(res.json().expiresAt).toBeNull()
  })

  it('expires after the window', async () => {
    const app = await buildApp()
    const first = await app.inject({ method: 'GET', url: '/promo' })
    const cookie = first.cookies.find((c) => c.name === FLASH_PROMO_COOKIE)!
    // Peek with a "now" three hours later via the exported helper directly.
    const startedAt = new Date(first.json().startedAt).getTime()
    const fakeReq = {
      cookies: { [FLASH_PROMO_COOKIE]: cookie.value },
      unsignCookie: () => ({ valid: true, value: String(startedAt), renew: false }),
    } as unknown as Parameters<typeof getFlashPromo>[0]
    const later = getFlashPromo(fakeReq, null, { now: startedAt + 3 * 60 * 60 * 1000 })
    expect(later.active).toBe(false)
    expect(later.expiresAt).toBe(first.json().expiresAt)
  })

  it('applies the percentage to amounts in cents and is a no-op when inactive', () => {
    const active = { active: true, percentOff: 50, windowHours: 2, startedAt: 'x', expiresAt: 'y' }
    const inactive = { ...active, active: false }
    expect(applyFlashPromo(300000, active)).toBe(150000)
    expect(applyFlashPromo(20000, active)).toBe(10000)
    expect(applyFlashPromo(999, active)).toBe(500)
    expect(applyFlashPromo(300000, inactive)).toBe(300000)
  })

  it('is disabled when FLASH_PROMO_PERCENT=0', async () => {
    process.env.FLASH_PROMO_PERCENT = '0'
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/promo' })
    expect(res.json().active).toBe(false)
    expect(res.cookies.find((c) => c.name === FLASH_PROMO_COOKIE)).toBeUndefined()
  })
})
