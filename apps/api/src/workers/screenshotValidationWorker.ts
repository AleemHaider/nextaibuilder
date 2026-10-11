// PBA-150 — ML Screenshot Validation Worker (Claude Vision API)
// PBA-316 — Enriched prompt, mlReasoning field, shared image-utils
// PBA-372 — Startup key-presence check so silent 401s are surfaced immediately
// PBA-373 — Startup health check logging + per-job structured logs
// Processes jobs from screenshot-validation-queue
import { Worker, Queue } from 'bullmq'
import Anthropic from '@anthropic-ai/sdk'
import { bullMQConnection, redis } from '../lib/redis.js'
import { downloadImageAsBase64 } from '../lib/image-utils.js'
import type { ImageMediaType } from '../lib/image-utils.js'
import { StepSubmission } from '../models/StepSubmission.js'
import { StudentStep } from '../models/StudentStep.js'
import { SetupStep } from '../models/SetupStep.js'
import { ActivityLog } from '../models/ActivityLog.js'
import { User } from '../models/User.js'
import { emitSubmissionUpdated } from '../lib/socket.js'
import { checkAndAwardBadges, checkAndAwardCertificate } from '../services/badges.js'
import { sendStepApprovedEmail, sendStepRejectedEmail } from '../services/emailService.js'
import { sendEmail, humanReviewAlertTemplate } from '../lib/email.js'
import { logger } from '../lib/logger.js'

const ML_CONFIDENCE_THRESHOLD = Number(process.env.ML_CONFIDENCE_THRESHOLD ?? 80)
const WORKER_CONCURRENCY = Number(process.env.ML_WORKER_CONCURRENCY ?? 3)
const HUMAN_REVIEW_ALERT_THRESHOLD = parseInt(process.env.HUMAN_REVIEW_ALERT_THRESHOLD ?? '10')

// PBA-393 — Dead letter queue for visibility into exhausted-retry jobs
const dlq = new Queue('screenshot-validation-failed', { connection: bullMQConnection })

// PBA-394 — Check backlog and send admin alert email if threshold exceeded
async function maybeAlertAdmins(): Promise<void> {
  try {
    const backlogCount = await StepSubmission.countDocuments({ status: 'HUMAN_REVIEW' })
    if (backlogCount < HUMAN_REVIEW_ALERT_THRESHOLD) return

    // Debounce: only send once per hour using Redis
    const debounceKey = 'human_review_alert_sent'
    let alreadySent = false
    try {
      alreadySent = !!(await redis.get(debounceKey))
    } catch {
      // Redis unavailable — skip debounce, send the alert anyway
    }
    if (alreadySent) return

    try {
      await redis.set(debounceKey, '1', 'EX', 3600)
    } catch {
      // Best-effort debounce — proceed with sending
    }

    const superAdmins = await User.find({ role: 'SUPER_ADMIN' }, 'email').lean()
    for (const admin of superAdmins) {
      sendEmail(
        admin.email,
        `[PBA] Human Review Backlog Alert — ${backlogCount} submissions pending`,
        humanReviewAlertTemplate(backlogCount, HUMAN_REVIEW_ALERT_THRESHOLD),
      ).catch((err: unknown) =>
        logger.error({ err: err }, '[ML Worker] Failed to send human review alert email:'),
      )
    }
    logger.warn(
      `[ML Worker] HUMAN_REVIEW backlog=${backlogCount} >= threshold=${HUMAN_REVIEW_ALERT_THRESHOLD} — alert sent to ${superAdmins.length} admin(s)`,
    )
  } catch (err) {
    logger.error({ err: err }, '[ML Worker] maybeAlertAdmins error:')
  }
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
})

interface ValidationJobData {
  submissionId: string
  s3Key: string
  stepId: string
  userId: string
}

interface ClaudeValidationResult {
  passed: boolean
  confidence: number
  feedback: string
  reasoning: string
}

async function callClaudeVision(
  base64Image: string,
  mediaType: ImageMediaType,
  step: { title: string; description: string; screenshotCriteria: string; checklist: string[] },
): Promise<ClaudeValidationResult> {
  const systemPrompt = `You are a strict but fair technical setup validator for a developer training program.
A student has uploaded a screenshot to prove they completed a setup step.

Step context:
- Title: ${step.title}
- What they needed to do: ${step.description}
- Required checklist items: ${step.checklist.join(' | ')}
- Screenshot acceptance criteria: ${step.screenshotCriteria}

Your job: determine if the screenshot proves the step is genuinely complete.
Rules:
- Be specific about what you see in the screenshot
- Do not give partial credit — either the evidence is there or it is not
- If the screenshot is blurry, cropped, or does not show the relevant terminal/UI, that is a FAIL
- confidence < 80: you are uncertain — route to human review, do not approve or reject
- confidence >= 80 and passed=false: provide precise, actionable feedback the student can act on immediately

Respond with valid JSON only — no markdown, no preamble:
{
  "passed": true | false,
  "confidence": 0-100,
  "feedback": "Student-facing message: what you saw and what to fix if failed. Max 200 words.",
  "reasoning": "Internal analysis: what you looked for, what was missing, why you decided. Not shown to student."
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: 'Analyse this screenshot and respond with JSON only.',
          },
        ],
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  // Strip potential markdown code fences
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  try {
    return JSON.parse(cleaned) as ClaudeValidationResult
  } catch {
    throw new Error(`Claude returned unparseable JSON: ${cleaned.slice(0, 200)}`)
  }
}

// Exported for unit tests — invoke directly without spinning up Redis/BullMQ.
// `jobId` is informational; pass any string in tests.
export async function processValidationJob(
  jobId: string,
  data: ValidationJobData,
): Promise<void> {
  const { submissionId, s3Key, stepId, userId } = data
  const startMs = Date.now()

  fastify_log(`[ML Worker] Job ${jobId} START — submission=${submissionId} step=${stepId} user=${userId}`)

  // 1. Fetch and verify submission still exists and is PENDING
  const submission = await StepSubmission.findById(submissionId)
  if (!submission) {
    fastify_log(`[ML Worker] Submission ${submissionId} not found — skipping`)
    return
  }
  // Reclaim stalled ML_PROCESSING jobs. If the worker crashed after the
  // ML_PROCESSING transition below, BullMQ redelivers the job; without allowing
  // reprocessing here the redelivery would hit this guard, no-op, and the
  // submission would be stranded in ML_PROCESSING forever (student and admin
  // both 409-blocked). Only genuinely terminal states are skipped.
  if (submission.status !== 'PENDING' && submission.status !== 'ML_PROCESSING') {
    fastify_log(`[ML Worker] Submission ${submissionId} in terminal state (${submission.status}) — skipping`)
    return
  }

  // 2. Update to ML_PROCESSING (idempotent on a reclaimed job)
  submission.status = 'ML_PROCESSING'
  await submission.save()

  // 3. Fetch step for full context
  const step = await SetupStep.findById(stepId)
  if (!step) throw new Error(`Step ${stepId} not found`)

  // 4. Download screenshot from S3
  let base64Image: string
  let detectedMediaType: ImageMediaType
  try {
    const result = await downloadImageAsBase64(s3Key)
    base64Image = result.base64
    detectedMediaType = result.mediaType
  } catch (err) {
    logger.error({ err: err }, `[ML Worker] S3 download failed for ${s3Key}:`)
    throw err
  }

  // 5. Call Claude Vision with retries
  let result: ClaudeValidationResult | null = null
  let claudeError: Error | null = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      result = await callClaudeVision(base64Image, detectedMediaType, {
        title: step.title,
        description: step.description,
        screenshotCriteria: step.screenshotCriteria,
        checklist: step.checklist,
      })
      break
    } catch (err) {
      claudeError = err instanceof Error ? err : new Error(String(err))
      logger.warn(`[ML Worker] [Claude Error] attempt ${attempt}/3 failed: ${claudeError.message}`)
      if (attempt < 3) {
        await new Promise((res) => setTimeout(res, attempt * 2000))
      }
    }
  }

  // 6. Determine final status
  const processingTimeMs = Date.now() - startMs
  let finalStatus: 'APPROVED' | 'REJECTED' | 'HUMAN_REVIEW'

  if (!result || claudeError) {
    finalStatus = 'HUMAN_REVIEW'
    submission.mlFeedback = 'Automated validation unavailable — pending human review.'
    submission.mlScore = null
  } else if (result.confidence >= ML_CONFIDENCE_THRESHOLD && result.passed) {
    finalStatus = 'APPROVED'
  } else if (result.confidence >= ML_CONFIDENCE_THRESHOLD && !result.passed) {
    finalStatus = 'REJECTED'
  } else {
    finalStatus = 'HUMAN_REVIEW'
  }

  if (result) {
    submission.mlScore = result.confidence
    submission.mlFeedback = result.feedback
    submission.mlReasoning = result.reasoning
  }
  submission.status = finalStatus
  submission.reviewedAt = new Date()
  await submission.save()

  if (finalStatus === 'HUMAN_REVIEW') {
    maybeAlertAdmins().catch((err: unknown) =>
      logger.error({ err: err }, '[ML Worker] maybeAlertAdmins fire-and-forget error:'),
    )
  }

  // 7. If APPROVED — update StudentStep to COMPLETE
  if (finalStatus === 'APPROVED') {
    // PBA-397: Guard against stale submissions that predate a progress reset
    const userForReset = await User.findById(submission.userId, { progressResetAt: 1 }).lean()
    if (userForReset?.progressResetAt && submission.createdAt <= userForReset.progressResetAt) {
      fastify_log(`[ml-worker] Skipping stale submission ${submission._id} — predates reset at ${userForReset.progressResetAt}`)
      return
    }

    await StudentStep.findOneAndUpdate(
      { userId, stepId },
      { status: 'COMPLETE', completedAt: new Date() },
      { upsert: true },
    )

    checkAndAwardBadges(userId).catch((err) =>
      logger.error({ err: err }, `[ML Worker] checkAndAwardBadges failed for user ${userId}:`),
    )
    checkAndAwardCertificate(userId).catch((err) =>
      logger.error({ err: err }, `[ML Worker] checkAndAwardCertificate failed for user ${userId}:`),
    )

    sendStepApprovedEmail(userId, step.title).catch((err) =>
      logger.error({ err: err }, `[ML Worker] sendStepApprovedEmail failed for user ${userId}:`),
    )

    ActivityLog.create({
      userId,
      actorId:   null,
      actorRole: 'system',
      type:      'screenshot_approved',
      metadata:  { stepId, stepOrder: step.order, submissionId, mlScore: result?.confidence ?? null },
    }).catch((err: unknown) =>
      logger.error({ err: err }, `[ML Worker] screenshot_approved: failed to write ActivityLog for ${submissionId}:`),
    )
    ActivityLog.create({
      userId,
      actorId:   null,
      actorRole: 'system',
      type:      'step_completed',
      metadata:  { stepId, stepOrder: step.order },
    }).catch((err: unknown) =>
      logger.error({ err: err }, `[ML Worker] step_completed: failed to write ActivityLog for user ${userId}:`),
    )
  }

  if (finalStatus === 'REJECTED') {
    const feedback = result?.feedback ?? 'Your submission did not meet the requirements.'
    sendStepRejectedEmail(userId, step.title, feedback).catch((err) =>
      logger.error({ err: err }, `[ML Worker] sendStepRejectedEmail failed for user ${userId}:`),
    )

    ActivityLog.create({
      userId,
      actorId:   null,
      actorRole: 'system',
      type:      'screenshot_rejected',
      metadata:  { stepId, stepOrder: step.order, submissionId, mlFeedback: result?.feedback ?? null },
    }).catch((err: unknown) =>
      logger.error({ err: err }, `[ML Worker] screenshot_rejected: failed to write ActivityLog for ${submissionId}:`),
    )
  }

  // 8. Emit real-time event to student and admin
  emitSubmissionUpdated(userId, {
    submissionId,
    status: finalStatus,
    mlFeedback: submission.mlFeedback,
    mlScore: submission.mlScore,
  })

  // 9. Log result
  const reason = !result || claudeError
    ? `[Claude Error] ${claudeError?.message ?? 'unknown'}`
    : result.confidence < ML_CONFIDENCE_THRESHOLD
      ? `low confidence (${result.confidence})`
      : `confidence=${result.confidence} passed=${result.passed}`
  logger.info(
    `[ML Worker] Job ${jobId} DONE — submission=${submissionId} step=${stepId} user=${userId} ` +
    `status=${finalStatus} reason="${reason}" time=${processingTimeMs}ms`,
  )
}

export async function startScreenshotValidationWorker() {
  // ── PBA-372 / PBA-373: Startup health checks ────────────────────────────────
  const hasAnthropicKey = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '')
  logger.info(`[ML Worker] ANTHROPIC_API_KEY: ${hasAnthropicKey ? 'SET' : 'MISSING ⚠️'}`)

  if (!hasAnthropicKey) {
    const msg = '[ML Worker] WARNING: ANTHROPIC_API_KEY is not set. All submissions will route to HUMAN_REVIEW until this is fixed.'
    logger.warn(msg)
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production') {
      // In development, make the misconfiguration visible but do not crash
      logger.warn('[ML Worker] Set ANTHROPIC_API_KEY in apps/api/.env to enable AI validation.')
    }
  }

  // Check Redis connectivity on startup
  try {
    const pong = await redis.ping()
    logger.info(`[ML Worker] Redis: ${pong === 'PONG' ? 'CONNECTED ✓' : `unexpected response: ${pong}`}`)
  } catch (err) {
    logger.error({ err: err }, '[ML Worker] Redis: UNREACHABLE ⚠️ — BullMQ jobs will not be processed:')
  }

  const worker = new Worker<ValidationJobData>(
    'screenshot-validation-queue',
    (job) => processValidationJob(String(job.id ?? ''), job.data),
    {
      connection: bullMQConnection,
      concurrency: WORKER_CONCURRENCY,
      settings: {
        backoffStrategy: (attemptsMade: number) => attemptsMade * 3000,
      },
    },
  )

  // PBA-393 — On exhausted retries: move to HUMAN_REVIEW + add to DLQ for visibility
  // PBA-394 — After any HUMAN_REVIEW transition, check backlog and alert admins if needed
  worker.on('failed', async (job, err) => {
    if (!job) return
    try {
      await StepSubmission.findByIdAndUpdate(job.data.submissionId, {
        $set: {
          status: 'HUMAN_REVIEW',
          mlFeedback: 'Automated validation failed after retries — awaiting manual review',
          reviewedAt: new Date(),
        },
      })
      // Add to DLQ for operational visibility
      await dlq.add('failed-job', { originalJobId: job.id, jobData: job.data, errorMessage: err.message })
      logger.error(err, `[ML Worker] Job ${job.id} exhausted retries, moved to HUMAN_REVIEW`)
      // Check if admin alert is needed
      await maybeAlertAdmins()
    } catch (handlerErr) {
      logger.error({ err: handlerErr }, '[ML Worker] failed-event handler error:')
    }
  })

  logger.info(
    `[ML Worker] Started — concurrency=${WORKER_CONCURRENCY}, threshold=${ML_CONFIDENCE_THRESHOLD}, ` +
    `anthropicKey=${hasAnthropicKey ? 'present' : 'MISSING'}`,
  )
  return worker
}

// Simple logger shim (Fastify logger not available in workers)
function fastify_log(msg: string) {
  logger.info(msg)
}
