// FIR-209 — Admin can view full student profile
//
// Sprint 4 Story 22: inline-style → Tailwind conversion.
// Tokens from Sprint 3 Story 16 are preserved; we only rewrite the
// `style={{...}}` wrappers as Tailwind classes. Dynamic values that cannot
// be expressed as static classes (gradient avatar, progress width, status
// pill tints keyed off per-record state) remain inline.
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import { authFetch } from '../../lib/api'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Enrollment {
  id: string
  courseTitle: string
  cohortTitle: string
  status: 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'REVOKED'
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED' | 'FREE'
  progress: number
  enrolledAt: string
  courseId: string
}

interface PaymentRecord {
  id: string
  date: string
  type: 'STRIPE' | 'MANUAL'
  amount: number
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  courseTitle: string
}

interface StudentDetail {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'suspended'
  createdAt: string
  totalEnrollments: number
  completedCourses: number
  totalPaid: number
  enrollments: Enrollment[]
  payments: PaymentRecord[]
}

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

function getAvatarGradient(name: string): string {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length]
}

const ENROLLMENT_STATUS_CFG: Record<
  Enrollment['status'],
  { bg: string; color: string; dot: string; label: string }
> = {
  ACTIVE:    { bg: 'rgba(5,150,105,0.1)',   color: 'var(--color-wise-success)', dot: 'var(--color-wise-success)', label: 'Active'    },
  PENDING:   { bg: 'rgba(245,158,11,0.1)',  color: 'var(--color-wise-text-warm)', dot: 'var(--color-wise-warning)', label: 'Pending'   },
  COMPLETED: { bg: 'rgba(59,130,246,0.1)',  color: 'var(--color-wise-primary-text)', dot: 'var(--color-wise-primary-text)', label: 'Completed' },
  REVOKED:   { bg: 'rgba(239,68,68,0.1)',   color: 'var(--color-wise-danger)', dot: 'var(--color-wise-danger)', label: 'Revoked'   },
}

const PAYMENT_STATUS_CFG: Record<
  PaymentRecord['status'],
  { bg: string; color: string }
> = {
  SUCCESS: { bg: 'rgba(5,150,105,0.1)',  color: 'var(--color-wise-success)' },
  PENDING: { bg: 'rgba(245,158,11,0.1)', color: 'var(--color-wise-text-warm)' },
  FAILED:  { bg: 'rgba(239,68,68,0.1)',  color: 'var(--color-wise-danger)' },
}

const ENROLLMENT_PAYMENT_CFG: Record<
  Enrollment['paymentStatus'],
  { bg: string; color: string }
> = {
  PAID:    { bg: 'rgba(5,150,105,0.1)',  color: 'var(--color-wise-success)' },
  PENDING: { bg: 'rgba(245,158,11,0.1)', color: 'var(--color-wise-text-warm)' },
  FAILED:  { bg: 'rgba(239,68,68,0.1)',  color: 'var(--color-wise-danger)' },
  FREE:    { bg: 'rgba(100,116,139,0.1)', color: 'var(--color-wise-text-muted)' },
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonBlock({
  w = '100%',
  h = 16,
  radius = 8,
}: {
  w?: string | number
  h?: number
  radius?: number
}) {
  // Width / height / radius are all caller-configured — stay inline.
  return (
    <div
      className="shrink-0 bg-[linear-gradient(90deg,var(--color-wise-ring)_25%,var(--color-wise-canvas)_50%,var(--color-wise-ring)_75%)] bg-[size:200%_100%]"
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        animation: 'shimmer 1.4s infinite',
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// StatusPill
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

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------

function ProgressBar({ value }: { value: number }) {
  // Width + fill background depend on the value — both stay inline.
  const color =
    value === 100
      ? 'linear-gradient(90deg,var(--color-wise-success),var(--color-wise-success))'
      : value === 0
      ? 'var(--color-wise-ring)'
      : 'linear-gradient(90deg,var(--color-wise-primary-text),var(--color-wise-primary-text))'

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-[5px] bg-[var(--color-wise-canvas)] rounded-[99px] overflow-hidden shrink-0">
        <div
          className="h-full rounded-[99px]"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-[11px] font-bold text-[var(--color-wise-text-muted)] shrink-0">
        {value}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent: string
}) {
  // The accent bar's color is a per-card prop, so it stays inline. Card
  // shell + typography are fully class-driven.
  return (
    <div className="flex-1 bg-[var(--color-wise-surface)] rounded-[14px] px-5 py-[18px] border border-[var(--color-wise-ring)] shadow-[0_1px_3px_var(--color-wise-ring),0_4px_16px_var(--color-wise-ring)]">
      <div className="text-[26px] font-black text-[var(--color-wise-text)] tracking-[-0.5px] mb-1">
        {value}
      </div>
      <div className="text-[12px] text-[var(--color-wise-text-muted)] font-medium">
        {label}
      </div>
      <div
        className="mt-[10px] h-[3px] w-8 rounded-[99px]"
        style={{ background: accent }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function Toast({
  message,
  type,
}: {
  message: string
  type: 'success' | 'error'
}) {
  const isSuccess = type === 'success'
  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'inline-flex items-center gap-2 px-4 py-[10px] rounded-[10px]',
        'text-[13px] font-semibold border',
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
// Card wrapper
// ---------------------------------------------------------------------------

function Card({
  children,
  className: extraClassName,
}: {
  children: React.ReactNode
  className?: string
}) {
  // Extra className slot — callers compose (e.g. bottom-margin for the final
  // card in the stack).
  return (
    <div
      className={[
        'bg-[var(--color-wise-surface)] rounded-[18px] border border-[var(--color-wise-ring)]',
        'shadow-[0_1px_3px_var(--color-wise-ring),0_4px_16px_var(--color-wise-ring)] overflow-hidden',
        extraClassName ?? '',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table head
// ---------------------------------------------------------------------------

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="text-left text-[10px] font-bold text-[var(--color-wise-text-muted)] px-5 py-[10px] uppercase tracking-[0.8px] border-b border-[var(--color-wise-ring)] whitespace-nowrap bg-[var(--color-wise-canvas)]"
    >
      {children}
    </th>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Fetch student detail
  const fetchStudent = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await authFetch(`/api/v1/admin/students/${id}`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setStudent(data)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchStudent()
  }, [fetchStudent])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Toggle account status — opens ConfirmDialog instead of window.confirm()
  function handleStatusToggle() {
    if (!student) return
    setConfirmOpen(true)
  }

  async function handleStatusToggleConfirmed() {
    if (!student) return
    const nextStatus = student.status === 'active' ? 'suspended' : 'active'

    setStatusLoading(true)
    try {
      const res = await authFetch(`/api/v1/admin/students/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setStudent((prev) => prev ? { ...prev, status: nextStatus } : prev)
      setToast({
        message: `Account ${nextStatus === 'suspended' ? 'suspended' : 'activated'} successfully.`,
        type: 'success',
      })
    } catch {
      setToast({ message: 'Failed to update account status. Please try again.', type: 'error' })
    } finally {
      setStatusLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render: Not Found
  // ---------------------------------------------------------------------------
  if (!loading && notFound) {
    return (
      <AdminShell title="Student Not Found">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <div className="text-[64px] font-black text-[var(--color-wise-ring)] tracking-[-3px] leading-none">
            404
          </div>
          <div className="text-[16px] font-bold text-[var(--color-wise-text)]">
            Student not found
          </div>
          <div className="text-[13px] text-[var(--color-wise-text-muted)]">
            The student you're looking for doesn't exist or was removed.
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/students')}
            className="inline-flex items-center gap-[6px] px-[18px] py-[9px] rounded-[10px] bg-[var(--color-wise-text)] text-[var(--color-wise-surface)] text-[13px] font-bold border-none cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Students
          </button>
        </div>
      </AdminShell>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Loading skeleton
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <AdminShell title="Student Profile">
        <style>{`
          @keyframes shimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <div className="px-8 py-7 flex flex-col gap-5">
          {/* Back button skeleton */}
          <SkeletonBlock w={120} h={32} radius={10} />

          {/* Header card skeleton */}
          <Card>
            <div className="px-7 py-6 flex items-center gap-5">
              <SkeletonBlock w={72} h={72} radius={36} />
              <div className="flex-1 flex flex-col gap-[10px]">
                <SkeletonBlock w={200} h={20} />
                <SkeletonBlock w={160} h={14} />
                <SkeletonBlock w={100} h={24} radius={20} />
              </div>
              <SkeletonBlock w={140} h={36} radius={10} />
            </div>
          </Card>

          {/* Stats row skeleton */}
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-1 bg-[var(--color-wise-surface)] rounded-[14px] px-5 py-[18px] border border-[var(--color-wise-ring)]"
              >
                <SkeletonBlock w={60} h={28} radius={6} />
                <div className="mt-2">
                  <SkeletonBlock w={100} h={12} />
                </div>
              </div>
            ))}
          </div>

          {/* Table skeleton */}
          <Card>
            <div className="px-6 py-[18px] border-b border-[var(--color-wise-ring)]">
              <SkeletonBlock w={160} h={18} />
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <SkeletonBlock key={i} w="100%" h={40} radius={8} />
              ))}
            </div>
          </Card>
        </div>
      </AdminShell>
    )
  }

  if (!student) return null

  const isSuspended = student.status === 'suspended'

  // ---------------------------------------------------------------------------
  // Render: Loaded
  // ---------------------------------------------------------------------------
  return (
    <AdminShell title={student.name}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .sd-tr:hover td { background: var(--color-wise-canvas) !important; }
      `}</style>

      <div className="px-8 py-7 flex flex-col gap-5">
        {/* Back button */}
        <div>
          <Link
            to="/admin/students"
            className="inline-flex items-center gap-[6px] text-[13px] font-semibold text-[var(--color-wise-text-muted)] no-underline px-3 py-[7px] rounded-lg bg-[var(--color-wise-surface)] border border-[var(--color-wise-ring)] shadow-[0_1px_2px_var(--color-wise-ring)]"
          >
            <ArrowLeft size={14} /> Back to Students
          </Link>
        </div>

        {/* Toast */}
        {toast && <Toast message={toast.message} type={toast.type} />}

        {/* ── Header profile card ── */}
        <Card>
          <div className="px-7 py-6 flex items-center gap-5 flex-wrap">
            {/* Avatar */}
            <div
              aria-hidden="true"
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-[28px] font-black text-[var(--color-wise-surface)] shrink-0 shadow-[0_4px_16px_rgba(26,39,68,0.18)]"
              style={{ background: getAvatarGradient(student.name) }}
            >
              {student.name.charAt(0).toUpperCase()}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <h1 className="text-[22px] font-black text-[var(--color-wise-text)] m-0 tracking-[-0.4px] whitespace-nowrap overflow-hidden text-ellipsis">
                {student.name}
              </h1>
              <div className="text-[13px] text-[var(--color-wise-text-muted)] mt-[3px] font-medium">
                {student.email}
              </div>
              <div className="flex items-center gap-2 mt-[10px] flex-wrap">
                {/* Role badge */}
                <span className="text-[10px] font-bold px-[9px] py-[3px] rounded-md bg-[rgba(74,154,212,0.1)] text-[var(--color-wise-primary-text)] uppercase tracking-[0.6px]">
                  {student.role.replace('_', ' ')}
                </span>

                {/* Status badge */}
                <StatusPill
                  label={isSuspended ? 'Suspended' : 'Active'}
                  bg={isSuspended ? 'rgba(239,68,68,0.1)' : 'rgba(5,150,105,0.1)'}
                  color={isSuspended ? 'var(--color-wise-danger)' : 'var(--color-wise-success)'}
                  dot={isSuspended ? 'var(--color-wise-danger)' : 'var(--color-wise-success)'}
                />
              </div>
            </div>

            {/* Action button */}
            <button
              type="button"
              onClick={handleStatusToggle}
              disabled={statusLoading}
              className={[
                'inline-flex items-center gap-[6px] px-5 py-[9px] rounded-[10px] text-[13px] font-bold',
                'border-none text-[var(--color-wise-surface)] transition-opacity duration-150 shrink-0',
                statusLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100',
                isSuspended
                  ? 'bg-[var(--color-wise-success)] shadow-[0_2px_8px_rgba(5,150,105,0.3)]'
                  : 'bg-[var(--color-wise-danger)] shadow-[0_2px_8px_rgba(239,68,68,0.3)]',
              ].join(' ')}
            >
              {statusLoading
                ? 'Updating...'
                : isSuspended
                ? 'Activate Account'
                : 'Suspend Account'}
            </button>
          </div>
        </Card>

        {/* ── Stats row ── */}
        <div className="flex gap-4 flex-wrap">
          <StatCard
            label="Total Enrollments"
            value={student.totalEnrollments}
            accent="var(--color-wise-primary-text)"
          />
          <StatCard
            label="Completed Courses"
            value={student.completedCourses}
            accent="var(--color-wise-success)"
          />
          <StatCard
            label="Total Paid"
            value={`$${student.totalPaid.toLocaleString()}`}
            accent="var(--color-wise-primary-text)"
          />
        </div>

        {/* ── Enrollments table ── */}
        <Card>
          <div className="flex items-center justify-between px-6 py-[18px] border-b border-[var(--color-wise-ring)]">
            <div>
              <h2 className="text-[15px] font-extrabold text-[var(--color-wise-text)] m-0">
                Enrollments
              </h2>
              <p className="text-[12px] text-[var(--color-wise-text-muted)] mt-[2px] mb-0">
                All course enrollments for this student
              </p>
            </div>
            <span className="text-[12px] font-bold text-[var(--color-wise-primary-text)] bg-[rgba(74,154,212,0.08)] px-3 py-1 rounded-[20px] border border-[rgba(74,154,212,0.15)]">
              {student.enrollments.length} total
            </span>
          </div>

          {student.enrollments.length === 0 ? (
            <div className="px-6 py-10 text-center text-[var(--color-wise-text-muted)] text-[13px]">
              No enrollments found for this student.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse"
                aria-label="Student enrollments"
              >
                <thead>
                  <tr>
                    <Th>Course</Th>
                    <Th>Status</Th>
                    <Th>Payment</Th>
                    <Th>Progress</Th>
                    <Th>Enrolled</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {student.enrollments.map((enr, i) => {
                    const sc = ENROLLMENT_STATUS_CFG[enr.status]
                    const pc = ENROLLMENT_PAYMENT_CFG[enr.paymentStatus]
                    const isLast = i >= student.enrollments.length - 1
                    return (
                      <tr
                        key={enr.id}
                        className={[
                          'sd-tr',
                          isLast ? '' : 'border-b border-[var(--color-wise-ring)]',
                        ].join(' ')}
                      >
                        <td className="px-5 py-[14px]">
                          <div className="text-[13px] font-bold text-[var(--color-wise-text)]">
                            {enr.courseTitle}
                          </div>
                          {enr.cohortTitle && (
                            <div className="text-[11px] text-[var(--color-wise-text-muted)] mt-[2px]">
                              {enr.cohortTitle}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-[14px]">
                          <StatusPill
                            label={sc.label}
                            bg={sc.bg}
                            color={sc.color}
                            dot={sc.dot}
                          />
                        </td>
                        <td className="px-5 py-[14px]">
                          <StatusPill
                            label={enr.paymentStatus}
                            bg={pc.bg}
                            color={pc.color}
                          />
                        </td>
                        <td className="px-5 py-[14px]">
                          <ProgressBar value={enr.progress} />
                        </td>
                        <td className="px-5 py-[14px]">
                          <span className="text-[11px] text-[var(--color-wise-text-muted)] font-medium">
                            {new Date(enr.enrolledAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-[14px]">
                          <Link
                            to={`/admin/courses`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-wise-primary-text)] no-underline px-[10px] py-[5px] rounded-[7px] bg-[rgba(74,154,212,0.08)] border border-[rgba(74,154,212,0.15)] whitespace-nowrap"
                          >
                            View <ExternalLink size={10} />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ── Payment History ── */}
        <Card className="mb-2">
          <div className="flex items-center justify-between px-6 py-[18px] border-b border-[var(--color-wise-ring)]">
            <div>
              <h2 className="text-[15px] font-extrabold text-[var(--color-wise-text)] m-0">
                Payment History
              </h2>
              <p className="text-[12px] text-[var(--color-wise-text-muted)] mt-[2px] mb-0">
                All payment transactions for this student
              </p>
            </div>
          </div>

          {student.payments.length === 0 ? (
            <div className="px-6 py-10 text-center text-[var(--color-wise-text-muted)] text-[13px]">
              No payment records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse"
                aria-label="Payment history"
              >
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Course</Th>
                  </tr>
                </thead>
                <tbody>
                  {student.payments.map((pmt, i) => {
                    const sc = PAYMENT_STATUS_CFG[pmt.status]
                    const isStripe = pmt.type === 'STRIPE'
                    const isLast = i >= student.payments.length - 1
                    return (
                      <tr
                        key={pmt.id}
                        className={[
                          'sd-tr',
                          isLast ? '' : 'border-b border-[var(--color-wise-ring)]',
                        ].join(' ')}
                      >
                        <td className="px-5 py-[14px]">
                          <span className="text-[12px] text-[var(--color-wise-text-muted)] font-medium">
                            {new Date(pmt.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>
                        <td className="px-5 py-[14px]">
                          <span
                            className={[
                              'text-[10px] font-extrabold px-[9px] py-[3px] rounded-md',
                              'uppercase tracking-[0.5px]',
                              isStripe
                                ? 'bg-[rgba(99,91,255,0.1)] text-[var(--color-wise-primary-text)]'
                                : 'bg-[rgba(245,158,11,0.1)] text-[var(--color-wise-text-warm)]',
                            ].join(' ')}
                          >
                            {pmt.type}
                          </span>
                        </td>
                        <td className="px-5 py-[14px]">
                          <span className="text-[13px] font-extrabold text-[var(--color-wise-text)]">
                            ${pmt.amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-5 py-[14px]">
                          <StatusPill
                            label={pmt.status}
                            bg={sc.bg}
                            color={sc.color}
                          />
                        </td>
                        <td className="px-5 py-[14px]">
                          <span className="text-[12px] font-semibold text-[var(--color-wise-text)]">
                            {pmt.courseTitle}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Confirm dialog — replaces window.confirm() for status toggle */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          student?.status === 'active'
            ? 'Suspend account?'
            : 'Activate account?'
        }
        description={
          student
            ? `This will ${student.status === 'active' ? 'suspend' : 'activate'} ${student.name}'s account.`
            : 'Please confirm the action.'
        }
        confirmLabel={student?.status === 'active' ? 'Suspend account' : 'Activate account'}
        variant={student?.status === 'active' ? 'danger' : 'warning'}
        isLoading={statusLoading}
        onConfirm={handleStatusToggleConfirmed}
      />
    </AdminShell>
  )
}
