// PBA-136 — Admin Student Step Override
// POST /api/admin/student-steps/:id/override — manually override a student's step status

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requirePermission } from '../../middleware/require-permission.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { StudentStep } from '../../models/StudentStep.js'
import { AuditLog } from '../../models/AuditLog.js'
import { ActivityLog } from '../../models/ActivityLog.js'

// ── Validation schemas ─────────────────────────────────────────────────────

const overrideSchema = z.object({
  status: z.enum(['OVERRIDE_PASS', 'OVERRIDE_FAIL']),
  note:   z.string().trim().optional(),
})

type OverrideBody = z.infer<typeof overrideSchema>

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

// ── Route plugin ───────────────────────────────────────────────────────────

export async function adminStudentStepsRoutes(fastify: FastifyInstance) {

  // ── POST /:id/override ── Override student step status ────────────────
  fastify.post<{ Params: { id: string }; Body: OverrideBody }>(
    '/:id/override',
    { preHandler: requirePermission('students:override') },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid student step ID.' })
      }

      const parseResult = overrideSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { status, note } = parseResult.data

      // 1. Find the StudentStep
      const studentStep = await StudentStep.findById(id)
      if (!studentStep) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Student step not found.' })
      }

      const previousStatus = studentStep.status

      // 2. Apply the override
      studentStep.status = status
      if (status === 'OVERRIDE_PASS') {
        studentStep.completedAt = new Date()
      }
      await studentStep.save()

      // 3. Write an AuditLog entry
      const adminPayload = request.user as JwtPayload
      await AuditLog.create({
        adminId:    new Types.ObjectId(adminPayload.sub),
        action:     'STEP_OVERRIDE',
        targetType: 'StudentStep',
        targetId:   (studentStep as unknown as { _id: Types.ObjectId })._id.toString(),
        note:       note ?? null,
        metadata:   { previousStatus, newStatus: status, note: note ?? null },
      })

      // PBA-360: fire-and-forget activity log
      const activityType = status === 'OVERRIDE_PASS' ? 'step_override_pass' : 'step_override_fail'
      ActivityLog.create({
        userId:    studentStep.userId,
        actorId:   new Types.ObjectId(adminPayload.sub),
        actorRole: adminPayload.role === 'SUPER_ADMIN' ? 'admin' : 'sub_admin',
        type:      activityType,
        metadata:  {
          stepId:  studentStep.stepId?.toString() ?? null,
          note:    note ?? null,
          adminId: adminPayload.sub,
        },
      }).catch((err: unknown) =>
        fastify.log.error(err, `[admin/student-steps] ${activityType}: failed to write ActivityLog`),
      )

      fastify.log.info(
        `[admin] Step override: studentStep=${id} admin=${adminPayload.sub} ` +
        `${previousStatus} → ${status}`,
      )

      return reply.send({ studentStep: studentStep.toJSON() })
    },
  )
}
