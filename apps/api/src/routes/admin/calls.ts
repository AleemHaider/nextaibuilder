// PBA-323 — Admin calls management API
// GET  /api/admin/my-calls         — agent sees their own calls
// POST /api/admin/calls/:id/complete — mark call as completed

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { requirePermission } from '../../middleware/require-permission.js'
import { CallBooking } from '../../models/CallBooking.js'
import { sendEmail } from '../../lib/email.js'

// ── Email template ──────────────────────────────────────────────────────────

function callCompleteTemplate(studentName: string, agentName: string, callId: string): string {
  const appUrl = process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f3f3f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f3f5;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:600px;">
        <tr><td style="background-color:#ffffff;border-radius:12px;padding:40px 40px 32px;border:1px solid rgba(0,0,0,0.08);">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#1a2744;">Your support call is complete!</h1>
          <p style="margin:0 0 16px;font-size:16px;color:#3d3d4d;line-height:1.6;">Hi ${studentName}, your call with <strong>${agentName}</strong> has been marked as completed.</p>
          <p style="margin:0 0 16px;font-size:16px;color:#3d3d4d;line-height:1.6;">We hope you got the support you needed! Would you like to share feedback on your experience?</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr>
              <td style="background-color:#ff8c5a;border-radius:8px;">
                <a href="${appUrl}/student/calls/${callId}/review" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Leave a Review</a>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:14px;color:#717182;">Thank you for being part of Product Builder Academy!</p>
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center;font-size:13px;color:#717182;">&copy; ${new Date().getFullYear()} Product Builder Academy. All rights reserved.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Validation schemas ──────────────────────────────────────────────────────

const myCallsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'all']).default('all'),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(50).default(20),
})

type MyCallsQuery = z.infer<typeof myCallsQuerySchema>

// ── Route plugin ────────────────────────────────────────────────────────────

export async function adminCallsRoutes(fastify: FastifyInstance) {

  // ── GET /my-calls ── Agent sees their own calls ───────────────────────────
  fastify.get<{ Querystring: MyCallsQuery }>(
    '/my-calls',
    { preHandler: requirePermission('students:read') },
    async (request, reply) => {
      const caller = request.user as JwtPayload

      const parseResult = myCallsQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_QUERY',
          message: 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { status, page, limit } = parseResult.data
      const skip = (page - 1) * limit

      const filter: Record<string, unknown> = {
        agentId: new Types.ObjectId(caller.sub),
      }

      if (status !== 'all') {
        filter['status'] = status
      }

      const total = await CallBooking.countDocuments(filter)

      // Sort: ACTIVE first, then by bookedAt descending
      const calls = await CallBooking.find(filter)
        .populate('studentId', 'firstName lastName email avatarUrl')
        .sort({ status: 1, bookedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()

      return reply.send({
        calls,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    },
  )

  // ── POST /calls/:id/complete ── Mark a call as completed ──────────────────
  fastify.post<{ Params: { id: string } }>(
    '/calls/:id/complete',
    { preHandler: requirePermission('students:read') },
    async (request, reply) => {
      const { id } = request.params
      const caller = request.user as JwtPayload

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid call ID.' })
      }

      const call = await CallBooking.findById(id)
        .populate<{ studentId: { _id: Types.ObjectId; firstName: string; lastName: string; email: string } }>('studentId', 'firstName lastName email')
        .populate<{ agentId: { _id: Types.ObjectId; firstName: string; lastName: string } }>('agentId', 'firstName lastName')

      if (!call) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Call not found.' })
      }

      // Only the owning agent can complete
      if (call.agentId._id.toString() !== caller.sub) {
        return reply.code(403).send({
          error:   'FORBIDDEN',
          message: 'You can only complete your own calls.',
        })
      }

      if (call.status !== 'ACTIVE') {
        return reply.code(400).send({
          error:   'CALL_NOT_ACTIVE',
          message: 'Only active calls can be marked as completed.',
        })
      }

      call.status = 'COMPLETED'
      call.completedAt = new Date()
      await call.save()

      // Send email notification to student
      const studentName = `${call.studentId.firstName} ${call.studentId.lastName}`
      const agentName   = `${call.agentId.firstName} ${call.agentId.lastName}`

      sendEmail(
        call.studentId.email,
        'Your support call is complete — leave a review',
        callCompleteTemplate(studentName, agentName, id),
      ).catch((err: unknown) =>
        fastify.log.error(err, '[admin/calls] Failed to send call complete email'),
      )

      fastify.log.info(`[admin/calls] Call ${id} marked complete by agentId=${caller.sub}`)

      return reply.send({ call })
    },
  )
}
