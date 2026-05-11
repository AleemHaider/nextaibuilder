// Readiness probe helpers.
//
// Liveness (/health) says the process is alive. Readiness (/readyz) says the
// process can do useful work — Mongo + Redis both reachable. Load balancers
// pull instances from rotation on /readyz 503s without forcing a restart,
// which gives transient downstream blips room to recover.
//
// The handler is built around injected `pingMongo` / `pingRedis` functions so
// the unit test in __tests__/readyz.test.ts can exercise every branch
// without booting a real Mongo or Redis.

import type { Mongoose } from 'mongoose'
import type { Redis } from 'ioredis'

export type DownstreamStatus = 'ok' | 'down'

export const READYZ_TIMEOUT_MS = 1500

interface ReplyShape {
  code: (n: number) => { send: (b: unknown) => unknown }
}

export interface ReadyzDeps {
  pingMongo: () => Promise<DownstreamStatus>
  pingRedis: () => Promise<DownstreamStatus>
}

export interface ReadyzBody {
  status:    'ready' | 'not_ready'
  mongo:     DownstreamStatus
  redis:     DownstreamStatus
  timestamp: string
}

/**
 * Build a Fastify-compatible /readyz handler. Resolves to 200 with
 * {status:'ready'} only when both downstreams ping back; 503 otherwise.
 */
export function buildReadyzHandler(deps: ReadyzDeps) {
  return async function readyzHandler(_req: unknown, reply: ReplyShape) {
    const [mongo, redis] = await Promise.all([deps.pingMongo(), deps.pingRedis()])
    const ready = mongo === 'ok' && redis === 'ok'
    const body: ReadyzBody = {
      status:    ready ? 'ready' : 'not_ready',
      mongo,
      redis,
      timestamp: new Date().toISOString(),
    }
    return reply.code(ready ? 200 : 503).send(body)
  }
}

/**
 * Default Mongo ping — readyState gate first (cheap), then a real
 * `admin().ping()` to catch the case where mongoose thinks it's connected
 * but the server has gone away.
 */
export async function defaultPingMongo(mongoose: Mongoose): Promise<DownstreamStatus> {
  // readyState 1 = connected. Anything else (0 disconnected, 2 connecting,
  // 3 disconnecting) is not ready.
  if (mongoose.connection.readyState !== 1) return 'down'
  try {
    const db = mongoose.connection.db
    if (!db) return 'down'
    await Promise.race([
      db.admin().ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('mongo ping timeout')), READYZ_TIMEOUT_MS),
      ),
    ])
    return 'ok'
  } catch {
    return 'down'
  }
}

/** Default Redis ping — expects 'PONG'; anything else (including throw) is down. */
export async function defaultPingRedis(redis: Redis): Promise<DownstreamStatus> {
  try {
    const result = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('redis ping timeout')), READYZ_TIMEOUT_MS),
      ),
    ])
    return result === 'PONG' ? 'ok' : 'down'
  } catch {
    return 'down'
  }
}
