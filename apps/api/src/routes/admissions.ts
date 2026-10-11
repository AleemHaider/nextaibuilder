// sdk.nextaibuilder.com — Public admission form for the physical course
// POST /api/v1/admissions — public, rate-limited submission endpoint

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AdmissionApplication } from '../models/AdmissionApplication.js'
import { sendEmail, admissionNotificationTemplate, admissionWelcomeTemplate } from '../lib/email.js'

const admissionBodySchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(200),
  email:    z.string().trim().email('A valid email is required').max(320),
  phone:    z.string().trim().min(1, 'Phone number is required').max(40),
  track:    z.enum(['6-month', '1-year'], { errorMap: () => ({ message: 'Select a track' }) }),
  message:  z.string().trim().max(5000).optional(),
})

type AdmissionBody = z.infer<typeof admissionBodySchema>

export async function admissionsRoutes(fastify: FastifyInstance) {
  // ── POST / ── Submit a physical-course admission application ────────────
  fastify.post<{ Body: AdmissionBody }>(
    '/',
    {
      // Public form on a marketing page — keep the ceiling low enough to
      // blunt scripted spam without blocking a genuine applicant retrying.
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const parsed = admissionBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }
      const { fullName, email, phone, track, message } = parsed.data

      const application = await AdmissionApplication.create({
        fullName,
        email,
        phone,
        track,
        message: message || null,
      })

      // Fire-and-forget — a delivery failure must never fail the applicant's submission.
      sendEmail(
        email,
        'Welcome to nextaibuilder — Agentic AI Engineer',
        admissionWelcomeTemplate({ fullName, track }),
      ).catch((err) => {
        console.error('[AdmissionsRoute] welcome email failed:', err)
      })

      const notifyTo = process.env.ADMISSIONS_NOTIFICATION_EMAIL
      if (notifyTo) {
        // Fire-and-forget — a delivery failure must never fail the applicant's submission.
        sendEmail(
          notifyTo,
          `New admission application: ${fullName}`,
          admissionNotificationTemplate({ fullName, email, phone, track, message: message || null }),
        ).catch((err) => {
          console.error('[AdmissionsRoute] notification email failed:', err)
        })
      }

      return reply.code(201).send({ id: application.id })
    },
  )
}
