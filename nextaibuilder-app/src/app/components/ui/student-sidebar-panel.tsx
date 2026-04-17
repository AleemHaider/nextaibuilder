// PBA-294 — Sidebar step list: numbered circles, status badges, connector lines, row highlights
// PBA-295 — Badges Earned section at bottom of sidebar
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lock, Check, Phone, Award } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { studentApi } from '@/lib/api-client'
import { useStudentBadges } from '@/hooks/use-achievements'

// ── Types ──────────────────────────────────────────────────────────────────────

type StepStatus =
  | 'LOCKED'
  | 'UNLOCKED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'COMPLETE'
  | 'OVERRIDE_PASS'
  | 'OVERRIDE_FAIL'

interface SidebarStep {
  id: string
  title: string
  order: number
  status: StepStatus
  estimatedMinutes?: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isComplete(status: StepStatus): boolean {
  return status === 'COMPLETE' || status === 'OVERRIDE_PASS'
}

function isLocked(status: StepStatus): boolean {
  return status === 'LOCKED'
}

// ── Step circle indicator ──────────────────────────────────────────────────────

function StepCircle({ step }: { step: SidebarStep }) {
  if (isComplete(step.status)) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2744] mt-px">
        <Check className="h-3 w-3 text-white" strokeWidth={2.5} />
      </div>
    )
  }

  if (step.status === 'IN_PROGRESS') {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4a9ad4] mt-px ring-[3px] ring-[#4a9ad4]/20">
        <span className="text-[11px] font-bold text-white">{step.order}</span>
      </div>
    )
  }

  if (step.status === 'UNLOCKED') {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-black/20 mt-px">
        <span className="text-[11px] font-bold text-[#1a2744]">{step.order}</span>
      </div>
    )
  }

  // Locked — outline circle with lock SVG (no number)
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#c8c8d8] mt-px bg-[#f3f3f8]">
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#a0a0b0" strokeWidth="1.5" aria-hidden="true">
        <rect x="3.5" y="7" width="9" height="7" rx="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
      </svg>
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StepRowBadge({ status }: { status: StepStatus }) {
  if (isComplete(status)) {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-[#16a34a] whitespace-nowrap">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="2 6 5 9 10 3" />
        </svg>
        Verified
      </span>
    )
  }
  if (status === 'IN_PROGRESS') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-[#4a9ad4]/[0.12] px-[6px] py-0.5 text-[10px] font-semibold text-[#4a9ad4] whitespace-nowrap">
        Current
      </span>
    )
  }
  return null
}

// ── Individual step row ────────────────────────────────────────────────────────

function SidebarStepRow({
  step,
  onClick,
}: {
  step: SidebarStep
  onClick: (id: string) => void
}) {
  const current = step.status === 'IN_PROGRESS'
  const complete = isComplete(step.status)
  const locked = isLocked(step.status)
  const clickable = !locked

  return (
    <li
      className={cn(
        'relative flex items-start gap-[10px] rounded-[8px] px-3 mb-px transition-colors',
        complete ? 'py-[7px]' : 'py-[9px]',
        current && 'bg-[#dbeafe] border-l-[3px] border-[#4a9ad4] pl-[9px]',
        !current && clickable && 'hover:bg-black/[0.04] cursor-pointer',
        locked && 'cursor-default',
      )}
      onClick={() => clickable && onClick(step.id)}
      onKeyDown={(e) => e.key === 'Enter' && clickable && onClick(step.id)}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      aria-disabled={locked}
    >
      <StepCircle step={step} />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[13px] font-medium leading-snug',
            complete && 'text-[#1a2744]',
            current && 'font-semibold text-[#1a2744]',
            locked && 'text-[#a0a0b0]',
            !complete && !current && !locked && 'text-[#1a2744]',
          )}
        >
          {step.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {step.estimatedMinutes != null && (
            <span className={cn('text-[11px]', locked ? 'text-[#b8b8c8]' : 'text-[#717182]')}>~{step.estimatedMinutes} min</span>
          )}
          <StepRowBadge status={step.status} />
        </div>
      </div>
    </li>
  )
}

// ── Step list ──────────────────────────────────────────────────────────────────

function SidebarStepList({
  steps,
  onStepClick,
}: {
  steps: SidebarStep[]
  onStepClick: (id: string) => void
}) {
  // Find the index where completed steps end so we can insert a section divider
  const firstActiveIndex = steps.findIndex((s) => !isComplete(s.status))

  return (
    <ol role="list" data-slot="sidebar-step-list" className="flex flex-col">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          {/* Divider between completed steps and remaining steps */}
          {index === firstActiveIndex && firstActiveIndex > 0 && (
            <li aria-hidden="true" className="flex items-center gap-2 px-3 py-[6px] my-0.5">
              <div className="h-px flex-1 bg-[#e4e4ec]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#b0b0c0]">Up next</span>
              <div className="h-px flex-1 bg-[#e4e4ec]" />
            </li>
          )}
          <SidebarStepRow
            step={step}
            onClick={onStepClick}
          />
        </React.Fragment>
      ))}
    </ol>
  )
}

// ── Badge gradient + icon lookup (matches badges page design) ─────────────────

interface MiniBadgeSpec { gradient: string; icon: React.ReactNode }

function getMiniBadgeSpec(name: string, index: number): MiniBadgeSpec {
  const lc = name.toLowerCase()
  const ICON_SIZE = 14

  if (lc.includes('first') || lc.includes('start') || lc.includes('rocket')) {
    return {
      gradient: 'linear-gradient(135deg,#ff8c5a,#ff6347)',
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2"/>
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
        </svg>
      ),
    }
  }
  if (lc.includes('halfway') || lc.includes('half') || lc.includes('mountain')) {
    return {
      gradient: 'linear-gradient(135deg,#4a9ad4,#7bb8e0)',
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3l4 8 5-5 5 15H2L8 3z"/>
        </svg>
      ),
    }
  }
  if (lc.includes('speed') || lc.includes('fast') || lc.includes('demon')) {
    return {
      gradient: 'linear-gradient(135deg,#7bb8e0,#a8d4f0)',
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
    }
  }
  if (lc.includes('complete') || lc.includes('finish') || lc.includes('setup') || lc.includes('done')) {
    return {
      gradient: 'linear-gradient(135deg,#1a2744,#4a9ad4)',
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
          <path d="M4 22h16"/>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
        </svg>
      ),
    }
  }
  if (lc.includes('trouble') || lc.includes('fix') || lc.includes('debug')) {
    return {
      gradient: 'linear-gradient(135deg,#ff8c5a,#4a9ad4)',
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      ),
    }
  }

  const GRADIENTS = [
    'linear-gradient(135deg,#ff8c5a,#ff6347)',
    'linear-gradient(135deg,#4a9ad4,#7bb8e0)',
    'linear-gradient(135deg,#7bb8e0,#a8d4f0)',
    'linear-gradient(135deg,#ff8c5a,#4a9ad4)',
    'linear-gradient(135deg,#1a2744,#4a9ad4)',
  ]
  return {
    gradient: GRADIENTS[index % GRADIENTS.length],
    icon: (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  }
}

// ── Badges Earned section ─────────────────────────────────────────────────────

function BadgesEarnedSection() {
  const { data } = useStudentBadges()
  const badges = data?.badges ?? []

  if (badges.length === 0) return null

  const earnedCount = badges.filter((b) => b.earned).length

  return (
    <div data-slot="badges-earned" className="px-4 pt-4 pb-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#717182]">
          Badges {earnedCount > 0 ? `(${earnedCount}/${badges.length})` : ''}
        </p>
        <Link
          to="/student/badges"
          className="text-[11px] font-medium text-[#4a9ad4] hover:underline underline-offset-2"
        >
          View all
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge, i) => {
          const spec = getMiniBadgeSpec(badge.name, i)
          return badge.earned ? (
            <div
              key={badge.id}
              title={badge.name}
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: spec.gradient, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
            >
              {spec.icon}
            </div>
          ) : (
            <div
              key={badge.id}
              title={badge.name}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f0f0]"
            >
              <Lock className="h-3.5 w-3.5 text-[#9ca3af]" />
            </div>
          )
        })}
      </div>
      {earnedCount === 0 && (
        <p className="mt-2 text-[11px] text-[#717182]">Complete steps to earn badges</p>
      )}
    </div>
  )
}

// ── Main sidebar panel ────────────────────────────────────────────────────────

interface StudentSidebarPanelProps {
  /** Called when a step row is clicked */
  onStepClick: (stepId: string) => void
}

function StudentSidebarPanel({ onStepClick }: StudentSidebarPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data, error } = await studentApi.getDashboard()
      if (error) throw new Error(error.message ?? 'Failed to load dashboard')
      return data!
    },
  })

  return (
    <div data-slot="student-sidebar-panel" className="flex flex-col h-full">
      {/* Progress header */}
      <div className="px-4 pt-5 pb-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#717182]">
          Your Setup Progress
        </p>
        {/* Progress bar */}
        {isLoading && (
          <div className="h-2 w-full animate-pulse rounded-full bg-[#e5e7eb]" />
        )}
        {data && (
          <>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#ececf0]">
              <div
                className="h-full rounded-full bg-[#4a9ad4] transition-all duration-300"
                style={{
                  width: `${data.totalSteps > 0 ? Math.round((data.completedSteps / data.totalSteps) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[12px] text-[#717182]">
                {data.completedSteps} of {data.totalSteps} steps complete
              </span>
              <span className="text-[12px] font-semibold text-[#1a2744]">
                {data.totalSteps > 0
                  ? `${Math.round((data.completedSteps / data.totalSteps) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Step list */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-[#e5e7eb]" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-[#e5e7eb]" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-[#e5e7eb]" />
                </div>
              </div>
            ))}
          </div>
        )}
        {data && data.steps.length > 0 && (
          <>
            <SidebarStepList
              steps={data.steps as SidebarStep[]}
              onStepClick={onStepClick}
            />
            {/* Completion CTA — shown when all steps are verified */}
            {data.dashboardState === 'COMPLETE' && (
              <Link
                to="/student/completion"
                className="mt-1 flex items-center gap-[10px] rounded-[8px] px-3 py-[10px] transition-colors hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 mt-px">
                  <Award className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white leading-snug">Setup Complete! 🎉</p>
                  <p className="text-[11px] text-white/80 mt-0.5">View your certificate</p>
                </div>
              </Link>
            )}
          </>
        )}
      </div>

      {/* Book a Support Call — PBA-334 */}
      <div className="border-t border-border px-4 py-3">
        <Link
          to="/student/agents"
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Book a Support Call</span>
        </Link>
      </div>

      {/* Badges Earned — pinned to bottom */}
      <div className="border-t border-border">
        <BadgesEarnedSection />
      </div>
    </div>
  )
}

export { StudentSidebarPanel }
