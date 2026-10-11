'use client'

// Admin portal shell — composes sidebar + topbar, sources user from auth store directly
import * as React from 'react'
import { AdminSidebar } from './admin-sidebar'
import { AdminTopbar } from './admin-topbar'
import { cn } from '@/lib/utils'

interface AdminShellProps {
  children: React.ReactNode
  pageTitle?: string
  showSearch?: boolean
  notificationCount?: number
  className?: string
}

/**
 * Admin portal app shell.
 * Layout: collapsible 256px/56px left sidebar | 64px top bar | fluid scrollable content.
 * User data is sourced directly from the auth store — no need to pass down.
 */
function AdminShell({
  children,
  pageTitle,
  showSearch = true,
  notificationCount,
  className,
}: AdminShellProps) {
  return (
    <div
      data-slot="admin-shell"
      className={cn('flex h-screen bg-background overflow-hidden', className)}
    >
      <AdminSidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AdminTopbar
          title={pageTitle}
          showSearch={showSearch}
          notificationCount={notificationCount}
        />
        <main
          data-slot="admin-content"
          className="flex-1 overflow-y-auto p-6"
          id="admin-main-content"
        >
          {children}
        </main>
      </div>
    </div>
  )
}

export { AdminShell }
