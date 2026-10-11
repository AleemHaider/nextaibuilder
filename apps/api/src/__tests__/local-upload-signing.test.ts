/**
 * Unit test for the local (dev / S3-less) upload signing helper.
 *
 * The `/api/uploads/*` PUT endpoint used to be an open, unauthenticated write.
 * It now requires a short-lived HMAC signature issued by the presign endpoints.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  buildSignedLocalUploadUrl,
  verifyLocalUploadSignature,
} from '../lib/localUploadSigning.js'

beforeAll(() => {
  process.env.UPLOADS_SIGNING_SECRET = 'test-secret'
})

function parse(url: string): { key: string; exp: string; sig: string } {
  const u = new URL(url)
  const key = u.pathname.replace(/^\/api\/uploads\//, '')
  return { key, exp: u.searchParams.get('exp')!, sig: u.searchParams.get('sig')! }
}

describe('localUploadSigning', () => {
  const key = 'screenshots/u1/s1/123-attempt1.png'

  it('accepts a freshly signed URL', () => {
    const { exp, sig } = parse(buildSignedLocalUploadUrl('http://localhost:4000', key))
    expect(verifyLocalUploadSignature(key, exp, sig)).toBe(true)
  })

  it('rejects a tampered key', () => {
    const { exp, sig } = parse(buildSignedLocalUploadUrl('http://localhost:4000', key))
    expect(verifyLocalUploadSignature('screenshots/victim/s1/1-attempt1.png', exp, sig)).toBe(false)
  })

  it('rejects a tampered signature', () => {
    const { exp } = parse(buildSignedLocalUploadUrl('http://localhost:4000', key))
    expect(verifyLocalUploadSignature(key, exp, 'deadbeef')).toBe(false)
  })

  it('rejects an expired signature', () => {
    const { sig } = parse(buildSignedLocalUploadUrl('http://localhost:4000', key))
    const pastExp = String(Math.floor(Date.now() / 1000) - 10)
    expect(verifyLocalUploadSignature(key, pastExp, sig)).toBe(false)
  })

  it('rejects missing exp/sig', () => {
    expect(verifyLocalUploadSignature(key, undefined, undefined)).toBe(false)
    expect(verifyLocalUploadSignature(key, '9999999999', undefined)).toBe(false)
  })
})
