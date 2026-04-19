// FIR-209 — Admin can view full student profile
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
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background: 'linear-gradient(90deg,var(--color-wise-ring) 25%,var(--color-wise-canvas) 50%,var(--color-wise-ring) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
        flexShrink: 0,
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

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------

function ProgressBar({ value }: { value: number }) {
  const color =
    value === 100
      ? 'linear-gradient(90deg,var(--color-wise-success),var(--color-wise-success))'
      : value === 0
      ? 'var(--color-wise-ring)'
      : 'linear-gradient(90deg,var(--color-wise-primary-text),var(--color-wise-primary-text))'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 80,
          height: 5,
          background: 'var(--color-wise-canvas)',
          borderRadius: 99,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 99,
            width: `${value}%`,
            background: color,
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-wise-text-muted)', flexShrink: 0 }}>
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
  return (
    <div
      style={{
        background: 'var(--color-wise-surface)',
        borderRadius: 14,
        padding: '18px 20px',
        border: '1px solid var(--color-wise-ring)',
        boxShadow: '0 1px 3px var(--color-wise-ring), 0 4px 16px var(--color-wise-ring)',
        flex: 1,
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: 'var(--color-wise-text)',
          letterSpacing: '-0.5px',
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-wise-text-muted)', fontWeight: 500 }}>{label}</div>
      <div
        style={{
          marginTop: 10,
          height: 3,
          width: 32,
          background: accent,
          borderRadius: 99,
        }}
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
// Card wrapper
// ---------------------------------------------------------------------------

function Card({
  children,
  style: extraStyle,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: 'var(--color-wise-surface)',
        borderRadius: 18,
        border: '1px solid var(--color-wise-ring)',
        boxShadow: '0 1px 3px var(--color-wise-ring), 0 4px 16px var(--color-wise-ring)',
        overflow: 'hidden',
        ...extraStyle,
      }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table head
// ---------------------------------------------------------------------------

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      style={{
        textAlign: 'left',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--color-wise-text-muted)',
        padding: '10px 20px',
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: 16,
            padding: 32,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: 'var(--color-wise-ring)',
              letterSpacing: '-3px',
              lineHeight: 1,
            }}
          >
            404
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-wise-text)' }}>
            Student not found
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-wise-text-muted)' }}>
            The student you're looking for doesn't exist or was removed.
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/students')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 18px',
              borderRadius: 10,
              background: 'var(--color-wise-text)',
              color: 'var(--color-wise-surface)',
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
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
        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Back button skeleton */}
          <SkeletonBlock w={120} h={32} radius={10} />

          {/* Header card skeleton */}
          <Card>
            <div style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 20 }}>
              <SkeletonBlock w={72} h={72} radius={36} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SkeletonBlock w={200} h={20} />
                <SkeletonBlock w={160} h={14} />
                <SkeletonBlock w={100} h={24} radius={20} />
              </div>
              <SkeletonBlock w={140} h={36} radius={10} />
            </div>
          </Card>

          {/* Stats row skeleton */}
          <div style={{ display: 'flex', gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: 'var(--color-wise-surface)',
                  borderRadius: 14,
                  padding: '18px 20px',
                  border: '1px solid var(--color-wise-ring)',
                }}
              >
                <SkeletonBlock w={60} h={28} radius={6} />
                <div style={{ marginTop: 8 }}>
                  <SkeletonBlock w={100} h={12} />
                </div>
              </div>
            ))}
          </div>

          {/* Table skeleton */}
          <Card>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-wise-ring)' }}>
              <SkeletonBlock w={160} h={18} />
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
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

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Back button */}
        <div>
          <Link
            to="/admin/students"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-wise-text-muted)',
              textDecoration: 'none',
              padding: '7px 12px',
              borderRadius: 8,
              background: 'var(--color-wise-surface)',
              border: '1px solid var(--color-wise-ring)',
              boxShadow: '0 1px 2px var(--color-wise-ring)',
            }}
          >
            <ArrowLeft size={14} /> Back to Students
          </Link>
        </div>

        {/* Toast */}
        {toast && <Toast message={toast.message} type={toast.type} />}

        {/* ── Header profile card ── */}
        <Card>
          <div
            style={{
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            {/* Avatar */}
            <div
              aria-hidden="true"
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: getAvatarGradient(student.name),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 900,
                color: 'var(--color-wise-surface)',
                flexShrink: 0,
                boxShadow: '0 4px 16px rgba(26,39,68,0.18)',
              }}
            >
              {student.name.charAt(0).toUpperCase()}
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: 'var(--color-wise-text)',
                  margin: 0,
                  letterSpacing: '-0.4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {student.name}
              </h1>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-wise-text-muted)',
                  marginTop: 3,
                  fontWeight: 500,
                }}
              >
                {student.email}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 10,
                  flexWrap: 'wrap',
                }}
              >
                {/* Role badge */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 6,
                    background: 'rgba(74,154,212,0.1)',
                    color: 'var(--color-wise-primary-text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                  }}
                >
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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 20px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                cursor: statusLoading ? 'not-allowed' : 'pointer',
                opacity: statusLoading ? 0.7 : 1,
                background: isSuspended ? 'var(--color-wise-success)' : 'var(--color-wise-danger)',
                color: 'var(--color-wise-surface)',
                boxShadow: isSuspended
                  ? '0 2px 8px rgba(5,150,105,0.3)'
                  : '0 2px 8px rgba(239,68,68,0.3)',
                transition: 'opacity 0.15s',
                flexShrink: 0,
              }}
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
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid var(--color-wise-ring)',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--color-wise-text)',
                  margin: 0,
                }}
              >
                Enrollments
              </h2>
              <p style={{ fontSize: 12, color: 'var(--color-wise-text-muted)', marginTop: 2, marginBottom: 0 }}>
                All course enrollments for this student
              </p>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-wise-primary-text)',
                background: 'rgba(74,154,212,0.08)',
                padding: '4px 12px',
                borderRadius: 20,
                border: '1px solid rgba(74,154,212,0.15)',
              }}
            >
              {student.enrollments.length} total
            </span>
          </div>

          {student.enrollments.length === 0 ? (
            <div
              style={{
                padding: '40px 24px',
                textAlign: 'center',
                color: 'var(--color-wise-text-muted)',
                fontSize: 13,
              }}
            >
              No enrollments found for this student.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{ width: '100%', borderCollapse: 'collapse' }}
                aria-label="Student enrollments"
              >
                <thead>
                  <tr>
                    <Th>Course</Th>
                    <Th>Status</Th>
                    <Th>Payment</Th>
                    <Th>Progress</Th>
                    <Th>Enrolled</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {student.enrollments.map((enr, i) => {
                    const sc = ENROLLMENT_STATUS_CFG[enr.status]
                    const pc = ENROLLMENT_PAYMENT_CFG[enr.paymentStatus]
                    return (
                      <tr
                        key={enr.id}
                        className="sd-tr"
                        style={{
                          borderBottom:
                            i < student.enrollments.length - 1
                              ? '1px solid var(--color-wise-ring)'
                              : 'none',
                        }}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: 'var(--color-wise-text)',
                            }}
                          >
                            {enr.courseTitle}
                          </div>
                          {enr.cohortTitle && (
                            <div style={{ fontSize: 11, color: 'var(--color-wise-text-muted)', marginTop: 2 }}>
                              {enr.cohortTitle}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <StatusPill
                            label={sc.label}
                            bg={sc.bg}
                            color={sc.color}
                            dot={sc.dot}
                          />
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <StatusPill
                            label={enr.paymentStatus}
                            bg={pc.bg}
                            color={pc.color}
                          />
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <ProgressBar value={enr.progress} />
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: 11, color: 'var(--color-wise-text-muted)', fontWeight: 500 }}>
                            {new Date(enr.enrolledAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <Link
                            to={`/admin/courses`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--color-wise-primary-text)',
                              textDecoration: 'none',
                              padding: '5px 10px',
                              borderRadius: 7,
                              background: 'rgba(74,154,212,0.08)',
                              border: '1px solid rgba(74,154,212,0.15)',
                              whiteSpace: 'nowrap',
                            }}
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
        <Card style={{ marginBottom: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid var(--color-wise-ring)',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--color-wise-text)',
                  margin: 0,
                }}
              >
                Payment History
              </h2>
              <p style={{ fontSize: 12, color: 'var(--color-wise-text-muted)', marginTop: 2, marginBottom: 0 }}>
                All payment transactions for this student
              </p>
            </div>
          </div>

          {student.payments.length === 0 ? (
            <div
              style={{
                padding: '40px 24px',
                textAlign: 'center',
                color: 'var(--color-wise-text-muted)',
                fontSize: 13,
              }}
            >
              No payment records found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{ width: '100%', borderCollapse: 'collapse' }}
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
                    return (
                      <tr
                        key={pmt.id}
                        className="sd-tr"
                        style={{
                          borderBottom:
                            i < student.payments.length - 1
                              ? '1px solid var(--color-wise-ring)'
                              : 'none',
                        }}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: 12, color: 'var(--color-wise-text-muted)', fontWeight: 500 }}>
                            {new Date(pmt.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '3px 9px',
                              borderRadius: 6,
                              background: isStripe
                                ? 'rgba(99,91,255,0.1)'
                                : 'rgba(245,158,11,0.1)',
                              color: isStripe ? 'var(--color-wise-primary-text)' : 'var(--color-wise-text-warm)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {pmt.type}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: 'var(--color-wise-text)',
                            }}
                          >
                            ${pmt.amount.toLocaleString()}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <StatusPill
                            label={pmt.status}
                            bg={sc.bg}
                            color={sc.color}
                          />
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--color-wise-text)',
                            }}
                          >
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
