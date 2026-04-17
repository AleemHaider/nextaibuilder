// FIR-172 — CSP and security headers Fastify plugin
// Adds Content-Security-Policy, Strict-Transport-Security, Permissions-Policy,
// X-Content-Type-Options, X-Frame-Options, and Referrer-Policy to every response.

import type { FastifyInstance } from 'fastify'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.stripe.com",
  "frame-src https://js.stripe.com https://player.loom.com",
].join('; ')

// Wave 1 Story E — Permissions-Policy: disable powerful features, allow Stripe
// Elements to process payments.
const PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=(self "https://js.stripe.com")',
].join(', ')

// Wave 1 Story E — HSTS: 1 year, include subdomains, preload. Production only
// to avoid poisoning local browsers that hit http://localhost during dev.
const HSTS_VALUE = 'max-age=31536000; includeSubDomains; preload'

export async function securityPlugin(fastify: FastifyInstance): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production'

  fastify.addHook('onSend', async (_request, reply) => {
    void reply.header('Content-Security-Policy', CSP)
    void reply.header('X-Content-Type-Options', 'nosniff')
    void reply.header('X-Frame-Options', 'DENY')
    void reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    void reply.header('Permissions-Policy', PERMISSIONS_POLICY)
    if (isProduction) {
      void reply.header('Strict-Transport-Security', HSTS_VALUE)
    }
  })
}

export default securityPlugin
