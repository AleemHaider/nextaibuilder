// Shared pino logger for use outside the Fastify request lifecycle —
// workers, jobs, lib bootstrap. Inside route handlers, prefer
// `request.log` / `fastify.log` so the per-request fields (reqId, url) get
// merged automatically.
//
// `logger.error` and `logger.fatal` forward to Sentry via captureError when
// the first argument is an Error or includes an `err` field.

import pino, { type Logger } from 'pino'
import { captureError } from './sentry.js'

const isProd = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST

const base: Logger = pino({
  level: process.env.LOG_LEVEL ?? (isTest ? 'silent' : 'info'),
  base: { service: 'nab-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
    ],
    censor: '[redacted]',
  },
  // pino-pretty only in dev — production gets newline-delimited JSON for log shipping
  transport: !isProd && !isTest
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
    : undefined,
})

function extractError(args: unknown[]): unknown {
  for (const a of args) {
    if (a instanceof Error) return a
    if (a && typeof a === 'object' && 'err' in a) {
      const err = (a as { err: unknown }).err
      if (err instanceof Error) return err
    }
  }
  return null
}

// Wrap error/fatal so any thrown payload also lands in Sentry.
const errorOrig = base.error.bind(base)
const fatalOrig = base.fatal.bind(base)

base.error = ((...args: unknown[]) => {
  const err = extractError(args)
  if (err) captureError(err)
  // pino's typed signatures are runtime-safe; cast through unknown for forwarding
  ;(errorOrig as unknown as (...a: unknown[]) => void)(...args)
}) as typeof base.error

base.fatal = ((...args: unknown[]) => {
  const err = extractError(args)
  if (err) captureError(err)
  ;(fatalOrig as unknown as (...a: unknown[]) => void)(...args)
}) as typeof base.fatal

export const logger = base

export function childLogger(bindings: Record<string, unknown>): Logger {
  return base.child(bindings)
}
