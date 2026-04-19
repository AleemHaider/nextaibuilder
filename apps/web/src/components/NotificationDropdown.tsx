// FIR-169 — Notification dropdown panel (max 5 items, mark all read, view all link)
// Sprint 3 Story 14 — Wise theme migration. Emoji type icons replaced with
// lucide icons; all navy/sky palette hex values swapped for Wise tokens.
import { useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { Award, Bell, GraduationCap, Megaphone, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Notification } from '../lib/api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Lucide mapping for notification types. Keeps icons consistent with the
// rest of Wave 6 instead of coloured emoji that look out-of-palette on the
// Wise canvas.
const TYPE_ICON: Record<string, LucideIcon> = {
  enrollment_confirmed: GraduationCap,
  payment_approved: Award,
  re_engagement: Zap,
  broadcast: Megaphone,
}

function TypeIcon({ type }: { type: string }) {
  const Icon = TYPE_ICON[type] ?? Bell
  return (
    <Icon
      size={16}
      strokeWidth={2.25}
      className="text-[var(--color-wise-primary-text)]"
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// NotificationItem
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notification: Notification
  onRead: (id: string) => void
}

function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const { _id, title, body, isRead, createdAt, type, link } = notification

  function handleClick() {
    if (!isRead) onRead(_id)
  }

  const content = (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b border-[var(--color-wise-ring)]',
        'transition-colors hover:bg-[var(--color-wise-canvas)] cursor-pointer',
        !isRead && 'bg-[var(--color-wise-mint)]/40',
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
    >
      {/* Unread dot */}
      <div className="flex-shrink-0 mt-1.5">
        {!isRead ? (
          <div className="w-2 h-2 rounded-full bg-[var(--color-wise-primary)]" aria-label="Unread" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-transparent" aria-hidden="true" />
        )}
      </div>

      {/* Icon — lucide replacement for emoji */}
      <div
        className={cn(
          'flex-shrink-0 mt-0.5 flex items-center justify-center',
          'w-7 h-7 rounded-full bg-[var(--color-wise-mint)]',
        )}
      >
        <TypeIcon type={type} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[13px] text-[var(--color-wise-text)] leading-snug mb-0.5',
          !isRead ? 'font-[700]' : 'font-[500]',
        )}>
          {title}
        </p>
        <p className="text-[12px] text-[var(--color-wise-text-muted)] leading-snug line-clamp-2">
          {body}
        </p>
        <p className="text-[11px] text-[var(--color-wise-text-muted)] mt-1 opacity-80">
          {relativeTime(createdAt)}
        </p>
      </div>
    </div>
  )

  if (link) {
    return (
      <Link to={link} className="block no-underline" onClick={handleClick}>
        {content}
      </Link>
    )
  }

  return content
}

// ---------------------------------------------------------------------------
// NotificationDropdown
// ---------------------------------------------------------------------------

interface NotificationDropdownProps {
  notifications: Notification[]
  isMarkingAll: boolean
  onMarkAllRead: () => void
  onMarkOneRead: (id: string) => void
  onClose: () => void
}

export function NotificationDropdown({
  notifications,
  isMarkingAll,
  onMarkAllRead,
  onMarkOneRead,
  onClose,
}: NotificationDropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const preview = notifications.slice(0, 5)
  const hasUnread = notifications.some((n) => !n.isRead)

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className={cn(
        'absolute right-0 top-[calc(100%+8px)] w-[360px]',
        'bg-white rounded-[var(--radius-md)] overflow-hidden z-50',
        'shadow-[var(--shadow-card)]',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--color-wise-ring)]">
        <h2 className="text-[15px] font-[800] text-[var(--color-wise-text)]">Notifications</h2>
        {hasUnread && (
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={isMarkingAll}
            className={cn(
              'text-[12px] font-[700] text-[var(--color-wise-primary-text)]',
              'hover:underline transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'bg-transparent border-none cursor-pointer',
            )}
          >
            {isMarkingAll ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Items */}
      <div className="max-h-[380px] overflow-y-auto">
        {preview.length === 0 ? (
          <div className="py-10 text-center text-[14px] text-[var(--color-wise-text-muted)] flex flex-col items-center gap-2">
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                'bg-[var(--color-wise-mint)]',
              )}
            >
              <Bell
                size={22}
                strokeWidth={2}
                className="text-[var(--color-wise-primary-text)]"
                aria-hidden="true"
              />
            </div>
            You're all caught up!
          </div>
        ) : (
          preview.map((n) => (
            <NotificationItem
              key={n._id}
              notification={n}
              onRead={onMarkOneRead}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-3 border-t border-[var(--color-wise-ring)] text-center">
          <Link
            to="/student/notifications"
            onClick={onClose}
            className={cn(
              'text-[13px] font-[700] text-[var(--color-wise-primary-text)]',
              'hover:underline transition-colors no-underline',
            )}
          >
            View all notifications →
          </Link>
        </div>
      )}
    </div>
  )
}
