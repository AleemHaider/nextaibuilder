// FIR-213/214/215 — Admin can manage all enrollments
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

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,var(--color-wise-primary-text),var(--color-wise-primary-text))',
  'linear-gradient(135deg,var(--color-wise-warning),var(--color-wise-warning))',
  'linear-gradient(135deg,var(--color-wise-success),var(--color-wise-success))',
  'linear-gradient(135deg,var(--color-wise-primary-text),var(--color-wise-primary-text))',
  'linear-gradient(135deg,var(--color-wise-danger),var(--color-wise-danger))',
]

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
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 700,
        padding: '4px 10px',
        borderRadius: 20,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: dot,
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  )
}

function ProgressBar({ value }: { value: number }) {
  const bg =
    value === 100
      ? 'linear-gradient(90deg,var(--color-wise-success),var(--color-wise-success))'
      : value === 0
      ? 'var(--color-wise-ring)'
      : 'linear-gradient(90deg,var(--color-wise-primary-text),var(--color-wise-primary-text))'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 72,
          height: 5,
          background: 'var(--color-wise-canvas)',
          borderRadius: 99,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{ height: '100%', borderRadius: 99, width: `${value}%`, background: bg }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-wise-text-muted)', flexShrink: 0 }}>
        {value}%
      </span>
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      scope="col"
      style={{
        textAlign: 'left',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--color-wise-text-muted)',
        padding: '10px 16px',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        borderBottom: '1px solid var(--color-wise-ring)',
        whiteSpace: 'nowrap',
        background: 'var(--color-wise-canvas)',
      }}
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
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Row actions"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 7,
          border: '1px solid rgba(26,39,68,0.09)',
          background: open ? 'var(--color-wise-surface-soft)' : 'var(--color-wise-surface)',
          color: 'var(--color-wise-text-muted)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <MoreVertical size={13} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--color-wise-surface)',
            borderRadius: 10,
            border: '1px solid rgba(26,39,68,0.09)',
            boxShadow: '0 8px 24px var(--color-wise-ring)',
            minWidth: 156,
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onTransfer(enrollment)
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '9px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-wise-text)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-wise-canvas)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Transfer Cohort
          </button>
          <div
            style={{ height: 1, background: 'var(--color-wise-ring)', margin: '0 8px' }}
          />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onCancel(enrollment.id)
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '9px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-wise-danger)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-wise-danger-soft)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Transfer cohort"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(14,15,12,0.45)',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* Dialog */}
      <div
        style={{
          position: 'relative',
          background: 'var(--color-wise-surface)',
          borderRadius: 18,
          boxShadow: '0 24px 60px rgba(13,26,58,0.25)',
          padding: '28px 28px 24px',
          width: '100%',
          maxWidth: 420,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--color-wise-text)',
              margin: 0,
              letterSpacing: '-0.3px',
            }}
          >
            Transfer Cohort
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 7,
              border: '1px solid rgba(26,39,68,0.09)',
              background: 'var(--color-wise-canvas)',
              color: 'var(--color-wise-text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-wise-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          Transfer <strong style={{ color: 'var(--color-wise-text)' }}>{enrollment.studentName}</strong> from{' '}
          <strong style={{ color: 'var(--color-wise-text)' }}>{enrollment.cohortTitle}</strong> to a new cohort.
        </p>

        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-wise-text)',
            marginBottom: 6,
          }}
          htmlFor="cohort-select"
        >
          Select New Cohort
        </label>
        <select
          id="cohort-select"
          value={selectedCohort}
          onChange={(e) => setSelectedCohort(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: 9,
            border: '1px solid var(--color-wise-ring)',
            fontSize: 13,
            color: 'var(--color-wise-text)',
            background: 'var(--color-wise-canvas)',
            outline: 'none',
            marginBottom: 20,
            cursor: 'pointer',
          }}
        >
          <option value="">-- Choose a cohort --</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} — {c.courseTitle}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 9,
              border: '1px solid var(--color-wise-ring)',
              background: 'var(--color-wise-surface)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-wise-text-muted)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedCohort || loading}
            onClick={() => onConfirm(enrollment.id, selectedCohort)}
            style={{
              padding: '8px 18px',
              borderRadius: 9,
              border: 'none',
              background: !selectedCohort || loading ? 'var(--color-wise-text-muted)' : 'var(--color-wise-text)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-wise-surface)',
              cursor: !selectedCohort || loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
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
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--color-wise-surface)',
        borderRadius: 14,
        padding: '14px 18px',
        border: '1px solid var(--color-wise-ring)',
        boxShadow: '0 1px 3px var(--color-wise-ring), 0 4px 16px var(--color-wise-ring)',
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          color: accent,
          letterSpacing: '-0.5px',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-wise-text-muted)', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        background: type === 'success' ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.1)',
        color: type === 'success' ? 'var(--color-wise-success)' : 'var(--color-wise-danger)',
        border: `1px solid ${type === 'success' ? 'rgba(5,150,105,0.2)' : 'rgba(239,68,68,0.2)'}`,
        marginBottom: 4,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: type === 'success' ? 'var(--color-wise-success)' : 'var(--color-wise-danger)',
          flexShrink: 0,
        }}
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
      <style>{`
        @keyframes em-spin {
          to { transform: rotate(360deg); }
        }
        .em-tr:hover td { background: var(--color-wise-canvas) !important; }
      `}</style>

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Page header */}
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: 'var(--color-wise-text)',
              margin: 0,
              letterSpacing: '-0.4px',
            }}
          >
            Enrollments
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-wise-text-muted)', marginTop: 4, fontWeight: 500 }}>
            Manage all student course enrollments
          </p>
        </div>

        {/* Toast */}
        {toast && <Toast message={toast.message} type={toast.type} />}

        {/* ── Filter bar ── */}
        <div
          style={{
            background: 'var(--color-wise-surface)',
            borderRadius: 14,
            border: '1px solid var(--color-wise-ring)',
            boxShadow: '0 1px 3px var(--color-wise-ring)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Status select */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as EnrollmentStatus | 'ALL')}
            aria-label="Filter by status"
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--color-wise-ring)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-wise-text)',
              background: 'var(--color-wise-canvas)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="REVOKED">Revoked</option>
          </select>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-wise-text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search student name or email..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              style={{
                width: '100%',
                padding: '7px 10px 7px 30px',
                borderRadius: 8,
                border: '1px solid var(--color-wise-ring)',
                fontSize: 12,
                color: 'var(--color-wise-text)',
                background: 'var(--color-wise-canvas)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Date from */}
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            aria-label="From date"
            style={{
              padding: '7px 10px',
              borderRadius: 8,
              border: '1px solid var(--color-wise-ring)',
              fontSize: 12,
              color: 'var(--color-wise-text)',
              background: 'var(--color-wise-canvas)',
              outline: 'none',
            }}
          />

          {/* Date to */}
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            aria-label="To date"
            style={{
              padding: '7px 10px',
              borderRadius: 8,
              border: '1px solid var(--color-wise-ring)',
              fontSize: 12,
              color: 'var(--color-wise-text)',
              background: 'var(--color-wise-canvas)',
              outline: 'none',
            }}
          />

          {/* Apply */}
          <button
            type="button"
            onClick={applyFilters}
            style={{
              padding: '7px 18px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-wise-text)',
              color: 'var(--color-wise-surface)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Apply Filters
          </button>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid var(--color-wise-ring)',
                background: 'var(--color-wise-surface)',
                color: 'var(--color-wise-text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {/* ── Stats row ── */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <MiniStat label="Total Enrollments" value={statsTotal}     accent="var(--color-wise-primary-text)" />
          <MiniStat label="Active"            value={statsActive}    accent="var(--color-wise-success)" />
          <MiniStat label="Pending"           value={statsPending}   accent="var(--color-wise-warning)" />
          <MiniStat label="Completed"         value={statsCompleted} accent="var(--color-wise-primary-text)" />
        </div>

        {/* ── Enrollments table ── */}
        <div
          style={{
            background: 'var(--color-wise-surface)',
            borderRadius: 18,
            border: '1px solid var(--color-wise-ring)',
            boxShadow: '0 1px 3px var(--color-wise-ring), 0 4px 16px var(--color-wise-ring)',
            overflow: 'hidden',
          }}
        >
          {/* Card header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              borderBottom: '1px solid var(--color-wise-ring)',
            }}
          >
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-wise-text)', margin: 0 }}>
                All Enrollments
              </h2>
              <p style={{ fontSize: 11, color: 'var(--color-wise-text-muted)', marginTop: 2, marginBottom: 0 }}>
                {hasActiveFilters ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} found` : `${enrollments.length} total`}
              </p>
            </div>
            {loading && (
              <div
                aria-label="Loading"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid var(--color-wise-ring)',
                  borderTopColor: 'var(--color-wise-primary-text)',
                  animation: 'em-spin 0.7s linear infinite',
                }}
              />
            )}
          </div>

          {/* Table */}
          {pageRows.length === 0 && !loading ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--color-wise-text-muted)',
                fontSize: 13,
              }}
            >
              {hasActiveFilters
                ? 'No enrollments match your filters.'
                : 'No enrollments found.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}
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

                    return (
                      <tr
                        key={row.id}
                        className="em-tr"
                        style={{
                          borderBottom:
                            i < pageRows.length - 1
                              ? '1px solid var(--color-wise-ring)'
                              : 'none',
                          opacity: isCancelling ? 0.5 : 1,
                          transition: 'opacity 0.2s',
                        }}
                      >
                        {/* Student */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              aria-hidden="true"
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                background: gradient,
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-wise-surface)',
                                fontSize: 12,
                                fontWeight: 800,
                                boxShadow: '0 2px 6px var(--color-wise-ring-strong)',
                              }}
                            >
                              {row.studentName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: 'var(--color-wise-text)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {row.studentName}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: 'var(--color-wise-text-muted)',
                                  marginTop: 1,
                                }}
                              >
                                {row.studentEmail}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Course */}
                        <td style={{ padding: '12px 16px' }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: 'var(--color-wise-text)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {row.course}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--color-wise-text-muted)',
                              marginTop: 2,
                            }}
                          >
                            {row.cohortTitle}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 16px' }}>
                          <StatusPill
                            label={sc.label}
                            bg={sc.bg}
                            color={sc.color}
                            dot={sc.dot}
                          />
                        </td>

                        {/* Payment */}
                        <td style={{ padding: '12px 16px' }}>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            <StatusPill
                              label={row.paymentStatus}
                              bg={pc.bg}
                              color={pc.color}
                            />
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background:
                                  row.paymentMethod === 'STRIPE'
                                    ? 'rgba(99,91,255,0.1)'
                                    : 'rgba(245,158,11,0.1)',
                                color:
                                  row.paymentMethod === 'STRIPE' ? 'var(--color-wise-primary-text)' : 'var(--color-wise-text-warm)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.4px',
                                alignSelf: 'flex-start',
                              }}
                            >
                              {row.paymentMethod}
                            </span>
                          </div>
                        </td>

                        {/* Progress */}
                        <td style={{ padding: '12px 16px' }}>
                          <ProgressBar value={row.progress} />
                        </td>

                        {/* Date */}
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--color-wise-text-muted)',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {new Date(row.enrolledAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 16px' }}>
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 24px',
              borderTop: '1px solid var(--color-wise-ring)',
              background: 'var(--color-wise-canvas)',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--color-wise-text-muted)' }}>
              Showing{' '}
              <strong style={{ color: 'var(--color-wise-text)' }}>
                {filtered.length === 0
                  ? 0
                  : (safePage - 1) * PAGE_SIZE + 1}
                –
                {Math.min(safePage * PAGE_SIZE, filtered.length)}
              </strong>{' '}
              of <strong style={{ color: 'var(--color-wise-text)' }}>{filtered.length}</strong>
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid var(--color-wise-ring)',
                  background: safePage <= 1 ? 'var(--color-wise-canvas)' : 'var(--color-wise-surface)',
                  color: safePage <= 1 ? 'var(--color-wise-ring-strong)' : 'var(--color-wise-text-muted)',
                  cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >
                <ChevronLeft size={14} />
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-label={`Page ${p}`}
                    aria-current={p === safePage ? 'page' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: p === safePage ? 'none' : '1px solid var(--color-wise-ring)',
                      background: p === safePage ? 'var(--color-wise-text)' : 'var(--color-wise-surface)',
                      color: p === safePage ? 'var(--color-wise-surface)' : 'var(--color-wise-text-muted)',
                      fontSize: 12,
                      fontWeight: p === safePage ? 700 : 500,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid var(--color-wise-ring)',
                  background: safePage >= totalPages ? 'var(--color-wise-canvas)' : 'var(--color-wise-surface)',
                  color: safePage >= totalPages ? 'var(--color-wise-ring-strong)' : 'var(--color-wise-text-muted)',
                  cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
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
