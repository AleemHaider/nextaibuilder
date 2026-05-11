// FIR-166 — Admin student list with search, filters, sortable table, and slide-in detail drawer
import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Search, X, ChevronLeft, ChevronRight, Download, Check, AlertTriangle, Users } from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  fetchAdminStudents,
  updateEnrollmentStatus,
  authFetch,
  type AdminEnrollment,
} from '../../lib/api'
import { STALE_TIME } from '../../lib/queryConfig'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ITEMS_PER_PAGE = 20

const STATUS_FILTERS = [
  { label: 'All Statuses', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Suspended', value: 'SUSPENDED' },
  { label: 'Revoked', value: 'REVOKED' },
]

const PAYMENT_STATUS_FILTERS = [
  { label: 'All Payments', value: '' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Failed', value: 'FAILED' },
]

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-text))',
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-primary))',
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-success))',
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-primary-text))',
  'linear-gradient(135deg, var(--color-wise-dark), var(--color-wise-primary-text))',
]

function getAvatarGradient(name: string): string {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface ToastMessage {
  id: string
  message: string
  variant: 'success' | 'error'
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 rounded-[14px] shadow-[var(--color-wise-ring-strong)_0_4px_20px]',
        'text-[14px] font-semibold',
        toast.variant === 'success'
          ? 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)] border border-[rgba(5,77,40,0.15)]'
          : 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] border border-[rgba(208,50,56,0.15)]',
      )}
    >
      <span aria-hidden="true" className="inline-flex">
        {toast.variant === 'success' ? <Check size={16} /> : <X size={16} />}
      </span>
      {toast.message}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const addToast = useCallback((message: string, variant: 'success' | 'error') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])
  return { toasts, addToast, dismissToast }
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function EnrollmentStatusBadge({ status }: { status: AdminEnrollment['status'] }) {
  const styles: Record<AdminEnrollment['status'], string> = {
    ACTIVE: 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
    COMPLETED: 'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text)]',
    SUSPENDED: 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)]',
    REVOKED: 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',
  }
  const labels: Record<AdminEnrollment['status'], string> = {
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    SUSPENDED: 'Suspended',
    REVOKED: 'Revoked',
  }
  return (
    <span className={cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', styles[status])}>
      {labels[status]}
    </span>
  )
}

function PaymentStatusBadge({ status }: { status: AdminEnrollment['paymentStatus'] }) {
  const styles: Record<AdminEnrollment['paymentStatus'], string> = {
    PAID: 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
    PARTIAL: 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)]',
    PENDING: 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)]',
    FAILED: 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',
  }
  const labels: Record<AdminEnrollment['paymentStatus'], string> = {
    PAID: 'Paid',
    PARTIAL: 'Partial',
    PENDING: 'Pending',
    FAILED: 'Failed',
  }
  return (
    <span className={cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', styles[status])}>
      {labels[status]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Confirm modal for Suspend / Revoke
// ---------------------------------------------------------------------------

interface ConfirmActionModalProps {
  enrollment: AdminEnrollment
  actionLabel: string
  newStatus: 'SUSPENDED' | 'REVOKED'
  onConfirm: (reason: string) => void
  onClose: () => void
  isPending: boolean
}

function ConfirmActionModal({
  enrollment,
  actionLabel,
  newStatus,
  onConfirm,
  onClose,
  isPending,
}: ConfirmActionModalProps) {
  const [reason, setReason] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isDanger = newStatus === 'REVOKED'
  const isValid = reason.trim().length >= 5

  return (
    <div
      className="fixed inset-0 z-[60] bg-[rgba(14,15,12,0.45)] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-[20px] p-8 w-full max-w-[460px] shadow-[var(--color-wise-ring-strong)_0_20px_60px]">
        <h2 className="text-[20px] font-[800] text-[var(--color-wise-text)] mb-1">{actionLabel} Access</h2>
        <p className="text-[14px] text-[var(--color-wise-text-muted)] mb-6">
          This will{' '}
          <span className="font-semibold text-[var(--color-wise-text)]">{actionLabel.toLowerCase()}</span>{' '}
          <span className="font-semibold text-[var(--color-wise-text)]">{enrollment.student.name}</span>'s access
          to <span className="font-semibold text-[var(--color-wise-text)]">{enrollment.cohort.title}</span>.
        </p>

        <label htmlFor="action-reason" className="block text-[13px] font-[600] text-[var(--color-wise-text)] mb-2">
          Reason (required)
        </label>
        <textarea
          id="action-reason"
          ref={inputRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Provide a brief reason…"
          rows={3}
          className={cn(
            'w-full rounded-[12px] border-[1.5px] p-4 text-[14px] font-[inherit]',
            'bg-[var(--color-wise-canvas)] resize-none outline-none transition-colors',
            'focus:border-[var(--color-wise-primary-text)] focus:bg-white border-[var(--color-wise-ring-strong)]',
          )}
        />

        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-5 py-2.5 rounded-full bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)] text-[14px] font-[700] hover:bg-[var(--color-wise-surface-soft)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={!isValid || isPending}
            className={cn(
              'px-5 py-2.5 rounded-full text-[14px] font-[700] transition-colors',
              isDanger
                ? 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] hover:bg-[var(--color-wise-danger-soft)]'
                : 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)] hover:bg-[var(--color-wise-warning-soft)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isPending ? 'Processing…' : `Confirm ${actionLabel}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StudentDetailDrawer
// ---------------------------------------------------------------------------

interface StudentDetailDrawerProps {
  enrollment: AdminEnrollment
  onClose: () => void
  onSuspend: (e: AdminEnrollment) => void
  onRevoke: (e: AdminEnrollment) => void
  onReinstate: (e: AdminEnrollment) => void
}

function StudentDetailDrawer({
  enrollment,
  onClose,
  onSuspend,
  onRevoke,
  onReinstate,
}: StudentDetailDrawerProps) {
  const { student, cohort, progress, paymentStatus, status, installments, enrolledAt } = enrollment

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`${student.name} details`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[rgba(14,15,12,0.4)]"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="relative z-50 w-full max-w-[520px] h-full bg-white shadow-[-8px_0_40px_var(--color-wise-ring-strong)] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-[var(--color-wise-ring)]">
          <h2 className="text-[18px] font-[800] text-[var(--color-wise-text)]">Student Details</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details panel"
            className="w-9 h-9 rounded-full bg-[var(--color-wise-surface-soft)] flex items-center justify-center hover:bg-[var(--color-wise-surface-soft)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          {/* Profile */}
          <div className="flex items-center gap-4 mb-6">
            {student.avatarUrl ? (
              <img src={student.avatarUrl} alt="" className="w-16 h-16 rounded-full flex-shrink-0" />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[24px] font-[700]"
                style={{ background: getAvatarGradient(student.name) }}
                aria-hidden="true"
              >
                {student.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-[20px] font-[800] text-[var(--color-wise-text)]">{student.name}</div>
              <div className="text-[14px] text-[var(--color-wise-text-muted)] mt-0.5">{student.email}</div>
              <div className="text-[13px] text-[var(--color-wise-text-muted)] mt-0.5">
                Joined {formatDate(student.joinedAt)}
              </div>
            </div>
          </div>

          {/* Enrollment section */}
          <div className="mb-6">
            <h3 className="text-[12px] font-[700] text-[var(--color-wise-text-muted)] uppercase tracking-[0.8px] mb-3">
              Enrollment
            </h3>
            <div className="bg-[var(--color-wise-canvas)] rounded-[12px] p-4">
              <div className="text-[14px] font-[700] text-[var(--color-wise-text)] mb-3">{cohort.title}</div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1 h-[5px] bg-[var(--color-wise-surface-soft)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-wise-primary-text)] rounded-full"
                      style={{ width: `${progress}%` }}
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                  <span className="text-[12px] font-[600] text-[var(--color-wise-text-muted)] whitespace-nowrap">
                    {progress}%
                  </span>
                </div>
                <PaymentStatusBadge status={paymentStatus} />
                <EnrollmentStatusBadge status={status} />
              </div>
              <div className="text-[12px] text-[var(--color-wise-text-muted)] mt-2">
                Enrolled {formatDate(enrolledAt)}
              </div>
            </div>
          </div>

          {/* Details table */}
          <div className="mb-6">
            <h3 className="text-[12px] font-[700] text-[var(--color-wise-text-muted)] uppercase tracking-[0.8px] mb-3">
              Details
            </h3>
            {[
              { label: 'Course', value: cohort.title },
              { label: 'Progress', value: `${progress}%` },
              { label: 'Payment Status', value: paymentStatus },
              { label: 'Access Status', value: status },
              { label: 'Enrolled', value: formatDate(enrolledAt) },
              ...(enrollment.lastActiveAt
                ? [{ label: 'Last Active', value: formatDate(enrollment.lastActiveAt) }]
                : []),
              ...(enrollment.paymentType
                ? [{ label: 'Payment Type', value: enrollment.paymentType }]
                : []),
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between items-center py-2.5 border-b border-[var(--color-wise-ring)] last:border-b-0"
              >
                <span className="text-[14px] text-[var(--color-wise-text-muted)]">{label}</span>
                <span className="text-[14px] font-[600] text-[var(--color-wise-text)]">{value}</span>
              </div>
            ))}
          </div>

          {/* Installment timeline */}
          {installments && installments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[12px] font-[700] text-[var(--color-wise-text-muted)] uppercase tracking-[0.8px] mb-3">
                Payment Timeline
              </h3>
              <div className="flex flex-col gap-2">
                {installments.map((inst, idx) => {
                  const statusColor =
                    inst.status === 'PAID'
                      ? 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]'
                      : inst.status === 'OVERDUE'
                        ? 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]'
                        : 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)]'
                  return (
                    <div
                      key={inst.id}
                      className="flex items-center justify-between py-2.5 border-b border-[var(--color-wise-ring)] last:border-b-0"
                    >
                      <div>
                        <div className="text-[13px] font-[600] text-[var(--color-wise-text)]">
                          Payment {idx + 1} — {formatMoney(inst.amount)}
                        </div>
                        <div className="text-[12px] text-[var(--color-wise-text-muted)]">
                          Due {formatDate(inst.dueDate)}
                          {inst.paidAt && ` · Paid ${formatDate(inst.paidAt)}`}
                        </div>
                      </div>
                      <span className={cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', statusColor)}>
                        {inst.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2.5 mt-4">
            {status === 'ACTIVE' && (
              <>
                <button
                  type="button"
                  onClick={() => onSuspend(enrollment)}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-full text-[14px] font-[700] transition-colors',
                    'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)] hover:bg-[var(--color-wise-warning-soft)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wise-warning)]',
                  )}
                >
                  Suspend Access
                </button>
                <button
                  type="button"
                  onClick={() => onRevoke(enrollment)}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-full text-[14px] font-[700] transition-colors',
                    'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] hover:bg-[var(--color-wise-danger-soft)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wise-danger)]',
                  )}
                >
                  Revoke Access
                </button>
              </>
            )}
            {(status === 'SUSPENDED' || status === 'REVOKED') && (
              <button
                type="button"
                onClick={() => onReinstate(enrollment)}
                className={cn(
                  'flex-1 px-4 py-3 rounded-full text-[14px] font-[700] transition-colors',
                  'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)] hover:bg-[var(--color-wise-mint)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wise-success)]',
                )}
              >
                Reinstate Access
              </button>
            )}
            <button
              type="button"
              onClick={() => window.open(`mailto:${student.email}`)}
              className={cn(
                'flex-1 px-4 py-3 rounded-full text-[14px] font-[700] transition-colors',
                'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text)] hover:bg-[var(--color-wise-surface-soft)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wise-primary-text)]',
              )}
            >
              Send Email
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StudentListPage
// ---------------------------------------------------------------------------

interface ConfirmAction {
  enrollment: AdminEnrollment
  type: 'SUSPENDED' | 'REVOKED'
}

export default function StudentListPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedEnrollment, setSelectedEnrollment] = useState<AdminEnrollment | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  const { toasts, addToast, dismissToast } = useToast()
  const queryClient = useQueryClient()

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-students', debouncedQuery, statusFilter, page],
    queryFn: () =>
      fetchAdminStudents({
        q: debouncedQuery || undefined,
        status: statusFilter || undefined,
        page,
        limit: ITEMS_PER_PAGE,
      }),
    staleTime: STALE_TIME.medium,
    placeholderData: (prev) => prev,
  })

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string
      status: string
      reason?: string
    }) => updateEnrollmentStatus(id, status, reason),
    onSuccess: (_, { status }) => {
      setConfirmAction(null)
      setSelectedEnrollment(null)
      queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      const label =
        status === 'SUSPENDED'
          ? 'suspended'
          : status === 'REVOKED'
            ? 'revoked'
            : 'reinstated'
      addToast(`Access ${label} successfully`, 'success')
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Failed to update access', 'error')
    },
  })

  function handleReinstate(enrollment: AdminEnrollment) {
    statusMutation.mutate({ id: enrollment.id, status: 'ACTIVE' })
  }

  const enrollments = data?.enrollments ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  async function handleExportCSV() {
    try {
      const res = await authFetch('/api/v1/admin/students/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addToast('Export failed. Please try again.', 'error')
    }
  }

  return (
    <AdminShell
      title="Students"
      actions={
        <button
          type="button"
          onClick={handleExportCSV}
          className="px-5 py-2 rounded-full border-[1.5px] border-[var(--color-wise-ring-strong)] text-[var(--color-wise-text-muted)] text-[14px] font-[600] hover:bg-[var(--color-wise-surface-soft)] transition-colors inline-flex items-center gap-2"
        >
          <Download size={14} />
          Export CSV
        </button>
      }
    >
      {/* Toast stack */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={dismissToast} />
          </div>
        ))}
      </div>

      {/* Detail drawer */}
      {selectedEnrollment && (
        <StudentDetailDrawer
          enrollment={selectedEnrollment}
          onClose={() => setSelectedEnrollment(null)}
          onSuspend={(e) => setConfirmAction({ enrollment: e, type: 'SUSPENDED' })}
          onRevoke={(e) => setConfirmAction({ enrollment: e, type: 'REVOKED' })}
          onReinstate={handleReinstate}
        />
      )}

      {/* Confirm modal */}
      {confirmAction && (
        <ConfirmActionModal
          enrollment={confirmAction.enrollment}
          actionLabel={confirmAction.type === 'SUSPENDED' ? 'Suspend' : 'Revoke'}
          newStatus={confirmAction.type}
          onClose={() => setConfirmAction(null)}
          onConfirm={(reason) =>
            statusMutation.mutate({
              id: confirmAction.enrollment.id,
              status: confirmAction.type,
              reason,
            })
          }
          isPending={statusMutation.isPending}
        />
      )}

      {/* Stats row */}
      <div className="flex border-b border-[var(--color-wise-ring)] bg-white">
        {[
          { label: 'Total Students', value: String(total) },
          { label: 'Active Enrollments', value: '—' },
          { label: 'Pending Approval', value: '—' },
          { label: 'Failed Payments', value: '—' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex-1 px-7 py-5 border-r border-[var(--color-wise-ring)] last:border-r-0"
          >
            <div className="text-[28px] font-[900] text-[var(--color-wise-text)] tracking-[-0.5px]">
              {stat.value}
            </div>
            <div className="text-[13px] text-[var(--color-wise-text-muted)] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-8 py-5 border-b border-[var(--color-wise-ring)] bg-white flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-wise-text-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search students"
            className={cn(
              'w-full pl-9 pr-4 py-2.5 rounded-full text-[14px] text-[var(--color-wise-text)] font-[inherit]',
              'border-[1.5px] border-[var(--color-wise-ring)] bg-[var(--color-wise-canvas)] outline-none transition-colors',
              'focus:border-[var(--color-wise-primary-text)] focus:bg-white',
            )}
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
          className={cn(
            'px-4 py-2.5 rounded-full border-[1.5px] border-[var(--color-wise-ring)]',
            'text-[14px] text-[var(--color-wise-text-muted)] bg-white outline-none cursor-pointer font-[inherit]',
            'focus:border-[var(--color-wise-primary-text)]',
          )}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Payment filter */}
        <select
          value={paymentFilter}
          onChange={(e) => {
            setPaymentFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by payment"
          className={cn(
            'px-4 py-2.5 rounded-full border-[1.5px] border-[var(--color-wise-ring)]',
            'text-[14px] text-[var(--color-wise-text-muted)] bg-white outline-none cursor-pointer font-[inherit]',
            'focus:border-[var(--color-wise-primary-text)]',
          )}
        >
          {PAYMENT_STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="px-8 py-6">
        {isLoading && (
          <div
            aria-busy="true"
            aria-label="Loading students"
            className="bg-white rounded-[16px] shadow-[var(--color-wise-ring)_0_0_0_1px] overflow-hidden"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="flex items-center gap-4 px-5 py-4 border-b border-[var(--color-wise-ring)] last:border-b-0"
                aria-hidden="true"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--color-wise-surface-soft)] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-1/4" />
                  <div className="h-3 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-1/5" />
                </div>
                <div className="h-3 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-24" />
                <div className="h-3 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-16" />
                <div className="h-3 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-16" />
              </div>
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load students"
            description="There was a problem loading the student list. Please try again."
          />
        )}

        {!isLoading && !isError && enrollments.length === 0 && (
          <EmptyState
            icon={Users}
            title="No students found"
            description={
              debouncedQuery || statusFilter
                ? 'Try adjusting your filters.'
                : 'No enrollments yet.'
            }
          />
        )}

        {!isLoading && !isError && enrollments.length > 0 && (
          <div className="bg-white rounded-[16px] shadow-[var(--color-wise-ring)_0_0_0_1px] overflow-hidden">
            <table className="w-full border-collapse" aria-label="Student enrollments">
              <thead>
                <tr>
                  {['Student', 'Course', 'Progress', 'Status', 'Payment', 'Enrolled', 'Actions'].map(
                    (col) => (
                      <th
                        key={col}
                        scope="col"
                        className="text-left text-[12px] font-[600] text-[var(--color-wise-text-muted)] px-5 py-3 border-b border-[var(--color-wise-ring)] uppercase tracking-[0.5px] bg-[var(--color-wise-canvas)]"
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => (
                  <tr
                    key={enrollment.id}
                    className="cursor-pointer hover:[&>td]:bg-[var(--color-wise-canvas)] transition-colors"
                    onClick={() => navigate(`/admin/students/${enrollment.student.id}`)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/admin/students/${enrollment.student.id}`)
                      }
                    }}
                    aria-label={`View profile for ${enrollment.student.name}`}
                  >
                    <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)]">
                      <div className="flex items-center gap-3">
                        {enrollment.student.avatarUrl ? (
                          <img
                            src={enrollment.student.avatarUrl}
                            alt=""
                            className="w-9 h-9 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[14px] font-[700]"
                            style={{ background: getAvatarGradient(enrollment.student.name) }}
                            aria-hidden="true"
                          >
                            {enrollment.student.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-[14px] font-[600] text-[var(--color-wise-text)]">
                            {enrollment.student.name}
                          </div>
                          <div className="text-[12px] text-[var(--color-wise-text-muted)]">
                            {enrollment.student.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)] text-[14px] text-[var(--color-wise-text)]">
                      {enrollment.cohort.title}
                    </td>
                    <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)]">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1 bg-[var(--color-wise-surface-soft)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--color-wise-primary-text)] rounded-full"
                            style={{ width: `${enrollment.progress}%` }}
                            role="progressbar"
                            aria-valuenow={enrollment.progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                        <span className="text-[12px] font-[600] text-[var(--color-wise-text-muted)]">
                          {enrollment.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)]">
                      <EnrollmentStatusBadge status={enrollment.status} />
                    </td>
                    <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)]">
                      <PaymentStatusBadge status={enrollment.paymentStatus} />
                    </td>
                    <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)] text-[13px] text-[var(--color-wise-text-muted)]">
                      {formatDate(enrollment.enrolledAt)}
                    </td>
                    <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)]">
                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/students/${enrollment.student.id}`)
                          }}
                          className="text-[13px] font-[600] text-[var(--color-wise-primary-text)] hover:underline"
                        >
                          View Profile
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`mailto:${enrollment.student.email}`)
                          }}
                          className="text-[13px] font-[600] text-[var(--color-wise-text-muted)] hover:underline"
                        >
                          Email
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between px-8 py-4 border-t border-[var(--color-wise-ring)] bg-white">
          <p className="text-[13px] text-[var(--color-wise-text-muted)]">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} of{' '}
            {total}
          </p>
          <div className="flex gap-1" role="navigation" aria-label="Pagination">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              className="w-[34px] h-[34px] rounded-full border-[1.5px] border-[var(--color-wise-ring)] bg-white text-[var(--color-wise-text-muted)] flex items-center justify-center hover:bg-[var(--color-wise-surface-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = i + 1
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  aria-label={`Page ${pageNum}`}
                  aria-current={page === pageNum ? 'page' : undefined}
                  className={cn(
                    'w-[34px] h-[34px] rounded-full border-[1.5px] text-[13px] font-[600] flex items-center justify-center transition-colors',
                    page === pageNum
                      ? 'bg-[var(--color-wise-primary-text)] text-white border-[var(--color-wise-primary-text)]'
                      : 'border-[var(--color-wise-ring)] bg-white text-[var(--color-wise-text-muted)] hover:bg-[var(--color-wise-surface-soft)]',
                  )}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
              className="w-[34px] h-[34px] rounded-full border-[1.5px] border-[var(--color-wise-ring)] bg-white text-[var(--color-wise-text-muted)] flex items-center justify-center hover:bg-[var(--color-wise-surface-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
