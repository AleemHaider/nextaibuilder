// PBA-228 — requireSuperAdmin middleware
//
// Guards routes that only a SUPER_ADMIN may access (e.g. managing sub-admin accounts,
// granting/revoking permissions, system-level settings).
//
// Behaviour:
//   1. Calls authenticate internally to verify the JWT.
//   2. Checks that the token role is exactly 'SUPER_ADMIN'.
//   3. Returns 403 FORBIDDEN for any other authenticated role.

import type { FastifyRequest, FastifyReply } from 'fastify'
import { authenticate } from './authenticate.js'
import type { JwtPayload } from './authenticate.js'

export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticate(request, reply)
  if (reply.sent) return

  const payload = request.user as JwtPayload

  if (payload.role !== 'SUPER_ADMIN') {
    reply.code(403).send({
      error: 'FORBIDDEN',
      message: 'Super admin access required.',
    })
  }
}
