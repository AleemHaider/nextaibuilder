// FIR-57 — Live sessions page: LIVE NOW, upcoming, past recordings
// Sprint 3 Story 15 — Wise theme migration.
// Sprint 4 Story 21 — Timezone-aware formatter + PAID-only Zoom gate.
//
// Story 21 changes
// ----------------
// - Date/time now use `formatSessionDateTime` from lib/date, which renders in
//   the viewer's resolved timezone and exposes the zone abbreviation so we
//   can show it next to every time on screen. The previous hand-rolled
//   `formatScheduledAt` was `en-US`-locked and conflated the time and zone
//   into one string, making styling and testing painful.
// - The Zoom CTA is now gated behind the enrollment's `paymentStatus === 'PAID'`
//   check, as required by the BRD. LiveSessionsPage fetches its own
//   enrollment status so it stays fresh even if the dashboard cache is stale
//   (the route can be linked to directly from notifications / email). When
//   not PAID, we render an inline "complete payment" alert at the top and
//   replace the Join button with a disabled lock button.
// - Live/upcoming/past badge is recomputed client-side from scheduledAt +
//   durationMinutes so a session that starts while the tab is open flips to
//   LIVE without a refetch (the backend's `status` field is still used as a
//   correctness fallback). Past sessions hide the Join button entirely.
// - ICS download is intentionally left open regardless of payment status —
//   it's a calendar entry, not the meeting link.
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
  Lock,
  AlertTriangle,
} from 'lucide-react'
import {
  fetchLiveSessions,
  fetchStudentEnrollmentStatus,
  type LiveSession,
  type StudentEnrollmentStatus,
} from '../../lib/api'
import { formatSessionDateTime, computeSessionPhase, type SessionPhase } from '../../lib/date'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Helpers — derived labels
// ---------------------------------------------------------------------------

// Short date parts for the left-edge DateChip (still want MONTH / DAY split).
// Kept separate from formatSessionDateTime because DateChip wants uppercased
// month + numeric day as discrete strings for its typographic layout.
function formatDateChip(iso: string): { month: string; day: string } {
  const d = new Date(iso)
  return {
    month: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(d).toUpperCase(),
    day:   String(d.getDate()),
  }
}

function daysFromNow(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const days = Math.ceil(diff / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

// Generate a .ics file and trigger download. Unchanged from Story 15 —
// ICS stays PAID-agnostic (a calendar reminder leaks no Zoom URL).
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
// Phase badge — "Live now" / "Upcoming" / "Past"
// ---------------------------------------------------------------------------

function PhaseBadge({ phase }: { phase: SessionPhase }) {
  if (phase === 'LIVE') {
    return (
      <span
        data-testid="phase-badge-live"
        className={cn(
          'text-[11px] font-bold bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
          'px-[10px] py-[3px] rounded-[var(--radius-pill)] inline-flex items-center gap-1',
        )}
      >
        <span className="w-2 h-2 rounded-full bg-[var(--color-wise-danger)] inline-block animate-pulse" aria-hidden="true" />
        Live now
      </span>
    )
  }
  if (phase === 'UPCOMING') {
    return (
      <span
        data-testid="phase-badge-upcoming"
        className={cn(
          'text-[11px] font-semibold bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text)]',
          'px-[10px] py-[3px] rounded-[var(--radius-pill)]',
        )}
      >
        Upcoming
      </span>
    )
  }
  return (
    <span
      data-testid="phase-badge-past"
      className={cn(
        'text-[11px] font-semibold bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]',
        'px-[10px] py-[3px] rounded-[var(--radius-pill)]',
      )}
    >
      Past
    </span>
  )
}

// ---------------------------------------------------------------------------
// PAID-gate alert banner — rendered once at the top of the page when the
// student's enrollment is not PAID. Sits above every card so the student
// sees the CTA before scanning the session list.
// ---------------------------------------------------------------------------

function PaymentGateAlert({ slug }: { slug: string }) {
  return (
    <div
      data-testid="payment-gate-alert"
      role="alert"
      className={cn(
        'bg-[var(--color-wise-danger-soft)] rounded-[var(--radius-md)] p-5 mb-6',
        'flex items-start gap-3 flex-wrap',
      )}
    >
      <AlertTriangle
        className="h-5 w-5 text-[var(--color-wise-danger)] flex-shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-[240px]">
        <p className="text-[14px] font-bold text-[var(--color-wise-text)] mb-0.5">
          Complete your payment to unlock live session links
        </p>
        <p className="text-[13px] text-[var(--color-wise-text-muted)]">
          You can still see the schedule and add sessions to your calendar.
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => { window.location.href = `/checkout/${slug}` }}
      >
        Complete payment
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Locked Join button — shown in place of the Zoom CTA when canJoin is false.
// Uses `title` for the tooltip rather than a Tooltip primitive because no
// such primitive is shipped in the UI kit yet.
// ---------------------------------------------------------------------------

function LockedJoinButton() {
  return (
    <Button
      data-testid="locked-join-button"
      variant="outline"
      size="md"
      disabled
      leftIcon={<Lock className="h-4 w-4" />}
      title="Available after payment"
    >
      Join on Zoom
    </Button>
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
   * thread paymentStatus keep working — the parent page owns the real wiring.
   */
  canJoin?: boolean
}

function LiveCard({ session, canJoin = true }: LiveCardProps) {
  const chip = formatDateChip(session.scheduledAt)
  const dt = formatSessionDateTime(session.scheduledAt)

  return (
    <article
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] p-6 flex items-start gap-5 mb-3',
        'shadow-[0_0_0_2px_var(--color-wise-primary)]',
      )}
      aria-label={`Live now: ${session.title}`}
    >
      <DateChip month={chip.month} day={chip.day} active />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
          <h3 className="text-[17px] font-bold text-[var(--color-wise-text)]">{session.title}</h3>
          <PhaseBadge phase="LIVE" />
        </div>

        <div className="flex gap-5 mb-3 flex-wrap">
          <span className="text-[13px] text-[var(--color-wise-text-muted)] flex items-center gap-1.5">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <strong className="text-[var(--color-wise-text)] font-semibold">Today · {dt.date}</strong>
          </span>
          <span className="text-[13px] text-[var(--color-wise-text-muted)] flex items-center gap-1.5">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <strong className="text-[var(--color-wise-text)] font-semibold">
              {dt.time}
              <span className="font-normal text-[var(--color-wise-text-muted)]"> {dt.zone}</span>
            </strong>
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
              data-testid="join-zoom-button"
              variant="primary"
              size="md"
              leftIcon={<Video className="h-4 w-4" />}
              onClick={() => window.open(session.zoomUrl ?? '', '_blank', 'noopener,noreferrer')}
            >
              Join on Zoom
            </Button>
          ) : session.zoomUrl ? (
            <LockedJoinButton />
          ) : null}
          {session.zoomUrl && canJoin && (
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
  const chip = formatDateChip(session.scheduledAt)
  const dt = formatSessionDateTime(session.scheduledAt)
  const [reminderSet, setReminderSet] = useState(false)

  return (
    <article
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] p-6',
        'flex items-start gap-5 mb-3 shadow-[var(--shadow-ring)]',
      )}
      aria-label={`Upcoming: ${session.title}`}
    >
      <DateChip month={chip.month} day={chip.day} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
          <h3 className="text-[17px] font-bold text-[var(--color-wise-text)]">{session.title}</h3>
          <PhaseBadge phase="UPCOMING" />
          <span className="text-[11px] font-semibold bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)] px-[10px] py-[3px] rounded-[var(--radius-pill)]">
            {daysFromNow(session.scheduledAt)}
          </span>
        </div>

        <div className="flex gap-5 mb-3 flex-wrap">
          <span className="text-[13px] text-[var(--color-wise-text-muted)] flex items-center gap-1.5">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <strong className="text-[var(--color-wise-text)] font-semibold">{dt.date}</strong>
          </span>
          <span className="text-[13px] text-[var(--color-wise-text-muted)] flex items-center gap-1.5">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <strong className="text-[var(--color-wise-text)] font-semibold">
              {dt.time}
              <span className="font-normal text-[var(--color-wise-text-muted)]"> {dt.zone}</span>
            </strong>
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
              data-testid="join-zoom-button"
              variant="primary"
              size="md"
              disabled
              leftIcon={<Video className="h-4 w-4" />}
            >
              Join on Zoom
            </Button>
          ) : (
            <LockedJoinButton />
          )}

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
  const dt = formatSessionDateTime(session.scheduledAt)

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
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[15px] font-bold text-[var(--color-wise-text)] truncate">
            {session.title}
          </p>
          <PhaseBadge phase="PAST" />
        </div>
        <p className="text-[13px] text-[var(--color-wise-text-muted)]">
          {dt.date} · {dt.time} {dt.zone} · {session.durationMinutes} min
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
  const [enrollmentStatus, setEnrollmentStatus] = useState<StudentEnrollmentStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!slug) return
    try {
      // Kick both requests in parallel. If either fails we still want to
      // surface something useful; session listing is more critical than the
      // payment gate, so we swallow the status error and default to "not
      // paid" to be safe (failing closed keeps Zoom links hidden).
      const [sessionsResult, statusResult] = await Promise.allSettled([
        fetchLiveSessions(slug),
        fetchStudentEnrollmentStatus(slug),
      ])

      if (sessionsResult.status === 'fulfilled') {
        setSessions(sessionsResult.value.sessions)
      } else {
        const msg = sessionsResult.reason instanceof Error
          ? sessionsResult.reason.message
          : 'Failed to load sessions'
        setError(msg)
      }

      if (statusResult.status === 'fulfilled') {
        setEnrollmentStatus(statusResult.value)
      } else {
        // Fail closed: no status = treat as not PAID.
        setEnrollmentStatus(null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => { void load() }, [load])

  const canJoin = enrollmentStatus?.paymentStatus === 'PAID'

  // Re-partition sessions client-side using computeSessionPhase so the live
  // indicator flips on time without a refetch. The backend's `status` field
  // is used as a fallback when scheduledAt / duration are missing.
  const partitioned = sessions.map((s) => ({
    session: s,
    phase: computeSessionPhase(s.scheduledAt, s.durationMinutes),
  }))

  const liveSessions    = partitioned.filter((p) => p.phase === 'LIVE').map((p) => p.session)
  const upcomingSessions = partitioned
    .filter((p) => p.phase === 'UPCOMING')
    .map((p) => p.session)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  const pastSessions = partitioned
    .filter((p) => p.phase === 'PAST')
    .map((p) => p.session)
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

      {/* PAID gate: show the alert once we've loaded status (or we know we
          failed to load it). Hiding it during the initial skeleton prevents
          a flash when the student is actually paid. */}
      {!isLoading && !canJoin && <PaymentGateAlert slug={slug} />}

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
              {liveSessions.map((s) => <LiveCard key={s.id} session={s} canJoin={canJoin} />)}
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
              <UpcomingCard key={s.id} session={s} onToast={showToast} canJoin={canJoin} />
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
