// PBA-314 / FIR-Sprint 2 Story 7 — Public certificate verification endpoint
// GET /api/v1/certificate/verify/:token — unauthenticated, for shared links.
//
// The certificate token lives on the Certificate model under one of three
// fields depending on when the certificate was issued:
//   • publicToken      — original UUID token (PBA-314)
//   • credentialId     — human-readable ID like NAB-2024-000042 (FIR-24)
//   • certificateToken — extended opaque token (FIR-24)
//
// To be forgiving of older links while still matching the BRD credentialId
// URLs, we look up the token against all three fields via $or.
//
// We deliberately respond HTTP 200 on "not found" with `{ valid: false }`
// rather than 404. A 404 leaks the non-existence of a credential to a
// scanner; returning a consistent envelope keeps the UI simple and avoids
// signal for enumeration attacks.

import type { FastifyInstance } from 'fastify'
import { Certificate } from '../models/Certificate.js'
import { User } from '../models/User.js'
import { Cohort } from '../models/Cohort.js'

// Response envelope — kept in sync with apps/web/src/pages/CertificateVerifyPage.tsx.
export interface CertificateVerifyCredential {
  credentialId: string
  studentName: string
  cohortTitle: string
  completedAt: string | null
  issuedAt: string
  status: 'VALID' | 'REVOKED'
}

export interface CertificateVerifyResponse {
  valid: boolean
  credential: CertificateVerifyCredential | null
}

export async function certificateRoutes(fastify: FastifyInstance) {
  // ── GET /verify/:token ─────────────────────────────────────────────────
  // Public endpoint — no auth required. Used by shared certificate links.
  fastify.get<{ Params: { token: string } }>(
    '/verify/:token',
    async (request, reply) => {
      const { token } = request.params

      // Defensive: an empty / whitespace token should behave the same as
      // "not found" rather than triggering a Mongo-wide $or scan.
      if (!token || !token.trim()) {
        const body: CertificateVerifyResponse = { valid: false, credential: null }
        return reply.status(200).send(body)
      }

      // Match the token against any of the three possible token fields.
      const certificate = await Certificate.findOne({
        $or: [
          { credentialId: token },
          { publicToken: token },
          { certificateToken: token },
        ],
      }).lean()

      if (!certificate) {
        const body: CertificateVerifyResponse = { valid: false, credential: null }
        return reply.status(200).send(body)
      }

      const [userData, cohort] = await Promise.all([
        User.findById(certificate.userId).lean(),
        certificate.cohortId
          ? Cohort.findById(certificate.cohortId).lean()
          : Promise.resolve(null),
      ])

      const studentName = userData
        ? `${userData.firstName ?? ''} ${userData.lastName ?? ''}`.trim()
        : ''
      const cohortTitle = cohort?.name ?? ''

      // Model has no explicit "status" field yet; a REVOKED flag can be
      // plumbed in later by adding `status` to Certificate.ts. For now we
      // look for a `status` property on the lean doc so the contract is
      // stable when that column lands.
      type MaybeStatus = { status?: string }
      const rawStatus = (certificate as unknown as MaybeStatus).status
      const status: 'VALID' | 'REVOKED' =
        rawStatus === 'REVOKED' ? 'REVOKED' : 'VALID'

      const credentialId =
        certificate.credentialId ?? certificate.publicToken ?? token

      const body: CertificateVerifyResponse = {
        valid: status === 'VALID',
        credential: {
          credentialId,
          studentName,
          cohortTitle,
          completedAt: null,
          issuedAt: certificate.issuedAt
            ? new Date(certificate.issuedAt).toISOString()
            : '',
          status,
        },
      }
      return reply.status(200).send(body)
    },
  )
}
