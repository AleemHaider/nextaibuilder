// FIR-169 — Bell icon with unread badge and dropdown panel
// Sprint 3 Story 14 — Wise theme: the bell pill now sits on a mint chip and
// lights up lime-on-dark when the dropdown is open. Unread badge uses the
// Wise danger token instead of the legacy raw #d03238.
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { NotificationDropdown } from './NotificationDropdown'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// NotificationBell
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, markOneRead, markAllRead, isMarkingAll } =
    useNotifications()

  // Badge label: show "9+" if count exceeds 9
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative w-9 h-9 rounded-full flex items-center justify-center',
          'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-warm)]',
          'hover:bg-[var(--color-wise-mint)] hover:text-[var(--color-wise-primary-text)]',
          'transition-colors cursor-pointer',
          open && 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
        )}
      >
        <Bell size={16} aria-hidden="true" />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-[4px]',
              'bg-[var(--color-wise-danger)] text-white text-[10px] font-[800]',
              'rounded-full flex items-center justify-center leading-none',
            )}
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          notifications={notifications}
          isMarkingAll={isMarkingAll}
          onMarkAllRead={markAllRead}
          onMarkOneRead={markOneRead}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
