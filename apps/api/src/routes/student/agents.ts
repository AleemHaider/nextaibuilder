// PBA-324 — Student agent listing API
// PBA-325 — Student agent detail API
// GET /api/student/agents       — list bookable agents with avg rating
// GET /api/student/agents/:id   — agent detail with reviews

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requireStudent } from '../../middleware/authenticate.js'
import { User } from '../../models/User.js'
import { AgentReview } from '../../models/AgentReview.js'

// ── Validation schemas ──────────────────────────────────────────────────────

const listAgentsQuerySchema = z.object({
  search: z.string().trim().optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(48).default(12),
})

type ListAgentsQuery = z.infer<typeof listAgentsQuerySchema>

// ── Route plugin ────────────────────────────────────────────────────────────

export async function studentAgentsRoutes(fastify: FastifyInstance) {

  // ── GET /agents ── List bookable agents ──────────────────────────────────
  fastify.get<{ Querystring: ListAgentsQuery }>(
    '/agents',
    { preHandler: requireStudent },
    async (request, reply) => {
      const parseResult = listAgentsQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_QUERY',
          message: 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { search, page, limit } = parseResult.data
      const skip = (page - 1) * limit

      // Build filter — only bookable agents
      const filter: Record<string, unknown> = {
        role:              { $in: ['ADMIN', 'SUPER_ADMIN'] },
        takesStudentCalls: true,
        isAvailableForCalls: true,
        schedulingUrl:     { $ne: null },
        inviteStatus:      'ACCEPTED',
      }

      if (search) {
        // Escape special regex characters to prevent ReDoS (CRIT-4)
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(escaped, 'i')
        filter['$or'] = [
          { firstName: regex },
          { lastName:  regex },
        ]
      }

      const total = await User.countDocuments(filter)

      const agents = await User.find(
        filter,
        { firstName: 1, lastName: 1, avatarUrl: 1, schedulingUrl: 1 },
      )
        .sort({ firstName: 1 })
        .skip(skip)
        .limit(limit)
        .lean<Array<{
          _id: Types.ObjectId
          firstName: string
          lastName: string
          avatarUrl: string | null
          schedulingUrl: string | null
        }>>()

      // Aggregate ratings from AgentReview
      const agentIds = agents.map((a) => a._id)

      const ratingAgg = await AgentReview.aggregate<{
        _id: Types.ObjectId
        avgRating: number
        reviewCount: number
      }>([
        { $match: { agentId: { $in: agentIds } } },
        {
          $group: {
            _id:         '$agentId',
            avgRating:   { $avg: '$rating' },
            reviewCount: { $sum: 1 },
          },
        },
      ])

      const ratingMap = new Map(
        ratingAgg.map((r) => [r._id.toString(), { avgRating: r.avgRating, reviewCount: r.reviewCount }]),
      )

      const result = agents.map((agent) => {
        const ratings = ratingMap.get(agent._id.toString())
        return {
          id:          agent._id.toString(),
          firstName:   agent.firstName,
          lastName:    agent.lastName,
          avatarUrl:   agent.avatarUrl,
          schedulingUrl: agent.schedulingUrl,
          avgRating:   ratings ? Math.round(ratings.avgRating * 10) / 10 : null,
          reviewCount: ratings?.reviewCount ?? 0,
        }
      })

      return reply.send({
        agents: result,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    },
  )

  // ── GET /agents/:id ── Agent detail with reviews ──────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/agents/:id',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { id } = request.params

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid agent ID.' })
      }

      const agent = await User.findOne(
        {
          _id:              id,
          takesStudentCalls: true,
          inviteStatus:     'ACCEPTED',
          role:             { $in: ['ADMIN', 'SUPER_ADMIN'] },
        },
        { firstName: 1, lastName: 1, avatarUrl: 1, schedulingUrl: 1, isAvailableForCalls: 1 },
      ).lean<{
        _id: Types.ObjectId
        firstName: string
        lastName: string
        avatarUrl: string | null
        schedulingUrl: string | null
        isAvailableForCalls: boolean
      }>()

      if (!agent) {
        return reply.code(404).send({ error: 'AGENT_NOT_FOUND', message: 'Agent not found.' })
      }

      // Aggregate rating
      const ratingAgg = await AgentReview.aggregate<{
        avgRating: number
        reviewCount: number
      }>([
        { $match: { agentId: new Types.ObjectId(id) } },
        {
          $group: {
            _id:         null,
            avgRating:   { $avg: '$rating' },
            reviewCount: { $sum: 1 },
          },
        },
      ])

      const ratings = ratingAgg[0]

      // Fetch up to 20 newest reviews with reviewer info
      const reviews = await AgentReview.find({ agentId: id })
        .populate<{ studentId: { firstName: string; lastName: string } }>('studentId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()

      const formattedReviews = reviews.map((r) => ({
        id:        r._id.toString(),
        rating:    r.rating,
        comment:   r.comment,
        createdAt: r.createdAt,
        reviewer:  {
          firstName: (r.studentId as unknown as { firstName: string; lastName: string }).firstName,
          lastName:  (r.studentId as unknown as { firstName: string; lastName: string }).lastName,
        },
      }))

      return reply.send({
        agent: {
          id:                  agent._id.toString(),
          firstName:           agent.firstName,
          lastName:            agent.lastName,
          avatarUrl:           agent.avatarUrl,
          schedulingUrl:       agent.schedulingUrl,
          isAvailableForCalls: agent.isAvailableForCalls,
          avgRating:           ratings ? Math.round(ratings.avgRating * 10) / 10 : null,
          reviewCount:         ratings?.reviewCount ?? 0,
        },
        reviews: formattedReviews,
      })
    },
  )
}
