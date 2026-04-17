// FIR-166 — Admin student list with search, filters, sortable table, and slide-in detail drawer
import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Search, X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import {
  fetchAdminStudents,
  updateEnrollmentStatus,
  authFetch,
  type AdminEnrollment,
} from '../../lib/api'
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
  'linear-gradient(135deg, #4a9ad4, #1a2744)',
  'linear-gradient(135deg, #cc4a00, #ff8c5a)',
  'linear-gradient(135deg, #054d28, #16a34a)',
  'linear-gradient(135deg, #4a105a, #6b37d1)',
  'linear-gradient(135deg, #0d1a3a, #2d4a8a)',
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
        'flex items-center gap-3 px-5 py-3.5 rounded-[14px] shadow-[rgba(26,39,68,0.2)_0_4px_20px]',
        'text-[14px] font-semibold',
        toast.variant === 'success'
          ? 'bg-[#e6f4ec] text-[#054d28] border border-[rgba(5,77,40,0.15)]'
          : 'bg-[#fdeaeb] text-[#d03238] border border-[rgba(208,50,56,0.15)]',
      )}
    >
      <span aria-hidden="true">{toast.variant === 'success' ? '✓' : '✗'}</span>
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
    ACTIVE: 'bg-[#e6f4ec] text-[#054d28]',
    COMPLETED: 'bg-[#e8ecf4] text-[#1a2744]',
    SUSPENDED: 'bg-[#fff8e6] text-[#8a5a00]',
    REVOKED: 'bg-[#fdeaeb] text-[#d03238]',
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
    PAID: 'bg-[#e6f4ec] text-[#054d28]',
    PARTIAL: 'bg-[#fff8e6] text-[#8a5a00]',
    PENDING: 'bg-[#fff8e6] text-[#8a5a00]',
    FAILED: 'bg-[#fdeaeb] text-[#d03238]',
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
      className="fixed inset-0 z-[60] bg-[rgba(13,26,58,0.5)] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-[20px] p-8 w-full max-w-[460px] shadow-[rgba(26,39,68,0.2)_0_20px_60px]">
        <h2 className="text-[20px] font-[800] text-[#1a2744] mb-1">{actionLabel} Access</h2>
        <p className="text-[14px] text-[#717182] mb-6">
          This will{' '}
          <span className="font-semibold text-[#1a2744]">{actionLabel.toLowerCase()}</span>{' '}
          <span className="font-semibold text-[#1a2744]">{enrollment.student.name}</span>'s access
          to <span className="font-semibold text-[#1a2744]">{enrollment.cohort.title}</span>.
        </p>

        <label htmlFor="action-reason" className="block text-[13px] font-[600] text-[#1a2744] mb-2">
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
            'bg-[#f8f9fb] resize-none outline-none transition-colors',
            'focus:border-[#4a9ad4] focus:bg-white border-[rgba(26,39,68,0.15)]',
          )}
        />

        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-5 py-2.5 rounded-full bg-[#f0f0f0] text-[#717182] text-[14px] font-[700] hover:bg-[#e8ecf4] transition-colors disabled:opacity-50"
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
                ? 'bg-[#fdeaeb] text-[#d03238] hover:bg-[#fad0d2]'
                : 'bg-[#fff8e6] text-[#8a5a00] hover:bg-[#fff0cc]',
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
        className="fixed inset-0 bg-[rgba(13,26,58,0.4)]"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="relative z-50 w-full max-w-[520px] h-full bg-white shadow-[-8px_0_40px_rgba(26,39,68,0.15)] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-[rgba(26,39,68,0.08)]">
          <h2 className="text-[18px] font-[800] text-[#1a2744]">Student Details</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details panel"
            className="w-9 h-9 rounded-full bg-[#f0f0f0] flex items-center justify-center hover:bg-[#e8ecf4] transition-colors"
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
              <div className="text-[20px] font-[800] text-[#1a2744]">{student.name}</div>
              <div className="text-[14px] text-[#717182] mt-0.5">{student.email}</div>
              <div className="text-[13px] text-[#a3a3a3] mt-0.5">
                Joined {formatDate(student.joinedAt)}
              </div>
            </div>
          </div>

          {/* Enrollment section */}
          <div className="mb-6">
            <h3 className="text-[12px] font-[700] text-[#717182] uppercase tracking-[0.8px] mb-3">
              Enrollment
            </h3>
            <div className="bg-[#f8f9fb] rounded-[12px] p-4">
              <div className="text-[14px] font-[700] text-[#1a2744] mb-3">{cohort.title}</div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1 h-[5px] bg-[#e8ecf4] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#4a9ad4] rounded-full"
                      style={{ width: `${progress}%` }}
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                  <span className="text-[12px] font-[600] text-[#717182] whitespace-nowrap">
                    {progress}%
                  </span>
                </div>
                <PaymentStatusBadge status={paymentStatus} />
                <EnrollmentStatusBadge status={status} />
              </div>
              <div className="text-[12px] text-[#a3a3a3] mt-2">
                Enrolled {formatDate(enrolledAt)}
              </div>
            </div>
          </div>

          {/* Details table */}
          <div className="mb-6">
            <h3 className="text-[12px] font-[700] text-[#717182] uppercase tracking-[0.8px] mb-3">
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
                className="flex justify-between items-center py-2.5 border-b border-[rgba(26,39,68,0.04)] last:border-b-0"
              >
                <span className="text-[14px] text-[#717182]">{label}</span>
                <span className="text-[14px] font-[600] text-[#1a2744]">{value}</span>
              </div>
            ))}
          </div>

          {/* Installment timeline */}
          {installments && installments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[12px] font-[700] text-[#717182] uppercase tracking-[0.8px] mb-3">
                Payment Timeline
              </h3>
              <div className="flex flex-col gap-2">
                {installments.map((inst, idx) => {
                  const statusColor =
                    inst.status === 'PAID'
                      ? 'bg-[#e6f4ec] text-[#054d28]'
                      : inst.status === 'OVERDUE'
                        ? 'bg-[#fdeaeb] text-[#d03238]'
                        : 'bg-[#fff8e6] text-[#8a5a00]'
                  return (
                    <div
                      key={inst.id}
                      className="flex items-center justify-between py-2.5 border-b border-[rgba(26,39,68,0.04)] last:border-b-0"
                    >
                      <div>
                        <div className="text-[13px] font-[600] text-[#1a2744]">
                          Payment {idx + 1} — {formatMoney(inst.amount)}
                        </div>
                        <div className="text-[12px] text-[#717182]">
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
                    'bg-[#fff8e6] text-[#8a5a00] hover:bg-[#fff0cc]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]',
                  )}
                >
                  Suspend Access
                </button>
                <button
                  type="button"
                  onClick={() => onRevoke(enrollment)}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-full text-[14px] font-[700] transition-colors',
                    'bg-[#fdeaeb] text-[#d03238] hover:bg-[#fad0d2]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d03238]',
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
                  'bg-[#e6f4ec] text-[#054d28] hover:bg-[#c8ecda]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]',
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
                'bg-[#f0f0f0] text-[#1a2744] hover:bg-[#e8ecf4]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9ad4]',
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
    staleTime: 30_000,
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
          className="px-5 py-2 rounded-full border-[1.5px] border-[rgba(26,39,68,0.15)] text-[#717182] text-[14px] font-[600] hover:bg-[#f0f0f0] transition-colors inline-flex items-center gap-2"
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
      <div className="flex border-b border-[rgba(26,39,68,0.08)] bg-white">
        {[
          { label: 'Total Students', value: String(total) },
          { label: 'Active Enrollments', value: '—' },
          { label: 'Pending Approval', value: '—' },
          { label: 'Failed Payments', value: '—' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex-1 px-7 py-5 border-r border-[rgba(26,39,68,0.06)] last:border-r-0"
          >
            <div className="text-[28px] font-[900] text-[#1a2744] tracking-[-0.5px]">
              {stat.value}
            </div>
            <div className="text-[13px] text-[#717182] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-8 py-5 border-b border-[rgba(26,39,68,0.06)] bg-white flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search students"
            className={cn(
              'w-full pl-9 pr-4 py-2.5 rounded-full text-[14px] text-[#1a2744] font-[inherit]',
              'border-[1.5px] border-[rgba(26,39,68,0.12)] bg-[#f8f9fb] outline-none transition-colors',
              'focus:border-[#4a9ad4] focus:bg-white',
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
            'px-4 py-2.5 rounded-full border-[1.5px] border-[rgba(26,39,68,0.12)]',
            'text-[14px] text-[#717182] bg-white outline-none cursor-pointer font-[inherit]',
            'focus:border-[#4a9ad4]',
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
            'px-4 py-2.5 rounded-full border-[1.5px] border-[rgba(26,39,68,0.12)]',
            'text-[14px] text-[#717182] bg-white outline-none cursor-pointer font-[inherit]',
            'focus:border-[#4a9ad4]',
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
            className="bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(26,39,68,0.04)] last:border-b-0"
                aria-hidden="true"
              >
                <div className="w-9 h-9 rounded-full bg-[#e8ecf4] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#e8ecf4] rounded animate-pulse w-1/4" />
                  <div className="h-3 bg-[#e8ecf4] rounded animate-pulse w-1/5" />
                </div>
                <div className="h-3 bg-[#e8ecf4] rounded animate-pulse w-24" />
                <div className="h-3 bg-[#e8ecf4] rounded animate-pulse w-16" />
                <div className="h-3 bg-[#e8ecf4] rounded animate-pulse w-16" />
              </div>
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-[40px] mb-4" aria-hidden="true">⚠️</div>
            <p className="text-[16px] font-[600] text-[#1a2744]">Failed to load students</p>
          </div>
        )}

        {!isLoading && !isError && enrollments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-[48px] mb-4" aria-hidden="true">👥</div>
            <p className="text-[16px] font-[600] text-[#1a2744]">No students found</p>
            <p className="text-[14px] text-[#717182] mt-1">
              {debouncedQuery || statusFilter ? 'Try adjusting your filters.' : 'No enrollments yet.'}
            </p>
          </div>
        )}

        {!isLoading && !isError && enrollments.length > 0 && (
          <div className="bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden">
            <table className="w-full border-collapse" aria-label="Student enrollments">
              <thead>
                <tr>
                  {['Student', 'Course', 'Progress', 'Status', 'Payment', 'Enrolled', 'Actions'].map(
                    (col) => (
                      <th
                        key={col}
                        scope="col"
                        className="text-left text-[12px] font-[600] text-[#717182] px-5 py-3 border-b border-[rgba(26,39,68,0.08)] uppercase tracking-[0.5px] bg-[#f8f9fb]"
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
                    className="cursor-pointer hover:[&>td]:bg-[#f8f9fb] transition-colors"
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
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
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
                          <div className="text-[14px] font-[600] text-[#1a2744]">
                            {enrollment.student.name}
                          </div>
                          <div className="text-[12px] text-[#717182]">
                            {enrollment.student.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[14px] text-[#1a2744]">
                      {enrollment.cohort.title}
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1 bg-[#e8ecf4] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#4a9ad4] rounded-full"
                            style={{ width: `${enrollment.progress}%` }}
                            role="progressbar"
                            aria-valuenow={enrollment.progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                        <span className="text-[12px] font-[600] text-[#717182]">
                          {enrollment.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                      <EnrollmentStatusBadge status={enrollment.status} />
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                      <PaymentStatusBadge status={enrollment.paymentStatus} />
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]">
                      {formatDate(enrollment.enrolledAt)}
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/students/${enrollment.student.id}`)
                          }}
                          className="text-[13px] font-[600] text-[#4a9ad4] hover:underline"
                        >
                          View Profile
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`mailto:${enrollment.student.email}`)
                          }}
                          className="text-[13px] font-[600] text-[#717182] hover:underline"
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
        <div className="flex items-center justify-between px-8 py-4 border-t border-[rgba(26,39,68,0.06)] bg-white">
          <p className="text-[13px] text-[#717182]">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} of{' '}
            {total}
          </p>
          <div className="flex gap-1" role="navigation" aria-label="Pagination">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              className="w-[34px] h-[34px] rounded-full border-[1.5px] border-[rgba(26,39,68,0.12)] bg-white text-[#717182] flex items-center justify-center hover:bg-[#f0f0f0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                      ? 'bg-[#4a9ad4] text-white border-[#4a9ad4]'
                      : 'border-[rgba(26,39,68,0.12)] bg-white text-[#717182] hover:bg-[#f0f0f0]',
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
              className="w-[34px] h-[34px] rounded-full border-[1.5px] border-[rgba(26,39,68,0.12)] bg-white text-[#717182] flex items-center justify-center hover:bg-[#f0f0f0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
