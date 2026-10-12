// FIR-39 — Stripe one-time checkout (POST /one-time)
// FIR-40 — Stripe installment checkout (POST /installment)
// FIR-41 — Student enrollment list (GET /enrollments — registered separately in index.ts)
// FIR-45 — Stripe customer creation / reuse
// Coupon  — Free enrollment via coupon code (POST /coupon)

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requireStudent } from '../../middleware/authenticate.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { Cohort } from '../../models/Cohort.js'
import { PaymentPlan, type IPaymentPlan } from '../../models/PaymentPlan.js'
import { Enrollment } from '../../models/Enrollment.js'
import { User } from '../../models/User.js'
import { stripe } from '../../lib/stripe.js'
import { activateEnrollment } from '../../services/enrollmentService.js'
import { getFlashPromo, applyFlashPromo } from '../../lib/flashPromo.js'
import Stripe from 'stripe'

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
  plan: IPaymentPlan
}

export async function validateCheckoutRequest(
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

  // 3a. Block enrollment into cohorts that already ended. Without this a
  // student can pay for (or coupon into) a finished cohort and land straight
  // on a DEADLINE_MISSED dashboard.
  const liveEndDate = (cohort as { liveEndDate?: Date | null }).liveEndDate
  if (liveEndDate && new Date(liveEndDate).getTime() < Date.now()) {
    reply.code(409).send({ error: 'COHORT_ENDED', message: 'This cohort has already ended.' })
    return null
  }

  // 3b. Enforce seat capacity. Count real active enrollments (authoritative —
  // doesn't depend on the enrollmentCount display counter) so a full cohort
  // can't keep selling. `maxSeats` null/0 means unlimited.
  const maxSeats = (cohort as { maxSeats?: number | null }).maxSeats
  if (maxSeats && maxSeats > 0) {
    const activeCount = await Enrollment.countDocuments({
      cohortId,
      status: { $nin: ['REVOKED'] },
    })
    if (activeCount >= maxSeats) {
      reply.code(409).send({ error: 'SOLD_OUT', message: 'This cohort is full.' })
      return null
    }
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

// ── Coupon helpers ─────────────────────────────────────────────────────────
// Free-enrollment coupon codes come from the FREE_ENROLL_COUPON_CODES env var
// (comma-separated, case-insensitive). Feature is disabled when unset — no
// code is ever valid. Read at request time so tests / restarts pick up changes.
function isValidCouponCode(code: string): boolean {
  const configured = (process.env.FREE_ENROLL_COUPON_CODES ?? '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
  return configured.includes(code.trim().toLowerCase())
}

const couponBodySchema = z.object({
  cohortId:   z.string().min(1, 'cohortId is required'),
  couponCode: z.string().min(1, 'couponCode is required'),
})

// ── Route plugin ───────────────────────────────────────────────────────────
export async function checkoutRoutes(fastify: FastifyInstance) {

  // ── POST /coupon ── Free enrollment via coupon code ──────────────────────
  // Bypasses Stripe entirely: validates the code, then activates the
  // enrollment directly (paymentMethod=COUPON, paymentStatus=WAIVED) with the
  // same side-effect chain as a paid enrollment (Slack invite + welcome email).
  // Rate-limited tightly so codes can't be brute-forced.
  fastify.post<{ Body: z.infer<typeof couponBodySchema> }>(
    '/coupon',
    {
      preHandler: requireStudent,
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { sub: studentId, email: studentEmail } = request.user as JwtPayload

      // 1. Validate body shape
      const parsed = couponBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }
      const { cohortId: cohortIdStr, couponCode } = parsed.data

      if (!Types.ObjectId.isValid(cohortIdStr)) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid cohortId.' })
      }
      const cohortId = new Types.ObjectId(cohortIdStr)

      // 2. Validate coupon code
      if (!isValidCouponCode(couponCode)) {
        return reply.code(400).send({
          error:   'INVALID_COUPON',
          message: 'This coupon code is not valid.',
        })
      }

      // 3. Cohort must be published
      const cohort = await Cohort.findOne({ _id: cohortId, isPublished: true }).lean()
      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found or not published.' })
      }

      // 3a. Block coupons on cohorts that already ended (same rule as paid checkout)
      const liveEndDate = (cohort as { liveEndDate?: Date | null }).liveEndDate
      if (liveEndDate && new Date(liveEndDate).getTime() < Date.now()) {
        return reply.code(409).send({ error: 'COHORT_ENDED', message: 'This cohort has already ended.' })
      }

      // 4. Enforce seat capacity (same rule as paid checkout)
      const maxSeats = (cohort as { maxSeats?: number | null }).maxSeats
      if (maxSeats && maxSeats > 0) {
        const activeCount = await Enrollment.countDocuments({
          cohortId,
          status: { $nin: ['REVOKED'] },
        })
        if (activeCount >= maxSeats) {
          return reply.code(409).send({ error: 'SOLD_OUT', message: 'This cohort is full.' })
        }
      }

      // 5. Guard against duplicate enrollment
      const existing = await Enrollment.findOne({
        studentId: new Types.ObjectId(studentId),
        cohortId,
        status: { $nin: ['REVOKED'] },
      }).lean()
      if (existing) {
        return reply.code(409).send({ error: 'ALREADY_ENROLLED', message: 'You are already enrolled in this cohort.' })
      }

      // 6. Activate — reuses the shared side-effect chain (Slack + email),
      // idempotent per (student, cohort) so double-submits are replay-safe.
      try {
        const { enrollment } = await activateEnrollment({
          studentId:        new Types.ObjectId(studentId),
          cohortId,
          paymentMethod:    'COUPON',
          paymentStatus:    'WAIVED',
          studentEmail:     studentEmail ?? null,
          idempotencyScope: `coupon:${studentId}:${cohortId.toString()}`,
          email: {
            jobName:          'enrollment-confirmed',
            notificationType: 'ENROLLMENT_CONFIRMED',
          },
        })

        fastify.log.info(
          { studentId, cohortId: cohortId.toString(), couponCode },
          '[coupon] Free enrollment activated via coupon',
        )

        return reply.code(201).send({
          enrollmentId: (enrollment._id as Types.ObjectId).toString(),
          status:        enrollment.status,
          paymentStatus: enrollment.paymentStatus,
          cohortId:      cohortId.toString(),
        })
      } catch (err: unknown) {
        fastify.log.error({ err, studentId, cohortId: cohortId.toString() }, '[coupon] Enrollment activation failed')
        return reply.code(500).send({
          error:   'INTERNAL_ERROR',
          message: 'Failed to activate enrollment. Please try again.',
        })
      }
    },
  )

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
      } catch (err: unknown) {
        const stripeErr = err instanceof Stripe.errors.StripeError ? err : null
        fastify.log.error({ err, studentId }, '[FIR-39] Failed to create/retrieve Stripe customer')
        return reply.code(stripeErr?.statusCode ?? 500).send({
          error:   stripeErr?.code ?? 'STRIPE_ERROR',
          message: 'Failed to initialise payment. Please try again.',
        })
      }

      // Flash promo (X% off for N hours per session) — enforced here, not in the UI
      const promo = getFlashPromo(request, null)
      const chargeAmount = applyFlashPromo(plan.totalAmount, promo)

      // Create PaymentIntent
      let paymentIntent: Stripe.PaymentIntent
      try {
        paymentIntent = await stripe.paymentIntents.create(
          {
            amount:   chargeAmount, // smallest currency unit (cents), promo applied
            currency: plan.currency ?? 'usd',
            customer: stripeCustomerId,
            metadata: {
              cohortId:    cohortId.toString(),
              paymentPlanId: planId.toString(),
              studentId,
              planType:    'ONE_TIME',
              promoPercent: promo.active ? String(promo.percentOff) : '0',
            },
            // Automatically confirm if payment method is on file; otherwise client confirms
            automatic_payment_methods: { enabled: true },
          },
          { idempotencyKey: `intent_${studentId}_${planId.toString()}_${chargeAmount}` },
        )
      } catch (err: unknown) {
        const stripeErr = err instanceof Stripe.errors.StripeError ? err : null
        fastify.log.error({ err, studentId, planId: planId.toString() }, '[FIR-39] PaymentIntent creation failed')
        return reply.code(stripeErr?.statusCode ?? 500).send({
          error:   stripeErr?.code ?? 'STRIPE_ERROR',
          message: stripeErr?.message ?? 'Failed to create payment. Please try again.',
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
      } catch (err: unknown) {
        const stripeErr = err instanceof Stripe.errors.StripeError ? err : null
        fastify.log.error({ err, studentId }, '[FIR-40] Failed to create/retrieve Stripe customer')
        return reply.code(stripeErr?.statusCode ?? 500).send({
          error:   stripeErr?.code ?? 'STRIPE_ERROR',
          message: 'Failed to initialise payment. Please try again.',
        })
      }

      // Flash promo (X% off for N hours per session) — applied to the total before splitting
      const promo = getFlashPromo(request, null)
      const discountedTotal = applyFlashPromo(plan.totalAmount, promo)

      // Installment amount: split evenly across 3 months, round up to avoid fractions
      const installmentAmount = Math.ceil(discountedTotal / 3)

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
          { idempotencyKey: `price_${cohortId.toString()}_${planId.toString()}_${installmentAmount}` },
        )
      } catch (err: unknown) {
        const stripeErr = err instanceof Stripe.errors.StripeError ? err : null
        fastify.log.error({ err, planId: planId.toString() }, '[FIR-40] Stripe Price creation failed')
        return reply.code(stripeErr?.statusCode ?? 500).send({
          error:   stripeErr?.code ?? 'STRIPE_ERROR',
          message: 'Failed to set up installment plan. Please try again.',
        })
      }

      // Create Subscription with payment_behavior: 'default_incomplete' so it needs client confirmation.
      // Auto-terminate after exactly 3 monthly charges. With billing_cycle_anchor
      // 'now', invoices fire at +0, +1mo and +2mo (the 3 installments); a 4th
      // would be created at +3mo (~89-92 days). cancel_at must land strictly
      // after the 3rd charge (≤ ~62 days) and strictly before the 4th (≥ ~89
      // days). 75 days sits safely inside that window regardless of month length.
      // (Previously this was 96 days — past the 4th cycle — so every installment
      // plan was billed a 4th time, overcharging students by ~33%.)
      const cancelAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 75

      let subscription: Stripe.Subscription
      try {
        subscription = await stripe.subscriptions.create(
          {
            customer: stripeCustomerId,
            items: [{ price: price.id }],
            payment_behavior:    'default_incomplete',
            payment_settings:    { save_default_payment_method: 'on_subscription' },
            // Stripe 2025 API: Invoice.payment_intent was replaced by
            // Invoice.confirmation_secret (contains the client_secret directly).
            expand:              ['latest_invoice.confirmation_secret'],
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
      } catch (err: unknown) {
        const stripeErr = err instanceof Stripe.errors.StripeError ? err : null
        fastify.log.error({ err, studentId, planId: planId.toString() }, '[FIR-40] Subscription creation failed')
        return reply.code(stripeErr?.statusCode ?? 500).send({
          error:   stripeErr?.code ?? 'STRIPE_ERROR',
          message: stripeErr?.message ?? 'Failed to create installment plan. Please try again.',
        })
      }

      // Extract client_secret from latest_invoice.confirmation_secret.
      // Stripe 2025 API moved the client_secret off PaymentIntent onto
      // Invoice.confirmation_secret (still references the same PaymentIntent).
      const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null
      const clientSecret  = latestInvoice?.confirmation_secret?.client_secret ?? null

      if (!clientSecret) {
        fastify.log.error({ subscriptionId: subscription.id }, '[FIR-40] No client_secret on latest_invoice.confirmation_secret')
        return reply.code(500).send({
          error:   'STRIPE_INCOMPLETE',
          message: 'Subscription created but could not retrieve payment confirmation. Contact support.',
        })
      }

      return reply.code(201).send({
        clientSecret,
        subscriptionId:    subscription.id,
        installmentAmount,
        totalAmount:       discountedTotal,
        listTotalAmount:   plan.totalAmount,
        promoPercent:      promo.active ? promo.percentOff : 0,
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
