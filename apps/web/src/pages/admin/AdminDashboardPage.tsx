// FIR-165 / FIR-166 / FIR-173 — Admin Dashboard
// Sprint 3 Story 16: migrated from navy/blue palette to Wise theme + lucide icons.
import { Link } from 'react-router'
import {
  Users, DollarSign, Clock, BookOpen, Camera,
  ArrowUpRight, ArrowDownRight, ArrowRight,
  Activity, CheckCircle2, AlertCircle, TrendingUp,
  ChevronRight, MoreHorizontal, Plus, Zap,
  GraduationCap, CreditCard, Mail, BarChart2, Rocket,
} from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import { usePageMeta } from '../../hooks/usePageMeta'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const KPI = [
  {
    label: 'Total Revenue',
    value: '$94,820',
    change: '+18.4%',
    up: true,
    sub: 'vs last month',
    icon: DollarSign,
  },
  {
    label: 'Active Students',
    value: '247',
    change: '+12%',
    up: true,
    sub: 'vs last month',
    icon: Users,
  },
  {
    label: 'Active Cohorts',
    value: '6',
    change: '2 starting soon',
    up: true,
    sub: 'this month',
    icon: BookOpen,
  },
  {
    label: 'Pending Payments',
    value: '7',
    change: 'Needs review',
    up: false,
    sub: 'manual receipts',
    icon: Clock,
    urgent: true,
  },
  {
    label: 'Screenshot Queue',
    value: '12',
    change: '+3 today',
    up: false,
    sub: 'pending reviews',
    icon: Camera,
    urgent: true,
  },
] as const

const ENROLLMENTS = [
  { id: '1', name: 'Sara Ahmed',   email: 'sara@example.com',  course: 'AI Product Bootcamp',    status: 'Active'    as const, progress: 42,  date: 'Jan 8'  },
  { id: '2', name: 'Aleem Haider', email: 'aleem@nextai.com',  course: 'Claude API Mastery',     status: 'Active'    as const, progress: 78,  date: 'Dec 10' },
  { id: '3', name: 'Jordan Lee',   email: 'jordan@gmail.com',  course: 'AI Product Bootcamp',    status: 'Pending'   as const, progress: 0,   date: 'Jan 8'  },
  { id: '4', name: 'Priya Sharma', email: 'priya@outlook.com', course: 'Prompt Engineering Pro', status: 'Completed' as const, progress: 100, date: 'Oct 3'  },
  { id: '5', name: 'Marcus Webb',  email: 'marcus@dev.io',     course: 'Full-Stack AI Dev',      status: 'Active'    as const, progress: 15,  date: 'Jan 12' },
]

const ACTIVITY = [
  { icon: GraduationCap, text: 'Sara Ahmed enrolled in AI Product Bootcamp', time: '2 min ago'   },
  { icon: CreditCard,    text: 'New manual payment receipt uploaded by Omar', time: '18 min ago'  },
  { icon: CheckCircle2,  text: 'Priya Sharma completed Prompt Engineering',  time: '1 hour ago'  },
  { icon: Camera,        text: '3 new screenshot submissions awaiting review', time: '3 hours ago' },
  { icon: Rocket,        text: 'Cohort "Claude API Feb" launched',             time: '5 hours ago' },
]

const QUICK_ACTIONS = [
  { to: '/admin/courses',           icon: BookOpen,   label: 'Courses',      sub: 'Manage content',  count: null as number | null },
  { to: '/admin/manual-payments',   icon: CreditCard, label: 'Payments',     sub: '7 pending',       count: 7    as number | null },
  { to: '/admin/screenshot-review', icon: Camera,     label: 'Screenshots',  sub: '12 in queue',     count: 12   as number | null },
  { to: '/admin/students',          icon: Users,      label: 'Students',     sub: '247 active',      count: null as number | null },
  { to: '/admin/broadcast-email',   icon: Mail,       label: 'Broadcast',    sub: 'Send email',      count: null as number | null },
  { to: '/admin/reporting',         icon: BarChart2,  label: 'Analytics',    sub: 'View reports',    count: null as number | null },
]

const STATUS_CFG = {
  Active:    { cls: 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]' },
  Pending:   { cls: 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)]' },
  Completed: { cls: 'bg-[var(--color-wise-success)]/10 text-[var(--color-wise-success)]' },
} as const

const HEALTH = [
  { label: 'API',              value: '42ms avg',      ok: true,  icon: Zap           },
  { label: 'Payment Gateway',  value: 'Stripe online', ok: true,  icon: CheckCircle2  },
  { label: 'Email Service',    value: 'Unconfigured',  ok: false, icon: AlertCircle   },
  { label: 'Completion Rate',  value: '87%',           ok: true,  icon: TrendingUp    },
]

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ k }: { k: typeof KPI[number] }) {
  const Icon = k.icon
  return (
    <div className="relative overflow-hidden bg-[var(--color-wise-surface)] rounded-[30px] px-6 py-5 ring-1 ring-[var(--color-wise-ring)] shadow-[0_1px_3px_rgba(14,15,12,0.04),0_4px_16px_rgba(14,15,12,0.03)] transition-transform duration-150 hover:-translate-y-0.5">
      {/* Urgent badge */}
      {'urgent' in k && k.urgent && (
        <div className="absolute top-3.5 right-3.5 bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-[0.4px] border border-[var(--color-wise-danger)]/15">
          Action needed
        </div>
      )}

      {/* Icon */}
      <div className="w-[42px] h-[42px] rounded-[13px] bg-[var(--color-wise-mint)] flex items-center justify-center mb-4 text-[var(--color-wise-primary-text)]">
        <Icon size={19} strokeWidth={2} aria-hidden="true" />
      </div>

      {/* Value */}
      <div className="text-[32px] font-black text-[var(--color-wise-text)] tracking-[-1.5px] leading-none mb-1">
        {k.value}
      </div>
      <div className="text-[12px] text-[var(--color-wise-text-muted)] font-medium mb-3.5">{k.label}</div>

      {/* Trend */}
      <div className="flex items-center gap-1">
        {k.up
          ? <ArrowUpRight size={12} className="text-[var(--color-wise-success)]" strokeWidth={2.5} aria-hidden="true" />
          : <ArrowDownRight size={12} className="text-[var(--color-wise-danger)]" strokeWidth={2.5} aria-hidden="true" />
        }
        <span className={`text-[11px] font-bold ${k.up ? 'text-[var(--color-wise-success)]' : 'text-[var(--color-wise-danger)]'}`}>{k.change}</span>
        <span className="text-[11px] text-[var(--color-wise-text-muted)]"> · {k.sub}</span>
      </div>
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

  return (
    <AdminShell title="Dashboard">
      <div className="px-8 py-7 min-h-full bg-[var(--color-wise-canvas)]">
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-7 flex-wrap gap-3">
          <div>
            <h1 className="text-[24px] font-black text-[var(--color-wise-text)] m-0 tracking-[-0.5px]">
              {greeting}, Aleem
            </h1>
            <p className="text-[13px] text-[var(--color-wise-text-muted)] mt-1 font-medium">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Live pill */}
            <div className="flex items-center gap-2 bg-[var(--color-wise-surface)] ring-1 ring-[var(--color-wise-ring)] rounded-[10px] px-3.5 py-2">
              <Activity size={14} className="text-[var(--color-wise-primary-text)]" aria-hidden="true" />
              <span className="text-[12px] font-semibold text-[var(--color-wise-text)]">Live</span>
              <span className="w-[7px] h-[7px] rounded-full bg-[var(--color-wise-primary)] ring-[3px] ring-[var(--color-wise-primary)]/25 inline-block" aria-hidden="true" />
            </div>
            {/* CTA */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          {KPI.map(k => <KpiCard key={k.label} k={k} />)}
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

            <div className="overflow-x-auto">
              <table className="w-full border-collapse" aria-label="Recent enrollments">
                <thead>
                  <tr className="bg-[var(--color-wise-surface-soft)]">
                    {['Student', 'Course', 'Status', 'Progress', 'Date', ''].map(col => (
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
                  {ENROLLMENTS.map((row, i) => {
                    const st = STATUS_CFG[row.status]
                    return (
                      <tr
                        key={row.id}
                        className={`cursor-pointer hover:bg-[var(--color-wise-surface-soft)]/60 ${i < ENROLLMENTS.length - 1 ? 'border-b border-[var(--color-wise-ring)]' : ''}`}
                      >
                        {/* Student */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] text-[13px] font-extrabold"
                              aria-hidden="true"
                            >
                              {row.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-[13px] font-bold text-[var(--color-wise-text)] whitespace-nowrap">{row.name}</div>
                              <div className="text-[11px] text-[var(--color-wise-text-muted)] mt-px">{row.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Course */}
                        <td className="px-5 py-3">
                          <span className="text-[12px] font-semibold text-[var(--color-wise-text)]">{row.course}</span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${st.cls}`}>
                            {row.status}
                          </span>
                        </td>

                        {/* Progress */}
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

                        {/* Date */}
                        <td className="px-5 py-3">
                          <span className="text-[11px] text-[var(--color-wise-text-muted)] font-medium">{row.date}</span>
                        </td>

                        {/* Menu */}
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

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--color-wise-ring)] bg-[var(--color-wise-canvas)]">
              <span className="text-[11px] text-[var(--color-wise-text-muted)]">Showing 5 of 247 students</span>
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
                {QUICK_ACTIONS.map(item => {
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
                      {item.count !== null && (
                        <span className="absolute top-2 right-2 bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                          {item.count}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Platform Health */}
            <div className="bg-[var(--color-wise-surface)] rounded-[30px] ring-1 ring-[var(--color-wise-ring)] shadow-[0_1px_3px_rgba(14,15,12,0.04)] overflow-hidden">
              <div className="px-5 pt-4 pb-2.5 border-b border-[var(--color-wise-ring)]">
                <h2 className="text-[14px] font-extrabold text-[var(--color-wise-text)] m-0">Platform Health</h2>
              </div>
              <div className="px-5 pt-2.5 pb-4">
                {HEALTH.map((item, i) => {
                  const HIcon = item.icon
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between py-2.5 ${i < HEALTH.length - 1 ? 'border-b border-[var(--color-wise-ring)]' : ''}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <HIcon size={14} className={item.ok ? 'text-[var(--color-wise-success)]' : 'text-[var(--color-wise-danger)]'} strokeWidth={2} aria-hidden="true" />
                        <span className="text-[12px] font-semibold text-[var(--color-wise-text)]">{item.label}</span>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${item.ok ? 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]' : 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]'}`}>
                        {item.value}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Live Activity */}
            <div className="bg-[var(--color-wise-surface)] rounded-[30px] ring-1 ring-[var(--color-wise-ring)] shadow-[0_1px_3px_rgba(14,15,12,0.04)] overflow-hidden">
              <div className="px-5 pt-4 pb-2.5 border-b border-[var(--color-wise-ring)]">
                <h2 className="text-[14px] font-extrabold text-[var(--color-wise-text)] m-0">Live Activity</h2>
              </div>
              <div className="px-4 pt-2 pb-3.5 relative">
                {ACTIVITY.map((item, i) => {
                  const AIcon = item.icon
                  return (
                    <div key={i} className="flex items-start gap-2.5 py-2 relative">
                      <div className="w-[30px] h-[30px] rounded-full flex-shrink-0 bg-[var(--color-wise-mint)] flex items-center justify-center text-[var(--color-wise-primary-text)] ring-2 ring-white relative z-10">
                        <AIcon size={14} aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[11px] text-[var(--color-wise-text)] font-medium m-0 leading-[1.5]">{item.text}</p>
                        <p className="text-[10px] text-[var(--color-wise-text-muted)] mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
