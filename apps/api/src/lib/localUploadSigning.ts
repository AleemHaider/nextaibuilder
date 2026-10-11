// Signing for the local (dev / S3-less) upload fallback.
//
// When S3 is not configured the API hands out plain `/api/uploads/<key>` URLs
// that the client PUTs the file to. Without a signature that PUT endpoint is an
// open, unauthenticated write (anyone can overwrite any key). Real S3 presigned
// URLs carry a time-limited signature; this mirrors that: the presign step
// stamps an HMAC over (key, expiry) and the PUT handler verifies it. The token
// travels in the URL query string, so the browser upload flow is unchanged.

import crypto from 'node:crypto'

function signingSecret(): string {
  // Reuse the JWT secret (already required to be strong in production) unless a
  // dedicated uploads secret is provided.
  return (
    process.env.UPLOADS_SIGNING_SECRET ??
    process.env.JWT_SECRET ??
    'change-me-in-production'
  )
}

const PURPOSE = 'local-upload-put'

function computeHmac(key: string, exp: number): string {
  return crypto
    .createHmac('sha256', signingSecret())
    .update(`${PURPOSE}:${key}:${exp}`)
    .digest('hex')
}

/**
 * Build a signed local upload URL: `<apiBase>/api/uploads/<key>?exp=<ts>&sig=<hmac>`.
 * `expiresInSeconds` mirrors the S3 presign TTL (default 5 minutes).
 */
export function buildSignedLocalUploadUrl(
  apiBase: string,
  key: string,
  expiresInSeconds = 300,
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const sig = computeHmac(key, exp)
  return `${apiBase}/api/uploads/${key}?exp=${exp}&sig=${sig}`
}

/**
 * Verify a signed local upload request. Returns true only when the signature
 * matches the key and the expiry is in the future.
 */
export function verifyLocalUploadSignature(
  key: string,
  exp: string | undefined,
  sig: string | undefined,
): boolean {
  if (!exp || !sig) return false

  const expNum = Number(exp)
  if (!Number.isInteger(expNum) || expNum < Math.floor(Date.now() / 1000)) return false

  const expected = computeHmac(key, expNum)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
