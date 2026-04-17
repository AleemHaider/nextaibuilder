// PBA-132 — Admin Messages API
// POST /api/admin/messages/broadcast — send a message to a cohort or individual student
// GET  /api/admin/messages/history   — paginated broadcast history from EmailLog

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requirePermission } from '../../middleware/require-permission.js'
import { User } from '../../models/User.js'
import { CohortMembership } from '../../models/CohortMembership.js'
import { EmailLog } from '../../models/EmailLog.js'
import { sendEmail, broadcastMessageTemplate } from '../../lib/email.js'
import { createNotification } from '../../services/notificationService.js'

// ── Validation schemas ─────────────────────────────────────────────────────

const broadcastBodySchema = z.object({
  recipientType:  z.enum(['COHORT', 'INDIVIDUAL']),
  cohortId:       z.string().optional(),
  recipientEmail: z.string().email().optional(),
  subject:        z.string().min(1).max(500).trim(),
  body:           z.string().min(1).max(50_000).trim(),
}).refine(
  (d) => (d.recipientType === 'COHORT' ? Boolean(d.cohortId) : Boolean(d.recipientEmail)),
  { message: 'cohortId required for COHORT, recipientEmail required for INDIVIDUAL' },
)

const historyQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

type BroadcastBody = z.infer<typeof broadcastBodySchema>
type HistoryQuery  = z.infer<typeof historyQuerySchema>

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

/**
 * Minimal branded HTML wrapper for broadcast messages.
 * Keeps the same visual style as other PBA transactional emails.
 */

// ── Route plugin ───────────────────────────────────────────────────────────

export async function adminMessagesRoutes(fastify: FastifyInstance) {

  // ── POST /broadcast ── Send a message to a cohort or student ──────────
  fastify.post<{ Body: BroadcastBody }>(
    '/broadcast',
    { preHandler: requirePermission('messages:send') },
    async (request, reply) => {
      const parseResult = broadcastBodySchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { recipientType, cohortId, recipientEmail, subject, body: messageBody } = parseResult.data

      const html = broadcastMessageTemplate(subject, messageBody)

      // Resolve recipient list and label
      let recipients: { userId: string; email: string; notifications?: { progressUpdates?: boolean } | null }[] = []
      let recipientLabel = ''

      if (recipientType === 'INDIVIDUAL') {
        const user = await User.findOne(
          { email: recipientEmail!.toLowerCase() },
          { _id: 1, email: 1, notifications: 1 },
        ).lean()
        if (!user) {
          return reply.code(404).send({
            error:   'USER_NOT_FOUND',
            message: `No user found with email "${recipientEmail}".`,
          })
        }
        const uid = (user as unknown as { _id: Types.ObjectId })._id.toString()
        recipients    = [{ userId: uid, email: user.email, notifications: user.notifications }]
        recipientLabel = user.email
      } else {
        if (!cohortId || !isValidObjectId(cohortId)) {
          return reply.code(400).send({ error: 'INVALID_COHORT_ID', message: 'Valid cohortId is required.' })
        }

        const memberships = await CohortMembership.find(
          { cohortId },
          { userId: 1 },
        ).lean()

        if (memberships.length === 0) {
          return reply.send({ sent: 0, failed: 0 })
        }

        const userIds = memberships.map((m) => m.userId)
        const users   = await User.find(
          { _id: { $in: userIds } },
          { email: 1, notifications: 1 },
        ).lean()

        recipients = users.map((u) => ({
          userId: (u as unknown as { _id: Types.ObjectId })._id.toString(),
          email:  u.email,
          notifications: u.notifications,
        }))

        // Fetch cohort name for the label
        const { Cohort } = await import('../../models/Cohort.js')
        const cohort = await Cohort.findById(cohortId, { name: 1 }).lean()
        recipientLabel = cohort?.name ?? cohortId
      }

      // Send to each recipient and log results
      let sent    = 0
      let failed  = 0
      let skipped = 0

      await Promise.all(
        recipients.map(async ({ userId, email, notifications }) => {
          // Skip students who have opted out of broadcast (progressUpdates preference)
          if (notifications?.progressUpdates === false) {
            await EmailLog.create({
              userId:         new Types.ObjectId(userId),
              emailType:      'BROADCAST',
              status:         'SKIPPED',
              sentAt:         null,
              recipientEmail: email,
              recipientType,
              recipientLabel,
              subject,
            })
            skipped++
            fastify.log.info(
              `[admin/messages] BROADCAST skipped for user=${userId} email=${email} (progressUpdates=false)`,
            )
            return
          }

          const log = await EmailLog.create({
            userId:         new Types.ObjectId(userId),
            emailType:      'BROADCAST',
            status:         'PENDING',
            sentAt:         null,
            recipientEmail: email,
            recipientType,
            recipientLabel,
            subject,
          })

          try {
            await sendEmail(email, subject, html)
            log.status = 'SENT'
            log.sentAt = new Date()
            await log.save()
            sent++
            void createNotification({
              userId,
              type:     'BROADCAST',
              title:    subject,
              body:     messageBody.length > 200 ? messageBody.slice(0, 197) + '…' : messageBody,
              linkPath: null,
            })
          } catch (err) {
            log.status = 'FAILED'
            await log.save()
            failed++
            fastify.log.error(
              { err },
              `[admin/messages] BROADCAST failed for user=${userId} email=${email}`,
            )
          }
        }),
      )

      fastify.log.info(
        `[admin/messages] BROADCAST to ${recipientType}=${recipientLabel}: sent=${sent} failed=${failed} skipped=${skipped}`,
      )

      return reply.send({ sent, failed, skipped })
    },
  )

  // ── GET /history ── Recent broadcast history ───────────────────────────
  fastify.get<{ Querystring: Record<string, string> }>(
    '/history',
    { preHandler: requirePermission('messages:read') },
    async (request, reply) => {
      const parseResult = historyQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_QUERY',
          message: 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { page, limit }: HistoryQuery = parseResult.data
      const skip = (page - 1) * limit

      const [logs, total] = await Promise.all([
        EmailLog.find({ emailType: 'BROADCAST' })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean({ virtuals: true }),
        EmailLog.countDocuments({ emailType: 'BROADCAST' }),
      ])

      return reply.send({
        messages: logs.map((log) => {
          const l = log as typeof log & { id: string; recipientType?: string; recipientLabel?: string }
          return {
            id:             l.id,
            recipientType:  l.recipientType ?? 'INDIVIDUAL',
            recipientLabel: l.recipientLabel ?? l.recipientEmail ?? '—',
            subject:        log.subject  ?? '(no subject)',
            status:         log.status,
            sentAt:         log.sentAt   ?? log.createdAt,
          }
        }),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    },
  )
}
