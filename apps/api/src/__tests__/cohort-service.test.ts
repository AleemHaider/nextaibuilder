/**
 * Unit tests for cohortService.{setCohortPublished, checkCohortPublishable} —
 * the cohort lifecycle invariants extracted from routes/admin/courses.ts.
 *
 * Locks the rule the audit flagged as scattered: "publishing requires ≥1
 * published module AND ≥1 active payment plan; unpublishing is always
 * allowed; existing enrollments are unaffected."
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

const state = vi.hoisted(() => ({
  cohorts:        new Map<string, { _id: import('mongoose').Types.ObjectId; isPublished: boolean }>(),
  moduleCount:    0,
  planCount:      0,
}))

vi.mock('../models/Cohort.js', () => ({
  Cohort: {
    // Synchronous return of a chainable so `findByIdAndUpdate(...).lean(...)`
    // works the same way Mongoose's Query proxy does.
    findByIdAndUpdate: vi.fn((id: unknown, update: { $set?: Record<string, unknown> }) => {
      const key = String(id)
      const doc = state.cohorts.get(key)
      if (doc) {
        const $set = update.$set ?? {}
        if (typeof $set['isPublished'] === 'boolean') doc.isPublished = $set['isPublished'] as boolean
      }
      return { lean: async () => doc ?? null }
    }),
  },
}))

vi.mock('../models/Module.js', () => ({
  Module: {
    countDocuments: vi.fn(async () => state.moduleCount),
  },
}))

vi.mock('../models/PaymentPlan.js', () => ({
  PaymentPlan: {
    countDocuments: vi.fn(async () => state.planCount),
  },
}))

import {
  setCohortPublished,
  checkCohortPublishable,
  COHORT_LIFECYCLE_FAILURE_STATUS,
} from '../services/cohortService.js'

// ── Test helpers ──────────────────────────────────────────────────────────

function seedCohort(isPublished = false) {
  const _id = new Types.ObjectId()
  state.cohorts.set(_id.toString(), { _id, isPublished })
  return _id
}

beforeEach(() => {
  state.cohorts.clear()
  state.moduleCount = 0
  state.planCount = 0
})

// ── checkCohortPublishable ────────────────────────────────────────────────

describe('cohortService — checkCohortPublishable', () => {

  it('rejects an invalid ObjectId', async () => {
    const r = await checkCohortPublishable('not-a-real-id')
    expect(r).toEqual({ ok: false, message: expect.stringContaining('Invalid cohort ID') })
  })

  it('rejects when there are no published modules', async () => {
    const id = seedCohort()
    state.moduleCount = 0
    state.planCount = 2
    const r = await checkCohortPublishable(id.toString())
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining('no published modules') })
  })

  it('rejects when there are no active payment plans (even with modules)', async () => {
    const id = seedCohort()
    state.moduleCount = 3
    state.planCount = 0
    const r = await checkCohortPublishable(id.toString())
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining('no active payment plans') })
  })

  it('passes when both invariants are satisfied', async () => {
    const id = seedCohort()
    state.moduleCount = 1
    state.planCount = 1
    const r = await checkCohortPublishable(id.toString())
    expect(r).toEqual({ ok: true })
  })
})

// ── setCohortPublished ────────────────────────────────────────────────────

describe('cohortService — setCohortPublished', () => {

  it('rejects invalid ObjectId with INVALID_ID (400)', async () => {
    const r = await setCohortPublished('xxx', true)
    expect(r).toMatchObject({ ok: false, code: 'INVALID_ID' })
    expect(COHORT_LIFECYCLE_FAILURE_STATUS['INVALID_ID']).toBe(400)
  })

  it('publish → CANNOT_PUBLISH (422) when no modules are published', async () => {
    const id = seedCohort()
    state.moduleCount = 0
    state.planCount = 1
    const r = await setCohortPublished(id.toString(), true)
    expect(r).toMatchObject({ ok: false, code: 'CANNOT_PUBLISH' })
    expect((r as { message: string }).message).toContain('no published modules')
    expect(COHORT_LIFECYCLE_FAILURE_STATUS['CANNOT_PUBLISH']).toBe(422)
    // Cohort was NOT mutated
    expect(state.cohorts.get(id.toString())!.isPublished).toBe(false)
  })

  it('publish → CANNOT_PUBLISH (422) when no payment plans are active', async () => {
    const id = seedCohort()
    state.moduleCount = 2
    state.planCount = 0
    const r = await setCohortPublished(id.toString(), true)
    expect(r).toMatchObject({ ok: false, code: 'CANNOT_PUBLISH' })
    expect((r as { message: string }).message).toContain('no active payment plans')
    expect(state.cohorts.get(id.toString())!.isPublished).toBe(false)
  })

  it('publish happy path → isPublished=true with both invariants met', async () => {
    const id = seedCohort(false)
    state.moduleCount = 1
    state.planCount = 1
    const r = await setCohortPublished(id.toString(), true)
    expect(r).toEqual({
      ok: true,
      cohort: { id: id.toString(), isPublished: true },
    })
    expect(state.cohorts.get(id.toString())!.isPublished).toBe(true)
  })

  it('unpublish skips the invariant guards (operator can always retract)', async () => {
    const id = seedCohort(true)
    state.moduleCount = 0
    state.planCount = 0
    const r = await setCohortPublished(id.toString(), false)
    expect(r).toMatchObject({ ok: true, cohort: { isPublished: false } })
    expect(state.cohorts.get(id.toString())!.isPublished).toBe(false)
  })

  it('NOT_FOUND when the cohort id is valid but does not exist', async () => {
    const orphan = new Types.ObjectId().toString()
    state.moduleCount = 1
    state.planCount = 1
    const r = await setCohortPublished(orphan, true)
    expect(r).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(COHORT_LIFECYCLE_FAILURE_STATUS['NOT_FOUND']).toBe(404)
  })
})
