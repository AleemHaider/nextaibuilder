// PBA-130 — Admin Review Detail page (Sprint 3)
// Displays full submission context and approve/reject action panel.
// PBA-237 — PermissionGate applied to review actions
import * as React from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  ArrowLeft,
  User,
  BookOpen,
  ImageIcon,
  Brain,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCcw,
  ExternalLink,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import {
  useAdminSubmission,
  useReviewSubmission,
  type SubmissionStatus,
} from '@/hooks/use-admin-submissions'
import { cn } from '@/lib/utils'
import { PermissionGate } from '@/app/components/ui/permission-gate'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(first: string | undefined, last: string | undefined) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

function mlScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-destructive'
}

function statusBadgeVariant(
  status: SubmissionStatus
): 'warning' | 'success' | 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'PENDING':         return 'secondary'
    case 'ML_PROCESSING':   return 'warning'
    case 'HUMAN_REVIEW':    return 'warning'
    case 'APPROVED':        return 'success'
    case 'REJECTED':        return 'destructive'
    default:                return 'outline'
  }
}

function statusLabel(status: SubmissionStatus): string {
  switch (status) {
    case 'PENDING':         return 'Pending'
    case 'ML_PROCESSING':   return 'Processing'
    case 'HUMAN_REVIEW':    return 'Awaiting Review'
    case 'APPROVED':        return 'Approved'
    case 'REJECTED':        return 'Rejected'
    default:                return status
  }
}

function statusIcon(status: SubmissionStatus) {
  switch (status) {
    case 'APPROVED':        return CheckCircle2
    case 'REJECTED':        return XCircle
    case 'ML_PROCESSING':   return RefreshCcw
    default:                return Clock
  }
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-40 rounded-xl bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
          <div className="h-32 rounded-xl bg-muted" />
        </div>
        <div className="space-y-6">
          <div className="h-48 rounded-xl bg-muted" />
          <div className="h-56 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  )
}

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}

// ── Rejection dialog ───────────────────────────────────────────────────────────

interface RejectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (note: string) => void
  isSubmitting: boolean
}

function RejectionDialog({ open, onOpenChange, onConfirm, isSubmitting }: RejectionDialogProps) {
  const [note, setNote] = React.useState('')
  const isValid = note.trim().length >= 10

  function handleConfirm() {
    if (!isValid) return
    onConfirm(note.trim())
  }

  // Reset note when dialog closes
  React.useEffect(() => {
    if (!open) setNote('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject submission</DialogTitle>
          <DialogDescription>
            Provide a reason for rejection. This note will be visible to the student.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder="Explain why this submission is being rejected and what the student needs to do differently (min. 10 characters)…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[120px]"
            aria-label="Rejection reason"
            aria-invalid={note.length > 0 && !isValid}
            disabled={isSubmitting}
            autoFocus
          />
          {note.length > 0 && !isValid && (
            <p className="text-xs text-destructive" role="alert">
              Please provide at least 10 characters.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Rejecting…' : 'Confirm rejection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function AdminReviewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [screenshotError, setScreenshotError] = React.useState(false)

  const { data: submission, isLoading, isError, error } = useAdminSubmission(id ?? '')
  const reviewMutation = useReviewSubmission()

  const isAlreadyReviewed =
    submission?.status === 'APPROVED' || submission?.status === 'REJECTED'

  async function handleApprove() {
    if (!id) return
    try {
      await reviewMutation.mutateAsync({ id, payload: { status: 'APPROVED' } })
      toast.success('Submission approved')
      void navigate('/admin/review-queue')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve submission')
    }
  }

  async function handleReject(note: string) {
    if (!id) return
    try {
      await reviewMutation.mutateAsync({ id, payload: { status: 'REJECTED', adminNote: note } })
      setRejectOpen(false)
      toast.error('Submission rejected', {
        description: 'The student has been notified.',
      })
      void navigate('/admin/review-queue')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject submission')
    }
  }

  if (isLoading) {
    return (
      <div data-slot="admin-review-detail-page" className="space-y-6">
        <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
        <DetailSkeleton />
      </div>
    )
  }

  if (isError || !submission) {
    return (
      <div data-slot="admin-review-detail-page" className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigate('/admin/review-queue')}
          className="gap-2 -ml-2 h-8 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to queue
        </Button>

        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <XCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">Submission not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'This submission may have been deleted or does not exist.'}
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">ID: {id ?? 'none'}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void navigate('/admin/review-queue')}
            className="mt-4"
          >
            Return to queue
          </Button>
        </div>
      </div>
    )
  }

  const { student, step, status, mlScore, mlFeedback, screenshotUrl, attemptCount = 0, createdAt, reviewedAt, adminNote } = submission
  const fullName = `${student.firstName} ${student.lastName}`.trim()
  const initials = getInitials(student.firstName, student.lastName)
  return (
    <div data-slot="admin-review-detail-page" className="space-y-6">

      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void navigate('/admin/review-queue')}
        className="gap-2 -ml-2 h-8 text-muted-foreground hover:text-foreground"
        aria-label="Back to review queue"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to queue
      </Button>

      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-foreground">Review Submission</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Step {step.order} — {step.title}
          </p>
        </div>
        <Badge variant={statusBadgeVariant(status)} className="shrink-0">
          {React.createElement(statusIcon(status), { className: 'h-3 w-3', 'aria-hidden': 'true' })}
          {statusLabel(status)}
        </Badge>
      </div>

      {/* Already reviewed banner */}
      {isAlreadyReviewed && (
        <div className={cn(
          'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
          status === 'APPROVED'
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-destructive'
        )}>
          {React.createElement(statusIcon(status), { className: 'h-4 w-4 mt-0.5 shrink-0', 'aria-hidden': 'true' })}
          <div>
            <span className="font-medium">
              {status === 'APPROVED' ? 'Approved' : 'Rejected'}
            </span>
            {reviewedAt && (
              <span className="ml-1.5 opacity-70">
                {format(new Date(reviewedAt), 'MMM d, yyyy')}
              </span>
            )}
            {adminNote && (
              <p className="mt-1 opacity-80">{adminNote}</p>
            )}
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── Left column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Screenshot */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </div>
                <CardTitle className="text-sm">Submitted Screenshot</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {screenshotError || !screenshotUrl ? (
                <div className="flex flex-col items-center justify-center aspect-video rounded-lg border border-dashed border-border bg-muted/40 text-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">Screenshot unavailable</p>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20">
                  <img
                    src={screenshotUrl}
                    alt={`Screenshot submitted by ${fullName} for step ${step.order}`}
                    className="w-full object-contain max-h-[480px]"
                    onError={() => setScreenshotError(true)}
                    loading="lazy"
                  />
                  <a
                    href={screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80 transition-colors"
                    aria-label="Open screenshot in new tab"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    Full size
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step criteria */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle className="text-sm">Step {step.order} — {step.title}</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">Screenshot criteria</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {step.screenshotCriteria}
              </p>
            </CardContent>
          </Card>

          {/* ML Result */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  <Brain className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </div>
                <CardTitle className="text-sm">ML Analysis</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Score display */}
              <div className="flex items-end gap-3">
                <div aria-label={`ML score: ${mlScore ?? 'not available'}`}>
                  <span className={cn('text-5xl font-bold tabular-nums leading-none', mlScoreColor(mlScore))}>
                    {mlScore !== null ? mlScore : '—'}
                  </span>
                  {mlScore !== null && (
                    <span className="text-lg text-muted-foreground ml-1">/ 100</span>
                  )}
                </div>
                {mlScore !== null && (
                  <Badge
                    variant={mlScore >= 80 ? 'success' : mlScore >= 60 ? 'warning' : 'destructive'}
                    className="mb-1"
                  >
                    {mlScore >= 80 ? 'Strong pass' : mlScore >= 60 ? 'Borderline' : 'Likely fail'}
                  </Badge>
                )}
              </div>

              {/* ML Feedback */}
              {mlFeedback ? (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                    AI feedback
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">{mlFeedback}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No ML feedback available.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column (1/3) ── */}
        <div className="space-y-6">

          {/* Student info */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </div>
                <CardTitle className="text-sm">Student</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={student.avatarUrl ?? undefined} alt={fullName} />
                  <AvatarFallback className="text-sm font-medium bg-secondary text-secondary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2">
                <InfoRow
                  label="Attempt"
                  value={
                    <span>
                      #{attemptCount}
                      {attemptCount > 1 && (
                        <span className="ml-1.5 text-xs text-amber-600 font-medium">
                          ({attemptCount} attempts)
                        </span>
                      )}
                    </span>
                  }
                />
                <InfoRow
                  label="Submitted"
                  value={formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                />
                <InfoRow
                  label="Date"
                  value={format(new Date(createdAt), 'MMM d, yyyy HH:mm')}
                />
                {submission.cohort && (
                  <InfoRow label="Cohort" value={submission.cohort.name} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Review Action</CardTitle>
              <CardDescription className="text-xs">
                {isAlreadyReviewed
                  ? 'This submission has already been reviewed.'
                  : 'Approve or reject this submission. The student will be notified.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {isAlreadyReviewed ? (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Reviewed {reviewedAt ? format(new Date(reviewedAt), 'MMM d, yyyy') : ''}
                  </p>
                  {adminNote && (
                    <p className="text-sm text-foreground mt-1">{adminNote}</p>
                  )}
                </div>
              ) : (
                <PermissionGate
                  permission="submissions:review"
                  fallback={
                    <p className="text-sm text-muted-foreground text-center py-2">
                      You don't have permission to review submissions.
                    </p>
                  }
                >
                  <Button
                    className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => void handleApprove()}
                    disabled={reviewMutation.isPending}
                    aria-label="Approve this submission"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {reviewMutation.isPending ? 'Processing…' : 'Approve'}
                  </Button>

                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => setRejectOpen(true)}
                    disabled={reviewMutation.isPending}
                    aria-label="Reject this submission"
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    Reject
                  </Button>
                </PermissionGate>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Rejection dialog */}
      <RejectionDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={(note) => void handleReject(note)}
        isSubmitting={reviewMutation.isPending}
      />

    </div>
  )
}

export { AdminReviewDetailPage }
