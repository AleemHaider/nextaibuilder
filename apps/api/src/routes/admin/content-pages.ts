// Admin: CRUD + publish/unpublish for SEO/LLM content pages (guides & resources).
// Publish/unpublish render static HTML directly into the sibling apps/web
// package (see lib/staticPages.ts) so the page goes live immediately.

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import DOMPurify from 'isomorphic-dompurify'
import { requirePermission } from '../../middleware/require-permission.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { ContentPage } from '../../models/ContentPage.js'
import { writePublishedPage, removePublishedPage, regenerateIndexes } from '../../lib/staticPages.js'

// ── Zod schemas ───────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  section: z.enum(['guides', 'resources']).optional(),
  status: z.enum(['draft', 'published']).optional(),
  search: z.string().max(200).optional(),
})

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const createBodySchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().regex(slugPattern, 'Slug must be lowercase letters, numbers, and hyphens.').optional(),
  section: z.enum(['guides', 'resources']),
  description: z.string().min(1).max(300),
  bodyHtml: z.string().min(1),
})

const updateBodySchema = z.object({
  title: z.string().min(3).max(200).optional(),
  slug: z.string().regex(slugPattern, 'Slug must be lowercase letters, numbers, and hyphens.').optional(),
  section: z.enum(['guides', 'resources']).optional(),
  description: z.string().min(1).max(300).optional(),
  bodyHtml: z.string().min(1).optional(),
})

type ListQuery = z.infer<typeof listQuerySchema>
type CreateBody = z.infer<typeof createBodySchema>
type UpdateBody = z.infer<typeof updateBodySchema>

// ── Route plugin ──────────────────────────────────────────────────────────

export async function adminContentPagesRoutes(fastify: FastifyInstance) {
  // ── GET / — list content pages ──────────────────────────────────────────
  fastify.get<{ Querystring: ListQuery }>(
    '/',
    { preHandler: requirePermission('content-pages:read') },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid query parameters.',
        })
      }
      const { section, status, search } = parsed.data

      const filter: Record<string, unknown> = {}
      if (section) filter.section = section
      if (status) filter.status = status
      if (search) filter.title = { $regex: search, $options: 'i' }

      // Not .lean() — the schema's toJSON transform (which maps _id -> id)
      // only runs on hydrated documents, and the admin UI keys off `page.id`.
      const pages = await ContentPage.find(filter).sort({ updatedAt: -1 })
      return reply.send({ pages })
    },
  )

  // ── GET /:id — single content page ──────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('content-pages:read') },
    async (request, reply) => {
      const { id } = request.params
      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid page ID.' })
      }
      const page = await ContentPage.findById(id)
      if (!page) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Content page not found.' })
      }
      return reply.send({ page })
    },
  )

  // ── POST / — create a content page (draft) ──────────────────────────────
  fastify.post<{ Body: CreateBody }>(
    '/',
    { preHandler: requirePermission('content-pages:write') },
    async (request, reply) => {
      const { sub: adminId } = request.user as JwtPayload
      const parsed = createBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }
      const { title, section, description, bodyHtml } = parsed.data
      const slug = parsed.data.slug || slugify(title)
      if (!slug) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Could not derive a slug from the title.' })
      }

      const existing = await ContentPage.findOne({ section, slug })
      if (existing) {
        return reply.code(409).send({ error: 'CONFLICT', message: `A ${section} page with slug "${slug}" already exists.` })
      }

      const page = await ContentPage.create({
        title,
        slug,
        section,
        description,
        bodyHtml: DOMPurify.sanitize(bodyHtml, { USE_PROFILES: { html: true } }),
        status: 'draft',
        authorId: new Types.ObjectId(adminId),
      })

      fastify.log.info({ pageId: page.id, section, slug, adminId }, '[content-pages] Page created')
      return reply.code(201).send({ success: true, page })
    },
  )

  // ── PATCH /:id — update a content page ──────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: UpdateBody }>(
    '/:id',
    { preHandler: requirePermission('content-pages:write') },
    async (request, reply) => {
      const { id } = request.params
      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid page ID.' })
      }
      const parsed = updateBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body.',
        })
      }

      const page = await ContentPage.findById(id)
      if (!page) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Content page not found.' })
      }

      const { title, section, description, bodyHtml } = parsed.data
      const nextSlug = parsed.data.slug || (title ? slugify(title) : undefined)

      if (nextSlug && (nextSlug !== page.slug || (section && section !== page.section))) {
        const conflict = await ContentPage.findOne({
          _id: { $ne: page._id },
          section: section ?? page.section,
          slug: nextSlug,
        })
        if (conflict) {
          return reply.code(409).send({ error: 'CONFLICT', message: `A ${section ?? page.section} page with slug "${nextSlug}" already exists.` })
        }
      }

      const wasPublished = page.status === 'published'
      const prevSection = page.section
      const prevSlug = page.slug

      if (title !== undefined) page.title = title
      if (nextSlug) page.slug = nextSlug
      if (section !== undefined) page.section = section
      if (description !== undefined) page.description = description
      if (bodyHtml !== undefined) page.bodyHtml = DOMPurify.sanitize(bodyHtml, { USE_PROFILES: { html: true } })
      await page.save()

      // If a published page's slug/section changed, move the live file.
      if (wasPublished && (page.slug !== prevSlug || page.section !== prevSection)) {
        await removePublishedPage(prevSection, prevSlug)
      }
      if (wasPublished) {
        await writePublishedPage(page)
        await regenerateIndexes()
      }

      fastify.log.info({ pageId: page.id }, '[content-pages] Page updated')
      return reply.send({ success: true, page })
    },
  )

  // ── DELETE /:id — delete a content page ──────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requirePermission('content-pages:delete') },
    async (request, reply) => {
      const { id } = request.params
      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid page ID.' })
      }
      const page = await ContentPage.findById(id)
      if (!page) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Content page not found.' })
      }

      const wasPublished = page.status === 'published'
      await page.deleteOne()

      if (wasPublished) {
        await removePublishedPage(page.section, page.slug)
        await regenerateIndexes()
      }

      fastify.log.info({ pageId: id }, '[content-pages] Page deleted')
      return reply.send({ success: true })
    },
  )

  // ── POST /:id/publish ─────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/:id/publish',
    { preHandler: requirePermission('content-pages:publish') },
    async (request, reply) => {
      const { id } = request.params
      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid page ID.' })
      }
      const page = await ContentPage.findById(id)
      if (!page) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Content page not found.' })
      }

      page.status = 'published'
      page.publishedAt = page.publishedAt ?? new Date()
      await page.save()

      await writePublishedPage(page)
      await regenerateIndexes()

      fastify.log.info({ pageId: page.id, section: page.section, slug: page.slug }, '[content-pages] Page published')
      return reply.send({
        success: true,
        page,
        url: `https://nextaibuilder.com/${page.section}/${page.slug}.html`,
      })
    },
  )

  // ── POST /:id/unpublish ───────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/:id/unpublish',
    { preHandler: requirePermission('content-pages:publish') },
    async (request, reply) => {
      const { id } = request.params
      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid page ID.' })
      }
      const page = await ContentPage.findById(id)
      if (!page) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Content page not found.' })
      }

      page.status = 'draft'
      await page.save()

      await removePublishedPage(page.section, page.slug)
      await regenerateIndexes()

      fastify.log.info({ pageId: page.id }, '[content-pages] Page unpublished')
      return reply.send({ success: true, page })
    },
  )
}
