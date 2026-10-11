'use client'

// PBA-383 — Student notification bell + inbox dropdown
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  XCircle,
  Award,
  Megaphone,
  AlertTriangle,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Button } from './button'
import { cn } from '@/lib/utils'
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/use-notifications'
import type { NotificationType } from '@/lib/api-client'

// ── Type icon mapping ─────────────────────────────────────────────────────────

function NotificationIcon({ type, className }: { type: NotificationType; className?: string }) {
  switch (type) {
    case 'STEP_APPROVED':
      return <CheckCircle2 className={cn('text-green-500', className)} aria-hidden="true" />
    case 'STEP_REJECTED':
      return <XCircle className={cn('text-destructive', className)} aria-hidden="true" />
    case 'BADGE_EARNED':
      return <Award className={cn('text-amber-500', className)} aria-hidden="true" />
    case 'BROADCAST':
      return <Megaphone className={cn('text-[#4a9ad4]', className)} aria-hidden="true" />
    case 'DEADLINE_WARNING':
      return <AlertTriangle className={cn('text-[#ff8c5a]', className)} aria-hidden="true" />
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface NotificationDropdownProps {
  className?: string
}

function NotificationDropdown({ className }: NotificationDropdownProps) {
  const router = useRouter()
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const notifications = data?.notifications ?? []
  const unreadCount   = data?.unreadCount ?? 0
  const cappedCount   = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : null

  function handleNotificationClick(id: string, linkPath: string | null) {
    markRead.mutate(id)
    if (linkPath) {
      router.push(linkPath)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10 relative"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          >
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            {cappedCount && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-[#ff8c5a] text-white text-[10px] font-bold flex items-center justify-center px-0.5 pointer-events-none"
              >
                {cappedCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-80 p-0"
          sideOffset={8}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <DropdownMenuLabel className="p-0 text-sm font-medium text-foreground">
              Notifications
            </DropdownMenuLabel>
            {unreadCount > 0 && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-[#4a9ad4] hover:text-[#1a2744] transition-colors"
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 cursor-pointer rounded-none border-b border-border/50 last:border-0',
                    !n.read && 'bg-[#4a9ad4]/5',
                  )}
                  onClick={() => handleNotificationClick(n.id, n.linkPath)}
                >
                  {/* Type icon */}
                  <span className="mt-0.5 shrink-0">
                    <NotificationIcon type={n.type} className="h-4 w-4" />
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-snug truncate', !n.read && 'font-medium text-foreground')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                      {n.body}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-2 w-2 rounded-full bg-[#ff8c5a] shrink-0"
                    />
                  )}
                </DropdownMenuItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export { NotificationDropdown }
