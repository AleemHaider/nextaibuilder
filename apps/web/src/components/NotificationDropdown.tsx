// FIR-169 — Notification dropdown panel (max 5 items, mark all read, view all link)
import { useRef, useEffect } from 'react'
import { Link } from 'react-router'
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

function typeIcon(type: string): string {
  switch (type) {
    case 'enrollment_confirmed': return '🎓'
    case 'payment_approved': return '✅'
    case 're_engagement': return '⚡'
    case 'broadcast': return '📢'
    default: return '🔔'
  }
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
        'flex items-start gap-3 px-4 py-3 border-b border-[rgba(26,39,68,0.06)]',
        'transition-colors hover:bg-[#f8f9fb] cursor-pointer',
        !isRead && 'bg-[#f0f7ff]',
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
    >
      {/* Unread dot */}
      <div className="flex-shrink-0 mt-1.5">
        {!isRead ? (
          <div className="w-2 h-2 rounded-full bg-[#4a9ad4]" aria-label="Unread" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-transparent" aria-hidden="true" />
        )}
      </div>

      {/* Icon */}
      <div className="text-[18px] flex-shrink-0 leading-none mt-0.5">
        {typeIcon(type)}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[13px] text-[#1a2744] leading-snug mb-0.5',
          !isRead ? 'font-[700]' : 'font-[500]',
        )}>
          {title}
        </p>
        <p className="text-[12px] text-[#717182] leading-snug line-clamp-2">{body}</p>
        <p className="text-[11px] text-[#a3a3a3] mt-1">{relativeTime(createdAt)}</p>
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
        'bg-white rounded-[20px] overflow-hidden z-50',
        'shadow-[0_8px_40px_rgba(26,39,68,0.18),0_0_0_1px_rgba(26,39,68,0.08)]',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[rgba(26,39,68,0.08)]">
        <h2 className="text-[15px] font-[800] text-[#1a2744]">Notifications</h2>
        {hasUnread && (
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={isMarkingAll}
            className={cn(
              'text-[12px] font-[700] text-[#4a9ad4] hover:text-[#1a2744] transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer',
            )}
          >
            {isMarkingAll ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Items */}
      <div className="max-h-[380px] overflow-y-auto">
        {preview.length === 0 ? (
          <div className="py-10 text-center text-[14px] text-[#717182]">
            <div className="text-[32px] mb-2">🔔</div>
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
        <div className="px-4 py-3 border-t border-[rgba(26,39,68,0.08)] text-center">
          <Link
            to="/student/notifications"
            onClick={onClose}
            className={cn(
              'text-[13px] font-[700] text-[#4a9ad4]',
              'hover:text-[#1a2744] transition-colors no-underline',
            )}
          >
            View all notifications →
          </Link>
        </div>
      )}
    </div>
  )
}
