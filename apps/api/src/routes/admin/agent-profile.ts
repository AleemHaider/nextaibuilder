// PBA-322 — Agent self-service profile settings
// PATCH /api/admin/profile/agent-settings — update own schedulingUrl and isAvailableForCalls
// Only ADMIN/SUPER_ADMIN may call this. Cannot self-set takesStudentCalls.

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { requirePermission } from '../../middleware/require-permission.js'
import { User } from '../../models/User.js'

const agentSettingsSchema = z.object({
  schedulingUrl:       z.string().url().nullable().optional(),
  isAvailableForCalls: z.boolean().optional(),
})

type AgentSettingsBody = z.infer<typeof agentSettingsSchema>

export async function agentProfileRoutes(fastify: FastifyInstance) {
  // PATCH /agent-settings — update own agent scheduling settings
  fastify.patch<{ Body: AgentSettingsBody }>(
    '/agent-settings',
    { preHandler: requirePermission('settings:read-own-profile') },
    async (request, reply) => {
      const caller = request.user as JwtPayload

      // Students cannot reach this endpoint (requirePermission guards it), but be explicit
      if (caller.role === 'STUDENT') {
        return reply.code(403).send({
          error:   'FORBIDDEN',
          message: 'Only admins can update agent settings.',
        })
      }

      const parseResult = agentSettingsSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { schedulingUrl, isAvailableForCalls } = parseResult.data

      const patch: Record<string, unknown> = {}
      if (schedulingUrl !== undefined)       patch['schedulingUrl']       = schedulingUrl
      if (isAvailableForCalls !== undefined) patch['isAvailableForCalls'] = isAvailableForCalls

      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'At least one of schedulingUrl or isAvailableForCalls is required.',
        })
      }

      const updated = await User.findByIdAndUpdate(
        caller.sub,
        { $set: patch },
        { new: true },
      ).lean<{
        takesStudentCalls: boolean
        schedulingUrl: string | null
        isAvailableForCalls: boolean
      }>()

      if (!updated) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'User not found.' })
      }

      return reply.send({
        agentSettings: {
          takesStudentCalls:   updated.takesStudentCalls,
          schedulingUrl:       updated.schedulingUrl,
          isAvailableForCalls: updated.isAvailableForCalls,
        },
      })
    },
  )
}
