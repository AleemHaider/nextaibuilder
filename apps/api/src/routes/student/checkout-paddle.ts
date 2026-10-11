// Paddle one-time checkout (POST /api/v1/student/checkout/paddle)
//
// Flow:
//   1. Student picks a cohort → client POSTs { cohortId } (paymentPlanId optional;
//      defaults to the cohort's active ONE_TIME plan).
//   2. We run the same validation as the Stripe paths (published, not ended,
//      seats, plan active, not already enrolled).
//   3. We create/reuse a Paddle customer for the student, then create a Paddle
//      transaction server-side with a NON-CATALOG price built from the
//      PaymentPlan (so the price is locked and nothing needs syncing to the
//      Paddle catalog). custom_data carries { studentId, cohortId,
//      paymentPlanId, planType } — the webhook reads it back to activate the
//      enrollment, exactly like Stripe metadata.
//   4. Client opens Paddle.js overlay checkout with the returned transactionId.
//   5. Enrollment is created ONLY by the webhook (transaction.completed) —
//      never trust the client's "checkout.completed" event for provisioning.

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requireStudent } from '../../middleware/authenticate.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { PaymentPlan } from '../../models/PaymentPlan.js'
import { Cohort } from '../../models/Cohort.js'
import { User } from '../../models/User.js'
import { paddle, PADDLE_ENV, isPaddleConfigured } from '../../lib/paddle.js'
import { validateCheckoutRequest } from './checkout.js'
import { getFlashPromo, applyFlashPromo } from '../../lib/flashPromo.js'
import { ApiError, type CurrencyCode } from '@paddle/paddle-node-sdk'

const bodySchema = z.object({
  cohortId:      z.string().min(1, 'cohortId is required'),
  paymentPlanId: z.string().min(1).optional(),
})

// ── Create or reuse the Paddle customer for a student ──────────────────────
async function ensurePaddleCustomer(userId: string): Promise<string> {
  const user = await User.findById(userId).select('email firstName lastName paddleCustomerId').lean()
  if (!user) throw new Error(`User ${userId} not found`)
  if (user.paddleCustomerId) return user.paddleCustomerId

  let customerId: string
  try {
    const customer = await paddle.customers.create({
      email: user.email,
      name:  `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || null,
      customData: { userId },
    })
    customerId = customer.id
  } catch (err: unknown) {
    // Paddle rejects a second customer with the same email (409 conflict).
    // Recover by looking the existing one up so retries / re-signups work.
    if (err instanceof ApiError && err.code === 'customer_already_exists') {
      const page = await paddle.customers.list({ email: [user.email], perPage: 1 }).next()
      const existing = page[0]
      if (!existing) throw err
      customerId = existing.id
    } else {
      throw err
    }
  }

  await User.findByIdAndUpdate(userId, { paddleCustomerId: customerId })
  return customerId
}

export async function paddleCheckoutRoutes(fastify: FastifyInstance) {
  // ── GET /paddle/config ── public-safe client config ──────────────────────
  fastify.get('/paddle/config', async (_request, reply) => {
    return reply.send({ enabled: isPaddleConfigured(), environment: PADDLE_ENV })
  })

  // ── POST /paddle ── create a Paddle transaction for a one-time plan ──────
  fastify.post<{ Body: z.infer<typeof bodySchema> }>(
    '/paddle',
    {
      preHandler: requireStudent,
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload

      if (!isPaddleConfigured()) {
        return reply.code(503).send({ error: 'PADDLE_DISABLED', message: 'Card payments are not configured.' })
      }

      const parsed = bodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }
      const { cohortId: cohortIdStr } = parsed.data
      let paymentPlanIdStr = parsed.data.paymentPlanId

      if (!Types.ObjectId.isValid(cohortIdStr)) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid cohortId.' })
      }

      // Default to the cohort's active ONE_TIME plan when the client doesn't
      // name one (the storefront list doesn't expose plan ids).
      if (!paymentPlanIdStr) {
        const plan = await PaymentPlan.findOne({
          cohortId: new Types.ObjectId(cohortIdStr),
          type:     'ONE_TIME',
          isActive: true,
        }).select('_id').lean()
        if (!plan) {
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'No active one-time payment plan for this cohort.' })
        }
        paymentPlanIdStr = (plan._id as Types.ObjectId).toString()
      }

      const ctx = await validateCheckoutRequest(
        { cohortId: cohortIdStr, paymentPlanId: paymentPlanIdStr },
        studentId,
        'ONE_TIME',
        reply,
      )
      if (!ctx) return // reply already sent
      const { cohortId, planId, plan } = ctx

      const cohort = await Cohort.findById(cohortId).select('name tagline').lean()

      let customerId: string
      try {
        customerId = await ensurePaddleCustomer(studentId)
      } catch (err: unknown) {
        fastify.log.error({ err, studentId }, '[Paddle] Failed to create/retrieve Paddle customer')
        return reply.code(502).send({ error: 'PADDLE_ERROR', message: 'Failed to initialise payment. Please try again.' })
      }

      const currency = (plan.currency ?? 'usd').toUpperCase() as CurrencyCode

      // Flash promo (X% off for N hours per session). Passed to Paddle as a
      // non-catalog percentage discount so the checkout + invoice show it.
      const promo = getFlashPromo(request, null)
      const chargeAmount = applyFlashPromo(plan.totalAmount, promo)

      try {
        const txn = await paddle.transactions.create({
          customerId,
          collectionMode: 'automatic',
          currencyCode:   currency,
          ...(promo.active
            ? {
                discount: {
                  description: `Flash promo ${promo.percentOff}% off (${promo.windowHours}h)`,
                  type:        'percentage',
                  amount:      String(promo.percentOff),
                  recur:       false,
                },
              }
            : {}),
          items: [
            {
              quantity: 1,
              price: {
                description: `${plan.name} — cohort ${cohortId.toString()} plan ${planId.toString()}`,
                name:        plan.name,
                unitPrice:   { amount: String(Math.round(plan.totalAmount)), currencyCode: currency },
                taxMode:     'account_setting',
                product: {
                  name:        cohort?.name ?? 'Course enrollment',
                  description: cohort?.tagline ?? null,
                  taxCategory: 'standard',
                },
              },
            },
          ],
          customData: {
            studentId,
            cohortId:      cohortId.toString(),
            paymentPlanId: planId.toString(),
            planType:      'ONE_TIME',
            promoPercent:  promo.active ? String(promo.percentOff) : '0',
            source:        'nextaibuilder-web',
          },
        })

        fastify.log.info(
          { studentId, cohortId: cohortId.toString(), transactionId: txn.id, status: txn.status },
          '[Paddle] Transaction created',
        )

        return reply.code(201).send({
          transactionId: txn.id,
          status:        txn.status,
          amount:        chargeAmount,
          listAmount:    plan.totalAmount,
          promoPercent:  promo.active ? promo.percentOff : 0,
          currency:      plan.currency ?? 'usd',
          environment:   PADDLE_ENV,
        })
      } catch (err: unknown) {
        const apiErr = err instanceof ApiError ? err : null
        fastify.log.error(
          { err, code: apiErr?.code, detail: apiErr?.detail, studentId, planId: planId.toString() },
          '[Paddle] Transaction creation failed',
        )
        return reply.code(502).send({
          error:   apiErr?.code ?? 'PADDLE_ERROR',
          message: apiErr?.detail ?? 'Failed to create payment. Please try again.',
        })
      }
    },
  )
}
