// FIR-209 — GET /api/v1/admin/students/:id — Full student profile
// FIR-210 — POST /api/v1/admin/students/:id/enroll — Manual enrollment
// FIR-211 — PATCH /api/v1/admin/students/:id/status — Suspend or activate
// FIR-212 — GET /api/v1/admin/students/export — CSV export

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requirePermission } from '../../middleware/require-permission.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { User } from '../../models/User.js'
import { Cohort } from '../../models/Cohort.js'
import { Enrollment } from '../../models/Enrollment.js'
import { StripePayment } from '../../models/StripePayment.js'
import { ManualPaymentRequest } from '../../models/ManualPaymentRequest.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidOid(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

function escapeCsvField(value: unknown): string {
  const s = String(value ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvField).join(',')
  const dataLines  = rows.map((row) => row.map(escapeCsvField).join(','))
  return [headerLine, ...dataLines].join('\n')
}

// ── Zod schemas ─────────────────────────────────────────────────────────────

// FIR-210 — manual enrollment body
const manualEnrollSchema = z.object({
  cohortId:      z.string().min(1),
  paymentMethod: z.literal('MANUAL_ADMIN'),
  paymentStatus: z.enum(['PAID', 'WAIVED', 'PENDING']),
})

// FIR-211 — status update body
const studentStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().max(500).optional(),
})

// ── Route plugin ─────────────────────────────────────────────────────────────

export async function firAdminStudentsRoutes(fastify: FastifyInstance) {
  // ── FIR-212: GET /export — must come before /:id to avoid route collision ──
  fastify.get('/export', { preHandler: requirePermission(['students:read', 'reports:export']) }, async (request, reply) => {
    try {
      const querySchema = z.object({
        status:   z.enum(['ACTIVE', 'SUSPENDED']).optional(),
        cohortId: z.string().optional(),
      })

      const parsed = querySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'INVALID_QUERY', message: 'Invalid query parameters.' })
      }

      const { status, cohortId } = parsed.data

      // Build student filter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userFilter: Record<string, any> = { role: 'STUDENT' }
      if (status === 'ACTIVE')    userFilter.isActive = true
      if (status === 'SUSPENDED') userFilter.isActive = false

      // If cohortId filter provided, first resolve which studentIds belong to that cohort
      let studentIdFilter: Types.ObjectId[] | null = null
      if (cohortId) {
        if (!isValidOid(cohortId)) {
          return reply.code(400).send({ error: 'INVALID_QUERY', message: 'Invalid cohortId.' })
        }
        const cohortEnrollments = await Enrollment.find(
          { cohortId: new Types.ObjectId(cohortId) },
          { studentId: 1 },
        ).lean()
        studentIdFilter = cohortEnrollments.map((e) => e.studentId as Types.ObjectId)
        userFilter._id = { $in: studentIdFilter }
      }

      // Fetch all matching students (no pagination — full export)
      const students = await User.find(userFilter)
        .select('_id firstName lastName email isActive role lastActiveAt createdAt')
        .lean()

      if (students.length === 0) {
        // Return empty CSV with headers
        const csv = buildCsv(
          ['ID', 'First Name', 'Last Name', 'Email', 'Status', 'Role', 'Enrollments', 'Last Active', 'Created At'],
          [],
        )
        void reply.header('Content-Type', 'text/csv')
        void reply.header('Content-Disposition', 'attachment; filename="students.csv"')
        return reply.code(200).send(csv)
      }

      // Batch fetch enrollment counts for all students in one query
      const studentIds = students.map((s) => s._id)
      const enrollmentCounts = await Enrollment.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { studentId: { $in: studentIds } } },
        { $group: { _id: '$studentId', count: { $sum: 1 } } },
      ])
      const enrollmentCountMap = new Map(
        enrollmentCounts.map((e) => [e._id.toString(), e.count]),
      )

      // Build CSV rows
      const rows: unknown[][] = students.map((s) => [
        s._id.toString(),
        s.firstName,
        s.lastName,
        s.email,
        s.isActive ? 'Active' : 'Suspended',
        s.role,
        enrollmentCountMap.get(s._id.toString()) ?? 0,
        s.lastActiveAt ? new Date(s.lastActiveAt).toISOString() : '',
        new Date(s.createdAt).toISOString(),
      ])

      const csv = buildCsv(
        ['ID', 'First Name', 'Last Name', 'Email', 'Status', 'Role', 'Enrollments', 'Last Active', 'Created At'],
        rows,
      )

      void reply.header('Content-Type', 'text/csv')
      void reply.header('Content-Disposition', 'attachment; filename="students.csv"')
      return reply.code(200).send(csv)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred.' })
    }
  })

  // ── FIR-209: GET /:id — Full student profile ───────────────────────────────
  fastify.get('/:id', { preHandler: requirePermission('students:read') }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid student ID.' })
      }

      const studentOid = new Types.ObjectId(id)

      // Fetch student (role guard: must be STUDENT role)
      const student = await User.findOne({ _id: studentOid, role: 'STUDENT' })
        .select('_id email firstName lastName isActive role createdAt lastActiveAt')
        .lean()

      if (!student) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Student not found.' })
      }

      // Fetch enrollments with cohort name populated via $lookup
      interface EnrollmentWithCohort {
        _id: Types.ObjectId
        cohortId: Types.ObjectId
        cohortName: string
        status: string
        paymentStatus: string
        paymentMethod: string
        completionPercentage: number
        lessonsCompleted: number
        createdAt: Date
      }

      const enrollments = await Enrollment.aggregate<EnrollmentWithCohort>([
        { $match: { studentId: studentOid } },
        {
          $lookup: {
            from:         'cohorts',
            localField:   'cohortId',
            foreignField: '_id',
            as:           'cohort',
          },
        },
        { $unwind: { path: '$cohort', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            cohortId:             1,
            cohortName:           { $ifNull: ['$cohort.name', ''] },
            status:               1,
            paymentStatus:        1,
            paymentMethod:        1,
            completionPercentage: 1,
            lessonsCompleted:     1,
            createdAt:            1,
          },
        },
        { $sort: { createdAt: -1 } },
      ])

      // Build a map of enrollmentId → cohortTitle for payment join
      const enrollmentCohortMap = new Map(
        enrollments.map((e) => [e._id.toString(), e.cohortName]),
      )

      // Fetch Stripe payments
      interface StripePaymentLean {
        _id: Types.ObjectId
        enrollmentId: Types.ObjectId
        amount: number
        currency: string
        status: string
        createdAt: Date
      }

      const stripePayments = await StripePayment.find({ studentId: studentOid })
        .select('_id enrollmentId amount currency status createdAt')
        .sort({ createdAt: -1 })
        .lean() as StripePaymentLean[]

      // Fetch manual payment requests
      interface ManualPaymentLean {
        _id: Types.ObjectId
        enrollmentId?: Types.ObjectId
        cohortId: Types.ObjectId
        amount?: number
        status: string
        createdAt: Date
      }

      const manualPayments = await ManualPaymentRequest.find({ studentId: studentOid })
        .select('_id enrollmentId cohortId amount status createdAt')
        .sort({ createdAt: -1 })
        .lean() as ManualPaymentLean[]

      // Combine payments list
      // We need cohort titles for manual payments — fetch cohort names in batch
      const manualCohortIds = manualPayments.map((m) => m.cohortId)
      const manualCohorts = await Cohort.find(
        { _id: { $in: manualCohortIds } },
        { _id: 1, name: 1 },
      ).lean()
      const manualCohortMap = new Map(manualCohorts.map((c) => [c._id.toString(), c.name]))

      const paymentsResponse = [
        ...stripePayments.map((p) => ({
          id:          p._id.toString(),
          amount:      p.amount,
          currency:    p.currency,
          status:      p.status,
          method:      'STRIPE',
          date:        p.createdAt,
          cohortTitle: enrollmentCohortMap.get(p.enrollmentId.toString()) ?? null,
        })),
        ...manualPayments.map((m) => ({
          id:          m._id.toString(),
          amount:      m.amount ?? null,
          currency:    'usd',
          status:      m.status,
          method:      'MANUAL_RECEIPT',
          date:        m.createdAt,
          cohortTitle: manualCohortMap.get(m.cohortId.toString()) ?? null,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // Compute stats
      const totalEnrollments    = enrollments.length
      const activeEnrollments   = enrollments.filter((e) => e.status === 'ACTIVE').length
      const completedEnrollments = enrollments.filter((e) => e.status === 'COMPLETED').length
      const totalPaid = stripePayments
        .filter((p) => p.status === 'SUCCEEDED')
        .reduce((sum, p) => sum + p.amount, 0)

      return reply.code(200).send({
        student: {
          id:           student._id.toString(),
          email:        student.email,
          firstName:    student.firstName,
          lastName:     student.lastName,
          isActive:     student.isActive,
          role:         student.role,
          createdAt:    student.createdAt,
          lastActiveAt: student.lastActiveAt,
        },
        enrollments: enrollments.map((e) => ({
          id:                   e._id.toString(),
          cohortId:             e.cohortId.toString(),
          cohortTitle:          e.cohortName,
          status:               e.status,
          paymentStatus:        e.paymentStatus,
          paymentMethod:        e.paymentMethod,
          completionPercentage: e.completionPercentage,
          lessonsCompleted:     e.lessonsCompleted,
          enrolledAt:           e.createdAt,
        })),
        payments: paymentsResponse,
        stats: {
          totalEnrollments,
          activeEnrollments,
          completedEnrollments,
          totalPaid,
        },
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred.' })
    }
  })

  // ── FIR-210: POST /:id/enroll — Manual enrollment ─────────────────────────
  fastify.post('/:id/enroll', { preHandler: requirePermission(['students:override', 'enrollments:create']) }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid student ID.' })
      }

      const parsed = manualEnrollSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: 'Invalid request body.',
          errors:  parsed.error.flatten().fieldErrors,
        })
      }

      const { cohortId, paymentMethod, paymentStatus } = parsed.data

      if (!isValidOid(cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid cohortId.' })
      }

      const studentOid = new Types.ObjectId(id)
      const cohortOid  = new Types.ObjectId(cohortId)

      // Verify student exists and has STUDENT role
      const student = await User.findOne({ _id: studentOid, role: 'STUDENT' }).select('_id').lean()
      if (!student) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Student not found.' })
      }

      // Verify cohort exists
      const cohort = await Cohort.findById(cohortOid).select('_id name').lean()
      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found.' })
      }

      // Check for duplicate enrollment
      const existing = await Enrollment.findOne({ studentId: studentOid, cohortId: cohortOid }).lean()
      if (existing) {
        return reply.code(409).send({
          error:   'ALREADY_ENROLLED',
          message: 'Student is already enrolled in this cohort.',
        })
      }

      // Get admin userId from JWT
      const adminPayload = request.user as JwtPayload
      const adminOid     = new Types.ObjectId(adminPayload.sub)

      // Create the enrollment
      const enrollment = await Enrollment.create({
        studentId:     studentOid,
        cohortId:      cohortOid,
        paymentMethod: paymentMethod,
        paymentStatus: paymentStatus,
        status:        'ACTIVE',
        enrolledBy:    adminOid,
        accessGrantedAt: new Date(),
      })

      return reply.code(201).send({
        success: true,
        message: 'Student enrolled successfully.',
        enrollment: {
          id:            enrollment._id.toString(),
          studentId:     enrollment.studentId.toString(),
          cohortId:      enrollment.cohortId.toString(),
          cohortTitle:   cohort.name,
          paymentMethod: enrollment.paymentMethod,
          paymentStatus: enrollment.paymentStatus,
          status:        enrollment.status,
          enrolledBy:    enrollment.enrolledBy?.toString(),
          enrolledAt:    enrollment.createdAt,
        },
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred.' })
    }
  })

  // ── FIR-211: PATCH /:id/status — Suspend or activate ─────────────────────
  fastify.patch('/:id/status', { preHandler: requirePermission('students:override') }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid student ID.' })
      }

      const parsed = studentStatusSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: 'Invalid request body.',
          errors:  parsed.error.flatten().fieldErrors,
        })
      }

      const { status } = parsed.data
      const isSuspending = status === 'suspended'
      const studentOid   = new Types.ObjectId(id)

      // Verify student exists
      const student = await User.findOne({ _id: studentOid, role: 'STUDENT' })
        .select('_id email firstName lastName isActive role createdAt lastActiveAt')
        .lean()

      if (!student) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Student not found.' })
      }

      // Update isActive on user
      await User.updateOne({ _id: studentOid }, { $set: { isActive: !isSuspending } })

      // Update enrollment statuses in bulk
      if (isSuspending) {
        // Suspend all ACTIVE enrollments
        await Enrollment.updateMany(
          { studentId: studentOid, status: 'ACTIVE' },
          { $set: { status: 'SUSPENDED' } },
        )
      } else {
        // Reactivate all SUSPENDED enrollments
        await Enrollment.updateMany(
          { studentId: studentOid, status: 'SUSPENDED' },
          { $set: { status: 'ACTIVE' } },
        )
      }

      return reply.code(200).send({
        success: true,
        message: isSuspending ? 'Student account suspended.' : 'Student account reactivated.',
        student: {
          id:           student._id.toString(),
          email:        student.email,
          firstName:    student.firstName,
          lastName:     student.lastName,
          isActive:     !isSuspending,
          role:         student.role,
          createdAt:    student.createdAt,
          lastActiveAt: student.lastActiveAt,
        },
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred.' })
    }
  })
}
