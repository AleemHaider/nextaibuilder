// PBA-351 — Student health status computation utility
//
// Computes a student's health status and deadline/activity metrics from
// the data already loaded by the admin students routes. Keeping all
// business logic here makes it independently unit-testable.

export type HealthStatus = 'on_track' | 'at_risk' | 'blocked' | 'completed'

export interface StudentHealthInput {
  lastActiveAt: Date | string | null
  completedSteps: number
  totalSteps: number
}

export interface CohortDeadlineInput {
  endDate: Date | string
}

export interface StudentHealthResult {
  healthStatus: HealthStatus
  daysUntilDeadline: number | null
  stepsRemaining: number
  daysSinceActive: number | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Compute a student's health status and associated metrics.
 *
 * Rules (priority order):
 *   completed — all steps are done
 *   blocked   — 14+ days inactive AND steps remain
 *   at_risk   — active 7–14 days ago, OR active <7 days but deadline ≤7 days
 *               AND >1 step remaining, OR never active with imminent deadline
 *   on_track  — everything else
 */
export function computeStudentHealth(
  student: StudentHealthInput,
  cohort: CohortDeadlineInput | null,
): StudentHealthResult {
  const now = Date.now()
  const stepsRemaining = Math.max(0, student.totalSteps - student.completedSteps)

  let daysUntilDeadline: number | null = null
  if (cohort) {
    const endDate =
      cohort.endDate instanceof Date ? cohort.endDate : new Date(cohort.endDate as string)
    daysUntilDeadline = Math.ceil((endDate.getTime() - now) / MS_PER_DAY)
  }

  let daysSinceActive: number | null = null
  if (student.lastActiveAt) {
    const lastActive =
      student.lastActiveAt instanceof Date
        ? student.lastActiveAt
        : new Date(student.lastActiveAt as string)
    daysSinceActive = Math.floor((now - lastActive.getTime()) / MS_PER_DAY)
  }

  if (stepsRemaining === 0) {
    return { healthStatus: 'completed', daysUntilDeadline, stepsRemaining, daysSinceActive }
  }

  if (daysSinceActive !== null && daysSinceActive >= 14) {
    return { healthStatus: 'blocked', daysUntilDeadline, stepsRemaining, daysSinceActive }
  }

  if (daysSinceActive === null) {
    if (daysUntilDeadline !== null && daysUntilDeadline <= 7 && stepsRemaining > 1) {
      return { healthStatus: 'at_risk', daysUntilDeadline, stepsRemaining, daysSinceActive }
    }
    return { healthStatus: 'on_track', daysUntilDeadline, stepsRemaining, daysSinceActive }
  }

  if (daysSinceActive >= 7) {
    return { healthStatus: 'at_risk', daysUntilDeadline, stepsRemaining, daysSinceActive }
  }

  const behindSchedule =
    daysUntilDeadline !== null && daysUntilDeadline <= 7 && stepsRemaining > 1

  if (behindSchedule) {
    return { healthStatus: 'at_risk', daysUntilDeadline, stepsRemaining, daysSinceActive }
  }

  return { healthStatus: 'on_track', daysUntilDeadline, stepsRemaining, daysSinceActive }
}
