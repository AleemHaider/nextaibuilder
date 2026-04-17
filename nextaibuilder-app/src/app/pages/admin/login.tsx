// PBA-256 — Admin login page (email + password, with optional 2FA redirect)
// Route: /admin/login  |  Guest-only — redirects to /admin/dashboard if already authenticated as admin
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { Logo } from '@/app/components/ui/logo'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { cn } from '@/lib/utils'
import { loginWithEmailPassword } from '@/store/auth'

// ── Form types ─────────────────────────────────────────────────────────────────

interface LoginFormValues {
  email: string
  password: string
}

// ── Error message mapping ──────────────────────────────────────────────────────

function getErrorMessage(errorCode: string | undefined, fallback: string): string {
  switch (errorCode) {
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password.'
    case 'ACCOUNT_DEACTIVATED':
      return 'Your account has been deactivated. Contact your administrator.'
    case 'NETWORK_ERROR':
      return 'Something went wrong. Please try again.'
    default:
      return fallback || 'Something went wrong. Please try again.'
  }
}

// ── Page component ─────────────────────────────────────────────────────────────

function AdminLoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setApiError(null)

    const { data, error } = await loginWithEmailPassword(values.email, values.password)

    if (error) {
      setApiError(getErrorMessage(error.error, error.message ?? ''))
      return
    }

    if (!data) {
      setApiError('Something went wrong. Please try again.')
      return
    }

    if (data.twoFactorRequired) {
      navigate('/admin/login/verify-otp', { state: { preAuthToken: data.preAuthToken } })
    } else {
      navigate('/admin/dashboard', { replace: true })
    }
  }

  return (
    <div
      data-slot="admin-login-page"
      className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 py-12"
    >
      <div className="w-full max-w-[440px]">
        <div className="bg-card rounded-xl border border-black/[0.08] shadow-[0px_4px_12px_rgba(0,0,0,0.08)] px-10 py-10">

          {/* Logo */}
          <Logo size="sm" className="mb-8" />

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[24px] font-medium leading-tight text-foreground mb-1">
              Admin Portal
            </h1>
            <p className="text-[15px] text-muted-foreground">
              Sign in to your admin account
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

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                {...register('email', {
                  required: 'Email is required.',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address.',
                  },
                })}
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/admin/forgot-password"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password', {
                    required: 'Password is required.',
                  })}
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
              {errors.password && (
                <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
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
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </Button>

          </form>
        </div>
      </div>
    </div>
  )
}

export { AdminLoginPage }
