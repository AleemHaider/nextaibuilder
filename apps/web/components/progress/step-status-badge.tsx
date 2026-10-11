'use client'

// PBA-148 — StepStatusBadge component
import { cn } from '@/lib/utils'
import type { StepStatus } from '@/lib/api-client'

type DisplayStatus = StepStatus | 'UNLOCKED'

const STATUS_CONFIG: Record<DisplayStatus, { label: string; className: string }> = {
  LOCKED: {
    label: 'Locked',
    className: 'bg-muted text-muted-foreground',
  },
  UNLOCKED: {
    label: 'Ready',
    className: 'bg-blue-100 text-blue-700',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'bg-orange-100 text-orange-700',
  },
  PENDING_REVIEW: {
    label: 'Under Review',
    className: 'bg-amber-100 text-amber-700 animate-pulse',
  },
  COMPLETE: {
    label: 'Complete',
    className: 'bg-green-100 text-green-700',
  },
  OVERRIDE_PASS: {
    label: 'Complete',
    className: 'bg-green-100 text-green-700',
  },
  OVERRIDE_FAIL: {
    label: 'Override Failed',
    className: 'bg-red-100 text-red-700',
  },
}

interface StepStatusBadgeProps {
  status: DisplayStatus
  className?: string
}

function StepStatusBadge({ status, className }: StepStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['LOCKED']
  return (
    <span
      data-slot="step-status-badge"
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}

export { StepStatusBadge }
