// PBA-128 — Milestones page: visual journey timeline
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { format } from 'date-fns'
import {
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Lock,
  MapPin,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { studentApi, type StepStatus } from '../../../lib/api-client'
import { Badge } from '../../components/ui/badge'
import { StepProgressBar } from '../../components/progress'

type DisplayStatus = StepStatus | 'UNLOCKED'

// ── Step status helpers ────────────────────────────────────────────────────────

function isCompleted(status: DisplayStatus) {
  return status === 'COMPLETE' || status === 'OVERRIDE_PASS'
}

function isActive(status: DisplayStatus) {
  return status === 'IN_PROGRESS' || status === 'UNLOCKED'
}

function isLocked(status: DisplayStatus) {
  return status === 'LOCKED'
}

function isPendingReview(status: DisplayStatus) {
  return status === 'PENDING_REVIEW' || status === 'OVERRIDE_FAIL'
}

// ── Milestone node icon ────────────────────────────────────────────────────────

function MilestoneIcon({ status }: { status: DisplayStatus }) {
  if (isCompleted(status)) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 ring-2 ring-green-200 dark:bg-green-950/40 dark:ring-green-900">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
      </div>
    )
  }
  if (isPendingReview(status)) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 ring-2 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      </div>
    )
  }
  if (isActive(status)) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 ring-2 ring-blue-300 dark:bg-blue-950/40 dark:ring-blue-700">
        <CircleDot className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      </div>
    )
  }
  // Locked
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted ring-2 ring-border">
      <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: DisplayStatus }) {
  if (isCompleted(status)) {
    return <Badge variant="default">Complete</Badge>
  }
  if (isPendingReview(status)) {
    return <Badge variant="secondary">In Review</Badge>
  }
  if (status === 'IN_PROGRESS') {
    return <Badge variant="secondary">In Progress</Badge>
  }
  if (status === 'UNLOCKED') {
    return <Badge variant="outline">Ready</Badge>
  }
  return <Badge variant="outline" className="text-muted-foreground">Locked</Badge>
}

// ── Single milestone row ────────────────────────────────────────────────────────

interface MilestoneRowProps {
  step: { id: string; title: string; order: number; status: DisplayStatus }
  isLast: boolean
  onClick: (id: string) => void
}

function MilestoneRow({ step, isLast, onClick }: MilestoneRowProps) {
  const completed = isCompleted(step.status)
  const active = isActive(step.status)
  const clickable = completed || active

  return (
    <li className="relative flex gap-4">
      {/* Vertical connector line */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-5 top-10 w-0.5 -translate-x-px',
            'bottom-0',
            completed ? 'bg-green-300 dark:bg-green-800' : 'bg-border',
          )}
          aria-hidden="true"
        />
      )}

      {/* Icon column */}
      <div className="relative z-10 shrink-0">
        <MilestoneIcon status={step.status} />
      </div>

      {/* Content */}
      <div
        className={cn(
          'mb-8 flex flex-1 items-start justify-between gap-3 rounded-lg border px-4 py-3 transition-all',
          completed && 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20',
          active && 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20',
          isPendingReview(step.status) && 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20',
          isLocked(step.status) && 'border-border bg-muted/20 opacity-60',
          clickable && 'cursor-pointer hover:shadow-sm',
        )}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : -1}
        onClick={() => clickable && onClick(step.id)}
        onKeyDown={(e) => e.key === 'Enter' && clickable && onClick(step.id)}
        aria-label={clickable ? `Go to step ${step.order}: ${step.title}` : undefined}
      >
        <div className="min-w-0">
          <p
            className={cn(
              'text-sm font-medium leading-snug',
              isLocked(step.status) ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            Step {step.order}: {step.title}
          </p>
        </div>
        <StatusChip status={step.status} />
      </div>
    </li>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function MilestonesSkeleton() {
  return (
    <div data-slot="milestones-skeleton" className="space-y-6 p-6">
      <div className="h-6 w-44 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 animate-pulse rounded-lg bg-muted h-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Summary stat ──────────────────────────────────────────────────────────────

function SummaryStats({
  completed,
  pending,
  total,
}: {
  completed: number
  pending: number
  total: number
}) {
  const remaining = total - completed - pending

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Complete', value: completed, icon: CheckCircle2, color: 'text-green-600' },
        { label: 'In Review', value: pending, icon: Clock, color: 'text-amber-600' },
        { label: 'Remaining', value: remaining, icon: Circle, color: 'text-muted-foreground' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-3 py-3 text-center"
        >
          <Icon className={cn('h-5 w-5', color)} aria-hidden="true" />
          <span className="text-xl font-medium text-foreground">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function MilestonesPage() {
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data, error } = await studentApi.getDashboard()
      if (error) throw new Error(error.message ?? 'Failed to load milestones')
      return data!
    },
  })

  useEffect(() => {
    document.title = 'Milestones — Product Builder Academy'
  }, [])

  if (isLoading) return <MilestonesSkeleton />

  if (isError || !data) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Failed to load milestones. Please refresh.
      </div>
    )
  }

  const { steps, completedSteps, totalSteps, cohort } = data

  const pendingCount = steps.filter(
    (s) => s.status === 'PENDING_REVIEW' || s.status === 'OVERRIDE_FAIL',
  ).length

  const completionDate = cohort?.deadline

  return (
    <div data-slot="milestones-page" className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-medium text-foreground">Your Journey</h1>
        <p className="text-sm text-muted-foreground">
          Track every step of your setup progress
        </p>
      </div>

      {/* Cohort + deadline banner */}
      {cohort && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium text-foreground">{cohort.name}</span>
          <span className="text-muted-foreground">
            — deadline {format(new Date(cohort.deadline), 'd MMM yyyy')}
          </span>
        </div>
      )}

      {/* Overall progress bar */}
      <StepProgressBar
        totalSteps={totalSteps}
        completedSteps={completedSteps}
        showLabel
        showPercentage
      />

      {/* Summary stats */}
      <SummaryStats
        completed={completedSteps}
        pending={pendingCount}
        total={totalSteps}
      />

      {/* Timeline */}
      {steps.length > 0 ? (
        <ol
          aria-label="Setup milestones"
          className="relative space-y-0 pt-2"
        >
          {steps.map((step, index) => (
            <MilestoneRow
              key={step.id}
              step={step as typeof step & { status: DisplayStatus }}
              isLast={index === steps.length - 1}
              onClick={(id) => void navigate(`/steps/${id}`)}
            />
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <MapPin className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No steps available yet.
          </p>
        </div>
      )}

      {/* Completion note */}
      {completedSteps === totalSteps && totalSteps > 0 && completionDate && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          All steps complete — you finished before the deadline!
        </div>
      )}
    </div>
  )
}
