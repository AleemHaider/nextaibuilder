// PBA-138 — JWT authentication middleware
import type { FastifyRequest, FastifyReply } from 'fastify'
import { User } from '../models/User.js'

export interface JwtPayload {
  sub: string        // userId
  email: string
  role: string
  iat: number
  exp: number
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({
      error: 'UNAUTHORIZED',
      message: 'Valid access token required.',
    })
    return
  }

  // CRIT-2: Verify the user account is still active even if the JWT is valid.
  // Deactivated accounts must be blocked immediately, not after token expiry.
  const payload = request.user as JwtPayload
  const user = await User.findById(payload.sub).select('isActive').lean()
  if (!user || user.isActive === false) {
    reply.code(401).send({
      error: 'UNAUTHORIZED',
      message: 'Account is deactivated.',
    })
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticate(request, reply)
  if (reply.sent) return
  const payload = request.user as JwtPayload
  if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
    reply.code(403).send({
      error: 'FORBIDDEN',
      message: 'Admin access required.',
    })
  }
}

// CRIT-5: Ensure only STUDENT-role users can access student routes.
// Prevents admin tokens from being used against student endpoints.
export async function requireStudent(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticate(request, reply)
  if (reply.sent) return
  const payload = request.user as JwtPayload
  if (payload.role !== 'STUDENT') {
    reply.code(403).send({
      error: 'FORBIDDEN',
      message: 'Student access required.',
    })
  }
}
