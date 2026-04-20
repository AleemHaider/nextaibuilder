// FIR-31 — Public storefront API routes
// GET  /api/v1/storefront/cohorts          — published cohort listing
// GET  /api/v1/storefront/cohorts/:slug    — published cohort detail with modules
// GET  /api/v1/storefront/certificate/:credentialId — public certificate verification (FIR-154)

import type { FastifyInstance } from 'fastify'
import { Types } from 'mongoose'
import { Cohort } from '../models/Cohort.js'
import { Module } from '../models/Module.js'
import { Lesson } from '../models/Lesson.js'
import { PaymentPlan } from '../models/PaymentPlan.js'
import { Certificate } from '../models/Certificate.js'
import { User } from '../models/User.js'
// NAB-P0-3 — populate the primary instructor profile on the cohort detail.
import { InstructorProfile } from '../models/InstructorProfile.js'

// ── Route plugin ───────────────────────────────────────────────────────────

export async function storefrontRoutes(fastify: FastifyInstance) {

  // ── GET /cohorts ── Published cohort listing ──────────────────────────
  fastify.get('/cohorts', async (_request, reply) => {
    const cohorts = await Cohort.find(
      { isPublished: true },
      {
        name:             1,
        slug:             1,
        tagline:          1,
        type:             1,
        coverImageKey:    1,
        paymentPlanIds:   1,
        liveStartDate:    1,
        liveEndDate:      1,
        enrollmentCount:  1,
        maxSeats:         1,
        createdAt:        1,
        // NAB-P0-2 — project the marketing bullets onto the list as well so
        // card surfaces can preview "What you'll learn" without an extra fetch.
        learningOutcomes: 1,
        requirements:     1,
        targetAudience:   1,
      },
    )
      .sort({ liveStartDate: 1, createdAt: -1 })
      .lean({ virtuals: true })

    if (cohorts.length === 0) {
      return reply.send([])
    }

    // Collect all referenced payment plan IDs across all cohorts
    const allPlanIds = cohorts.flatMap(
      (c) => (c.paymentPlanIds ?? []) as Types.ObjectId[],
    )

    const plans = allPlanIds.length > 0
      ? await PaymentPlan.find(
          { _id: { $in: allPlanIds }, isActive: true },
          { name: 1, type: 1, totalAmount: 1, currency: 1, intervalDays: 1, installments: 1 },
        ).lean({ virtuals: true })
      : []

    const planMap = new Map(
      plans.map((p) => [
        (p as typeof p & { _id: Types.ObjectId })._id.toString(),
        p,
      ]),
    )

    const result = cohorts.map((c) => {
      const cohortWithId = c as typeof c & { _id: Types.ObjectId }
      const cohortPlans = (c.paymentPlanIds ?? []).map(
        (id) => planMap.get(id.toString()),
      ).filter(Boolean)

      const oneTimePlan = cohortPlans.find((p) => p!.type === 'ONE_TIME')
      const installmentPlan = cohortPlans.find((p) => p!.type === 'INSTALLMENT')

      const price = oneTimePlan?.totalAmount ?? installmentPlan?.totalAmount ?? 0
      const installmentCount = installmentPlan ? 3 : undefined
      const installmentPrice = installmentPlan
        ? Math.ceil(installmentPlan.totalAmount / 3)
        : undefined

      const soldOut =
        c.maxSeats != null &&
        (c.enrollmentCount ?? 0) >= c.maxSeats

      // Build human-readable meta string
      let meta = ''
      if (c.type === 'RECORDED') {
        meta = '📅 Self-paced'
      } else if (c.liveStartDate) {
        const dateStr = new Date(c.liveStartDate).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
        meta = `📅 Starts ${dateStr}`
        if (c.maxSeats != null) {
          const remaining = c.maxSeats - (c.enrollmentCount ?? 0)
          meta += ` · ${Math.max(0, remaining)} seats left`
        }
      }

      return {
        id:               cohortWithId._id.toString(),
        slug:             c.slug ?? '',
        title:            c.name,
        tagline:          c.tagline ?? '',
        type:             (c.type ?? 'recorded') as 'recorded' | 'live' | 'combined',
        price,
        installmentPrice,
        installmentCount,
        coverGradient:    null,
        meta,
        soldOut,
        published:        true,
        // NAB-P0-2 — bullet arrays (default to [] for docs that predate
        // the fields so consumers can safely render `.map()` without guards).
        learningOutcomes: c.learningOutcomes ?? [],
        requirements:     c.requirements     ?? [],
        targetAudience:   c.targetAudience   ?? [],
      }
    })

    return reply.send(result)
  })

  // ── GET /cohorts/:slug ── Published cohort detail ─────────────────────
  fastify.get<{ Params: { slug: string } }>(
    '/cohorts/:slug',
    async (request, reply) => {
      const { slug } = request.params

      const cohort = await Cohort.findOne(
        { slug: slug.toLowerCase(), isPublished: true },
      ).lean({ virtuals: true })

      if (!cohort) {
        return reply.code(404).send({
          error:   'NOT_FOUND',
          message: 'Cohort not found.',
        })
      }

      const cohortId = (cohort as typeof cohort & { _id: Types.ObjectId })._id

      // NAB-P0-3 — the storefront cohort card renders the "primary"
      // instructor (first of `cohort.instructorIds`) only. We fetch that
      // single profile alongside the other detail queries so the hero
      // assembles in one round-trip. Older cohorts with empty instructorIds
      // surface `instructor: null` so the UI can hide the card entirely.
      const primaryInstructorId =
        ((cohort.instructorIds ?? []) as Types.ObjectId[])[0] ?? null

      // Fetch payment plans, modules, lesson counts, lesson list, and the
      // primary instructor profile in parallel.
      const [plans, modules, lessonCountAgg, allLessons, primaryInstructor] = await Promise.all([
        (cohort.paymentPlanIds ?? []).length > 0
          ? PaymentPlan.find(
              { _id: { $in: cohort.paymentPlanIds }, isActive: true },
              { name: 1, type: 1, totalAmount: 1, currency: 1, intervalDays: 1 },
            ).lean({ virtuals: true })
          : Promise.resolve([]),
        Module.find(
          { cohortId },
          { cohortId: 1, title: 1, description: 1, order: 1, isPublished: 1 },
        )
          .sort({ order: 1 })
          .lean({ virtuals: true }),
        Lesson.aggregate<{ _id: Types.ObjectId; count: number }>([
          { $match: { cohortId, isPublished: true } },
          { $group: { _id: '$moduleId', count: { $sum: 1 } } },
        ]),
        Lesson.find(
          { cohortId, isPublished: true },
          { moduleId: 1, title: 1, type: 1, order: 1, estimatedMinutes: 1, freePreview: 1 },
        ).sort({ order: 1 }).lean({ virtuals: true }),
        primaryInstructorId
          ? InstructorProfile
              .findById(
                primaryInstructorId,
                { name: 1, title: 1, bio: 1, avatarKey: 1, socialLinks: 1 },
              )
              .lean({ virtuals: true })
          : Promise.resolve(null),
      ])

      const paymentPlans = plans.map((p) => ({
        id:          (p as typeof p & { _id: Types.ObjectId })._id.toString(),
        name:        p.name,
        type:        p.type,
        totalAmount: p.totalAmount,
        currency:    p.currency,
        intervalDays: p.intervalDays ?? null,
      }))

      const lessonCountMap = new Map(
        lessonCountAgg.map((r) => [r._id.toString(), r.count]),
      )

      // Group lessons by moduleId
      const lessonsByModule = new Map<string, typeof allLessons>()
      for (const lesson of allLessons) {
        const mid = (lesson as typeof lesson & { moduleId: Types.ObjectId }).moduleId.toString()
        if (!lessonsByModule.has(mid)) lessonsByModule.set(mid, [])
        lessonsByModule.get(mid)!.push(lesson)
      }

      const modulesResult = modules.map((m) => {
        const moduleId = (m as typeof m & { _id: Types.ObjectId })._id
        const mid = moduleId.toString()
        const lessons = lessonsByModule.get(mid) ?? []
        const freePreviewCount = lessons.filter((l) => (l as typeof l & { freePreview?: boolean }).freePreview).length
        return {
          id:               mid,
          title:            m.title,
          lessonCount:      lessonCountMap.get(mid) ?? 0,
          freePreviewCount,
          lessons: lessons.map((l) => ({
            id:               (l as typeof l & { _id: Types.ObjectId })._id.toString(),
            title:            l.title,
            type:             l.type,
            order:            l.order,
            estimatedMinutes: l.estimatedMinutes,
            freePreview:      (l as typeof l & { freePreview?: boolean }).freePreview ?? false,
          })),
        }
      })
      const totalLessonCount = modulesResult.reduce((s, m) => s + m.lessonCount, 0)

      const oneTimePlan = paymentPlans.find((p) => p.type === 'ONE_TIME')
      const installmentPlan = paymentPlans.find((p) => p.type === 'INSTALLMENT')

      const price = oneTimePlan?.totalAmount ?? installmentPlan?.totalAmount ?? 0
      const installmentCount = installmentPlan ? 3 : undefined
      const installmentPrice = installmentPlan
        ? Math.ceil(installmentPlan.totalAmount / 3)
        : undefined

      const soldOut =
        cohort.maxSeats != null &&
        (cohort.enrollmentCount ?? 0) >= cohort.maxSeats

      let meta = ''
      if (cohort.type === 'RECORDED') {
        meta = `📅 Self-paced · ${totalLessonCount} lessons`
      } else if (cohort.liveStartDate) {
        const dateStr = new Date(cohort.liveStartDate).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
        meta = `📅 Starts ${dateStr}`
        if (cohort.maxSeats != null) {
          const remaining = cohort.maxSeats - (cohort.enrollmentCount ?? 0)
          meta += ` · ${Math.max(0, remaining)} seats left`
        }
      }

      return reply.send({
        id:               cohortId.toString(),
        slug:             cohort.slug ?? '',
        title:            cohort.name,
        tagline:          cohort.tagline ?? '',
        type:             (cohort.type ?? 'recorded') as 'recorded' | 'live' | 'combined',
        description:      cohort.description ?? '',
        price,
        installmentPrice,
        installmentCount,
        coverGradient:    null,
        meta,
        soldOut,
        published:        true,
        lessonCount:      totalLessonCount,
        hoursOfContent:   0,
        startDate:        cohort.liveStartDate?.toISOString() ?? undefined,
        seatsRemaining:   cohort.maxSeats != null
          ? Math.max(0, cohort.maxSeats - (cohort.enrollmentCount ?? 0))
          : undefined,
        enrolledCount:    cohort.enrollmentCount ?? 0,
        modules:          modulesResult,
        // NAB-P0-2 — `includes` was hardcoded to [] before this story. The
        // legacy alias is kept so consumers that haven't migrated yet still
        // render "What's included". New code should prefer `learningOutcomes`.
        includes:         cohort.learningOutcomes ?? [],
        learningOutcomes: cohort.learningOutcomes ?? [],
        requirements:     cohort.requirements     ?? [],
        targetAudience:   cohort.targetAudience   ?? [],
        // NAB-P0-3 — real instructor block populated from the primary
        // instructor profile. When `instructorIds` is empty the field is
        // null and the storefront hides the card entirely.
        instructor: primaryInstructor
          ? {
              id:         (primaryInstructor as typeof primaryInstructor & { _id: Types.ObjectId })._id.toString(),
              name:       (primaryInstructor.name ?? '') as string,
              title:      (primaryInstructor.title ?? '') as string,
              bio:        (primaryInstructor.bio ?? '') as string,
              avatarUrl:  primaryInstructor.avatarKey
                ? `/api/uploads/${primaryInstructor.avatarKey}`
                : null,
              socialLinks:
                ((primaryInstructor.socialLinks ?? []) as Array<{ platform: string; url: string }>)
                  .map((l) => ({ platform: l.platform, url: l.url })),
            }
          : null,
        // Legacy flat keys — kept until the front-end migrates off them so
        // old storefront builds don't crash on a missing key. New code should
        // read `instructor` above.
        instructorName:   primaryInstructor?.name  ?? '',
        instructorTitle:  primaryInstructor?.title ?? '',
        instructorBio:    primaryInstructor?.bio   ?? '',
        paymentPlans,
      })
    },
  )

  // ── GET /cohorts/:slug/preview-lessons ── Free preview lesson content ───
  // Returns freePreview=true lessons with full content — no auth required
  fastify.get<{ Params: { slug: string } }>(
    '/cohorts/:slug/preview-lessons',
    async (request, reply) => {
      const { slug } = request.params

      const cohort = await Cohort.findOne(
        { slug: slug.toLowerCase(), isPublished: true },
        { _id: 1, type: 1 },
      ).lean({ virtuals: true })

      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found.' })
      }

      const cohortId = (cohort as typeof cohort & { _id: Types.ObjectId })._id

      const previewLessons = await Lesson.find(
        { cohortId, isPublished: true, freePreview: true },
        {
          moduleId: 1, title: 1, type: 1, order: 1, estimatedMinutes: 1,
          // NAB-P0-5 — include multi-provider video fields alongside the
          // legacy loomUrl so the storefront can build the right iframe.
          // NAB-P0-4 — include richContent + contentFormat so the preview
          // pane renders the TipTap HTML when available.
          videoProvider: 1, videoUrl: 1, loomUrl: 1,
          content: 1, richContent: 1, contentFormat: 1,
        },
      )
        .sort({ order: 1 })
        .lean({ virtuals: true })

      if (previewLessons.length === 0) {
        return reply.send([])
      }

      // Fetch module titles for context
      const moduleIds = [...new Set(previewLessons.map((l) =>
        (l as typeof l & { moduleId: Types.ObjectId }).moduleId.toString()
      ))]
      const modules = await Module.find(
        { _id: { $in: moduleIds } },
        { title: 1 },
      ).lean({ virtuals: true })

      const moduleMap = new Map(
        modules.map((m) => [(m as typeof m & { _id: Types.ObjectId })._id.toString(), m.title]),
      )

      const result = previewLessons.map((l) => {
        const lessonWithId = l as typeof l & {
          _id: Types.ObjectId
          moduleId: Types.ObjectId
          videoProvider?: 'LOOM' | 'YOUTUBE' | 'VIMEO' | null
          videoUrl?: string | null
        }
        // NAB-P0-5 — Back-compat: prefer the new fields, fall back to loomUrl.
        const videoUrl      = lessonWithId.videoUrl ?? l.loomUrl ?? null
        const videoProvider =
          lessonWithId.videoProvider ?? (l.loomUrl ? 'LOOM' : null)
        return {
          id:               lessonWithId._id.toString(),
          moduleId:         lessonWithId.moduleId.toString(),
          moduleTitle:      moduleMap.get(lessonWithId.moduleId.toString()) ?? '',
          title:            l.title,
          type:             l.type,
          order:            l.order,
          estimatedMinutes: l.estimatedMinutes,
          videoProvider,
          videoUrl,
          // Legacy key — kept so older clients that still read `loomUrl` work.
          loomUrl:          l.loomUrl ?? null,
          content:          l.content ?? null,
          // NAB-P0-4 — rich body takes precedence on the storefront preview.
          richContent:      (l as { richContent?: string | null }).richContent ?? null,
          contentFormat:    (l as { contentFormat?: string | null }).contentFormat ?? null,
        }
      })

      return reply.send(result)
    },
  )

  // ── GET /cohorts/by-id/:id ── Lookup cohort by Mongo ObjectId ──────────
  // Sprint 2 Story 10 (GAP-030) — EnrollmentSuccessPage used to read the
  // cohort name out of a `?cohort=` query param, which is trivially
  // spoofable (XSS vector via URL-injected HTML + any future consumer that
  // dumps it in innerHTML). The page now calls this endpoint with a
  // trusted id and renders the server-returned title instead.
  fastify.get<{ Params: { id: string } }>(
    '/cohorts/by-id/:id',
    async (request, reply) => {
      const { id } = request.params

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({
          error:   'INVALID_ID',
          message: 'id must be a valid ObjectId.',
        })
      }

      const cohort = await Cohort.findOne(
        { _id: new Types.ObjectId(id), isPublished: true },
        { name: 1, slug: 1 },
      ).lean({ virtuals: true })

      if (!cohort) {
        return reply.code(404).send({
          error:   'NOT_FOUND',
          message: 'Cohort not found.',
        })
      }

      return reply.send({
        id:    (cohort as typeof cohort & { _id: Types.ObjectId })._id.toString(),
        title: cohort.name,
        slug:  cohort.slug ?? '',
      })
    },
  )

  // ── GET /certificate/:credentialId ── Public certificate verification ──
  // FIR-154 — Verify a certificate by credentialId (format: NAB-YYYY-NNNN)
  fastify.get<{ Params: { credentialId: string } }>(
    '/certificate/:credentialId',
    async (request, reply) => {
      const { credentialId } = request.params

      // Basic format guard — avoids unnecessary DB round-trips on obviously invalid input
      if (!credentialId || credentialId.trim().length === 0) {
        return reply.code(400).send({
          error:   'INVALID_CREDENTIAL_ID',
          message: 'credentialId is required.',
        })
      }

      const certificate = await Certificate.findOne(
        { credentialId: credentialId.trim().toUpperCase() },
        { userId: 1, cohortId: 1, credentialId: 1, issuedAt: 1, publicToken: 1 },
      ).lean({ virtuals: true })

      if (!certificate) {
        return reply.send({ valid: false })
      }

      // Populate student (name + avatar only) and cohort (title + slug only) in parallel
      const [student, cohort] = await Promise.all([
        User.findById(
          certificate.userId,
          { firstName: 1, lastName: 1, avatarUrl: 1 },
        ).lean(),
        certificate.cohortId
          ? Cohort.findById(
              certificate.cohortId,
              { title: 1, slug: 1, name: 1 },
            ).lean()
          : Promise.resolve(null),
      ])

      return reply.send({
        valid: true,
        certificate: {
          id:           (certificate as typeof certificate & { id: string }).id,
          credentialId: certificate.credentialId,
          issuedAt:     certificate.issuedAt,
          publicToken:  certificate.publicToken,
          student: student
            ? {
                name:      `${student.firstName} ${student.lastName}`.trim(),
                avatarUrl: student.avatarUrl ?? null,
              }
            : null,
          cohort: cohort
            ? {
                // Cohort.name is the legacy field; cohort model has no `title` field
                title: (cohort as typeof cohort & { name?: string }).name ?? null,
                slug:  (cohort as typeof cohort & { slug?: string }).slug ?? null,
              }
            : null,
        },
      })
    },
  )
}
