// FIR-76  — Revenue dashboard
// FIR-77  — Enrollment metrics
// FIR-78  — Payment history table
// FIR-79  — Cohort performance
// FIR-174 — CSV export for revenue + enrollments
//
// All routes: GET /api/v1/admin/analytics/*
// All require requirePermission('analytics:read')

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requirePermission } from '../../middleware/require-permission.js'
import { Enrollment } from '../../models/Enrollment.js'
import { Cohort } from '../../models/Cohort.js'
import { StripePayment } from '../../models/StripePayment.js'
import { ManualPaymentRequest } from '../../models/ManualPaymentRequest.js'
import { User } from '../../models/User.js'

// ── Query schema helpers ──────────────────────────────────────────────────

const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
})

function defaultDateRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
  const to   = toStr   ? new Date(toStr)   : new Date()
  const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { from, to }
}

function isValidOid(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

// ── CSV helpers ───────────────────────────────────────────────────────────

function escapeCsvField(value: unknown): string {
  const s = String(value ?? '')
  // If contains comma, quote, or newline — wrap in double quotes and escape inner quotes
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

// ── Route plugin ──────────────────────────────────────────────────────────

export async function adminAnalyticsRoutes(fastify: FastifyInstance) {
  const guard = { preHandler: requirePermission('analytics:read') }

  // ── FIR-76: GET /revenue ──────────────────────────────────────────────
  fastify.get('/revenue', guard, async (request, reply) => {
    const parsed = dateRangeSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_QUERY', message: 'Invalid date range.' })
    }
    const { from, to } = defaultDateRange(parsed.data.from, parsed.data.to)

    // Stripe payments (SUCCEEDED) in range
    const stripeAgg = await StripePayment.aggregate<{ _id: Types.ObjectId; revenue: number }>([
      {
        $match: {
          status:    'SUCCEEDED',
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $lookup: {
          from:         'enrollments',
          localField:   'enrollmentId',
          foreignField: '_id',
          as:           'enrollment',
        },
      },
      { $unwind: { path: '$enrollment', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id:     '$enrollment.cohortId',
          revenue: { $sum: '$amount' },
        },
      },
    ])

    // Manual payments (APPROVED) in range
    const manualAgg = await ManualPaymentRequest.aggregate<{ _id: Types.ObjectId; revenue: number }>([
      {
        $match: {
          status:    'APPROVED',
          updatedAt: { $gte: from, $lte: to },
          amount:    { $exists: true, $gt: 0 },
        },
      },
      {
        $group: {
          _id:     '$cohortId',
          revenue: { $sum: '$amount' },
        },
      },
    ])

    // Merge revenue by cohortId
    const revenueMap = new Map<string, number>()
    for (const row of stripeAgg) {
      const id = row._id.toString()
      revenueMap.set(id, (revenueMap.get(id) ?? 0) + row.revenue)
    }
    for (const row of manualAgg) {
      const id = row._id.toString()
      revenueMap.set(id, (revenueMap.get(id) ?? 0) + row.revenue)
    }

    const cohortIds = [...revenueMap.keys()].filter(isValidOid).map((id) => new Types.ObjectId(id))
    const cohorts   = await Cohort.find({ _id: { $in: cohortIds } }).select('_id name').lean()
    const cohortNames = new Map(cohorts.map((c) => [c._id.toString(), c.name]))

    const revenueByCohort = [...revenueMap.entries()].map(([cohortId, revenue]) => ({
      cohortId,
      cohortName: cohortNames.get(cohortId) ?? 'Unknown',
      revenue,
    }))

    const totalRevenue = revenueByCohort.reduce((sum, r) => sum + r.revenue, 0)

    // MRR: active Stripe subscription payments (approximated as SUCCEEDED payments in last 30 days)
    const mrrFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const mrrResult = await StripePayment.aggregate<{ _id: null; total: number }>([
      { $match: { status: 'SUCCEEDED', createdAt: { $gte: mrrFrom } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    const mrr = mrrResult[0]?.total ?? 0

    return reply.code(200).send({ totalRevenue, mrr, revenueByCohort })
  })

  // ── FIR-77: GET /enrollments ──────────────────────────────────────────
  fastify.get<{ Querystring: { cohortId?: string } }>('/enrollments', guard, async (request, reply) => {
    const { cohortId } = request.query as { cohortId?: string }
    const matchFilter: Record<string, unknown> = {}
    if (cohortId && isValidOid(cohortId)) {
      matchFilter['cohortId'] = new Types.ObjectId(cohortId)
    }

    const countsByStatus = await Enrollment.aggregate<{ _id: string; count: number }>([
      { $match: matchFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])

    const statusMap: Record<string, number> = {}
    for (const row of countsByStatus) {
      statusMap[row._id] = row.count
    }

    const total     = Object.values(statusMap).reduce((s, c) => s + c, 0)
    const active    = statusMap['ACTIVE']    ?? 0
    const suspended = statusMap['SUSPENDED'] ?? 0
    const revoked   = statusMap['REVOKED']   ?? 0
    const completed = statusMap['COMPLETED'] ?? 0

    // byCohort breakdown
    const byCohortAgg = await Enrollment.aggregate<{ _id: Types.ObjectId; active: number; pending: number }>([
      {
        $group: {
          _id:     '$cohortId',
          active:  { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] },    1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'SUSPENDED'] }, 1, 0] } },
        },
      },
      { $sort: { active: -1 } },
      { $limit: 50 },
    ])

    const cohortIds = byCohortAgg.map((r) => r._id).filter(Boolean)
    const cohorts   = await Cohort.find({ _id: { $in: cohortIds } }).select('_id name').lean()
    const cohortNames = new Map(cohorts.map((c) => [c._id.toString(), c.name]))

    const byCohort = byCohortAgg.map((r) => ({
      cohortId:   r._id.toString(),
      cohortName: cohortNames.get(r._id.toString()) ?? 'Unknown',
      active:     r.active,
      pending:    r.pending,
    }))

    return reply.code(200).send({
      total,
      active,
      pending:   0,      // Enrollment.status has no PENDING — map suspended as closest proxy
      cancelled: revoked,
      suspended,
      completed,
      byCohort,
    })
  })

  // ── FIR-78: GET /payments ─────────────────────────────────────────────
  fastify.get('/payments', guard, async (request, reply) => {
    const querySchema = z.object({
      from:     z.string().datetime().optional(),
      to:       z.string().datetime().optional(),
      cohortId: z.string().optional(),
      method:   z.enum(['STRIPE', 'MANUAL']).optional(),
      page:     z.coerce.number().int().min(1).default(1),
      limit:    z.coerce.number().int().min(1).max(100).default(20),
    })

    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_QUERY', details: parsed.error.flatten().fieldErrors })
    }

    const { from: fromStr, to: toStr, cohortId, method, page, limit } = parsed.data
    const { from, to } = defaultDateRange(fromStr, toStr)
    const skip = (page - 1) * limit

    type PaymentRow = {
      id:           string
      studentName:  string
      studentEmail: string
      cohortName:   string
      amount:       number
      method:       string
      status:       string
      date:         Date
    }

    const rows: PaymentRow[] = []

    // Fetch Stripe payments via aggregation to avoid populate+lean type issues
    if (!method || method === 'STRIPE') {
      const stripeMatchStage: Record<string, unknown> = {
        createdAt: { $gte: from, $lte: to },
      }

      const stripeAggRows = await StripePayment.aggregate<{
        _id:          Types.ObjectId
        amount:       number
        status:       string
        createdAt:    Date
        studentName:  string
        studentEmail: string
        cohortName:   string
      }>([
        { $match: stripeMatchStage },
        {
          $lookup: {
            from:         'enrollments',
            localField:   'enrollmentId',
            foreignField: '_id',
            as:           'enrollment',
          },
        },
        { $unwind: { path: '$enrollment', preserveNullAndEmptyArrays: false } },
        ...(cohortId && isValidOid(cohortId)
          ? [{ $match: { 'enrollment.cohortId': new Types.ObjectId(cohortId) } }]
          : []),
        {
          $lookup: {
            from:         'users',
            localField:   'enrollment.studentId',
            foreignField: '_id',
            as:           'student',
          },
        },
        { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from:         'cohorts',
            localField:   'enrollment.cohortId',
            foreignField: '_id',
            as:           'cohort',
          },
        },
        { $unwind: { path: '$cohort', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id:          1,
            amount:       1,
            status:       1,
            createdAt:    1,
            studentName:  { $concat: ['$student.firstName', ' ', '$student.lastName'] },
            studentEmail: '$student.email',
            cohortName:   '$cohort.name',
          },
        },
      ])

      for (const p of stripeAggRows) {
        rows.push({
          id:           p._id.toString(),
          studentName:  p.studentName  ?? 'Unknown',
          studentEmail: p.studentEmail ?? '',
          cohortName:   p.cohortName   ?? 'Unknown',
          amount:       p.amount,
          method:       'STRIPE',
          status:       p.status,
          date:         p.createdAt,
        })
      }
    }

    // Fetch Manual payments
    if (!method || method === 'MANUAL') {
      const manualFilter: Record<string, unknown> = {
        createdAt: { $gte: from, $lte: to },
        status:    'APPROVED',
      }
      if (cohortId && isValidOid(cohortId)) {
        manualFilter['cohortId'] = new Types.ObjectId(cohortId)
      }

      const manualPayments = await ManualPaymentRequest.find(manualFilter)
        .select('studentId cohortId amount status createdAt')
        .lean()

      const studentIds2  = manualPayments.map((p) => p.studentId)
      const cohortIds2   = manualPayments.map((p) => p.cohortId)

      const [students2, cohorts2] = await Promise.all([
        User.find({ _id: { $in: studentIds2 } }).select('_id firstName lastName email').lean(),
        Cohort.find({ _id: { $in: cohortIds2 } }).select('_id name').lean(),
      ])

      const studentMap2 = new Map(students2.map((u) => [u._id.toString(), u]))
      const cohortMap2  = new Map(cohorts2.map((c)  => [c._id.toString(), c.name]))

      for (const p of manualPayments) {
        const s2 = studentMap2.get(p.studentId.toString())
        rows.push({
          id:           (p._id as Types.ObjectId).toString(),
          studentName:  s2 ? `${s2.firstName} ${s2.lastName}` : 'Unknown',
          studentEmail: s2?.email ?? '',
          cohortName:   cohortMap2.get(p.cohortId.toString()) ?? 'Unknown',
          amount:       p.amount ?? 0,
          method:       'MANUAL',
          status:       p.status,
          date:         p.createdAt,
        })
      }
    }

    // Sort all rows by date descending, then paginate
    rows.sort((a, b) => b.date.getTime() - a.date.getTime())
    const total      = rows.length
    const paginated  = rows.slice(skip, skip + limit)

    return reply.code(200).send({
      data:       paginated,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  })

  // ── FIR-79: GET /cohorts ──────────────────────────────────────────────
  fastify.get('/cohorts', guard, async (request, reply) => {
    const agg = await Enrollment.aggregate<{
      _id:              Types.ObjectId
      totalEnrolled:    number
      avgCompletionPct: number | null
      completedCount:   number
    }>([
      {
        $group: {
          _id:                  '$cohortId',
          totalEnrolled:        { $sum: 1 },
          avgCompletionPct:     { $avg: '$completionPercentage' },
          completedCount:       { $sum: { $cond: [{ $gte: ['$completionPercentage', 100] }, 1, 0] } },
        },
      },
      { $sort: { totalEnrolled: -1 } },
    ])

    const cohortIds = agg.map((r) => r._id).filter(Boolean)
    const cohorts   = await Cohort.find({ _id: { $in: cohortIds } }).select('_id name').lean()
    const cohortNames = new Map(cohorts.map((c) => [c._id.toString(), c.name]))

    const result = agg.map((r) => ({
      cohortId:               r._id.toString(),
      cohortName:             cohortNames.get(r._id.toString()) ?? 'Unknown',
      totalEnrolled:          r.totalEnrolled,
      avgCompletionPercentage: Math.round(r.avgCompletionPct ?? 0),
      completedCount:         r.completedCount,
    }))

    return reply.code(200).send(result)
  })

  // ── FIR-174: GET /revenue/csv ─────────────────────────────────────────
  fastify.get('/revenue/csv', guard, async (request, reply) => {
    const parsed = dateRangeSchema.safeParse(request.query)
    const { from, to } = defaultDateRange(parsed.success ? parsed.data.from : undefined, parsed.success ? parsed.data.to : undefined)

    const stripeAgg = await StripePayment.aggregate<{ _id: Types.ObjectId; revenue: number }>([
      { $match: { status: 'SUCCEEDED', createdAt: { $gte: from, $lte: to } } },
      {
        $lookup: {
          from: 'enrollments', localField: 'enrollmentId', foreignField: '_id', as: 'enrollment',
        },
      },
      { $unwind: { path: '$enrollment', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$enrollment.cohortId', revenue: { $sum: '$amount' } } },
    ])

    const manualAgg = await ManualPaymentRequest.aggregate<{ _id: Types.ObjectId; revenue: number }>([
      { $match: { status: 'APPROVED', updatedAt: { $gte: from, $lte: to }, amount: { $exists: true, $gt: 0 } } },
      { $group: { _id: '$cohortId', revenue: { $sum: '$amount' } } },
    ])

    const revenueMap = new Map<string, number>()
    for (const r of stripeAgg)  revenueMap.set(r._id.toString(), (revenueMap.get(r._id.toString()) ?? 0) + r.revenue)
    for (const r of manualAgg)  revenueMap.set(r._id.toString(), (revenueMap.get(r._id.toString()) ?? 0) + r.revenue)

    const cohortIds = [...revenueMap.keys()].filter(isValidOid).map((id) => new Types.ObjectId(id))
    const cohorts   = await Cohort.find({ _id: { $in: cohortIds } }).select('_id name').lean()
    const cohortNames = new Map(cohorts.map((c) => [c._id.toString(), c.name]))

    const rows = [...revenueMap.entries()].map(([cohortId, revenue]) => [
      cohortId,
      cohortNames.get(cohortId) ?? 'Unknown',
      revenue,
    ])

    const csv      = buildCsv(['Cohort ID', 'Cohort Name', 'Revenue'], rows)
    const dateStr  = new Date().toISOString().slice(0, 10)

    void reply.header('Content-Type', 'text/csv; charset=utf-8')
    void reply.header('Content-Disposition', `attachment; filename="revenue-${dateStr}.csv"`)
    return reply.code(200).send(csv)
  })

  // ── FIR-174: GET /enrollments/csv ────────────────────────────────────
  fastify.get('/enrollments/csv', guard, async (request, reply) => {
    const byCohortAgg = await Enrollment.aggregate<{
      _id:       Types.ObjectId
      total:     number
      active:    number
      suspended: number
      revoked:   number
      completed: number
    }>([
      {
        $group: {
          _id:       '$cohortId',
          total:     { $sum: 1 },
          active:    { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] },     1, 0] } },
          suspended: { $sum: { $cond: [{ $eq: ['$status', 'SUSPENDED'] },  1, 0] } },
          revoked:   { $sum: { $cond: [{ $eq: ['$status', 'REVOKED'] },    1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] },  1, 0] } },
        },
      },
      { $sort: { total: -1 } },
    ])

    const cohortIds  = byCohortAgg.map((r) => r._id).filter(Boolean)
    const cohorts    = await Cohort.find({ _id: { $in: cohortIds } }).select('_id name').lean()
    const cohortNames = new Map(cohorts.map((c) => [c._id.toString(), c.name]))

    const rows = byCohortAgg.map((r) => [
      r._id.toString(),
      cohortNames.get(r._id.toString()) ?? 'Unknown',
      r.total,
      r.active,
      r.suspended,
      r.revoked,
      r.completed,
    ])

    const csv     = buildCsv(['Cohort ID', 'Cohort Name', 'Total', 'Active', 'Suspended', 'Revoked', 'Completed'], rows)
    const dateStr = new Date().toISOString().slice(0, 10)

    void reply.header('Content-Type', 'text/csv; charset=utf-8')
    void reply.header('Content-Disposition', `attachment; filename="enrollments-${dateStr}.csv"`)
    return reply.code(200).send(csv)
  })
}
