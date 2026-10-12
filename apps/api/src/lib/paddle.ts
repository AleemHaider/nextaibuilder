// Paddle singleton — sandbox/production is selected by PADDLE_ENV.
//
// Mirrors lib/stripe.ts: the client is a dev stub when PADDLE_API_KEY is
// missing so the API still boots for UI work; any Paddle call then throws a
// clear PADDLE_DEV_STUB error instead of a confusing 401 from Paddle.
//
// Env:
//   PADDLE_API_KEY         pdl_sdbx_apikey_… (sandbox) / pdl_live_apikey_… (live)
//   PADDLE_ENV             "sandbox" | "production"  (default: sandbox)
//   PADDLE_WEBHOOK_SECRET  pdl_ntfset_… — endpoint secret of the notification destination
import { Paddle, Environment } from '@paddle/paddle-node-sdk'

const key    = process.env.PADDLE_API_KEY
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST

export const PADDLE_ENV: 'sandbox' | 'production' =
  process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox'

export function isPaddleConfigured(): boolean {
  return !!key
}

function buildDevStub(): Paddle {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      return new Proxy(() => {}, handler)
    },
    apply() {
      throw new Error(
        '[Paddle] PADDLE_DEV_STUB: a Paddle SDK method was invoked without a ' +
        'real API key. Set PADDLE_API_KEY in apps/api/.env to exercise this code path.',
      )
    },
  }
  if (!isTest) {
    // eslint-disable-next-line no-console
    console.warn('[Paddle] PADDLE_API_KEY not set — running with the dev stub; Paddle calls will throw.')
  }
  return new Proxy({}, handler) as unknown as Paddle
}

export const paddle: Paddle = key
  ? new Paddle(key, {
      environment: PADDLE_ENV === 'production' ? Environment.production : Environment.sandbox,
    })
  : buildDevStub()

// Webhook verification does not need a live API key — it is pure HMAC on the
// raw body — so give it its own instance that always works even when the
// main client is the dev stub.
export const paddleWebhookVerifier = new Paddle(key ?? 'pdl_sdbx_apikey_unused_for_verification', {
  environment: PADDLE_ENV === 'production' ? Environment.production : Environment.sandbox,
})
