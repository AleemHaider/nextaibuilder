/**
 * Test for the payment-grace suspension sweep (audit H-5).
 * Suspends ACTIVE enrollments whose failed-payment grace window has elapsed;
 * leaves paid / not-yet-expired / already-suspended enrollments untouched.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

const h = vi.hoisted(() => ({
  find:      vi.fn(),
  updateOne: vi.fn(),
  queueAdd:  vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bullmq', () => ({
  Worker: class { on = vi.fn(); constructor() {} },
  Queue:  class { add = (...a: unknown[]) => h.queueAdd(...a); constructor() {} },
}))
vi.mock('../lib/redis.js', () => ({ bullMQConnection: { host: 'localhost', port: 6379 }, redis: {} }))
vi.mock('../models/Enrollment.js', () => ({
  Enrollment: {
    find: (...a: unknown[]) => ({ select: () => ({ lean: () => h.find(...a) }) }),
    updateOne: (...a: unknown[]) => h.updateOne(...a),
  },
}))

import { runPaymentGraceSweep } from '../jobs/paymentGraceSweep.js'

beforeEach(() => {
  vi.clearAllMocks()
  h.updateOne.mockResolvedValue({ modifiedCount: 1 })
  h.queueAdd.mockResolvedValue(undefined)
})

describe('runPaymentGraceSweep', () => {
  it('suspends each overdue enrollment and enqueues a suspension email', async () => {
    const e1 = { _id: new Types.ObjectId(), studentId: new Types.ObjectId(), cohortId: new Types.ObjectId() }
    const e2 = { _id: new Types.ObjectId(), studentId: new Types.ObjectId(), cohortId: new Types.ObjectId() }
    h.find.mockResolvedValue([e1, e2])

    const n = await runPaymentGraceSweep()

    expect(n).toBe(2)
    expect(h.updateOne).toHaveBeenCalledTimes(2)
    // guarded update: only flips a still-ACTIVE, still-overdue row
    expect(h.updateOne.mock.calls[0][0]).toMatchObject({ _id: e1._id, status: 'ACTIVE' })
    expect(h.updateOne.mock.calls[0][1]).toEqual({ $set: { status: 'SUSPENDED' } })
    expect(h.queueAdd).toHaveBeenCalledTimes(2)
    expect(h.queueAdd.mock.calls[0][1]).toMatchObject({ type: 'ENROLLMENT_SUSPENDED' })
  })

  it('does nothing when there are no overdue enrollments', async () => {
    h.find.mockResolvedValue([])
    const n = await runPaymentGraceSweep()
    expect(n).toBe(0)
    expect(h.updateOne).not.toHaveBeenCalled()
    expect(h.queueAdd).not.toHaveBeenCalled()
  })

  it('does not count / notify a row that a concurrent payment already cleared', async () => {
    const e1 = { _id: new Types.ObjectId(), studentId: new Types.ObjectId(), cohortId: new Types.ObjectId() }
    h.find.mockResolvedValue([e1])
    h.updateOne.mockResolvedValue({ modifiedCount: 0 }) // guard matched nothing

    const n = await runPaymentGraceSweep()

    expect(n).toBe(0)
    expect(h.queueAdd).not.toHaveBeenCalled()
  })
})
