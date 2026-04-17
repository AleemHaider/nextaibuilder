// PBA-225 — requirePermission middleware factory
//
// Usage:
//   { preHandler: requirePermission('cohorts:read') }
//   { preHandler: requirePermission(['cohorts:read', 'cohorts:write']) }
//
// Behaviour:
//   1. Calls requireAdmin internally first (authenticates + checks ADMIN/SUPER_ADMIN role).
//   2. SUPER_ADMIN bypasses the permission table entirely — all permissions granted.
//   3. For ADMIN role, loads SubAdminPermission from DB (cached on request.permissions)
//      and checks that every required permission is present.

import type { FastifyRequest, FastifyReply } from 'fastify'
import { requireAdmin } from './require-admin.js'
import type { JwtPayload } from './authenticate.js'
import { SubAdminPermission } from '../models/SubAdminPermission.js'
import type { Permission } from '../lib/permissions.js'

// ── Module augmentation — extends FastifyRequest with cached permissions ────

declare module 'fastify' {
  interface FastifyRequest {
    permissions?: Permission[]
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function requirePermission(
  required: Permission | Permission[],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const requiredList: Permission[] = Array.isArray(required) ? required : [required]

  return async function permissionMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Step 1: authenticate and verify admin role
    await requireAdmin(request, reply)
    if (reply.sent) return

    const payload = request.user as JwtPayload

    // Step 2: SUPER_ADMIN has all permissions — skip DB lookup
    if (payload.role === 'SUPER_ADMIN') {
      return
    }

    // Step 3: Load permissions from DB if not already cached on this request
    if (!request.permissions) {
      const doc = await SubAdminPermission.findOne({ userId: payload.sub }).lean()
      request.permissions = (doc?.permissions ?? []) as Permission[]
    }

    // Step 4: Check every required permission is present
    const missing = requiredList.filter((p) => !request.permissions!.includes(p))

    if (missing.length > 0) {
      return reply.code(403).send({
        error: 'FORBIDDEN',
        message: `Missing required permission(s): ${missing.join(', ')}.`,
      })
    }
  }
}
