// PBA-384 — Real-time Sonner toasts via Socket.io (notification:new + badge:earned events)
import * as React from 'react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { StudentHeader } from './student-header'
import { cn } from '@/lib/utils'
import { notificationKeys } from '@/hooks/use-notifications'
import { getSocket } from '@/hooks/use-socket'

interface StudentShellProps {
  children: React.ReactNode
  /** Left panel content (280px step navigation panel) */
  stepPanel?: React.ReactNode
  userName?: string
  userAvatar?: string
  userInitials?: string
  cohortName?: string
  cohortStartDate?: string
  cohortDeadline?: string
  className?: string
}

// ── Notification payload shapes ───────────────────────────────────────────────
interface NotificationNewPayload {
  id: string
  type: string
  title: string
  body: string
  linkPath: string | null
  read: boolean
  createdAt: string
}

/**
 * Student portal app shell.
 * Layout: 56px top header | 280px left step panel | fluid content area.
 * Below md (768px): sidebar hidden, single-column layout.
 *
 * PBA-384: Subscribes to socket events on mount and cleans up on unmount:
 *   - notification:new  → Sonner info toast + invalidate notifications query
 *   - badge:earned      → Sonner success toast + invalidate badges query
 */
function StudentShell({
  children,
  stepPanel,
  userName,
  userAvatar,
  userInitials,
  cohortName,
  cohortStartDate,
  cohortDeadline,
  className,
}: StudentShellProps) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = getSocket()

    function handleNotificationNew(payload: NotificationNewPayload) {
      // Show a Sonner toast for the incoming notification
      toast(payload.title, {
        description: payload.body,
      })
      // Invalidate notifications cache so the bell updates
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    }

    function handleBadgeEarned(payload: { badgeName: string }) {
      toast.success(`Badge earned: ${payload.badgeName}`, {
        description: 'Check your achievements page to view it.',
      })
      // Invalidate badges cache
      void queryClient.invalidateQueries({ queryKey: ['student-badges'] })
    }

    function handleProgressReset() {
      // Admin reset this student's progress — wipe the entire React Query cache
      // so every step and the dashboard refetch fresh (post-reset) data.
      void queryClient.invalidateQueries()
    }

    socket.on('notification:new', handleNotificationNew)
    socket.on('badge:earned', handleBadgeEarned)
    socket.on('progress:reset', handleProgressReset)

    return () => {
      socket.off('notification:new', handleNotificationNew)
      socket.off('badge:earned', handleBadgeEarned)
      socket.off('progress:reset', handleProgressReset)
    }
  }, [queryClient])

  return (
    <div data-slot="student-shell" className={cn('flex flex-col h-screen bg-background', className)}>
      <StudentHeader
        userName={userName}
        userAvatar={userAvatar}
        userInitials={userInitials}
        cohortName={cohortName}
        cohortStartDate={cohortStartDate}
        cohortDeadline={cohortDeadline}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Step navigation panel — 280px, #fafbfc bg, hidden below md */}
        {stepPanel && (
          <aside
            data-slot="step-panel"
            className="w-[280px] shrink-0 border-r border-border bg-[#fafbfc] overflow-y-auto hidden md:block"
          >
            {stepPanel}
          </aside>
        )}
        {/* Main content — fluid, white bg; children manage their own scroll */}
        <main
          data-slot="student-content"
          className="flex-1 overflow-y-auto bg-white"
        >
          {children}
        </main>
      </div>
    </div>
  )
}

export { StudentShell }
