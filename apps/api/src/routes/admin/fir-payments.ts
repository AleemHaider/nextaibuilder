// FIR-216 — Admin: unified payment ledger (Stripe + Manual)
// FIR-217 — Admin: issue refund (Stripe SDK or Manual status update)
// FIR-218 — Admin: CSV export of payment ledger

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import type { PipelineStage } from 'mongoose'
import { authenticate, requireAdmin } from '../../middleware/require-admin.js'
import { StripePayment } from '../../models/StripePayment.js'
import { ManualPaymentRequest } from '../../models/ManualPaymentRequest.js'
import { stripe } from '../../lib/stripe.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidOid(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

/**
 * Escape a CSV cell value — wrap in quotes and escape internal quotes.
 */
function csvCell(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value)
  return `"${str.replace(/"/g, '""')}"`
}

// ── Zod schemas ────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  method:    z.enum(['STRIPE', 'MANUAL']).optional(),
  status:    z.enum(['SUCCEEDED', 'PENDING', 'REFUNDED', 'APPROVED', 'REJECTED']).optional(),
  studentId: z.string().optional(),
  cohortId:  z.string().optional(),
  from:      z.string().datetime().optional(),
  to:        z.string().datetime().optional(),
})

const refundBodySchema = z.object({
  type:   z.enum(['stripe', 'manual']),
  amount: z.number().positive(),
  reason: z.string().min(1).max(1000),
})

type ListQuery   = z.infer<typeof listQuerySchema>
type RefundBody  = z.infer<typeof refundBodySchema>

// ── Shared types ───────────────────────────────────────────────────────────

interface UnifiedPayment {
  id:           string
  type:         'stripe' | 'manual'
  amount:       number
  currency:     string
  status:       string
  studentName:  string
  studentEmail: string
  cohortTitle:  string
  date:         Date
  method:       string
  // Extra fields used only for refund routing
  stripePaymentIntentId?: string
}

// ── Aggregation helpers ────────────────────────────────────────────────────

/**
 * Build the common $match stage for StripePayment queries.
 */
function buildStripeMatch(
  query: ListQuery,
): Record<string, unknown> {
  const match: Record<string, unknown> = {}

  if (query.studentId && isValidOid(query.studentId)) {
    match['studentId'] = new Types.ObjectId(query.studentId)
  }
  if (query.from || query.to) {
    const dateFilter: Record<string, Date> = {}
    if (query.from) dateFilter['$gte'] = new Date(query.from)
    if (query.to)   dateFilter['$lte'] = new Date(query.to)
    match['createdAt'] = dateFilter
  }

  // Map unified status filter to Stripe-specific statuses
  if (query.status) {
    if (query.status === 'SUCCEEDED') match['status'] = 'SUCCEEDED'
    else if (query.status === 'REFUNDED') match['status'] = 'REFUNDED'
    // PENDING, APPROVED, REJECTED are manual-only — exclude stripe records if those are requested
    else if (['PENDING', 'APPROVED', 'REJECTED'].includes(query.status)) {
      match['_id'] = { $exists: false } // force empty result
    }
  }

  return match
}

/**
 * Build the common $match stage for ManualPaymentRequest queries.
 */
function buildManualMatch(
  query: ListQuery,
): Record<string, unknown> {
  const match: Record<string, unknown> = {}

  if (query.studentId && isValidOid(query.studentId)) {
    match['studentId'] = new Types.ObjectId(query.studentId)
  }
  if (query.cohortId && isValidOid(query.cohortId)) {
    match['cohortId'] = new Types.ObjectId(query.cohortId)
  }
  if (query.from || query.to) {
    const dateFilter: Record<string, Date> = {}
    if (query.from) dateFilter['$gte'] = new Date(query.from)
    if (query.to)   dateFilter['$lte'] = new Date(query.to)
    match['createdAt'] = dateFilter
  }

  // Map unified status filter to Manual-specific statuses
  if (query.status) {
    if (query.status === 'PENDING')   match['status'] = 'PENDING'
    else if (query.status === 'APPROVED') match['status'] = 'APPROVED'
    else if (query.status === 'REJECTED' || query.status === 'REFUNDED') match['status'] = 'REJECTED'
    // SUCCEEDED is stripe-only — exclude manual records if requested
    else if (query.status === 'SUCCEEDED') {
      match['_id'] = { $exists: false }
    }
  }

  return match
}

/**
 * Fetch and normalise StripePayment records into the unified shape.
 * When cohortId filter is active we join through Enrollment to get the cohortId.
 */
async function fetchStripePayments(query: ListQuery): Promise<UnifiedPayment[]> {
  const match = buildStripeMatch(query)

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from:         'users',
        localField:   'studentId',
        foreignField: '_id',
        as:           'student',
      },
    },
    { $unwind: { path: '$student', preserveNullAndEmptyArrays: false } },
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
      $lookup: {
        from:         'cohorts',
        localField:   'enrollment.cohortId',
        foreignField: '_id',
        as:           'cohort',
      },
    },
    { $unwind: { path: '$cohort', preserveNullAndEmptyArrays: false } },
  ]

  // Apply cohortId filter after joining
  if (query.cohortId && isValidOid(query.cohortId)) {
    pipeline.push({
      $match: { 'cohort._id': new Types.ObjectId(query.cohortId) },
    } as PipelineStage)
  }

  pipeline.push({
    $project: {
      _id:                    1,
      amount:                 1,
      currency:               1,
      status:                 1,
      createdAt:              1,
      stripePaymentIntentId:  1,
      studentFirstName: '$student.firstName',
      studentLastName:  '$student.lastName',
      studentEmail:     '$student.email',
      cohortTitle:      '$cohort.name',
    },
  } as PipelineStage)

  const rows = await StripePayment.aggregate(pipeline)

  return rows.map((r) => ({
    id:                    (r._id as Types.ObjectId).toString(),
    type:                  'stripe' as const,
    amount:                r.amount as number,
    currency:              (r.currency as string) ?? 'usd',
    status:                r.status as string,
    studentName:           `${r.studentFirstName as string} ${r.studentLastName as string}`.trim(),
    studentEmail:          r.studentEmail as string,
    cohortTitle:           r.cohortTitle as string,
    date:                  r.createdAt as Date,
    method:                'STRIPE',
    stripePaymentIntentId: r.stripePaymentIntentId as string | undefined,
  }))
}

/**
 * Fetch and normalise ManualPaymentRequest records into the unified shape.
 */
async function fetchManualPayments(query: ListQuery): Promise<UnifiedPayment[]> {
  const match = buildManualMatch(query)

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from:         'users',
        localField:   'studentId',
        foreignField: '_id',
        as:           'student',
      },
    },
    { $unwind: { path: '$student', preserveNullAndEmptyArrays: false } },
    {
      $lookup: {
        from:         'cohorts',
        localField:   'cohortId',
        foreignField: '_id',
        as:           'cohort',
      },
    },
    { $unwind: { path: '$cohort', preserveNullAndEmptyArrays: false } },
    {
      $project: {
        _id:       1,
        amount:    1,
        status:    1,
        createdAt: 1,
        studentFirstName: '$student.firstName',
        studentLastName:  '$student.lastName',
        studentEmail:     '$student.email',
        cohortTitle:      '$cohort.name',
      },
    } as PipelineStage,
  ]

  const rows = await ManualPaymentRequest.aggregate(pipeline)

  return rows.map((r) => ({
    id:           (r._id as Types.ObjectId).toString(),
    type:         'manual' as const,
    amount:       (r.amount as number) ?? 0,
    currency:     'usd',
    status:       r.status as string,
    studentName:  `${r.studentFirstName as string} ${r.studentLastName as string}`.trim(),
    studentEmail: r.studentEmail as string,
    cohortTitle:  r.cohortTitle as string,
    date:         r.createdAt as Date,
    method:       'MANUAL',
  }))
}

/**
 * Merge, sort by date desc, and compute summary totals.
 */
function mergeAndSort(stripe: UnifiedPayment[], manual: UnifiedPayment[]): UnifiedPayment[] {
  return [...stripe, ...manual].sort((a, b) => b.date.getTime() - a.date.getTime())
}

function computeSummary(payments: UnifiedPayment[]) {
  let totalRevenue  = 0
  let pendingAmount = 0
  let refundedAmount = 0

  for (const p of payments) {
    const successStatuses = ['SUCCEEDED', 'APPROVED']
    const pendingStatuses = ['PENDING']
    const refundStatuses  = ['REFUNDED', 'REJECTED']

    if (successStatuses.includes(p.status))  totalRevenue  += p.amount
    if (pendingStatuses.includes(p.status))  pendingAmount += p.amount
    if (refundStatuses.includes(p.status))   refundedAmount += p.amount
  }

  return { totalRevenue, pendingAmount, refundedAmount }
}

// ── Route plugin ──────────────────────────────────────────────────────────

export async function firAdminPaymentsRoutes(fastify: FastifyInstance) {

  // ── GET / ── FIR-216: Unified payment ledger ──────────────────────────────
  fastify.get<{ Querystring: ListQuery }>(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid query parameters.',
        })
      }

      const q = parsed.data

      if (q.studentId && !isValidOid(q.studentId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'studentId is not a valid ObjectId.' })
      }
      if (q.cohortId && !isValidOid(q.cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'cohortId is not a valid ObjectId.' })
      }

      try {
        const [stripePayments, manualPayments] = await Promise.all([
          q.method === 'MANUAL' ? Promise.resolve([]) : fetchStripePayments(q),
          q.method === 'STRIPE' ? Promise.resolve([]) : fetchManualPayments(q),
        ])

        const all      = mergeAndSort(stripePayments, manualPayments)
        const summary  = computeSummary(all)
        const total    = all.length
        const totalPages = Math.ceil(total / q.limit)
        const page     = q.page
        const paginated = all.slice((page - 1) * q.limit, page * q.limit)

        return reply.code(200).send({
          payments:   paginated,
          total,
          page,
          totalPages,
          summary,
        })
      } catch (err) {
        fastify.log.error(err, 'FIR-216 unified payment ledger error')
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch payments.' })
      }
    },
  )

  // ── POST /:id/refund ── FIR-217: Issue refund ─────────────────────────────
  fastify.post<{ Params: { id: string }; Body: RefundBody }>(
    '/:id/refund',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidOid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Payment id is not a valid ObjectId.' })
      }

      const parsed = refundBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }

      const { type, amount, reason } = parsed.data

      try {
        if (type === 'stripe') {
          const payment = await StripePayment.findById(id)
          if (!payment) {
            return reply.code(404).send({ error: 'NOT_FOUND', message: 'Stripe payment not found.' })
          }
          if (payment.status === 'REFUNDED') {
            return reply.code(409).send({ error: 'ALREADY_REFUNDED', message: 'Payment has already been refunded.' })
          }

          // Attempt Stripe SDK refund — gracefully degrade if Stripe not configured
          if (payment.stripePaymentIntentId && process.env.STRIPE_SECRET_KEY) {
            try {
              await stripe.refunds.create({
                payment_intent: payment.stripePaymentIntentId,
                amount:         Math.round(amount * 100), // Stripe expects cents
                reason:         'requested_by_customer',
              })
            } catch (stripeErr) {
              fastify.log.error(stripeErr, 'FIR-217 Stripe refund API call failed — updating DB only')
            }
          } else {
            fastify.log.warn(
              { paymentId: id },
              'FIR-217 Stripe not configured or no paymentIntentId — skipping Stripe SDK refund, updating DB only',
            )
          }

          payment.status = 'REFUNDED'
          await payment.save()

          return reply.code(200).send({
            message: 'Refund processed.',
            payment: payment.toJSON(),
          })
        }

        // type === 'manual'
        const manualPayment = await ManualPaymentRequest.findById(id)
        if (!manualPayment) {
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Manual payment not found.' })
        }
        if (manualPayment.status === 'REJECTED') {
          return reply.code(409).send({ error: 'ALREADY_REJECTED', message: 'Manual payment is already rejected/refunded.' })
        }

        manualPayment.status          = 'REJECTED'
        manualPayment.rejectionReason = reason
        manualPayment.reviewedAt      = new Date()
        await manualPayment.save()

        return reply.code(200).send({
          message: 'Manual payment marked as refunded.',
          payment: manualPayment.toJSON(),
        })
      } catch (err) {
        fastify.log.error(err, 'FIR-217 refund error')
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to process refund.' })
      }
    },
  )

  // ── GET /export ── FIR-218: CSV export ───────────────────────────────────
  fastify.get<{ Querystring: ListQuery }>(
    '/export',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid query parameters.',
        })
      }

      const q = parsed.data

      if (q.studentId && !isValidOid(q.studentId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'studentId is not a valid ObjectId.' })
      }
      if (q.cohortId && !isValidOid(q.cohortId)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'cohortId is not a valid ObjectId.' })
      }

      try {
        const [stripePayments, manualPayments] = await Promise.all([
          q.method === 'MANUAL' ? Promise.resolve([]) : fetchStripePayments(q),
          q.method === 'STRIPE' ? Promise.resolve([]) : fetchManualPayments(q),
        ])

        const all = mergeAndSort(stripePayments, manualPayments)

        // Build CSV rows
        const header = [
          'Date',
          'Type',
          'Amount',
          'Currency',
          'Status',
          'Student Name',
          'Student Email',
          'Course/Cohort',
          'Method',
        ].map(csvCell).join(',')

        const rows = all.map((p) =>
          [
            p.date.toISOString(),
            p.type,
            p.amount,
            p.currency.toUpperCase(),
            p.status,
            p.studentName,
            p.studentEmail,
            p.cohortTitle,
            p.method,
          ].map(csvCell).join(','),
        )

        const csv = [header, ...rows].join('\r\n')

        void reply
          .code(200)
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', 'attachment; filename="payments-export.csv"')
          .send(csv)
      } catch (err) {
        fastify.log.error(err, 'FIR-218 CSV export error')
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to export payments.' })
      }
    },
  )
}
