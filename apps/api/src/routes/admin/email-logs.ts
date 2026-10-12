// Admin: paginated broadcast email send-history for BroadcastEmailPage.tsx.
// EmailLog stores one row per recipient (see routes/admin/messages.ts's send
// handler), so a "send" as the UI understands it is a group of EmailLog rows
// sharing the same subject/recipientLabel/recipientType from the same batch.
// There's no explicit batch id on the schema, so we bucket by the minute the
// batch was created — good enough to distinguish two different broadcasts
// with the same subject/audience without needing a schema migration.

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requirePermission } from '../../middleware/require-permission.js'
import { EmailLog } from '../../models/EmailLog.js'

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

type ListQuery = z.infer<typeof listQuerySchema>

interface BroadcastBatch {
  _id: { subject: string | null; recipientLabel: string | null; recipientType: string | null; minute: Date }
  sentAt: Date
  recipientCount: number
}

export async function adminEmailLogsRoutes(fastify: FastifyInstance) {
  // ── GET / — paginated broadcast send history ────────────────────────────
  fastify.get<{ Querystring: ListQuery }>(
    '/',
    { preHandler: requirePermission('messages:read') },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid query parameters.',
        })
      }
      const { page, limit } = parsed.data
      const skip = (page - 1) * limit

      const groupStage = {
        $group: {
          _id: {
            subject: '$subject',
            recipientLabel: '$recipientLabel',
            recipientType: '$recipientType',
            minute: { $dateTrunc: { date: '$createdAt', unit: 'minute' as const } },
          },
          sentAt: { $min: '$createdAt' },
          recipientCount: { $sum: 1 },
        },
      }

      const [batches, totalResult] = await Promise.all([
        EmailLog.aggregate<BroadcastBatch>([
          { $match: { emailType: 'BROADCAST' } },
          groupStage,
          { $sort: { sentAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        EmailLog.aggregate<{ count: number }>([
          { $match: { emailType: 'BROADCAST' } },
          groupStage,
          { $count: 'count' },
        ]),
      ])

      const logs = batches.map((b, i) => ({
        id: `${b._id.minute.toISOString()}-${i}`,
        target: b._id.recipientType === 'INDIVIDUAL' ? (b._id.recipientLabel ?? 'unknown') : (b._id.recipientLabel ?? 'all'),
        subject: b._id.subject ?? '(no subject)',
        sentAt: b.sentAt,
        recipientCount: b.recipientCount,
      }))

      return reply.send({ logs, total: totalResult[0]?.count ?? 0 })
    },
  )
}
