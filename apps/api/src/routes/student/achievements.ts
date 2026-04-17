// PBA-128 — Student Achievement API
// GET /api/student/badges       — all badges with earned status for this student
// GET /api/student/certificate  — the student's certificate, or null

import type { FastifyInstance } from 'fastify'
import { requireStudent } from '../../middleware/authenticate.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { Badge } from '../../models/Badge.js'
import { UserBadge } from '../../models/UserBadge.js'
import { Certificate } from '../../models/Certificate.js'
import { User } from '../../models/User.js'
import { CohortMembership } from '../../models/CohortMembership.js'
import { Cohort } from '../../models/Cohort.js'
import { Types } from 'mongoose'

export async function achievementsRoutes(fastify: FastifyInstance) {
  // ── GET /api/student/badges ─────────────────────────────────────────────
  // Returns every badge in the system annotated with whether this student has
  // earned it and, if so, when.
  fastify.get(
    '/badges',
    { preHandler: requireStudent },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const userId = new Types.ObjectId(user.sub)

      const [allBadges, userBadges] = await Promise.all([
        Badge.find().lean(),
        UserBadge.find({ userId }).lean(),
      ])

      // Build a fast lookup: badgeId → earnedAt
      const earnedMap = new Map<string, Date>()
      for (const ub of userBadges) {
        earnedMap.set(ub.badgeId.toString(), ub.earnedAt)
      }

      const badges = allBadges.map((badge) => {
        const badgeId = badge._id.toString()
        const earnedAt = earnedMap.get(badgeId) ?? null
        return {
          id:              badgeId,
          name:            badge.name,
          description:     badge.description,
          iconUrl:         badge.iconUrl,
          triggerCriteria: badge.triggerCriteria,
          earned:          earnedAt !== null,
          earnedAt,
        }
      })

      return reply.send({ badges })
    },
  )

  // ── GET /api/student/certificate ────────────────────────────────────────
  // Returns the student's certificate document or null if not yet earned.
  fastify.get(
    '/certificate',
    { preHandler: requireStudent },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const userId = new Types.ObjectId(user.sub)

      const certificate = await Certificate.findOne({ userId }).lean({ virtuals: true })

      if (!certificate) {
        return reply.send({ certificate: null })
      }

      const [userData, membership] = await Promise.all([
        User.findById(userId).lean(),
        CohortMembership.findOne({ userId }).lean(),
      ])

      const cohort = membership
        ? await Cohort.findById(membership.cohortId).lean()
        : null

      const studentName = userData
        ? `${userData.firstName} ${userData.lastName}`.trim()
        : ''
      const cohortName = cohort?.name ?? ''

      return reply.send({
        certificate: {
          id:          (certificate as typeof certificate & { id: string }).id,
          publicToken: certificate.publicToken,
          issuedAt:    certificate.issuedAt,
          studentName,
          cohortName,
        },
      })
    },
  )
}
