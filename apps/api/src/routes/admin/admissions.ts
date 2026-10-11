// sdk.nextaibuilder.com — Admin listing for physical-course admission applications
// GET /api/admin/admissions — paginated list, newest first

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../../middleware/require-admin.js'
import { AdmissionApplication } from '../../models/AdmissionApplication.js'

const listQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

type ListQuery = z.infer<typeof listQuerySchema>

export async function adminAdmissionsRoutes(fastify: FastifyInstance) {
  // ── GET / ── Paginated admission application list ───────────────────────
  fastify.get<{ Querystring: ListQuery }>(
    '/',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid query params.',
        })
      }
      const { page, limit } = parsed.data

      const [applications, total] = await Promise.all([
        AdmissionApplication.find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        AdmissionApplication.countDocuments({}),
      ])

      return reply.send({
        applications: applications.map((a) => ({
          id:        a._id.toString(),
          fullName:  a.fullName,
          email:     a.email,
          phone:     a.phone,
          // Older submissions predate the track field — surface as null
          // rather than crashing the admin list on a missing value.
          track:     a.track ?? null,
          message:   a.message,
          source:    a.source,
          createdAt: a.createdAt,
        })),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      })
    },
  )
}
