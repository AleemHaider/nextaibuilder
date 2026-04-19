// FIR-36 — Admin forgot password page (email submission + success state)
// Sprint 3 Story 14 — Wise theme migration. Matches the AdminLoginPage
// aesthetic: dark left panel, white right card, lime primary CTA, Wave 6
// primitives (<Button>, <Input>, <FormField>, <LoadingSpinner>).
import { useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { adminForgotPassword } from '../lib/api'
import { AdminLeftPanel } from './AdminLoginPage'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Input } from '../components/ui/Input'

// ---------------------------------------------------------------------------
// Email sent success state
// ---------------------------------------------------------------------------
function EmailSentState({
  email,
  isPending,
  onResend,
}: {
  email: string
  isPending: boolean
  onResend: () => void
}) {
  return (
    <div className="w-full max-w-[440px] text-center">
      <div
        className={cn(
          'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full',
          'bg-[var(--color-wise-primary)]/15 text-[var(--color-wise-primary-text)]',
        )}
        aria-hidden="true"
      >
        <MailCheck size={26} strokeWidth={2.25} />
      </div>
      <h1
        className={cn(
          'text-[36px] font-black text-[var(--color-wise-text)]',
          'tracking-[-1px] leading-[0.9] mb-2',
        )}
      >
        Check your inbox
      </h1>
      <p className="text-[15px] text-[var(--color-wise-text-muted)] mb-2">
        We sent a password reset link to
      </p>
      <p className="text-[16px] font-bold text-[var(--color-wise-text)] mb-7">
        {email}
      </p>

      <div
        className={cn(
          'rounded-xl px-4 py-3.5 mb-6 text-left',
          'bg-[var(--color-wise-canvas)] text-[13px] leading-relaxed',
          'text-[var(--color-wise-text-muted)]',
        )}
      >
        The link expires in{' '}
        <strong className="text-[var(--color-wise-text)]">10 minutes</strong>.
        Check your spam folder if you don't see it.
      </div>

      <Button
        variant="outline"
        size="lg"
        isLoading={isPending}
        onClick={onResend}
        className="w-full mb-3"
      >
        Resend Email
      </Button>

      <p className="text-[14px] text-[var(--color-wise-text-muted)]">
        <Link
          to="/admin/login"
          className={cn(
            'inline-flex items-center gap-1.5',
            'text-[var(--color-wise-primary-text)] font-semibold hover:underline',
          )}
        >
          <ArrowLeft size={14} strokeWidth={2.5} aria-hidden="true" />
          Back to Sign In
        </Link>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdminForgotPasswordPage
// ---------------------------------------------------------------------------
export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    try {
      await adminForgotPassword(email)
      setSubmitted(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send reset email.',
      )
    } finally {
      setIsPending(false)
    }
  }

  async function handleResend() {
    if (!email) return
    setIsPending(true)
    try {
      await adminForgotPassword(email)
    } catch {
      // Silently fail on resend to avoid exposing user enumeration
    } finally {
      setIsPending(false)
    }
  }

  const hasError = error !== null

  return (
    <div className="flex min-h-screen w-full bg-[var(--color-wise-canvas)]">
      <AdminLeftPanel tagline="Course administration made simple." />

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        {submitted ? (
          <EmailSentState
            email={email}
            isPending={isPending}
            onResend={handleResend}
          />
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className={cn(
              'w-full max-w-[460px] rounded-[30px] bg-white p-10',
              'shadow-[var(--shadow-card)]',
            )}
            aria-label="Forgot password form"
          >
            <h1
              className={cn(
                'text-[36px] font-black text-[var(--color-wise-text)]',
                'tracking-[-1px] mb-1.5',
              )}
            >
              Reset password
            </h1>
            <p className="text-[16px] text-[var(--color-wise-text-muted)] mb-9">
              Enter your email and we'll send you a reset link
            </p>

            {error && (
              <div
                role="alert"
                className={cn(
                  'flex items-start gap-2.5 mb-6 rounded-2xl px-4 py-3.5',
                  'bg-[var(--color-wise-danger-soft)]',
                  'ring-1 ring-[var(--color-wise-danger)]/25',
                )}
              >
                <AlertTriangle
                  className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-wise-danger)]"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <p className="text-[14px] font-semibold leading-snug text-[var(--color-wise-danger)]">
                  {error}
                </p>
              </div>
            )}

            <FormField id="forgot-email" label="Email address" className="mb-6">
              <Input
                type="email"
                autoComplete="email"
                placeholder="admin@nextaibuilder.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                inputSize="lg"
                hasError={hasError}
                leftIcon={<Mail size={16} strokeWidth={2.25} />}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isPending}
              className="w-full"
            >
              {isPending ? 'Sending…' : 'Send Reset Link'}
            </Button>

            <p className="text-[14px] text-[var(--color-wise-text-muted)] mt-5 text-center">
              <Link
                to="/admin/login"
                className={cn(
                  'inline-flex items-center gap-1.5',
                  'text-[var(--color-wise-primary-text)] font-semibold hover:underline',
                )}
              >
                <ArrowLeft size={14} strokeWidth={2.5} aria-hidden="true" />
                Back to Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
