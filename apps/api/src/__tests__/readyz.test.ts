/**
 * Unit tests for the /readyz handler + the default ping helpers.
 *
 * The handler is injected with mock pingMongo / pingRedis fns so we cover the
 * four state combinations cleanly. Default helpers are tested separately
 * against a fake mongoose / ioredis shape.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  buildReadyzHandler,
  defaultPingMongo,
  defaultPingRedis,
  type DownstreamStatus,
  type ReadyzBody,
} from '../lib/readyz.js'

function makeReply() {
  const reply = {
    _status: 0,
    _body:   null as unknown,
    code(s: number) { reply._status = s; return reply },
    send(b: unknown) { reply._body = b; return reply },
  }
  return reply
}

describe('buildReadyzHandler', () => {

  it('both downstreams ok → 200 status:ready', async () => {
    const handler = buildReadyzHandler({
      pingMongo: async () => 'ok',
      pingRedis: async () => 'ok',
    })
    const reply = makeReply()
    await handler({}, reply)

    expect(reply._status).toBe(200)
    const body = reply._body as ReadyzBody
    expect(body.status).toBe('ready')
    expect(body.mongo).toBe('ok')
    expect(body.redis).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
  })

  it('mongo down → 503 status:not_ready (load balancer pulls instance)', async () => {
    const handler = buildReadyzHandler({
      pingMongo: async () => 'down',
      pingRedis: async () => 'ok',
    })
    const reply = makeReply()
    await handler({}, reply)

    expect(reply._status).toBe(503)
    const body = reply._body as ReadyzBody
    expect(body).toMatchObject({ status: 'not_ready', mongo: 'down', redis: 'ok' })
  })

  it('redis down → 503', async () => {
    const handler = buildReadyzHandler({
      pingMongo: async () => 'ok',
      pingRedis: async () => 'down',
    })
    const reply = makeReply()
    await handler({}, reply)

    expect(reply._status).toBe(503)
    expect(reply._body as ReadyzBody).toMatchObject({ status: 'not_ready', redis: 'down' })
  })

  it('both downstreams down → 503', async () => {
    const handler = buildReadyzHandler({
      pingMongo: async () => 'down',
      pingRedis: async () => 'down',
    })
    const reply = makeReply()
    await handler({}, reply)

    expect(reply._status).toBe(503)
    expect(reply._body as ReadyzBody).toMatchObject({
      status: 'not_ready', mongo: 'down', redis: 'down',
    })
  })

  it('pings run in parallel (both calls observed before either resolves)', async () => {
    let mongoStarted = false
    let redisStartedBeforeMongoResolved = false
    const handler = buildReadyzHandler({
      pingMongo: async () => {
        mongoStarted = true
        await new Promise((r) => setTimeout(r, 20))
        return 'ok'
      },
      pingRedis: async () => {
        // If this fires before pingMongo resolves, we know they ran concurrently.
        if (mongoStarted) redisStartedBeforeMongoResolved = true
        return 'ok'
      },
    })
    await handler({}, makeReply())
    expect(redisStartedBeforeMongoResolved).toBe(true)
  })
})

// ── Default ping helpers ─────────────────────────────────────────────────

describe('defaultPingMongo', () => {

  it('readyState !== 1 → down (skips the actual ping call)', async () => {
    const dbPing = vi.fn()
    const mongoose = {
      connection: { readyState: 0, db: { admin: () => ({ ping: dbPing }) } },
    } as unknown as Parameters<typeof defaultPingMongo>[0]
    const result = await defaultPingMongo(mongoose)
    expect(result).toBe<DownstreamStatus>('down')
    expect(dbPing).not.toHaveBeenCalled()
  })

  it('readyState 1 + ping resolves → ok', async () => {
    const mongoose = {
      connection: {
        readyState: 1,
        db: { admin: () => ({ ping: async () => ({ ok: 1 }) }) },
      },
    } as unknown as Parameters<typeof defaultPingMongo>[0]
    const result = await defaultPingMongo(mongoose)
    expect(result).toBe('ok')
  })

  it('readyState 1 but ping rejects → down (server gone away)', async () => {
    const mongoose = {
      connection: {
        readyState: 1,
        db: { admin: () => ({ ping: async () => { throw new Error('no socket') } }) },
      },
    } as unknown as Parameters<typeof defaultPingMongo>[0]
    const result = await defaultPingMongo(mongoose)
    expect(result).toBe('down')
  })

  it('readyState 1 but no .db handle yet → down (mid-connect)', async () => {
    const mongoose = {
      connection: { readyState: 1, db: undefined },
    } as unknown as Parameters<typeof defaultPingMongo>[0]
    const result = await defaultPingMongo(mongoose)
    expect(result).toBe('down')
  })
})

describe('defaultPingRedis', () => {

  it("PONG → ok", async () => {
    const redis = { ping: async () => 'PONG' } as unknown as Parameters<typeof defaultPingRedis>[0]
    expect(await defaultPingRedis(redis)).toBe('ok')
  })

  it('non-PONG reply → down', async () => {
    const redis = { ping: async () => 'NOPE' } as unknown as Parameters<typeof defaultPingRedis>[0]
    expect(await defaultPingRedis(redis)).toBe('down')
  })

  it('throw → down', async () => {
    const redis = { ping: async () => { throw new Error('econnrefused') } } as unknown as Parameters<typeof defaultPingRedis>[0]
    expect(await defaultPingRedis(redis)).toBe('down')
  })
})
