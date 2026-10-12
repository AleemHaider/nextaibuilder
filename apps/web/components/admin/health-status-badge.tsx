'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type HealthStatus = 'on_track' | 'at_risk' | 'blocked' | 'completed'

const HEALTH_STATUS_MAP: Record<HealthStatus, { label: string; className: string; dotClass: string }> = {
  on_track:  { label: 'On Track',  className: 'bg-green-100 text-green-800 border-green-200', dotClass: 'bg-green-500' },
  at_risk:   { label: 'At Risk',   className: 'bg-amber-100 text-amber-800 border-amber-200', dotClass: 'bg-amber-500' },
  blocked:   { label: 'Blocked',   className: 'bg-red-100 text-red-800 border-red-200',       dotClass: 'bg-red-500' },
  completed: { label: 'Complete',  className: 'bg-green-50 text-green-700 border-green-200',  dotClass: 'bg-green-400' },
}

function HealthStatusBadge({ status }: { status: HealthStatus }) {
  const config = HEALTH_STATUS_MAP[status] ?? {
    label: status,
    className: 'bg-muted text-muted-foreground border-border',
    dotClass: 'bg-muted-foreground',
  }
  return (
    <Badge className={cn('border gap-1.5', config.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dotClass)} aria-hidden="true" />
      {config.label}
    </Badge>
  )
}

function getProgressBarClass(status: HealthStatus): string {
  switch (status) {
    case 'completed': return '[&>div]:bg-green-500'
    case 'at_risk':   return '[&>div]:bg-amber-500'
    case 'blocked':   return '[&>div]:bg-red-500'
    default:          return ''
  }
}

export { HealthStatusBadge, getProgressBarClass }
