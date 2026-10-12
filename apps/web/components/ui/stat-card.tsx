'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader } from './card'
import { Skeleton } from './skeleton'
import { cn } from '@/lib/utils'

type Accent = 'blue' | 'orange' | 'green' | 'navy' | 'default'

interface StatCardProps {
  label: string
  value: string | number | undefined
  description?: string
  icon: React.ElementType
  loading?: boolean
  accent?: Accent
  className?: string
}

const ACCENT_CLASSES: Record<Accent, string> = {
  blue:    'bg-[#4a9ad4]/10 text-[#4a9ad4]',
  orange:  'bg-[#ff8c5a]/10 text-[#ff8c5a]',
  green:   'bg-emerald-500/10 text-emerald-600',
  navy:    'bg-[#1a2744]/10 text-[#1a2744]',
  default: 'bg-muted text-muted-foreground',
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  loading,
  accent = 'default',
  className,
}: StatCardProps) {
  return (
    <Card data-slot="stat-card" className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">
            {label}
          </CardDescription>
          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', ACCENT_CLASSES[accent])}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3.5 w-32" />
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold text-foreground tabular-nums">{value ?? '—'}</p>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export { StatCard }
export type { StatCardProps, Accent }
