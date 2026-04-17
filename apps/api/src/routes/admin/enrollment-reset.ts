// FIR-168 — Admin PATCH to reset student enrollment progress
// PATCH /api/v1/admin/enrollments/:enrollmentId/reset

import type { FastifyInstance } from 'fastify'
import { Types } from 'mongoose'
import { requirePermission } from '../../middleware/require-permission.js'
import { Enrollment } from '../../models/Enrollment.js'
import { StudentLesson } from '../../models/StudentLesson.js'
import { Certificate } from '../../models/Certificate.js'

export async function adminEnrollmentResetRoutes(fastify: FastifyInstance) {

  // PATCH /:enrollmentId/reset
  fastify.patch<{ Params: { enrollmentId: string } }>(
    '/:enrollmentId/reset',
    {
      preHandler: requirePermission('enrollments:manage'),
    },
    async (request, reply) => {
      const { enrollmentId } = request.params

      if (!Types.ObjectId.isValid(enrollmentId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid enrollmentId.' })
      }

      const enrollment = await Enrollment.findById(enrollmentId)
      if (!enrollment) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Enrollment not found.' })
      }

      // Reset all StudentLesson records for this enrollment back to LOCKED
      await StudentLesson.updateMany(
        { enrollmentId: enrollment._id },
        {
          $set:   { status: 'LOCKED', watchPositionSeconds: 0 },
          $unset: { completedAt: '' },
        },
      )

      // Reset completion metrics on the enrollment
      const updated = await Enrollment.findByIdAndUpdate(
        enrollment._id,
        {
          $set:   { completionPercentage: 0, lessonsCompleted: 0 },
          $unset: { lastActivityAt: '' },
        },
        { new: true },
      )

      // Delete certificate if one exists for this enrollment
      await Certificate.deleteOne({ enrollmentId: enrollment._id })

      return reply.code(200).send({
        success:    true,
        enrollment: updated,
      })
    },
  )
}
