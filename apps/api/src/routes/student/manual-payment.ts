// FIR-46 — Student manual payment receipt upload
// POST /api/v1/student/manual-payment/request
//
// Student submits a receipt image/PDF for manual review.
// File is uploaded to S3 (or local dev fallback), a ManualPaymentRequest
// document is created with status PENDING, and an email-notifications job
// is enqueued to alert admins.

import type { FastifyInstance } from 'fastify'
import { Queue } from 'bullmq'
import { Types } from 'mongoose'
import { requireStudent } from '../../middleware/authenticate.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { Cohort } from '../../models/Cohort.js'
import { PaymentPlan } from '../../models/PaymentPlan.js'
import { Enrollment } from '../../models/Enrollment.js'
import { ManualPaymentRequest } from '../../models/ManualPaymentRequest.js'
import {
  uploadToS3,
  buildManualReceiptS3Key,
  getPresignedReadUrl,
} from '../../lib/s3.js'
import { bullMQConnection } from '../../lib/redis.js'

// ── Allowed receipt MIME types ─────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// ── BullMQ queue ──────────────────────────────────────────────────────────
const emailNotificationsQueue = new Queue('email-notifications', {
  connection: bullMQConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
})

// ── Route plugin ──────────────────────────────────────────────────────────
export async function studentManualPaymentRoutes(fastify: FastifyInstance) {

  // POST /request — student submits a receipt
  // multipart/form-data: cohortId (required), paymentPlanId (optional),
  //                      note (optional, max 500 chars), file (required)
  fastify.post(
    '/request',
    {
      preHandler: requireStudent,
      // @fastify/multipart respects bodyLimit set in addContentTypeParser;
      // we guard size inline after reading the file part.
    },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload

      // ── Parse multipart ────────────────────────────────────────────────
      // We use request.parts() to stream all parts and collect them.
      // File part must be processed before sending a reply.
      const parts = request.parts({ limits: { fileSize: MAX_FILE_SIZE } })

      let cohortIdStr:      string | undefined
      let paymentPlanIdStr: string | undefined
      let note:             string | undefined
      let fileBuffer:       Buffer | undefined
      let fileMimeType:     string | undefined
      let fileOriginalName: string | undefined

      for await (const part of parts) {
        if (part.type === 'file') {
          // Validate MIME type before buffering
          if (!ALLOWED_MIME_TYPES.has(part.mimetype)) {
            // Drain the stream to prevent connection hanging
            await part.toBuffer().catch(() => undefined)
            return reply.code(400).send({
              error:   'INVALID_FILE_TYPE',
              message: 'Receipt must be a JPEG, PNG, WebP, or PDF file.',
            })
          }

          // Buffer the file — @fastify/multipart throws if fileSize limit exceeded
          try {
            fileBuffer       = await part.toBuffer()
          } catch {
            return reply.code(413).send({
              error:   'FILE_TOO_LARGE',
              message: 'Receipt file must not exceed 10 MB.',
            })
          }

          // Double-check size after buffering (handles edge cases)
          if (fileBuffer.length > MAX_FILE_SIZE) {
            return reply.code(413).send({
              error:   'FILE_TOO_LARGE',
              message: 'Receipt file must not exceed 10 MB.',
            })
          }

          fileMimeType     = part.mimetype
          fileOriginalName = part.filename ?? `receipt-${Date.now()}`
        } else {
          // Non-file fields: @fastify/multipart types these as MultipartValue
          // where .value is a string. Cast is safe — all our fields are text.
          const field = part as unknown as { fieldname: string; value: string }
          const value = field.value ?? ''
          if (field.fieldname === 'cohortId')      cohortIdStr      = value
          if (field.fieldname === 'paymentPlanId') paymentPlanIdStr = value
          if (field.fieldname === 'note')          note             = value
        }
      }

      // ── Required field validation ──────────────────────────────────────
      if (!cohortIdStr) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: 'cohortId is required.',
        })
      }

      if (!fileBuffer || !fileMimeType) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: 'A receipt file is required.',
        })
      }

      // Optional note length guard
      if (note && note.length > 500) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: 'Note must not exceed 500 characters.',
        })
      }

      // ── ObjectId format validation ─────────────────────────────────────
      if (!Types.ObjectId.isValid(cohortIdStr)) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: 'Invalid cohortId.',
        })
      }

      if (paymentPlanIdStr && !Types.ObjectId.isValid(paymentPlanIdStr)) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: 'Invalid paymentPlanId.',
        })
      }

      const cohortId = new Types.ObjectId(cohortIdStr)

      // ── Cohort must be published ───────────────────────────────────────
      const cohort = await Cohort.findOne({ _id: cohortId, isPublished: true }).lean()
      if (!cohort) {
        return reply.code(404).send({
          error:   'NOT_FOUND',
          message: 'Cohort not found or not published.',
        })
      }

      // ── Guard: student must not already have an ACTIVE enrollment ─────
      const existingEnrollment = await Enrollment.findOne({
        studentId: new Types.ObjectId(studentId),
        cohortId,
        status: 'ACTIVE',
      }).lean()

      if (existingEnrollment) {
        return reply.code(409).send({
          error:   'ALREADY_ENROLLED',
          message: 'You are already enrolled in this cohort.',
        })
      }

      // ── Guard: don't allow stacking multiple pending receipts ──────────
      // Without this a student could submit several receipts for the same
      // cohort, each independently approvable (double enrollment / revenue).
      const existingPending = await ManualPaymentRequest.findOne({
        studentId: new Types.ObjectId(studentId),
        cohortId,
        status:    'PENDING',
      }).lean()
      if (existingPending) {
        return reply.code(409).send({
          error:   'REQUEST_PENDING',
          message: 'You already have a payment receipt under review for this cohort.',
        })
      }

      // ── Resolve payment plan amount (optional) ─────────────────────────
      let amount: number | undefined
      let planObjectId: Types.ObjectId | undefined

      if (paymentPlanIdStr) {
        planObjectId = new Types.ObjectId(paymentPlanIdStr)
        const plan = await PaymentPlan.findOne({
          _id:      planObjectId,
          cohortId: cohortId,
          isActive: true,
        }).lean()

        if (!plan) {
          return reply.code(404).send({
            error:   'NOT_FOUND',
            message: 'Payment plan not found or not active for this cohort.',
          })
        }

        amount = plan.totalAmount
      }

      // ── Upload receipt to S3 ───────────────────────────────────────────
      const s3Key = buildManualReceiptS3Key(studentId, fileOriginalName ?? `receipt-${Date.now()}`)

      try {
        await uploadToS3(s3Key, fileBuffer, fileMimeType)
      } catch (err) {
        fastify.log.error({ err, studentId, cohortId: cohortIdStr }, '[FIR-46] S3 upload failed')
        return reply.code(500).send({
          error:   'UPLOAD_FAILED',
          message: 'Failed to upload receipt. Please try again.',
        })
      }

      // Generate a 1-hour presigned GET URL for admin preview
      const receiptUrl = await getPresignedReadUrl(s3Key, 3600)

      // ── Create ManualPaymentRequest ────────────────────────────────────
      const manualRequest = await ManualPaymentRequest.create({
        studentId:     new Types.ObjectId(studentId),
        cohortId,
        ...(planObjectId ? { paymentPlanId: planObjectId } : {}),
        s3Key,
        receiptUrl,
        ...(note ? { note: note.trim() } : {}),
        ...(amount !== undefined ? { amount } : {}),
        status: 'PENDING',
      })

      // ── Enqueue admin notification ─────────────────────────────────────
      emailNotificationsQueue.add('manual-payment-submitted', {
        type:        'MANUAL_PAYMENT_SUBMITTED',
        adminNotify: true,
        studentId,
        cohortId:    cohortIdStr,
      }).catch((err: unknown) =>
        fastify.log.error({ err }, '[FIR-46] Failed to enqueue manual-payment-submitted notification'),
      )

      fastify.log.info(
        { requestId: manualRequest._id.toString(), studentId, cohortId: cohortIdStr },
        '[FIR-46] Manual payment request created',
      )

      return reply.code(201).send({
        requestId: manualRequest._id.toString(),
        status:    'PENDING',
        message:   'Your receipt has been submitted. You will be notified within 24–48 hours.',
      })
    },
  )

  // FIR-158 — GET /:requestId
  // Returns the current review status for a student's own manual payment
  // request. Used by the receipt upload page to poll for admin approval.
  fastify.get(
    '/:requestId',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: studentId } = request.user as JwtPayload
      const { requestId } = request.params as { requestId: string }

      if (!Types.ObjectId.isValid(requestId)) {
        return reply.code(400).send({
          error:   'VALIDATION_ERROR',
          message: 'Invalid requestId.',
        })
      }

      const doc = await ManualPaymentRequest.findOne({
        _id:       new Types.ObjectId(requestId),
        studentId: new Types.ObjectId(studentId),
      }).lean()

      if (!doc) {
        return reply.code(404).send({
          error:   'NOT_FOUND',
          message: 'Manual payment request not found.',
        })
      }

      return reply.send({
        requestId:       doc._id.toString(),
        status:          doc.status,
        // Only surface the reason on an actual rejection. The same field is
        // reused to store the admin's internal note on APPROVED requests, so
        // returning it unconditionally leaked that note to the student as an
        // apparent "rejection reason".
        rejectionReason: doc.status === 'REJECTED' ? doc.rejectionReason : null,
        createdAt:       doc.createdAt,
        reviewedAt:      doc.reviewedAt,
      })
    },
  )
}
