/**
 * Integration test for notificationWorker (audit P1 #12).
 *
 * Verifies the discriminated-union dispatcher in `processNotificationJob`:
 *   - All 6 job types route to the correct subject + template
 *   - Each type calls sendEmail exactly once
 *   - Missing user (no email) → warn-and-skip, no email sent
 *   - Unknown job type (defensive default) → warn-and-skip
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  users:     new Map<string, { email: string }>(),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bullmq', () => ({
  Worker: class { on = vi.fn(); constructor(_n: string, _h: unknown, _o?: unknown) {} },
  Queue:  class { add = vi.fn(); constructor(_n: string, _o?: unknown) {} },
}))

vi.mock('../lib/redis.js', () => ({
  redis: { on: vi.fn(), duplicate: vi.fn() },
  bullMQConnection: { host: 'localhost', port: 6379 },
}))

vi.mock('../lib/mailer.js', () => ({
  sendEmail: (...args: unknown[]) => state.sendEmail(...args),
}))

vi.mock('../models/User.js', () => ({
  User: {
    findById: (id: string) => {
      const user = state.users.get(id) ?? null
      return {
        select: () => ({
          lean: async () => user,
        }),
      }
    },
  },
}))

import { processNotificationJob, type NotificationJobData } from '../workers/notificationWorker.js'

beforeEach(() => {
  state.users.clear()
  state.sendEmail.mockClear()
})

function seedUser(id: string, email: string) {
  state.users.set(id, { email })
}

describe('notificationWorker — processNotificationJob dispatcher', () => {

  it('enrollment_confirmed → sends welcome email with cohort + start date', async () => {
    seedUser('u1', 'a@example.com')
    await processNotificationJob({
      type:         'enrollment_confirmed',
      userId:       'u1',
      enrollmentId: 'e1',
      cohortName:   'Fall Cohort',
      startDate:    '2026-09-01',
    })

    expect(state.sendEmail).toHaveBeenCalledOnce()
    const [to, subject, html] = state.sendEmail.mock.calls[0]!
    expect(to).toBe('a@example.com')
    expect(subject).toBe("You're enrolled in Fall Cohort!")
    expect(html).toContain('Fall Cohort')
    expect(html).toContain('2026-09-01')
    expect(html).toContain('Welcome aboard')
  })

  it('receipt_received → sends manual-payment receipt acknowledgement', async () => {
    seedUser('u2', 'b@example.com')
    await processNotificationJob({
      type:       'receipt_received',
      userId:     'u2',
      cohortName: 'Winter Cohort',
    })

    expect(state.sendEmail).toHaveBeenCalledOnce()
    const [, subject, html] = state.sendEmail.mock.calls[0]!
    expect(subject).toBe('Payment receipt received — Winter Cohort')
    expect(html).toContain('24 hours')
  })

  it('manual_approved → sends approval email with start-learning CTA', async () => {
    seedUser('u3', 'c@example.com')
    await processNotificationJob({
      type:       'manual_approved',
      userId:     'u3',
      cohortName: 'Spring Cohort',
    })

    const [, subject, html] = state.sendEmail.mock.calls[0]!
    expect(subject).toBe('Payment approved — Spring Cohort')
    expect(html).toContain('Start Learning')
    expect(html).toContain('full access')
  })

  it('manual_rejected → sends rejection email including reason', async () => {
    seedUser('u4', 'd@example.com')
    await processNotificationJob({
      type:       'manual_rejected',
      userId:     'u4',
      cohortName: 'Summer Cohort',
      reason:     'Receipt does not match payment amount',
    })

    const [, subject, html] = state.sendEmail.mock.calls[0]!
    expect(subject).toBe('Payment review update — Summer Cohort')
    expect(html).toContain('Receipt does not match payment amount')
  })

  it('manual_rejected without reason → uses fallback copy', async () => {
    seedUser('u5', 'e@example.com')
    await processNotificationJob({
      type:       'manual_rejected',
      userId:     'u5',
      cohortName: 'Cohort X',
    })

    const html = state.sendEmail.mock.calls[0]![2] as string
    expect(html).toContain('Please contact support for more information.')
  })

  it('re_engagement_nudge → subject includes completion percentage', async () => {
    seedUser('u6', 'f@example.com')
    await processNotificationJob({
      type:                 're_engagement_nudge',
      userId:               'u6',
      cohortName:           'Cohort Y',
      completionPercentage: 64,
      nudgeType:            '7day',
    })

    const [, subject, html] = state.sendEmail.mock.calls[0]!
    expect(subject).toContain('64%')
    expect(subject).toContain('Cohort Y')
    expect(html).toContain('64%')
  })

  it('broadcast → uses the provided subject + html verbatim', async () => {
    seedUser('u7', 'g@example.com')
    const customHtml = '<h1>Marketing Blast</h1>'
    await processNotificationJob({
      type:    'broadcast',
      userId:  'u7',
      subject: 'New feature: drip content!',
      html:    customHtml,
    })

    expect(state.sendEmail).toHaveBeenCalledWith(
      'g@example.com',
      'New feature: drip content!',
      customHtml,
    )
  })

  it('user not found → warns and skips, no email sent', async () => {
    // No seedUser — state.users is empty.
    await processNotificationJob({
      type:       'enrollment_confirmed',
      userId:     'ghost-user-id',
      enrollmentId: 'e1',
      cohortName: 'Doesn’t matter',
      startDate:  '2026-01-01',
    })

    expect(state.sendEmail).not.toHaveBeenCalled()
  })

  it('unknown job type → warns and skips (defensive default)', async () => {
    seedUser('u8', 'h@example.com')
    await processNotificationJob(
      { type: 'totally_unknown', userId: 'u8' } as unknown as NotificationJobData,
    )
    expect(state.sendEmail).not.toHaveBeenCalled()
  })
})
