'use client'

// Admin shell component — wraps all /admin/* pages.
// In Phase 4 this becomes apps/web/app/(admin)/layout.tsx.
// The React Router <Outlet /> is replaced by {children} in Next.js.
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AdminShell } from '@/components/ui/admin-shell'
import { useAuth } from '@/hooks/use-auth'
import { useAdminQueueStats } from '@/hooks/use-admin-submissions'
import { cn } from '@/lib/utils'

interface AdminLayoutProps {
  children: React.ReactNode
  className?: string
}

function AdminLayout({ children, className }: AdminLayoutProps) {
  const { accessToken, user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { data: queueStats } = useAdminQueueStats({ refetchInterval: 60_000 })
  const totalPending = queueStats?.totalPending ?? 0

  useEffect(() => {
    if (isLoading) return
    if (!accessToken || !user) { router.replace(`/admin/login?from=${pathname}`); return }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { router.replace('/dashboard') }
  }, [isLoading, accessToken, user, router, pathname])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background" aria-label="Loading admin portal">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!accessToken || !user) return null
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return null

  return (
    <AdminShell className={cn(className)} notificationCount={totalPending}>
      {children}
    </AdminShell>
  )
}

export { AdminLayout }
