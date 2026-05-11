/**
 * Integration test for scheduledEmailWorker (audit P1 #12).
 *
 * Exercises the daily-cron `runDailyEmailCheck` branches:
 *   - No active cohorts → exits early
 *   - No memberships → exits early
 *   - Active student (≤2 days idle) → no email
 *   - 3-6 days idle → nudge email + no notification
 *   - 7+ days idle → urgency email + DEADLINE_WARNING notification
 *   - Falls back to latest StepSubmission.createdAt when User.lastActiveAt unset
 *   - Falls back to joinedAt when neither lastActiveAt nor submissions exist
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

const state = vi.hoisted(() => ({
  cohorts:       [] as Array<{ _id: import('mongoose').Types.ObjectId; status: string; endDate: Date; name: string }>,
  memberships:   [] as Array<{ userId: import('mongoose').Types.ObjectId; cohortId: import('mongoose').Types.ObjectId; completionStatus?: string; joinedAt?: Date }>,
  users:         new Map<string, { lastActiveAt?: Date | null }>(),
  submissions:   new Map<string, Date>(), // latest createdAt per userId
  sendNudge:     vi.fn().mockResolvedValue(undefined),
  sendUrgency:   vi.fn().mockResolvedValue(undefined),
  createNotice:  vi.fn().mockResolvedValue(undefined),
  now:           new Date('2026-05-11T12:00:00Z'),
}))

vi.mock('bullmq', () => ({
  Worker: class { on = vi.fn(); constructor(_n: string, _h: unknown, _o?: unknown) {} },
  Queue:  class { add = vi.fn().mockResolvedValue(undefined); constructor(_n: string, _o?: unknown) {} },
}))

vi.mock('../lib/redis.js', () => ({
  redis: { on: vi.fn(), duplicate: vi.fn() },
  bullMQConnection: { host: 'localhost', port: 6379 },
}))

vi.mock('../services/emailService.js', () => ({
  sendNudgeEmail:   (...args: unknown[]) => state.sendNudge(...args),
  sendUrgencyEmail: (...args: unknown[]) => state.sendUrgency(...args),
}))

vi.mock('../services/notificationService.js', () => ({
  createNotification: (...args: unknown[]) => state.createNotice(...args),
}))

vi.mock('../models/Cohort.js', () => ({
  Cohort: {
    find: (_filter: unknown) => ({
      lean: async () => state.cohorts,
    }),
  },
}))

vi.mock('../models/CohortMembership.js', () => ({
  CohortMembership: {
    find: (_filter: unknown) => ({
      lean: async () => state.memberships,
    }),
  },
}))

vi.mock('../models/User.js', () => ({
  User: {
    findById: (id: import('mongoose').Types.ObjectId | string, _proj?: unknown) => ({
      lean: async () => state.users.get(id.toString()) ?? null,
    }),
  },
}))

vi.mock('../models/StepSubmission.js', () => ({
  StepSubmission: {
    findOne: (filter: { userId: import('mongoose').Types.ObjectId }) => ({
      lean: async () => {
        const createdAt = state.submissions.get(filter.userId.toString())
        return createdAt ? { createdAt } : null
      },
    }),
  },
}))

import { runDailyEmailCheck } from '../workers/scheduledEmailWorker.js'

// ── Helpers ───────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(state.now.getTime() - n * 24 * 60 * 60 * 1000)
}

beforeEach(() => {
  state.cohorts.length = 0
  state.memberships.length = 0
  state.users.clear()
  state.submissions.clear()
  state.sendNudge.mockClear()
  state.sendUrgency.mockClear()
  state.createNotice.mockClear()
  vi.useFakeTimers()
  vi.setSystemTime(state.now)
})

function seedCohort(opts: { endDaysFromNow?: number; name?: string } = {}): import('mongoose').Types.ObjectId {
  const _id = new Types.ObjectId()
  state.cohorts.push({
    _id,
    status:  'ACTIVE',
    name:    opts.name ?? 'Test Cohort',
    endDate: new Date(state.now.getTime() + (opts.endDaysFromNow ?? 30) * 24 * 60 * 60 * 1000),
  })
  return _id
}

function seedMembership(opts: {
  userId?: import('mongoose').Types.ObjectId
  cohortId: import('mongoose').Types.ObjectId
  joinedAt?: Date
} ): import('mongoose').Types.ObjectId {
  const userId = opts.userId ?? new Types.ObjectId()
  state.memberships.push({
    userId,
    cohortId: opts.cohortId,
    completionStatus: 'IN_PROGRESS',
    ...(opts.joinedAt ? { joinedAt: opts.joinedAt } : {}),
  })
  return userId
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('scheduledEmailWorker — runDailyEmailCheck', () => {

  it('exits early when there are no active cohorts', async () => {
    await runDailyEmailCheck()
    expect(state.sendNudge).not.toHaveBeenCalled()
    expect(state.sendUrgency).not.toHaveBeenCalled()
  })

  it('exits early when there are no active memberships', async () => {
    seedCohort()
    await runDailyEmailCheck()
    expect(state.sendNudge).not.toHaveBeenCalled()
    expect(state.sendUrgency).not.toHaveBeenCalled()
  })

  it('skips when student was active within the last 2 days', async () => {
    const cohortId = seedCohort()
    const userId = seedMembership({ cohortId })
    state.users.set(userId.toString(), { lastActiveAt: daysAgo(1) })

    await runDailyEmailCheck()

    expect(state.sendNudge).not.toHaveBeenCalled()
    expect(state.sendUrgency).not.toHaveBeenCalled()
  })

  it('sends nudge for 3-6 days idle, no notification', async () => {
    const cohortId = seedCohort()
    const userId = seedMembership({ cohortId })
    state.users.set(userId.toString(), { lastActiveAt: daysAgo(5) })

    await runDailyEmailCheck()

    expect(state.sendNudge).toHaveBeenCalledOnce()
    expect(state.sendNudge).toHaveBeenCalledWith(userId.toString(), 5)
    expect(state.sendUrgency).not.toHaveBeenCalled()
    expect(state.createNotice).not.toHaveBeenCalled()
  })

  it('sends urgency + DEADLINE_WARNING notification for 7+ days idle', async () => {
    const cohortId = seedCohort({ endDaysFromNow: 14, name: 'Spring 2026' })
    const userId = seedMembership({ cohortId })
    state.users.set(userId.toString(), { lastActiveAt: daysAgo(10) })

    await runDailyEmailCheck()

    expect(state.sendUrgency).toHaveBeenCalledOnce()
    const urgencyCall = state.sendUrgency.mock.calls[0]!
    expect(urgencyCall[0]).toBe(userId.toString())
    expect(urgencyCall[1]).toMatch(/\d+ \w+ 2026/)

    expect(state.createNotice).toHaveBeenCalledOnce()
    const note = state.createNotice.mock.calls[0]![0] as Record<string, unknown>
    expect(note['type']).toBe('DEADLINE_WARNING')
    expect(note['userId']).toBe(userId.toString())
    expect(note['linkPath']).toBe('/steps')

    expect(state.sendNudge).not.toHaveBeenCalled()
  })

  it('falls back to latest StepSubmission.createdAt when User.lastActiveAt is unset', async () => {
    const cohortId = seedCohort()
    const userId = seedMembership({ cohortId })
    state.users.set(userId.toString(), { lastActiveAt: null })
    state.submissions.set(userId.toString(), daysAgo(4))

    await runDailyEmailCheck()

    expect(state.sendNudge).toHaveBeenCalledOnce()
    expect(state.sendNudge).toHaveBeenCalledWith(userId.toString(), 4)
  })

  it('falls back to membership.joinedAt when neither lastActiveAt nor submissions exist', async () => {
    const cohortId = seedCohort()
    const userId = seedMembership({ cohortId, joinedAt: daysAgo(8) })
    state.users.set(userId.toString(), {})

    await runDailyEmailCheck()

    // 8 days since enrollment with no activity ⇒ urgency, not nudge.
    expect(state.sendUrgency).toHaveBeenCalledOnce()
  })

  it('skips memberships whose user record has been deleted', async () => {
    const cohortId = seedCohort()
    seedMembership({ cohortId })
    // No state.users entry — User.findById returns null

    await runDailyEmailCheck()

    expect(state.sendNudge).not.toHaveBeenCalled()
    expect(state.sendUrgency).not.toHaveBeenCalled()
  })
})
