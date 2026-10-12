'use client'

// Auth guards for client-side rendering.
// RequireAuth / RequireGuest / RequireAdminGuest are transitional — Phase 3
// will replace them with middleware.ts (edge redirects before render).
// RequirePermission stays as a permanent fine-grained client-side gate.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'

interface RequireAuthProps {
  children: React.ReactNode
  role?: 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN'
}

function RequireAuth({ children, role }: RequireAuthProps) {
  const { accessToken, user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!accessToken || !user) { router.replace('/login'); return }
    if (user.role === 'STUDENT' && user.inviteStatus === 'PENDING') {
      router.replace('/student/accept-invite'); return
    }
    if (role && user.role !== role && user.role !== 'SUPER_ADMIN') {
      router.replace(user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard')
    }
  }, [isLoading, accessToken, user, role, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!accessToken || !user) return null

  if (user.role === 'STUDENT' && user.inviteStatus === 'REVOKED') {
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

  if (role && user.role !== role && user.role !== 'SUPER_ADMIN') return null

  return <>{children}</>
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { accessToken, user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !accessToken || !user) return
    router.replace((user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') ? '/admin/dashboard' : '/dashboard')
  }, [isLoading, accessToken, user, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (accessToken && user) return null

  return <>{children}</>
}

function RequireAdminGuest({ children }: { children: React.ReactNode }) {
  const { accessToken, user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !accessToken || !user) return
    router.replace((user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') ? '/admin/dashboard' : '/dashboard')
  }, [isLoading, accessToken, user, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (accessToken && user) return null

  return <>{children}</>
}

interface RequirePermissionProps {
  permission: string
  children: React.ReactNode
}

function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { isLoading } = useAuth()
  const { hasPermission } = usePermissions()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !hasPermission(permission)) router.replace('/admin/forbidden')
  }, [isLoading, hasPermission, permission, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!hasPermission(permission)) return null

  return <>{children}</>
}

export { RequireAuth, RequireGuest, RequireAdminGuest, RequirePermission }
