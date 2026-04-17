/**
 * Unit tests for apps/api/src/services/badges.ts
 *
 * Strategy
 * --------
 * The service imports four Mongoose models.  We vi.mock() each one so that
 * no MongoDB connection is ever opened.  Every mock is reset between tests to
 * guarantee test isolation.
 *
 * The Mongoose ObjectId constructor is used inside the service source, so we
 * keep the real `mongoose` package for its Types.ObjectId — it works without a
 * connection as long as we never call save/find on a real collection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Types } from 'mongoose'

// ---------------------------------------------------------------------------
// Mock all four Mongoose models BEFORE importing the service under test.
// vi.mock() calls are hoisted to the top of the module by Vitest.
// ---------------------------------------------------------------------------
vi.mock('../models/Badge.js', () => ({
  Badge: {
    find: vi.fn(),
  },
}))

vi.mock('../models/UserBadge.js', () => ({
  UserBadge: {
    find: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('../models/Certificate.js', () => ({
  Certificate: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('../models/StudentStep.js', () => ({
  StudentStep: {
    countDocuments: vi.fn(),
  },
}))

vi.mock('../models/SetupStep.js', () => ({
  SetupStep: {
    countDocuments: vi.fn(),
  },
}))

// Import the service AFTER mocks are registered
import { checkAndAwardBadges, checkAndAwardCertificate } from '../services/badges.js'

// Import mocked models so we can control their return values in each test
import { Badge } from '../models/Badge.js'
import { UserBadge } from '../models/UserBadge.js'
import { Certificate } from '../models/Certificate.js'
import { StudentStep } from '../models/StudentStep.js'
import { SetupStep } from '../models/SetupStep.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const USER_ID = new Types.ObjectId().toString()

/** Build a minimal lean() Badge document */
function makeBadge(overrides: { triggerCriteria?: string; name?: string } = {}) {
  const id = new Types.ObjectId()
  return {
    _id: id,
    name: overrides.name ?? 'First Steps',
    description: 'Complete your first step',
    iconUrl: 'https://example.com/badge.png',
    triggerCriteria: overrides.triggerCriteria ?? 'steps_completed:1',
  }
}

// ---------------------------------------------------------------------------
// checkAndAwardBadges
// ---------------------------------------------------------------------------
describe('checkAndAwardBadges()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console noise from the service
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  it('should award a badge when steps_completed threshold is met', async () => {
    // Arrange
    const badge = makeBadge({ triggerCriteria: 'steps_completed:3' })

    vi.mocked(Badge.find).mockReturnValue({ lean: () => Promise.resolve([badge]) } as ReturnType<typeof Badge.find>)
    vi.mocked(UserBadge.find).mockReturnValue({ lean: () => Promise.resolve([]) } as ReturnType<typeof UserBadge.find>)
    vi.mocked(StudentStep.countDocuments).mockResolvedValue(5 as never) // 5 >= 3 → qualifies
    vi.mocked(UserBadge.create).mockResolvedValue([{}] as never)

    // Act
    const awarded = await checkAndAwardBadges(USER_ID)

    // Assert
    expect(awarded).toHaveLength(1)
    expect(awarded[0]).toBe(badge._id.toString())
    expect(UserBadge.create).toHaveBeenCalledOnce()
    expect(UserBadge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        badgeId: badge._id,
        earnedAt: expect.any(Date),
      }),
    )
  })

  // -------------------------------------------------------------------------
  it('should NOT award a badge when steps_completed threshold is not met', async () => {
    // Arrange
    const badge = makeBadge({ triggerCriteria: 'steps_completed:10' })

    vi.mocked(Badge.find).mockReturnValue({ lean: () => Promise.resolve([badge]) } as ReturnType<typeof Badge.find>)
    vi.mocked(UserBadge.find).mockReturnValue({ lean: () => Promise.resolve([]) } as ReturnType<typeof UserBadge.find>)
    vi.mocked(StudentStep.countDocuments).mockResolvedValue(3 as never) // 3 < 10 → does not qualify

    // Act
    const awarded = await checkAndAwardBadges(USER_ID)

    // Assert
    expect(awarded).toHaveLength(0)
    expect(UserBadge.create).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  it('should NOT re-award a badge that the student already earned', async () => {
    // Arrange
    const badge = makeBadge({ triggerCriteria: 'steps_completed:1' })

    vi.mocked(Badge.find).mockReturnValue({ lean: () => Promise.resolve([badge]) } as ReturnType<typeof Badge.find>)
    // Simulate the badge already being recorded in UserBadge
    vi.mocked(UserBadge.find).mockReturnValue({
      lean: () =>
        Promise.resolve([
          { badgeId: badge._id }, // already earned
        ]),
    } as ReturnType<typeof UserBadge.find>)
    vi.mocked(StudentStep.countDocuments).mockResolvedValue(10 as never)

    // Act
    const awarded = await checkAndAwardBadges(USER_ID)

    // Assert — already earned, so nothing new should be created
    expect(awarded).toHaveLength(0)
    expect(UserBadge.create).not.toHaveBeenCalled()
    // countDocuments should be skipped entirely because unearnedBadges is empty
    expect(StudentStep.countDocuments).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  it('should skip badges with unrecognised triggerCriteria and continue', async () => {
    // Arrange — one unknown badge, one valid badge
    const unknownBadge = makeBadge({ triggerCriteria: 'logins_count:5', name: 'Login Streak' })
    const validBadge = makeBadge({ triggerCriteria: 'steps_completed:2', name: 'Two Steps' })

    vi.mocked(Badge.find).mockReturnValue({
      lean: () => Promise.resolve([unknownBadge, validBadge]),
    } as ReturnType<typeof Badge.find>)
    vi.mocked(UserBadge.find).mockReturnValue({ lean: () => Promise.resolve([]) } as ReturnType<typeof UserBadge.find>)
    vi.mocked(StudentStep.countDocuments).mockResolvedValue(5 as never)
    vi.mocked(UserBadge.create).mockResolvedValue([{}] as never)

    // Act
    const awarded = await checkAndAwardBadges(USER_ID)

    // Assert — only the valid badge is awarded
    expect(awarded).toHaveLength(1)
    expect(awarded[0]).toBe(validBadge._id.toString())
  })

  // -------------------------------------------------------------------------
  it('should award multiple badges in a single call when multiple thresholds are met', async () => {
    // Arrange
    const badge1 = makeBadge({ triggerCriteria: 'steps_completed:1', name: 'Beginner' })
    const badge2 = makeBadge({ triggerCriteria: 'steps_completed:5', name: 'Intermediate' })

    vi.mocked(Badge.find).mockReturnValue({
      lean: () => Promise.resolve([badge1, badge2]),
    } as ReturnType<typeof Badge.find>)
    vi.mocked(UserBadge.find).mockReturnValue({ lean: () => Promise.resolve([]) } as ReturnType<typeof UserBadge.find>)
    vi.mocked(StudentStep.countDocuments).mockResolvedValue(7 as never) // 7 >= 5
    vi.mocked(UserBadge.create).mockResolvedValue([{}] as never)

    // Act
    const awarded = await checkAndAwardBadges(USER_ID)

    // Assert
    expect(awarded).toHaveLength(2)
    expect(UserBadge.create).toHaveBeenCalledTimes(2)
  })

  // -------------------------------------------------------------------------
  it('should silently ignore duplicate-key errors (11000) from concurrent award', async () => {
    // Arrange — race condition: two requests try to award the same badge concurrently
    const badge = makeBadge({ triggerCriteria: 'steps_completed:1' })

    vi.mocked(Badge.find).mockReturnValue({ lean: () => Promise.resolve([badge]) } as ReturnType<typeof Badge.find>)
    vi.mocked(UserBadge.find).mockReturnValue({ lean: () => Promise.resolve([]) } as ReturnType<typeof UserBadge.find>)
    vi.mocked(StudentStep.countDocuments).mockResolvedValue(3 as never)

    const dupKeyError = Object.assign(new Error('duplicate key'), { code: 11000 })
    vi.mocked(UserBadge.create).mockRejectedValue(dupKeyError)

    // Act — should NOT throw or propagate the duplicate-key error
    const awarded = await checkAndAwardBadges(USER_ID)

    // Assert — badge is not in the awarded list (create failed), but no crash
    expect(awarded).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  it('should return empty array and not throw when Badge.find rejects', async () => {
    // Arrange — database is unavailable
    vi.mocked(Badge.find).mockReturnValue({
      lean: () => Promise.reject(new Error('MongoDB connection lost')),
    } as ReturnType<typeof Badge.find>)
    vi.mocked(UserBadge.find).mockReturnValue({ lean: () => Promise.resolve([]) } as ReturnType<typeof UserBadge.find>)

    // Act
    const awarded = await checkAndAwardBadges(USER_ID)

    // Assert — fire-and-forget contract: errors must not propagate
    expect(awarded).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// checkAndAwardCertificate
// ---------------------------------------------------------------------------
describe('checkAndAwardCertificate()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  it('should issue a certificate when all steps are complete', async () => {
    // Arrange
    vi.mocked(Certificate.findOne).mockReturnValue({
      lean: () => Promise.resolve(null), // no existing certificate
    } as ReturnType<typeof Certificate.findOne>)
    vi.mocked(SetupStep.countDocuments).mockResolvedValue(5 as never)
    vi.mocked(StudentStep.countDocuments).mockResolvedValue(5 as never) // 5/5 complete
    vi.mocked(Certificate.create).mockResolvedValue([{}] as never)

    // Act
    const issued = await checkAndAwardCertificate(USER_ID)

    // Assert
    expect(issued).toBe(true)
    expect(Certificate.create).toHaveBeenCalledOnce()
    expect(Certificate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.any(Types.ObjectId),
        issuedAt: expect.any(Date),
      }),
    )
  })

  // -------------------------------------------------------------------------
  it('should NOT issue a duplicate certificate when one already exists', async () => {
    // Arrange — certificate already on record
    vi.mocked(Certificate.findOne).mockReturnValue({
      lean: () => Promise.resolve({ userId: new Types.ObjectId(USER_ID) }),
    } as ReturnType<typeof Certificate.findOne>)

    // Act
    const issued = await checkAndAwardCertificate(USER_ID)

    // Assert — short-circuit path: no further DB calls
    expect(issued).toBe(false)
    expect(Certificate.create).not.toHaveBeenCalled()
    expect(SetupStep.countDocuments).not.toHaveBeenCalled()
    expect(StudentStep.countDocuments).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  it('should NOT issue a certificate when some steps are still incomplete', async () => {
    // Arrange
    vi.mocked(Certificate.findOne).mockReturnValue({
      lean: () => Promise.resolve(null),
    } as ReturnType<typeof Certificate.findOne>)
    vi.mocked(SetupStep.countDocuments).mockResolvedValue(5 as never)
    vi.mocked(StudentStep.countDocuments).mockResolvedValue(3 as never) // 3/5 complete

    // Act
    const issued = await checkAndAwardCertificate(USER_ID)

    // Assert
    expect(issued).toBe(false)
    expect(Certificate.create).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  it('should NOT issue a certificate when there are no setup steps at all', async () => {
    // Arrange — edge case: course has 0 steps (safety guard)
    vi.mocked(Certificate.findOne).mockReturnValue({
      lean: () => Promise.resolve(null),
    } as ReturnType<typeof Certificate.findOne>)
    vi.mocked(SetupStep.countDocuments).mockResolvedValue(0 as never)
    vi.mocked(StudentStep.countDocuments).mockResolvedValue(0 as never)

    // Act
    const issued = await checkAndAwardCertificate(USER_ID)

    // Assert — "0 of 0" must NOT trigger a certificate
    expect(issued).toBe(false)
    expect(Certificate.create).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  it('should return false (not throw) when a duplicate-key race condition occurs', async () => {
    // Arrange — two concurrent requests both pass the existence check, only one wins
    vi.mocked(Certificate.findOne).mockReturnValue({
      lean: () => Promise.resolve(null),
    } as ReturnType<typeof Certificate.findOne>)
    vi.mocked(SetupStep.countDocuments).mockResolvedValue(3 as never)
    vi.mocked(StudentStep.countDocuments).mockResolvedValue(3 as never)

    const dupKeyError = Object.assign(new Error('duplicate key'), { code: 11000 })
    vi.mocked(Certificate.create).mockRejectedValue(dupKeyError)

    // Act
    const issued = await checkAndAwardCertificate(USER_ID)

    // Assert — treated as "already issued", not an error
    expect(issued).toBe(false)
  })

  // -------------------------------------------------------------------------
  it('should return false and not throw when Certificate.findOne rejects', async () => {
    // Arrange
    vi.mocked(Certificate.findOne).mockReturnValue({
      lean: () => Promise.reject(new Error('DB timeout')),
    } as ReturnType<typeof Certificate.findOne>)

    // Act
    const issued = await checkAndAwardCertificate(USER_ID)

    // Assert — fire-and-forget contract
    expect(issued).toBe(false)
  })
})
