// FIR-39 — Stripe singleton
// Single Stripe client instance shared across all route handlers and workers.
// The apiVersion is pinned to avoid silent breaking changes on Stripe's side.
//
// STRIPE_SECRET_KEY must be set in production. The boot guard refuses to start
// when the key is missing or set to the placeholder. In development
// (NODE_ENV=development) we allow the placeholder so engineers can boot the
// app end-to-end without a real Stripe account — but every Stripe SDK call is
// proxied through a stub that throws a clear "STRIPE_DEV_STUB" error so the
// failure mode is obvious if someone hits a paid path.
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST
const isDev  = process.env.NODE_ENV === 'development'
const isPlaceholder = !key || key === 'sk_test_placeholder'

if (isPlaceholder && !isTest && !isDev) {
  throw new Error(
    '[Stripe] STRIPE_SECRET_KEY is missing or set to the placeholder. ' +
    'Set a real sk_test_* or sk_live_* key in apps/api/.env before starting the API. ' +
    '(Set NODE_ENV=development if you only need to boot the app for UI work — ' +
    'Stripe calls will throw at runtime.)',
  )
}

function buildDevStub(): Stripe {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      // Allow .toString / Symbol probes so consumers can inspect the object
      // without triggering the throw.
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      return new Proxy(() => {}, handler)
    },
    apply() {
      throw new Error(
        '[Stripe] STRIPE_DEV_STUB: a Stripe SDK method was invoked without a ' +
        'real API key. Set STRIPE_SECRET_KEY in apps/api/.env to exercise this code path.',
      )
    },
  }
  // eslint-disable-next-line no-console
  console.warn(
    '[Stripe] Running with the dev stub — all Stripe SDK calls will throw. ' +
    'Set STRIPE_SECRET_KEY to test paid flows end-to-end.',
  )
  return new Proxy({}, handler) as unknown as Stripe
}

export const stripe: Stripe = isPlaceholder && isDev
  ? buildDevStub()
  : new Stripe(key ?? 'sk_test_dummy_for_unit_tests_only', {
      apiVersion: '2026-03-25.dahlia',
    })
