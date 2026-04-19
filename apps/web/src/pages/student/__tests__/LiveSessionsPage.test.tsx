// Sprint 4 Story 21 — LiveSessionsPage tests.
//
// Coverage
// --------
//   T1. formatSessionDateTime produces a Fri-style date + HH:MM AM/PM time +
//       a non-empty zone string. We don't assert a specific TZ because the
//       value depends on the CI runner's timezone, but we pin `Date.now()`
//       via a fixed ISO string so the date/time parts are stable.
//   T2. in-progress badge appears for a session whose start is in the past
//       and whose end is in the future (computed from durationMinutes).
//   T3. upcoming and past badges appear for sessions on either side of now.
//   T4. canJoin=false (enrollment not PAID): Join button is replaced with the
//       locked variant, and the payment alert banner renders with a CTA.
//   T5. canJoin=true (enrollment PAID): Join button is active and opens the
//       Zoom URL when clicked.
//
// Strategy
// --------
// - We mock `../../lib/api` so the tests don't try to hit a real backend.
//   The page does Promise.allSettled on two helpers, so both mocks need to
//   resolve for the happy path.
// - `useFakeTimers` + a fixed system time gives computeSessionPhase a stable
//   "now", which is the only way to deterministically produce LIVE vs
//   UPCOMING vs PAST without threading a clock through the page.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

// ── Module-level mocks ────────────────────────────────────────────────────

vi.mock('../../../lib/api', () => ({
  fetchLiveSessions: vi.fn(),
  fetchStudentEnrollmentStatus: vi.fn(),
}))

import LiveSessionsPage from '../LiveSessionsPage'
import { fetchLiveSessions, fetchStudentEnrollmentStatus } from '../../../lib/api'
import { formatSessionDateTime, computeSessionPhase } from '../../../lib/date'

const SLUG = 'ai-builder-101'

// Pin "now" so LIVE / UPCOMING / PAST partitioning is deterministic.
// 2025-02-07 14:30:00 UTC — picking a weekday Friday so the weekday label
// renders as "Fri" regardless of the runner's zone (UTC-ish runners will see
// Fri Feb 7; -8 runners will still see Fri, just earlier in the day).
const NOW_MS = new Date('2025-02-07T14:30:00Z').getTime()

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<{
  id: string
  title: string
  description: string
  scheduledAt: string
  durationMinutes: number
  zoomUrl: string
  recordingUrl: string
  status: 'LIVE' | 'UPCOMING' | 'PAST'
}> = {}) {
  return {
    id:              'sess-1',
    title:           'Session One',
    description:     'Intro session',
    scheduledAt:     new Date(NOW_MS + 60 * 60 * 1000).toISOString(), // +1h
    durationMinutes: 60,
    zoomUrl:         'https://zoom.us/j/1234567890',
    status:          'UPCOMING' as const,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/student/course/${SLUG}/sessions`]}>
      <Routes>
        <Route
          path="/student/course/:slug/sessions"
          element={<LiveSessionsPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Only fake Date — fake timers break the `await Promise.allSettled` call
  // in the page because setTimeout-based microtask flushes never fire. We
  // pin Date so computeSessionPhase is deterministic while leaving
  // setTimeout / queueMicrotask real so waitFor can actually poll.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW_MS)
  ;(fetchLiveSessions as ReturnType<typeof vi.fn>).mockReset()
  ;(fetchStudentEnrollmentStatus as ReturnType<typeof vi.fn>).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── T1. Pure formatter ────────────────────────────────────────────────────

describe('formatSessionDateTime', () => {
  it('returns date, time, and a non-empty zone string', () => {
    const iso = new Date(NOW_MS).toISOString()
    const { date, time, zone } = formatSessionDateTime(iso)

    // date includes the weekday and year — don't assert the exact day number
    // because the runner's offset could push it forward or back.
    expect(date).toMatch(/\d{4}/)                 // has the year
    expect(date).toMatch(/,/)                     // contains a comma separator
    // time looks like "2:00 PM" or "14:00" depending on locale of undefined
    // — with `hour12: true` it's an AM/PM marker.
    expect(time).toMatch(/AM|PM/i)
    expect(zone.length).toBeGreaterThan(0)
  })
})

// ── T2. In-progress badge ─────────────────────────────────────────────────

describe('<LiveSessionsPage>', () => {
  it('renders the Live now badge for an in-progress session', async () => {
    const live = makeSession({
      id:              'sess-live',
      title:           'Ongoing lecture',
      // Started 10 minutes ago, 60 min duration → still live for another 50.
      scheduledAt:     new Date(NOW_MS - 10 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      status:          'LIVE',
    })
    ;(fetchLiveSessions as ReturnType<typeof vi.fn>).mockResolvedValue({ sessions: [live] })
    ;(fetchStudentEnrollmentStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      paymentStatus: 'PAID', status: 'ACTIVE',
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('phase-badge-live')).toBeInTheDocument()
    })
    expect(screen.getByTestId('phase-badge-live')).toHaveTextContent(/live now/i)
  })

  it('renders an Upcoming badge for a future session', async () => {
    const upcoming = makeSession({
      id:          'sess-up',
      scheduledAt: new Date(NOW_MS + 2 * 60 * 60 * 1000).toISOString(), // +2h
      status:      'UPCOMING',
    })
    ;(fetchLiveSessions as ReturnType<typeof vi.fn>).mockResolvedValue({ sessions: [upcoming] })
    ;(fetchStudentEnrollmentStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      paymentStatus: 'PAID', status: 'ACTIVE',
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('phase-badge-upcoming')).toBeInTheDocument()
    })
  })

  it('renders a Past badge for a session that has already ended', async () => {
    const past = makeSession({
      id:              'sess-past',
      title:           'Old session',
      scheduledAt:     new Date(NOW_MS - 3 * 60 * 60 * 1000).toISOString(), // -3h
      durationMinutes: 60,
      status:          'PAST',
      recordingUrl:    undefined,
      zoomUrl:         undefined,
    })
    ;(fetchLiveSessions as ReturnType<typeof vi.fn>).mockResolvedValue({ sessions: [past] })
    ;(fetchStudentEnrollmentStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      paymentStatus: 'PAID', status: 'ACTIVE',
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('phase-badge-past')).toBeInTheDocument()
    })
  })

  // ── T4. Not paid → locked UI + payment banner ──────────────────────────

  it('hides the Join button and shows the payment banner when not PAID', async () => {
    const live = makeSession({
      id:              'sess-live',
      scheduledAt:     new Date(NOW_MS - 10 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      status:          'LIVE',
    })
    ;(fetchLiveSessions as ReturnType<typeof vi.fn>).mockResolvedValue({ sessions: [live] })
    ;(fetchStudentEnrollmentStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      paymentStatus: 'PENDING', status: 'ACTIVE',
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('payment-gate-alert')).toBeInTheDocument()
    })
    // The locked Join button renders in place of the active Zoom CTA.
    expect(screen.getByTestId('locked-join-button')).toBeInTheDocument()
    expect(screen.queryByTestId('join-zoom-button')).not.toBeInTheDocument()
    // Alert CTA reads "Complete payment".
    expect(screen.getByRole('button', { name: /complete payment/i })).toBeInTheDocument()
  })

  // ── T5. Paid → active Join button opens Zoom URL ───────────────────────

  it('shows an active Join button that opens the Zoom URL when PAID', async () => {
    const live = makeSession({
      id:              'sess-live',
      scheduledAt:     new Date(NOW_MS - 10 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      zoomUrl:         'https://zoom.us/j/9999999999',
      status:          'LIVE',
    })
    ;(fetchLiveSessions as ReturnType<typeof vi.fn>).mockResolvedValue({ sessions: [live] })
    ;(fetchStudentEnrollmentStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      paymentStatus: 'PAID', status: 'ACTIVE',
    })

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    renderPage()

    const joinBtn = await screen.findByTestId('join-zoom-button')
    expect(joinBtn).toBeEnabled()
    expect(screen.queryByTestId('locked-join-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('payment-gate-alert')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(joinBtn)
    })

    expect(openSpy).toHaveBeenCalledWith(
      'https://zoom.us/j/9999999999',
      '_blank',
      'noopener,noreferrer',
    )
    openSpy.mockRestore()
  })
})

// ── Bonus: computeSessionPhase unit coverage ──────────────────────────────

describe('computeSessionPhase', () => {
  it('classifies LIVE, UPCOMING, and PAST based on start + duration', () => {
    expect(computeSessionPhase(new Date(NOW_MS + 10_000).toISOString(), 60, NOW_MS)).toBe('UPCOMING')
    expect(computeSessionPhase(new Date(NOW_MS - 10_000).toISOString(), 60, NOW_MS)).toBe('LIVE')
    expect(computeSessionPhase(new Date(NOW_MS - 2 * 60 * 60 * 1000).toISOString(), 30, NOW_MS)).toBe('PAST')
  })
})
