'use client'
// PBA-260 — Admin forgot password page
// Route: /admin/forgot-password  |  Guest-only
import * as React from 'react'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/ui/auth-shell'
import { cn } from '@/lib/utils'
import { adminForgotPassword } from '@/store/auth'

interface ForgotPasswordFormValues {
  email: string
}

export default function Page() {
  const [submitted, setSubmitted] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    defaultValues: { email: '' },
  })

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    // Fire-and-forget — anti-enumeration: always show success regardless of result
    await adminForgotPassword(values.email)
    setSubmitted(true)
  }

  return (
    <AuthShell data-slot="admin-forgot-password-page" maxWidth="md">

          <Logo size="sm" className="mb-8" />

          {submitted ? (
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-10 w-10 text-green-600 mb-3" aria-hidden="true" />
              <h1 className="text-[22px] font-medium leading-tight text-foreground mb-2">
                Check your email
              </h1>
              <p className="text-[15px] text-muted-foreground mb-6">
                If that address belongs to an admin account, we've sent a password reset link.
                Check your inbox (and spam folder).
              </p>
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-[24px] font-medium leading-tight text-foreground mb-1">
                  Forgot password?
                </h1>
                <p className="text-[15px] text-muted-foreground">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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

                <Button
                  type="submit"
                  className={cn('w-full h-10 mt-2')}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Send Reset Link'
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
