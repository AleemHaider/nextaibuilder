'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type SubmissionStatus = 'PENDING' | 'ML_PROCESSING' | 'HUMAN_REVIEW' | 'APPROVED' | 'REJECTED'

const STATUS_LABEL: Record<string, string> = {
  PENDING:      'Pending',
  ML_PROCESSING: 'Processing',
  HUMAN_REVIEW: 'Awaiting Review',
  APPROVED:     'Approved',
  REJECTED:     'Rejected',
}

type BadgeVariant = 'warning' | 'success' | 'destructive' | 'secondary' | 'outline'

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING:      'secondary',
  ML_PROCESSING: 'warning',
  HUMAN_REVIEW: 'warning',
  APPROVED:     'success',
  REJECTED:     'destructive',
}

function mlScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-destructive'
}

function mlScoreBg(score: number | null): string {
  if (score === null) return 'bg-muted'
  if (score >= 80) return 'bg-green-50'
  if (score >= 60) return 'bg-amber-50'
  return 'bg-red-50'
}

function SubmissionStatusBadge({
  status,
  className,
}: {
  status: SubmissionStatus
  className?: string
}) {
  const label = STATUS_LABEL[status] ?? status
  const variant: BadgeVariant = STATUS_VARIANT[status] ?? 'outline'
  return (
    <Badge variant={variant} className={cn(className)}>
      {label}
    </Badge>
  )
}

export { SubmissionStatusBadge, mlScoreColor, mlScoreBg }
export type { SubmissionStatus }
