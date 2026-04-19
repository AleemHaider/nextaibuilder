// Sprint 2 Story 10 (GAP-030 / GAP-031) — unit tests for EnrollmentSuccessPage.
//
// Scope:
//   - Cohort title is fetched from /storefront/cohorts/by-id/:id (NOT read
//     from a ?cohort= URL param — that's the XSS/spoofing fix)
//   - "Check your email at X" CTA is rendered when the user is logged in
//   - Falls back gracefully when the id is missing or the fetch errors

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  fetchCohortById: vi.fn(),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import EnrollmentSuccessPage from '../EnrollmentSuccessPage'
import { fetchCohortById } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

// ── Helpers ────────────────────────────────────────────────────────────

function renderPage(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/enrollment/success${search}`]}>
      <Routes>
        <Route path="/enrollment/success" element={<EnrollmentSuccessPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function setAuth(
  user: { id: string; email: string; name: string; role: 'STUDENT' } | null,
) {
  ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    user,
    accessToken:     user ? 'token' : null,
    isLoading:       false,
    isAuthenticated: !!user,
    login:           vi.fn(),
    logout:          vi.fn(),
    refreshToken:    vi.fn(),
  })
}

describe('<EnrollmentSuccessPage>', () => {
  beforeEach(() => {
    ;(fetchCohortById as ReturnType<typeof vi.fn>).mockReset()
    ;(useAuth as ReturnType<typeof vi.fn>).mockReset()
    setAuth(null)
  })

  it('fetches the cohort from the API using ?cohortId — NOT the ?cohort URL param', async () => {
    ;(fetchCohortById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id:    '507f1f77bcf86cd799439011',
      title: 'AI Builder 101',
      slug:  'ai-builder-101',
    })

    // Even if an attacker tries to spoof a cohort= query, it's ignored.
    renderPage('?cohortId=507f1f77bcf86cd799439011&cohort=<script>alert(1)</script>')

    const title = await screen.findByTestId('cohort-title')
    expect(title).toHaveTextContent('AI Builder 101')

    expect(fetchCohortById).toHaveBeenCalledWith('507f1f77bcf86cd799439011')

    // The spoofed string is NOT rendered.
    expect(screen.queryByText(/script/i)).toBeNull()
  })

  it('renders the "Check your email at X" CTA with the logged-in user email', async () => {
    ;(fetchCohortById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id:    '507f1f77bcf86cd799439011',
      title: 'AI Builder 101',
      slug:  'ai-builder-101',
    })
    setAuth({
      id:    'u1',
      email: 'student@example.com',
      name:  'Avery Student',
      role:  'STUDENT',
    })

    renderPage('?cohortId=507f1f77bcf86cd799439011')

    const cta = await screen.findByTestId('email-cta')
    expect(cta).toHaveTextContent(/Check your email at/i)
    expect(cta).toHaveTextContent('student@example.com')
  })

  it('renders a generic fallback message when the user is logged out', async () => {
    ;(fetchCohortById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id:    '507f1f77bcf86cd799439011',
      title: 'AI Builder 101',
      slug:  'ai-builder-101',
    })

    renderPage('?cohortId=507f1f77bcf86cd799439011')

    // No specific email was rendered.
    await screen.findByTestId('cohort-title')
    expect(screen.queryByTestId('email-cta')).toBeNull()
    expect(
      screen.getByText(/Check your email for access details/i),
    ).toBeInTheDocument()
  })

  it('falls back to "your course" when no cohortId is present in the URL', async () => {
    renderPage('')
    const title = await screen.findByTestId('cohort-title')
    expect(title).toHaveTextContent('your course')
    // Zero API calls when we have no id.
    expect(fetchCohortById).not.toHaveBeenCalled()
  })

  it('renders the EmptyState error surface when the lookup throws', async () => {
    ;(fetchCohortById as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'))
    renderPage('?cohortId=507f1f77bcf86cd799439011')

    // Still congratulates the student — the enrollment is confirmed even if
    // we can't render the title.
    expect(await screen.findByText(/enrolled!/i)).toBeInTheDocument()
    expect(
      screen.getByText(/couldn\u2019t load your course details/i),
    ).toBeInTheDocument()
  })
})
