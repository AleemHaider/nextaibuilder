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
import { stripe } from '../lib/stripe.js'
import { logger } from './../lib/logger.js'

// ── Inputs / outputs ──────────────────────────────────────────────────────

export type RefundInput =
  | { type: 'stripe'; paymentId: string; amount: number; reason: string }
  | { type: 'manual'; paymentId: string; reason: string }

export type RefundFailureCode =
  | 'INVALID_ID'        // 400
  | 'NOT_FOUND'         // 404
  | 'ALREADY_REFUNDED'  // 409 — Stripe path only
  | 'ALREADY_REJECTED'  // 409 — manual path only

export type RefundResult =
  | { ok: true; type: 'stripe'; payment: Record<string, unknown> }
  | { ok: true; type: 'manual'; payment: Record<string, unknown> }
  | { ok: false; code: RefundFailureCode; message: string }

// HTTP status code mapping — route handlers use this to translate.
export const REFUND_FAILURE_STATUS: Record<RefundFailureCode, number> = {
  INVALID_ID:        400,
  NOT_FOUND:         404,
  ALREADY_REFUNDED:  409,
  ALREADY_REJECTED:  409,
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

  // Best-effort Stripe SDK refund. If the SDK call fails (network, invalid
  // payment_intent, etc.) we still flip the local DB row so the operator's
  // intent is recorded — operators can manually reconcile through the
  // Stripe dashboard. Without this fallback a flaky network leaves the row
  // in PAID and the operator with no way to mark it refunded.
  if (payment.stripePaymentIntentId && process.env.STRIPE_SECRET_KEY) {
    try {
      await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount:         Math.round(amount * 100), // Stripe expects cents
        reason:         'requested_by_customer',
      })
    } catch (err) {
      logger.error({ err, paymentId }, '[paymentService] Stripe refund SDK call failed — updating DB only')
    }
  } else {
    logger.warn(
      { paymentId },
      '[paymentService] Stripe not configured or no paymentIntentId — skipping SDK refund, updating DB only',
    )
  }

  payment.status = 'REFUNDED'
  await payment.save()

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
