'use client'

// Admin sidebar with real auth wiring, NavLink active states, logout, and permission filtering (PBA-235)
// PBA-242 — Sub-Admins nav item + role indicator in sidebar footer
import * as React from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  BarChart2,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LogOut,
  BookOpen,
  ShieldCheck,
  Phone,
  ClipboardList,
} from 'lucide-react'
import { Logo, LogoMark } from './logo'
import { Button } from './button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { SidebarContext, type SidebarState } from '@/hooks/use-sidebar'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { logout } from '@/store/auth'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  icon: React.ElementType
  to: string
  /** If true, only exact path match counts as active */
  end?: boolean
  /**
   * PBA-235: permission checkpoint required to show this nav item.
   * Omit for items that are always visible (Dashboard, Settings).
   */
  permission?: string
  /**
   * PBA-330: if true, this nav item is only visible to support agents (takesStudentCalls: true)
   */
  agentOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    icon: LayoutDashboard,  to: '/admin',               end: true },
  { label: 'Students',     icon: Users,             to: '/admin/students',      permission: 'students:read' },
  { label: 'Cohorts',      icon: GraduationCap,     to: '/admin/cohorts',       permission: 'cohorts:read' },
  { label: 'Step Library', icon: BookOpen,          to: '/admin/steps',         permission: 'steps:read' },
  { label: 'Review Queue', icon: ClipboardCheck,    to: '/admin/review-queue',  permission: 'submissions:read' },
  { label: 'Messages',     icon: MessageSquare,     to: '/admin/messages',      permission: 'messages:read' },
  { label: 'Admissions',   icon: ClipboardList,     to: '/admin/admissions' },
  { label: 'Reports',      icon: BarChart2,         to: '/admin/reports',       permission: 'reports:read' },
  { label: 'Sub-Admins',   icon: ShieldCheck,       to: '/admin/sub-admins',    permission: 'settings:manage-sub-admins' },
  { label: 'My Calls',     icon: Phone,             to: '/admin/my-calls',      agentOnly: true },
  { label: 'Settings',     icon: Settings,          to: '/admin/settings' },
]

interface AdminSidebarProps {
  className?: string
}

function AdminSidebar({ className }: AdminSidebarProps) {
  const [state, setState] = React.useState<SidebarState>('expanded')
  const { user } = useAuth()
  const { hasPermission, isLoading: permissionsLoading, isSuperAdmin, permissions } = usePermissions()
  const router = useRouter()
  const pathname = usePathname()
  const collapsed = state === 'collapsed'

  // PBA-235: filter nav items by permission; items without a permission field are always shown
  // PBA-330: also filter by agentOnly — only show to admins with takesStudentCalls: true
  const visibleNavItems = NAV_ITEMS.filter(({ permission, agentOnly }) => {
    if (agentOnly && !user?.takesStudentCalls) return false
    if (!permission) return true
    // While auth is loading, show nothing to avoid a flash of inaccessible items
    if (permissionsLoading) return false
    return hasPermission(permission)
  })

  const toggle = () => setState(s => s === 'expanded' ? 'collapsed' : 'expanded')
  const open   = () => setState('expanded')
  const close  = () => setState('collapsed')

  // Keyboard shortcut Cmd/Ctrl+B to toggle sidebar
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  const userFullName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : 'Admin'
  const userInitials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : 'AD'

  return (
    <SidebarContext.Provider value={{ state, toggle, open, close }}>
      <aside
        data-slot="admin-sidebar"
        data-state={state}
        className={cn(
          'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200 shrink-0',
          collapsed ? 'w-14' : 'w-64',
          className
        )}
      >
        {/* ── Logo area ── */}
        <div className={cn(
          'h-16 flex items-center border-b border-sidebar-border shrink-0',
          collapsed ? 'justify-center px-0' : 'px-5 gap-2'
        )}>
          {collapsed ? (
            <LogoMark size={28} />
          ) : (
            <Logo variant="full" size="sm" />
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Admin navigation">
          <TooltipProvider delayDuration={200}>
            <ul className="space-y-0.5" role="list">
              {visibleNavItems.map(({ label, icon: Icon, to, end }) => {
                const isActive = end ? pathname === to : pathname.startsWith(to)
                const linkEl = (
                  <li key={to} role="listitem">
                    <Link
                      href={to}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                        collapsed && 'justify-center px-2'
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      {!collapsed && <span>{label}</span>}
                    </Link>
                  </li>
                )

                if (collapsed) {
                  return (
                    <Tooltip key={to}>
                      <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                      <TooltipContent side="right">{label}</TooltipContent>
                    </Tooltip>
                  )
                }
                return linkEl
              })}
            </ul>
          </TooltipProvider>
        </nav>

        {/* ── User footer ── */}
        <div className="shrink-0 border-t border-sidebar-border">
          {/* User info row */}
          <div className={cn(
            'flex items-center gap-3 px-3 py-3',
            collapsed && 'justify-center px-2'
          )}>
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={user?.avatarUrl ?? undefined} alt={userFullName} />
              <AvatarFallback className="bg-brand-navy text-white text-[10px] font-medium">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{userFullName}</p>
                {isSuperAdmin ? (
                  <p className="text-[11px] text-muted-foreground truncate">Super Admin</p>
                ) : (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-[11px] text-muted-foreground truncate cursor-default w-fit">
                          Admin
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {permissions.length} active permission{permissions.length !== 1 ? 's' : ''}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
            {!collapsed && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleLogout}
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label="Sign out"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign out</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Collapse toggle */}
          <div className={cn(
            'px-2 pb-2',
            collapsed ? 'flex justify-center' : 'flex justify-end'
          )}>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed
                ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                : <ChevronLeft  className="h-3.5 w-3.5" aria-hidden="true" />
              }
            </Button>
          </div>
        </div>
      </aside>
    </SidebarContext.Provider>
  )
}

export { AdminSidebar }
