'use client'
// PBA-256 — Admin login page (email + password, with optional 2FA redirect)
// Route: /admin/login  |  Guest-only — redirects to /admin/dashboard if already authenticated as admin
import * as React from 'react'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/ui/auth-shell'
import { PasswordInput } from '@/components/ui/password-input'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { loginWithEmailPassword } from '@/store/auth'
import { getAuthErrorMessage } from '@/lib/auth-errors'

// ── Form types ─────────────────────────────────────────────────────────────────

interface LoginFormValues {
  email: string
  password: string
}

// ── Page component ─────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter()
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
      setApiError(getAuthErrorMessage(error.error, error.message ?? ''))
      return
    }

    if (!data) {
      setApiError('Something went wrong. Please try again.')
      return
    }

    if (data.twoFactorRequired) {
      sessionStorage.setItem('preAuthToken', data.preAuthToken)
      router.push('/admin/login/verify-otp')
    } else {
      router.replace('/admin/dashboard')
    }
  }

  return (
    <AuthShell data-slot="admin-login-page" maxWidth="md">

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
                  href="/admin/forgot-password"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...register('password', {
                  required: 'Password is required.',
                })}
              />
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
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </Button>

          </form>
    </AuthShell>
  )
}
