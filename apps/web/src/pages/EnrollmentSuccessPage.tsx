// FIR-157 — Enrollment success page shown after payment confirmation
//
// Sprint 2 Story 10:
//   GAP-030: cohort name no longer comes from `?cohort=` query param
//            (spoofable / XSS risk). It's fetched server-side by trusted
//            Mongo ObjectId from `?cohortId=` (or a future session_id).
//   GAP-031: "Check your email at X" CTA added, using the logged-in
//            user's email via useAuth(), falling back to a generic
//            message when unauthenticated.
//
// Sprint 3 Story 13: Wise theme sweep — legacy navy/green hex codes
// replaced with `--color-wise-*` tokens so the card matches the rest of
// the public surface.
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Mail } from 'lucide-react'
import { cn } from '../lib/utils'
import { fetchCohortById, type CohortSummaryById } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'

// ---------------------------------------------------------------------------
// CSS-only animated checkmark — unchanged from FIR-157.
// ---------------------------------------------------------------------------

type LookupState =
  | { status: 'loading' }
  | { status: 'ready'; cohort: CohortSummaryById | null }
  | { status: 'error'; message: string }

export default function EnrollmentSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  // GAP-030: accept a trusted identifier only (Mongo ObjectId or Stripe
  // session id). The legacy `cohort=` query is ignored even if present —
  // the only way to render a cohort title is via a server lookup.
  const cohortId = searchParams.get('cohortId') ?? ''

  const [lookup, setLookup] = useState<LookupState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    if (!cohortId) {
      // No id in the URL — fall back to the generic success message rather
      // than blocking the page.
      setLookup({ status: 'ready', cohort: null })
      return
    }

    async function run() {
      try {
        const cohort = await fetchCohortById(cohortId)
        if (cancelled) return
        setLookup({ status: 'ready', cohort })
      } catch {
        if (cancelled) return
        setLookup({
          status:  'error',
          message: 'We couldn\u2019t load your course details. Your enrollment is still confirmed.',
        })
      }
    }
    run()

    return () => { cancelled = true }
  }, [cohortId])

  // GAP-031: show the user's email if we have one — the email CTA is the
  // whole point of this confirmation view.
  const userEmail = user?.email ?? null

  if (lookup.status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--color-wise-canvas)] flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading enrollment" centered />
      </div>
    )
  }

  if (lookup.status === 'error') {
    return (
      <div className="min-h-screen bg-[var(--color-wise-canvas)] flex items-center justify-center px-4">
        <div
          className={cn(
            'rounded-[var(--radius-md)] bg-[var(--color-wise-surface)]',
            'w-full max-w-[520px] shadow-[var(--shadow-card)]',
          )}
        >
          <EmptyState
            title="You\u2019re enrolled!"
            description={lookup.message}
            action={{ label: 'Go to My Courses', onClick: () => navigate('/student/dashboard') }}
          />
        </div>
      </div>
    )
  }

  const cohortTitle = lookup.cohort?.title ?? 'your course'

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col items-center justify-center px-4',
        'bg-[var(--color-wise-canvas)]',
      )}
    >
      {/* Success card */}
      <div
        className={cn(
          'w-full max-w-[480px] p-12 text-center',
          'rounded-[var(--radius-md)] bg-[var(--color-wise-surface)]',
          'shadow-[var(--shadow-card)]',
        )}
        role="main"
        aria-labelledby="success-heading"
      >
        {/* Animated checkmark */}
        <div className="flex items-center justify-center mb-6" aria-hidden="true">
          <div className="relative w-[72px] h-[72px]">
            {/* Background circle */}
            <div
              className={cn(
                'absolute inset-0 rounded-full bg-[var(--color-wise-mint)]',
                'animate-[ping_0.4s_ease-out_forwards]',
              )}
              style={{ animationIterationCount: 1 }}
            />
            {/* SVG animated ring */}
            <svg
              viewBox="0 0 72 72"
              className="absolute inset-0 w-full h-full"
              aria-hidden="true"
            >
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="var(--color-wise-mint)"
                stroke="var(--color-wise-primary-text)"
                strokeWidth="2.5"
                strokeDasharray="201"
                strokeDashoffset="201"
                style={{
                  animation: 'draw-ring 0.6s ease-out 0.1s forwards',
                }}
              />
              {/* Checkmark path */}
              <path
                d="M22 36 L31 45 L50 26"
                fill="none"
                stroke="var(--color-wise-primary-text)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="42"
                strokeDashoffset="42"
                style={{
                  animation: 'draw-check 0.35s ease-out 0.55s forwards',
                }}
              />
            </svg>
          </div>
        </div>

        {/* CSS animations injected via a style tag */}
        <style>{`
          @keyframes draw-ring {
            to { stroke-dashoffset: 0; }
          }
          @keyframes draw-check {
            to { stroke-dashoffset: 0; }
          }
        `}</style>

        <h1
          id="success-heading"
          className="mb-2 text-[28px] font-black text-[var(--color-wise-text)]"
        >
          You're enrolled!
        </h1>

        <p className="mb-6 text-base leading-relaxed text-[var(--color-wise-text-muted)]">
          Your payment was successful. Welcome to{' '}
          {/*
            GAP-030 — cohort name is the server-returned `title` from
            /storefront/cohorts/by-id/:id. Rendered as a plain text node so
            React's default escaping handles any residual characters.
          */}
          <span
            data-testid="cohort-title"
            className="font-semibold text-[var(--color-wise-text)]"
          >
            {cohortTitle}
          </span>
          .
        </p>

        {/* GAP-031: email CTA — only rendered when we actually have an
            authenticated email to show. Otherwise we fall back to the
            "check your email" generic line below. */}
        {userEmail ? (
          <div
            data-testid="email-cta"
            className={cn(
              'flex items-center justify-center gap-2 mb-8 py-3 px-4',
              'rounded-xl bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
            )}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm">
              Check your email at{' '}
              <span className="font-semibold break-all">{userEmail}</span>
            </span>
          </div>
        ) : (
          <p className="mb-8 text-sm text-[var(--color-wise-text-muted)]">
            Check your email for access details.
          </p>
        )}

        {/* Primary CTA — Wave 6 <Button> */}
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate('/student/dashboard')}
          className="w-full mb-3"
        >
          Go to My Courses
        </Button>

        {/* Secondary — receipt hint */}
        <p className="text-[13px] text-[var(--color-wise-text-muted)]">
          A receipt has been sent to your email address.
        </p>
      </div>
    </div>
  )
}
