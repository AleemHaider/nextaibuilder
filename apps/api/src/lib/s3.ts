// PBA-137 — AWS S3 client + presigned URL helpers
// Students upload directly to S3 using presigned PUT URLs.
// The backend never proxies the binary — it only issues the URL.
// When S3 is not configured (dev), files are stored locally under uploads/.
// FIR-46 — Added uploadToS3 (server-side upload) and buildManualReceiptS3Key.

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { buildSignedLocalUploadUrl } from './localUploadSigning.js'

const REGION      = process.env.AWS_REGION      ?? 'eu-west-2'
const BUCKET_NAME = process.env.S3_BUCKET_NAME  ?? 'pba-screenshots'
const KEY_PREFIX  = process.env.S3_KEY_PREFIX   ? `${process.env.S3_KEY_PREFIX}/` : ''

/** True only when real AWS credentials are present */
export const IS_S3_CONFIGURED = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_ACCESS_KEY_ID.trim() !== '' &&
  process.env.AWS_SECRET_ACCESS_KEY.trim() !== ''
)

export const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
})

/**
 * Generate a presigned GET URL for reading a stored screenshot.
 * Falls back to a local API URL when S3 is not configured.
 */
export async function getPresignedReadUrl(s3Key: string, expiresInSeconds = 3600): Promise<string> {
  if (!IS_S3_CONFIGURED) {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000'
    return `${apiBase}/api/uploads/${s3Key}`
  }
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  })
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
}

/**
 * Build the canonical S3 key for a screenshot submission.
 * Format: {userId}/{stepId}/{timestamp}-{attempt}.png
 */
export function buildS3Key(userId: string, stepId: string, attempt: number): string {
  const timestamp = Date.now()
  return `${KEY_PREFIX}screenshots/${userId}/${stepId}/${timestamp}-attempt${attempt}.png`
}

/**
 * PBA-315 — Build the S3 key for a user avatar upload.
 * Format: avatars/{userId}/{timestamp}.{ext}
 */
export function buildAvatarS3Key(userId: string, contentType: string): string {
  const ext =
    contentType === 'image/png'
      ? 'png'
      : contentType === 'image/webp'
        ? 'webp'
        : 'jpg'
  return `${KEY_PREFIX}avatars/${userId}/${Date.now()}.${ext}`
}

/**
 * PBA-375 — Build the S3 key for a troubleshooter image upload.
 * Format: troubleshoot/{userId}/{stepId}/{timestamp}.{ext}
 */
export function buildTroubleshootS3Key(userId: string, stepId: string, contentType: string): string {
  const ext =
    contentType === 'image/png'
      ? 'png'
      : contentType === 'image/webp'
        ? 'webp'
        : 'jpg'
  return `${KEY_PREFIX}troubleshoot/${userId}/${stepId}/${Date.now()}.${ext}`
}

/**
 * PBA-375 — Generate a presigned PUT URL for direct-to-S3 uploads.
 * Falls back to a local upload URL when S3 is not configured.
 */
export async function getPresignedPutUrl(
  s3Key: string,
  contentType: string,
  expiresInSeconds = 300,
): Promise<string> {
  if (!IS_S3_CONFIGURED) {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000'
    return buildSignedLocalUploadUrl(apiBase, s3Key, expiresInSeconds)
  }
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType,
  })
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
}


/**
 * FIR-46 — Server-side upload of a Buffer directly to S3.
 * Used for manual receipt uploads where the API receives the file via multipart.
 * Falls back to local disk when S3 is not configured.
 */
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (!IS_S3_CONFIGURED) {
    // Dev fallback: persist to local uploads/ directory
    const uploadsDir = resolve(process.cwd(), 'uploads')
    const filePath   = join(uploadsDir, key)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, body)
    return
  }
  const command = new PutObjectCommand({
    Bucket:      BUCKET_NAME,
    Key:         key,
    Body:        body,
    ContentType: contentType,
  })
  await s3.send(command)
}

/**
 * FIR-46 — Build the S3 key for a manual receipt upload.
 * Format: manual-receipts/{studentId}/{timestamp}-{sanitizedFilename}
 */
export function buildManualReceiptS3Key(studentId: string, originalFilename: string): string {
  // Sanitize: keep only alphanumeric, dots, dashes, underscores
  const sanitized = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  return `${KEY_PREFIX}manual-receipts/${studentId}/${Date.now()}-${sanitized}`
}

export { BUCKET_NAME }
