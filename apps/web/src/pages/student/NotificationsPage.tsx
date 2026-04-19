// FIR-169 — Full notifications page with mark-all-read and empty state
// Sprint 3 Story 15 — Wise theme migration. Rows ride on Wise surface tokens
// with lucide type-icons; the mark-all-read CTA is a ghost <Button>.
// Sprint 4 Story 20 — per-row delete + "Delete all read" CTA wired to the
// new useNotifications().deleteNotification / deleteAllRead mutations. Both
// actions are gated behind a <ConfirmDialog variant="danger"> to match the
// Wave 6 destructive-action pattern.
import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  Bell,
  BellOff,
  GraduationCap,
  CircleCheck,
  Zap,
  Megaphone,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { TopNav } from '../../components/TopNav'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
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
  onRead:   (id: string) => void
  onDelete: (id: string) => void
}

function NotificationRow({ notification, onRead, onDelete }: NotificationRowProps) {
  const { _id, title, body, isRead, createdAt, type, link } = notification
  const Icon = typeIcon(type)

  function handleClick() {
    if (!isRead) onRead(_id)
  }

  function handleDeleteClick(e: React.MouseEvent) {
    // The row itself is a link/button — stop the click so the delete action
    // doesn't also navigate to the deep link or mark the row read.
    e.preventDefault()
    e.stopPropagation()
    onDelete(_id)
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
          <div className="flex items-center gap-2 shrink-0">
            {!isRead && (
              <div
                className="w-2.5 h-2.5 rounded-full bg-[var(--color-wise-primary)] mt-1"
                aria-label="Unread"
              />
            )}
            {/* Sprint 4 Story 20 — per-row trash icon. Ghost so it doesn't
                compete with the unread dot; aria-label is descriptive so
                screen readers announce "Delete notification: <title>". */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full"
              aria-label={`Delete notification: ${title}`}
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
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
    deleteNotification,
    deleteAllRead,
    isDeletingAllRead,
  } = useNotifications()

  // Which notification the user is currently staring down the "are you sure"
  // dialog for. `null` when no dialog is open. We keep this as { id, title }
  // so the dialog description can reference the row by name.
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const readCount = notifications.filter((n) => n.isRead).length

  async function handleConfirmDeleteOne() {
    if (!pendingDelete) return
    await deleteNotification(pendingDelete.id)
    setPendingDelete(null)
  }

  async function handleConfirmDeleteAllRead() {
    await deleteAllRead()
  }

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

            <div className="flex items-center gap-2">
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
              {readCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  disabled={isDeletingAllRead}
                >
                  Delete all read
                </Button>
              )}
            </div>
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
                onDelete={(id) => setPendingDelete({ id, title: n.title })}
              />
            ))
          )}
        </div>
      </main>

      {/* Sprint 4 Story 20 — per-row delete confirm dialog. `pendingDelete`
          is the single source of truth for which row's delete is pending.
          Dialog is mounted unconditionally so Radix's focus-trap animation
          lands cleanly; `open` flips when a trash button is clicked. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
        title="Delete notification?"
        description="This can't be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDeleteOne}
      />

      {/* Sprint 4 Story 20 — bulk "delete all read" confirm dialog. */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete all read notifications?"
        description={`${readCount} read notification${readCount !== 1 ? 's' : ''} will be permanently removed. Unread notifications are kept.`}
        confirmLabel="Delete all read"
        variant="danger"
        isLoading={isDeletingAllRead}
        onConfirm={handleConfirmDeleteAllRead}
      />
    </div>
  )
}
