/**
 * Integration test for screenshotValidationWorker (audit P1 #12 — last gap).
 *
 * Exercises `processValidationJob` directly with mocked Anthropic + S3 +
 * Mongoose models. Covers:
 *   - Submission not found / not PENDING → skip
 *   - High-confidence pass → APPROVED + StudentStep upsert + badge/certificate
 *     + email + 2× ActivityLog + emit
 *   - High-confidence fail → REJECTED + rejection email + ActivityLog
 *   - Low confidence → HUMAN_REVIEW (no email, no StudentStep update)
 *   - All 3 Claude calls throw → HUMAN_REVIEW with fallback feedback
 *   - Stale submission (predates progressResetAt) → early exit after marking APPROVED
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

// ── Hoisted shared state ──────────────────────────────────────────────────
const state = vi.hoisted(() => {
  const { Types: T } = require('mongoose') as { Types: typeof import('mongoose').Types }
  return {
    submissions:   new Map<string, Record<string, unknown> & { save: () => Promise<void> }>(),
    steps:         new Map<string, Record<string, unknown>>(),
    studentSteps:  [] as Array<Record<string, unknown>>,
    users:         new Map<string, Record<string, unknown>>(),
    activityLogs:  [] as Array<Record<string, unknown>>,
    // mocked external collaborators
    anthropicCreate: vi.fn(),
    downloadImage:   vi.fn(),
    emit:            vi.fn(),
    sendApproved:    vi.fn().mockResolvedValue(undefined),
    sendRejected:    vi.fn().mockResolvedValue(undefined),
    awardBadges:     vi.fn().mockResolvedValue(undefined),
    awardCert:       vi.fn().mockResolvedValue(undefined),
    T,
  }
})

vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    messages = { create: (args: unknown) => state.anthropicCreate(args) }
    constructor(_opts: unknown) {}
  },
}))

vi.mock('bullmq', () => ({
  Worker: class { on = vi.fn(); constructor(_n: string, _h: unknown, _o?: unknown) {} },
  Queue:  class { add = vi.fn().mockResolvedValue(undefined); constructor(_n: string, _o?: unknown) {} },
}))

vi.mock('../lib/redis.js', () => ({
  redis: { on: vi.fn(), duplicate: vi.fn(), ping: vi.fn().mockResolvedValue('PONG'), get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
  bullMQConnection: { host: 'localhost', port: 6379 },
}))

vi.mock('../lib/image-utils.js', () => ({
  downloadImageAsBase64: (...args: unknown[]) => state.downloadImage(...args),
}))

vi.mock('../lib/socket.js', () => ({
  emitSubmissionUpdated: (...args: unknown[]) => state.emit(...args),
}))

vi.mock('../services/badges.js', () => ({
  checkAndAwardBadges:     (...args: unknown[]) => state.awardBadges(...args),
  checkAndAwardCertificate: (...args: unknown[]) => state.awardCert(...args),
}))

vi.mock('../services/emailService.js', () => ({
  sendStepApprovedEmail: (...args: unknown[]) => state.sendApproved(...args),
  sendStepRejectedEmail: (...args: unknown[]) => state.sendRejected(...args),
}))

vi.mock('../lib/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  humanReviewAlertTemplate: vi.fn().mockReturnValue('<html/>'),
}))

vi.mock('../models/StepSubmission.js', () => ({
  StepSubmission: {
    findById: (id: unknown) => Promise.resolve(state.submissions.get(String(id)) ?? null),
    findByIdAndUpdate: vi.fn().mockResolvedValue(null),
    countDocuments: vi.fn().mockResolvedValue(0),
  },
}))

vi.mock('../models/SetupStep.js', () => ({
  SetupStep: {
    findById: (id: unknown) => Promise.resolve(state.steps.get(String(id)) ?? null),
  },
}))

vi.mock('../models/StudentStep.js', () => ({
  StudentStep: {
    findOneAndUpdate: vi.fn(async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      state.studentSteps.push({ ...filter, ...update })
    }),
  },
}))

vi.mock('../models/ActivityLog.js', () => ({
  ActivityLog: {
    create: vi.fn(async (payload: Record<string, unknown>) => {
      state.activityLogs.push(payload)
    }),
  },
}))

vi.mock('../models/User.js', () => ({
  User: {
    findById: (id: unknown, _proj?: unknown) => ({
      lean: async () => state.users.get(String(id)) ?? null,
    }),
    find: vi.fn().mockReturnValue({ lean: async () => [] }),
  },
}))

import { processValidationJob } from '../workers/screenshotValidationWorker.js'

// ── Test helpers ──────────────────────────────────────────────────────────

function seedSubmission(opts: { status?: string; createdAt?: Date; userId?: import('mongoose').Types.ObjectId } = {}) {
  const _id = new Types.ObjectId()
  const doc = {
    _id,
    status:    opts.status ?? 'PENDING',
    createdAt: opts.createdAt ?? new Date('2026-05-11T10:00:00Z'),
    userId:    opts.userId ?? new Types.ObjectId(),
    mlScore:   null as number | null,
    mlFeedback:  null as string | null,
    mlReasoning: null as string | null,
    reviewedAt:  null as Date | null,
    save: vi.fn(async function () { /* in-memory save */ }),
  }
  state.submissions.set(_id.toString(), doc)
  return doc
}

function seedStep() {
  const _id = new Types.ObjectId()
  state.steps.set(_id.toString(), {
    _id,
    title:       'Set up your dev environment',
    description: 'Install Node 20 and run npm install.',
    screenshotCriteria: 'Terminal showing `node --version` output.',
    checklist:   ['Node 20+', 'npm install ran without errors'],
    order:       1,
  })
  return _id
}

function mockClaudeResponse(body: { passed: boolean; confidence: number; feedback: string; reasoning: string }) {
  state.anthropicCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(body) }],
  })
}

beforeEach(() => {
  state.submissions.clear()
  state.steps.clear()
  state.studentSteps.length = 0
  state.users.clear()
  state.activityLogs.length = 0
  state.anthropicCreate.mockReset()
  state.downloadImage.mockReset().mockResolvedValue({ base64: 'data', mediaType: 'image/png' })
  state.emit.mockClear()
  state.sendApproved.mockClear()
  state.sendRejected.mockClear()
  state.awardBadges.mockClear()
  state.awardCert.mockClear()
})

// ── Tests ─────────────────────────────────────────────────────────────────

describe('screenshotValidationWorker — processValidationJob', () => {

  it('skips when submission no longer exists', async () => {
    await processValidationJob('job-1', {
      submissionId: new Types.ObjectId().toString(),
      s3Key:        'foo.png',
      stepId:       new Types.ObjectId().toString(),
      userId:       new Types.ObjectId().toString(),
    })
    expect(state.anthropicCreate).not.toHaveBeenCalled()
    expect(state.emit).not.toHaveBeenCalled()
  })

  it('skips when submission is no longer PENDING (already processed)', async () => {
    const sub = seedSubmission({ status: 'APPROVED' })
    const stepId = seedStep()

    await processValidationJob('job-2', {
      submissionId: sub._id.toString(),
      s3Key:        'foo.png',
      stepId:       stepId.toString(),
      userId:       sub.userId.toString(),
    })

    expect(state.anthropicCreate).not.toHaveBeenCalled()
    expect(sub.save).not.toHaveBeenCalled()
  })

  it('reclaims a stalled ML_PROCESSING submission (redelivered after a crash) and finalizes it', async () => {
    // Simulates a worker that crashed after the ML_PROCESSING transition; the
    // redelivered job must reprocess, not no-op and strand the submission.
    const sub = seedSubmission({ status: 'ML_PROCESSING' })
    const stepId = seedStep()
    mockClaudeResponse({ passed: true, confidence: 95, feedback: 'ok', reasoning: 'ok' })

    await processValidationJob('job-reclaim', {
      submissionId: sub._id.toString(),
      s3Key:        'foo.png',
      stepId:       stepId.toString(),
      userId:       sub.userId.toString(),
    })

    expect(state.anthropicCreate).toHaveBeenCalled()
    expect(sub.status).toBe('APPROVED')
  })

  it('high-confidence pass → APPROVED + StudentStep upsert + email + badges + 2× ActivityLog + emit', async () => {
    const sub = seedSubmission()
    const stepId = seedStep()
    mockClaudeResponse({ passed: true, confidence: 95, feedback: 'Looks great!', reasoning: 'Node 20 visible in terminal.' })

    await processValidationJob('job-3', {
      submissionId: sub._id.toString(),
      s3Key:        'foo.png',
      stepId:       stepId.toString(),
      userId:       sub.userId.toString(),
    })

    expect(sub.status).toBe('APPROVED')
    expect(sub.mlScore).toBe(95)
    expect(sub.mlFeedback).toBe('Looks great!')
    expect(sub.mlReasoning).toBe('Node 20 visible in terminal.')

    // StudentStep upserted
    expect(state.studentSteps).toHaveLength(1)
    expect(state.studentSteps[0]).toMatchObject({
      userId: sub.userId.toString(),
      stepId: stepId.toString(),
      status: 'COMPLETE',
    })

    // Fire-and-forget collaborators all hit
    expect(state.awardBadges).toHaveBeenCalledWith(sub.userId.toString())
    expect(state.awardCert).toHaveBeenCalledWith(sub.userId.toString())
    expect(state.sendApproved).toHaveBeenCalledWith(sub.userId.toString(), 'Set up your dev environment')

    // Two activity log writes: screenshot_approved + step_completed
    expect(state.activityLogs).toHaveLength(2)
    expect(state.activityLogs.map((l) => l['type'])).toEqual(
      expect.arrayContaining(['screenshot_approved', 'step_completed']),
    )

    // Real-time emit
    expect(state.emit).toHaveBeenCalledOnce()
    expect(state.emit).toHaveBeenCalledWith(
      sub.userId.toString(),
      expect.objectContaining({
        submissionId: sub._id.toString(),
        status:       'APPROVED',
        mlScore:      95,
      }),
    )
  })

  it('high-confidence fail → REJECTED + rejection email + ActivityLog, no StudentStep update', async () => {
    const sub = seedSubmission()
    const stepId = seedStep()
    mockClaudeResponse({ passed: false, confidence: 92, feedback: 'Terminal output not visible.', reasoning: 'Cropped image.' })

    await processValidationJob('job-4', {
      submissionId: sub._id.toString(),
      s3Key:        'foo.png',
      stepId:       stepId.toString(),
      userId:       sub.userId.toString(),
    })

    expect(sub.status).toBe('REJECTED')
    expect(state.studentSteps).toHaveLength(0)
    expect(state.sendApproved).not.toHaveBeenCalled()
    expect(state.sendRejected).toHaveBeenCalledWith(
      sub.userId.toString(),
      'Set up your dev environment',
      'Terminal output not visible.',
    )
    expect(state.activityLogs).toHaveLength(1)
    expect(state.activityLogs[0]).toMatchObject({ type: 'screenshot_rejected' })
    expect(state.awardBadges).not.toHaveBeenCalled()
  })

  it('low confidence (< threshold) → HUMAN_REVIEW, no emails, no StudentStep update', async () => {
    const sub = seedSubmission()
    const stepId = seedStep()
    mockClaudeResponse({ passed: true, confidence: 60, feedback: 'Maybe?', reasoning: 'Blurry.' })

    await processValidationJob('job-5', {
      submissionId: sub._id.toString(),
      s3Key:        'foo.png',
      stepId:       stepId.toString(),
      userId:       sub.userId.toString(),
    })

    expect(sub.status).toBe('HUMAN_REVIEW')
    expect(sub.mlScore).toBe(60)
    expect(state.studentSteps).toHaveLength(0)
    expect(state.sendApproved).not.toHaveBeenCalled()
    expect(state.sendRejected).not.toHaveBeenCalled()
    expect(state.activityLogs).toHaveLength(0)

    // Still emits the status change so admin UI updates
    expect(state.emit).toHaveBeenCalledWith(
      sub.userId.toString(),
      expect.objectContaining({ status: 'HUMAN_REVIEW' }),
    )
  })

  it('Claude throws on all 3 attempts → HUMAN_REVIEW with fallback feedback', async () => {
    const sub = seedSubmission()
    const stepId = seedStep()
    // 3 retries inside the worker — make all of them reject
    state.anthropicCreate.mockRejectedValue(new Error('API timeout'))

    await processValidationJob('job-6', {
      submissionId: sub._id.toString(),
      s3Key:        'foo.png',
      stepId:       stepId.toString(),
      userId:       sub.userId.toString(),
    })

    expect(state.anthropicCreate).toHaveBeenCalledTimes(3)
    expect(sub.status).toBe('HUMAN_REVIEW')
    expect(sub.mlFeedback).toBe('Automated validation unavailable — pending human review.')
    expect(sub.mlScore).toBeNull()
    expect(state.studentSteps).toHaveLength(0)
    expect(state.activityLogs).toHaveLength(0)
  }, 20_000)

  it('APPROVED but submission predates progressResetAt → early exit (PBA-397 stale guard)', async () => {
    const userId = new Types.ObjectId()
    const sub = seedSubmission({
      userId,
      createdAt: new Date('2026-05-01T10:00:00Z'),
    })
    const stepId = seedStep()
    state.users.set(userId.toString(), {
      // User was reset AFTER the submission was created — submission is stale
      progressResetAt: new Date('2026-05-05T10:00:00Z'),
    })
    mockClaudeResponse({ passed: true, confidence: 95, feedback: 'OK', reasoning: 'OK' })

    await processValidationJob('job-7', {
      submissionId: sub._id.toString(),
      s3Key:        'foo.png',
      stepId:       stepId.toString(),
      userId:       userId.toString(),
    })

    // Submission was still updated to APPROVED, but the side-effects below
    // the reset guard never fire.
    expect(sub.status).toBe('APPROVED')
    expect(state.studentSteps).toHaveLength(0)
    expect(state.awardBadges).not.toHaveBeenCalled()
    expect(state.awardCert).not.toHaveBeenCalled()
    expect(state.sendApproved).not.toHaveBeenCalled()
    expect(state.activityLogs).toHaveLength(0)
  })

  it('handles claude response wrapped in markdown code fences', async () => {
    const sub = seedSubmission()
    const stepId = seedStep()
    state.anthropicCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: '```json\n{"passed": true, "confidence": 90, "feedback": "ok", "reasoning": "ok"}\n```',
      }],
    })

    await processValidationJob('job-8', {
      submissionId: sub._id.toString(),
      s3Key:        'foo.png',
      stepId:       stepId.toString(),
      userId:       sub.userId.toString(),
    })

    expect(sub.status).toBe('APPROVED')
    expect(sub.mlScore).toBe(90)
  })
})
