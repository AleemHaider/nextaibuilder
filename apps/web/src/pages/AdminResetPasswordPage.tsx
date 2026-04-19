// FIR-36 — Admin reset password page (reads token from URL query param)
// Sprint 3 Story 14 — Wise theme migration: matches AdminLoginPage card
// (white 30px-radius form over canvas + dark left panel), uses Wave 6
// <Button>, <Input>, <FormField>, and lucide icons in place of emoji.
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AlertTriangle, ArrowLeft, Lock } from 'lucide-react'
import { adminResetPassword } from '../lib/api'
import { AdminLeftPanel } from './AdminLoginPage'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Input } from '../components/ui/Input'

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
    <div className="flex min-h-screen w-full bg-[var(--color-wise-canvas)]">
      <AdminLeftPanel tagline="Course administration made simple." />

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <form
          onSubmit={handleSubmit}
          noValidate
          className={cn(
            'w-full max-w-[460px] rounded-[30px] bg-white p-10',
            'shadow-[var(--shadow-card)]',
          )}
          aria-label="Reset password form"
        >
          <h1
            className={cn(
              'text-[36px] font-black text-[var(--color-wise-text)]',
              'tracking-[-1px] mb-1.5',
            )}
          >
            New password
          </h1>
          <p className="text-[16px] text-[var(--color-wise-text-muted)] mb-9">
            Choose a strong password for your account
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

          {/* New password */}
          <FormField id="new-password" label="New password" className="mb-[18px]">
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              inputSize="lg"
              leftIcon={<Lock size={16} strokeWidth={2.25} />}
            />
          </FormField>

          {/* Confirm password */}
          <FormField
            id="confirm-password"
            label="Confirm new password"
            errorText={passwordMismatch ? 'Passwords do not match.' : undefined}
            className="mb-6"
          >
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              inputSize="lg"
              hasError={passwordMismatch}
              leftIcon={<Lock size={16} strokeWidth={2.25} />}
            />
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isPending}
            disabled={isPending || !token}
            className="w-full"
          >
            {isPending ? 'Saving…' : 'Set New Password'}
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
      </div>
    </div>
  )
}
