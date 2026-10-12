// Payment service — centralises the refund logic that was previously inlined
// in routes/admin/fir-payments.ts POST /:id/refund.
//
// Two refund paths flow through one service entrypoint:
//   • Stripe path: hit the Stripe SDK refunds.create endpoint, then flip
//     StripePayment.status → REFUNDED. The Stripe call is best-effort —
//     if it fails (network blip, invalid PI), we still flip the local row
//     so the operator's intent is recorded. The error envelope returned
//     to the caller preserves the existing HTTP-friendly code names.
//   • Manual path: flip ManualPaymentRequest.status → REJECTED with the
//     provided reason. There's no external SDK call.
//
// The route handler reduces to a thin translator that maps the service's
// discriminated result to an HTTP response.

import { Types } from 'mongoose'
import { StripePayment } from '../models/StripePayment.js'
import { ManualPaymentRequest } from '../models/ManualPaymentRequest.js'
import { Enrollment } from '../models/Enrollment.js'
import { stripe } from '../lib/stripe.js'
import { logger } from './../lib/logger.js'

// ── Inputs / outputs ──────────────────────────────────────────────────────

// NOTE: `amount` is in DOLLARS (the admin refund form's unit). The stored
// StripePayment.amount and Stripe's SDK both use CENTS — the service converts
// and caps against the original charge so a unit slip can't over-refund.
export type RefundInput =
  | { type: 'stripe'; paymentId: string; amount: number; reason: string }
  | { type: 'manual'; paymentId: string; reason: string }

export type RefundFailureCode =
  | 'INVALID_ID'          // 400
  | 'INVALID_AMOUNT'      // 400 — non-positive or exceeds the original charge
  | 'NOT_FOUND'           // 404
  | 'ALREADY_REFUNDED'    // 409 — Stripe path only
  | 'ALREADY_REJECTED'    // 409 — manual path only
  | 'STRIPE_REFUND_FAILED'// 502 — the Stripe API rejected/failed the refund

export type RefundResult =
  | { ok: true; type: 'stripe'; payment: Record<string, unknown> }
  | { ok: true; type: 'manual'; payment: Record<string, unknown> }
  | { ok: false; code: RefundFailureCode; message: string }

// HTTP status code mapping — route handlers use this to translate.
export const REFUND_FAILURE_STATUS: Record<RefundFailureCode, number> = {
  INVALID_ID:           400,
  INVALID_AMOUNT:       400,
  NOT_FOUND:            404,
  ALREADY_REFUNDED:     409,
  ALREADY_REJECTED:     409,
  STRIPE_REFUND_FAILED: 502,
}

// ── Stripe refund ─────────────────────────────────────────────────────────

async function refundStripePayment(
  paymentId: string,
  amount: number,
): Promise<RefundResult> {
  const payment = await StripePayment.findById(paymentId)
  if (!payment) {
    return { ok: false, code: 'NOT_FOUND', message: 'Stripe payment not found.' }
  }
  if (payment.status === 'REFUNDED') {
    return { ok: false, code: 'ALREADY_REFUNDED', message: 'Payment has already been refunded.' }
  }

  // `amount` is dollars; the stored charge and Stripe are cents. Cap the refund
  // at the original charge so a unit slip (e.g. typing the cents-valued ledger
  // number) can't trigger a 100× over-refund.
  const refundCents = Math.round(amount * 100)
  const chargeCents = (payment.amount as number | undefined) ?? 0
  if (refundCents < 1 || (chargeCents > 0 && refundCents > chargeCents)) {
    return {
      ok: false,
      code: 'INVALID_AMOUNT',
      message: `Refund amount must be greater than 0 and at most the original charge (${chargeCents} cents).`,
    }
  }

  // Issue the Stripe refund. If it fails we do NOT flip the row or revoke
  // access — the customer never got their money, so recording REFUNDED would be
  // wrong and would block a retry (the ALREADY_REFUNDED guard). Fail loudly.
  if (payment.stripePaymentIntentId && process.env.STRIPE_SECRET_KEY) {
    try {
      await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount:         refundCents,
        reason:         'requested_by_customer',
      })
    } catch (err) {
      logger.error({ err, paymentId }, '[paymentService] Stripe refund SDK call failed — no changes made')
      return {
        ok: false,
        code: 'STRIPE_REFUND_FAILED',
        message: 'Stripe refund failed. No changes were made — please retry.',
      }
    }
  } else {
    logger.warn(
      { paymentId },
      '[paymentService] Stripe not configured or no paymentIntentId — skipping SDK refund, updating DB only',
    )
  }

  payment.status = 'REFUNDED'
  await payment.save()

  // Revoke course access on a full refund (customer got all their money back).
  const isFullRefund = chargeCents > 0 ? refundCents >= chargeCents : true
  const enrollmentId = (payment as { enrollmentId?: Types.ObjectId }).enrollmentId
  if (isFullRefund && enrollmentId) {
    await Enrollment.findByIdAndUpdate(enrollmentId, { $set: { status: 'REVOKED' } }).catch((err) =>
      logger.error({ err, enrollmentId }, '[paymentService] failed to revoke enrollment on refund'),
    )
  }

  return { ok: true, type: 'stripe', payment: payment.toJSON() as Record<string, unknown> }
}

// ── Manual refund ─────────────────────────────────────────────────────────

async function refundManualPayment(
  paymentId: string,
  reason: string,
): Promise<RefundResult> {
  const manualPayment = await ManualPaymentRequest.findById(paymentId)
  if (!manualPayment) {
    return { ok: false, code: 'NOT_FOUND', message: 'Manual payment not found.' }
  }
  if (manualPayment.status === 'REJECTED') {
    return { ok: false, code: 'ALREADY_REJECTED', message: 'Manual payment is already rejected/refunded.' }
  }

  manualPayment.status          = 'REJECTED'
  manualPayment.rejectionReason = reason
  manualPayment.reviewedAt      = new Date()
  await manualPayment.save()

  // If this manual request had already been approved into an active
  // enrollment, revoke access too — otherwise a "refunded" student keeps the
  // course.
  const enrollmentId = (manualPayment as { enrollmentId?: Types.ObjectId }).enrollmentId
  if (enrollmentId) {
    await Enrollment.findByIdAndUpdate(enrollmentId, { $set: { status: 'REVOKED' } }).catch((err) =>
      logger.error({ err, enrollmentId }, '[paymentService] failed to revoke enrollment on manual refund'),
    )
  }

  return { ok: true, type: 'manual', payment: manualPayment.toJSON() as Record<string, unknown> }
}

// ── Public entrypoint ─────────────────────────────────────────────────────

/**
 * Issue a refund against either a Stripe payment or a manual-payment request.
 * Returns a discriminated-union result the caller maps to HTTP. The service
 * itself never throws on expected failures (NOT_FOUND, ALREADY_*); only
 * unexpected DB/network errors bubble up.
 */
export async function issueRefund(input: RefundInput): Promise<RefundResult> {
  if (!Types.ObjectId.isValid(input.paymentId)) {
    return { ok: false, code: 'INVALID_ID', message: 'Payment id is not a valid ObjectId.' }
  }

  if (input.type === 'stripe') {
    return refundStripePayment(input.paymentId, input.amount)
  }
  return refundManualPayment(input.paymentId, input.reason)
}
