// Local file storage for dev — replaces S3 when AWS credentials are absent.
// PUT /api/uploads/* — receive binary, save to disk
// GET /api/uploads/* — serve file from disk
import type { FastifyInstance } from 'fastify'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { verifyLocalUploadSignature } from '../lib/localUploadSigning.js'

const UPLOADS_DIR = resolve(process.cwd(), 'uploads')

export async function uploadsRoutes(fastify: FastifyInstance) {
  // Parse raw image bodies as Buffer
  for (const mime of ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']) {
    fastify.addContentTypeParser(mime, { parseAs: 'buffer' }, (_req, body, done) =>
      done(null, body),
    )
  }

  // PUT /api/uploads/* — save file locally
  fastify.put<{ Params: { '*': string }; Querystring: { exp?: string; sig?: string } }>(
    '/*',
    { bodyLimit: 10 * 1024 * 1024 },
    async (request, reply) => {
      const key = request.params['*']
      if (!key) return reply.code(400).send({ error: 'Missing file key' })

      // Require a valid short-lived signature (issued by the presign endpoints).
      // Without this the endpoint is an open, unauthenticated write.
      const { exp, sig } = request.query
      if (!verifyLocalUploadSignature(key, exp, sig)) {
        return reply.code(403).send({ error: 'INVALID_UPLOAD_SIGNATURE' })
      }

      const filePath = join(UPLOADS_DIR, key)
      // Guard against path traversal
      if (!filePath.startsWith(UPLOADS_DIR)) {
        return reply.code(400).send({ error: 'Invalid key' })
      }

      const body = request.body as Buffer
      if (!body || body.length === 0) {
        return reply.code(400).send({ error: 'Empty body' })
      }

      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, body)

      return reply.code(200).send()
    },
  )

  // GET /api/uploads/* — serve file
  fastify.get<{ Params: { '*': string } }>(
    '/*',
    { config: { rateLimit: false } },
    async (request, reply) => {
      const key = request.params['*']
      const filePath = join(UPLOADS_DIR, key)

      if (!filePath.startsWith(UPLOADS_DIR) || !existsSync(filePath)) {
        return reply.code(404).send({ error: 'File not found' })
      }

      const ext = filePath.split('.').pop()?.toLowerCase()
      const contentType =
        ext === 'png' ? 'image/png' :
        ext === 'webp' ? 'image/webp' :
        'image/jpeg'

      reply.header('Content-Type', contentType)
      reply.header('Cache-Control', 'public, max-age=3600')
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin')
      return reply.send(createReadStream(filePath))
    },
  )
}
