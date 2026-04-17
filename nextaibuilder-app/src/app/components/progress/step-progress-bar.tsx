// PBA-148 — StepProgressBar component
import { cn } from '../../../lib/utils'

interface StepProgressBarProps {
  totalSteps: number
  completedSteps: number
  showLabel?: boolean
  showPercentage?: boolean
  className?: string
}

function StepProgressBar({
  totalSteps,
  completedSteps,
  showLabel = true,
  showPercentage = false,
  className,
}: StepProgressBarProps) {
  const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  // Colour transitions: 0–33% brand blue, 34–66% warm orange, 67–100% green
  const barColour =
    percent <= 33
      ? 'bg-[#4a9ad4]'
      : percent <= 66
        ? 'bg-[#ff8c5a]'
        : 'bg-green-500'

  return (
    <div data-slot="step-progress-bar" className={cn('w-full', className)}>
      {(showLabel || showPercentage) && (
        <div className="mb-1.5 flex items-center justify-between text-sm text-muted-foreground">
          {showLabel && (
            <span>
              {completedSteps} of {totalSteps} complete
            </span>
          )}
          {showPercentage && <span className="font-medium">{percent}%</span>}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-300 ease-in-out', barColour)}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percent}% complete`}
        />
      </div>
    </div>
  )
}

export { StepProgressBar }
