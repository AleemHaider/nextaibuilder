// PBA-314 — Public certificate verification endpoint
// GET /api/certificate/verify/:token — unauthenticated, for shared links

import type { FastifyInstance } from 'fastify'
import { Certificate } from '../models/Certificate.js'
import { User } from '../models/User.js'
import { CohortMembership } from '../models/CohortMembership.js'
import { Cohort } from '../models/Cohort.js'

export async function certificateRoutes(fastify: FastifyInstance) {
  // ── GET /api/certificate/verify/:token ──────────────────────────────────
  // Public endpoint — no auth required. Used by shared certificate links.
  fastify.get<{ Params: { token: string } }>(
    '/verify/:token',
    async (request, reply) => {
      const { token } = request.params

      const certificate = await Certificate.findOne({ publicToken: token }).lean({ virtuals: true })

      if (!certificate) {
        return reply.status(404).send({ error: 'CERTIFICATE_NOT_FOUND' })
      }

      const [userData, membership] = await Promise.all([
        User.findById(certificate.userId).lean(),
        CohortMembership.findOne({ userId: certificate.userId }).lean(),
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
