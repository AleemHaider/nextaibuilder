// Sprint 4 Story 21 — Shared date/time formatters for live-session surfaces.
//
// Background: LiveSessionsPage historically called `Intl.DateTimeFormat` with
// a hardcoded `'en-US'` locale and relied on implicit timezone inference,
// which meant the zone abbreviation was inconsistent across browsers and the
// output didn't visibly tell the student which timezone the time was in.
// This module centralises the formatting so the UI can show the viewer's
// resolved timezone next to every session (GAP-002 from the Sprint 4 audit).
//
// Kept in its own module (rather than inlined in the page) because:
//   1. It's pure, easy to unit-test, and we plan to reuse it on the
//      dashboard's "next live session" chip (Story 24).
//   2. `Intl.DateTimeFormat` is expensive enough to benefit from being
//      constructed per-call only in the few places that actually need it.

/**
 * Format an ISO 8601 datetime string for display in a live-session card.
 *
 * Returns three separate strings so the caller can lay them out independently
 * (e.g. `date · time zone`) without re-parsing the date. All three parts are
 * in the viewer's resolved timezone — we intentionally do not accept a
 * `timeZone` override, because we have no reliable way to know what the
 * student prefers and browsers already honour the OS setting.
 *
 * @param isoString ISO datetime (as returned by the live-sessions API)
 * @returns `{ date, time, zone }` — date like `Fri, Feb 7, 2025`, time like
 *          `2:00 PM`, zone like `EST` (or the IANA name if the runtime refuses
 *          to give us a short name).
 */
export function formatSessionDateTime(isoString: string): {
  date: string
  time: string
  zone: string
} {
  const d = new Date(isoString)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const date = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    year:    'numeric',
  }).format(d)

  const time = new Intl.DateTimeFormat(undefined, {
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)

  // `timeZoneName: 'short'` yields e.g. `EST`, `GMT+5:30` depending on the
  // runtime. We pull it out via `formatToParts` so we can render it as its
  // own span — inline strings like `"2:00 PM EST"` are harder to style.
  const zoneParts = new Intl.DateTimeFormat(undefined, {
    timeZoneName: 'short',
    hour:         'numeric',
  }).formatToParts(d)
  const zone = zoneParts.find((p) => p.type === 'timeZoneName')?.value ?? tz

  return { date, time, zone }
}

/**
 * Client-side session state indicator. The backend already tags sessions as
 * `LIVE | UPCOMING | PAST`, but that snapshot goes stale the moment a student
 * leaves a tab open. This recomputes it from `scheduledAt` + duration so the
 * badge flips in real time without a refetch.
 */
export type SessionPhase = 'LIVE' | 'UPCOMING' | 'PAST'

export function computeSessionPhase(
  scheduledAt: string,
  durationMinutes: number,
  now: number = Date.now(),
): SessionPhase {
  const start = new Date(scheduledAt).getTime()
  const end   = start + durationMinutes * 60_000
  if (now < start) return 'UPCOMING'
  if (now > end)   return 'PAST'
  return 'LIVE'
}
