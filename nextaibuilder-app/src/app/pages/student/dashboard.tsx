// PBA-143 / PBA-144 — Student Dashboard (all 5 states)
// PBA-292 — Countdown timer widget in Welcome state
// PBA-293 — Welcome state heading, gradient icon, CTA button redesign
// PBA-305 — Render full completion experience inline in right panel
import type { StepSummary } from '../../../lib/api-client'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { differenceInDays } from 'date-fns'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  HelpCircle,
  Phone,
} from 'lucide-react'
import { studentApi } from '../../../lib/api-client'
import { useAuth } from '../../../hooks/use-auth'
import { StepProgressBar } from '../../components/progress'
import { Button } from '../../components/ui/button'
import { CourseCompletionPage } from './course-completion'

const SUPPORT_URL = import.meta.env.VITE_SUPPORT_SCHEDULING_URL ?? '#'

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div data-slot="dashboard-skeleton" className="animate-pulse space-y-4 p-6">
      <div className="h-6 w-48 rounded-md bg-muted" />
      <div className="h-4 w-72 rounded-md bg-muted" />
      <div className="h-2 w-full rounded-full bg-muted" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 w-full rounded-lg bg-muted" />
      ))}
    </div>
  )
}

// ── PBA-292: Countdown timer widget ──────────────────────────────────────────

function useTimerFromStart(startDate: string) {
  function compute() {
    const diff = Date.now() - new Date(startDate).getTime()
    // cohort hasn't started yet — count down to startDate
    const absDiff = Math.abs(diff)
    const totalMinutes = Math.floor(absDiff / 1000 / 60)
    const days = Math.floor(totalMinutes / 60 / 24)
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
    const mins = totalMinutes % 60
    return { days, hours, mins, started: diff >= 0 }
  }

  const [state, setState] = useState(compute)

  useEffect(() => {
    const id = setInterval(() => setState(compute()), 60_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate])

  return state
}

function CountdownWidget({ startDate }: { startDate: string }) {
  const { days, hours, mins, started } = useTimerFromStart(startDate)

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[#717182]">
        {started ? 'Time since cohort started' : 'Cohort starts in'}
      </p>
      <div
        data-slot="countdown-widget"
        className="inline-flex items-center gap-3 rounded-[10px] bg-[#f3f3f5] px-8 py-4"
      >
        {[
          { value: pad(days), label: 'Days' },
          { value: pad(hours), label: 'Hours' },
          { value: pad(mins), label: 'Min' },
        ].map(({ value, label }, i, arr) => (
          <div key={label} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <span className="text-[32px] font-bold leading-none text-[#1a2744]">{value}</span>
              <span className="mt-1 text-[11px] uppercase tracking-wide text-[#717182]">{label}</span>
            </div>
            {i < arr.length - 1 && (
              <span className="pb-5 text-[24px] font-bold text-[#1a2744]/40">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PBA-293: Welcome state ────────────────────────────────────────────────────

function WelcomeState({
  firstName,
  startDate,
  steps,
  onStepClick,
}: {
  firstName: string
  startDate: string
  steps: StepSummary[]
  onStepClick: (id: string) => void
}) {
  const firstStep = steps[0]

  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {/* Gradient circle icon */}
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: 'linear-gradient(135deg, #4a90c4 0%, #7bb8e0 50%, #ff8c5a 100%)' }}
      >
        {/* Logomark ribbon approximation using a wave emoji as fallback visual */}
        <span className="text-3xl" aria-hidden="true">🎓</span>
      </div>

      {/* Heading */}
      <h1 className="text-[28px] font-medium leading-tight text-[#1a2744]">
        Welcome, {firstName}! 👋
      </h1>

      {/* Sub-heading */}
      <p className="mt-2 text-[16px] text-[#717182]">
        Your setup journey starts here.
      </p>

      {/* Description */}
      <p className="mt-3 max-w-sm text-[15px] text-[#717182]">
        Complete {steps.length} simple steps to configure your development environment
        before your cohort begins. Most students finish in under 90 minutes.
      </p>

      {/* PBA-292: Elapsed time widget */}
      {startDate && (
        <div className="mt-8">
          <CountdownWidget startDate={startDate} />
        </div>
      )}

      {/* CTA button */}
      {firstStep && (
        <button
          type="button"
          onClick={() => onStepClick(firstStep.id)}
          className="mt-6 flex items-center gap-2 rounded-lg bg-[#ff8c5a] px-6 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-[#ff6347] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8c5a]/50"
        >
          <ArrowRight className="h-4 w-4" />
          Begin Step 1
        </button>
      )}

      <SupportLink />
    </div>
  )
}

// ── In-progress state ─────────────────────────────────────────────────────────

function InProgressState({
  firstName,
  startDate,
  steps,
  completedSteps,
  totalSteps,
  onStepClick,
}: {
  firstName: string
  startDate: string
  steps: { id: string; title: string; order: number; status: string }[]
  completedSteps: number
  totalSteps: number
  onStepClick: (id: string) => void
}) {
  // Find the next active step (first UNLOCKED or IN_PROGRESS)
  const nextStep = steps.find((s) => s.status === 'UNLOCKED' || s.status === 'IN_PROGRESS')

  return (
    <div className="space-y-5 px-6 py-8">
      <div>
        <h1 className="text-xl font-medium text-foreground">
          Keep going, {firstName}!
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;re making great progress.
        </p>
      </div>

      <StepProgressBar
        totalSteps={totalSteps}
        completedSteps={completedSteps}
        showLabel
        showPercentage
      />

      {startDate && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span>
            {differenceInDays(new Date(), new Date(startDate)) < 0
              ? `Cohort starts in ${Math.abs(differenceInDays(new Date(), new Date(startDate)))} days`
              : differenceInDays(new Date(), new Date(startDate)) === 0
                ? 'Cohort started today'
                : `Day ${differenceInDays(new Date(), new Date(startDate)) + 1} of your cohort`}
          </span>
        </div>
      )}

      {nextStep && (
        <Button className="w-full" onClick={() => onStepClick(nextStep.id)}>
          Continue Step {nextStep.order}
        </Button>
      )}

      <SupportLink />
    </div>
  )
}

// ── Complete state ────────────────────────────────────────────────────────────
// PBA-305: Render full CourseCompletionPage inline in the right panel
// PBA-308: No "Need help?" link — not in Figma design

function CompleteState() {
  return <CourseCompletionPage />
}

// ── Deadline missed state ─────────────────────────────────────────────────────

function DeadlineMissedState({
  completedSteps,
  totalSteps,
}: {
  steps: { id: string; title: string; order: number; status: string }[]
  completedSteps: number
  totalSteps: number
}) {
  return (
    <div className="space-y-5 px-6 py-8">
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div>
          <p className="font-medium text-red-700 dark:text-red-400">Your setup deadline has passed</p>
          <p className="mt-0.5 text-sm text-red-600 dark:text-red-500">
            Please contact support to discuss your options.
          </p>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-medium text-foreground">Setup deadline missed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You completed {completedSteps} of {totalSteps} steps before the deadline.
        </p>
      </div>

      <StepProgressBar
        totalSteps={totalSteps}
        completedSteps={completedSteps}
        showLabel
        showPercentage
      />

      <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
        <Button className="w-full" variant="default">
          <Phone className="mr-2 h-4 w-4" />
          Schedule a Support Call
        </Button>
      </a>
    </div>
  )
}

// ── No-cohort state ───────────────────────────────────────────────────────────

function NoCohortState() {
  return (
    <div className="flex flex-col items-center space-y-4 py-12 text-center px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/30">
        <CalendarClock className="h-8 w-8 text-[#4a9ad4]" />
      </div>
      <div>
        <h1 className="text-xl font-medium text-foreground">
          You&apos;re registered! Cohort assignment coming soon.
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          You&apos;ll receive an email with your cohort details and setup link shortly. No action
          needed right now.
        </p>
      </div>
      <SupportLink />
    </div>
  )
}

// ── Support link ──────────────────────────────────────────────────────────────

function SupportLink() {
  return (
    <div className="flex justify-center pt-2">
      <a
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <HelpCircle className="h-4 w-4" />
        Need help?
      </a>
    </div>
  )
}

// ── Main dashboard page ───────────────────────────────────────────────────────

export function StudentDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data, error } = await studentApi.getDashboard()
      if (error) throw new Error(error.message ?? 'Failed to load dashboard')
      return data!
    },
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    document.title = 'Dashboard — Setup Companion'
  }, [])

  function handleStepClick(stepId: string) {
    void navigate(`/steps/${stepId}`)
  }

  if (isLoading) return (
    <div className="h-full overflow-y-auto">
      <DashboardSkeleton />
    </div>
  )

  if (isError || !data) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-muted-foreground">
        Failed to load dashboard. Please refresh.
      </div>
    )
  }

  const firstName = user?.firstName ?? 'there'

  switch (data.dashboardState) {
    case 'WELCOME':
      return (
        <div className="h-full overflow-y-auto">
          <WelcomeState
            firstName={firstName}
            startDate={data.cohort?.startDate ?? ''}
            steps={data.steps}
            onStepClick={handleStepClick}
          />
        </div>
      )

    case 'IN_PROGRESS':
      return (
        <div className="h-full overflow-y-auto">
          <InProgressState
            firstName={firstName}
            startDate={data.cohort?.startDate ?? ''}
            steps={data.steps}
            completedSteps={data.completedSteps}
            totalSteps={data.totalSteps}
            onStepClick={handleStepClick}
          />
        </div>
      )

    case 'COMPLETE':
      return (
        <div className="h-full overflow-y-auto">
          <CompleteState />
        </div>
      )

    case 'DEADLINE_MISSED':
      return (
        <div className="h-full overflow-y-auto">
          <DeadlineMissedState
            steps={data.steps}
            completedSteps={data.completedSteps}
            totalSteps={data.totalSteps}
          />
        </div>
      )

    case 'NO_COHORT':
    default:
      return (
        <div className="h-full overflow-y-auto">
          <NoCohortState />
        </div>
      )
  }
}
