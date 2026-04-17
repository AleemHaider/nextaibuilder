// FIR-165 / FIR-166 / FIR-173 — Shared admin shell layout with sidebar + topbar
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  BookOpen,
  Users,
  CreditCard,
  Camera,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Mail,
  BarChart2,
  ChevronRight,
  Receipt,
  ClipboardList,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'
import { Logo } from '../Logo'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  badge?: number
}

interface NavSection {
  label: string
  items: NavItem[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #4a9ad4, #1a2744)',
  'linear-gradient(135deg, #cc4a00, #ff8c5a)',
  'linear-gradient(135deg, #054d28, #16a34a)',
  'linear-gradient(135deg, #7c3aed, #4a9ad4)',
  'linear-gradient(135deg, #d97706, #f59e0b)',
]

function getAvatarGradient(name: string): string {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length]
}

// ---------------------------------------------------------------------------
// AdminShell props
// ---------------------------------------------------------------------------

interface AdminShellProps {
  children: React.ReactNode
  /** Page title shown in the topbar */
  title: string
  /** Optional slot for topbar action buttons (e.g. "New Course") */
  actions?: React.ReactNode
}

// ---------------------------------------------------------------------------
// SidebarContent — rendered both in desktop and mobile drawer
// ---------------------------------------------------------------------------

interface SidebarContentProps {
  onClose?: () => void
}

function SidebarContent({ onClose }: SidebarContentProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const navSections: NavSection[] = [
    {
      label: 'Overview',
      items: [
        {
          label: 'Dashboard',
          to: '/admin/dashboard',
          icon: <LayoutDashboard size={16} />,
        },
      ],
    },
    {
      label: 'Content',
      items: [
        {
          label: 'Courses',
          to: '/admin/courses',
          icon: <BookOpen size={16} />,
        },
      ],
    },
    {
      label: 'Students',
      items: [
        {
          label: 'Students',
          to: '/admin/students',
          icon: <Users size={16} />,
        },
        {
          label: 'Enrollments',
          to: '/admin/enrollments',
          icon: <ClipboardList size={16} />,
        },
        {
          label: 'Payments',
          to: '/admin/payments',
          icon: <Receipt size={16} />,
        },
        {
          label: 'Manual Payments',
          to: '/admin/manual-payments',
          icon: <CreditCard size={16} />,
        },
        {
          label: 'Screenshot Review',
          to: '/admin/screenshot-review',
          icon: <Camera size={16} />,
        },
      ],
    },
    {
      label: 'Communications',
      items: [
        {
          label: 'Broadcast Email',
          to: '/admin/broadcast-email',
          icon: <Mail size={16} />,
        },
        {
          label: 'Reporting',
          to: '/admin/reporting',
          icon: <BarChart2 size={16} />,
        },
      ],
    },
    {
      label: 'System',
      items: [
        {
          label: 'Team',
          to: '/admin/team',
          icon: <UserCog size={16} />,
        },
        {
          label: 'Settings',
          to: '/admin/settings',
          icon: <Settings size={16} />,
        },
      ],
    },
  ]

  async function handleLogout() {
    await logout()
    navigate('/admin/login')
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0d1a3a',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle background glow */}
      <div style={{
        position: 'absolute',
        top: -60,
        left: -60,
        width: 280,
        height: 280,
        background: 'radial-gradient(circle, rgba(74,154,212,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo area */}
      <div style={{
        padding: '20px 20px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <Logo size="sm" variant="dark" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            style={{
              padding: 6,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.35)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav
        style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 8px', position: 'relative', zIndex: 1 }}
        aria-label="Admin navigation"
      >
        {navSections.map((section) => (
          <div key={section.label} style={{ marginBottom: 24 }}>
            <p style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.25)',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              padding: '0 10px',
              marginBottom: 4,
            }}>
              {section.label}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl text-[13px] font-[500]',
                    'transition-all duration-150 no-underline',
                    isActive
                      ? 'font-[700]'
                      : '',
                  )
                }
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 10,
                  marginBottom: 2,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  textDecoration: 'none',
                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.45)',
                  background: isActive ? 'rgba(74,154,212,0.18)' : 'transparent',
                  borderLeft: isActive ? '3px solid #4a9ad4' : '3px solid transparent',
                  paddingLeft: isActive ? 7 : 10,
                  transition: 'all 0.15s ease',
                })}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.9,
                  }}
                >
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span style={{
                    background: '#4a9ad4',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 9999,
                    minWidth: 18,
                    textAlign: 'center',
                    lineHeight: 1.4,
                  }}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />

      {/* User + logout */}
      <div style={{ padding: '12px', flexShrink: 0, position: 'relative', zIndex: 1 }}>
        {user && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 10px',
            borderRadius: 12,
          }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                background: getAvatarGradient(user.name),
                boxShadow: '0 0 0 2px rgba(255,255,255,0.1)',
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {user.role.replace('_', ' ')}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              style={{
                padding: 7,
                borderRadius: 8,
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.25)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget as HTMLButtonElement
                btn.style.color = '#ff6b6b'
                btn.style.background = 'rgba(255,107,107,0.12)'
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLButtonElement
                btn.style.color = 'rgba(255,255,255,0.25)'
                btn.style.background = 'transparent'
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdminShell
// ---------------------------------------------------------------------------

export default function AdminShell({ children, title, actions }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8f9fb', overflow: 'hidden' }}>

      {/* Desktop sidebar — fixed 240px */}
      <aside
        style={{
          display: 'none',
          flexDirection: 'column',
          width: 240,
          background: '#0d1a3a',
          flexShrink: 0,
          height: '100%',
          position: 'relative',
        }}
        className="lg:flex"
        aria-label="Sidebar"
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex' }}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(13,26,58,0.55)', backdropFilter: 'blur(3px)' }}
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside style={{
            position: 'relative',
            zIndex: 50,
            width: 240,
            background: '#0d1a3a',
            height: '100%',
            boxShadow: '4px 0 40px rgba(13,26,58,0.4)',
          }}>
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Topbar */}
        <header style={{
          height: 60,
          background: '#ffffff',
          borderBottom: '1px solid rgba(26,39,68,0.07)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 28px',
          flexShrink: 0,
          gap: 16,
          boxShadow: '0 1px 0 rgba(26,39,68,0.04)',
        }}>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            style={{
              padding: 8,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: '#717182',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            className="lg:hidden"
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb / title */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: 'rgba(26,39,68,0.35)', fontWeight: 500 }}>Admin</span>
            <ChevronRight size={12} style={{ color: 'rgba(26,39,68,0.25)', flexShrink: 0 }} />
            <h1 style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#1a2744',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '-0.2px',
            }}>
              {title}
            </h1>
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}

            <button
              type="button"
              aria-label="Notifications"
              style={{
                position: 'relative',
                width: 34,
                height: 34,
                borderRadius: 10,
                background: '#f8f9fb',
                border: '1px solid rgba(26,39,68,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#717182',
                cursor: 'pointer',
              }}
            >
              <Bell size={15} />
              <span style={{
                position: 'absolute',
                top: 7,
                right: 7,
                width: 7,
                height: 7,
                background: '#ef4444',
                borderRadius: '50%',
                border: '1.5px solid #fff',
              }} aria-hidden="true" />
            </button>

            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2744', lineHeight: 1.2 }}>{user.name}</span>
                  <span style={{ fontSize: 10, color: '#a3a3b8', fontWeight: 500, textTransform: 'capitalize' }}>{user.role.replace('_', ' ')}</span>
                </div>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: getAvatarGradient(user.name),
                    boxShadow: '0 2px 8px rgba(26,39,68,0.15)',
                    cursor: 'default',
                  }}
                  aria-label={user.name}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', background: '#f8f9fb' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
