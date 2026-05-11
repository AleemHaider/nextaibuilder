// PBA-149/150 — Socket.io singleton shared between Fastify routes and BullMQ workers
// PBA-398 — Real-time student online/offline presence tracking
//
// Two init modes (Week 2: worker-split + horizontal scale):
//
//   • initSocketIO(httpServer) — full server, attaches Redis pub/sub adapter.
//     Used by the api/all process so connected clients propagate to all instances.
//
//   • initSocketEmitter() — emit-only Socket.io instance with Redis adapter but
//     no HTTP binding. Used by worker-only processes so emits from BullMQ
//     workers (e.g. submission:updated) reach clients connected to the api
//     process via the Redis adapter.
//
// Presence (PBA-398) is now backed by Redis SET so a 2-instance api deployment
// gives admins a coherent view of all online students.
import { Server as SocketIOServer } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import type { Http2SecureServer } from 'node:http2'
import { createAdapter } from '@socket.io/redis-adapter'
import jwt from 'jsonwebtoken'
import { redis } from './redis.js'
import { logger } from './logger.js'

let io: SocketIOServer | null = null

// Redis SET holding userIds of currently-online students across ALL api
// instances. Replaces the previous in-memory Set which broke on horizontal scale.
const PRESENCE_KEY = 'presence:students'

function buildRedisAdapter() {
  // The adapter needs two dedicated clients: one for publishing and one for
  // subscribing. ioredis duplicates connect lazily so this stays synchronous.
  const pubClient = redis.duplicate()
  const subClient = redis.duplicate()
  return createAdapter(pubClient, subClient)
}

export function initSocketIO(
  server: HttpServer | Http2SecureServer,
): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })
  io.adapter(buildRedisAdapter())

  // Verify JWT on every connection before allowing room joins.
  // JWT_SECRET is enforced at boot (see index.ts production guard); failing
  // closed here defends against env regressions reaching the socket layer.
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined
    if (!token) {
      return next(new Error('Authentication required'))
    }
    const secret = process.env.JWT_SECRET
    if (!secret) {
      return next(new Error('Server misconfigured: JWT_SECRET unset'))
    }
    try {
      const decoded = jwt.verify(token, secret) as { sub: string; role?: string }
      socket.data.userId = decoded.sub
      socket.data.role = decoded.role ?? 'STUDENT'
      next()
    } catch {
      next(new Error('Invalid or expired token'))
    }
  })

  io.on('connection', (socket) => {
    const verifiedUserId = socket.data.userId as string
    const verifiedRole = socket.data.role as string

    if (verifiedUserId) {
      void socket.join(`student:${verifiedUserId}`)
    }

    if (verifiedUserId && verifiedRole === 'STUDENT') {
      // Mark student online (Redis SET — shared across api instances) then
      // broadcast to admins on every instance via the adapter.
      void redis.sadd(PRESENCE_KEY, verifiedUserId).catch((err) =>
        logger.error({ err, userId: verifiedUserId }, '[socket] presence sadd failed'),
      )
      void socket.join('role:student')
      io!.to('role:admin').emit('presence:update', { userId: verifiedUserId, online: true })
    }

    if (verifiedUserId && (verifiedRole === 'ADMIN' || verifiedRole === 'SUPER_ADMIN')) {
      void socket.join('role:admin')
      // Snapshot is per-admin (not broadcast) so it goes only to this socket.
      void redis.smembers(PRESENCE_KEY).then(
        (onlineUserIds) => socket.emit('presence:snapshot', { onlineUserIds }),
        (err) => logger.error({ err }, '[socket] presence snapshot failed'),
      )
    }

    socket.on('disconnect', () => {
      if (verifiedUserId && verifiedRole === 'STUDENT') {
        void redis.srem(PRESENCE_KEY, verifiedUserId).catch((err) =>
          logger.error({ err, userId: verifiedUserId }, '[socket] presence srem failed'),
        )
        io!.to('role:admin').emit('presence:update', { userId: verifiedUserId, online: false })
      }
    })
  })

  return io
}

/**
 * Initialise an emit-only Socket.io instance for worker / cron processes.
 * No HTTP binding; the Redis adapter handles cross-instance delivery so
 * worker-emitted events reach clients connected to the api process.
 *
 * NOTE: Servers that need both HTTP and worker functionality (ROLE=all,
 * current default) should call `initSocketIO(server)` instead — this would
 * double-bind the adapter.
 */
export function initSocketEmitter(): SocketIOServer {
  io = new SocketIOServer()
  io.adapter(buildRedisAdapter())
  return io
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialised — call initSocketIO or initSocketEmitter first')
  return io
}

/**
 * Emit a progress:reset event to a student's private room.
 * Called from the admin reset-progress route so the student's frontend
 * can immediately invalidate its React Query cache.
 */
export function emitProgressReset(userId: string) {
  try {
    getIO().to(`student:${userId}`).emit('progress:reset', { userId })
  } catch {
    // Socket.io not ready — non-fatal
  }
}

/**
 * Emit a submission:updated event to the student's private room.
 * Called from both the ML worker (PBA-150) and admin review routes.
 */
export function emitSubmissionUpdated(
  userId: string,
  payload: {
    submissionId: string
    status: string
    mlFeedback?: string | null
    mlScore?: number | null
  },
) {
  try {
    getIO().to(`student:${userId}`).emit('submission:updated', payload)
    getIO().emit('admin:submission:updated', { userId, ...payload })
  } catch {
    // Socket.io not ready — non-fatal
  }
}
