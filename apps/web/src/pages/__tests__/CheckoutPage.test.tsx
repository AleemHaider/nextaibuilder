// Sprint 2 Story 10 (GAP-025) — unit tests for CheckoutPage error handling.
//
// Scope:
//   - classifyStripeError maps raw errors to the expected kind
//   - The error banner renders when a simulated Stripe failure surfaces
//   - Declined card, network timeout, and invalid plan each yield a
//     distinct headline
//
// We stub `../../lib/api` so we can drive createOneTimeCheckout into the
// throw branch without a real network call. We also stub AuthContext
// since the page's manual-payment fallback ultimately does an authFetch.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'

vi.mock('../../lib/api', () => ({
  fetchCohortBySlug:        vi.fn(),
  createOneTimeCheckout:    vi.fn(),
  createInstallmentCheckout: vi.fn(),
  submitManualPayment:      vi.fn(),
}))

import CheckoutPage, { classifyStripeError } from '../CheckoutPage'
import {
  fetchCohortBySlug,
  createOneTimeCheckout,
} from '../../lib/api'

// ── Fixtures ────────────────────────────────────────────────────────────

const cohortFixture = {
  id:              '507f1f77bcf86cd799439011',
  slug:            'ai-builder-101',
  title:           'AI Builder 101',
  tagline:         'Learn AI',
  type:            'recorded' as const,
  price:           499,
  coverGradient:   'linear-gradient(135deg,#000,#111)',
  meta:            '',
  published:       true,
  description:     'A course',
  lessonCount:     10,
  hoursOfContent:  20,
  modules:         [],
  includes:        [],
  instructorName:  '',
  instructorTitle: '',
  instructorBio:   '',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/checkout/ai-builder-101?plan=plan_abc']}>
      <Routes>
        <Route path="/checkout/:slug" element={<CheckoutPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('classifyStripeError (Sprint 2 Story 10 / GAP-025)', () => {
  it('maps "card declined" to CARD_DECLINED', () => {
    expect(classifyStripeError(new Error('Your card was declined.')).kind).toBe('CARD_DECLINED')
    expect(classifyStripeError(new Error('card_declined')).kind).toBe('CARD_DECLINED')
  })

  it('maps network/timeout errors to NETWORK_TIMEOUT', () => {
    expect(classifyStripeError(new Error('Network request failed')).kind).toBe('NETWORK_TIMEOUT')
    expect(classifyStripeError(new Error('Request timeout exceeded')).kind).toBe('NETWORK_TIMEOUT')
    expect(classifyStripeError(new Error('fetch failed')).kind).toBe('NETWORK_TIMEOUT')
  })

  it('maps invalid plan errors to INVALID_PLAN', () => {
    expect(classifyStripeError(new Error('Payment plan not found')).kind).toBe('INVALID_PLAN')
    expect(classifyStripeError(new Error('invalid plan')).kind).toBe('INVALID_PLAN')
  })

  it('falls back to SESSION_FAILED on unknown messages and UNKNOWN on empty', () => {
    expect(classifyStripeError(new Error('Something odd happened')).kind).toBe('SESSION_FAILED')
    expect(classifyStripeError(new Error('')).kind).toBe('UNKNOWN')
    expect(classifyStripeError(null).kind).toBe('UNKNOWN')
  })
})

describe('<CheckoutPage> error state', () => {
  beforeEach(() => {
    ;(fetchCohortBySlug as ReturnType<typeof vi.fn>).mockReset()
    ;(createOneTimeCheckout as ReturnType<typeof vi.fn>).mockReset()
    ;(fetchCohortBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(cohortFixture)
  })

  it('renders CARD_DECLINED banner when Stripe returns a decline error', async () => {
    ;(createOneTimeCheckout as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Your card was declined.'),
    )

    const user = userEvent.setup()
    renderPage()

    // Wait for cohort load, then click Pay.
    const payButton = await screen.findByRole('button', { name: /Pay \$499 Now/i })
    await user.click(payButton)

    const banner = await screen.findByTestId('stripe-error-banner')
    expect(banner).toHaveAttribute('data-error-kind', 'CARD_DECLINED')
    expect(banner).toHaveTextContent(/Card declined/i)
  })

  it('renders NETWORK_TIMEOUT banner when the API call times out', async () => {
    ;(createOneTimeCheckout as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network timeout while contacting Stripe'),
    )

    const user = userEvent.setup()
    renderPage()

    const payButton = await screen.findByRole('button', { name: /Pay \$499 Now/i })
    await user.click(payButton)

    const banner = await screen.findByTestId('stripe-error-banner')
    expect(banner).toHaveAttribute('data-error-kind', 'NETWORK_TIMEOUT')
    expect(banner).toHaveTextContent(/Network error/i)
  })

  it('renders INVALID_PLAN banner for server 404 on the plan', async () => {
    ;(createOneTimeCheckout as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Payment plan not found, not active, or not a ONE_TIME plan.'),
    )

    const user = userEvent.setup()
    renderPage()

    const payButton = await screen.findByRole('button', { name: /Pay \$499 Now/i })
    await user.click(payButton)

    const banner = await screen.findByTestId('stripe-error-banner')
    expect(banner).toHaveAttribute('data-error-kind', 'INVALID_PLAN')
    expect(banner).toHaveTextContent(/Payment plan unavailable/i)
  })

  it('clears the banner when the dismiss button is clicked', async () => {
    ;(createOneTimeCheckout as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Your card was declined.'),
    )

    const user = userEvent.setup()
    renderPage()

    const payButton = await screen.findByRole('button', { name: /Pay \$499 Now/i })
    await user.click(payButton)

    const banner = await screen.findByTestId('stripe-error-banner')
    const dismiss = banner.querySelector('button[aria-label="Dismiss error"]') as HTMLButtonElement
    expect(dismiss).toBeTruthy()

    fireEvent.click(dismiss)

    await waitFor(() => {
      expect(screen.queryByTestId('stripe-error-banner')).toBeNull()
    })
  })
})
