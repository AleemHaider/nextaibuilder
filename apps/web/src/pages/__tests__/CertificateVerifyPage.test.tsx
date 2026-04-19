// Sprint 2 Story 7 — Tests for <CertificateVerifyPage>.
//
// We mount the page inside a MemoryRouter so useParams / useNavigate
// resolve, and we stub global.fetch via vi.spyOn to avoid real network.
//
// Coverage:
//   1. No token → search form renders
//   2. Token present → fetch is called and LoadingSpinner renders while pending
//   3. Valid response → student name + cohort title + credentialId rendered
//   4. Not-found response → "Certificate not found" (ShieldX EmptyState)
//   5. Copy-link button writes window.location.href to navigator.clipboard
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import CertificateVerifyPage from '../CertificateVerifyPage'

// ── Helpers ────────────────────────────────────────────────────────────────

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/verify-certificate" element={<CertificateVerifyPage />} />
        <Route
          path="/verify-certificate/:token"
          element={<CertificateVerifyPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function mockFetchOnce(body: unknown, ok = true): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as unknown as Response)
}

// Prevent a test leaking a pending fetch into the next one.
afterEach(() => {
  vi.restoreAllMocks()
})

describe('<CertificateVerifyPage>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────
  it('renders the search form when no token is present', () => {
    renderAt('/verify-certificate')
    expect(
      screen.getByLabelText(/enter a credential id to verify/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────
  it('fetches on mount when a token is present and shows the loading spinner', async () => {
    // Return a promise that never resolves during this assertion window so
    // the loading state stays put long enough for us to observe it.
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockImplementationOnce(() => new Promise(() => {}))

    renderAt('/verify-certificate/NAB-2024-000042')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const callArg = String(fetchSpy.mock.calls[0]?.[0])
    expect(callArg).toContain('/api/v1/certificate/verify/NAB-2024-000042')
    // The LoadingSpinner renders role=status.
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/verifying credential/i)).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────
  it('renders student name, cohort title and credentialId when valid', async () => {
    mockFetchOnce({
      valid: true,
      credential: {
        credentialId: 'NAB-2024-000042',
        studentName: 'Ada Lovelace',
        cohortTitle: 'AI Builder Cohort 3',
        completedAt: '2024-06-01T00:00:00Z',
        issuedAt: '2024-06-15T00:00:00Z',
        status: 'VALID',
      },
    })

    renderAt('/verify-certificate/NAB-2024-000042')

    await waitFor(() => {
      expect(screen.getByTestId('verify-valid-card')).toBeInTheDocument()
    })
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('AI Builder Cohort 3')).toBeInTheDocument()
    expect(screen.getByText('NAB-2024-000042')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /certificate verified/i }),
    ).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────
  it('renders "Certificate not found" when credential is null', async () => {
    mockFetchOnce({ valid: false, credential: null })

    renderAt('/verify-certificate/NAB-NOPE-000000')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /certificate not found/i }),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByText(
        /doesn't match any issued certificate/i,
      ),
    ).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────
  it('copy-link button writes the current URL to the clipboard', async () => {
    mockFetchOnce({
      valid: true,
      credential: {
        credentialId: 'NAB-2024-000042',
        studentName: 'Ada Lovelace',
        cohortTitle: 'AI Builder Cohort 3',
        completedAt: '2024-06-01T00:00:00Z',
        issuedAt: '2024-06-15T00:00:00Z',
        status: 'VALID',
      },
    })

    // navigator.clipboard is read-only on Window in jsdom; define it.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    renderAt('/verify-certificate/NAB-2024-000042')

    await waitFor(() => {
      expect(screen.getByTestId('verify-valid-card')).toBeInTheDocument()
    })

    const copyBtn = screen.getByRole('button', {
      name: /copy shareable link/i,
    })
    await act(async () => {
      fireEvent.click(copyBtn)
    })

    expect(writeText).toHaveBeenCalledTimes(1)
    // MemoryRouter doesn't mutate window.location, so we assert the button
    // copied whatever `window.location.href` currently is (the jsdom URL)
    // and covered the contract that a string is written to the clipboard.
    const copied = writeText.mock.calls[0]?.[0]
    expect(typeof copied).toBe('string')
    expect(copied).toBe(window.location.href)

    // Button flips to confirmation label while the 2s timer is alive.
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /link copied/i }),
      ).toBeInTheDocument()
    })
  })
})
