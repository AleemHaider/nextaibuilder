// FIR-169 — Full notifications page with mark-all-read and empty state
// Sprint 3 Story 15 — Wise theme migration. Rows now ride on Wise surface
// tokens with lucide type-icons; the mark-all-read CTA is a ghost <Button>.
// The empty-state path consolidates onto the canonical <EmptyState>.
//
// NB: the hook does not expose a per-row delete mutation today, so we don't
// render a delete/confirm dialog here — adding that business logic is out of
// scope for a theme migration story. When delete lands in a later sprint it
// should wire through <Button variant="danger"> + <ConfirmDialog>.
import { Link } from 'react-router'
import {
  ArrowLeft,
  Bell,
  BellOff,
  GraduationCap,
  CircleCheck,
  Zap,
  Megaphone,
  type LucideIcon,
} from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { TopNav } from '../../components/TopNav'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListItemSkeleton } from '../../components/ui/LoadingSkeleton'
import { cn } from '../../lib/utils'
import type { Notification } from '../../lib/api'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function typeIcon(type: string): LucideIcon {
  switch (type) {
    case 'enrollment_confirmed': return GraduationCap
    case 'payment_approved':     return CircleCheck
    case 're_engagement':        return Zap
    case 'broadcast':            return Megaphone
    default:                     return Bell
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'enrollment_confirmed': return 'Enrollment'
    case 'payment_approved':     return 'Payment'
    case 're_engagement':        return 'Re-engagement'
    case 'broadcast':            return 'Announcement'
    default:                     return 'Notification'
  }
}

// ---------------------------------------------------------------------------
// NotificationRow
// ---------------------------------------------------------------------------

interface NotificationRowProps {
  notification: Notification
  onRead: (id: string) => void
}

function NotificationRow({ notification, onRead }: NotificationRowProps) {
  const { _id, title, body, isRead, createdAt, type, link } = notification
  const Icon = typeIcon(type)

  function handleClick() {
    if (!isRead) onRead(_id)
  }

  const inner = (
    <div
      className={cn(
        'flex items-start gap-4 p-5 rounded-[var(--radius-md)] border transition-colors cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2',
        isRead
          ? 'bg-[var(--color-wise-surface)] border-[var(--color-wise-ring)] hover:border-[var(--color-wise-ring-strong)]'
          : 'bg-[var(--color-wise-mint)] border-[var(--color-wise-primary)]',
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      aria-label={`${isRead ? '' : 'Unread: '}${title}`}
    >
      {/* Type icon chip — mint surface, primary-text glyph. */}
      <div
        className={cn(
          'w-11 h-11 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0',
          isRead
            ? 'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-warm)]'
            : 'bg-[var(--color-wise-surface)] text-[var(--color-wise-primary-text)]',
        )}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn(
              'text-[15px] text-[var(--color-wise-text)] leading-snug',
              !isRead ? 'font-bold' : 'font-semibold',
            )}>
              {title}
            </p>
            <span className={cn(
              'text-[11px] font-semibold px-[8px] py-[2px] rounded-[var(--radius-pill)]',
              isRead
                ? 'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]'
                : 'bg-[var(--color-wise-surface)] text-[var(--color-wise-primary-text)]',
            )}>
              {typeLabel(type)}
            </span>
          </div>
          {!isRead && (
            <div
              className="w-2.5 h-2.5 rounded-full bg-[var(--color-wise-primary)] flex-shrink-0 mt-1"
              aria-label="Unread"
            />
          )}
        </div>
        <p className="text-[14px] text-[var(--color-wise-text-muted)] leading-relaxed mb-2">{body}</p>
        <p className="text-[12px] text-[var(--color-wise-text-muted)]">{relativeTime(createdAt)}</p>
      </div>
    </div>
  )

  if (link) {
    return (
      <Link to={link} className="block no-underline" onClick={handleClick}>
        {inner}
      </Link>
    )
  }

  return inner
}

// ---------------------------------------------------------------------------
// NotificationsPage
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAllRead,
    markOneRead,
    isMarkingAll,
  } = useNotifications()

  return (
    <div className="min-h-screen bg-[var(--color-wise-canvas)]">
      <TopNav />

      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Back link + header */}
        <div className="mb-6">
          <Link
            to="/student/dashboard"
            className={cn(
              'inline-flex items-center gap-1.5 text-[13px] font-semibold',
              'text-[var(--color-wise-text-muted)] hover:text-[var(--color-wise-text)]',
              'no-underline mb-4 transition-colors',
            )}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to Dashboard
          </Link>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-[28px] sm:text-[32px] font-black text-[var(--color-wise-text)] leading-tight tracking-[-0.5px]">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <p className="text-[14px] text-[var(--color-wise-text-muted)] mt-1">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllRead()}
                isLoading={isMarkingAll}
                disabled={isMarkingAll}
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] text-[14px] font-semibold rounded-[var(--radius-sm)] px-4 py-3">
            Failed to load notifications. Please try again.
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-5 rounded-[var(--radius-md)] bg-[var(--color-wise-surface)] border border-[var(--color-wise-ring)]"
                >
                  <ListItemSkeleton />
                </div>
              ))}
            </>
          ) : notifications.length === 0 ? (
            <div className="bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] border border-[var(--color-wise-ring)]">
              <EmptyState
                icon={BellOff}
                title="You're all caught up!"
                description="No notifications right now. Check back later."
              />
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationRow
                key={n._id}
                notification={n}
                onRead={markOneRead}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}
