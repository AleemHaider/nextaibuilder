// FIR-39 — Stripe singleton
// Single Stripe client instance shared across all route handlers and workers.
// The apiVersion is pinned to avoid silent breaking changes on Stripe's side.
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder'
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[Stripe] STRIPE_SECRET_KEY is not set — Stripe calls will fail at runtime')
}

export const stripe = new Stripe(key, {
  apiVersion: '2026-03-25.dahlia',
})
