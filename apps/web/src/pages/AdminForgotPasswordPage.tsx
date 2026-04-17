// FIR-36 — Admin forgot password page (email submission + success state)
import { useState } from 'react'
import { Link } from 'react-router'
import { adminForgotPassword } from '../lib/api'
import { AdminLeftPanel } from './AdminLoginPage'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// Email sent success state
// ---------------------------------------------------------------------------
function EmailSentState({ email, onResend }: { email: string; onResend: () => void }) {
  return (
    <div className="w-full max-w-[440px] text-center">
      <p className="text-[56px] mb-5" aria-hidden="true">📧</p>
      <h1
        className={cn(
          'text-[36px] font-black text-[#1a2744]',
          'tracking-[-1px] leading-[0.9] mb-2',
        )}
      >
        Check your inbox
      </h1>
      <p className="text-[15px] text-[#717182] mb-2">
        We sent a password reset link to
      </p>
      <p className="text-[16px] font-bold text-[#1a2744] mb-7">{email}</p>

      <div
        className={cn(
          'rounded-xl px-4 py-3.5 mb-6 text-left',
          'bg-[#f8f9fb] text-[13px] text-[#717182] leading-relaxed',
        )}
      >
        The link expires in{' '}
        <strong className="text-[#1a2744]">10 minutes</strong>. Check your spam
        folder if you don't see it.
      </div>

      <button
        type="button"
        onClick={onResend}
        className={cn(
          'w-full h-[52px] rounded-full mb-3',
          'bg-[#f0f0f0] text-[#1a2744] text-[16px] font-bold',
          'border-none cursor-pointer hover:bg-[#e8e8e8] transition-colors',
          'focus-visible:outline-2 focus-visible:outline-[#4a9ad4] focus-visible:outline-offset-2',
        )}
      >
        Resend Email
      </button>

      <p className="text-[14px] text-[#717182]">
        ←{' '}
        <Link
          to="/admin/login"
          className="text-[#4a9ad4] font-semibold hover:underline"
        >
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

  return (
    <div className="flex min-h-screen w-full">
      <AdminLeftPanel tagline="Course administration made simple." />

      <div
        className={cn(
          'flex-1 flex items-center justify-center',
          'px-6 py-16 bg-[#f8f9fb]',
        )}
      >
        {submitted ? (
          <EmailSentState email={email} onResend={handleResend} />
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="w-full max-w-[420px]"
            aria-label="Forgot password form"
          >
            <h1
              className={cn(
                'text-[36px] font-black text-[#1a2744]',
                'tracking-[-1px] mb-1.5',
              )}
            >
              Reset password
            </h1>
            <p className="text-[16px] text-[#717182] mb-9">
              Enter your email and we'll send you a reset link
            </p>

            {error && (
              <div
                role="alert"
                className={cn(
                  'flex items-start gap-2.5 mb-6',
                  'bg-[#fdeaeb] border border-[rgba(208,50,56,0.25)]',
                  'rounded-xl px-4 py-3.5',
                )}
              >
                <span className="text-base flex-shrink-0 mt-0.5" aria-hidden="true">
                  ⚠️
                </span>
                <p className="text-[14px] text-[#d03238] font-medium leading-snug">
                  {error}
                </p>
              </div>
            )}

            <div className="mb-6">
              <label
                htmlFor="forgot-email"
                className="block text-[14px] font-semibold text-[#1a2744] mb-1.5"
              >
                Email address
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="admin@nextaibuilder.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={cn(
                  'w-full h-12 rounded-xl px-4',
                  'text-[15px] text-[#1a2744]',
                  'border-[1.5px] border-[rgba(26,39,68,0.15)] bg-[#f3f3f5]',
                  'outline-none transition-[border-color,background,box-shadow]',
                  'focus:border-[#4a9ad4] focus:bg-white focus:shadow-[0_0_0_3px_rgba(74,154,212,0.12)]',
                )}
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className={cn(
                'w-full h-[52px] rounded-full',
                'bg-[#4a9ad4] text-[#0d1a3a] text-[16px] font-bold',
                'border-none cursor-pointer',
                'hover:opacity-90 transition-opacity',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus-visible:outline-2 focus-visible:outline-[#4a9ad4] focus-visible:outline-offset-2',
              )}
            >
              {isPending ? 'Sending…' : 'Send Reset Link'}
            </button>

            <p className="text-[14px] text-[#717182] mt-5">
              ←{' '}
              <Link
                to="/admin/login"
                className="text-[#4a9ad4] font-semibold hover:underline"
              >
                Back to Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
