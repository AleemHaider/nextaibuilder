// PBA-149/150 — Socket.io singleton shared between Fastify routes and BullMQ workers
// PBA-398 — Real-time student online/offline presence tracking
import { Server as SocketIOServer } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import type { Http2SecureServer } from 'node:http2'
import type { FastifyInstance } from 'fastify'
import { createServer } from 'node:http'
import jwt from 'jsonwebtoken'

let io: SocketIOServer | null = null

// PBA-398 — In-memory set of online student user IDs
const onlineStudents = new Set<string>()

export function initSocketIO(server: HttpServer | Http2SecureServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // Verify JWT on every connection before allowing room joins
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined
    if (!token) {
      return next(new Error('Authentication required'))
    }
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET ?? 'change-me-in-production',
      ) as { sub: string; role?: string }
      socket.data.userId = decoded.sub
      socket.data.role = decoded.role ?? 'STUDENT'
      next()
    } catch {
      next(new Error('Invalid or expired token'))
    }
  })

  io.on('connection', (socket) => {
    // Join the authenticated user's private room (userId verified via JWT above)
    const verifiedUserId = socket.data.userId as string
    const verifiedRole = socket.data.role as string

    if (verifiedUserId) {
      void socket.join(`student:${verifiedUserId}`)
    }

    // PBA-398 — Presence tracking
    if (verifiedUserId && verifiedRole === 'STUDENT') {
      // Mark student online and broadcast to all admin sockets
      onlineStudents.add(verifiedUserId)
      void socket.join('role:student')
      io!.to('role:admin').emit('presence:update', { userId: verifiedUserId, online: true })
    }

    if (verifiedUserId && (verifiedRole === 'ADMIN' || verifiedRole === 'SUPER_ADMIN')) {
      // Join admin room so they receive presence broadcasts
      void socket.join('role:admin')
      // Send a snapshot of all currently online students to this admin
      socket.emit('presence:snapshot', { onlineUserIds: Array.from(onlineStudents) })
    }

    socket.on('disconnect', () => {
      // PBA-398 — Remove student from online set on disconnect and notify admins
      if (verifiedUserId && verifiedRole === 'STUDENT') {
        onlineStudents.delete(verifiedUserId)
        io!.to('role:admin').emit('presence:update', { userId: verifiedUserId, online: false })
      }
    })
  })

  return io
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialised — call initSocketIO first')
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
