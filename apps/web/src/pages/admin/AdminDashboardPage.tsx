// FIR-165 / FIR-166 / FIR-173 — Admin Dashboard
// Sprint 3 Story 16: migrated from navy/blue palette to Wise theme + lucide icons.
// Sprint X: hardcoded KPI / ENROLLMENTS / ACTIVITY / HEALTH constants were
// deleted and replaced with real TanStack Query wiring. QUICK_ACTIONS stays —
// it is nav config, not data.
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Users, DollarSign, Clock, BookOpen, Camera,
  ArrowUpRight, ArrowRight,
  Activity, ChevronRight, MoreHorizontal, Plus,
  GraduationCap, CreditCard, Mail, BarChart2,
  AlertCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import { usePageMeta } from '../../hooks/usePageMeta'
import {
  fetchAdminDashboardStats,
  fetchAdminEnrollments,
  fetchRevenueAnalytics,
  type AdminEnrollmentRow,
} from '../../lib/api'
import { CardSkeleton, TableRowSkeleton } from '../../components/ui/LoadingSkeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'

// ---------------------------------------------------------------------------
// Nav config — QUICK_ACTIONS is the only non-data constant kept from the
// original hardcoded block. Everything else now flows from the API.
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = [
  { to: '/admin/courses',           icon: BookOpen,   label: 'Courses',     sub: 'Manage content' },
  { to: '/admin/manual-payments',   icon: CreditCard, label: 'Payments',    sub: 'Review receipts' },
  { to: '/admin/screenshot-review', icon: Camera,     label: 'Screenshots', sub: 'Review queue' },
  { to: '/admin/students',          icon: Users,      label: 'Students',    sub: 'All students' },
  { to: '/admin/broadcast-email',   icon: Mail,       label: 'Broadcast',   sub: 'Send email' },
  { to: '/admin/reporting',         icon: BarChart2,  label: 'Analytics',   sub: 'View reports' },
] as const

// Status pill classes keyed on the normalised enrollment status the API
// returns (ACTIVE, PENDING, COMPLETED, REVOKED, SUSPENDED). Kept here because
// it mirrors the StatusPill pattern used by EnrollmentManagementPage — UI
// option list, not data.
const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  ACTIVE:    { cls: 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',                   label: 'Active'    },
  PENDING:   { cls: 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)]',              label: 'Pending'   },
  SUSPENDED: { cls: 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)]',              label: 'Suspended' },
  COMPLETED: { cls: 'bg-[var(--color-wise-success)]/10 text-[var(--color-wise-success)]',                  label: 'Completed' },
  REVOKED:   { cls: 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',                  label: 'Revoked'   },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?:  string
  icon:  LucideIcon
  urgent?: boolean
}

function KpiCard({ label, value, sub, icon: Icon, urgent }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden bg-[var(--color-wise-surface)] rounded-[30px] px-6 py-5 ring-1 ring-[var(--color-wise-ring)] shadow-[0_1px_3px_rgba(14,15,12,0.04),0_4px_16px_rgba(14,15,12,0.03)] transition-transform duration-150 hover:-translate-y-0.5">
      {urgent && (
        <div className="absolute top-3.5 right-3.5 bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-[0.4px] border border-[var(--color-wise-danger)]/15">
          Action needed
        </div>
      )}

      <div className="w-[42px] h-[42px] rounded-[13px] bg-[var(--color-wise-mint)] flex items-center justify-center mb-4 text-[var(--color-wise-primary-text)]">
        <Icon size={19} strokeWidth={2} aria-hidden="true" />
      </div>

      <div className="text-[32px] font-black text-[var(--color-wise-text)] tracking-[-1.5px] leading-none mb-1">
        {value}
      </div>
      <div className="text-[12px] text-[var(--color-wise-text-muted)] font-medium mb-3.5">{label}</div>

      {sub && (
        <div className="flex items-center gap-1">
          <ArrowUpRight size={12} className="text-[var(--color-wise-success)]" strokeWidth={2.5} aria-hidden="true" />
          <span className="text-[11px] text-[var(--color-wise-text-muted)]">{sub}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline error alert with retry — Sprint 1 Story 5 pattern
// ---------------------------------------------------------------------------

function ErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] rounded-[14px] px-4 py-3 text-[13px] font-semibold"
    >
      <div className="flex items-center gap-2">
        <AlertCircle size={16} aria-hidden="true" />
        <span>{message}</span>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  usePageMeta({ title: 'Admin dashboard' })
  const now   = new Date()
  const hour  = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr  = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // ── KPI stats ───────────────────────────────────────────────────────────
  const statsQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'kpis'],
    queryFn:  fetchAdminDashboardStats,
  })

  // Revenue pulls from the analytics endpoint — the /stats endpoint doesn't
  // expose currency totals, so we compose from two sources.
  const revenueQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'revenue'],
    queryFn:  () => fetchRevenueAnalytics(),
  })

  // ── Recent enrollments (first page, 5 rows) ─────────────────────────────
  const enrollmentsQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'recent-enrollments'],
    queryFn:  () => fetchAdminEnrollments({ limit: 5, page: 1 }),
  })

  const kpis = [
    {
      label:  'Total Revenue',
      value:  revenueQuery.data ? formatCurrency(revenueQuery.data.totalRevenue) : '—',
      sub:    revenueQuery.data && revenueQuery.data.mrr ? `${formatCurrency(revenueQuery.data.mrr)} MRR` : 'last 30 days',
      icon:   DollarSign,
    },
    {
      label:  'Active Students',
      value:  statsQuery.data ? String(statsQuery.data.activeStudents) : '—',
      sub:    'across all cohorts',
      icon:   Users,
    },
    {
      label:  'Active Cohorts',
      value:  statsQuery.data ? String(statsQuery.data.activeCohorts) : '—',
      sub:    'including drafts',
      icon:   BookOpen,
    },
    {
      label:  'Pending Reviews',
      value:  statsQuery.data ? String(statsQuery.data.pendingReviews) : '—',
      sub:    'submissions to review',
      icon:   Clock,
      urgent: (statsQuery.data?.pendingReviews ?? 0) > 0,
    },
    {
      label:  'Completion Rate',
      value:  statsQuery.data ? `${statsQuery.data.completionRate}%` : '—',
      sub:    'of active students',
      icon:   GraduationCap,
    },
  ]

  const enrollments: AdminEnrollmentRow[] = enrollmentsQuery.data?.enrollments ?? []

  return (
    <AdminShell title="Dashboard">
      <div className="px-8 py-7 min-h-full bg-[var(--color-wise-canvas)]">
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-7 flex-wrap gap-3">
          <div>
            <h1 className="text-[24px] font-black text-[var(--color-wise-text)] m-0 tracking-[-0.5px]">
              {greeting}
            </h1>
            <p className="text-[13px] text-[var(--color-wise-text-muted)] mt-1 font-medium">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[var(--color-wise-surface)] ring-1 ring-[var(--color-wise-ring)] rounded-[10px] px-3.5 py-2">
              <Activity size={14} className="text-[var(--color-wise-primary-text)]" aria-hidden="true" />
              <span className="text-[12px] font-semibold text-[var(--color-wise-text)]">Live</span>
              <span className="w-[7px] h-[7px] rounded-full bg-[var(--color-wise-primary)] ring-[3px] ring-[var(--color-wise-primary)]/25 inline-block" aria-hidden="true" />
            </div>
            <Link
              to="/admin/courses"
              className="inline-flex items-center gap-1.5 bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] text-[13px] font-bold no-underline px-4 py-2.5 rounded-[10px] hover:bg-[var(--color-wise-primary-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2"
            >
              <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
              New Course
            </Link>
          </div>
        </div>

        {/* ── KPI Row ── */}
        {statsQuery.isError && (
          <div className="mb-4">
            <ErrorAlert
              message="Couldn't load dashboard stats."
              onRetry={() => { void statsQuery.refetch() }}
            />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          {statsQuery.isLoading || revenueQuery.isLoading
            ? Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
            : kpis.map((k) => (
              <KpiCard
                key={k.label}
                label={k.label}
                value={k.value}
                sub={k.sub}
                icon={k.icon}
                urgent={k.urgent}
              />
            ))
          }
        </div>

        {/* ── Main layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_344px] gap-5">
          {/* ── Enrollments table ── */}
          <div className="bg-[var(--color-wise-surface)] rounded-[30px] ring-1 ring-[var(--color-wise-ring)] shadow-[0_1px_3px_rgba(14,15,12,0.04)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-wise-ring)]">
              <div>
                <h2 className="text-[15px] font-extrabold text-[var(--color-wise-text)] m-0">Recent Enrollments</h2>
                <p className="text-[12px] text-[var(--color-wise-text-muted)] mt-0.5">Latest activity across all courses</p>
              </div>
              <Link
                to="/admin/students"
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--color-wise-primary-text)] no-underline px-3 py-1.5 rounded-lg bg-[var(--color-wise-mint)] hover:bg-[var(--color-wise-primary-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2"
              >
                View all <ArrowRight size={12} strokeWidth={2.5} />
              </Link>
            </div>

            {enrollmentsQuery.isError ? (
              <div className="p-5">
                <ErrorAlert
                  message="Couldn't load recent enrollments."
                  onRetry={() => { void enrollmentsQuery.refetch() }}
                />
              </div>
            ) : enrollmentsQuery.isLoading ? (
              <div className="px-6 py-5 space-y-3" aria-label="Loading enrollments">
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={5} />
                ))}
              </div>
            ) : enrollments.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="No enrollments yet"
                description="Your first students will appear here once they register for a cohort."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" aria-label="Recent enrollments">
                  <thead>
                    <tr className="bg-[var(--color-wise-surface-soft)]">
                      {['Student', 'Course', 'Status', 'Progress', 'Date', ''].map((col) => (
                        <th
                          key={col}
                          scope="col"
                          className="text-left text-[12px] font-bold text-[var(--color-wise-text-warm)] px-5 py-2.5 uppercase tracking-[0.6px] border-b border-[var(--color-wise-ring)] whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((row, i) => {
                      const st = STATUS_CFG[row.status] ?? STATUS_CFG['ACTIVE']!
                      const initial = (row.studentName.charAt(0) || '?').toUpperCase()
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer hover:bg-[var(--color-wise-surface-soft)]/60 ${i < enrollments.length - 1 ? 'border-b border-[var(--color-wise-ring)]' : ''}`}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] text-[13px] font-extrabold"
                                aria-hidden="true"
                              >
                                {initial}
                              </div>
                              <div>
                                <div className="text-[13px] font-bold text-[var(--color-wise-text)] whitespace-nowrap">{row.studentName}</div>
                                <div className="text-[11px] text-[var(--color-wise-text-muted)] mt-px">{row.studentEmail}</div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-3">
                            <span className="text-[12px] font-semibold text-[var(--color-wise-text)]">{row.course}</span>
                          </td>

                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>

                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-[88px] h-[5px] bg-[var(--color-wise-surface-soft)] rounded-full overflow-hidden flex-shrink-0">
                                <div
                                  className="h-full rounded-full bg-[var(--color-wise-primary)]"
                                  style={{ width: `${row.progress}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-[var(--color-wise-text-warm)] flex-shrink-0">{row.progress}%</span>
                            </div>
                          </td>

                          <td className="px-5 py-3">
                            <span className="text-[11px] text-[var(--color-wise-text-muted)] font-medium">{formatShortDate(row.enrolledAt)}</span>
                          </td>

                          <td className="px-4 py-3">
                            <button
                              type="button"
                              aria-label="Row actions"
                              className="p-1.5 border-0 bg-transparent cursor-pointer text-[var(--color-wise-text-muted)] hover:text-[var(--color-wise-text)] flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--color-wise-ring)] bg-[var(--color-wise-canvas)]">
              <span className="text-[11px] text-[var(--color-wise-text-muted)]">
                {enrollmentsQuery.data
                  ? `Showing ${enrollments.length} of ${enrollmentsQuery.data.total} enrollments`
                  : 'Loading…'}
              </span>
              <Link
                to="/admin/students"
                className="text-[11px] font-bold text-[var(--color-wise-primary-text)] no-underline flex items-center gap-1 hover:underline"
              >
                All students <ChevronRight size={11} strokeWidth={3} />
              </Link>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="flex flex-col gap-4">
            {/* Quick Actions */}
            <div className="bg-[var(--color-wise-surface)] rounded-[30px] ring-1 ring-[var(--color-wise-ring)] shadow-[0_1px_3px_rgba(14,15,12,0.04)] overflow-hidden">
              <div className="px-5 pt-4 pb-2.5 border-b border-[var(--color-wise-ring)]">
                <h2 className="text-[14px] font-extrabold text-[var(--color-wise-text)] m-0">Quick Actions</h2>
              </div>
              <div className="px-3 pt-2 pb-3 grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((item) => {
                  const QIcon = item.icon
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex flex-col gap-1.5 p-3.5 rounded-xl no-underline bg-[var(--color-wise-canvas)] ring-1 ring-[var(--color-wise-ring)] hover:bg-[var(--color-wise-surface-soft)] hover:ring-[var(--color-wise-ring-strong)] transition-colors relative focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2"
                    >
                      <QIcon size={20} className="text-[var(--color-wise-primary-text)]" aria-hidden="true" />
                      <div>
                        <div className="text-[12px] font-bold text-[var(--color-wise-text)] leading-tight">{item.label}</div>
                        <div className="text-[10px] text-[var(--color-wise-text-muted)] mt-0.5 font-medium">{item.sub}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Live Activity — no backing endpoint exists yet. Rather than
                render fake rows (as the previous hardcoded ACTIVITY array
                did) we show an EmptyState telling the operator the feature
                is coming. A future PR wires this to an activity-log route. */}
            <div className="bg-[var(--color-wise-surface)] rounded-[30px] ring-1 ring-[var(--color-wise-ring)] shadow-[0_1px_3px_rgba(14,15,12,0.04)] overflow-hidden">
              <div className="px-5 pt-4 pb-2.5 border-b border-[var(--color-wise-ring)]">
                <h2 className="text-[14px] font-extrabold text-[var(--color-wise-text)] m-0">Live Activity</h2>
              </div>
              <EmptyState
                icon={Activity}
                title="Activity log coming soon"
                description="A real-time feed of enrollments, payments, and reviews will appear here."
                className="py-8"
              />
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
