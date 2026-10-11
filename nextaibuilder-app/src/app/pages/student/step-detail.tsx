// PBA-145 — Step Detail page (Instructions + Video + Verify Setup tabs)
// PBA-276 — Refactored to use shared step components
// PBA-296 — Step header (44px circle, 22px title, blue pill badge, pill tab bar)
// PBA-297 — Bottom navigation bar (Previous outlined / Next orange)
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckSquare,
  Clock,
  Lock,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { studentApi } from '../../../lib/api-client'
import { Button } from '../../components/ui/button'
import { ScreenshotUploadZone } from '../../components/step/ScreenshotUploadZone'
import { SubmissionFeedback } from '../../components/step/SubmissionFeedback'
import { StepInstructionsTab } from '../../components/step/StepInstructionsTab'
import { StepVideoTab } from '../../components/step/StepVideoTab'
import { TroubleshooterPanel } from '../../components/step/troubleshooter-panel'

type StepTab = 'instructions' | 'verify'

// ── Loading skeleton ──────────────────────────────────────────────────────────

function StepSkeleton() {
  return (
    <div className="animate-pulse" style={{ background: '#f7f8fa' }}>
      {/* Header skeleton — white bg matching real header */}
      <div className="bg-white px-10 pt-8 pb-6 border-b" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
        <div className="flex items-center gap-2 mb-5">
          <div className="h-3.5 w-16 rounded bg-muted" />
          <div className="h-3 w-1 rounded bg-muted" />
          <div className="h-5 w-24 rounded-full bg-muted" />
        </div>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-3 pt-0.5">
            <div className="h-7 w-72 rounded-md bg-muted" />
            <div className="flex gap-2">
              <div className="h-5 w-20 rounded-full bg-muted" />
              <div className="h-5 w-16 rounded-full bg-muted" />
            </div>
          </div>
        </div>
        <div className="mt-5 h-10 w-80 rounded-xl bg-muted" />
      </div>
      {/* Content skeleton — in the padded content area */}
      <div className="px-10 pt-6 space-y-3">
        <div className="rounded-2xl bg-white p-7 space-y-3 border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 rounded bg-muted" style={{ width: `${82 + (i % 3) * 6}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Locked state ──────────────────────────────────────────────────────────────

function LockedState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center space-y-5 py-20 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: '#f3f3f5' }}
      >
        <Lock className="h-7 w-7 text-[#717182]" />
      </div>
      <div>
        <h2 className="text-[18px] font-medium text-[#1a2744]">Step Locked</h2>
        <p className="mt-1.5 text-[14px] text-[#717182]">
          Complete the previous step to unlock this one.
        </p>
      </div>
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>
    </div>
  )
}

// ── PBA-296: Step header ──────────────────────────────────────────────────────

type StepStatus = 'LOCKED' | 'UNLOCKED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETE' | 'OVERRIDE_PASS' | 'OVERRIDE_FAIL'

function StepHeaderBadge({ status }: { status: StepStatus | 'UNLOCKED' }) {
  switch (status) {
    case 'IN_PROGRESS':
    case 'UNLOCKED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium text-[#4a9ad4]" style={{ background: 'rgba(74,154,212,0.1)' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#4a9ad4]" />
          In Progress
        </span>
      )
    case 'COMPLETE':
    case 'OVERRIDE_PASS':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium text-[#16a34a]" style={{ background: 'rgba(22,163,74,0.08)' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
          Complete
        </span>
      )
    case 'PENDING_REVIEW':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium text-amber-700" style={{ background: 'rgba(217,119,6,0.08)' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Under Review
        </span>
      )
    default:
      return null
  }
}

// ── PBA-296: Pill tab bar ─────────────────────────────────────────────────────

const TABS: { key: StepTab; label: string; Icon: React.FC<{ className?: string; style?: React.CSSProperties }> }[] = [
  { key: 'instructions', label: 'Instructions', Icon: BookOpen },
  { key: 'verify', label: 'Verify Setup', Icon: CheckSquare },
]

function StepTabBar({
  activeTab,
  onChange,
}: {
  activeTab: StepTab
  onChange: (tab: StepTab) => void
}) {
  return (
    <div
      className="inline-flex gap-0.5 rounded-[12px] p-[3px]"
      style={{ background: '#e8eaee' }}
      role="tablist"
      aria-label="Step content tabs"
    >
      {TABS.map(({ key, label, Icon }) => {
        const isActive = activeTab === key
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-[9px] px-4 py-[7px] text-[13px] font-medium transition-all duration-150',
              isActive
                ? 'bg-white text-[#1a2744] shadow-sm'
                : 'text-[#717182] hover:text-[#1a2744] hover:bg-white/60',
            )}
            style={isActive ? {
              boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
            } : undefined}
          >
            <Icon
              className="h-[14px] w-[14px] shrink-0"
              style={{ color: isActive ? '#4a9ad4' : 'currentColor' }}
            />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Tab navigation button (Instructions → Video → Verify) ────────────────────

function TabNextButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-5 py-4 text-left transition-all hover:opacity-90 active:scale-[0.99]"
      style={{ background: 'linear-gradient(135deg, #1a2744 0%, #2d4a8a 100%)' }}
    >
      <div>
        <p className="text-[14px] font-semibold text-white leading-snug">Next: {label}</p>
        <p className="text-[12px] text-white/70 mt-0.5">Continue to the next section</p>
      </div>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'rgba(255,255,255,0.15)' }}
      >
        <ArrowRight className="h-4 w-4 text-white" aria-hidden="true" />
      </div>
    </button>
  )
}

// ── PBA-297: Bottom navigation bar ────────────────────────────────────────────

function StepBottomNav({
  prevStepId,
  nextStepId,
  prevStepTitle,
  nextStepTitle,
  isStepComplete,
  onNavigate,
}: {
  prevStepId: string | null
  nextStepId: string | null
  prevStepTitle?: string
  nextStepTitle?: string
  /** Next-step button is hidden until this step is verified complete */
  isStepComplete: boolean
  onNavigate: (stepId: string) => void
}) {
  const hasPrev = !!prevStepId
  const hasNext = !!nextStepId && isStepComplete

  if (!hasPrev && !hasNext) return null

  return (
    <div
      className="flex items-center justify-between px-11 py-4 bg-white border-t shrink-0"
      style={{ borderColor: 'rgba(0,0,0,0.08)' }}
    >
      <div>
        {hasPrev && prevStepId && (
          <button
            type="button"
            onClick={() => onNavigate(prevStepId)}
            className="inline-flex items-center gap-2 h-[38px] rounded-[8px] border border-black/10 bg-white px-4 text-[14px] font-medium text-[#717182] transition-all hover:text-[#1a2744] hover:border-black/20"
          >
            <ArrowLeft className="h-4 w-4" />
            {prevStepTitle ? `Previous: ${prevStepTitle}` : 'Previous'}
          </button>
        )}
      </div>
      <div>
        {hasNext && nextStepId && (
          <button
            type="button"
            onClick={() => onNavigate(nextStepId)}
            className="inline-flex items-center gap-2 h-[38px] rounded-[8px] bg-[#ff8c5a] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#ff6347]"
            style={{ boxShadow: '0 2px 8px rgba(255,140,90,0.3)' }}
          >
            {nextStepTitle ? `Next: ${nextStepTitle}` : 'Next'}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main step detail page ─────────────────────────────────────────────────────

export function StepDetailPage() {
  const { stepId } = useParams<{ stepId: string }>()
  const navigate = useNavigate()
  const [tabState, setTabState] = useState<{ tab: StepTab; forStepId: string | undefined }>({
    tab: 'instructions',
    forStepId: stepId,
  })
  // When stepId changes, derive back to 'instructions' without an effect
  const activeTab: StepTab = tabState.forStepId === stepId ? tabState.tab : 'instructions'
  const setActiveTab = (tab: StepTab) => setTabState({ tab, forStepId: stepId })
  const uploadZoneRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['step', stepId],
    queryFn: async () => {
      const { data, error } = await studentApi.getStep(stepId!)
      if (error) throw new Error(error.message ?? 'Failed to load step')
      return data!
    },
    enabled: !!stepId,
  })

  // Pull step titles from cached dashboard to show in nav bar
  const { data: dashboardData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data, error } = await studentApi.getDashboard()
      if (error) throw new Error(error.message ?? 'Failed to load dashboard')
      return data!
    },
  })

  useEffect(() => {
    if (data?.step) {
      document.title = `Step ${data.step.order}: ${data.step.title} — Setup Companion`
    }
  }, [data])

  if (isLoading) return <StepSkeleton />
  if (isError) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <LockedState onBack={() => void navigate('/dashboard')} />
      </div>
    )
  }
  if (!data) return null

  const { step, prevStepId, nextStepId } = data
  const isLocked = step.status === 'LOCKED'

  if (isLocked) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <LockedState onBack={() => void navigate('/dashboard')} />
      </div>
    )
  }

  // Derive prev/next step titles from cached dashboard steps list
  const dashSteps = dashboardData?.steps ?? []
  const prevStepTitle = prevStepId
    ? dashSteps.find((s) => s.id === prevStepId)?.title
    : undefined
  const nextStepTitle = nextStepId
    ? dashSteps.find((s) => s.id === nextStepId)?.title
    : undefined

  function handleNavigate(id: string) {
    setActiveTab('instructions')
    void navigate(`/steps/${id}`)
  }

  // Compute step X of Y from dashboard steps
  const totalSteps = dashSteps.length
  const currentStepIndex = dashSteps.findIndex((s) => s.id === stepId)
  const stepPosition = currentStepIndex >= 0 ? currentStepIndex + 1 : step.order

  return (
    <div className="flex h-full flex-col" style={{ background: '#f7f8fa' }}>
      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#f7f8fa' }}>

        {/* ── Step header section ── */}
        <div className="px-10 pt-8 pb-0 bg-white" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>

          {/* Breadcrumb — step position pill */}
          {totalSteps > 0 && (
            <div className="mb-5 flex items-center gap-2">
              <span className="text-[12px] font-medium text-[#4a9ad4]">Setup Companion</span>
              <span aria-hidden="true" className="text-[#d4d6db] text-[12px]">/</span>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-[#717182]"
                style={{ background: '#f3f3f5' }}
              >
                Step {stepPosition} of {totalSteps}
              </span>
            </div>
          )}

          {/* Title row */}
          <div className="flex items-start gap-4 pb-6">
            {/* Step number circle — 48px, deep navy, prominent */}
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{
                background: '#1a2744',
                boxShadow: '0 2px 8px rgba(26,39,68,0.25)',
              }}
            >
              <span className="text-[17px] font-bold text-white leading-none">{step.order}</span>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              {/* Step title */}
              <h1 className="text-[22px] font-semibold leading-[1.3] text-[#1a2744] tracking-[-0.015em]">
                {step.title}
              </h1>
              {/* Status badge + time row */}
              <div className="mt-3 flex items-center gap-2.5 flex-wrap">
                <StepHeaderBadge status={step.status} />
                {step.estimatedMinutes != null && (
                  <span
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[12px] text-[#717182]"
                    style={{ background: '#f3f3f5' }}
                  >
                    <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    ~{step.estimatedMinutes} min
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Tab bar — flush to bottom of header, overlaps the border ── */}
          <div className="-mb-[1px]">
            <StepTabBar activeTab={activeTab} onChange={setActiveTab} />
          </div>
        </div>

        {/* ── Tab content area ── */}
        <div className="px-10 pt-6 pb-12">
          {activeTab === 'instructions' && (
            <div className="space-y-6">
              {/* Video embedded at top of instructions tab */}
              {step.videoUrl && (
                <StepVideoTab
                  videoUrl={step.videoUrl}
                  videoTranscript={step.videoTranscript}
                />
              )}
              <StepInstructionsTab
                description={step.description}
                screenshotCriteria={step.screenshotCriteria}
                checklist={step.checklist}
                whyItMatters={step.whyItMatters}
                quickReferenceChecklist={step.quickReferenceChecklist}
                keyLinks={step.keyLinks}
                estimatedMinutes={step.estimatedMinutes}
                isPreview={false}
                stepId={stepId}
              />
              {/* Tab navigation: Instructions → Verify Setup */}
              <TabNextButton label="Verify Setup" onClick={() => setActiveTab('verify')} />
            </div>
          )}
          {activeTab === 'verify' && stepId && (
            <div className="space-y-6">
              {/* Upload zone: shown when no submission yet, or when the last one was rejected
                  (so the student can immediately drop a new file after seeing the error).
                  Hidden during PENDING / ML_PROCESSING / APPROVED / HUMAN_REVIEW so
                  SubmissionFeedback is the single source of truth for post-submit UI. */}
              {(!step.latestSubmission || step.latestSubmission.status === 'REJECTED') && (
                <div ref={uploadZoneRef}>
                  <ScreenshotUploadZone stepId={stepId} screenshotCriteria={step.screenshotCriteria} />
                </div>
              )}
              {step.latestSubmission && (
                <SubmissionFeedback
                  key={step.latestSubmission.id}
                  stepId={stepId}
                  nextStepId={nextStepId}
                  initialStatus={step.latestSubmission.status}
                  initialFeedback={step.latestSubmission.mlFeedback}
                  submissionId={step.latestSubmission.id}
                  onWatchVideo={() => setActiveTab('instructions')}
                  onRetryScrollToUpload={() =>
                    uploadZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                />
              )}
              {/* PBA-316: AI Troubleshooter — shown only after a failed or flagged submission */}
              {(step.latestSubmission?.status === 'REJECTED' ||
                step.latestSubmission?.status === 'HUMAN_REVIEW') &&
                step.latestSubmission?.id && (
                  <TroubleshooterPanel
                    stepId={step.id}
                    submissionId={step.latestSubmission.id}
                  />
                )}
            </div>
          )}
        </div>
      </div>

      {/* ── PBA-297: Bottom navigation bar — in normal flow, not fixed ── */}
      <StepBottomNav
        prevStepId={prevStepId}
        nextStepId={nextStepId}
        prevStepTitle={prevStepTitle}
        nextStepTitle={nextStepTitle}
        isStepComplete={step.status === 'COMPLETE' || step.status === 'OVERRIDE_PASS'}
        onNavigate={handleNavigate}
      />
    </div>
  )
}
