'use client'
// PBA-259 — Admin set-password page (used on first-time invite links)
// Route: /admin/set-password?token=<token>
import * as React from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/ui/auth-shell'
import { PasswordInput } from '@/components/ui/password-input'
import { cn } from '@/lib/utils'
import { adminSetPassword } from '@/store/auth'

// ── Page component ─────────────────────────────────────────────────────────────

function PageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [isTokenInvalid, setIsTokenInvalid] = React.useState(!token)

  // Local validation
  const getValidationError = (): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
    if (!/\d/.test(password)) return 'Password must contain at least one number.'
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    const validationError = getValidationError()
    if (validationError) {
      setApiError(validationError)
      return
    }

    setIsSubmitting(true)
    setApiError(null)

    const { error } = await adminSetPassword(token, password, confirmPassword)

    setIsSubmitting(false)

    if (error) {
      if (error.error === 'INVALID_TOKEN' || error.error === 'TOKEN_EXPIRED') {
        setIsTokenInvalid(true)
        return
      }
      setApiError(error.message ?? 'Something went wrong. Please try again.')
      return
    }

    setIsSuccess(true)
  }

  // ── Expired / invalid token state ─────────────────────────────────────────

  if (isTokenInvalid) {
    return (
      <AuthShell data-slot="admin-set-password-page" maxWidth="md" className="text-center">
            <Logo size="sm" className="mb-8 mx-auto" />
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
            </div>
            <h1 className="text-[20px] font-medium text-foreground mb-2">Link Expired or Invalid</h1>
            <p className="text-sm text-muted-foreground mb-6">
              This link has expired or is invalid. Please request a new password reset link.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/forgot-password">Request New Link</Link>
            </Button>
      </AuthShell>
    )
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (isSuccess) {
    return (
      <AuthShell data-slot="admin-set-password-page" maxWidth="md" className="text-center">
            <Logo size="sm" className="mb-8 mx-auto" />
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-10 w-10 text-foreground" aria-hidden="true" />
            </div>
            <h1 className="text-[20px] font-medium text-foreground mb-2">Password Set!</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Your password has been set. You can now log in to the admin panel.
            </p>
            <Button asChild className="w-full">
              <Link href="/admin/login">Go to Login</Link>
            </Button>
      </AuthShell>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <AuthShell data-slot="admin-set-password-page" maxWidth="md">

          {/* Logo */}
          <Logo size="sm" className="mb-8" />

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[24px] font-medium leading-tight text-foreground mb-1">
              Set Your Password
            </h1>
            <p className="text-[15px] text-muted-foreground">
              Create a secure password for your admin account
            </p>
          </div>

          {/* Error banner */}
          {apiError && (
            <div
              role="alert"
              className="flex items-center gap-3 mb-5 px-3.5 py-3 rounded-lg bg-destructive/[0.06] border border-destructive/20"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <p className="text-sm text-destructive">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setApiError(null) }}
              />
              <p className="text-xs text-muted-foreground">
                Min 8 characters, 1 uppercase letter, 1 number
              </p>
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <PasswordInput
                id="confirm-password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setApiError(null) }}
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className={cn('w-full h-10 mt-2')}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting Password…
                </>
              ) : (
                'Set Password'
              )}
            </Button>

          </form>
    </AuthShell>
  )
}

export default function Page() {
  return <Suspense><PageContent /></Suspense>
}
