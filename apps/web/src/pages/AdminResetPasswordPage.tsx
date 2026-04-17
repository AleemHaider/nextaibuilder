// FIR-36 — Admin reset password page (reads token from URL query param)
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { adminResetPassword } from '../lib/api'
import { AdminLeftPanel } from './AdminLoginPage'
import { cn } from '../lib/utils'

const MIN_PASSWORD_LENGTH = 8

export default function AdminResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  // Client-side validation before hitting the API
  function validate(): string | null {
    if (!token) return 'Invalid or missing reset token. Please request a new link.'
    if (password.length < MIN_PASSWORD_LENGTH)
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsPending(true)
    try {
      await adminResetPassword(token, password, confirmPassword)
      // Navigate to login with a success indicator in state
      navigate('/admin/login', {
        replace: true,
        state: { successMessage: 'Password reset successfully. Please sign in.' },
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reset password. Please try again.',
      )
    } finally {
      setIsPending(false)
    }
  }

  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword

  return (
    <div className="flex min-h-screen w-full">
      <AdminLeftPanel tagline="Course administration made simple." />

      <div
        className={cn(
          'flex-1 flex items-center justify-center',
          'px-6 py-16 bg-[#f8f9fb]',
        )}
      >
        <form
          onSubmit={handleSubmit}
          noValidate
          className="w-full max-w-[420px]"
          aria-label="Reset password form"
        >
          <h1
            className={cn(
              'text-[36px] font-black text-[#1a2744]',
              'tracking-[-1px] mb-1.5',
            )}
          >
            New password
          </h1>
          <p className="text-[16px] text-[#717182] mb-9">
            Choose a strong password for your account
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

          {/* New password */}
          <div className="mb-[18px]">
            <label
              htmlFor="new-password"
              className="block text-[14px] font-semibold text-[#1a2744] mb-1.5"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              className={cn(
                'w-full h-12 rounded-xl px-4',
                'text-[15px] text-[#1a2744]',
                'border-[1.5px] bg-[#f3f3f5] outline-none',
                'transition-[border-color,background,box-shadow]',
                'border-[rgba(26,39,68,0.15)]',
                'focus:border-[#4a9ad4] focus:bg-white focus:shadow-[0_0_0_3px_rgba(74,154,212,0.12)]',
              )}
            />
          </div>

          {/* Confirm password */}
          <div className="mb-6">
            <label
              htmlFor="confirm-password"
              className="block text-[14px] font-semibold text-[#1a2744] mb-1.5"
            >
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              aria-invalid={passwordMismatch}
              aria-describedby={passwordMismatch ? 'confirm-password-error' : undefined}
              className={cn(
                'w-full h-12 rounded-xl px-4',
                'text-[15px] text-[#1a2744]',
                'border-[1.5px] bg-[#f3f3f5] outline-none',
                'transition-[border-color,background,box-shadow]',
                passwordMismatch
                  ? 'border-[#d03238] bg-[#fef2f2]'
                  : 'border-[rgba(26,39,68,0.15)]',
                'focus:border-[#4a9ad4] focus:bg-white focus:shadow-[0_0_0_3px_rgba(74,154,212,0.12)]',
              )}
            />
            {passwordMismatch && (
              <p
                id="confirm-password-error"
                role="alert"
                className="text-[13px] text-[#d03238] mt-1.5"
              >
                Passwords do not match.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending || !token}
            className={cn(
              'w-full h-[52px] rounded-full',
              'bg-[#4a9ad4] text-[#0d1a3a] text-[16px] font-bold',
              'border-none cursor-pointer',
              'hover:opacity-90 transition-opacity',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus-visible:outline-2 focus-visible:outline-[#4a9ad4] focus-visible:outline-offset-2',
            )}
          >
            {isPending ? 'Saving…' : 'Set New Password'}
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
      </div>
    </div>
  )
}
