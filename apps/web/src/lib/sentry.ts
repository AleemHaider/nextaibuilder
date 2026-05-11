// Sentry React init. Env-gated by VITE_SENTRY_DSN — no DSN = no-op.
// VITE_* vars are baked into the bundle at build time; never put a server
// secret here.

import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN
const environment = import.meta.env.MODE
const release = import.meta.env.VITE_SENTRY_RELEASE

let initialised = false

export function initSentry(): void {
  if (initialised) return
  initialised = true

  if (!dsn) return

  Sentry.init({
    dsn,
    environment,
    release,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: environment === 'production' ? 0.1 : 0,
    // Drop common noisy errors that aren't actionable
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications.',
      'Non-Error promise rejection captured',
    ],
  })
}

export { Sentry }
