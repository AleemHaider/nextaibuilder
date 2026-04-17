// PBA-316 — Shared image utility for downloading screenshots as base64
// Used by screenshotValidationWorker.ts and the troubleshoot route
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3, BUCKET_NAME, IS_S3_CONFIGURED } from './s3.js'

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp'

/**
 * Detects the real media type from a buffer's magic bytes.
 * Falls back to image/jpeg when the signature is unrecognised (Claude handles most real images).
 */
function detectMediaType(buffer: Buffer): ImageMediaType {
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp'
  }
  // Fall back to extension hint, then jpeg
  return 'image/jpeg'
}

/**
 * Downloads an image from S3 (or local uploads/ in dev).
 * Returns base64 string AND the real media type detected from magic bytes —
 * never from the file extension, which can be wrong.
 */
export async function downloadImageAsBase64(
  s3Key: string,
): Promise<{ base64: string; mediaType: ImageMediaType }> {
  let buffer: Buffer

  if (!IS_S3_CONFIGURED) {
    const filePath = join(resolve(process.cwd(), 'uploads'), s3Key)
    buffer = await readFile(filePath)
  } else {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key })
    const response = await s3.send(command)
    const stream = response.Body
    if (!stream) throw new Error(`S3 object body empty for key: ${s3Key}`)
    const chunks: Uint8Array[] = []
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    buffer = Buffer.concat(chunks)
  }

  return {
    base64: buffer.toString('base64'),
    mediaType: detectMediaType(buffer),
  }
}

/**
 * Returns the correct Claude media type from a file extension in the s3Key.
 * Prefer downloadImageAsBase64 (magic-byte detection) over this where possible.
 */
export function getMediaType(s3Key: string): ImageMediaType {
  const ext = s3Key.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}
