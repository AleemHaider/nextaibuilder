// FIR-31 — Public storefront API routes
// GET  /api/v1/storefront/cohorts          — published cohort listing
// GET  /api/v1/storefront/cohorts/:slug    — published cohort detail with modules
// GET  /api/v1/storefront/certificate/:credentialId — public certificate verification (FIR-154)

import type { FastifyInstance } from 'fastify'
import { getFlashPromo } from '../lib/flashPromo.js'
import { Types } from 'mongoose'
import { Cohort } from '../models/Cohort.js'
import { Module } from '../models/Module.js'
import { Lesson } from '../models/Lesson.js'
import { Enrollment } from '../models/Enrollment.js'
import { PaymentPlan } from '../models/PaymentPlan.js'
import { Certificate } from '../models/Certificate.js'
import { User } from '../models/User.js'
// NAB-P0-3 — populate the primary instructor profile on the cohort detail.
import { InstructorProfile } from '../models/InstructorProfile.js'
import { getPresignedReadUrl } from '../lib/s3.js'

// Public cover images use a long-lived (7-day) presigned URL, recomputed on
// every storefront request — avoids needing the S3 bucket (which also holds
// private student screenshots) configured for public-read.
const COVER_IMAGE_URL_TTL_SECONDS = 7 * 24 * 60 * 60

async function resolveCoverImageUrl(coverImageKey: string | null | undefined): Promise<string | null> {
  if (!coverImageKey) return null
  try {
    return await getPresignedReadUrl(coverImageKey, COVER_IMAGE_URL_TTL_SECONDS)
  } catch {
    return null
  }
}

// ── Route plugin ───────────────────────────────────────────────────────────

export async function storefrontRoutes(fastify: FastifyInstance) {

  // ── GET /cohorts ── Published cohort listing ──────────────────────────
  fastify.get('/cohorts', async (_request, reply) => {
    const cohorts = await Cohort.find(
      {
        isPublished: true,
        // Don't list cohorts that already ended — they can't be purchased
        // (checkout returns COHORT_ENDED) so showing them is a dead end.
        // Null liveEndDate (self-paced / recorded) is always listed.
        $or: [{ liveEndDate: null }, { liveEndDate: { $gte: new Date() } }],
      },
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
        // Founding-discount fields. Surface so cards can render the
        // strike-through regular price + "first 10 seats" badge.
        regularPrice:     1,
        promoSeats:       1,
      },
    )
      .sort({ liveStartDate: 1, createdAt: -1 })
      .lean({ virtuals: true })

    if (cohorts.length === 0) {
      return reply.send([])
    }

    // Real enrolled counts per cohort. The stored `enrollmentCount` field is
    // never maintained (stuck at its default 0), so seats-left / sold-out /
    // founding-promo math must be computed from actual active enrollments.
    const cohortIds = cohorts.map((c) => (c as typeof c & { _id: Types.ObjectId })._id)
    const enrolledAgg = await Enrollment.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { cohortId: { $in: cohortIds }, status: { $nin: ['REVOKED'] } } },
      { $group: { _id: '$cohortId', n: { $sum: 1 } } },
    ])
    const enrolledMap = new Map(enrolledAgg.map((e) => [e._id.toString(), e.n]))

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

    const result = await Promise.all(cohorts.map(async (c) => {
      const cohortWithId = c as typeof c & { _id: Types.ObjectId }
      const enrolled = enrolledMap.get(cohortWithId._id.toString()) ?? 0
      const cohortPlans = (c.paymentPlanIds ?? []).map(
        (id) => planMap.get(id.toString()),
      ).filter(Boolean)

      const oneTimePlan = cohortPlans.find((p) => p!.type === 'ONE_TIME')
      const installmentPlan = cohortPlans.find((p) => p!.type === 'INSTALLMENT')

      // PaymentPlan.totalAmount is in cents (Stripe's unit) — the storefront
      // display fields are whole dollars, so convert here rather than at
      // each of the half-dozen frontend call sites that format this as
      // currency directly.
      const price = Math.round((oneTimePlan?.totalAmount ?? installmentPlan?.totalAmount ?? 0) / 100)
      const installmentCount = installmentPlan ? 3 : undefined
      const installmentPrice = installmentPlan
        ? Math.ceil(installmentPlan.totalAmount / 300)
        : undefined

      const soldOut =
        c.maxSeats != null &&
        enrolled >= c.maxSeats

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
          const remaining = c.maxSeats - enrolled
          meta += ` · ${Math.max(0, remaining)} seats left`
        }
      }

      // Founding-discount math. The active payment plan already carries the
      // discounted price, so `price` above is the founding rate. We surface
      // `regularPrice` separately so the UI can render a strike-through
      // until promoSeats seats are sold.
      const promoActive =
        c.regularPrice != null &&
        c.promoSeats != null &&
        enrolled < c.promoSeats
      const seatsRemainingPromo = promoActive
        ? Math.max(0, (c.promoSeats ?? 0) - enrolled)
        : null

      return {
        id:               cohortWithId._id.toString(),
        slug:             c.slug ?? '',
        title:            c.name,
        tagline:          c.tagline ?? '',
        // DB stores type uppercase ('LIVE'/'RECORDED'/'COMBINED') — actually
        // lowercase it here, not just assert the type, or every consumer
        // that keys a lookup map by this value (e.g. CohortCard's
        // TYPE_CONFIG) gets `undefined` and throws.
        type:             (c.type ?? 'recorded').toLowerCase() as 'recorded' | 'live' | 'combined',
        price,
        installmentPrice,
        installmentCount,
        coverGradient:    null,
        coverImageUrl:    await resolveCoverImageUrl(c.coverImageKey),
        meta,
        soldOut,
        published:        true,
        // NAB-P0-2 — bullet arrays (default to [] for docs that predate
        // the fields so consumers can safely render `.map()` without guards).
        learningOutcomes: c.learningOutcomes ?? [],
        requirements:     c.requirements     ?? [],
        targetAudience:   c.targetAudience   ?? [],
        // Founding discount. regularPrice is null when no promo is configured.
        // c.regularPrice is stored in cents like PaymentPlan.totalAmount.
        regularPrice:        promoActive && c.regularPrice != null ? Math.round(c.regularPrice / 100) : null,
        promoSeatsRemaining: seatsRemainingPromo,
      }
    }))

    return reply.send(result)
  })

  // ── GET /promo ── Flash-promo state for this browser session ───────────
  // Starts the countdown on first call (signed session cookie). The checkout
  // routes read the same cookie, so what the ticker shows is what gets charged.
  fastify.get('/promo', async (request, reply) => {
    const promo = getFlashPromo(request, reply, { start: true })
    return reply.send(promo)
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
      // Sum lesson estimatedMinutes → hours, rounded to 1 decimal. Was
      // hardcoded 0 before; the storefront's "hours of content" card was
      // permanently stuck at 0h.
      const totalMinutes = allLessons.reduce(
        (sum, l) => sum + ((l as { estimatedMinutes?: number }).estimatedMinutes ?? 0),
        0,
      )
      const hoursOfContent = Math.round((totalMinutes / 60) * 10) / 10

      const oneTimePlan = paymentPlans.find((p) => p.type === 'ONE_TIME')
      const installmentPlan = paymentPlans.find((p) => p.type === 'INSTALLMENT')

      // See list endpoint above — totalAmount is cents, storefront fields are dollars.
      const price = Math.round((oneTimePlan?.totalAmount ?? installmentPlan?.totalAmount ?? 0) / 100)
      const installmentCount = installmentPlan ? 3 : undefined
      const installmentPrice = installmentPlan
        ? Math.ceil(installmentPlan.totalAmount / 300)
        : undefined

      // Real enrolled count (the stored enrollmentCount field is never
      // maintained, so it can't drive seats-left / sold-out / promo math).
      const enrolled = await Enrollment.countDocuments({
        cohortId,
        status: { $nin: ['REVOKED'] },
      })

      const soldOut =
        cohort.maxSeats != null &&
        enrolled >= cohort.maxSeats

      let meta = ''
      if (cohort.type === 'RECORDED') {
        meta = `📅 Self-paced · ${totalLessonCount} lessons`
      } else if (cohort.liveStartDate) {
        const dateStr = new Date(cohort.liveStartDate).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
        meta = `📅 Starts ${dateStr}`
        if (cohort.maxSeats != null) {
          const remaining = cohort.maxSeats - enrolled
          meta += ` · ${Math.max(0, remaining)} seats left`
        }
      }

      const promoActive =
        cohort.regularPrice != null &&
        cohort.promoSeats != null &&
        enrolled < cohort.promoSeats
      const seatsRemainingPromo = promoActive
        ? Math.max(0, (cohort.promoSeats ?? 0) - enrolled)
        : null

      return reply.send({
        id:               cohortId.toString(),
        slug:             cohort.slug ?? '',
        title:            cohort.name,
        tagline:          cohort.tagline ?? '',
        type:             (cohort.type ?? 'recorded').toLowerCase() as 'recorded' | 'live' | 'combined',
        description:      cohort.description ?? '',
        price,
        installmentPrice,
        installmentCount,
        coverGradient:    null,
        coverImageUrl:    await resolveCoverImageUrl(cohort.coverImageKey),
        meta,
        soldOut,
        published:        true,
        lessonCount:      totalLessonCount,
        hoursOfContent,
        // Founding discount. regularPrice null when no promo active.
        // cohort.regularPrice is stored in cents like PaymentPlan.totalAmount.
        regularPrice:        promoActive && cohort.regularPrice != null ? Math.round(cohort.regularPrice / 100) : null,
        promoSeatsRemaining: seatsRemainingPromo,
        startDate:        cohort.liveStartDate?.toISOString() ?? undefined,
        seatsRemaining:   cohort.maxSeats != null
          ? Math.max(0, cohort.maxSeats - enrolled)
          : undefined,
        enrolledCount:    enrolled,
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
