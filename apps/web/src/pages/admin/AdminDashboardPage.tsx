// FIR-165 / FIR-166 / FIR-173 — Admin Dashboard (world-class redesign)
import { Link } from 'react-router'
import {
  Users, DollarSign, Clock, BookOpen, Camera,
  ArrowUpRight, ArrowDownRight, ArrowRight,
  Activity, CheckCircle2, AlertCircle, TrendingUp,
  ChevronRight, MoreHorizontal, Plus, Zap,
} from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'

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
    accent: '#4a9ad4',
    softBg: 'rgba(74,154,212,0.09)',
  },
  {
    label: 'Active Students',
    value: '247',
    change: '+12%',
    up: true,
    sub: 'vs last month',
    icon: Users,
    accent: '#7c3aed',
    softBg: 'rgba(124,58,237,0.09)',
  },
  {
    label: 'Active Cohorts',
    value: '6',
    change: '2 starting soon',
    up: true,
    sub: 'this month',
    icon: BookOpen,
    accent: '#059669',
    softBg: 'rgba(5,150,105,0.09)',
  },
  {
    label: 'Pending Payments',
    value: '7',
    change: 'Needs review',
    up: false,
    sub: 'manual receipts',
    icon: Clock,
    accent: '#f59e0b',
    softBg: 'rgba(245,158,11,0.09)',
    urgent: true,
  },
  {
    label: 'Screenshot Queue',
    value: '12',
    change: '+3 today',
    up: false,
    sub: 'pending reviews',
    icon: Camera,
    accent: '#ef4444',
    softBg: 'rgba(239,68,68,0.09)',
    urgent: true,
  },
]

const ENROLLMENTS = [
  { id: '1', name: 'Sara Ahmed',   email: 'sara@example.com',  gi: 0, course: 'AI Product Bootcamp',    status: 'Active'    as const, progress: 42,  date: 'Jan 8'  },
  { id: '2', name: 'Aleem Haider', email: 'aleem@nextai.com',  gi: 1, course: 'Claude API Mastery',     status: 'Active'    as const, progress: 78,  date: 'Dec 10' },
  { id: '3', name: 'Jordan Lee',   email: 'jordan@gmail.com',  gi: 2, course: 'AI Product Bootcamp',    status: 'Pending'   as const, progress: 0,   date: 'Jan 8'  },
  { id: '4', name: 'Priya Sharma', email: 'priya@outlook.com', gi: 3, course: 'Prompt Engineering Pro', status: 'Completed' as const, progress: 100, date: 'Oct 3'  },
  { id: '5', name: 'Marcus Webb',  email: 'marcus@dev.io',     gi: 4, course: 'Full-Stack AI Dev',      status: 'Active'    as const, progress: 15,  date: 'Jan 12' },
]

const ACTIVITY = [
  { emoji: '🎓', color: '#4a9ad4', softBg: 'rgba(74,154,212,0.1)',  text: 'Sara Ahmed enrolled in AI Product Bootcamp', time: '2 min ago'   },
  { emoji: '💳', color: '#f59e0b', softBg: 'rgba(245,158,11,0.1)',  text: 'New manual payment receipt uploaded by Omar', time: '18 min ago'  },
  { emoji: '✅', color: '#059669', softBg: 'rgba(5,150,105,0.1)',   text: 'Priya Sharma completed Prompt Engineering',  time: '1 hour ago'  },
  { emoji: '📸', color: '#ef4444', softBg: 'rgba(239,68,68,0.1)',   text: '3 new screenshot submissions awaiting review', time: '3 hours ago' },
  { emoji: '🚀', color: '#7c3aed', softBg: 'rgba(124,58,237,0.1)', text: 'Cohort "Claude API Feb" launched',             time: '5 hours ago' },
]

const QUICK_ACTIONS = [
  { to: '/admin/courses',           emoji: '📚', label: 'Courses',      sub: 'Manage content',  accent: '#4a9ad4', count: null },
  { to: '/admin/manual-payments',   emoji: '💳', label: 'Payments',     sub: '7 pending',       accent: '#f59e0b', count: 7   },
  { to: '/admin/screenshot-review', emoji: '📸', label: 'Screenshots',  sub: '12 in queue',     accent: '#ef4444', count: 12  },
  { to: '/admin/students',          emoji: '👥', label: 'Students',     sub: '247 active',      accent: '#059669', count: null },
  { to: '/admin/broadcast-email',   emoji: '📧', label: 'Broadcast',    sub: 'Send email',      accent: '#7c3aed', count: null },
  { to: '/admin/reporting',         emoji: '📊', label: 'Analytics',    sub: 'View reports',    accent: '#0ea5e9', count: null },
]

const AVATARS = [
  'linear-gradient(135deg,#4a9ad4,#1a3a6a)',
  'linear-gradient(135deg,#f59e0b,#b45309)',
  'linear-gradient(135deg,#059669,#064e3b)',
  'linear-gradient(135deg,#7c3aed,#4c1d95)',
  'linear-gradient(135deg,#ef4444,#991b1b)',
]

const STATUS_CFG = {
  Active:    { bg: 'rgba(5,150,105,0.1)',   color: '#065f46', dot: '#059669' },
  Pending:   { bg: 'rgba(245,158,11,0.1)',  color: '#92400e', dot: '#f59e0b' },
  Completed: { bg: 'rgba(59,130,246,0.1)', color: '#1e40af', dot: '#3b82f6' },
}

const HEALTH = [
  { label: 'API',              value: '42ms avg',      ok: true,  icon: Zap           },
  { label: 'Payment Gateway',  value: 'Stripe online', ok: true,  icon: CheckCircle2  },
  { label: 'Email Service',    value: 'Unconfigured',  ok: false, icon: AlertCircle   },
  { label: 'Completion Rate',  value: '87%',           ok: true,  icon: TrendingUp    },
]

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ k }: { k: typeof KPI[0] }) {
  const Icon = k.icon
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 18,
        padding: '22px 22px 18px',
        border: '1px solid rgba(26,39,68,0.07)',
        boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
        transition: 'transform 0.18s, box-shadow 0.18s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-3px)'
        el.style.boxShadow = '0 8px 24px rgba(26,39,68,0.1), 0 2px 8px rgba(26,39,68,0.06)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)'
      }}
    >
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.accent, borderRadius: '18px 18px 0 0' }} />

      {/* Corner tint */}
      <div style={{ position: 'absolute', bottom: -20, right: -20, width: 100, height: 100, background: k.softBg, borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Urgent badge */}
      {k.urgent && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: '#fef2f2', color: '#dc2626',
          fontSize: 9, fontWeight: 800, padding: '2px 7px',
          borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.4px',
          border: '1px solid rgba(220,38,38,0.15)',
        }}>
          Action needed
        </div>
      )}

      {/* Icon */}
      <div style={{
        width: 42, height: 42, borderRadius: 13,
        background: k.softBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16, position: 'relative',
      }}>
        <Icon size={19} color={k.accent} strokeWidth={2} />
      </div>

      {/* Value */}
      <div style={{ fontSize: 32, fontWeight: 900, color: '#1a2744', letterSpacing: '-1.5px', lineHeight: 1, marginBottom: 4 }}>
        {k.value}
      </div>
      <div style={{ fontSize: 12, color: '#717182', fontWeight: 500, marginBottom: 14 }}>{k.label}</div>

      {/* Trend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {k.up
          ? <ArrowUpRight size={12} color="#059669" strokeWidth={2.5} />
          : <ArrowDownRight size={12} color="#f59e0b" strokeWidth={2.5} />
        }
        <span style={{ fontSize: 11, fontWeight: 700, color: k.up ? '#059669' : '#d97706' }}>{k.change}</span>
        <span style={{ fontSize: 11, color: '#a3a3b8' }}> · {k.sub}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const now   = new Date()
  const hour  = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr  = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <AdminShell title="Dashboard">
      <div style={{ padding: '28px 32px', minHeight: '100%', background: '#f8f9fb' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a2744', margin: 0, letterSpacing: '-0.5px' }}>
              {greeting}, Aleem 👋
            </h1>
            <p style={{ fontSize: 13, color: '#a3a3b8', marginTop: 4, fontWeight: 500 }}>{dateStr}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Live pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#fff', border: '1px solid rgba(26,39,68,0.08)',
              borderRadius: 10, padding: '8px 14px',
              boxShadow: '0 1px 3px rgba(26,39,68,0.05)',
            }}>
              <Activity size={14} color="#4a9ad4" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2744' }}>Live</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)', display: 'inline-block' }} />
            </div>
            {/* CTA */}
            <Link to="/admin/courses" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#1a2744', color: '#fff',
              fontSize: 13, fontWeight: 700, textDecoration: 'none',
              padding: '9px 18px', borderRadius: 10,
              boxShadow: '0 2px 10px rgba(26,39,68,0.28)',
            }}>
              <Plus size={14} strokeWidth={2.5} />
              New Course
            </Link>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 24 }} className="kpi-row">
          {KPI.map(k => <KpiCard key={k.label} k={k} />)}
        </div>

        {/* ── Main layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 344px', gap: 20 }} className="main-layout">

          {/* ── Enrollments table ── */}
          <div style={{
            background: '#fff', borderRadius: 18,
            border: '1px solid rgba(26,39,68,0.07)',
            boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.03)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 24px', borderBottom: '1px solid rgba(26,39,68,0.06)',
            }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1a2744', margin: 0 }}>Recent Enrollments</h2>
                <p style={{ fontSize: 12, color: '#a3a3b8', marginTop: 2 }}>Latest activity across all courses</p>
              </div>
              <Link to="/admin/students" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontWeight: 700, color: '#4a9ad4', textDecoration: 'none',
                padding: '6px 12px', borderRadius: 8,
                background: 'rgba(74,154,212,0.08)', border: '1px solid rgba(74,154,212,0.15)',
              }}>
                View all <ArrowRight size={12} strokeWidth={2.5} />
              </Link>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Recent enrollments">
                <thead>
                  <tr style={{ background: '#f8f9fb' }}>
                    {['Student', 'Course', 'Status', 'Progress', 'Date', ''].map(col => (
                      <th key={col} scope="col" style={{
                        textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#a3a3b8',
                        padding: '10px 20px', textTransform: 'uppercase', letterSpacing: '0.8px',
                        borderBottom: '1px solid rgba(26,39,68,0.05)', whiteSpace: 'nowrap',
                      }}>
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
                        style={{ borderBottom: i < ENROLLMENTS.length - 1 ? '1px solid rgba(26,39,68,0.04)' : 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fb')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Student */}
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontSize: 13, fontWeight: 800,
                              background: AVATARS[row.gi],
                              boxShadow: '0 2px 6px rgba(26,39,68,0.15)',
                            }}>
                              {row.name.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744', whiteSpace: 'nowrap' }}>{row.name}</div>
                              <div style={{ fontSize: 11, color: '#a3a3b8', marginTop: 1 }}>{row.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Course */}
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2744' }}>{row.course}</span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11, fontWeight: 700, padding: '4px 10px',
                            borderRadius: 20, background: st.bg, color: st.color,
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                            {row.status}
                          </span>
                        </td>

                        {/* Progress */}
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={{ width: 88, height: 5, background: '#f8f9fb', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                              <div style={{
                                height: '100%', borderRadius: 99,
                                width: `${row.progress}%`,
                                background: row.progress === 100
                                  ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                                  : row.progress === 0 ? 'rgba(26,39,68,0.08)'
                                  : 'linear-gradient(90deg,#4a9ad4,#7c3aed)',
                              }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#717182', flexShrink: 0 }}>{row.progress}%</span>
                          </div>
                        </td>

                        {/* Date */}
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: 11, color: '#a3a3b8', fontWeight: 500 }}>{row.date}</span>
                        </td>

                        {/* Menu */}
                        <td style={{ padding: '14px 16px' }}>
                          <button type="button" style={{ padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: '#a3a3b8', display: 'flex', alignItems: 'center', borderRadius: 6 }}>
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
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 24px', borderTop: '1px solid rgba(26,39,68,0.05)', background: '#fafbfc',
            }}>
              <span style={{ fontSize: 11, color: '#a3a3b8' }}>Showing 5 of 247 students</span>
              <Link to="/admin/students" style={{
                fontSize: 11, fontWeight: 700, color: '#4a9ad4', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                All students <ChevronRight size={11} strokeWidth={3} />
              </Link>
            </div>
          </div>

          {/* ── Right column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Quick Actions */}
            <div style={{
              background: '#fff', borderRadius: 18,
              border: '1px solid rgba(26,39,68,0.07)',
              boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.03)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 20px 10px', borderBottom: '1px solid rgba(26,39,68,0.06)' }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1a2744', margin: 0 }}>Quick Actions</h2>
              </div>
              <div style={{ padding: '8px 12px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {QUICK_ACTIONS.map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 6,
                      padding: '12px 14px', borderRadius: 12, textDecoration: 'none',
                      background: '#f8f9fb', border: '1px solid rgba(26,39,68,0.05)',
                      position: 'relative', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLAnchorElement
                      el.style.background = '#f0f4f8'
                      el.style.borderColor = item.accent + '35'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLAnchorElement
                      el.style.background = '#f8f9fb'
                      el.style.borderColor = 'rgba(26,39,68,0.05)'
                    }}
                  >
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{item.emoji}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2744', lineHeight: 1.2 }}>{item.label}</div>
                      <div style={{ fontSize: 10, color: '#a3a3b8', marginTop: 2, fontWeight: 500 }}>{item.sub}</div>
                    </div>
                    {item.count !== null && (
                      <span style={{
                        position: 'absolute', top: 8, right: 8,
                        background: item.accent, color: '#fff',
                        fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 20,
                      }}>
                        {item.count}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            {/* Platform Health */}
            <div style={{
              background: '#fff', borderRadius: 18,
              border: '1px solid rgba(26,39,68,0.07)',
              boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.03)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 20px 10px', borderBottom: '1px solid rgba(26,39,68,0.06)' }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1a2744', margin: 0 }}>Platform Health</h2>
              </div>
              <div style={{ padding: '10px 20px 16px' }}>
                {HEALTH.map((item, i) => {
                  const HIcon = item.icon
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 0',
                      borderBottom: i < HEALTH.length - 1 ? '1px solid rgba(26,39,68,0.04)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <HIcon size={14} color={item.ok ? '#059669' : '#f59e0b'} strokeWidth={2} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2744' }}>{item.label}</span>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: item.ok ? '#059669' : '#d97706',
                        background: item.ok ? 'rgba(5,150,105,0.08)' : 'rgba(245,158,11,0.08)',
                        padding: '3px 9px', borderRadius: 20,
                      }}>
                        {item.value}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Live Activity */}
            <div style={{
              background: '#fff', borderRadius: 18,
              border: '1px solid rgba(26,39,68,0.07)',
              boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.03)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 20px 10px', borderBottom: '1px solid rgba(26,39,68,0.06)' }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1a2744', margin: 0 }}>Live Activity</h2>
              </div>
              <div style={{ padding: '8px 16px 14px', position: 'relative' }}>
                {/* Timeline connector */}
                <div style={{
                  position: 'absolute', top: 26, bottom: 20, left: 31,
                  width: 1, background: 'linear-gradient(to bottom, rgba(26,39,68,0.08), transparent)',
                }} />
                {ACTIVITY.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', position: 'relative' }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: item.softBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, border: '2px solid #fff',
                      boxShadow: '0 1px 4px rgba(26,39,68,0.1)', zIndex: 1, position: 'relative',
                    }}>
                      {item.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                      <p style={{ fontSize: 11, color: '#1a2744', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>{item.text}</p>
                      <p style={{ fontSize: 10, color: '#a3a3b8', marginTop: 2 }}>{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Responsive overrides */}
        <style>{`
          @media (max-width: 1200px) { .kpi-row { grid-template-columns: repeat(3,1fr) !important; } }
          @media (max-width: 900px)  { .kpi-row { grid-template-columns: repeat(2,1fr) !important; } .main-layout { grid-template-columns: 1fr !important; } }
          @media (max-width: 540px)  { .kpi-row { grid-template-columns: 1fr !important; } }
        `}</style>
      </div>
    </AdminShell>
  )
}
