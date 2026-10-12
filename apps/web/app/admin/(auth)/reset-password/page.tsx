'use client'
// PBA-260 — Admin reset password page
// Route: /admin/reset-password?token=<token>  |  Guest-only
import * as React from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle, XCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/ui/auth-shell'
import { PasswordInput } from '@/components/ui/password-input'
import { cn } from '@/lib/utils'
import { adminResetPassword } from '@/store/auth'
import { validatePassword, validatePasswordMatch } from '@/lib/auth-errors'

type PageState = 'form' | 'success' | 'invalid'

function PageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  // If no token on mount, go straight to invalid state
  const [pageState, setPageState] = React.useState<PageState>(token ? 'form' : 'invalid')

  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)
  const [confirmError, setConfirmError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setApiError(null)

    const pwdErr = validatePassword(password)
    const cfmErr = validatePasswordMatch(password, confirmPassword)
    setPasswordError(pwdErr)
    setConfirmError(cfmErr)
    if (pwdErr || cfmErr) return

    setIsSubmitting(true)
    const { error } = await adminResetPassword(token, password, confirmPassword)
    setIsSubmitting(false)

    if (!error) {
      setPageState('success')
      return
    }

    if (error.error === 'INVALID_TOKEN') {
      setPageState('invalid')
      return
    }

    setApiError(error.message ?? 'Something went wrong. Please try again.')
  }

  return (
    <AuthShell data-slot="admin-reset-password-page" maxWidth="md">

          <Logo size="sm" className="mb-8" />

          {/* Invalid / expired link state */}
          {pageState === 'invalid' && (
            <div className="flex flex-col items-center text-center">
              <XCircle className="h-10 w-10 text-destructive mb-3" aria-hidden="true" />
              <h1 className="text-[22px] font-medium leading-tight text-foreground mb-2">
                Link invalid or expired
              </h1>
              <p className="text-[15px] text-muted-foreground mb-6">
                This password reset link is no longer valid. Please request a new one.
              </p>
              <Button asChild className={cn('w-full h-10')}>
                <Link href="/admin/forgot-password">Request new link</Link>
              </Button>
              <div className="mt-5">
                <Link
                  href="/admin/login"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to login
                </Link>
              </div>
            </div>
          )}

          {/* Success state */}
          {pageState === 'success' && (
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-10 w-10 text-green-600 mb-3" aria-hidden="true" />
              <h1 className="text-[22px] font-medium leading-tight text-foreground mb-2">
                Password reset
              </h1>
              <p className="text-[15px] text-muted-foreground mb-6">
                Your password has been updated. You can now sign in.
              </p>
              <Button asChild className={cn('w-full h-10')}>
                <Link href="/admin/login">Go to login</Link>
              </Button>
            </div>
          )}

          {/* Form state */}
          {pageState === 'form' && (
            <>
              <div className="mb-6">
                <h1 className="text-[24px] font-medium leading-tight text-foreground mb-1">
                  Reset password
                </h1>
                <p className="text-[15px] text-muted-foreground">
                  Choose a strong new password for your account.
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

                {/* New password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    aria-invalid={Boolean(passwordError)}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (passwordError) setPasswordError(validatePassword(e.target.value))
                    }}
                  />
                  {passwordError && (
                    <p className="text-xs text-destructive mt-1">{passwordError}</p>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <PasswordInput
                    id="confirm-password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    aria-invalid={Boolean(confirmError)}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (confirmError) setConfirmError(validatePasswordMatch(password, e.target.value))
                    }}
                  />
                  {confirmError && (
                    <p className="text-xs text-destructive mt-1">{confirmError}</p>
                  )}
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
                      Resetting…
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>

              </form>

              <div className="mt-5 flex justify-center">
                <Link
                  href="/admin/login"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to login
                </Link>
              </div>
            </>
          )}

    </AuthShell>
  )
}

export default function Page() {
  return <Suspense><PageContent /></Suspense>
}
