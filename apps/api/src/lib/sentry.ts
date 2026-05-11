// Sentry initialisation for the API. Loaded as the very first thing in
// index.ts so it can capture errors thrown during the rest of the boot.
//
// Env-gated by SENTRY_DSN — if unset, this module is a no-op and no network
// calls are made. Safe to leave imported in environments without Sentry.

import * as Sentry from '@sentry/node'

const dsn = process.env.SENTRY_DSN
const environment = process.env.NODE_ENV ?? 'development'
const release = process.env.SENTRY_RELEASE ?? process.env.GIT_SHA

let initialised = false

export function initSentry(): void {
  if (initialised) return
  initialised = true

  if (!dsn) {
    // No DSN — no-op. Avoid logging on hot path; the env-check warning is enough.
    return
  }

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: environment === 'production' ? 0.1 : 0,
    // We send breadcrumbs but not console output by default — workers/services
    // call logger.error which forwards explicitly.
    // Process-level crash capture is delegated to logger.fatal() in
    // src/index.ts so we only get one capture per crash, not two.
    integrations: [Sentry.httpIntegration()],
    beforeSend(event) {
      // Drop PII fields from request bodies that may leak through Fastify
      if (event.request?.data && typeof event.request.data === 'object') {
        const data = event.request.data as Record<string, unknown>
        for (const k of ['password', 'passwordHash', 'token', 'refreshToken', 'accessToken']) {
          if (k in data) data[k] = '[redacted]'
        }
      }
      return event
    },
  })
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialised || !dsn) return
  Sentry.captureException(err, context ? { extra: context } : undefined)
}

export { Sentry }
