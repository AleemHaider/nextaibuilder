// PBA-260 — Admin forgot password page
// Route: /admin/forgot-password  |  Guest-only
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { Logo } from '@/app/components/ui/logo'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { cn } from '@/lib/utils'
import { adminForgotPassword } from '@/store/auth'

interface ForgotPasswordFormValues {
  email: string
}

function AdminForgotPasswordPage() {
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
    <div
      data-slot="admin-forgot-password-page"
      className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 py-12"
    >
      <div className="w-full max-w-[440px]">
        <div className="bg-card rounded-xl border border-black/[0.08] shadow-[0px_4px_12px_rgba(0,0,0,0.08)] px-10 py-10">

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
                to="/admin/login"
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
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                        aria-hidden="true"
                      />
                      Sending…
                    </>
                  ) : (
                    'Send Reset Link'
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

export { AdminForgotPasswordPage }
