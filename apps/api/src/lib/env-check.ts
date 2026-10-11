// PBA-391 — Validates required env vars at startup. Logs structured warnings.
// Never throws — missing vars degrade gracefully where possible.

interface EnvCheckResult {
  valid: boolean
  warnings: string[]
  errors: string[]
}

export function checkEnv(): EnvCheckResult {
  const warnings: string[] = []
  const errors: string[] = []

  if (!process.env.ANTHROPIC_API_KEY) {
    errors.push('ANTHROPIC_API_KEY is not set — AI troubleshooter and screenshot validation will be unavailable')
  }
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    warnings.push('AWS credentials not set — S3 operations will use local fallback (dev only)')
  }
  if (!process.env.REDIS_URL) {
    warnings.push('REDIS_URL not set — rate limiting and job queues will be unavailable')
  }
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is not set — authentication will fail')
  }
  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is not set — database connection will fail')
  }
  // FIR-39 — Stripe env vars
  if (!process.env.STRIPE_SECRET_KEY) {
    errors.push('STRIPE_SECRET_KEY is not set — Stripe payments will be unavailable')
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    errors.push('STRIPE_WEBHOOK_SECRET is not set — Stripe webhook verification will fail')
  }

  // Paddle (optional second payment provider)
  if (!process.env.PADDLE_API_KEY) {
    warnings.push('PADDLE_API_KEY not set — Paddle checkout will be unavailable')
  }
  if (process.env.PADDLE_API_KEY && !process.env.PADDLE_WEBHOOK_SECRET) {
    warnings.push('PADDLE_WEBHOOK_SECRET not set — Paddle webhook verification will fail')
  }

  return { valid: errors.length === 0, warnings, errors }
}
