// PBA-260 — Admin reset password page
// Route: /admin/reset-password?token=<token>  |  Guest-only
import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { AlertCircle, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import { Logo } from '@/app/components/ui/logo'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { cn } from '@/lib/utils'
import { adminResetPassword } from '@/store/auth'

type PageState = 'form' | 'success' | 'invalid'

function AdminResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  // If no token on mount, go straight to invalid state
  const [pageState, setPageState] = React.useState<PageState>(token ? 'form' : 'invalid')

  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)
  const [confirmError, setConfirmError] = React.useState<string | null>(null)

  function validatePassword(value: string): string | null {
    if (!value) return 'Password is required.'
    if (value.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter.'
    if (!/[0-9]/.test(value)) return 'Password must contain at least one number.'
    return null
  }

  function validateConfirm(value: string, pwd: string): string | null {
    if (!value) return 'Please confirm your password.'
    if (value !== pwd) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setApiError(null)

    const pwdErr = validatePassword(password)
    const cfmErr = validateConfirm(confirmPassword, password)
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
    <div
      data-slot="admin-reset-password-page"
      className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 py-12"
    >
      <div className="w-full max-w-[440px]">
        <div className="bg-card rounded-xl border border-black/[0.08] shadow-[0px_4px_12px_rgba(0,0,0,0.08)] px-10 py-10">

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
                <Link to="/admin/forgot-password">Request new link</Link>
              </Button>
              <div className="mt-5">
                <Link
                  to="/admin/login"
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
                <Link to="/admin/login">Go to login</Link>
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
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="pr-10"
                      aria-invalid={Boolean(passwordError)}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (passwordError) setPasswordError(validatePassword(e.target.value))
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword
                        ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                        : <Eye className="h-4 w-4" aria-hidden="true" />
                      }
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-xs text-destructive mt-1">{passwordError}</p>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="pr-10"
                      aria-invalid={Boolean(confirmError)}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        if (confirmError) setConfirmError(validateConfirm(e.target.value, password))
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirm
                        ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                        : <Eye className="h-4 w-4" aria-hidden="true" />
                      }
                    </button>
                  </div>
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
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                        aria-hidden="true"
                      />
                      Resetting…
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>

              </form>

              <div className="mt-5 flex justify-center">
                <Link
                  to="/admin/login"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to login
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

export { AdminResetPasswordPage }
