// FIR-39 — Stripe one-time checkout (POST /one-time)
// FIR-40 — Stripe installment checkout (POST /installment)
// FIR-41 — Student enrollment list (GET /enrollments — registered separately in index.ts)
// FIR-45 — Stripe customer creation / reuse

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requireStudent } from '../../middleware/authenticate.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { Cohort } from '../../models/Cohort.js'
import { PaymentPlan } from '../../models/PaymentPlan.js'
import { Enrollment } from '../../models/Enrollment.js'
import { User } from '../../models/User.js'
import { stripe } from '../../lib/stripe.js'
import type Stripe from 'stripe'

// ── Request body schema ────────────────────────────────────────────────────
const checkoutBodySchema = z.object({
  cohortId:      z.string().min(1, 'cohortId is required'),
  paymentPlanId: z.string().min(1, 'paymentPlanId is required'),
})

type CheckoutBody = z.infer<typeof checkoutBodySchema>

// ── Shared helper: validate body, cohort, plan, and existing enrollment ────
interface ValidatedCheckoutContext {
  cohortId: Types.ObjectId
  planId: Types.ObjectId
  plan: Awaited<ReturnType<typeof PaymentPlan.findById>> & NonNullable<unknown>
}

async function validateCheckoutRequest(
  body: unknown,
  studentId: string,
  expectedType: 'ONE_TIME' | 'INSTALLMENT',
  reply: import('fastify').FastifyReply,
): Promise<ValidatedCheckoutContext | null> {
  // 1. Validate body shape
  const parsed = checkoutBodySchema.safeParse(body)
  if (!parsed.success) {
    reply.code(400).send({
      error:   'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
    })
    return null
  }

  const { cohortId: cohortIdStr, paymentPlanId: paymentPlanIdStr } = parsed.data as CheckoutBody

  // 2. Validate ObjectId format
  if (!Types.ObjectId.isValid(cohortIdStr) || !Types.ObjectId.isValid(paymentPlanIdStr)) {
    reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid cohortId or paymentPlanId.' })
    return null
  }

  const cohortId = new Types.ObjectId(cohortIdStr)
  const planId   = new Types.ObjectId(paymentPlanIdStr)

  // 3. Cohort must be published
  const cohort = await Cohort.findOne({ _id: cohortId, isPublished: true }).lean()
  if (!cohort) {
    reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found or not published.' })
    return null
  }

  // 4. Plan must belong to cohort, be of expected type, and be active
  const plan = await PaymentPlan.findOne({
    _id:      planId,
    cohortId: cohortId,
    type:     expectedType,
    isActive: true,
  })
  if (!plan) {
    reply.code(404).send({
      error:   'NOT_FOUND',
      message: `Payment plan not found, not active, or not a ${expectedType} plan.`,
    })
    return null
  }

  // 5. Guard against duplicate enrollment
  const existing = await Enrollment.findOne({
    studentId: new Types.ObjectId(studentId),
    cohortId,
    status: { $nin: ['REVOKED'] },
  }).lean()
  if (existing) {
    reply.code(409).send({ error: 'ALREADY_ENROLLED', message: 'You are already enrolled in this cohort.' })
    return null
  }

  return { cohortId, planId, plan }
}

// ── Shared helper: create or reuse Stripe customer (FIR-45) ───────────────
async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await User.findById(userId).select('email firstName lastName stripeCustomerId').lean()
  if (!user) throw new Error(`User ${userId} not found`)

  if (user.stripeCustomerId) return user.stripeCustomerId

  // Create a new customer with idempotency key to prevent duplicates on retries
  const customer = await stripe.customers.create(
    {
      email: user.email,
      name:  `${user.firstName} ${user.lastName}`.trim(),
      metadata: { userId },
    },
    { idempotencyKey: `customer_${userId}` },
  )

  // Persist immediately so future requests reuse this customer
  await User.findByIdAndUpdate(userId, { stripeCustomerId: customer.id })

  return customer.id
}

// ── Route plugin ───────────────────────────────────────────────────────────
export async function checkoutRoutes(fastify: FastifyInstance) {

  // ── POST /one-time ── FIR-39: Create PaymentIntent for full payment ──────
  fastify.post<{ Body: CheckoutBody }>(
    '/one-time',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload

      const ctx = await validateCheckoutRequest(request.body, studentId, 'ONE_TIME', reply)
      if (!ctx) return // reply already sent

      const { cohortId, planId, plan } = ctx

      // Ensure Stripe customer exists
      let stripeCustomerId: string
      try {
        stripeCustomerId = await ensureStripeCustomer(studentId)
      } catch (err) {
        const stripeErr = err as Stripe.errors.StripeError
        fastify.log.error({ err, studentId }, '[FIR-39] Failed to create/retrieve Stripe customer')
        return reply.code(stripeErr.statusCode ?? 500).send({
          error:   stripeErr.code ?? 'STRIPE_ERROR',
          message: 'Failed to initialise payment. Please try again.',
        })
      }

      // Create PaymentIntent
      let paymentIntent: Stripe.PaymentIntent
      try {
        paymentIntent = await stripe.paymentIntents.create(
          {
            amount:   Math.round(plan.totalAmount), // already in smallest currency unit (cents)
            currency: plan.currency ?? 'usd',
            customer: stripeCustomerId,
            metadata: {
              cohortId:    cohortId.toString(),
              paymentPlanId: planId.toString(),
              studentId,
              planType:    'ONE_TIME',
            },
            // Automatically confirm if payment method is on file; otherwise client confirms
            automatic_payment_methods: { enabled: true },
          },
          { idempotencyKey: `intent_${studentId}_${planId.toString()}` },
        )
      } catch (err) {
        const stripeErr = err as Stripe.errors.StripeError
        fastify.log.error({ err, studentId, planId: planId.toString() }, '[FIR-39] PaymentIntent creation failed')
        return reply.code(stripeErr.statusCode ?? 500).send({
          error:   stripeErr.code ?? 'STRIPE_ERROR',
          message: stripeErr.message ?? 'Failed to create payment. Please try again.',
        })
      }

      return reply.code(201).send({
        clientSecret:    paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount:          paymentIntent.amount,
        currency:        paymentIntent.currency,
      })
    },
  )

  // ── POST /installment ── FIR-40: Create Subscription for 3-part payment ─
  fastify.post<{ Body: CheckoutBody }>(
    '/installment',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload

      const ctx = await validateCheckoutRequest(request.body, studentId, 'INSTALLMENT', reply)
      if (!ctx) return

      const { cohortId, planId, plan } = ctx

      // Ensure Stripe customer exists
      let stripeCustomerId: string
      try {
        stripeCustomerId = await ensureStripeCustomer(studentId)
      } catch (err) {
        const stripeErr = err as Stripe.errors.StripeError
        fastify.log.error({ err, studentId }, '[FIR-40] Failed to create/retrieve Stripe customer')
        return reply.code(stripeErr.statusCode ?? 500).send({
          error:   stripeErr.code ?? 'STRIPE_ERROR',
          message: 'Failed to initialise payment. Please try again.',
        })
      }

      // Installment amount: split evenly across 3 months, round up to avoid fractions
      const installmentAmount = Math.ceil(plan.totalAmount / 3)

      // Create a one-off Stripe Price for this plan's installment amount.
      // Using cohortId+planId as the idempotency key avoids creating duplicate prices
      // across retries. Lookup-or-create is the safe pattern here.
      let price: Stripe.Price
      try {
        price = await stripe.prices.create(
          {
            currency:        plan.currency ?? 'usd',
            unit_amount:     installmentAmount,
            recurring: {
              interval:       'month',
              interval_count: 1,
            },
            product_data: {
              name:     `${plan.name} — Installment`,
              metadata: {
                cohortId:    cohortId.toString(),
                paymentPlanId: planId.toString(),
              },
            },
            metadata: {
              cohortId:    cohortId.toString(),
              paymentPlanId: planId.toString(),
            },
          },
          { idempotencyKey: `price_${cohortId.toString()}_${planId.toString()}` },
        )
      } catch (err) {
        const stripeErr = err as Stripe.errors.StripeError
        fastify.log.error({ err, planId: planId.toString() }, '[FIR-40] Stripe Price creation failed')
        return reply.code(stripeErr.statusCode ?? 500).send({
          error:   stripeErr.code ?? 'STRIPE_ERROR',
          message: 'Failed to set up installment plan. Please try again.',
        })
      }

      // Create Subscription with payment_behavior: 'default_incomplete' so it needs client confirmation.
      // cancel_at set 3 months (3 billing cycles) from now to auto-terminate after 3 payments.
      const cancelAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 32 * 3 // ~3 months in unix seconds

      let subscription: Stripe.Subscription
      try {
        subscription = await stripe.subscriptions.create(
          {
            customer: stripeCustomerId,
            items: [{ price: price.id }],
            payment_behavior:    'default_incomplete',
            payment_settings:    { save_default_payment_method: 'on_subscription' },
            expand:              ['latest_invoice.payment_intent'],
            cancel_at:           cancelAt,
            billing_cycle_anchor: 'now' as unknown as number, // Stripe accepts 'now' as special string
            metadata: {
              cohortId:    cohortId.toString(),
              paymentPlanId: planId.toString(),
              studentId,
              planType:    'INSTALLMENT',
            },
          },
          { idempotencyKey: `sub_${studentId}_${planId.toString()}` },
        )
      } catch (err) {
        const stripeErr = err as Stripe.errors.StripeError
        fastify.log.error({ err, studentId, planId: planId.toString() }, '[FIR-40] Subscription creation failed')
        return reply.code(stripeErr.statusCode ?? 500).send({
          error:   stripeErr.code ?? 'STRIPE_ERROR',
          message: stripeErr.message ?? 'Failed to create installment plan. Please try again.',
        })
      }

      // Extract client_secret from latest_invoice.payment_intent
      const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null
      const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null
      const clientSecret  = paymentIntent?.client_secret ?? null

      if (!clientSecret) {
        fastify.log.error({ subscriptionId: subscription.id }, '[FIR-40] No client_secret on latest_invoice.payment_intent')
        return reply.code(500).send({
          error:   'STRIPE_INCOMPLETE',
          message: 'Subscription created but could not retrieve payment confirmation. Contact support.',
        })
      }

      return reply.code(201).send({
        clientSecret,
        subscriptionId:    subscription.id,
        installmentAmount,
        totalAmount:       plan.totalAmount,
        currency:          plan.currency ?? 'usd',
      })
    },
  )
}

// ── Enrollments plugin (registered at /api/v1/student/enrollments) ─────────
// FIR-41 — List student's active enrollments
export async function studentEnrollmentsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/enrollments',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload

      const enrollments = await Enrollment.find(
        {
          studentId: new Types.ObjectId(studentId),
          status:    { $ne: 'REVOKED' },
        },
        {
          cohortId:          1,
          paymentPlanId:     1,
          paymentMethod:     1,
          paymentStatus:     1,
          status:            1,
          accessGrantedAt:   1,
          lessonsCompleted:  1,
          completionPercentage: 1,
          createdAt:         1,
        },
      )
        .populate('cohortId', 'name slug type coverImageKey liveStartDate liveEndDate')
        .lean({ virtuals: true })

      return reply.send({ enrollments })
    },
  )
}
