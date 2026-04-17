// PBA-130 — Admin Layout Shell
// Role guard + AdminShell wrapper + <Outlet /> for nested admin routes.
// PBA-262 — Redirects to /admin/login if not authenticated, to /dashboard if insufficient role.
// PBA-382 — Admin bell count wired to pending review queue (refetches every 60s).
import { Navigate, Outlet, useLocation } from 'react-router'
import { AdminShell } from '@/app/components/ui/admin-shell'
import { useAuth } from '@/hooks/use-auth'
import { useAdminQueueStats } from '@/hooks/use-admin-submissions'
import { cn } from '@/lib/utils'

interface AdminLayoutProps {
  className?: string
}

/**
 * AdminLayout — the top-level shell for all /admin/* routes.
 *
 * Responsibilities:
 * 1. Role guard: only ADMIN and SUPER_ADMIN may enter; all others are redirected.
 * 2. Renders the AdminShell (sidebar + topbar).
 * 3. Renders <Outlet /> so nested admin routes mount their page content inside the shell.
 * 4. Polls the review queue stats every 60s and passes totalPending to the topbar bell.
 */
function AdminLayout({ className }: AdminLayoutProps) {
  const { accessToken, user, isLoading } = useAuth()
  const location = useLocation()

  // PBA-382 — refetch every 60s so the bell stays current without a page reload
  const { data: queueStats } = useAdminQueueStats({ refetchInterval: 60_000 })
  const totalPending = queueStats?.totalPending ?? 0

  // ── Loading state — wait for session restore before deciding ──
  if (isLoading) {
    return (
      <div
        data-slot="admin-layout-loading"
        className="flex h-screen items-center justify-center bg-background"
        aria-label="Loading admin portal"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  // ── No session — redirect to admin login, preserve return path ──
  if (!accessToken || !user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  // ── Insufficient role — redirect to student dashboard ──
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AdminShell className={cn(className)} notificationCount={totalPending}>
      <Outlet />
    </AdminShell>
  )
}

export { AdminLayout }
