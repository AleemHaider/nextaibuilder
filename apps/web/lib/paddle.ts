// Paddle.js loader — one shared instance per page.
//
// Env (inlined at build time):
//   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN  test_… (sandbox) / live_… (production)
//   NEXT_PUBLIC_PADDLE_ENV           "sandbox" | "production" (default sandbox)
import { initializePaddle, type Paddle, type PaddleEventData, type Environments } from '@paddle/paddle-js'

let paddlePromise: Promise<Paddle | undefined> | null = null
const listeners = new Set<(event: PaddleEventData) => void>()

export const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? ''
export const PADDLE_ENV: Environments =
  process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox'

export function isPaddleEnabled(): boolean {
  return PADDLE_CLIENT_TOKEN.length > 0
}

/** Subscribe to Paddle checkout lifecycle events. Returns an unsubscribe fn. */
export function onPaddleEvent(listener: (event: PaddleEventData) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPaddle(): Promise<Paddle | undefined> {
  if (typeof window === 'undefined') return Promise.resolve(undefined)
  if (!isPaddleEnabled()) return Promise.resolve(undefined)
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      token: PADDLE_CLIENT_TOKEN,
      environment: PADDLE_ENV,
      eventCallback: (event) => {
        listeners.forEach((l) => l(event))
      },
      checkout: {
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          locale: 'en',
          allowLogout: false,
          showAddDiscounts: false,
        },
      },
    })
  }
  return paddlePromise
}
