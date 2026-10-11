/**
 * Unit test for the atomic counter used by certificate credentialId issuance
 * (audit H-7). Replaces the race-prone / deletion-broken countDocuments()+1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ findByIdAndUpdate: vi.fn() }))

vi.mock('mongoose', async (orig) => {
  const actual = await orig<typeof import('mongoose')>()
  return {
    ...actual,
    model: () => ({ findByIdAndUpdate: (...a: unknown[]) => h.findByIdAndUpdate(...a) }),
  }
})

import { nextSequence } from '../models/Counter.js'

beforeEach(() => h.findByIdAndUpdate.mockReset())

describe('nextSequence', () => {
  it('atomically $inc-s the counter and returns the new value', async () => {
    h.findByIdAndUpdate.mockResolvedValue({ _id: 'certificate:2026', seq: 7 })

    const seq = await nextSequence('certificate:2026')

    expect(seq).toBe(7)
    expect(h.findByIdAndUpdate).toHaveBeenCalledWith(
      'certificate:2026',
      { $inc: { seq: 1 } },
      expect.objectContaining({ upsert: true, new: true }),
    )
  })

  it('returns monotonically increasing values across calls (no reuse)', async () => {
    let n = 0
    h.findByIdAndUpdate.mockImplementation(async () => ({ seq: ++n }))

    expect(await nextSequence('k')).toBe(1)
    expect(await nextSequence('k')).toBe(2)
    expect(await nextSequence('k')).toBe(3)
  })
})
