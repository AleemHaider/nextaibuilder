/**
 * Integration test for slackInviteWorker (audit P1 #12).
 *
 * Tests the exported `processSlackInviteJob` directly — no BullMQ runtime
 * needed — covering: skip-when-missing, skip-when-already-SENT, happy path
 * (status → SENT, attempts++), retry path (status → FAILED, requeue with
 * delay), and max-retries-reached (no requeue).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

// ── Hoisted shared state used by the mocks ────────────────────────────────
const state = vi.hoisted(() => {
  return {
    invites: new Map<string, {
      _id: import('mongoose').Types.ObjectId
      status: 'PENDING' | 'SENT' | 'FAILED'
      attempts: number
      lastAttemptAt?: Date
      errorMessage?: string
    }>(),
    sendSlackInvite: vi.fn(),
    queueAdd:        vi.fn().mockResolvedValue({ id: 'requeued-id' }),
  }
})

// Mock BullMQ — Queue/Worker as inert classes so importing the worker module
// doesn't try to connect to Redis.
vi.mock('bullmq', () => {
  class Queue {
    add = state.queueAdd
    constructor(_name: string, _opts?: unknown) {}
  }
  class Worker {
    on = vi.fn()
    constructor(_name: string, _handler: unknown, _opts?: unknown) {}
  }
  return { Queue, Worker }
})

vi.mock('../lib/redis.js', () => ({
  redis: { on: vi.fn(), duplicate: vi.fn() },
  bullMQConnection: { host: 'localhost', port: 6379 },
}))

vi.mock('../lib/slack.js', () => ({
  sendSlackInvite: (...args: unknown[]) => state.sendSlackInvite(...args),
}))

// In-memory SlackInvite model — supports findById + findByIdAndUpdate
vi.mock('../models/SlackInvite.js', () => {
  function findById(id: import('mongoose').Types.ObjectId | string) {
    const key = id.toString()
    return Promise.resolve(state.invites.get(key) ?? null)
  }
  function findByIdAndUpdate(id: import('mongoose').Types.ObjectId | string, update: Record<string, Record<string, unknown>>) {
    const key = id.toString()
    const doc = state.invites.get(key)
    if (!doc) return Promise.resolve(null)
    const $set = update['$set'] ?? {}
    const $unset = update['$unset'] ?? {}
    const $inc = update['$inc'] ?? {}
    for (const [k, v] of Object.entries($set)) (doc as Record<string, unknown>)[k] = v
    for (const k of Object.keys($unset)) delete (doc as Record<string, unknown>)[k]
    for (const [k, v] of Object.entries($inc)) {
      const current = (doc as Record<string, unknown>)[k]
      ;(doc as Record<string, unknown>)[k] = (typeof current === 'number' ? current : 0) + Number(v)
    }
    return Promise.resolve(doc)
  }
  return {
    SlackInvite: { findById, findByIdAndUpdate },
  }
})

// ── Imports after mocks ───────────────────────────────────────────────────
import { processSlackInviteJob, MAX_RETRIES } from '../workers/slackInviteWorker.js'

// ── Test helpers ──────────────────────────────────────────────────────────

function seedInvite(opts: { status?: 'PENDING' | 'SENT' | 'FAILED'; attempts?: number } = {}) {
  const id = new Types.ObjectId()
  state.invites.set(id.toString(), {
    _id:     id,
    status:  opts.status ?? 'PENDING',
    attempts: opts.attempts ?? 0,
  })
  return id
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('slackInviteWorker — processSlackInviteJob', () => {
  beforeEach(() => {
    state.invites.clear()
    state.sendSlackInvite.mockReset()
    state.queueAdd.mockClear()
  })

  it('skips gracefully when the slackInviteId is not a valid ObjectId', async () => {
    await processSlackInviteJob('job-1', {
      userId: 'u1',
      email: 'a@example.com',
      slackInviteId: 'not-an-object-id',
    })
    expect(state.sendSlackInvite).not.toHaveBeenCalled()
    expect(state.queueAdd).not.toHaveBeenCalled()
  })

  it('skips when the invite is already SENT (idempotent replay)', async () => {
    const id = seedInvite({ status: 'SENT' })
    await processSlackInviteJob('job-2', {
      userId: 'u1',
      email: 'a@example.com',
      slackInviteId: id.toString(),
    })
    expect(state.sendSlackInvite).not.toHaveBeenCalled()
    expect(state.queueAdd).not.toHaveBeenCalled()
    // Still SENT — attempts not bumped.
    expect(state.invites.get(id.toString())!.status).toBe('SENT')
    expect(state.invites.get(id.toString())!.attempts).toBe(0)
  })

  it('happy path — marks invite SENT, increments attempts, no requeue', async () => {
    const id = seedInvite()
    state.sendSlackInvite.mockResolvedValueOnce(undefined)

    await processSlackInviteJob('job-3', {
      userId: 'u1',
      email: 'happy@example.com',
      slackInviteId: id.toString(),
    })

    expect(state.sendSlackInvite).toHaveBeenCalledWith('happy@example.com')
    const final = state.invites.get(id.toString())!
    expect(final.status).toBe('SENT')
    expect(final.attempts).toBe(1)
    expect(final.lastAttemptAt).toBeInstanceOf(Date)
    expect(final).not.toHaveProperty('errorMessage')
    expect(state.queueAdd).not.toHaveBeenCalled()
  })

  it('first failure — marks FAILED, increments attempts, requeues with delay', async () => {
    const id = seedInvite()
    state.sendSlackInvite.mockRejectedValueOnce(new Error('slack network down'))

    await processSlackInviteJob('job-4', {
      userId: 'u1',
      email: 'bad@example.com',
      slackInviteId: id.toString(),
    })

    const final = state.invites.get(id.toString())!
    expect(final.status).toBe('FAILED')
    expect(final.attempts).toBe(1)
    expect(final.errorMessage).toBe('slack network down')

    expect(state.queueAdd).toHaveBeenCalledOnce()
    const call = state.queueAdd.mock.calls[0]!
    expect(call[0]).toBe('retry-slack-invite')
    expect(call[1]).toEqual({
      userId:        'u1',
      email:         'bad@example.com',
      slackInviteId: id.toString(),
    })
    // Delay matches the 5-minute retry window
    expect(call[2]).toMatchObject({ delay: 5 * 60 * 1000 })
  })

  it('max retries reached — failure is recorded but no requeue', async () => {
    // Seed with attempts = MAX_RETRIES - 1 so that this attempt is the last.
    const id = seedInvite({ attempts: MAX_RETRIES - 1 })
    state.sendSlackInvite.mockRejectedValueOnce(new Error('still broken'))

    await processSlackInviteJob('job-5', {
      userId: 'u1',
      email: 'final@example.com',
      slackInviteId: id.toString(),
    })

    const final = state.invites.get(id.toString())!
    expect(final.status).toBe('FAILED')
    expect(final.attempts).toBe(MAX_RETRIES)
    expect(state.queueAdd).not.toHaveBeenCalled()
  })

  it('uses the injected retry queue (dependency-injectable for tests)', async () => {
    const id = seedInvite()
    const customAdd = vi.fn().mockResolvedValue(undefined)
    state.sendSlackInvite.mockRejectedValueOnce(new Error('boom'))

    await processSlackInviteJob('job-6', {
      userId: 'u1',
      email: 'inject@example.com',
      slackInviteId: id.toString(),
    }, { add: customAdd })

    expect(customAdd).toHaveBeenCalledOnce()
    expect(state.queueAdd).not.toHaveBeenCalled()
  })
})
