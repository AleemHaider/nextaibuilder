// PBA-148 — StepList component (vertical step list for dashboard)
// Updated: estimatedMinutes shown below step title
import { Lock, Play, Clock, CheckCircle2, CircleDot } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { StepStatusBadge } from './step-status-badge'
import type { StepStatus } from '../../../lib/api-client'

type DisplayStatus = StepStatus | 'UNLOCKED'

interface StepItem {
  id: string
  title: string
  order: number
  status: DisplayStatus
  estimatedMinutes?: number | null
}

interface StepListProps {
  steps: StepItem[]
  onStepClick: (stepId: string) => void
  activeStepId?: string
}

const STATUS_ICON: Record<DisplayStatus, React.ReactNode> = {
  LOCKED: <Lock className="h-4 w-4 text-muted-foreground" />,
  UNLOCKED: <Play className="h-4 w-4 text-[#4a9ad4]" />,
  IN_PROGRESS: <CircleDot className="h-4 w-4 text-orange-500" />,
  PENDING_REVIEW: <Clock className="h-4 w-4 text-amber-500" />,
  COMPLETE: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  OVERRIDE_PASS: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  OVERRIDE_FAIL: <Clock className="h-4 w-4 text-red-500" />,
}

const CLICKABLE_STATUSES: DisplayStatus[] = ['UNLOCKED', 'IN_PROGRESS', 'COMPLETE', 'OVERRIDE_PASS']

function StepList({ steps, onStepClick, activeStepId }: StepListProps) {
  return (
    <ol role="list" data-slot="step-list" className="flex flex-col gap-1.5">
      {steps.map((step) => {
        const isClickable = CLICKABLE_STATUSES.includes(step.status)
        const isActive = step.id === activeStepId
        const isComplete = step.status === 'COMPLETE' || step.status === 'OVERRIDE_PASS'

        return (
          <li
            key={step.id}
            role="listitem"
            className={cn(
              'group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all',
              isActive && 'border-[#4a9ad4] bg-blue-50 dark:bg-blue-950/30',
              !isActive && isClickable && 'cursor-pointer border-border hover:border-[#4a9ad4]/50 hover:bg-accent',
              !isActive && !isClickable && 'cursor-not-allowed border-border bg-muted/30 opacity-60',
              isComplete && !isActive && 'border-green-200 bg-green-50/50 dark:bg-green-950/20',
            )}
            onClick={() => isClickable && onStepClick(step.id)}
            onKeyDown={(e) => e.key === 'Enter' && isClickable && onStepClick(step.id)}
            tabIndex={isClickable ? 0 : -1}
            aria-disabled={!isClickable}
          >
            {/* Step number circle */}
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isComplete
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : isActive
                    ? 'bg-[#4a9ad4] text-white'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {isComplete ? '✓' : step.order}
            </div>

            {/* Title + time estimate */}
            <div className="flex-1 min-w-0">
              <span
                className={cn(
                  'block text-sm font-medium',
                  !isClickable && 'text-muted-foreground',
                )}
              >
                {step.title}
              </span>
              {step.estimatedMinutes != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  ~{step.estimatedMinutes} min
                </span>
              )}
            </div>

            {/* Status icon + badge */}
            <div className="flex items-center gap-2">
              {STATUS_ICON[step.status]}
              <StepStatusBadge status={step.status} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export { StepList }
