// FIR-158 / Sprint 2 Story 8 — unit tests for ManualPaymentPage.
//
// We stub `../../lib/api` (not `fetch`) because the page imports typed
// helpers and we can't easily mock multipart bodies through fetch. We also
// stub `../../context/AuthContext` so we can toggle auth state without
// spinning up the AuthProvider's refresh-cookie dance.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'

// ── Module-level mocks ──────────────────────────────────────────────────
vi.mock('../../lib/api', () => ({
  fetchCohortBySlug: vi.fn(),
  submitManualPaymentRequest: vi.fn(),
  fetchManualPaymentStatus: vi.fn(),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import ManualPaymentPage, { useManualPaymentStatus } from '../ManualPaymentPage'
import { renderHook } from '@testing-library/react'
import {
  fetchCohortBySlug,
  fetchManualPaymentStatus,
  submitManualPaymentRequest,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

// ── Test helpers ────────────────────────────────────────────────────────

const cohortFixture = {
  id: '507f1f77bcf86cd799439011',
  slug: 'ai-builder-101',
  title: 'AI Builder 101',
  tagline: 'Learn AI',
  type: 'recorded' as const,
  price: 499,
  coverGradient: 'linear-gradient(135deg,#000,#111)',
  meta: '',
  published: true,
  description: 'A course',
  lessonCount: 10,
  hoursOfContent: 20,
  modules: [],
  includes: [],
  instructorName: '',
  instructorTitle: '',
  instructorBio: '',
}

function renderPage(slug = 'ai-builder-101') {
  return render(
    <MemoryRouter initialEntries={[`/manual-payment/${slug}`]}>
      <Routes>
        <Route path="/manual-payment/:slug" element={<ManualPaymentPage />} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  // Use a stubbed buffer to control reported size. Files in jsdom report
  // size from the BlobParts, so we fake it via a Uint8Array of the right
  // length — cheap, and avoids allocating the full 10+ MB for oversize tests.
  const buffer = new Uint8Array(sizeBytes)
  const f = new File([buffer], name, { type })
  // Defensive — browsers sometimes round; make sure jsdom returns the exact
  // size the test needs.
  Object.defineProperty(f, 'size', { value: sizeBytes })
  return f
}

function setAuth(
  partial: Partial<{ user: { id: string; email: string; name: string; role: 'STUDENT' } | null; isAuthenticated: boolean }>,
) {
  const state = {
    user: null as { id: string; email: string; name: string; role: 'STUDENT' } | null,
    accessToken: null,
    isLoading: false,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    ...partial,
  }
  ;(useAuth as ReturnType<typeof vi.fn>).mockReturnValue(state)
}

// ─────────────────────────────────────────────────────────────────────────

describe('<ManualPaymentPage>', () => {
  beforeEach(() => {
    ;(fetchCohortBySlug as ReturnType<typeof vi.fn>).mockReset()
    ;(submitManualPaymentRequest as ReturnType<typeof vi.fn>).mockReset()
    ;(fetchManualPaymentStatus as ReturnType<typeof vi.fn>).mockReset()
    ;(useAuth as ReturnType<typeof vi.fn>).mockReset()
    setAuth({ isAuthenticated: false, user: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ----------------------------------------------------------------------

  it('renders the cohort title after the fetch resolves', async () => {
    ;(fetchCohortBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(cohortFixture)

    renderPage()

    expect(
      await screen.findByTestId('cohort-title'),
    ).toHaveTextContent(cohortFixture.title)
    expect(fetchCohortBySlug).toHaveBeenCalledWith('ai-builder-101')
  })

  // ----------------------------------------------------------------------

  it('pre-fills email and name when the user is logged in', async () => {
    ;(fetchCohortBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(cohortFixture)
    setAuth({
      isAuthenticated: true,
      user: {
        id: 'u1',
        email: 'student@example.com',
        name: 'Avery Student',
        role: 'STUDENT',
      },
    })

    renderPage()

    const emailInput = (await screen.findByLabelText(/Email address/i)) as HTMLInputElement
    const nameInput = screen.getByLabelText(/Full name/i) as HTMLInputElement

    expect(emailInput.value).toBe('student@example.com')
    expect(nameInput.value).toBe('Avery Student')
  })

  // ----------------------------------------------------------------------

  it('shows inline validation errors when required fields are empty', async () => {
    ;(fetchCohortBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(cohortFixture)
    // Fresh user event. No fake timers here — userEvent uses real timers.
    const user = userEvent.setup()

    renderPage()

    const form = await screen.findByTestId('manual-payment-form')
    const submitBtn = within(form).getByRole('button', { name: /submit receipt/i })

    await user.click(submitBtn)

    expect(await screen.findByText(/Please enter your full name/i)).toBeInTheDocument()
    expect(screen.getByText(/Please enter your email/i)).toBeInTheDocument()
    expect(screen.getByText(/Please upload a receipt/i)).toBeInTheDocument()
    expect(submitManualPaymentRequest).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------------

  it('flags files larger than 10 MB inline', async () => {
    ;(fetchCohortBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(cohortFixture)
    const user = userEvent.setup()

    renderPage()

    // Wait for cohort load
    await screen.findByTestId('cohort-title')

    // Fill required fields
    await user.type(screen.getByLabelText(/Full name/i), 'Jane Doe')
    await user.type(screen.getByLabelText(/Email address/i), 'jane@example.com')

    const oversized = makeFile('big.pdf', 'application/pdf', 11 * 1024 * 1024)
    const input = document.getElementById('receipt-file') as HTMLInputElement
    fireEvent.change(input, { target: { files: [oversized] } })

    const submitBtn = screen.getByRole('button', { name: /submit receipt/i })
    await user.click(submitBtn)

    expect(await screen.findByText(/10 MB or smaller/i)).toBeInTheDocument()
    expect(submitManualPaymentRequest).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------------

  it('rejects file types other than jpg/png/pdf inline', async () => {
    ;(fetchCohortBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(cohortFixture)
    const user = userEvent.setup()

    renderPage()
    await screen.findByTestId('cohort-title')

    await user.type(screen.getByLabelText(/Full name/i), 'Jane Doe')
    await user.type(screen.getByLabelText(/Email address/i), 'jane@example.com')

    const bad = makeFile('virus.exe', 'application/x-msdownload', 1024)
    const input = document.getElementById('receipt-file') as HTMLInputElement
    fireEvent.change(input, { target: { files: [bad] } })

    const submitBtn = screen.getByRole('button', { name: /submit receipt/i })
    await user.click(submitBtn)

    expect(
      await screen.findByText(/must be a JPG, PNG, or PDF file/i),
    ).toBeInTheDocument()
    expect(submitManualPaymentRequest).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------------

  it('submits once on the happy path and renders the confirmation state', async () => {
    ;(fetchCohortBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(cohortFixture)
    ;(submitManualPaymentRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      requestId: 'req_123',
      status: 'PENDING',
      message: 'ok',
    })
    ;(fetchManualPaymentStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      requestId: 'req_123',
      status: 'PENDING',
    })
    setAuth({
      isAuthenticated: true,
      user: { id: 'u1', email: 'jane@example.com', name: 'Jane Doe', role: 'STUDENT' },
    })

    const user = userEvent.setup()
    renderPage()

    await screen.findByTestId('cohort-title')

    // Required fields auto-populated via useAuth fixture; just pick a file.
    const goodFile = makeFile('receipt.pdf', 'application/pdf', 500 * 1024)
    const fileInput = document.getElementById('receipt-file') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [goodFile] } })

    await user.click(screen.getByRole('button', { name: /submit receipt/i }))

    // Backend should be hit exactly once with FormData.
    await waitFor(() => {
      expect(submitManualPaymentRequest).toHaveBeenCalledTimes(1)
    })
    const callArg = (submitManualPaymentRequest as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as FormData
    expect(callArg).toBeInstanceOf(FormData)
    expect(callArg.get('cohortId')).toBe(cohortFixture.id)
    expect((callArg.get('file') as File).name).toBe('receipt.pdf')

    // Confirmation state renders the reference ID.
    expect(await screen.findByTestId('manual-payment-request-id')).toHaveTextContent('req_123')
    expect(screen.getByText(/Receipt submitted/i)).toBeInTheDocument()
  })

  // ----------------------------------------------------------------------

  it('polls every 5s and stops once status transitions to APPROVED', async () => {
    // We exercise the polling hook directly because a full page render under
    // fake timers fights with React 19 + user-event. The hook is the precise
    // unit under test here: it owns the 5 s setInterval, the stop-on-settled
    // logic, and the cleanup on unmount.
    vi.useFakeTimers()

    ;(fetchManualPaymentStatus as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ requestId: 'req_999', status: 'PENDING' })
      .mockResolvedValueOnce({ requestId: 'req_999', status: 'APPROVED' })
      .mockImplementation(() => {
        throw new Error('polling should have stopped after APPROVED')
      })

    renderHook(() => useManualPaymentStatus('req_999', 5000))

    // Effect mount fires the initial tick synchronously.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetchManualPaymentStatus).toHaveBeenCalledTimes(1)

    // 5 s → second poll fires and returns APPROVED.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetchManualPaymentStatus).toHaveBeenCalledTimes(2)

    // Another 10 s → interval should be cleared, no third call.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(fetchManualPaymentStatus).toHaveBeenCalledTimes(2)
  })
})
