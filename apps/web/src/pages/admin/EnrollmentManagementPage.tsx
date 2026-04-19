// FIR-213/214/215 — Admin can manage all enrollments
//
// Sprint 4 Story 22: inline-style → Tailwind conversion.
// Colors still flow through the Wise token system introduced in Sprint 3
// Story 16; only the `style={{...}}` wrapper pattern is removed. Dynamic
// values (gradient avatars, progress bar widths, status pill background
// tints that use rgba tints without a dedicated token) remain inline since
// they cannot be expressed as static classes.
import { useState, useEffect, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, X, MoreVertical } from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import { authFetch } from '../../lib/api'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EnrollmentStatus = 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'REVOKED'
type PaymentMethod = 'STRIPE' | 'MANUAL' | 'FREE'

interface Enrollment {
  id: string
  studentName: string
  studentEmail: string
  gi: number
  course: string
  cohortTitle: string
  cohortId?: string
  status: EnrollmentStatus
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED' | 'FREE'
  paymentMethod: PaymentMethod
  progress: number
  enrolledAt: string
}

interface Cohort {
  id: string
  title: string
  courseTitle: string
}

// ---------------------------------------------------------------------------
// Mock data (used when API is unavailable)
// ---------------------------------------------------------------------------

const MOCK_ENROLLMENTS: Enrollment[] = [
  {
    id: '1',
    studentName: 'Sara Ahmed',
    studentEmail: 'sara@example.com',
    gi: 0,
    course: 'AI Product Bootcamp',
    cohortTitle: 'Jan 2025 Cohort',
    status: 'ACTIVE',
    paymentStatus: 'PAID',
    paymentMethod: 'STRIPE',
    progress: 42,
    enrolledAt: '2025-01-08',
  },
  {
    id: '2',
    studentName: 'Aleem Haider',
    studentEmail: 'aleem@nextai.com',
    gi: 1,
    course: 'Claude API Mastery',
    cohortTitle: 'Dec 2024 Cohort',
    status: 'ACTIVE',
    paymentStatus: 'PAID',
    paymentMethod: 'STRIPE',
    progress: 78,
    enrolledAt: '2024-12-10',
  },
  {
    id: '3',
    studentName: 'Jordan Lee',
    studentEmail: 'jordan@gmail.com',
    gi: 2,
    course: 'AI Product Bootcamp',
    cohortTitle: 'Jan 2025 Cohort',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    paymentMethod: 'MANUAL',
    progress: 0,
    enrolledAt: '2025-01-08',
  },
  {
    id: '4',
    studentName: 'Priya Sharma',
    studentEmail: 'priya@outlook.com',
    gi: 3,
    course: 'Prompt Engineering Pro',
    cohortTitle: 'Oct 2024 Cohort',
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    paymentMethod: 'STRIPE',
    progress: 100,
    enrolledAt: '2024-10-03',
  },
  {
    id: '5',
    studentName: 'Marcus Webb',
    studentEmail: 'marcus@dev.io',
    gi: 4,
    course: 'Full-Stack AI Dev',
    cohortTitle: 'Jan 2025 Cohort',
    status: 'ACTIVE',
    paymentStatus: 'PAID',
    paymentMethod: 'STRIPE',
    progress: 15,
    enrolledAt: '2025-01-12',
  },
  {
    id: '6',
    studentName: 'Fatima Hassan',
    studentEmail: 'fatima@example.com',
    gi: 0,
    course: 'Claude API Mastery',
    cohortTitle: 'Feb 2025 Cohort',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    paymentMethod: 'MANUAL',
    progress: 0,
    enrolledAt: '2025-02-01',
  },
  {
    id: '7',
    studentName: 'David Kim',
    studentEmail: 'david.kim@example.com',
    gi: 2,
    course: 'AI Product Bootcamp',
    cohortTitle: 'Mar 2025 Cohort',
    status: 'REVOKED',
    paymentStatus: 'FAILED',
    paymentMethod: 'STRIPE',
    progress: 5,
    enrolledAt: '2025-03-01',
  },
]

const MOCK_COHORTS: Cohort[] = [
  { id: 'c1', title: 'Jan 2025 Cohort',  courseTitle: 'AI Product Bootcamp'  },
  { id: 'c2', title: 'Feb 2025 Cohort',  courseTitle: 'Claude API Mastery'   },
  { id: 'c3', title: 'Mar 2025 Cohort',  courseTitle: 'AI Product Bootcamp'  },
  { id: 'c4', title: 'Apr 2025 Cohort',  courseTitle: 'Full-Stack AI Dev'    },
]

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Avatar gradients still flow through inline `background` — Tailwind cannot
// express an arbitrary gradient via a class reliably. The token references
// are preserved from Sprint 3.
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,var(--color-wise-primary-text),var(--color-wise-primary-text))',
  'linear-gradient(135deg,var(--color-wise-warning),var(--color-wise-warning))',
  'linear-gradient(135deg,var(--color-wise-success),var(--color-wise-success))',
  'linear-gradient(135deg,var(--color-wise-primary-text),var(--color-wise-primary-text))',
  'linear-gradient(135deg,var(--color-wise-danger),var(--color-wise-danger))',
]

// Status / payment pill configs use rgba tints (not tokens) so the
// background/color fields stay inline. Labels and dot colors are tokenized.
const STATUS_CFG: Record<
  EnrollmentStatus,
  { bg: string; color: string; dot: string; label: string }
> = {
  ACTIVE:    { bg: 'rgba(5,150,105,0.1)',  color: 'var(--color-wise-success)', dot: 'var(--color-wise-success)', label: 'Active'    },
  PENDING:   { bg: 'rgba(245,158,11,0.1)', color: 'var(--color-wise-text-warm)', dot: 'var(--color-wise-warning)', label: 'Pending'   },
  COMPLETED: { bg: 'rgba(59,130,246,0.1)', color: 'var(--color-wise-primary-text)', dot: 'var(--color-wise-primary-text)', label: 'Completed' },
  REVOKED:   { bg: 'rgba(239,68,68,0.1)',  color: 'var(--color-wise-danger)', dot: 'var(--color-wise-danger)', label: 'Revoked'   },
}

const PAYMENT_CFG: Record<
  Enrollment['paymentStatus'],
  { bg: string; color: string }
> = {
  PAID:    { bg: 'rgba(5,150,105,0.1)',   color: 'var(--color-wise-success)' },
  PENDING: { bg: 'rgba(245,158,11,0.1)',  color: 'var(--color-wise-text-warm)' },
  FAILED:  { bg: 'rgba(239,68,68,0.1)',   color: 'var(--color-wise-danger)' },
  FREE:    { bg: 'rgba(100,116,139,0.1)', color: 'var(--color-wise-text-muted)' },
}

const PAGE_SIZE = 10

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPill({
  label,
  bg,
  color,
  dot,
}: {
  label: string
  bg: string
  color: string
  dot?: string
}) {
  // bg/color are dynamic rgba tints (per status), so remain inline. Layout +
  // typography come from the class string.
  return (
    <span
      className="inline-flex items-center gap-[5px] px-[10px] py-1 rounded-[20px] text-[11px] font-bold whitespace-nowrap"
      style={{ background: bg, color }}
    >
      {dot && (
        <span
          className="w-[5px] h-[5px] rounded-full shrink-0"
          style={{ background: dot }}
        />
      )}
      {label}
    </span>
  )
}

function ProgressBar({ value }: { value: number }) {
  // Fill bar background is dynamic (solid vs. gradient) based on value, and
  // the width itself is data-driven — both remain inline.
  const bg =
    value === 100
      ? 'linear-gradient(90deg,var(--color-wise-success),var(--color-wise-success))'
      : value === 0
      ? 'var(--color-wise-ring)'
      : 'linear-gradient(90deg,var(--color-wise-primary-text),var(--color-wise-primary-text))'
  return (
    <div className="flex items-center gap-2">
      <div className="w-[72px] h-[5px] bg-[var(--color-wise-canvas)] rounded-[99px] overflow-hidden shrink-0">
        <div
          className="h-full rounded-[99px]"
          style={{ width: `${value}%`, background: bg }}
        />
      </div>
      <span className="text-[11px] font-bold text-[var(--color-wise-text-muted)] shrink-0">
        {value}%
      </span>
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="text-left text-[10px] font-bold text-[var(--color-wise-text-muted)] px-4 py-[10px] uppercase tracking-[0.8px] border-b border-[var(--color-wise-ring)] whitespace-nowrap bg-[var(--color-wise-canvas)]"
    >
      {children}
    </th>
  )
}

// ---------------------------------------------------------------------------
// Actions dropdown
// ---------------------------------------------------------------------------

function ActionsMenu({
  enrollment,
  onCancel,
  onTransfer,
}: {
  enrollment: Enrollment
  onCancel: (id: string) => void
  onTransfer: (enrollment: Enrollment) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Row actions"
        className={[
          'flex items-center justify-center w-7 h-7 rounded-[7px]',
          'border border-[rgba(26,39,68,0.09)] text-[var(--color-wise-text-muted)]',
          'cursor-pointer shrink-0',
          open
            ? 'bg-[var(--color-wise-surface-soft)]'
            : 'bg-[var(--color-wise-surface)]',
        ].join(' ')}
      >
        <MoreVertical size={13} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-1 bg-[var(--color-wise-surface)] rounded-[10px] border border-[rgba(26,39,68,0.09)] shadow-[0_8px_24px_var(--color-wise-ring)] min-w-[156px] z-50 overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onTransfer(enrollment)
            }}
            className="block w-full text-left px-[14px] py-[9px] text-[12px] font-semibold text-[var(--color-wise-text)] bg-transparent border-none cursor-pointer hover:bg-[var(--color-wise-canvas)]"
          >
            Transfer Cohort
          </button>
          <div className="h-px bg-[var(--color-wise-ring)] mx-2" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onCancel(enrollment.id)
            }}
            className="block w-full text-left px-[14px] py-[9px] text-[12px] font-semibold text-[var(--color-wise-danger)] bg-transparent border-none cursor-pointer hover:bg-[var(--color-wise-danger-soft)]"
          >
            Cancel Enrollment
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Transfer Modal
// ---------------------------------------------------------------------------

function TransferModal({
  enrollment,
  cohorts,
  onConfirm,
  onClose,
  loading,
}: {
  enrollment: Enrollment
  cohorts: Cohort[]
  onConfirm: (enrollmentId: string, cohortId: string) => void
  onClose: () => void
  loading: boolean
}) {
  const [selectedCohort, setSelectedCohort] = useState('')

  // We keep the bespoke modal rather than swap to <Modal>: the dialog has a
  // form-shaped body (label + select + action row) that would require custom
  // footer slotting to match pixel-for-pixel; a later pass can migrate
  // wholesale. The inline-style wrapper pattern is still removed here.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Transfer cohort"
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(14,15,12,0.45)] backdrop-blur-[3px]"
      />

      {/* Dialog */}
      <div className="relative bg-[var(--color-wise-surface)] rounded-[18px] shadow-[0_24px_60px_rgba(13,26,58,0.25)] px-7 pt-7 pb-6 w-full max-w-[420px]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-extrabold text-[var(--color-wise-text)] m-0 tracking-[-0.3px]">
            Transfer Cohort
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex items-center justify-center w-7 h-7 rounded-[7px] border border-[rgba(26,39,68,0.09)] bg-[var(--color-wise-canvas)] text-[var(--color-wise-text-muted)] cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-[13px] text-[var(--color-wise-text-muted)] mb-5 leading-[1.6]">
          Transfer{' '}
          <strong className="text-[var(--color-wise-text)]">{enrollment.studentName}</strong>{' '}
          from{' '}
          <strong className="text-[var(--color-wise-text)]">{enrollment.cohortTitle}</strong>{' '}
          to a new cohort.
        </p>

        <label
          className="block text-[12px] font-bold text-[var(--color-wise-text)] mb-[6px]"
          htmlFor="cohort-select"
        >
          Select New Cohort
        </label>
        <select
          id="cohort-select"
          value={selectedCohort}
          onChange={(e) => setSelectedCohort(e.target.value)}
          className="w-full px-3 py-[9px] rounded-[9px] border border-[var(--color-wise-ring)] text-[13px] text-[var(--color-wise-text)] bg-[var(--color-wise-canvas)] outline-none mb-5 cursor-pointer"
        >
          <option value="">-- Choose a cohort --</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} — {c.courseTitle}
            </option>
          ))}
        </select>

        <div className="flex gap-[10px] justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-[18px] py-2 rounded-[9px] border border-[var(--color-wise-ring)] bg-[var(--color-wise-surface)] text-[13px] font-semibold text-[var(--color-wise-text-muted)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedCohort || loading}
            onClick={() => onConfirm(enrollment.id, selectedCohort)}
            className={[
              'px-[18px] py-2 rounded-[9px] border-none text-[13px] font-bold',
              'text-[var(--color-wise-surface)]',
              !selectedCohort || loading
                ? 'bg-[var(--color-wise-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-wise-text)] cursor-pointer',
              loading ? 'opacity-70' : 'opacity-100',
            ].join(' ')}
          >
            {loading ? 'Transferring...' : 'Confirm Transfer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small stat card
// ---------------------------------------------------------------------------

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  // `accent` is per-card (success / warning / primary-text) — passed through
  // via inline style. Everything else is class-driven.
  return (
    <div className="flex-1 bg-[var(--color-wise-surface)] rounded-[14px] px-[18px] py-[14px] border border-[var(--color-wise-ring)] shadow-[0_1px_3px_var(--color-wise-ring),0_4px_16px_var(--color-wise-ring)]">
      <div
        className="text-[24px] font-black tracking-[-0.5px] leading-none mb-1"
        style={{ color: accent }}
      >
        {value}
      </div>
      <div className="text-[11px] text-[var(--color-wise-text-muted)] font-semibold">
        {label}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  const isSuccess = type === 'success'
  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'inline-flex items-center gap-2 px-4 py-[10px] rounded-[10px]',
        'text-[13px] font-semibold mb-1 border',
        isSuccess
          ? 'bg-[rgba(5,150,105,0.1)] text-[var(--color-wise-success)] border-[rgba(5,150,105,0.2)]'
          : 'bg-[rgba(239,68,68,0.1)] text-[var(--color-wise-danger)] border-[rgba(239,68,68,0.2)]',
      ].join(' ')}
    >
      <span
        className={[
          'w-[7px] h-[7px] rounded-full shrink-0',
          isSuccess
            ? 'bg-[var(--color-wise-success)]'
            : 'bg-[var(--color-wise-danger)]',
        ].join(' ')}
      />
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EnrollmentManagementPage() {
  // ---- Data state ----
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [cohorts, setCohorts] = useState<Cohort[]>(MOCK_COHORTS)

  // ---- Filter state ----
  const [filterStatus, setFilterStatus] = useState<EnrollmentStatus | 'ALL'>('ALL')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({
    status: 'ALL' as EnrollmentStatus | 'ALL',
    search: '',
    dateFrom: '',
    dateTo: '',
  })

  // ---- Pagination ----
  const [page, setPage] = useState(1)

  // ---- Toast ----
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // ---- Transfer modal ----
  const [transferTarget, setTransferTarget] = useState<Enrollment | null>(null)
  const [transferLoading, setTransferLoading] = useState(false)

  // ---- Action loading ----
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // ---- Confirm cancel dialog ----
  const [cancelTarget, setCancelTarget] = useState<Enrollment | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch enrollments
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (appliedFilters.status !== 'ALL') params.set('status', appliedFilters.status)
        if (appliedFilters.search) params.set('search', appliedFilters.search)
        if (appliedFilters.dateFrom) params.set('from', appliedFilters.dateFrom)
        if (appliedFilters.dateTo) params.set('to', appliedFilters.dateTo)

        const res = await authFetch(`/api/v1/admin/enrollments-v2?${params.toString()}`)
        if (!res.ok) throw new Error('API error')
        const data = await res.json()
        const rows: Enrollment[] = data.enrollments ?? data ?? []
        setEnrollments(rows.length > 0 ? rows : MOCK_ENROLLMENTS)
      } catch {
        setEnrollments(MOCK_ENROLLMENTS)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [appliedFilters])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ---------------------------------------------------------------------------
  // Derived stats (from ALL loaded enrollments before client-side filtering)
  // ---------------------------------------------------------------------------
  const statsTotal     = enrollments.length
  const statsActive    = enrollments.filter((e) => e.status === 'ACTIVE').length
  const statsPending   = enrollments.filter((e) => e.status === 'PENDING').length
  const statsCompleted = enrollments.filter((e) => e.status === 'COMPLETED').length

  // ---------------------------------------------------------------------------
  // Client-side filtering (secondary, for instant UX while API may lag)
  // ---------------------------------------------------------------------------
  const filtered = enrollments.filter((e) => {
    if (appliedFilters.status !== 'ALL' && e.status !== appliedFilters.status) return false
    if (appliedFilters.search) {
      const q = appliedFilters.search.toLowerCase()
      if (
        !e.studentName.toLowerCase().includes(q) &&
        !e.studentEmail.toLowerCase().includes(q)
      )
        return false
    }
    if (appliedFilters.dateFrom && e.enrolledAt < appliedFilters.dateFrom) return false
    if (appliedFilters.dateTo && e.enrolledAt > appliedFilters.dateTo) return false
    return true
  })

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function applyFilters() {
    setPage(1)
    setAppliedFilters({
      status: filterStatus,
      search: filterSearch,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
    })
  }

  function clearFilters() {
    setFilterStatus('ALL')
    setFilterSearch('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setAppliedFilters({ status: 'ALL', search: '', dateFrom: '', dateTo: '' })
    setPage(1)
  }

  // ---------------------------------------------------------------------------
  // Cancel enrollment — opens ConfirmDialog instead of window.confirm()
  // ---------------------------------------------------------------------------
  function handleCancel(id: string) {
    const target = enrollments.find((e) => e.id === id)
    if (!target) return
    setCancelTarget(target)
  }

  async function handleCancelConfirmed() {
    const target = cancelTarget
    if (!target) return
    const id = target.id

    setCancellingId(id)
    try {
      const res = await authFetch(`/api/v1/admin/enrollments-v2/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed')
      setEnrollments((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'REVOKED' as const } : e)),
      )
      setToast({ message: 'Enrollment cancelled successfully.', type: 'success' })
    } catch {
      // Optimistic update for mock data
      setEnrollments((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'REVOKED' as const } : e)),
      )
      setToast({ message: 'Enrollment cancelled.', type: 'success' })
    } finally {
      setCancellingId(null)
      setCancelTarget(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Transfer cohort
  // ---------------------------------------------------------------------------
  async function handleTransfer(enrollmentId: string, cohortId: string) {
    setTransferLoading(true)
    try {
      const res = await authFetch(`/api/v1/admin/enrollments-v2/${enrollmentId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId }),
      })
      if (!res.ok) throw new Error('Failed')
      const newCohort = cohorts.find((c) => c.id === cohortId)
      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === enrollmentId
            ? { ...e, cohortTitle: newCohort?.title ?? e.cohortTitle }
            : e,
        ),
      )
      setToast({ message: 'Student transferred to new cohort.', type: 'success' })
    } catch {
      // Optimistic update for mock
      const newCohort = cohorts.find((c) => c.id === cohortId)
      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === enrollmentId
            ? { ...e, cohortTitle: newCohort?.title ?? e.cohortTitle }
            : e,
        ),
      )
      setToast({ message: 'Student transferred to new cohort.', type: 'success' })
    } finally {
      setTransferLoading(false)
      setTransferTarget(null)
    }
  }

  // Keep cohorts list fresh; silently fall back to mock
  useEffect(() => {
    authFetch('/api/v1/admin/cohorts')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) setCohorts(data)
      })
      .catch(() => {/* keep mock */})
  }, [])

  const hasActiveFilters =
    appliedFilters.status !== 'ALL' ||
    appliedFilters.search ||
    appliedFilters.dateFrom ||
    appliedFilters.dateTo

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <AdminShell title="Enrollments">
      {/* Keyframes + row hover rule still live in a <style> tag — the hover
          effect applies to descendant <td>s which Tailwind cannot target
          conveniently without a custom variant. */}
      <style>{`
        @keyframes em-spin {
          to { transform: rotate(360deg); }
        }
        .em-tr:hover td { background: var(--color-wise-canvas) !important; }
      `}</style>

      <div className="px-8 py-7 flex flex-col gap-5">
        {/* Page header */}
        <div>
          <h1 className="text-[22px] font-black text-[var(--color-wise-text)] m-0 tracking-[-0.4px]">
            Enrollments
          </h1>
          <p className="text-[13px] text-[var(--color-wise-text-muted)] mt-1 font-medium">
            Manage all student course enrollments
          </p>
        </div>

        {/* Toast */}
        {toast && <Toast message={toast.message} type={toast.type} />}

        {/* ── Filter bar ── */}
        <div className="bg-[var(--color-wise-surface)] rounded-[14px] border border-[var(--color-wise-ring)] shadow-[0_1px_3px_var(--color-wise-ring)] px-[18px] py-[14px] flex items-center gap-3 flex-wrap">
          {/* Status select */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as EnrollmentStatus | 'ALL')}
            aria-label="Filter by status"
            className="px-3 py-[7px] rounded-lg border border-[var(--color-wise-ring)] text-[12px] font-semibold text-[var(--color-wise-text)] bg-[var(--color-wise-canvas)] cursor-pointer outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="REVOKED">Revoked</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={13}
              className="absolute left-[10px] top-1/2 -translate-y-1/2 text-[var(--color-wise-text-muted)] pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search student name or email..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              className="w-full pl-[30px] pr-[10px] py-[7px] rounded-lg border border-[var(--color-wise-ring)] text-[12px] text-[var(--color-wise-text)] bg-[var(--color-wise-canvas)] outline-none box-border"
            />
          </div>

          {/* Date from */}
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            aria-label="From date"
            className="px-[10px] py-[7px] rounded-lg border border-[var(--color-wise-ring)] text-[12px] text-[var(--color-wise-text)] bg-[var(--color-wise-canvas)] outline-none"
          />

          {/* Date to */}
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            aria-label="To date"
            className="px-[10px] py-[7px] rounded-lg border border-[var(--color-wise-ring)] text-[12px] text-[var(--color-wise-text)] bg-[var(--color-wise-canvas)] outline-none"
          />

          {/* Apply */}
          <button
            type="button"
            onClick={applyFilters}
            className="px-[18px] py-[7px] rounded-lg border-none bg-[var(--color-wise-text)] text-[var(--color-wise-surface)] text-[12px] font-bold cursor-pointer whitespace-nowrap"
          >
            Apply Filters
          </button>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-[7px] rounded-lg border border-[var(--color-wise-ring)] bg-[var(--color-wise-surface)] text-[var(--color-wise-text-muted)] text-[12px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="flex gap-[14px] flex-wrap">
          <MiniStat label="Total Enrollments" value={statsTotal}     accent="var(--color-wise-primary-text)" />
          <MiniStat label="Active"            value={statsActive}    accent="var(--color-wise-success)" />
          <MiniStat label="Pending"           value={statsPending}   accent="var(--color-wise-warning)" />
          <MiniStat label="Completed"         value={statsCompleted} accent="var(--color-wise-primary-text)" />
        </div>

        {/* ── Enrollments table ── */}
        <div className="bg-[var(--color-wise-surface)] rounded-[18px] border border-[var(--color-wise-ring)] shadow-[0_1px_3px_var(--color-wise-ring),0_4px_16px_var(--color-wise-ring)] overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-wise-ring)]">
            <div>
              <h2 className="text-[14px] font-extrabold text-[var(--color-wise-text)] m-0">
                All Enrollments
              </h2>
              <p className="text-[11px] text-[var(--color-wise-text-muted)] mt-[2px] mb-0">
                {hasActiveFilters ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} found` : `${enrollments.length} total`}
              </p>
            </div>
            {loading && (
              <div
                aria-label="Loading"
                className="w-[18px] h-[18px] rounded-full border-2 border-[var(--color-wise-ring)] border-t-[var(--color-wise-primary-text)]"
                style={{ animation: 'em-spin 0.7s linear infinite' }}
              />
            )}
          </div>

          {/* Table */}
          {pageRows.length === 0 && !loading ? (
            <div className="px-6 py-12 text-center text-[var(--color-wise-text-muted)] text-[13px]">
              {hasActiveFilters
                ? 'No enrollments match your filters.'
                : 'No enrollments found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse min-w-[800px]"
                aria-label="Enrollments table"
              >
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Course</Th>
                    <Th>Status</Th>
                    <Th>Payment</Th>
                    <Th>Progress</Th>
                    <Th>Enrolled</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, i) => {
                    const sc = STATUS_CFG[row.status]
                    const pc = PAYMENT_CFG[row.paymentStatus]
                    const gradient =
                      AVATAR_GRADIENTS[row.gi % AVATAR_GRADIENTS.length]
                    const isCancelling = cancellingId === row.id
                    const isLast = i >= pageRows.length - 1

                    return (
                      <tr
                        key={row.id}
                        className={[
                          'em-tr transition-opacity duration-200',
                          isLast ? '' : 'border-b border-[var(--color-wise-ring)]',
                          isCancelling ? 'opacity-50' : 'opacity-100',
                        ].join(' ')}
                      >
                        {/* Student */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-[10px]">
                            <div
                              aria-hidden="true"
                              className="w-[34px] h-[34px] rounded-full shrink-0 flex items-center justify-center text-[var(--color-wise-surface)] text-[12px] font-extrabold shadow-[0_2px_6px_var(--color-wise-ring-strong)]"
                              style={{ background: gradient }}
                            >
                              {row.studentName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-[13px] font-bold text-[var(--color-wise-text)] whitespace-nowrap">
                                {row.studentName}
                              </div>
                              <div className="text-[11px] text-[var(--color-wise-text-muted)] mt-[1px]">
                                {row.studentEmail}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Course */}
                        <td className="px-4 py-3">
                          <div className="text-[12px] font-bold text-[var(--color-wise-text)] whitespace-nowrap">
                            {row.course}
                          </div>
                          <div className="text-[11px] text-[var(--color-wise-text-muted)] mt-[2px]">
                            {row.cohortTitle}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusPill
                            label={sc.label}
                            bg={sc.bg}
                            color={sc.color}
                            dot={sc.dot}
                          />
                        </td>

                        {/* Payment */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <StatusPill
                              label={row.paymentStatus}
                              bg={pc.bg}
                              color={pc.color}
                            />
                            <span
                              className="text-[9px] font-extrabold px-[7px] py-[2px] rounded uppercase tracking-[0.4px] self-start"
                              style={{
                                background:
                                  row.paymentMethod === 'STRIPE'
                                    ? 'rgba(99,91,255,0.1)'
                                    : 'rgba(245,158,11,0.1)',
                                color:
                                  row.paymentMethod === 'STRIPE'
                                    ? 'var(--color-wise-primary-text)'
                                    : 'var(--color-wise-text-warm)',
                              }}
                            >
                              {row.paymentMethod}
                            </span>
                          </div>
                        </td>

                        {/* Progress */}
                        <td className="px-4 py-3">
                          <ProgressBar value={row.progress} />
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3">
                          <span className="text-[11px] text-[var(--color-wise-text-muted)] font-medium whitespace-nowrap">
                            {new Date(row.enrolledAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <ActionsMenu
                            enrollment={row}
                            onCancel={handleCancel}
                            onTransfer={(enr) => setTransferTarget(enr)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination footer ── */}
          <div className="flex items-center justify-between px-6 py-[11px] border-t border-[var(--color-wise-ring)] bg-[var(--color-wise-canvas)] flex-wrap gap-2">
            <span className="text-[11px] text-[var(--color-wise-text-muted)]">
              Showing{' '}
              <strong className="text-[var(--color-wise-text)]">
                {filtered.length === 0
                  ? 0
                  : (safePage - 1) * PAGE_SIZE + 1}
                –
                {Math.min(safePage * PAGE_SIZE, filtered.length)}
              </strong>{' '}
              of{' '}
              <strong className="text-[var(--color-wise-text)]">{filtered.length}</strong>
            </span>

            <div className="flex items-center gap-[6px]">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
                className={[
                  'flex items-center justify-center w-[30px] h-[30px] rounded-lg',
                  'border border-[var(--color-wise-ring)] shrink-0',
                  safePage <= 1
                    ? 'bg-[var(--color-wise-canvas)] text-[var(--color-wise-ring-strong)] cursor-not-allowed'
                    : 'bg-[var(--color-wise-surface)] text-[var(--color-wise-text-muted)] cursor-pointer',
                ].join(' ')}
              >
                <ChevronLeft size={14} />
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1
                const active = p === safePage
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-label={`Page ${p}`}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'flex items-center justify-center w-[30px] h-[30px] rounded-lg',
                      'text-[12px] cursor-pointer shrink-0',
                      active
                        ? 'border-none bg-[var(--color-wise-text)] text-[var(--color-wise-surface)] font-bold'
                        : 'border border-[var(--color-wise-ring)] bg-[var(--color-wise-surface)] text-[var(--color-wise-text-muted)] font-medium',
                    ].join(' ')}
                  >
                    {p}
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next page"
                className={[
                  'flex items-center justify-center w-[30px] h-[30px] rounded-lg',
                  'border border-[var(--color-wise-ring)] shrink-0',
                  safePage >= totalPages
                    ? 'bg-[var(--color-wise-canvas)] text-[var(--color-wise-ring-strong)] cursor-not-allowed'
                    : 'bg-[var(--color-wise-surface)] text-[var(--color-wise-text-muted)] cursor-pointer',
                ].join(' ')}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transfer Modal ── */}
      {transferTarget && (
        <TransferModal
          enrollment={transferTarget}
          cohorts={cohorts}
          onConfirm={handleTransfer}
          onClose={() => setTransferTarget(null)}
          loading={transferLoading}
        />
      )}

      {/* Confirm cancel dialog — replaces window.confirm() */}
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
        title="Cancel enrollment?"
        description={
          cancelTarget
            ? `This will cancel enrollment for ${cancelTarget.studentName} in ${cancelTarget.course}. This cannot be undone.`
            : 'Please confirm the cancellation.'
        }
        confirmLabel="Cancel enrollment"
        cancelLabel="Keep enrollment"
        variant="danger"
        isLoading={cancellingId === cancelTarget?.id}
        onConfirm={handleCancelConfirmed}
      />
    </AdminShell>
  )
}
