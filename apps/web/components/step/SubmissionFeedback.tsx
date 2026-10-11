'use client'

// PBA-147 — SubmissionFeedback component (ML validation result screens)
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Video,
} from 'lucide-react'
import { studentApi } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useSubmissionSocket } from '@/hooks/use-socket'
import { Button } from '../../components/ui/button'

type FeedbackState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HUMAN_REVIEW' | 'ML_PROCESSING'

const ASYNC_TIMEOUT_MS = 60_000 // 60 seconds before switching to async mode

interface SubmissionFeedbackProps {
  stepId: string
  nextStepId: string | null
  initialStatus: string
  initialFeedback: string | null
  submissionId: string
  onWatchVideo: () => void
  onRetryScrollToUpload: () => void
}

function parseFeedbackIntoBullets(feedback: string): string[] {
  return feedback
    .split(/\n|\.(?=\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .slice(0, 8)
}

function SubmissionFeedback({
  stepId,
  nextStepId,
  initialStatus,
  initialFeedback,
  submissionId,
  onWatchVideo,
  onRetryScrollToUpload,
}: SubmissionFeedbackProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [status, setStatus] = useState<FeedbackState>(initialStatus as FeedbackState)
  const [feedback, setFeedback] = useState<string | null>(initialFeedback)
  const [asyncMode, setAsyncMode] = useState(false)

  const isPending = status === 'PENDING' || status === 'ML_PROCESSING'

  // ── Socket.io real-time updates ──────────────────────────────────────────

  const handleSocketUpdate = useCallback(
    (payload: { submissionId: string; status: string; mlFeedback?: string | null }) => {
      if (payload.submissionId !== submissionId) return
      setStatus(payload.status as FeedbackState)
      setFeedback(payload.mlFeedback ?? null)
      // Invalidate step cache so status badge updates too
      void queryClient.invalidateQueries({ queryKey: ['step', stepId] })
      void queryClient.invalidateQueries({ queryKey: ['student-dashboard'] })
    },
    [submissionId, stepId, queryClient],
  )

  useSubmissionSocket(user?.id, handleSocketUpdate)

  // ── Polling fallback (every 10s while pending) ────────────────────────────

  useQuery({
    queryKey: ['submission-latest', stepId],
    queryFn: async () => {
      const { data } = await studentApi.getLatestSubmission(stepId)
      if (data?.submission) {
        setStatus(data.submission.status as FeedbackState)
        setFeedback(data.submission.mlFeedback ?? null)
        // Invalidate step cache so TroubleshooterPanel visibility updates without a page refresh
        void queryClient.invalidateQueries({ queryKey: ['step', stepId] })
        void queryClient.invalidateQueries({ queryKey: ['student-dashboard'] })
      }
      return data
    },
    enabled: isPending && !asyncMode,
    refetchInterval: 10_000,
  })

  // ── Async timeout ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isPending) return
    const timer = setTimeout(() => {
      setAsyncMode(true)
    }, ASYNC_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isPending])

  // ── Retry (reset to show upload zone) ────────────────────────────────────

  function handleRetry() {
    void queryClient.invalidateQueries({ queryKey: ['step', stepId] })
    onRetryScrollToUpload()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isPending && asyncMode) {
    return (
      <AsyncNotificationState />
    )
  }

  if (isPending) {
    return <ProcessingState />
  }

  if (status === 'APPROVED') {
    return (
      <ApprovedState
        nextStepId={nextStepId}
        onNavigate={(id) => void router.push(id ? `/steps/${id}` : '/dashboard')}
      />
    )
  }

  if (status === 'REJECTED') {
    return (
      <RejectedState
        feedback={feedback}
        onRetry={handleRetry}
        onWatchVideo={onWatchVideo}
      />
    )
  }

  if (status === 'HUMAN_REVIEW') {
    return <HumanReviewState />
  }

  return null
}

// ── Sub-states ────────────────────────────────────────────────────────────────

function ProcessingState() {
  return (
    <div
      data-slot="submission-feedback"
      className="flex flex-col items-center space-y-4 rounded-xl border border-border bg-card p-8 text-center"
    >
      <Loader2 className="h-10 w-10 animate-spin text-[#4a9ad4]" />
      <div>
        <p className="font-medium text-foreground">Checking your screenshot...</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This usually takes 10–30 seconds. Please don&apos;t close this page.
        </p>
      </div>
    </div>
  )
}

function AsyncNotificationState() {
  return (
    <div
      data-slot="submission-feedback"
      className="flex flex-col items-center space-y-4 rounded-xl border border-border bg-card p-8 text-center"
    >
      <Clock className="h-10 w-10 text-amber-500" />
      <div>
        <p className="font-medium text-foreground">Still processing...</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll notify you by email when your step is reviewed. You can safely close this page.
        </p>
      </div>
    </div>
  )
}

function ApprovedState({
  nextStepId,
  onNavigate,
}: {
  nextStepId: string | null
  onNavigate: (id: string | null) => void
}) {
  const router = useRouter()
  // Last step — show full completion celebration
  if (!nextStepId) {
    return (
      <div
        data-slot="submission-feedback"
        className="overflow-hidden rounded-xl border-2 border-green-300 text-center"
        style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 100%)' }}
      >
        {/* Celebration header */}
        <div className="px-8 pt-8 pb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-lg" style={{ boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}>
            <Award className="h-8 w-8 text-white" />
          </div>
          <p className="text-2xl font-bold text-green-800">Setup Complete! 🎉</p>
          <p className="mt-2 text-sm text-green-700">
            You&apos;ve verified all steps. Your certificate is ready.
          </p>
        </div>

        {/* CTA */}
        <div className="border-t border-green-200 bg-white/60 px-8 py-5">
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white text-base py-5"
            style={{ boxShadow: '0 4px 14px rgba(34,197,94,0.35)' }}
            onClick={() => void router.push('/student/completion')}
          >
            <Award className="mr-2 h-5 w-5" />
            View Your Certificate
          </Button>
          <button
            type="button"
            onClick={() => onNavigate(null)}
            className="mt-3 text-sm text-green-700 hover:underline"
          >
            Go to dashboard →
          </button>
        </div>
      </div>
    )
  }

  // Normal step — continue to next
  return (
    <div
      data-slot="submission-feedback"
      className="flex flex-col items-center space-y-4 rounded-xl border-2 border-green-300 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-950/30"
    >
      <CheckCircle2 className="h-12 w-12 text-green-500" />
      <div>
        <p className="text-lg font-medium text-green-700 dark:text-green-400">Step complete!</p>
        <p className="mt-1 text-sm text-green-600 dark:text-green-500">
          Your screenshot has been verified. Great work!
        </p>
      </div>
      <Button
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        onClick={() => onNavigate(nextStepId)}
      >
        Continue to Next Step
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

function RejectedState({
  feedback,
  onRetry,
  onWatchVideo,
}: {
  feedback: string | null
  onRetry: () => void
  onWatchVideo: () => void
}) {
  const bullets = feedback ? parseFeedbackIntoBullets(feedback) : []

  return (
    <div
      data-slot="submission-feedback"
      className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-300">Screenshot needs a fix</p>
          {feedback && (
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">{feedback}</p>
          )}
        </div>
      </div>

      {bullets.length > 0 && (
        <ul className="space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-400">
          {bullets.map((b, i) => (
            <li key={i} className="list-disc">
              {b}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <Button variant="default" className="w-full" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button variant="outline" className="w-full" onClick={onWatchVideo}>
          <Video className="mr-2 h-4 w-4" />
          Watch the video again
        </Button>
        <Link
 href="/student/agents"
          className="text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Still stuck? Get support
        </Link>
      </div>
    </div>
  )
}

function HumanReviewState() {
  return (
    <div
      data-slot="submission-feedback"
      className="flex flex-col items-center space-y-4 rounded-xl border border-border bg-card p-8 text-center"
    >
      <Clock className="h-10 w-10 text-[#4a9ad4]" />
      <div>
        <p className="font-medium text-foreground">Under manual review</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Our team is reviewing your screenshot. You&apos;ll receive an email with the result within
          24 hours.
        </p>
      </div>
    </div>
  )
}

export { SubmissionFeedback }
