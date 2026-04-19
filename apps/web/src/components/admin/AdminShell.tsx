// FIR-165 / FIR-166 / FIR-173 — Shared admin shell layout with sidebar + topbar
// Sprint 3 Story 16: migrated from navy/blue palette to Wise theme tokens.
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
    <div className="flex h-full flex-col bg-[var(--color-wise-dark)] relative overflow-hidden">
      {/* Logo area */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
        <Logo size="sm" variant="dark" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="p-1.5 rounded-lg bg-transparent border-0 text-white/40 hover:text-white/70 cursor-pointer flex items-center focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto px-3 pt-3 pb-2 relative z-10"
        aria-label="Admin sidebar"
      >
        {navSections.map((section) => (
          <div key={section.label} className="mb-6">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[1.5px] px-2.5 mb-1">
              {section.label}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-xl text-[13px] px-2.5 py-2 mb-0.5',
                    'transition-colors duration-150 no-underline',
                    'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2',
                    isActive
                      ? 'font-bold bg-[var(--color-wise-primary)]/15 text-[var(--color-wise-primary)]'
                      : 'font-medium text-white/75 hover:text-[var(--color-wise-primary)] hover:bg-white/5',
                  )
                }
              >
                <span aria-hidden="true" className="flex-shrink-0 w-4 flex items-center justify-center opacity-90">
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-[1.4]">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Divider */}
      <div className="h-px bg-white/5 flex-shrink-0" />

      {/* User + logout */}
      <div className="p-3 flex-shrink-0 relative z-10">
        {user && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl">
            <div
              className="w-[34px] h-[34px] rounded-full flex-shrink-0 flex items-center justify-center text-white text-[13px] font-bold bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] ring-2 ring-white/10"
              aria-hidden="true"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-white truncate">
                {user.name}
              </div>
              <div className="text-[10px] font-medium text-white/35 uppercase tracking-[0.8px]">
                {user.role.replace('_', ' ')}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              className="p-1.5 rounded-lg bg-transparent border-0 text-white/30 hover:text-[var(--color-wise-danger)] hover:bg-[var(--color-wise-danger)]/12 cursor-pointer flex items-center transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2"
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
    <div className="flex h-screen overflow-hidden bg-[var(--color-wise-canvas)]">
      {/* Desktop sidebar — fixed 240px */}
      <aside
        className="hidden lg:flex flex-col w-60 flex-shrink-0 h-full relative bg-[var(--color-wise-dark)]"
        aria-label="Sidebar"
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[rgba(14,15,12,0.55)] backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="relative z-50 w-60 h-full bg-[var(--color-wise-dark)] shadow-[4px_0_40px_rgba(14,15,12,0.4)]">
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-[60px] bg-[var(--color-wise-canvas)] border-b border-[var(--color-wise-ring)] flex items-center px-7 flex-shrink-0 gap-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="lg:hidden p-2 rounded-lg bg-transparent border-0 text-[var(--color-wise-text-muted)] hover:bg-[var(--color-wise-surface-soft)] cursor-pointer flex items-center focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2"
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb / title */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-[12px] text-[var(--color-wise-text-muted)] font-medium">Admin</span>
            <ChevronRight size={12} className="text-[var(--color-wise-text-muted)] flex-shrink-0" />
            <h1 className="text-[14px] font-bold text-[var(--color-wise-text)] m-0 truncate tracking-[-0.2px]">
              {title}
            </h1>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {actions && <div className="flex items-center gap-2">{actions}</div>}

            <button
              type="button"
              aria-label="Notifications"
              className="relative w-[34px] h-[34px] rounded-[10px] bg-[var(--color-wise-surface)] border border-[var(--color-wise-ring)] flex items-center justify-center text-[var(--color-wise-text-warm)] hover:bg-[var(--color-wise-surface-soft)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2"
            >
              <Bell size={15} />
              <span
                className="absolute top-[7px] right-[7px] w-[7px] h-[7px] bg-[var(--color-wise-danger)] rounded-full ring-[1.5px] ring-white"
                aria-hidden="true"
              />
            </button>

            {user && (
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-[12px] font-bold text-[var(--color-wise-text)] leading-[1.2]">{user.name}</span>
                  <span className="text-[10px] text-[var(--color-wise-text-muted)] font-medium capitalize">{user.role.replace('_', ' ')}</span>
                </div>
                <div
                  className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-[13px] font-bold flex-shrink-0 bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] shadow-[0_2px_8px_rgba(14,15,12,0.15)]"
                  aria-label={user.name}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto bg-[var(--color-wise-canvas)] focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
