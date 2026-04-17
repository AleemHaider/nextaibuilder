// PBA-142 — Route guards for authenticated / unauthenticated routes
// PBA-236 — RequirePermission: redirects to /admin/forbidden when lacking a permission
// PBA-262 — RequireAdminGuest: admin auth pages redirect authenticated admins to /admin/dashboard
// PBA-289 — RequireAuth: STUDENT with inviteStatus !== ACCEPTED redirected to /student/set-password or deactivated screen
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'

interface RequireAuthProps {
  children: React.ReactNode
  /** Role required. Omit to allow any authenticated user. */
  role?: 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN'
}

/** Wraps a route that requires authentication. Redirects to /login if not authenticated. */
function RequireAuth({ children, role }: RequireAuthProps) {
  const { accessToken, user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!accessToken || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // PBA-289 — block student access if invite not yet accepted
  if (user.role === 'STUDENT') {
    if (user.inviteStatus === 'PENDING') {
      return <Navigate to="/student/set-password" replace />
    }
    if (user.inviteStatus === 'REVOKED') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4">
          <div className="w-full max-w-sm text-center space-y-3">
            <p className="text-base font-medium text-foreground">Account Deactivated</p>
            <p className="text-sm text-muted-foreground">
              Your account has been deactivated. Please contact your administrator.
            </p>
          </div>
        </div>
      )
    }
  }

  if (role && user.role !== role && user.role !== 'SUPER_ADMIN') {
    const dest = user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'
    return <Navigate to={dest} replace />
  }

  return <>{children}</>
}

/** Wraps auth pages (login/signup). Redirects to dashboard if already authenticated. */
function RequireGuest({ children }: { children: React.ReactNode }) {
  const { accessToken, user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (accessToken && user) {
    const dest = (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')
      ? '/admin/dashboard'
      : '/dashboard'
    return <Navigate to={dest} replace />
  }

  return <>{children}</>
}

interface RequirePermissionProps {
  /** The permission checkpoint the user must hold */
  permission: string
  children: React.ReactNode
}

/**
 * PBA-236 — Wraps a route that requires a specific permission.
 * - While auth is loading: shows a spinner (no premature redirect)
 * - SUPER_ADMIN: never redirected
 * - User lacks permission: redirects to /admin/forbidden
 */
function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { isLoading } = useAuth()
  const { hasPermission } = usePermissions()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!hasPermission(permission)) {
    return <Navigate to="/admin/forbidden" replace />
  }

  return <>{children}</>
}

/**
 * PBA-262 — Wraps admin auth pages (login, forgot-password).
 * - Authenticated admins/super-admins → redirect to /admin/dashboard
 * - Authenticated students → redirect to /dashboard
 * - Unauthenticated → render children
 */
function RequireAdminGuest({ children }: { children: React.ReactNode }) {
  const { accessToken, user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (accessToken && user) {
    const dest = (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')
      ? '/admin/dashboard'
      : '/dashboard'
    return <Navigate to={dest} replace />
  }

  return <>{children}</>
}

export { RequireAuth, RequireGuest, RequireAdminGuest, RequirePermission }
