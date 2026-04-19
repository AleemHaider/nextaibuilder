// FIR-51 — Student LMS dashboard
// FIR-52 — Curriculum browser
// FIR-53 — Lesson content viewer
// FIR-54 — Mark lesson complete
// FIR-55 — Progress summary
// FIR-57 — Live sessions list
// FIR-58 — Certificates list + certificate generation (internal)

import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { Types } from 'mongoose'
import { Queue } from 'bullmq'
import { requireStudent } from '../../middleware/authenticate.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { Enrollment } from '../../models/Enrollment.js'
import { Cohort } from '../../models/Cohort.js'
import { Module } from '../../models/Module.js'
import { Lesson } from '../../models/Lesson.js'
import { StudentLesson } from '../../models/StudentLesson.js'
import { LiveSession } from '../../models/LiveSession.js'
import { Certificate } from '../../models/Certificate.js'
import { PaymentPlan } from '../../models/PaymentPlan.js'
import { User } from '../../models/User.js'
import { SetupStep } from '../../models/SetupStep.js'
import { StudentStep } from '../../models/StudentStep.js'
import { StepSubmission } from '../../models/StepSubmission.js'
import {
  buildS3Key,
  getPresignedPutUrl,
  getPresignedReadUrl,
} from '../../lib/s3.js'
import { bullMQConnection } from '../../lib/redis.js'
import type { IEnrollment } from '../../models/Enrollment.js'
import type { ICohort } from '../../models/Cohort.js'
import type { ILesson } from '../../models/Lesson.js'

// ── BullMQ queue for certificate-issued emails ────────────────────────────
const emailNotificationsQueue = new Queue('email-notifications', {
  connection: bullMQConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

// Sprint 2 Story 12 — Screenshot validation queue (shares the worker
// registered by the PBA step submission flow — see screenshotValidationWorker.ts).
const screenshotQueue = new Queue('screenshot-validation-queue', {
  connection: bullMQConnection,
})

// Sprint 2 Story 12 — Max attempts per lesson per day (mirrors PBA step cap).
const TOOL_SETUP_DAILY_LIMIT = 10
const TOOL_SETUP_ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp']

// ── Loom embed URL helper (same pattern as student/steps.ts) ─────────────
function toStudentEmbedUrl(videoUrl: string | null | undefined): string | null {
  if (!videoUrl) return null
  const match = videoUrl.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/)
  if (!match?.[1]) return null
  return `https://www.loom.com/embed/${match[1]}`
}

// ── Shared helper: resolve ACTIVE enrollment from studentId + cohortId ────
async function findActiveEnrollment(
  studentId: string,
  cohortId: Types.ObjectId,
): Promise<IEnrollment | null> {
  return Enrollment.findOne({
    studentId: new Types.ObjectId(studentId),
    cohortId,
    status: { $nin: ['REVOKED', 'SUSPENDED'] },
  })
}

// ── Shared helper: resolve cohort by slug ────────────────────────────────
async function findCohortBySlug(slug: string): Promise<ICohort | null> {
  // Cast through unknown: recent Mongoose versions wrap .lean() results in
  // FlattenMaps<T>, whose deeply-nested Db typing is not structurally
  // assignable to the plain Db used by ICohort. The runtime shape is
  // identical — only the nominal type differs.
  return Cohort.findOne({ slug }).lean() as unknown as ICohort | null
}

// ── Internal: generate certificate when 100% complete ────────────────────
// FIR-58 — Certificate generation (triggered internally by lesson-complete)
async function generateCertificate(
  studentId: string,
  cohortId: Types.ObjectId,
  enrollmentId: Types.ObjectId,
): Promise<void> {
  // Idempotent — skip if one already exists for this enrollment
  const existing = await Certificate.findOne({ enrollmentId }).lean()
  if (existing) return

  const year = new Date().getFullYear()
  const sequence = (await Certificate.countDocuments()) + 1
  const credentialId = `NAB-${year}-${String(sequence).padStart(4, '0')}`

  const cert = await Certificate.create({
    userId:           new Types.ObjectId(studentId),
    cohortId,
    enrollmentId,
    credentialId,
    certificateToken: crypto.randomUUID(),
    // publicToken has a schema-level default (crypto.randomUUID())
    issuedAt:         new Date(),
  })

  // Enqueue certificate-issued email (fire-and-forget — caller does not await)
  void emailNotificationsQueue.add('certificate-issued', {
    type:        'CERTIFICATE_ISSUED',
    studentId,
    cohortId:    cohortId.toString(),
    credentialId: cert.credentialId,
  })
}

// ── Route plugin ──────────────────────────────────────────────────────────
export async function studentLmsRoutes(fastify: FastifyInstance) {

  // ── FIR-51 — Student LMS dashboard ───────────────────────────────────────
  // GET /api/v1/student/dashboard
  fastify.get(
    '/dashboard',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload

      const enrollments = await Enrollment.find(
        {
          studentId: new Types.ObjectId(studentId),
          status:    { $ne: 'REVOKED' },
        },
        {
          cohortId:             1,
          paymentPlanId:        1,
          paymentMethod:        1,
          paymentStatus:        1,
          status:               1,
          lessonsCompleted:     1,
          completionPercentage: 1,
          lastActivityAt:       1,
          accessGrantedAt:      1,
          createdAt:            1,
        },
      )
        .populate<{ cohortId: ICohort }>(
          'cohortId',
          'name slug type coverImageKey liveStartDate',
        )
        .sort({ lastActivityAt: -1 })
        .lean({ virtuals: true })

      if (enrollments.length === 0) {
        return reply.send({ enrollments: [] })
      }

      // ── Batch enrichment queries ────────────────────────────────────────────

      const cohortObjIds = enrollments.map((e) => (e.cohortId as ICohort)._id as Types.ObjectId)
      const enrollmentObjIds = enrollments.map((e) => e._id as Types.ObjectId)

      // 1. totalLessons per cohort
      const lessonCountDocs = await Lesson.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { cohortId: { $in: cohortObjIds }, isPublished: true } },
        { $group: { _id: '$cohortId', count: { $sum: 1 } } },
      ])
      const totalLessonsMap = new Map<string, number>()
      for (const doc of lessonCountDocs) {
        totalLessonsMap.set(doc._id.toString(), doc.count)
      }

      // 2. All published lessons for nextLessonTitle (need moduleId for ordering)
      const allLessons = await Lesson.find(
        { cohortId: { $in: cohortObjIds }, isPublished: true },
        { cohortId: 1, moduleId: 1, title: 1, order: 1 },
      ).lean()

      // 3. Module orders (for cross-module lesson sorting)
      const uniqueModuleIds = [
        ...new Set(allLessons.map((l) => (l.moduleId as Types.ObjectId).toString())),
      ]
      const moduleDocs = await Module.find(
        { _id: { $in: uniqueModuleIds.map((id) => new Types.ObjectId(id)) } },
        { order: 1 },
      ).lean()
      const moduleOrderMap = new Map<string, number>()
      for (const mod of moduleDocs) {
        moduleOrderMap.set((mod._id as Types.ObjectId).toString(), mod.order)
      }

      // Group lessons by cohort and sort by module order → lesson order
      type LessonRaw = { _id: unknown; moduleId: unknown; title: string; order: number }
      const lessonsByCohort = new Map<string, LessonRaw[]>()
      for (const lesson of allLessons) {
        const key = (lesson.cohortId as Types.ObjectId).toString()
        if (!lessonsByCohort.has(key)) lessonsByCohort.set(key, [])
        lessonsByCohort.get(key)!.push(lesson as LessonRaw)
      }
      for (const lessons of lessonsByCohort.values()) {
        lessons.sort((a, b) => {
          const modA = moduleOrderMap.get((a.moduleId as Types.ObjectId).toString()) ?? 0
          const modB = moduleOrderMap.get((b.moduleId as Types.ObjectId).toString()) ?? 0
          if (modA !== modB) return modA - modB
          return a.order - b.order
        })
      }

      // 4. Completed lesson IDs per enrollment
      const completedDocs = await StudentLesson.find(
        { enrollmentId: { $in: enrollmentObjIds }, status: 'COMPLETED' },
        { enrollmentId: 1, lessonId: 1 },
      ).lean()
      const completedByEnrollment = new Map<string, Set<string>>()
      for (const doc of completedDocs) {
        const key = (doc.enrollmentId as Types.ObjectId).toString()
        if (!completedByEnrollment.has(key)) completedByEnrollment.set(key, new Set())
        completedByEnrollment.get(key)!.add((doc.lessonId as Types.ObjectId).toString())
      }

      // 5. Next upcoming live session per cohort
      const now = new Date()
      const upcomingSessions = await LiveSession.find(
        { cohortId: { $in: cohortObjIds }, isPublished: true, scheduledAt: { $gt: now } },
        { cohortId: 1, scheduledAt: 1 },
      )
        .sort({ scheduledAt: 1 })
        .lean()
      const nextSessionByCohort = new Map<string, string>()
      for (const session of upcomingSessions) {
        const key = (session.cohortId as Types.ObjectId).toString()
        if (!nextSessionByCohort.has(key)) {
          nextSessionByCohort.set(
            key,
            session.scheduledAt.toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            }),
          )
        }
      }

      // ── Shape each enrollment for the frontend ──────────────────────────────
      const enriched = await Promise.all(
        enrollments.map(async (enrollment) => {
          const cohort    = enrollment.cohortId as ICohort
          const cohortKey = (cohort._id as Types.ObjectId).toString()
          const enrollKey = (enrollment._id as Types.ObjectId).toString()

          const totalLessons   = totalLessonsMap.get(cohortKey) ?? 0
          const completedIds   = completedByEnrollment.get(enrollKey) ?? new Set<string>()
          const cohortLessons  = lessonsByCohort.get(cohortKey) ?? []
          const nextLesson     = cohortLessons.find(
            (l) => !completedIds.has((l._id as Types.ObjectId).toString()),
          )
          const nextLessonTitle  = nextLesson?.title
          const nextLiveSession  = nextSessionByCohort.get(cohortKey)

          // STRIPE INSTALLMENT — attach payment plan schedule
          let installments: unknown[] | undefined
          if (enrollment.paymentMethod === 'STRIPE' && enrollment.paymentPlanId) {
            const plan = await PaymentPlan.findOne({
              _id:  enrollment.paymentPlanId,
              type: 'INSTALLMENT',
            })
              .select('type installments')
              .lean()
            if (plan?.installments) installments = plan.installments as unknown[]
          }

          return {
            id: enrollKey,
            cohort: {
              title:         cohort.name,
              slug:          cohort.slug,
              type:          ((cohort as unknown as { type?: string }).type ?? 'recorded').toLowerCase() as 'recorded' | 'live' | 'combined',
              coverImageKey: (cohort as unknown as { coverImageKey?: string }).coverImageKey,
            },
            completionPercentage: enrollment.completionPercentage ?? 0,
            lessonsCompleted:     enrollment.lessonsCompleted ?? 0,
            totalLessons,
            paymentStatus:  enrollment.paymentStatus,
            status:         enrollment.status,
            installments,
            lastActivityAt: enrollment.lastActivityAt?.toISOString(),
            nextLessonTitle,
            nextLiveSession,
          }
        }),
      )

      return reply.send({ enrollments: enriched })
    },
  )

  // ── FIR-171 — Student notification preferences ─────────────────────────────
  // GET  /api/v1/student/settings/notifications
  // PATCH /api/v1/student/settings/notifications
  // Maps FIR frontend fields → existing PBA User.notifications fields in DB.

  fastify.get(
    '/settings/notifications',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload
      const dbUser = await User.findById(studentId).select('notifications').lean()
      if (!dbUser) {
        return reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'User not found.' })
      }

      const n = dbUser.notifications ?? {}
      return reply.send({
        notifications: {
          emailEnrollment: (n as { setupReminders?: boolean }).setupReminders       ?? true,
          emailPayments:   (n as { deadlineAlerts?: boolean }).deadlineAlerts        ?? true,
          emailReminders:  (n as { progressUpdates?: boolean }).progressUpdates     ?? true,
          emailBroadcast:  (n as { tipsAndEncouragement?: boolean }).tipsAndEncouragement ?? false,
        },
      })
    },
  )

  fastify.patch<{ Body: Record<string, unknown> }>(
    '/settings/notifications',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload
      const prefs = (request.body as { notifications?: Record<string, boolean> }).notifications ?? {}

      const setFields: Record<string, boolean> = {}
      if (prefs['emailEnrollment'] !== undefined) setFields['notifications.setupReminders']       = prefs['emailEnrollment']
      if (prefs['emailPayments']   !== undefined) setFields['notifications.deadlineAlerts']        = prefs['emailPayments']
      if (prefs['emailReminders']  !== undefined) setFields['notifications.progressUpdates']      = prefs['emailReminders']
      if (prefs['emailBroadcast']  !== undefined) setFields['notifications.tipsAndEncouragement'] = prefs['emailBroadcast']

      if (Object.keys(setFields).length > 0) {
        await User.findByIdAndUpdate(studentId, { $set: setFields })
      }

      return reply.send({ success: true })
    },
  )

  // ── FIR-52 — Curriculum browser ───────────────────────────────────────────
  // GET /api/v1/student/cohorts/:cohortSlug/curriculum
  fastify.get<{ Params: { cohortSlug: string } }>(
    '/cohorts/:cohortSlug/curriculum',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload
      const { cohortSlug } = request.params

      // 1. Resolve cohort
      const cohort = await findCohortBySlug(cohortSlug)
      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found.' })
      }

      // 2. Verify ACTIVE enrollment
      const enrollment = await findActiveEnrollment(studentId, cohort._id as Types.ObjectId)
      if (!enrollment) {
        return reply.code(403).send({ error: 'NOT_ENROLLED', message: 'Active enrollment required.' })
      }

      // 3. Fetch published modules sorted by order
      const modules = await Module.find({ cohortId: cohort._id, isPublished: true })
        .sort({ order: 1 })
        .lean()

      // 4. Fetch all published lessons for this cohort (single query, then group)
      const lessons = await Lesson.find({ cohortId: cohort._id, isPublished: true })
        .sort({ moduleId: 1, order: 1 })
        .select('moduleId title type estimatedMinutes order isPublished')
        .lean()

      // 5. Fetch all StudentLesson records for this enrollment (single query)
      const lessonIds = lessons.map((l) => l._id)
      const studentLessons = await StudentLesson.find({
        enrollmentId: enrollment._id,
        lessonId:     { $in: lessonIds },
      })
        .select('lessonId status')
        .lean()

      const statusMap = new Map<string, string>()
      for (const sl of studentLessons) {
        statusMap.set(sl.lessonId.toString(), sl.status)
      }

      // 6. Group lessons by module, attaching per-student status
      const lessonsByModule = new Map<string, Array<ILesson & { status: string }>>()
      for (const lesson of lessons) {
        const moduleKey = (lesson.moduleId as Types.ObjectId).toString()
        if (!lessonsByModule.has(moduleKey)) lessonsByModule.set(moduleKey, [])
        lessonsByModule.get(moduleKey)!.push({
          ...lesson,
          status: statusMap.get((lesson._id as Types.ObjectId).toString()) ?? 'LOCKED',
        } as unknown as ILesson & { status: string })
      }

      const modulesWithLessons = modules.map((mod) => ({
        id:          (mod._id as Types.ObjectId).toString(),
        title:       mod.title,
        description: mod.description,
        order:       mod.order,
        lessons:     lessonsByModule.get((mod._id as Types.ObjectId).toString()) ?? [],
      }))

      return reply.send({
        cohort: { title: cohort.name, slug: cohort.slug },
        modules: modulesWithLessons,
      })
    },
  )

  // ── FIR-53 — Lesson content viewer ───────────────────────────────────────
  // GET /api/v1/student/cohorts/:cohortSlug/lessons/:lessonId
  fastify.get<{ Params: { cohortSlug: string; lessonId: string } }>(
    '/cohorts/:cohortSlug/lessons/:lessonId',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload
      const { cohortSlug, lessonId } = request.params

      // 1. Resolve cohort
      const cohort = await findCohortBySlug(cohortSlug)
      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found.' })
      }

      // 2. Verify ACTIVE enrollment
      const enrollment = await findActiveEnrollment(studentId, cohort._id as Types.ObjectId)
      if (!enrollment) {
        return reply.code(403).send({ error: 'NOT_ENROLLED', message: 'Active enrollment required.' })
      }

      // 3. Validate ObjectId
      if (!Types.ObjectId.isValid(lessonId)) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid lessonId.' })
      }

      // 4. Fetch lesson — must be published and belong to this cohort
      const lesson = await Lesson.findOne({
        _id:         new Types.ObjectId(lessonId),
        cohortId:    cohort._id,
        isPublished: true,
      }).lean()

      if (!lesson) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Lesson not found or not published.' })
      }

      // 5. Check if this is the first lesson of the first module (always accessible)
      const firstModule = await Module.findOne({ cohortId: cohort._id, isPublished: true })
        .sort({ order: 1 })
        .lean()

      const firstLesson = firstModule
        ? await Lesson.findOne({ moduleId: firstModule._id, cohortId: cohort._id, isPublished: true })
            .sort({ order: 1 })
            .lean()
        : null

      const isFirstLesson =
        firstLesson &&
        (firstLesson._id as Types.ObjectId).toString() === (lesson._id as Types.ObjectId).toString()

      // 6. Check StudentLesson status for access control
      const studentLesson = await StudentLesson.findOne({
        enrollmentId: enrollment._id,
        lessonId:     lesson._id,
      }).lean()

      const currentStatus = studentLesson?.status ?? 'LOCKED'

      if (!isFirstLesson && currentStatus === 'LOCKED') {
        return reply.code(403).send({
          error:   'LESSON_LOCKED',
          message: 'Complete previous lessons to unlock this one.',
        })
      }

      // 7. If IN_PROGRESS-ing for the first time, we don't auto-set IN_PROGRESS here.
      //    The client drives that via a separate update if needed. We just return the content.

      // 8. Build prev/next navigation (sorted lessons in same cohort)
      const allLessons = await Lesson.find({ cohortId: cohort._id, isPublished: true })
        .sort({ moduleId: 1, order: 1 })
        .select('_id title moduleId order')
        .lean()

      // Sort lessons: first by module order, then by lesson order within module
      // We need module order for cross-module navigation
      const moduleOrderMap = new Map<string, number>()
      const modules = await Module.find({ cohortId: cohort._id, isPublished: true })
        .select('_id order')
        .lean()
      for (const mod of modules) {
        moduleOrderMap.set((mod._id as Types.ObjectId).toString(), mod.order)
      }

      const sortedLessons = allLessons.sort((a, b) => {
        const modOrderA = moduleOrderMap.get((a.moduleId as Types.ObjectId).toString()) ?? 0
        const modOrderB = moduleOrderMap.get((b.moduleId as Types.ObjectId).toString()) ?? 0
        if (modOrderA !== modOrderB) return modOrderA - modOrderB
        return a.order - b.order
      })

      const currentIdx = sortedLessons.findIndex(
        (l) => (l._id as Types.ObjectId).toString() === (lesson._id as Types.ObjectId).toString(),
      )

      const prevLesson =
        currentIdx > 0
          ? {
              id:    (sortedLessons[currentIdx - 1]._id as Types.ObjectId).toString(),
              title: sortedLessons[currentIdx - 1].title,
            }
          : null

      const nextLesson =
        currentIdx < sortedLessons.length - 1
          ? {
              id:    (sortedLessons[currentIdx + 1]._id as Types.ObjectId).toString(),
              title: sortedLessons[currentIdx + 1].title,
            }
          : null

      return reply.send({
        lesson: {
          id:               (lesson._id as Types.ObjectId).toString(),
          title:            lesson.title,
          type:             lesson.type,
          estimatedMinutes: lesson.estimatedMinutes,
          order:            lesson.order,
          content:          lesson.content ?? null,
          loomUrl:          lesson.loomUrl ?? null,
          embedUrl:         toStudentEmbedUrl(lesson.loomUrl),
          transcript:       lesson.transcript ?? null,
          status:           currentStatus,
        },
        prevLesson,
        nextLesson,
      })
    },
  )

  // ── FIR-54 — Mark lesson complete ─────────────────────────────────────────
  // POST /api/v1/student/lessons/:lessonId/complete
  fastify.post<{ Params: { lessonId: string } }>(
    '/lessons/:lessonId/complete',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload
      const { lessonId } = request.params

      // 1. Validate ObjectId
      if (!Types.ObjectId.isValid(lessonId)) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid lessonId.' })
      }

      const lessonObjId = new Types.ObjectId(lessonId)

      // 2. Fetch lesson to get cohortId
      const lesson = await Lesson.findOne({
        _id:         lessonObjId,
        isPublished: true,
      })
        .select('cohortId moduleId')
        .lean()

      if (!lesson) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Lesson not found.' })
      }

      // 3. Verify ACTIVE enrollment
      const enrollment = await findActiveEnrollment(studentId, lesson.cohortId as Types.ObjectId)
      if (!enrollment) {
        return reply.code(403).send({ error: 'NOT_ENROLLED', message: 'Active enrollment required.' })
      }

      // 4. Upsert StudentLesson to COMPLETED (idempotent)
      await StudentLesson.findOneAndUpdate(
        {
          enrollmentId: enrollment._id,
          lessonId:     lessonObjId,
        },
        {
          $set: {
            studentId:   new Types.ObjectId(studentId),
            cohortId:    lesson.cohortId,
            status:      'COMPLETED',
            completedAt: new Date(),
          },
          $setOnInsert: {
            enrollmentId: enrollment._id,
            lessonId:     lessonObjId,
          },
        },
        { upsert: true, new: true },
      )

      // 5. Recalculate completionPercentage
      const totalPublishedLessons = await Lesson.countDocuments({
        cohortId:    lesson.cohortId,
        isPublished: true,
      })

      const completedCount = await StudentLesson.countDocuments({
        enrollmentId: enrollment._id,
        status:       'COMPLETED',
      })

      const completionPercentage =
        totalPublishedLessons > 0
          ? Math.min(100, Math.round((completedCount / totalPublishedLessons) * 100))
          : 0

      // 6. Update enrollment stats atomically
      await Enrollment.findByIdAndUpdate(enrollment._id, {
        $set: {
          completionPercentage,
          lessonsCompleted: completedCount,
          lastActivityAt:   new Date(),
        },
      })

      // 7. Certificate generation on 100% — fire-and-forget
      if (completionPercentage >= 100) {
        generateCertificate(
          studentId,
          lesson.cohortId as Types.ObjectId,
          enrollment._id as Types.ObjectId,
        ).catch((err: unknown) =>
          fastify.log.error(err, '[FIR-58] generateCertificate failed'),
        )
      }

      return reply.send({
        success:              true,
        completionPercentage,
        lessonsCompleted:     completedCount,
      })
    },
  )

  // ── FIR-55 — Progress summary ─────────────────────────────────────────────
  // GET /api/v1/student/cohorts/:cohortSlug/progress
  fastify.get<{ Params: { cohortSlug: string } }>(
    '/cohorts/:cohortSlug/progress',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload
      const { cohortSlug } = request.params

      // 1. Resolve cohort
      const cohort = await findCohortBySlug(cohortSlug)
      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found.' })
      }

      // 2. Verify ACTIVE enrollment
      const enrollment = await findActiveEnrollment(studentId, cohort._id as Types.ObjectId)
      if (!enrollment) {
        return reply.code(403).send({ error: 'NOT_ENROLLED', message: 'Active enrollment required.' })
      }

      // 3. Fetch all published modules and lessons
      const modules = await Module.find({ cohortId: cohort._id, isPublished: true })
        .sort({ order: 1 })
        .lean()

      const lessons = await Lesson.find({ cohortId: cohort._id, isPublished: true })
        .select('moduleId')
        .lean()

      const totalLessons = lessons.length

      // 4. Fetch completed StudentLessons for this enrollment
      const completedLessons = await StudentLesson.find({
        enrollmentId: enrollment._id,
        status:       'COMPLETED',
      })
        .select('lessonId')
        .lean()

      const completedLessonIds = new Set(
        completedLessons.map((sl) => sl.lessonId.toString()),
      )

      // 5. Group lessons by module, count completed
      const lessonsByModule = new Map<string, string[]>()
      for (const lesson of lessons) {
        const moduleKey = (lesson.moduleId as Types.ObjectId).toString()
        if (!lessonsByModule.has(moduleKey)) lessonsByModule.set(moduleKey, [])
        lessonsByModule.get(moduleKey)!.push((lesson._id as Types.ObjectId).toString())
      }

      const moduleSummaries = modules.map((mod) => {
        const modKey = (mod._id as Types.ObjectId).toString()
        const modLessonIds = lessonsByModule.get(modKey) ?? []
        const completedInModule = modLessonIds.filter((id) => completedLessonIds.has(id)).length

        return {
          moduleId:  modKey,
          title:     mod.title,
          completed: completedInModule,
          total:     modLessonIds.length,
        }
      })

      const totalCompleted = completedLessons.length
      const overallPercent =
        totalLessons > 0
          ? Math.min(100, Math.round((totalCompleted / totalLessons) * 100))
          : 0

      return reply.send({
        overall: {
          percent:   overallPercent,
          completed: totalCompleted,
          total:     totalLessons,
        },
        modules: moduleSummaries,
      })
    },
  )

  // ── FIR-57 — Live sessions list ───────────────────────────────────────────
  // GET /api/v1/student/cohorts/:cohortSlug/live-sessions
  fastify.get<{ Params: { cohortSlug: string } }>(
    '/cohorts/:cohortSlug/live-sessions',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload
      const { cohortSlug } = request.params

      // 1. Resolve cohort
      const cohort = await findCohortBySlug(cohortSlug)
      if (!cohort) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Cohort not found.' })
      }

      // 2. Verify ACTIVE enrollment
      const enrollment = await findActiveEnrollment(studentId, cohort._id as Types.ObjectId)
      if (!enrollment) {
        return reply.code(403).send({ error: 'NOT_ENROLLED', message: 'Active enrollment required.' })
      }

      // 3. Fetch published live sessions sorted by scheduledAt asc
      const sessions = await LiveSession.find({
        cohortId:    cohort._id,
        isPublished: true,
      })
        .sort({ scheduledAt: 1 })
        .lean()

      const now = Date.now()

      // 4. Tag each session by status and include only relevant fields
      const taggedSessions = sessions.map((session) => {
        const startMs  = session.scheduledAt.getTime()
        const endMs    = startMs + session.durationMinutes * 60 * 1000

        let status: 'LIVE' | 'UPCOMING' | 'PAST'
        if (now >= startMs && now <= endMs) {
          status = 'LIVE'
        } else if (now < startMs) {
          status = 'UPCOMING'
        } else {
          status = 'PAST'
        }

        const base = {
          id:              (session._id as Types.ObjectId).toString(),
          title:           session.title,
          description:     session.description ?? null,
          scheduledAt:     session.scheduledAt,
          durationMinutes: session.durationMinutes,
          order:           session.order,
          status,
        }

        if (status === 'LIVE') {
          return { ...base, zoomUrl: session.zoomUrl }
        }

        if (status === 'UPCOMING') {
          return { ...base, scheduledAt: session.scheduledAt, zoomUrl: session.zoomUrl }
        }

        // PAST — include recording if available
        return {
          ...base,
          recordingUrl: session.recordingUrl ?? null,
        }
      })

      return reply.send({ sessions: taggedSessions })
    },
  )

  // ── FIR-58 — Student certificates list ───────────────────────────────────
  // GET /api/v1/student/certificates
  fastify.get(
    '/certificates',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload

      const certificates = await Certificate.find({
        userId: new Types.ObjectId(studentId),
      })
        .populate<{ cohortId: ICohort }>('cohortId', 'name slug')
        .sort({ issuedAt: -1 })
        .lean({ virtuals: true })

      const result = certificates.map((cert) => {
        // cohortId may be null for legacy PBA certs that pre-date the FIR extension
        const cohort = cert.cohortId as ICohort | null

        return {
          id:           (cert._id as Types.ObjectId).toString(),
          credentialId: cert.credentialId ?? null,
          cohortTitle:  cohort?.name ?? null,
          cohortSlug:   cohort?.slug ?? null,
          issuedAt:     cert.issuedAt,
        }
      })

      return reply.send({ certificates: result })
    },
  )

  // ── Sprint 2 Story 12 — Tool-setup screenshot validation (LMS adapter) ───
  //
  // Lessons of type TOOL_SETUP reference a SetupStep via `setupStepId`. That
  // step owns the validation criteria and checklist consumed by the Claude
  // Vision worker. This adapter provides a lesson-scoped surface that
  // re-uses the exact same StepSubmission / screenshot-validation-queue
  // plumbing as the PBA-style `/api/student/steps` endpoints, so the worker
  // (screenshotValidationWorker.ts) remains untouched.
  //
  // Flow:
  //   1. POST /lessons/:lessonId/tool-setup-submission/presign → presigned PUT
  //   2. Client PUTs the file to the returned URL.
  //   3. POST /lessons/:lessonId/tool-setup-submission → enqueues ML job.
  //   4. GET  /lessons/:lessonId/tool-setup-submission/latest → polled.

  /**
   * Shared helper: resolve a TOOL_SETUP lesson for this student, returning
   * the linked SetupStep document or null when not applicable.
   */
  async function resolveToolSetupContext(
    studentId: string,
    lessonId: string,
  ): Promise<
    | { ok: true; lesson: ILesson; setupStepId: Types.ObjectId; enrollment: IEnrollment }
    | { ok: false; code: number; error: string; message: string }
  > {
    if (!Types.ObjectId.isValid(lessonId)) {
      return { ok: false, code: 400, error: 'VALIDATION_ERROR', message: 'Invalid lessonId.' }
    }

    const lesson = await Lesson.findOne({
      _id:         new Types.ObjectId(lessonId),
      isPublished: true,
    }).lean() as (ILesson | null)

    if (!lesson) {
      return { ok: false, code: 404, error: 'NOT_FOUND', message: 'Lesson not found.' }
    }

    if (lesson.type !== 'TOOL_SETUP') {
      return {
        ok: false,
        code: 400,
        error: 'NOT_TOOL_SETUP',
        message: 'Lesson is not a TOOL_SETUP lesson.',
      }
    }

    if (!lesson.setupStepId) {
      // Misconfigured lesson — admin should attach a SetupStep. Treat as 409
      // so the student can see a clear error while the situation is fixed.
      return {
        ok: false,
        code: 409,
        error: 'NO_SETUP_STEP_LINKED',
        message: 'This tool-setup lesson is not yet linked to a validation step.',
      }
    }

    const enrollment = await findActiveEnrollment(
      studentId,
      lesson.cohortId as Types.ObjectId,
    )
    if (!enrollment) {
      return { ok: false, code: 403, error: 'NOT_ENROLLED', message: 'Active enrollment required.' }
    }

    return {
      ok: true,
      lesson,
      setupStepId: lesson.setupStepId as Types.ObjectId,
      enrollment,
    }
  }

  // POST /api/v1/student/lessons/:lessonId/tool-setup-submission/presign
  fastify.post<{
    Params: { lessonId: string }
    Body:   { contentType?: string }
  }>(
    '/lessons/:lessonId/tool-setup-submission/presign',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload
      const { lessonId } = request.params
      const { contentType } = request.body ?? {}

      const ctx = await resolveToolSetupContext(studentId, lessonId)
      if (!ctx.ok) return reply.code(ctx.code).send({ error: ctx.error, message: ctx.message })

      // Block while a previous submission is still in flight.
      const existingPending = await StepSubmission.findOne({
        userId: studentId,
        stepId: ctx.setupStepId,
        status: { $in: ['PENDING', 'ML_PROCESSING', 'HUMAN_REVIEW'] },
      })
      if (existingPending) {
        return reply.code(409).send({
          error:   'PENDING_SUBMISSION_EXISTS',
          message: 'A submission is already under review for this lesson.',
        })
      }

      // Daily cap — mirrors the PBA step flow.
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayCount = await StepSubmission.countDocuments({
        userId:    studentId,
        stepId:    ctx.setupStepId,
        createdAt: { $gte: todayStart },
      })
      if (todayCount >= TOOL_SETUP_DAILY_LIMIT) {
        return reply.code(429).send({
          error:   'RATE_LIMIT',
          message: 'Maximum 10 submissions per lesson per day.',
        })
      }

      const totalAttempts = await StepSubmission.countDocuments({
        userId: studentId,
        stepId: ctx.setupStepId,
      })

      const resolvedContentType =
        contentType && TOOL_SETUP_ALLOWED_CONTENT_TYPES.includes(contentType)
          ? contentType
          : 'image/png'

      const s3Key = buildS3Key(studentId, ctx.setupStepId.toString(), totalAttempts + 1)
      const presignedUrl = await getPresignedPutUrl(s3Key, resolvedContentType, 300)

      return reply.send({
        presignedUrl,
        s3Key,
        contentType: resolvedContentType,
      })
    },
  )

  // POST /api/v1/student/lessons/:lessonId/tool-setup-submission
  fastify.post<{
    Params: { lessonId: string }
    Body:   { s3Key: string }
  }>(
    '/lessons/:lessonId/tool-setup-submission',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload
      const { lessonId } = request.params
      const { s3Key } = request.body ?? {}

      if (!s3Key) {
        return reply.code(400).send({ error: 'MISSING_S3_KEY', message: 's3Key is required.' })
      }

      const ctx = await resolveToolSetupContext(studentId, lessonId)
      if (!ctx.ok) return reply.code(ctx.code).send({ error: ctx.error, message: ctx.message })

      // IDOR guard — the key must live under this student + step prefix.
      const keyPrefix = process.env.S3_KEY_PREFIX ? `${process.env.S3_KEY_PREFIX}/` : ''
      const expectedPrefix =
        `${keyPrefix}screenshots/${studentId}/${ctx.setupStepId.toString()}/`
      if (!s3Key.startsWith(expectedPrefix)) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'Invalid S3 key.' })
      }

      const existingPending = await StepSubmission.findOne({
        userId: studentId,
        stepId: ctx.setupStepId,
        status: { $in: ['PENDING', 'ML_PROCESSING', 'HUMAN_REVIEW'] },
      })
      if (existingPending) {
        return reply.code(409).send({
          error:   'PENDING_SUBMISSION_EXISTS',
          message: 'A submission is already under review for this lesson.',
        })
      }

      // Upsert the StudentStep record that the worker keys off of.
      let studentStepDoc = await StudentStep.findOne({
        userId: studentId,
        stepId: ctx.setupStepId,
      })
      if (!studentStepDoc) {
        studentStepDoc = await StudentStep.create({
          userId:      studentId,
          stepId:      ctx.setupStepId,
          status:      'PENDING_REVIEW',
          attempts:    1,
          unlockedAt:  new Date(),
        })
      } else {
        studentStepDoc.status   = 'PENDING_REVIEW'
        studentStepDoc.attempts = (studentStepDoc.attempts ?? 0) + 1
        await studentStepDoc.save()
      }

      const submission = await StepSubmission.create({
        userId:        studentId,
        stepId:        ctx.setupStepId,
        studentStepId: studentStepDoc._id,
        s3Key,
        status:        'PENDING',
      })

      await screenshotQueue.add('validate-screenshot', {
        submissionId: submission.id as string,
        s3Key,
        stepId:       ctx.setupStepId.toString(),
        userId:       studentId,
        // Passed for observability only — the worker ignores unknown fields.
        lessonId,
      })

      return reply.code(201).send({
        submissionId: submission.id,
        status:       'VALIDATING',
      })
    },
  )

  // GET /api/v1/student/lessons/:lessonId/tool-setup-submission/latest
  fastify.get<{ Params: { lessonId: string } }>(
    '/lessons/:lessonId/tool-setup-submission/latest',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload
      const { lessonId } = request.params

      const ctx = await resolveToolSetupContext(studentId, lessonId)
      if (!ctx.ok) return reply.code(ctx.code).send({ error: ctx.error, message: ctx.message })

      const submission = await StepSubmission.findOne(
        { userId: studentId, stepId: ctx.setupStepId },
        null,
        { sort: { createdAt: -1 } },
      )

      if (!submission) {
        return reply.send({ submission: null })
      }

      // Map the PBA-side submission lifecycle into the four states the LMS
      // frontend cares about. PENDING + ML_PROCESSING both mean "the worker
      // is still thinking", so we collapse them to VALIDATING.
      const uiStatus: 'VALIDATING' | 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW' =
        submission.status === 'APPROVED'      ? 'APPROVED'
        : submission.status === 'REJECTED'    ? 'REJECTED'
        : submission.status === 'HUMAN_REVIEW' ? 'UNDER_REVIEW'
        : 'VALIDATING'

      // Surface a presigned GET URL for the screenshot preview — matches the
      // PBA step endpoint contract so admins and students see the same shape.
      let screenshotUrl: string | null = null
      try {
        screenshotUrl = await getPresignedReadUrl(submission.s3Key, 300)
      } catch {
        screenshotUrl = null
      }

      return reply.send({
        submission: {
          id:            submission.id,
          status:        uiStatus,
          rawStatus:     submission.status,
          mlFeedback:    submission.mlFeedback,
          mlScore:       submission.mlScore,
          screenshotUrl,
          createdAt:     submission.createdAt,
          reviewedAt:    submission.reviewedAt,
        },
      })
    },
  )
}
