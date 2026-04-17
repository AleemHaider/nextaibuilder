// PBA-128 — Badge Award Service
// Checks badge criteria after a student completes a step and awards any newly earned badges.
// Also awards a Certificate when all steps are complete.
//
// Badge triggerCriteria format: "steps_completed:N"
//   N = minimum number of COMPLETE or OVERRIDE_PASS steps required to earn the badge.
//
// Both functions are designed to be called fire-and-forget after step completion.
// Errors are caught and logged so they never surface to the caller.

import { Types } from 'mongoose'
import { Badge } from '../models/Badge.js'
import { UserBadge } from '../models/UserBadge.js'
import { Certificate } from '../models/Certificate.js'
import { StudentStep } from '../models/StudentStep.js'
import { SetupStep } from '../models/SetupStep.js'
import { createNotification } from './notificationService.js'

/** Statuses that count as "completed" for badge criteria evaluation */
const COMPLETE_STATUSES = ['COMPLETE', 'OVERRIDE_PASS'] as const

/**
 * Parse a badge triggerCriteria string into a structured form.
 * Currently supports: "steps_completed:N"
 * Returns null for unrecognised criteria (the badge is silently skipped).
 */
function parseCriteria(raw: string): { type: 'steps_completed'; threshold: number } | null {
  const match = raw.match(/^steps_completed:(\d+)$/)
  if (!match) return null
  return { type: 'steps_completed', threshold: Number(match[1]) }
}

/**
 * Count the number of steps a student has completed (COMPLETE or OVERRIDE_PASS).
 */
async function countCompletedSteps(userId: string): Promise<number> {
  return StudentStep.countDocuments({
    userId: new Types.ObjectId(userId),
    status: { $in: COMPLETE_STATUSES },
  })
}

/**
 * Check every Badge document and award any that the student qualifies for
 * but has not yet received.
 *
 * @param userId  The student's user ID string.
 * @returns       Array of badge IDs that were newly awarded in this call.
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  try {
    // Fetch all badge definitions and already-earned badge IDs in parallel
    const [allBadges, existingUserBadges] = await Promise.all([
      Badge.find().lean(),
      UserBadge.find({ userId: new Types.ObjectId(userId) }, { badgeId: 1 }).lean(),
    ])

    const alreadyEarnedIds = new Set(existingUserBadges.map((ub) => ub.badgeId.toString()))

    // Only bother querying step counts if there are badges left to evaluate
    const unearnedBadges = allBadges.filter((b) => !alreadyEarnedIds.has(b._id.toString()))
    if (unearnedBadges.length === 0) return []

    const completedCount = await countCompletedSteps(userId)

    const newlyAwardedIds: string[] = []

    for (const badge of unearnedBadges) {
      const criteria = parseCriteria(badge.triggerCriteria)
      if (!criteria) {
        // Unknown criteria type — skip silently
        console.warn(`[BadgeService] Unknown triggerCriteria format: "${badge.triggerCriteria}" on badge ${badge._id}`)
        continue
      }

      const qualifies =
        criteria.type === 'steps_completed' && completedCount >= criteria.threshold

      if (qualifies) {
        try {
          await UserBadge.create({
            userId: new Types.ObjectId(userId),
            badgeId: badge._id,
            earnedAt: new Date(),
          })
          newlyAwardedIds.push(badge._id.toString())
          console.info(`[BadgeService] Awarded badge "${badge.name}" (${badge._id}) to user ${userId}`)
          void createNotification({
            userId,
            type:     'BADGE_EARNED',
            title:    'Badge earned!',
            body:     `You earned the "${badge.name}" badge.`,
            linkPath: '/achievements',
          })
        } catch (err: unknown) {
          // Duplicate key (11000) means it was already awarded concurrently — safe to ignore
          if ((err as NodeJS.ErrnoException & { code?: number })?.code === 11000) continue
          throw err
        }
      }
    }

    return newlyAwardedIds
  } catch (err) {
    console.error(`[BadgeService] checkAndAwardBadges failed for user ${userId}:`, err)
    return []
  }
}

/**
 * Award a Certificate to the student if:
 *   1. They have completed ALL setup steps (every step is COMPLETE or OVERRIDE_PASS), and
 *   2. They do not already have a certificate.
 *
 * @param userId  The student's user ID string.
 * @returns       true if a new certificate was issued, false otherwise.
 */
export async function checkAndAwardCertificate(userId: string): Promise<boolean> {
  try {
    // Short-circuit: certificate already exists
    const existing = await Certificate.findOne({ userId: new Types.ObjectId(userId) }).lean()
    if (existing) return false

    // Check all steps are complete
    const [totalSteps, completedCount] = await Promise.all([
      SetupStep.countDocuments(),
      countCompletedSteps(userId),
    ])

    if (totalSteps === 0 || completedCount < totalSteps) return false

    await Certificate.create({
      userId: new Types.ObjectId(userId),
      issuedAt: new Date(),
    })

    console.info(`[BadgeService] Certificate issued to user ${userId}`)
    return true
  } catch (err: unknown) {
    // Duplicate publicToken or userId race condition — already issued, safe to ignore
    if ((err as NodeJS.ErrnoException & { code?: number })?.code === 11000) return false
    console.error(`[BadgeService] checkAndAwardCertificate failed for user ${userId}:`, err)
    return false
  }
}
