// FIR-169 — Full notifications page with mark-all-read and empty state
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { TopNav } from '../../components/TopNav'
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

function typeIcon(type: string): string {
  switch (type) {
    case 'enrollment_confirmed': return '🎓'
    case 'payment_approved': return '✅'
    case 're_engagement': return '⚡'
    case 'broadcast': return '📢'
    default: return '🔔'
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'enrollment_confirmed': return 'Enrollment'
    case 'payment_approved': return 'Payment'
    case 're_engagement': return 'Re-engagement'
    case 'broadcast': return 'Announcement'
    default: return 'Notification'
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

  function handleClick() {
    if (!isRead) onRead(_id)
  }

  const inner = (
    <div
      className={cn(
        'flex items-start gap-4 p-5 rounded-[16px] border transition-all cursor-pointer',
        isRead
          ? 'bg-white border-[rgba(26,39,68,0.08)] hover:border-[rgba(26,39,68,0.15)]'
          : 'bg-[#f0f7ff] border-[#4a9ad4]/20 hover:border-[#4a9ad4]/40',
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      aria-label={`${isRead ? '' : 'Unread: '}${title}`}
    >
      {/* Type icon */}
      <div
        className={cn(
          'w-11 h-11 rounded-[12px] flex items-center justify-center text-[22px] flex-shrink-0',
          isRead ? 'bg-[#f0f0f0]' : 'bg-[#eef6fd]',
        )}
        aria-hidden="true"
      >
        {typeIcon(type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn(
              'text-[15px] text-[#1a2744] leading-snug',
              !isRead ? 'font-[700]' : 'font-[600]',
            )}>
              {title}
            </p>
            <span className={cn(
              'text-[11px] font-[600] px-[8px] py-[2px] rounded-full',
              isRead ? 'bg-[#f0f0f0] text-[#717182]' : 'bg-[#4a9ad4]/10 text-[#4a9ad4]',
            )}>
              {typeLabel(type)}
            </span>
          </div>
          {!isRead && (
            <div
              className="w-2.5 h-2.5 rounded-full bg-[#4a9ad4] flex-shrink-0 mt-1"
              aria-label="Unread"
            />
          )}
        </div>
        <p className="text-[14px] text-[#717182] leading-relaxed mb-2">{body}</p>
        <p className="text-[12px] text-[#a3a3a3]">{relativeTime(createdAt)}</p>
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
// Skeleton
// ---------------------------------------------------------------------------

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-4 p-5 rounded-[16px] bg-white border border-[rgba(26,39,68,0.08)] animate-pulse">
      <div className="w-11 h-11 rounded-[12px] bg-[#e8ecf4] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-[#e8ecf4] rounded-full w-3/5" />
        <div className="h-3 bg-[#e8ecf4] rounded-full w-full" />
        <div className="h-3 bg-[#e8ecf4] rounded-full w-2/3" />
        <div className="h-2.5 bg-[#e8ecf4] rounded-full w-1/4 mt-1" />
      </div>
    </div>
  )
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
    <div className="min-h-screen bg-[#f8f9fb]">
      <TopNav />

      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Back link + header */}
        <div className="mb-6">
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-[13px] font-[600] text-[#717182] hover:text-[#1a2744] no-underline mb-4 transition-colors"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to Dashboard
          </Link>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-[28px] sm:text-[32px] font-[800] text-[#1a2744] leading-tight">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <p className="text-[14px] text-[#717182] mt-1">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                disabled={isMarkingAll}
                className={cn(
                  'flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-[700]',
                  'bg-[#1a2744] text-white hover:opacity-90 transition-opacity',
                  'disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer',
                )}
              >
                {isMarkingAll ? 'Marking…' : 'Mark all read'}
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-[#fdeaeb] text-[#d03238] text-[14px] font-[600] rounded-[12px] px-4 py-3">
            Failed to load notifications. Please try again.
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <>
              <NotificationSkeleton />
              <NotificationSkeleton />
              <NotificationSkeleton />
              <NotificationSkeleton />
            </>
          ) : notifications.length === 0 ? (
            // Empty state
            <div className="bg-white rounded-[20px] border border-[rgba(26,39,68,0.08)] py-20 text-center">
              <div className="text-[56px] mb-4">🔔</div>
              <h2 className="text-[20px] font-[700] text-[#1a2744] mb-2">
                You're all caught up!
              </h2>
              <p className="text-[15px] text-[#717182]">
                No notifications right now. Check back later.
              </p>
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
