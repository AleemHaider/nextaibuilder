// PBA-395 — S3 integration smoke test
// Only runs when RUN_S3_INTEGRATION=true env var is set.
// Verifies real upload, download, presigned URL generation, and cleanup.

import { describe, it, expect, afterEach } from 'vitest'
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const RUN = process.env.RUN_S3_INTEGRATION === 'true'

const REGION = process.env.AWS_REGION ?? 'eu-west-2'
const BUCKET = process.env.S3_BUCKET_NAME ?? 'pba-screenshots'

// Minimal 1x1 transparent PNG (67 bytes)
const TEST_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

const TEST_KEY = `test/s3-integration-smoke/${Date.now()}-test.png`

describe('S3 integration smoke test', () => {
  const s3 = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  })

  afterEach(async () => {
    // Always attempt cleanup even if test fails
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: TEST_KEY }))
    } catch {
      // Ignore cleanup errors — object may not exist
    }
  })

  it.skipIf(!RUN)('can upload a small PNG buffer to the submissions bucket', async () => {
    const response = await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: TEST_KEY,
        Body: TEST_PNG_BUFFER,
        ContentType: 'image/png',
      }),
    )
    expect(response.$metadata.httpStatusCode).toBe(200)

    // Verify object exists via HeadObject
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: TEST_KEY }))
    expect(head.ContentLength).toBe(TEST_PNG_BUFFER.byteLength)
  })

  it.skipIf(!RUN)('can download the uploaded file and verify it matches the original', async () => {
    // Upload first
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: TEST_KEY,
        Body: TEST_PNG_BUFFER,
        ContentType: 'image/png',
      }),
    )

    // Download and compare
    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: TEST_KEY }))
    expect(response.Body).toBeDefined()

    // Read the stream to a Buffer
    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    const downloaded = Buffer.concat(chunks)
    expect(downloaded.equals(TEST_PNG_BUFFER)).toBe(true)
  })

  it.skipIf(!RUN)('can generate a presigned GET URL that is accessible', async () => {
    // Upload first
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: TEST_KEY,
        Body: TEST_PNG_BUFFER,
        ContentType: 'image/png',
      }),
    )

    // Generate presigned URL (60 second TTL)
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: TEST_KEY }),
      { expiresIn: 60 },
    )

    expect(url).toMatch(/^https:\/\//)
    expect(url).toContain(BUCKET)
    expect(url).toContain(encodeURIComponent(TEST_KEY).replace(/%2F/g, '/'))

    // Verify the URL is accessible via fetch
    const fetchResponse = await fetch(url)
    expect(fetchResponse.ok).toBe(true)
    expect(fetchResponse.headers.get('content-type')).toContain('image/png')

    const body = await fetchResponse.arrayBuffer()
    expect(Buffer.from(body).equals(TEST_PNG_BUFFER)).toBe(true)
  })
})
