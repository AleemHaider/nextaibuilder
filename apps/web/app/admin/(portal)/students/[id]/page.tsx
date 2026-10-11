'use client'
// PBA-131 — Admin Student Detail page
// PBA-237 — PermissionGate applied to override actions
// PBA-288 — Invite status badge, resend/revoke invite actions
// PBA-355 — Tabbed layout: Overview / Step History / Screenshots / Activity Log
// PBA-356 — Horizontal hero header: breadcrumb, 64px avatar + status dot, info pills, action buttons
// PBA-359 — More-actions dropdown with AlertDialog for destructive "Remove from Cohort" action
// PBA-361 — completedAt timestamp on step cards, attempt count badge, "X of N steps complete" label
// PBA-360 — Activity Log tab: timeline of student + admin events with pagination and type filter
// PBA-386 — Remove dead Manual Override header button; add Note textarea to per-step override; Transfer to Cohort dialog; Reset Progress AlertDialog
// PBA-387 — Transfer to Cohort dialog
// PBA-388 — Reset Progress AlertDialog
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  AlertCircle,
  AlertTriangle,
  GraduationCap,
  Calendar,
  ExternalLink,
  ChevronDown,
  CheckCheck,
  X,
  RefreshCw,
  Ban,
  MoreHorizontal,
  Send,
  Users,
  RotateCcw,
  UserMinus,
  ImageIcon,
  Filter,
  Unlock,
  Upload,
  UserCheck,
  Mail,
  LogIn,
  Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { getInitials, formatRelative } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import { InviteStatusBadge } from '@/components/admin/invite-status-badge'
import { apiFetch } from '@/store/auth'
import {
  useAdminStudent,
  useResendInvite,
  useRevokeInvite,
  useStudentActivityLog,
  useAdminCohorts,
  useTransferStudent,
  useResetStudentProgress,
  type AdminStudentStepProgress,
  type AdminStudentSubmission,
  type HealthStatus,
  type ActivityEvent,
} from '@/hooks/use-admin-students'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PermissionGate } from '@/components/ui/permission-gate'
import { useStudentPresence } from '@/hooks/use-student-presence'

// ── Override mutation ─────────────────────────────────────────────────────────

function useOverrideStudentStep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      studentStepId,
      status,
      note,
    }: {
      studentStepId: string
      status: 'OVERRIDE_PASS' | 'OVERRIDE_FAIL'
      note?: string
    }) =>
      apiFetch(`/api/admin/student-steps/${studentStepId}/override`, {
        method: 'POST',
        body: JSON.stringify({ status, note }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'students'] })
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateShort(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

// ── Step status helpers ───────────────────────────────────────────────────────

function StepStatusIcon({ status, className }: { status: string; className?: string }) {
  switch (status) {
    case 'COMPLETE':
    case 'OVERRIDE_PASS':
      return <CheckCircle2 className={cn('h-4 w-4 text-green-600', className)} aria-hidden="true" />
    case 'PENDING_REVIEW':
      return <Clock className={cn('h-4 w-4 text-amber-500', className)} aria-hidden="true" />
    case 'IN_PROGRESS':
      return <AlertCircle className={cn('h-4 w-4 text-blue-500', className)} aria-hidden="true" />
    case 'OVERRIDE_FAIL':
      return <XCircle className={cn('h-4 w-4 text-destructive', className)} aria-hidden="true" />
    default:
      return <Circle className={cn('h-4 w-4 text-muted-foreground', className)} aria-hidden="true" />
  }
}

function getStepStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    LOCKED: 'Locked',
    UNLOCKED: 'Not started',
    IN_PROGRESS: 'In progress',
    PENDING_REVIEW: 'Pending review',
    COMPLETE: 'Completed',
    OVERRIDE_PASS: 'Override pass',
    OVERRIDE_FAIL: 'Override fail',
  }
  return labels[status] ?? status
}

function getStepStatusVariant(
  status: string,
): 'success' | 'warning' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'COMPLETE':
    case 'OVERRIDE_PASS':
      return 'success'
    case 'PENDING_REVIEW':
      return 'warning'
    case 'IN_PROGRESS':
      return 'secondary'
    case 'OVERRIDE_FAIL':
      return 'destructive'
    default:
      return 'outline'
  }
}

// ── Invite actions (PBA-288) ──────────────────────────────────────────────────

function InviteActions({
  studentId,
  inviteStatus,
}: {
  studentId: string
  inviteStatus: 'PENDING' | 'ACCEPTED' | 'REVOKED' | undefined
}) {
  const [showRevokeDialog, setShowRevokeDialog] = React.useState(false)
  const resendMutation = useResendInvite(studentId)
  const revokeMutation = useRevokeInvite(studentId)

  if (!inviteStatus || inviteStatus !== 'PENDING') return null

  async function handleResend() {
    try {
      await resendMutation.mutateAsync()
      toast.success('Invite resent.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invite.')
    }
  }

  async function handleRevoke() {
    try {
      await revokeMutation.mutateAsync()
      setShowRevokeDialog(false)
      toast.success('Invite revoked.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invite.')
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1.5"
          onClick={() => void handleResend()}
          disabled={resendMutation.isPending || revokeMutation.isPending}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Resend Invite
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="flex-1 gap-1.5"
          onClick={() => setShowRevokeDialog(true)}
          disabled={resendMutation.isPending || revokeMutation.isPending}
        >
          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
          Revoke Invite
        </Button>
      </div>

      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invite?</AlertDialogTitle>
            <AlertDialogDescription>
              The student will no longer be able to use their invite link. You will need to remove
              and re-invite the student if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleRevoke()}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? 'Revoking…' : 'Revoke Invite'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Hero header (PBA-356 / PBA-353) ──────────────────────────────────────────

function statusDotColor(s: HealthStatus) {
  switch (s) {
    case 'on_track':
    case 'completed':
      return 'bg-green-500'
    case 'at_risk':
      return 'bg-amber-400'
    case 'blocked':
      return 'bg-red-500'
    default:
      return 'bg-muted-foreground/50'
  }
}

function statusPillClasses(s: HealthStatus) {
  switch (s) {
    case 'on_track':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'completed':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'at_risk':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'blocked':
      return 'bg-red-100 text-red-800 border-red-200'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

function statusLabel(s: HealthStatus) {
  const map: Record<HealthStatus, string> = {
    on_track:  'On Track',
    completed: 'Complete',
    at_risk:   'At Risk',
    blocked:   'Blocked',
  }
  return map[s] ?? s
}

interface ProfileHeroProps {
  isLoading: boolean
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string | null
  cohortId?: string | null
  cohortName?: string | null
  status: string
  joinedAt: string | null
  completedSteps: number
  totalSteps: number
  progressPercent: number
  studentId: string
  inviteStatus: 'PENDING' | 'ACCEPTED' | 'REVOKED' | undefined
  isOnline?: boolean
}

// ── Transfer to Cohort Dialog (PBA-387) ───────────────────────────────────────

function TransferCohortDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  currentCohortId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  studentName: string
  currentCohortId: string | null | undefined
}) {
  const [selectedCohortId, setSelectedCohortId] = React.useState<string>('')
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const { data: cohorts, isLoading: cohortsLoading } = useAdminCohorts()
  const transfer = useTransferStudent(studentId)

  // Reset when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setSelectedCohortId('')
      setErrorMsg(null)
    }
  }, [open])

  const isDifferentCohort = selectedCohortId !== '' && selectedCohortId !== currentCohortId

  async function handleTransfer() {
    if (!selectedCohortId || !isDifferentCohort) return
    setErrorMsg(null)
    try {
      await transfer.mutateAsync({ cohortId: selectedCohortId })
      toast.success(`${studentName} transferred successfully.`)
      onOpenChange(false)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transfer failed. Please try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer to Cohort</DialogTitle>
          <DialogDescription>
            Move {studentName} to a different cohort. Their progress will be preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="transfer-cohort-select">Select Cohort</Label>
            <Select
              value={selectedCohortId}
              onValueChange={setSelectedCohortId}
              disabled={cohortsLoading || transfer.isPending}
            >
              <SelectTrigger id="transfer-cohort-select">
                <SelectValue placeholder={cohortsLoading ? 'Loading cohorts…' : 'Select a cohort'} />
              </SelectTrigger>
              <SelectContent>
                {(cohorts ?? []).map((cohort) => (
                  <SelectItem
                    key={cohort.id}
                    value={cohort.id}
                    disabled={cohort.id === currentCohortId}
                  >
                    {cohort.name}
                    {cohort.id === currentCohortId && ' (current)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={transfer.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleTransfer()}
            disabled={!isDifferentCohort || transfer.isPending}
          >
            {transfer.isPending ? 'Transferring…' : 'Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Reset Progress AlertDialog (PBA-388) ──────────────────────────────────────

function ResetProgressDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  studentName: string
}) {
  const [confirmed, setConfirmed] = React.useState(false)
  const reset = useResetStudentProgress(studentId)

  // Reset checkbox when dialog closes
  React.useEffect(() => {
    if (!open) setConfirmed(false)
  }, [open])

  async function handleReset() {
    if (!confirmed) return
    try {
      const result = await reset.mutateAsync()
      toast.success(result?.message ?? 'Progress reset successfully.')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed. Please try again.')
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset Student Progress</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                This will reset all step progress for <span className="font-medium text-foreground">{studentName}</span> to
                locked. Their submitted files will be preserved, but all step statuses and attempt counts will be cleared.
              </p>
              <p className="font-semibold text-foreground">This action cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2 py-2">
          <Checkbox
            id="reset-confirm"
            checked={confirmed}
            onCheckedChange={(v) => setConfirmed(Boolean(v))}
            disabled={reset.isPending}
          />
          <label
            htmlFor="reset-confirm"
            className="text-sm text-foreground cursor-pointer select-none"
          >
            I understand this will reset all progress
          </label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={reset.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={(e) => {
              e.preventDefault()
              void handleReset()
            }}
            disabled={!confirmed || reset.isPending}
          >
            {reset.isPending ? 'Resetting…' : 'Reset Progress'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ProfileHero({
  isLoading,
  firstName,
  lastName,
  email,
  avatarUrl,
  cohortId,
  cohortName,
  status,
  joinedAt,
  completedSteps,
  totalSteps,
  progressPercent,
  studentId,
  inviteStatus,
  isOnline = false,
}: ProfileHeroProps) {
  const [showRemoveDialog, setShowRemoveDialog] = React.useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false)
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false)

  const health: HealthStatus = (status as HealthStatus) ?? 'on_track'
  const initials = firstName && lastName ? getInitials(firstName, lastName) : '?'

  const joinedFormatted = joinedAt
    ? new Date(joinedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  if (isLoading) {
    return (
      <Card data-slot="profile-hero-skeleton">
        <CardContent className="p-6">
          <div className="flex items-start gap-5 flex-wrap sm:flex-nowrap">
            <Skeleton className="h-16 w-16 rounded-full shrink-0" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-60" />
              <div className="flex gap-2 pt-0.5">
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-32 rounded-full" />
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-36 rounded-md" />
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </div>
          <div className="mt-6 pt-5 border-t border-border space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-8" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card data-slot="profile-hero">
        <CardContent className="p-6">
          {/* Top row */}
          <div className="flex items-start gap-5 flex-wrap sm:flex-nowrap">
            {/* Avatar + status dot */}
            <div className="relative shrink-0">
              <Avatar className="h-16 w-16">
                {avatarUrl && (
                  <AvatarImage src={avatarUrl} alt={`${firstName} ${lastName}`} />
                )}
                <AvatarFallback className="text-xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              {/* Presence dot — top-right */}
              <span
                className={cn(
                  'absolute top-0 right-0 h-3 w-3 rounded-full ring-2 ring-white',
                  isOnline ? 'bg-green-500' : 'bg-gray-300',
                )}
                title={isOnline ? 'Online now' : 'Offline'}
                aria-label={isOnline ? 'Online now' : 'Offline'}
              />
              {/* Health status dot — bottom-right */}
              <span
                className={cn(
                  'absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card',
                  statusDotColor(health),
                )}
                aria-label={`Health: ${statusLabel(health)}`}
              />
            </div>

            {/* Name + email + pills */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground leading-snug">
                {firstName} {lastName}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5 mb-3">{email}</p>

              <div className="flex flex-wrap items-center gap-2">
                {cohortName && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border">
                    <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {cohortName}
                  </span>
                )}
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border',
                    statusPillClasses(health),
                  )}
                >
                  <GraduationCap className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {statusLabel(health)}
                </span>
                {joinedFormatted && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border">
                    <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                    Joined {joinedFormatted}
                  </span>
                )}
                <InviteStatusBadge status={inviteStatus} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Send Nudge — placeholder; feature not yet built */}
              <Button
                variant="default"
                size="sm"
                disabled
                className="gap-1.5 cursor-not-allowed opacity-50"
                aria-label="Send nudge (coming soon)"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Send Nudge
              </Button>

              {/* PBA-386: Manual Override header button removed — overrides are per-step in the Step History tab */}

              {/* PBA-359 — more actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => setTransferDialogOpen(true)}
                  >
                    <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    Transfer to Cohort
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => setResetDialogOpen(true)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    Reset Progress
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-destructive focus:text-destructive"
                    onClick={() => setShowRemoveDialog(true)}
                  >
                    <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove from Cohort
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Invite actions for PENDING invite (PBA-288) */}
          {inviteStatus === 'PENDING' && (
            <PermissionGate permission="students:invite">
              <Separator className="mt-5 mb-4" />
              <InviteActions studentId={studentId} inviteStatus={inviteStatus} />
            </PermissionGate>
          )}

          {/* Progress bar — PBA-361: "X of N steps complete" label */}
          <div className="mt-6 pt-5 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                {completedSteps} of {totalSteps} steps complete
              </span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: '#4a9ad4' }}>
                {progressPercent}%
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* PBA-359 — Remove from Cohort confirmation */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from cohort?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {firstName} {lastName} from their current cohort. Their progress
              will be preserved but they will lose access to cohort-specific content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowRemoveDialog(false)
                toast.info('Coming soon')
              }}
            >
              Remove from Cohort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PBA-387 — Transfer to Cohort */}
      <TransferCohortDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        studentId={studentId}
        studentName={`${firstName} ${lastName}`}
        currentCohortId={cohortId}
      />

      {/* PBA-388 — Reset Progress */}
      <ResetProgressDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        studentId={studentId}
        studentName={`${firstName} ${lastName}`}
      />
    </>
  )
}

// ── Step overview card (Overview tab) — PBA-361 ───────────────────────────────

function StepOverviewCard({ step }: { step: AdminStudentStepProgress }) {
  const isDone = step.status === 'COMPLETE' || step.status === 'OVERRIDE_PASS'
  const isInProgress = step.status === 'IN_PROGRESS'
  const isLocked = step.status === 'LOCKED'
  const isPendingReview = step.status === 'PENDING_REVIEW'

  // PBA-361: attempts field (optional — may come from future API expansion)
  const attempts = (step as AdminStudentStepProgress & { attempts?: number }).attempts

  // PBA-361: completedAt — fall back to submittedAt when status is terminal
  const completedAtRaw = (
    step as AdminStudentStepProgress & { completedAt?: string | null }
  ).completedAt
  const completedAt = isDone ? (completedAtRaw ?? step.submittedAt) : null

  const metaLine = (() => {
    if (isDone && completedAt) return `Completed ${formatDateTime(completedAt)}`
    if (isPendingReview && step.submittedAt) return `Submitted ${formatDateTime(step.submittedAt)}`
    if (isInProgress && step.submittedAt) return `Started ${formatDateTime(step.submittedAt)}`
    if (isLocked) return 'Not started'
    return null
  })()

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-opacity',
        isInProgress && 'border-l-[3px] border-l-blue-400',
        isLocked && 'opacity-55',
      )}
    >
      {/* Step number / check circle */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          isDone && 'bg-foreground text-background',
          isInProgress && 'bg-blue-500 text-white',
          isPendingReview && 'bg-amber-400 text-white',
          !isDone && !isInProgress && !isPendingReview && 'bg-muted text-muted-foreground',
        )}
      >
        {isDone ? (
          <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          step.order
        )}
      </div>

      {/* Step info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground leading-snug truncate">
          Step {step.order} — {step.stepTitle}
        </p>
        {metaLine && (
          <p className="text-xs text-muted-foreground mt-0.5">{metaLine}</p>
        )}
      </div>

      {/* Status badge + attempt count */}
      <div className="shrink-0 text-right">
        <Badge variant={getStepStatusVariant(step.status)}>
          {getStepStatusLabel(step.status)}
        </Badge>
        {/* PBA-361: show attempt count badge only when > 1 */}
        {attempts !== undefined && attempts > 1 && (
          <p className="text-xs text-muted-foreground mt-0.5">{ordinal(attempts)} attempt</p>
        )}
      </div>
    </div>
  )
}

// ── Step history item (Step History tab) ──────────────────────────────────────

const OVERRIDABLE_STATUSES = new Set([
  'PENDING_REVIEW',
  'IN_PROGRESS',
  'LOCKED',
  'UNLOCKED',
  'OVERRIDE_FAIL',
])

// ── Override Dialog (PBA-386) ─────────────────────────────────────────────────

function OverrideDialog({
  open,
  onOpenChange,
  stepOrder,
  studentStepId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stepOrder: number
  studentStepId: string
  onSuccess: () => void
}) {
  const [pendingStatus, setPendingStatus] = React.useState<'OVERRIDE_PASS' | 'OVERRIDE_FAIL' | null>(null)
  const [note, setNote] = React.useState('')
  const overrideStep = useOverrideStudentStep()

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setPendingStatus(null)
      setNote('')
    }
  }, [open])

  async function handleSubmit() {
    if (!pendingStatus) return
    try {
      await overrideStep.mutateAsync({
        studentStepId,
        status: pendingStatus,
        note: note.trim() || undefined,
      })
      toast.success(
        pendingStatus === 'OVERRIDE_PASS'
          ? `Step ${stepOrder} marked as pass`
          : `Step ${stepOrder} marked as fail`,
      )
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Override failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override Step {stepOrder}</DialogTitle>
          <DialogDescription>
            Manually set the status for this step. An optional note will be recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Note textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="override-note">Note (optional)</Label>
            <Textarea
              id="override-note"
              placeholder="Reason for override…"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
          </div>

          {/* Status selector */}
          <div className="space-y-1.5">
            <Label>Override Status</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingStatus('OVERRIDE_PASS')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border text-sm font-medium transition-colors',
                  pendingStatus === 'OVERRIDE_PASS'
                    ? 'border-green-500 bg-green-50 text-green-800'
                    : 'border-border bg-background text-foreground hover:bg-accent',
                )}
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark as Pass
              </button>
              <button
                type="button"
                onClick={() => setPendingStatus('OVERRIDE_FAIL')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border text-sm font-medium transition-colors',
                  pendingStatus === 'OVERRIDE_FAIL'
                    ? 'border-destructive bg-red-50 text-destructive'
                    : 'border-border bg-background text-foreground hover:bg-accent',
                )}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Mark as Fail
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={overrideStep.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!pendingStatus || overrideStep.isPending}
            variant={pendingStatus === 'OVERRIDE_FAIL' ? 'destructive' : 'default'}
          >
            {overrideStep.isPending ? 'Saving…' : 'Save Override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StepHistoryItem({
  step,
  isLast,
}: {
  step: AdminStudentStepProgress
  isLast: boolean
}) {
  const isDone = step.status === 'COMPLETE' || step.status === 'OVERRIDE_PASS'
  const canOverride = OVERRIDABLE_STATUSES.has(step.status)
  const [overrideDialogOpen, setOverrideDialogOpen] = React.useState(false)

  const studentStepId = step.studentStepId ?? step.stepId

  // PBA-361: attempt count
  const attempts = (step as AdminStudentStepProgress & { attempts?: number }).attempts

  // PBA-361: completedAt timestamp
  const completedAtRaw = (
    step as AdminStudentStepProgress & { completedAt?: string | null }
  ).completedAt
  const completedAt = isDone ? (completedAtRaw ?? step.submittedAt) : null
  const completedAtFormatted = formatDateShort(completedAt)

  // PBA-386: overrideNote from step (backend may return it)
  const overrideNote = (step as AdminStudentStepProgress & { overrideNote?: string | null }).overrideNote

  return (
    <>
      <div className="flex gap-4">
        {/* Timeline column */}
        <div className="flex flex-col items-center">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
              isDone
                ? 'border-green-500 bg-green-50'
                : step.status === 'PENDING_REVIEW'
                ? 'border-amber-400 bg-amber-50'
                : step.status === 'IN_PROGRESS'
                ? 'border-blue-400 bg-blue-50'
                : 'border-border bg-muted',
            )}
          >
            <StepStatusIcon status={step.status} />
          </div>
          {!isLast && (
            <div
              className={cn('mt-1 w-0.5 flex-1 min-h-[2rem]', isDone ? 'bg-green-200' : 'bg-border')}
            />
          )}
        </div>

        {/* Step content */}
        <div className={cn('pb-6 min-w-0 flex-1', isLast && 'pb-0')}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-sm font-medium text-foreground leading-snug">
                Step {step.order}: {step.stepTitle}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <Badge variant={getStepStatusVariant(step.status)}>
                  {getStepStatusLabel(step.status)}
                </Badge>
                {/* PBA-361: attempt badge */}
                {attempts !== undefined && attempts > 1 && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {ordinal(attempts)} attempt
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {step.submissionId && (
                <Button size="sm" variant="ghost" asChild aria-label={`Review step ${step.order}`}>
                  <Link href={`/admin/review-queue/${step.submissionId}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    Review
                  </Link>
                </Button>
              )}
              {canOverride && (
                <PermissionGate permission="students:override">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOverrideDialogOpen(true)}
                    aria-label={`Override step ${step.order}`}
                  >
                    Override
                    <ChevronDown className="h-3 w-3 ml-1" aria-hidden="true" />
                  </Button>
                </PermissionGate>
              )}
            </div>
          </div>

          {/* Metadata row — PBA-361: show completedAt if available */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs">
            {completedAtFormatted ? (
              <div>
                <span className="text-muted-foreground">Completed: </span>
                <span className="text-foreground">{completedAtFormatted}</span>
              </div>
            ) : step.submittedAt ? (
              <div>
                <span className="text-muted-foreground">Submitted: </span>
                <span className="text-foreground">{formatDateTime(step.submittedAt)}</span>
              </div>
            ) : null}
            {step.mlScore !== null && (
              <div>
                <span className="text-muted-foreground">ML Score: </span>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    step.mlScore >= 70 ? 'text-green-700' : 'text-amber-700',
                  )}
                >
                  {step.mlScore}%
                </span>
              </div>
            )}
            {step.reviewStatus && (
              <div>
                <span className="text-muted-foreground">Review: </span>
                <span className="text-foreground capitalize">
                  {step.reviewStatus.toLowerCase()}
                </span>
                {step.reviewedAt && (
                  <span className="text-muted-foreground">
                    {' '}
                    ({formatRelative(step.reviewedAt)})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* PBA-386: override note display */}
          {overrideNote && (
            <div className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Override note: </span>
              {overrideNote}
            </div>
          )}
        </div>
      </div>

      {/* PBA-386: override dialog */}
      {canOverride && (
        <OverrideDialog
          open={overrideDialogOpen}
          onOpenChange={setOverrideDialogOpen}
          stepOrder={step.order}
          studentStepId={studentStepId}
          onSuccess={() => setOverrideDialogOpen(false)}
        />
      )}
    </>
  )
}

function StepHistoryItemSkeleton({ isLast }: { isLast: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        {!isLast && <Skeleton className="mt-1 w-0.5 flex-1 min-h-[2rem]" />}
      </div>
      <div className={cn('pb-6 flex-1', isLast && 'pb-0')}>
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-5 w-24 rounded-md mb-3" />
        <Skeleton className="h-3 w-36" />
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptySteps() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
        <Circle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">No step data</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        This student hasn&apos;t started any steps yet.
      </p>
    </div>
  )
}

// ── Activity Log tab (PBA-360) ────────────────────────────────────────────────

type ActivityEventConfig = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  iconClass: string
  circleClass: string
}

const EVENT_TYPE_CONFIG: Record<string, ActivityEventConfig> = {
  step_completed: {
    icon: CheckCircle2,
    label: 'Step Completed',
    iconClass: 'text-green-600',
    circleClass: 'bg-green-50 border-green-300',
  },
  step_override_pass: {
    icon: CheckCheck,
    label: 'Override Pass',
    iconClass: 'text-green-600',
    circleClass: 'bg-green-50 border-green-300',
  },
  step_override_fail: {
    icon: XCircle,
    label: 'Override Fail',
    iconClass: 'text-destructive',
    circleClass: 'bg-red-50 border-red-300',
  },
  step_unlocked: {
    icon: Unlock,
    label: 'Step Unlocked',
    iconClass: 'text-blue-500',
    circleClass: 'bg-blue-50 border-blue-300',
  },
  screenshot_submitted: {
    icon: Upload,
    label: 'Screenshot Submitted',
    iconClass: 'text-blue-500',
    circleClass: 'bg-blue-50 border-blue-300',
  },
  screenshot_approved: {
    icon: CheckCircle2,
    label: 'Screenshot Approved',
    iconClass: 'text-green-600',
    circleClass: 'bg-green-50 border-green-300',
  },
  screenshot_rejected: {
    icon: XCircle,
    label: 'Screenshot Rejected',
    iconClass: 'text-destructive',
    circleClass: 'bg-red-50 border-red-300',
  },
  nudge_sent: {
    icon: Send,
    label: 'Nudge Sent',
    iconClass: 'text-amber-500',
    circleClass: 'bg-amber-50 border-amber-300',
  },
  invite_sent: {
    icon: Mail,
    label: 'Invite Sent',
    iconClass: 'text-muted-foreground',
    circleClass: 'bg-muted border-border',
  },
  invite_accepted: {
    icon: UserCheck,
    label: 'Invite Accepted',
    iconClass: 'text-green-600',
    circleClass: 'bg-green-50 border-green-300',
  },
  invite_revoked: {
    icon: Ban,
    label: 'Invite Revoked',
    iconClass: 'text-destructive',
    circleClass: 'bg-red-50 border-red-300',
  },
  cohort_enrolled: {
    icon: Users,
    label: 'Enrolled in Cohort',
    iconClass: 'text-blue-500',
    circleClass: 'bg-blue-50 border-blue-300',
  },
  cohort_transfer: {
    icon: Users,
    label: 'Transferred to Cohort',
    iconClass: 'text-blue-500',
    circleClass: 'bg-blue-50 border-blue-300',
  },
  progress_reset: {
    icon: RotateCcw,
    label: 'Progress Reset',
    iconClass: 'text-amber-500',
    circleClass: 'bg-amber-50 border-amber-300',
  },
  login: {
    icon: LogIn,
    label: 'Logged In',
    iconClass: 'text-muted-foreground',
    circleClass: 'bg-muted border-border',
  },
}

const DEFAULT_EVENT_CONFIG: ActivityEventConfig = {
  icon: Activity,
  label: 'Event',
  iconClass: 'text-muted-foreground',
  circleClass: 'bg-muted border-border',
}

function getEventConfig(type: string): ActivityEventConfig {
  return EVENT_TYPE_CONFIG[type] ?? { ...DEFAULT_EVENT_CONFIG, label: type }
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const METADATA_LABELS: Record<string, string> = {
  stepName: 'Step',
  stepOrder: 'Step #',
  cohortName: 'Cohort',
  sentBy: 'Sent by',
  note: 'Note',
  reason: 'Reason',
  submissionId: 'Submission',
}

function ActivityEventItem({ event, isLast }: { event: ActivityEvent; isLast: boolean }) {
  const config = getEventConfig(event.type)
  const Icon = config.icon

  // Extract displayable metadata pairs
  const metaPairs = Object.entries(event.metadata ?? {}).filter(
    ([key, val]) => METADATA_LABELS[key] && val != null && val !== '',
  )

  return (
    <div className="flex gap-4" data-slot="activity-event-item">
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
            config.circleClass,
          )}
          aria-hidden="true"
        >
          <Icon className={cn('h-4 w-4', config.iconClass)} />
        </div>
        {!isLast && (
          <div className="mt-1 w-0.5 flex-1 min-h-[2rem] bg-border" />
        )}
      </div>

      {/* Event content */}
      <div className={cn('pb-5 min-w-0 flex-1', isLast && 'pb-0')}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground leading-snug">
            {config.label}
          </p>
          <time
            className="text-xs text-muted-foreground shrink-0"
            dateTime={event.createdAt}
            title={formatDateTime(event.createdAt)}
          >
            {formatTimeAgo(event.createdAt)}
          </time>
        </div>

        {event.actorName && (
          <p className="text-xs text-muted-foreground mt-0.5">
            by{' '}
            <span className="text-foreground">{event.actorName}</span>
            {event.actorRole !== 'student' && event.actorRole !== 'system' && (
              <span className="text-muted-foreground"> ({event.actorRole.replace('_', ' ')})</span>
            )}
            {event.actorRole === 'system' && (
              <span className="text-muted-foreground"> (system)</span>
            )}
          </p>
        )}

        {metaPairs.length > 0 && (
          <dl className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
            {metaPairs.map(([key, val]) => (
              <div key={key} className="flex gap-1">
                <dt className="text-muted-foreground">{METADATA_LABELS[key]}:</dt>
                <dd className="text-foreground">{String(val)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}

function ActivityEventSkeleton({ isLast }: { isLast: boolean }) {
  return (
    <div className="flex gap-4" aria-hidden="true">
      <div className="flex flex-col items-center">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        {!isLast && <Skeleton className="mt-1 w-0.5 flex-1 min-h-[2rem]" />}
      </div>
      <div className={cn('pb-5 flex-1 space-y-1.5', isLast && 'pb-0')}>
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  )
}

const EVENT_TYPE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All events' },
  { value: 'step_completed', label: 'Step Completed' },
  { value: 'step_override_pass', label: 'Override Pass' },
  { value: 'step_override_fail', label: 'Override Fail' },
  { value: 'step_unlocked', label: 'Step Unlocked' },
  { value: 'screenshot_submitted', label: 'Screenshot Submitted' },
  { value: 'screenshot_approved', label: 'Screenshot Approved' },
  { value: 'screenshot_rejected', label: 'Screenshot Rejected' },
  { value: 'nudge_sent', label: 'Nudge Sent' },
  { value: 'invite_sent', label: 'Invite Sent' },
  { value: 'invite_accepted', label: 'Invite Accepted' },
  { value: 'invite_revoked', label: 'Invite Revoked' },
  { value: 'cohort_enrolled', label: 'Enrolled in Cohort' },
  { value: 'cohort_transfer', label: 'Transferred to Cohort' },
  { value: 'progress_reset', label: 'Progress Reset' },
  { value: 'login', label: 'Logged In' },
]

function ActivityLogTab({ studentId }: { studentId: string }) {
  const [typeFilter, setTypeFilter] = React.useState<string>('all')
  const [page, setPage] = React.useState(1)
  const [allEvents, setAllEvents] = React.useState<ActivityEvent[]>([])

  const activeType = typeFilter === 'all' ? undefined : typeFilter

  const { data, isFetching, isError } = useStudentActivityLog(studentId, page, activeType)

  // Append new page results to allEvents; reset when filter changes
  React.useEffect(() => {
    if (!data) return
    if (page === 1) {
      setAllEvents(data.events)
    } else {
      setAllEvents(prev => [...prev, ...data.events])
    }
  }, [data, page])

  // Reset accumulated events + page when filter changes
  function handleFilterChange(value: string) {
    setTypeFilter(value)
    setPage(1)
    setAllEvents([])
  }

  const total = data?.pagination.total ?? 0
  const totalPages = data?.pagination.totalPages ?? 1
  const hasMore = page < totalPages
  const showingCount = allEvents.length

  return (
    <Card data-slot="activity-log-tab">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription className="mt-1">
              Timeline of all student actions and admin interactions.
            </CardDescription>
          </div>
          <Select value={typeFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-44" aria-label="Filter by event type">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPE_FILTER_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading skeleton — first page only */}
        {isFetching && page === 1 && allEvents.length === 0 ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <ActivityEventSkeleton key={i} isLast={i === 4} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">Failed to load activity log</p>
            <p className="text-xs text-muted-foreground mt-1">Please try refreshing the page.</p>
          </div>
        ) : allEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
              <Activity className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">No activity recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Actions taken by or on behalf of this student will appear here.
            </p>
          </div>
        ) : (
          <>
            <div>
              {allEvents.map((event, i) => (
                <ActivityEventItem
                  key={event.id}
                  event={event}
                  isLast={i === allEvents.length - 1 && !hasMore}
                />
              ))}
              {/* Inline skeleton rows while loading the next page */}
              {isFetching && page > 1 && (
                <>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <ActivityEventSkeleton key={`loading-${i}`} isLast={i === 2} />
                  ))}
                </>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Showing {showingCount} of {total} event{total !== 1 ? 's' : ''}
              </p>
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isFetching}
                  onClick={() => setPage(p => p + 1)}
                >
                  {isFetching ? 'Loading…' : 'Load more'}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Quick Stats panel (PBA-357) ───────────────────────────────────────────────

interface QuickStatsPanelProps {
  isLoading: boolean
  completedSteps: number
  totalSteps: number
  daysUntilDeadline: number | null
  stepsRemaining: number
  daysSinceActive: number | null
  submissions: AdminStudentSubmission[]
}

function QuickStatsPanel({
  isLoading,
  completedSteps,
  totalSteps,
  daysUntilDeadline,
  stepsRemaining,
  daysSinceActive,
  submissions,
}: QuickStatsPanelProps) {
  const approved = submissions.filter((s) => s.status === 'APPROVED').length
  const pending = submissions.filter((s) => s.status === 'PENDING_REVIEW').length
  const rejected = submissions.filter((s) => s.status === 'REJECTED').length

  const deadlineDisplay = (() => {
    if (daysUntilDeadline === null) return { value: '—', className: 'text-foreground' }
    if (daysUntilDeadline < 0) return { value: 'Passed', className: 'text-destructive' }
    return { value: String(daysUntilDeadline), className: 'text-foreground' }
  })()

  const activeDisplay = (() => {
    if (daysSinceActive === null) return { value: '—', className: 'text-foreground' }
    if (daysSinceActive > 14) return { value: `${daysSinceActive}d ago`, className: 'text-destructive' }
    if (daysSinceActive > 7) return { value: `${daysSinceActive}d ago`, className: 'text-amber-600' }
    return { value: `${daysSinceActive}d ago`, className: 'text-foreground' }
  })()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 grid grid-cols-2 gap-4">
        {/* Steps Done */}
        <div>
          <p className="text-xs text-muted-foreground">Steps Done</p>
          <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">
            {completedSteps} / {totalSteps}
          </p>
        </div>

        {/* Days Until Deadline */}
        <div>
          <p className="text-xs text-muted-foreground">Days Until Deadline</p>
          <p className={cn('text-lg font-semibold tabular-nums mt-0.5', deadlineDisplay.className)}>
            {deadlineDisplay.value}
          </p>
          {daysUntilDeadline !== null && daysUntilDeadline >= 0 && (
            <p className="text-xs text-muted-foreground">{stepsRemaining} steps left</p>
          )}
        </div>

        {/* Screenshots */}
        <div>
          <p className="text-xs text-muted-foreground">Screenshots</p>
          <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">
            {submissions.length}
          </p>
          <p className="text-xs text-muted-foreground">
            {approved}✓ · {pending} pending · {rejected}✗
          </p>
        </div>

        {/* Last Active */}
        <div>
          <p className="text-xs text-muted-foreground">Last Active</p>
          <p className={cn('text-lg font-semibold tabular-nums mt-0.5', activeDisplay.className)}>
            {activeDisplay.value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Submission status badge ───────────────────────────────────────────────────

function SubmissionStatusBadge({ status }: { status: AdminStudentSubmission['status'] }) {
  const map: Record<AdminStudentSubmission['status'], { label: string; className: string }> = {
    APPROVED:       { label: 'Approved',        className: 'bg-green-100 text-green-800 border-green-200' },
    REJECTED:       { label: 'Rejected',        className: 'bg-red-100 text-red-800 border-red-200' },
    PENDING_REVIEW: { label: 'Pending Review',  className: 'bg-amber-100 text-amber-800 border-amber-200' },
    NEEDS_REVISION: { label: 'Needs Revision',  className: 'bg-orange-100 text-orange-800 border-orange-200' },
  }
  const config = map[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border' }
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}

// ── Screenshots gallery + lightbox (PBA-363) ──────────────────────────────────

interface ScreenshotsGalleryProps {
  isLoading: boolean
  submissions: AdminStudentSubmission[]
}

type SubmissionStatusFilter = 'all' | 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED'

function ScreenshotsGallery({ isLoading, submissions }: ScreenshotsGalleryProps) {
  const [statusFilter, setStatusFilter] = React.useState<SubmissionStatusFilter>('all')
  const [stepFilter, setStepFilter] = React.useState<string>('all')
  const [selectedSubmission, setSelectedSubmission] = React.useState<AdminStudentSubmission | null>(null)

  // Unique steps for the step filter
  const uniqueSteps = React.useMemo(() => {
    const seen = new Map<string, string>()
    submissions.forEach((s) => {
      if (s.stepId && s.stepTitle) seen.set(s.stepId, s.stepTitle)
    })
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }))
  }, [submissions])

  const filtered = React.useMemo(() => {
    return submissions.filter((s) => {
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter
      const matchesStep = stepFilter === 'all' || s.stepId === stepFilter
      return matchesStatus && matchesStep
    })
  }, [submissions, statusFilter, stepFilter])

  const approved = submissions.filter((s) => s.status === 'APPROVED').length
  const pending = submissions.filter((s) => s.status === 'PENDING_REVIEW').length
  const rejected = submissions.filter((s) => s.status === 'REJECTED').length

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Screenshots</CardTitle>
          <CardDescription>
            {submissions.length} total · {approved} approved · {pending} pending · {rejected} rejected
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filter row */}
          {submissions.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-5">
              {/* Step filter */}
              {uniqueSteps.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <select
                    value={stepFilter}
                    onChange={(e) => setStepFilter(e.target.value)}
                    className="h-8 rounded-md border border-border bg-input-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                    aria-label="Filter by step"
                  >
                    <option value="all">All steps</option>
                    {uniqueSteps.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status chips */}
              <div className="flex items-center gap-1.5" role="group" aria-label="Filter by status">
                {(['all', 'APPROVED', 'PENDING_REVIEW', 'REJECTED'] as const).map((s) => {
                  const labels: Record<SubmissionStatusFilter, string> = {
                    all: 'All', APPROVED: 'Approved', PENDING_REVIEW: 'Pending', REJECTED: 'Rejected',
                  }
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                        statusFilter === s
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-card text-muted-foreground border-border hover:border-foreground/30',
                      )}
                    >
                      {labels[s]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Gallery grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
                <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground">No screenshots</p>
              <p className="text-xs text-muted-foreground mt-1">
                {submissions.length === 0
                  ? 'This student has not submitted any screenshots yet.'
                  : 'No screenshots match the current filters.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((submission, index) => (
                <button
                  key={submission.id}
                  type="button"
                  onClick={() => setSelectedSubmission(submission)}
                  className="group text-left rounded-lg border border-border bg-card hover:border-ring/40 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden"
                  aria-label={`View screenshot for ${submission.stepTitle ?? `Step ${submission.stepOrder}`}`}
                >
                  {/* Thumbnail */}
                  <div className="w-full aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    {submission.screenshotUrl ? (
                      <img
                        src={submission.screenshotUrl}
                        alt={`Screenshot for ${submission.stepTitle ?? `Step ${submission.stepOrder}`}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-foreground truncate leading-snug">
                        {submission.stepTitle ?? `Step ${submission.stepOrder ?? (index + 1)}`}
                      </p>
                      <SubmissionStatusBadge status={submission.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(submission.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox dialog */}
      <Dialog open={selectedSubmission !== null} onOpenChange={(open) => { if (!open) setSelectedSubmission(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSubmission?.stepTitle ?? `Step ${selectedSubmission?.stepOrder}`}
            </DialogTitle>
          </DialogHeader>

          {selectedSubmission && (
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Image area */}
              <div className="sm:flex-1 rounded-lg overflow-hidden bg-muted flex items-center justify-center min-h-[200px] aspect-video">
                {selectedSubmission.screenshotUrl ? (
                  <img
                    src={selectedSubmission.screenshotUrl}
                    alt={`Screenshot for ${selectedSubmission.stepTitle ?? `Step ${selectedSubmission.stepOrder}`}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
                )}
              </div>

              {/* Metadata sidebar */}
              <div className="sm:w-56 space-y-4 shrink-0">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Status</p>
                  <SubmissionStatusBadge status={selectedSubmission.status} />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Submitted</p>
                  <p className="text-sm text-foreground">
                    {new Date(selectedSubmission.createdAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>

                {selectedSubmission.mlScore !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">ML Score</p>
                    <p className={cn(
                      'text-sm font-medium tabular-nums',
                      selectedSubmission.mlScore >= 70 ? 'text-green-700' : 'text-amber-700',
                    )}>
                      {selectedSubmission.mlScore}%
                    </p>
                  </div>
                )}

                {selectedSubmission.reviewedBy && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Reviewed by</p>
                    <p className="text-sm text-foreground">
                      {selectedSubmission.reviewedBy.firstName} {selectedSubmission.reviewedBy.lastName}
                    </p>
                    {selectedSubmission.reviewedAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDateTime(selectedSubmission.reviewedAt)}
                      </p>
                    )}
                  </div>
                )}

                {selectedSubmission.reviewNote && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Review Note</p>
                    <p className="text-sm text-foreground">{selectedSubmission.reviewNote}</p>
                  </div>
                )}

                {selectedSubmission.screenshotUrl && (
                  <div>
                    <a
                      href={selectedSubmission.screenshotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#4a9ad4] hover:underline"
                    >
                      Open full image
                    </a>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => toast.info('Coming soon')}
                    className="flex-1 h-8 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.info('Coming soon')}
                    className="flex-1 h-8 rounded-md border border-destructive text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { isOnline } = useStudentPresence()
  const { data: student, isLoading } = useAdminStudent(id ?? '')

  if (!id) {
    router.replace('/admin/students')
    return null
  }

  const pct = student?.progress?.progressPercent ?? student?.progressPercent ?? 0
  const completedSteps = student?.progress?.completedSteps ?? student?.completedSteps ?? 0
  const totalSteps = student?.progress?.totalSteps ?? student?.totalSteps ?? 0
  const inviteStatus = student?.inviteStatus
  const healthStatus: HealthStatus = student?.progress?.healthStatus ?? student?.healthStatus ?? 'on_track'
  const daysSinceActive = student?.progress?.daysSinceActive ?? student?.daysSinceActive ?? null
  const daysUntilDeadline = student?.progress?.daysUntilDeadline ?? null
  const stepsRemaining = student?.progress?.stepsRemaining ?? 0

  return (
    <div data-slot="admin-student-detail-page" className="space-y-5">

      {/* Breadcrumb — PBA-356 */}
      <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <span className="text-muted-foreground/50" aria-hidden="true">›</span>
        <Link
          href="/admin/students"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Students
        </Link>
        <span className="text-muted-foreground/50" aria-hidden="true">›</span>
        <span className="text-foreground font-medium" aria-current="page">
          {isLoading
            ? '…'
            : student
            ? `${student.firstName} ${student.lastName}`
            : 'Student'}
        </span>
      </nav>

      {/* Hero header — PBA-356 */}
      <ProfileHero
        isLoading={isLoading}
        firstName={student?.firstName ?? ''}
        lastName={student?.lastName ?? ''}
        email={student?.email ?? ''}
        avatarUrl={student?.avatarUrl}
        cohortId={student?.cohort?.id}
        cohortName={student?.cohort?.name}
        status={healthStatus}
        joinedAt={student?.joinedAt ?? null}
        completedSteps={completedSteps}
        totalSteps={totalSteps}
        progressPercent={pct}
        studentId={id}
        inviteStatus={inviteStatus}
        isOnline={isOnline(id)}
      />

      {/* PBA-354 — At-risk warning banner */}
      {!isLoading && healthStatus === 'at_risk' && (
        <div className="rounded-lg border border-l-4 border-amber-400 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                {student?.firstName} is behind schedule
              </p>
              <p className="text-sm text-amber-800 mt-0.5">
                Cohort deadline in {daysUntilDeadline ?? '—'} days with {stepsRemaining} step{stepsRemaining !== 1 ? 's' : ''} remaining.
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors shrink-0"
              onClick={() => toast.info('Coming soon')}
            >
              Send Nudge →
            </button>
          </div>
        </div>
      )}

      {/* PBA-354 — Blocked / inactive warning banner */}
      {!isLoading && healthStatus === 'blocked' && (
        <div className="rounded-lg border border-l-4 border-muted-foreground/30 bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">No recent activity</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {student?.firstName} hasn&apos;t been active for {daysSinceActive ?? '—'} days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabbed content — PBA-355 */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="step-history">Step History</TabsTrigger>
          <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
          <TabsTrigger value="activity-log">Activity Log</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Step cards list */}
            <div className="lg:col-span-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Step Progress
              </p>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[4.25rem] w-full rounded-lg" />
                ))
              ) : (student?.stepProgress?.length ?? 0) === 0 ? (
                <EmptySteps />
              ) : (
                student?.stepProgress?.map((step) => (
                  <StepOverviewCard key={step.stepId} step={step} />
                ))
              )}
            </div>

            {/* Cohort + quick-stats sidebar */}
            <div className="lg:col-span-2 space-y-4">
              {/* Cohort card */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Cohort
                </p>
                <Card>
                  <CardContent className="p-4">
                    {isLoading ? (
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    ) : student?.cohort ? (
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <GraduationCap
                            className="h-4 w-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {student.cohort.name}
                          </p>
                          <Link
                            href={`/admin/cohorts/${student.cohort.id}`}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            View cohort
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Not enrolled in a cohort
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats — PBA-357 */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Quick Stats
                </p>
                <QuickStatsPanel
                  isLoading={isLoading}
                  completedSteps={completedSteps}
                  totalSteps={totalSteps}
                  daysUntilDeadline={daysUntilDeadline}
                  stepsRemaining={stepsRemaining}
                  daysSinceActive={daysSinceActive}
                  submissions={student?.submissions ?? []}
                />
              </div>
            </div>

          </div>
        </TabsContent>

        {/* Step History tab */}
        <TabsContent value="step-history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Step History</CardTitle>
              <CardDescription>
                Submission history and review status for each program step.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-0">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <StepHistoryItemSkeleton key={i} isLast={i === 5} />
                  ))}
                </div>
              ) : (student?.stepProgress?.length ?? 0) === 0 ? (
                <EmptySteps />
              ) : (
                <div className="space-y-0">
                  {student?.stepProgress?.map((step, i) => (
                    <StepHistoryItem
                      key={step.stepId}
                      step={step}
                      isLast={i === student.stepProgress.length - 1}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Screenshots tab — PBA-363 */}
        <TabsContent value="screenshots" className="mt-4">
          <ScreenshotsGallery
            isLoading={isLoading}
            submissions={student?.submissions ?? []}
          />
        </TabsContent>

        {/* Activity Log tab — PBA-360 */}
        <TabsContent value="activity-log" className="mt-4">
          <ActivityLogTab studentId={id} />
        </TabsContent>

      </Tabs>
    </div>
  )
}
