// PBA-137 — Redis client
// BullMQ bundles its own ioredis internally — to avoid type conflicts between
// the ioredis installed at root level and BullMQ's bundled copy, we pass
// a plain ConnectionOptions object to BullMQ rather than a Redis instance.

import { Redis } from 'ioredis'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

// Shared Redis instance for pub/sub, caching, etc.
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ when passing an IORedis instance
  enableReadyCheck: false,
})

redis.on('error', (err) => {
  console.error('[Redis] connection error:', err.message)
})

redis.on('connect', () => {
  console.info('[Redis] connected')
})

// BullMQ-safe connection options (plain object — avoids bundled ioredis type mismatch)
function parseRedisUrl(url: string): {
  host: string
  port: number
  password?: string
  username?: string
  db?: number
  tls?: object
} {
  const parsed = new URL(url)
  return {
    host: parsed.hostname || 'localhost',
    port: Number(parsed.port || 6379),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.pathname && parsed.pathname.length > 1
      ? { db: Number(parsed.pathname.slice(1)) }
      : {}),
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  }
}

export const bullMQConnection = {
  ...parseRedisUrl(REDIS_URL),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}
