// PBA-326 — Student call booking API
// PBA-327 — Student call review API
// POST /api/student/calls           — book a call with an agent
// GET  /api/student/calls/active    — get current active call
// POST /api/student/calls/:id/review — submit review for a completed call

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requireStudent } from '../../middleware/authenticate.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { User } from '../../models/User.js'
import { CallBooking } from '../../models/CallBooking.js'
import { AgentReview } from '../../models/AgentReview.js'

// ── Validation schemas ──────────────────────────────────────────────────────

const bookCallSchema = z.object({
  agentId: z.string().min(1),
})

const reviewSchema = z.object({
  rating:  z.number().int().min(1).max(5),
  comment: z.string().max(500).min(1),
})

type BookCallBody = z.infer<typeof bookCallSchema>
type ReviewBody   = z.infer<typeof reviewSchema>

// ── Route plugin ────────────────────────────────────────────────────────────

export async function studentCallsRoutes(fastify: FastifyInstance) {

  // ── POST /calls ── Book a call ────────────────────────────────────────────
  fastify.post<{ Body: BookCallBody }>(
    '/calls',
    { preHandler: requireStudent },
    async (request, reply) => {
      const caller = request.user as JwtPayload

      const parseResult = bookCallSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { agentId } = parseResult.data

      if (!Types.ObjectId.isValid(agentId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid agent ID.' })
      }

      // Verify agent is bookable
      const agent = await User.findOne(
        {
          _id:               agentId,
          takesStudentCalls: true,
          isAvailableForCalls: true,
          schedulingUrl:     { $ne: null },
          inviteStatus:      'ACCEPTED',
          role:              { $in: ['ADMIN', 'SUPER_ADMIN'] },
        },
        { schedulingUrl: 1 },
      ).lean<{ _id: Types.ObjectId; schedulingUrl: string }>()

      if (!agent) {
        return reply.code(404).send({
          error:   'AGENT_NOT_AVAILABLE',
          message: 'Agent not found or is not available for bookings.',
        })
      }

      // Check if student already has an active booking
      const existingActive = await CallBooking.findOne({
        studentId: new Types.ObjectId(caller.sub),
        status:    'ACTIVE',
      }).lean<{ _id: Types.ObjectId }>()

      if (existingActive) {
        return reply.code(409).send({
          error:   'ACTIVE_CALL_EXISTS',
          message: 'You already have an active call booking.',
          callId:  existingActive._id.toString(),
        })
      }

      // Create the booking — snapshot schedulingUrl at booking time
      const call = await CallBooking.create({
        studentId:    new Types.ObjectId(caller.sub),
        agentId:      new Types.ObjectId(agentId),
        status:       'ACTIVE',
        schedulingUrl: agent.schedulingUrl,
      })

      fastify.log.info(`[student/calls] Created booking callId=${call._id.toString()} studentId=${caller.sub} agentId=${agentId}`)

      return reply.code(201).send({
        call: {
          id:           call._id.toString(),
          agentId:      agentId,
          schedulingUrl: call.schedulingUrl,
          bookedAt:     call.bookedAt,
          status:       call.status,
        },
      })
    },
  )

  // ── GET /calls/active ── Get current active call ──────────────────────────
  fastify.get(
    '/calls/active',
    { preHandler: requireStudent },
    async (request, reply) => {
      const caller = request.user as JwtPayload

      const call = await CallBooking.findOne({
        studentId: new Types.ObjectId(caller.sub),
        status:    'ACTIVE',
      })
        .populate('agentId', 'firstName lastName avatarUrl')
        .lean()

      return reply.send({ call: call ?? null })
    },
  )

  // ── POST /calls/:id/review ── Submit a review ─────────────────────────────
  fastify.post<{ Params: { id: string }; Body: ReviewBody }>(
    '/calls/:id/review',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { id } = request.params
      const caller = request.user as JwtPayload

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid call ID.' })
      }

      const parseResult = reviewSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { rating, comment } = parseResult.data

      // Verify call belongs to student
      const call = await CallBooking.findOne({
        _id:       id,
        studentId: new Types.ObjectId(caller.sub),
      }).lean<{
        _id: Types.ObjectId
        agentId: Types.ObjectId
        status: string
      }>()

      if (!call) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Call not found.' })
      }

      // Must be COMPLETED to review
      if (call.status !== 'COMPLETED') {
        return reply.code(400).send({
          error:   'CALL_NOT_COMPLETED',
          message: 'You can only review completed calls.',
        })
      }

      // Check for duplicate review
      const existing = await AgentReview.findOne({ callId: new Types.ObjectId(id) }).lean()
      if (existing) {
        return reply.code(409).send({
          error:   'REVIEW_ALREADY_SUBMITTED',
          message: 'You have already submitted a review for this call.',
        })
      }

      // Create review — agentId comes from the call document, NOT from request body
      const review = await AgentReview.create({
        studentId: new Types.ObjectId(caller.sub),
        agentId:   call.agentId,
        callId:    new Types.ObjectId(id),
        rating,
        comment,
      })

      fastify.log.info(`[student/calls] Review submitted for callId=${id} by studentId=${caller.sub}`)

      return reply.code(201).send({
        review: {
          id:        review._id.toString(),
          rating:    review.rating,
          comment:   review.comment,
          createdAt: review.createdAt,
        },
      })
    },
  )
}
