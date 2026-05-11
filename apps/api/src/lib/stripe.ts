// FIR-39 — Stripe singleton
// Single Stripe client instance shared across all route handlers and workers.
// The apiVersion is pinned to avoid silent breaking changes on Stripe's side.
//
// STRIPE_SECRET_KEY must be set before this module is loaded. The production
// boot guard in src/index.ts rejects placeholder/missing values; failing
// loudly here is defense-in-depth against being imported in a misconfigured
// dev environment.
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST

if ((!key || key === 'sk_test_placeholder') && !isTest) {
  throw new Error(
    '[Stripe] STRIPE_SECRET_KEY is missing or set to the placeholder. ' +
    'Set a real sk_test_* or sk_live_* key in apps/api/.env before starting the API.',
  )
}

export const stripe = new Stripe(key ?? 'sk_test_dummy_for_unit_tests_only', {
  apiVersion: '2026-03-25.dahlia',
})
