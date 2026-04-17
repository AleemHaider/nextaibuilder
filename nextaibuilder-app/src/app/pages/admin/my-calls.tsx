// PBA-330 — Admin My Calls page
// Route: /admin/my-calls — visible only to takesStudentCalls admins

import * as React from 'react'
import { Phone, CheckCircle, Clock, User } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/app/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useAdminCalls, useCompleteCall, type AdminCall, type CallStatus } from '@/hooks/use-admin-calls'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Status badge ──────────────────────────────────────────────────────────────

function CallStatusBadge({ status }: { status: AdminCall['status'] }) {
  if (status === 'ACTIVE') {
    return (
      <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
        <Clock className="h-2.5 w-2.5" aria-hidden="true" />
        Active
      </Badge>
    )
  }
  if (status === 'COMPLETED') {
    return (
      <Badge variant="secondary" className="gap-1 bg-green-50 text-green-700 border-green-200">
        <CheckCircle className="h-2.5 w-2.5" aria-hidden="true" />
        Completed
      </Badge>
    )
  }
  return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CallCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 w-36 rounded bg-muted" />
          <div className="h-3 w-28 rounded bg-muted" />
        </div>
        <div className="h-5 w-16 rounded-md bg-muted" />
      </div>
      <div className="h-3 w-48 rounded bg-muted" />
    </div>
  )
}

// ── Call card ─────────────────────────────────────────────────────────────────

interface CallCardProps {
  call: AdminCall
  onMarkComplete: (call: AdminCall) => void
}

function CallCard({ call, onMarkComplete }: CallCardProps) {
  const student = call.studentId

  return (
    <div
      data-slot="call-card"
      className={cn(
        'rounded-xl border border-border bg-card p-4 space-y-3 transition-shadow hover:shadow-sm',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={student.avatarUrl ?? undefined} alt={`${student.firstName} ${student.lastName}`} />
          <AvatarFallback className="text-xs font-medium">
            {getInitials(student.firstName, student.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {student.firstName} {student.lastName}
          </p>
          <p className="text-xs text-muted-foreground truncate">{student.email}</p>
        </div>
        <CallStatusBadge status={call.status} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Booked {formatDate(call.bookedAt)}
        </p>
        {call.status === 'ACTIVE' && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onMarkComplete(call)}
          >
            <CheckCircle className="h-3 w-3" aria-hidden="true" />
            Mark Complete
          </Button>
        )}
        {call.status === 'COMPLETED' && call.completedAt && (
          <p className="text-xs text-muted-foreground">
            Completed {formatDate(call.completedAt)}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Tab filter type ───────────────────────────────────────────────────────────

type TabFilter = 'ACTIVE' | 'COMPLETED' | 'all'

// ── Main page ─────────────────────────────────────────────────────────────────

function AdminMyCallsPage() {
  const [tab, setTab] = React.useState<TabFilter>('ACTIVE')
  const [confirmCall, setConfirmCall] = React.useState<AdminCall | null>(null)
  const [page, setPage] = React.useState(1)

  const { data, isLoading } = useAdminCalls(tab as CallStatus, page, 20)
  const completeCall = useCompleteCall()

  const calls = data?.calls ?? []
  const totalPages = data?.pagination.totalPages ?? 1

  React.useEffect(() => {
    document.title = 'My Calls — Admin'
  }, [])

  async function handleConfirmComplete() {
    if (!confirmCall) return
    try {
      await completeCall.mutateAsync(confirmCall._id)
      toast.success('Call marked as complete. Student notified.')
      setConfirmCall(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete call')
    }
  }

  const TABS: { value: TabFilter; label: string }[] = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'all', label: 'All' },
  ]

  return (
    <div data-slot="admin-my-calls-page" className="space-y-6">
      {/* Page heading */}
      <div>
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-xl font-medium text-foreground">My Calls</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Student calls booked with you. Mark them complete after the session.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => { setTab(value); setPage(1) }}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              tab === value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Call list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <CallCardSkeleton key={i} />)}
        </div>
      ) : calls.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              No calls
            </CardTitle>
            <CardDescription>
              {tab === 'ACTIVE'
                ? 'No active calls at the moment.'
                : tab === 'COMPLETED'
                ? 'No completed calls yet.'
                : 'No calls found.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <CallCard
              key={call._id}
              call={call}
              onMarkComplete={setConfirmCall}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Confirm complete dialog */}
      <AlertDialog open={Boolean(confirmCall)} onOpenChange={(o) => !o && setConfirmCall(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark call as complete?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCall && (
                <>
                  This will mark your call with{' '}
                  <strong>{confirmCall.studentId.firstName} {confirmCall.studentId.lastName}</strong>{' '}
                  as completed and send them a review email. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmCall(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmComplete}
              disabled={completeCall.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {completeCall.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                  Completing…
                </span>
              ) : (
                'Mark Complete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export { AdminMyCallsPage }
