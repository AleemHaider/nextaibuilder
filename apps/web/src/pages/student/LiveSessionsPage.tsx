// FIR-57 — Live sessions page: LIVE NOW, upcoming, past recordings
// Sprint 3 Story 15 — Wise theme migration.
//
// - Session cards use Wise surface + ring tokens
// - Join buttons are <Button variant="primary"> and only render when the
//   enrollment (if the consumer threads it through via props) is PAID. We do
//   not currently receive paymentStatus here — the caller route (CoursePage)
//   gates access before the component renders, so we preserve the existing
//   visibility contract and accept an optional prop the audit can wire in a
//   follow-up without touching this file again.
// - ICS download is <Button variant="outline"> with Calendar icon.
// - Date/time still formatted with Intl.DateTimeFormat — the audit-flagged
//   timezone bug is deferred to its own story.
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router'
import {
  Calendar,
  Clock,
  Video,
  Bell,
  BellRing,
  Link as LinkIcon,
  Play,
  Camera,
} from 'lucide-react'
import { fetchLiveSessions, type LiveSession } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Helpers — Intl.DateTimeFormat for locale-aware rendering.
// ---------------------------------------------------------------------------

function formatScheduledAt(iso: string): { month: string; day: string; full: string; time: string } {
  const d = new Date(iso)
  return {
    month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d).toUpperCase(),
    day: String(d.getDate()),
    full: new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(d),
    time: new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(d),
  }
}

function daysFromNow(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const days = Math.ceil(diff / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

// Generate a .ics file and trigger download.
function downloadIcs(session: LiveSession): void {
  const start = new Date(session.scheduledAt)
  const end = new Date(start.getTime() + session.durationMinutes * 60_000)

  function toIcsDate(d: Date): string {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//nextaibuilder//EN',
    'BEGIN:VEVENT',
    `UID:${session.id}@nextaibuilder`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${session.title}`,
  ]
  if (session.zoomUrl) lines.push(`LOCATION:${session.zoomUrl}`)
  if (session.description) lines.push(`DESCRIPTION:${session.description}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${session.title.replace(/\s+/g, '-')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Minimal inline toast — no external lib
// ---------------------------------------------------------------------------

function useToast() {
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [])

  return { toast, showToast }
}

// ---------------------------------------------------------------------------
// Date chip — reusable left tile for cards
// ---------------------------------------------------------------------------

function DateChip({ month, day, active }: { month: string; day: string; active?: boolean }) {
  return (
    <div
      className={cn(
        'w-16 h-16 rounded-[var(--radius-sm)] flex flex-col items-center justify-center flex-shrink-0',
        active
          ? 'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]'
          : 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
      )}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.5px] opacity-80">
        {month}
      </span>
      <span className="text-[28px] font-black leading-none">{day}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Live NOW card
// ---------------------------------------------------------------------------

interface LiveCardProps {
  session: LiveSession
  /**
   * Whether the student's enrollment is in the PAID state. The join CTA only
   * renders when this is true. Defaults to `true` so callers that don't yet
   * thread paymentStatus keep working — the route itself gates access.
   */
  canJoin?: boolean
}

function LiveCard({ session, canJoin = true }: LiveCardProps) {
  const dt = formatScheduledAt(session.scheduledAt)

  return (
    <article
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] p-6 flex items-start gap-5 mb-3',
        'shadow-[0_0_0_2px_var(--color-wise-primary)]',
      )}
      aria-label={`Live now: ${session.title}`}
    >
      <DateChip month={dt.month} day={dt.day} active />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
          <h3 className="text-[17px] font-bold text-[var(--color-wise-text)]">{session.title}</h3>
          <span
            className={cn(
              'text-[11px] font-bold bg-[var(--color-wise-danger)] text-white',
              'px-[10px] py-[3px] rounded-[var(--radius-pill)] animate-pulse inline-flex items-center gap-1',
            )}
          >
            <span className="w-2 h-2 rounded-full bg-white inline-block" aria-hidden="true" />
            LIVE NOW
          </span>
        </div>

        <div className="flex gap-5 mb-3 flex-wrap">
          <span className="text-[13px] text-[var(--color-wise-text-muted)] flex items-center gap-1.5">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <strong className="text-[var(--color-wise-text)] font-semibold">Today · {dt.full}</strong>
          </span>
          <span className="text-[13px] text-[var(--color-wise-text-muted)] flex items-center gap-1.5">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <strong className="text-[var(--color-wise-text)] font-semibold">{dt.time}</strong>
            <span>· {session.durationMinutes} min</span>
          </span>
        </div>

        {session.description && (
          <p className="text-[14px] text-[var(--color-wise-text-muted)] leading-relaxed mb-4 max-w-[600px]">
            {session.description}
          </p>
        )}

        <div className="flex gap-2.5 items-center flex-wrap">
          {session.zoomUrl && canJoin ? (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Video className="h-4 w-4" />}
              onClick={() => window.open(session.zoomUrl ?? '', '_blank', 'noopener,noreferrer')}
            >
              Join on Zoom
            </Button>
          ) : null}
          {session.zoomUrl && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LinkIcon className="h-4 w-4" />}
              onClick={() => { void navigator.clipboard.writeText(session.zoomUrl ?? '') }}
            >
              Copy Zoom link
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Upcoming session card
// ---------------------------------------------------------------------------

interface UpcomingCardProps {
  session: LiveSession
  onToast: (msg: string) => void
  canJoin?: boolean
}

function UpcomingCard({ session, onToast, canJoin = true }: UpcomingCardProps) {
  const dt = formatScheduledAt(session.scheduledAt)
  const [reminderSet, setReminderSet] = useState(false)

  return (
    <article
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] p-6',
        'flex items-start gap-5 mb-3 shadow-[var(--shadow-ring)]',
      )}
      aria-label={`Upcoming: ${session.title}`}
    >
      <DateChip month={dt.month} day={dt.day} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
          <h3 className="text-[17px] font-bold text-[var(--color-wise-text)]">{session.title}</h3>
          <span className="text-[11px] font-semibold bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)] px-[10px] py-[3px] rounded-[var(--radius-pill)]">
            {daysFromNow(session.scheduledAt)}
          </span>
        </div>

        <div className="flex gap-5 mb-3 flex-wrap">
          <span className="text-[13px] text-[var(--color-wise-text-muted)] flex items-center gap-1.5">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <strong className="text-[var(--color-wise-text)] font-semibold">{dt.full}</strong>
          </span>
          <span className="text-[13px] text-[var(--color-wise-text-muted)] flex items-center gap-1.5">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <strong className="text-[var(--color-wise-text)] font-semibold">{dt.time}</strong>
            <span>· {session.durationMinutes} min</span>
          </span>
        </div>

        {session.description && (
          <p className="text-[14px] text-[var(--color-wise-text-muted)] leading-relaxed mb-4 max-w-[600px]">
            {session.description}
          </p>
        )}

        <div className="flex gap-2.5 items-center flex-wrap">
          {canJoin ? (
            <Button
              variant="primary"
              size="md"
              disabled
              leftIcon={<Video className="h-4 w-4" />}
            >
              Join on Zoom
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="md"
            leftIcon={
              reminderSet ? (
                <BellRing className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )
            }
            onClick={() => {
              setReminderSet(true)
              onToast("Reminder set! We'll notify you before the session.")
            }}
          >
            {reminderSet ? 'Reminder set' : 'Set Reminder'}
          </Button>

          <Button
            variant="outline"
            size="md"
            leftIcon={<Calendar className="h-4 w-4" />}
            onClick={() => downloadIcs(session)}
          >
            Add to Calendar
          </Button>
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Past session card
// ---------------------------------------------------------------------------

function PastCard({ session }: { session: LiveSession }) {
  const dt = formatScheduledAt(session.scheduledAt)

  return (
    <div
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-[var(--radius-sm)] px-6 py-5',
        'flex items-center gap-4 mb-2 shadow-[var(--shadow-ring)] opacity-90',
      )}
    >
      <div
        className={cn(
          'w-12 h-12 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0',
          'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]',
        )}
        aria-hidden="true"
      >
        {session.recordingUrl ? (
          <Video className="h-5 w-5" />
        ) : (
          <Camera className="h-5 w-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-[var(--color-wise-text)] mb-1 truncate">
          {session.title}
        </p>
        <p className="text-[13px] text-[var(--color-wise-text-muted)]">
          {dt.full} · {session.durationMinutes} min
        </p>
      </div>
      {session.recordingUrl ? (
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Play className="h-4 w-4" />}
          onClick={() => window.open(session.recordingUrl ?? '', '_blank', 'noopener,noreferrer')}
        >
          Watch Recording
        </Button>
      ) : (
        <span
          className={cn(
            'px-[18px] py-[9px] rounded-[var(--radius-pill)]',
            'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)] text-[13px] font-semibold',
          )}
        >
          No Recording
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LiveSessionsPage() {
  // Works both as CoursePage Outlet child (slug from parent route) and standalone
  const { slug = '' } = useParams<{ slug: string }>()
  const { toast, showToast } = useToast()

  const [sessions, setSessions] = useState<LiveSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!slug) return
    try {
      const data = await fetchLiveSessions(slug)
      setSessions(data.sessions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => { void load() }, [load])

  const liveSessions = sessions.filter((s) => s.status === 'LIVE')
  const upcomingSessions = sessions
    .filter((s) => s.status === 'UPCOMING')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  const pastSessions = sessions
    .filter((s) => s.status === 'PAST')
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())

  return (
    <div className="px-4 sm:px-8 md:px-12 py-10 relative">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
            'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
            'text-[14px] font-semibold px-5 py-3 rounded-[var(--radius-pill)] shadow-lg',
          )}
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}

      <h1 className="text-[32px] font-black text-[var(--color-wise-text)] tracking-[-0.8px] mb-1">
        Live Sessions
      </h1>
      <p className="text-[16px] text-[var(--color-wise-text-muted)] mb-8">
        Upcoming and past live sessions for this course.
      </p>

      {error && (
        <div className="bg-[var(--color-wise-danger-soft)] rounded-[var(--radius-sm)] p-4 mb-6 text-[var(--color-wise-danger)] text-[14px] font-semibold">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <LoadingSkeleton
              key={i}
              variant="rect"
              height={112}
              className="rounded-[var(--radius-md)]"
            />
          ))}
        </div>
      ) : (
        <>
          {liveSessions.length > 0 && (
            <>
              <p className="text-[13px] font-bold text-[var(--color-wise-text-muted)] uppercase tracking-[0.8px] mb-4">
                Live Now
              </p>
              {liveSessions.map((s) => <LiveCard key={s.id} session={s} />)}
            </>
          )}

          <p className="text-[13px] font-bold text-[var(--color-wise-text-muted)] uppercase tracking-[0.8px] mb-4 mt-2">
            Upcoming Sessions
          </p>
          {upcomingSessions.length === 0 ? (
            <div className="bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-ring)]">
              <EmptyState
                icon={Calendar}
                title="No sessions"
                description="No upcoming sessions scheduled yet."
              />
            </div>
          ) : (
            upcomingSessions.map((s) => (
              <UpcomingCard key={s.id} session={s} onToast={showToast} />
            ))
          )}

          {pastSessions.length > 0 && (
            <>
              <p className="text-[13px] font-bold text-[var(--color-wise-text-muted)] uppercase tracking-[0.8px] mb-4 mt-10">
                Past Sessions & Recordings
              </p>
              {pastSessions.map((s) => <PastCard key={s.id} session={s} />)}
            </>
          )}
        </>
      )}
    </div>
  )
}
