'use client'
// PBA-257 — Admin OTP verification page
// Route: /admin/login/verify-otp  |  Reads preAuthToken from sessionStorage
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/ui/auth-shell'
import { cn } from '@/lib/utils'
import { verifyAdminOtp, adminResendOtp } from '@/store/auth'
import { getOtpErrorMessage } from '@/lib/auth-errors'

const RESEND_COOLDOWN_SECONDS = 60

// ── Page component ─────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter()
  const [preAuthToken, setPreAuthToken] = React.useState<string | undefined>()

  React.useEffect(() => {
    const token = sessionStorage.getItem('preAuthToken')
    if (token) {
      setPreAuthToken(token)
      sessionStorage.removeItem('preAuthToken')
    }
  }, [])

  const [code, setCode] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = React.useState(0)
  const [isResending, setIsResending] = React.useState(false)

  // Redirect if no preAuthToken in sessionStorage
  React.useEffect(() => {
    if (preAuthToken === undefined) return // still loading
    if (!preAuthToken) {
      router.replace('/admin/login')
    }
  }, [preAuthToken, router])

  // Countdown timer for resend button
  React.useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!preAuthToken || code.length !== 6) return

    setIsSubmitting(true)
    setApiError(null)

    const { error } = await verifyAdminOtp(preAuthToken, code)

    setIsSubmitting(false)

    if (error) {
      setApiError(getOtpErrorMessage(error.error, error.message ?? ''))
      return
    }

    router.replace('/admin/dashboard')
  }

  const handleResend = async () => {
    if (!preAuthToken || resendCooldown > 0 || isResending) return

    setIsResending(true)
    setApiError(null)

    const { error } = await adminResendOtp(preAuthToken)

    setIsResending(false)

    if (error) {
      setApiError(getOtpErrorMessage(error.error, error.message ?? ''))
      return
    }

    setResendCooldown(RESEND_COOLDOWN_SECONDS)
  }

  if (!preAuthToken) return null

  return (
    <AuthShell data-slot="admin-verify-otp-page" maxWidth="md">

          {/* Logo */}
          <Logo size="sm" className="mb-8" />

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[24px] font-medium leading-tight text-foreground mb-1">
              Two-Factor Authentication
            </h1>
            <p className="text-[15px] text-muted-foreground">
              Enter the 6-digit code sent to your email
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
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* OTP input */}
            <div className="space-y-1.5">
              <Label htmlFor="otp-code">Verification Code</Label>
              <Input
                id="otp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setCode(val)
                  setApiError(null)
                }}
                className="text-2xl tracking-widest text-center font-medium h-14"
                aria-describedby="otp-hint"
              />
              <p id="otp-hint" className="text-xs text-muted-foreground">
                The code expires in 10 minutes.
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className={cn('w-full h-10')}
              disabled={isSubmitting || code.length !== 6}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                'Verify Code'
              )}
            </Button>

          </form>

          {/* Resend section */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <span>Didn&apos;t receive a code?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isResending}
              className={cn(
                'font-medium transition-colors',
                resendCooldown > 0 || isResending
                  ? 'text-muted-foreground cursor-not-allowed'
                  : 'text-foreground hover:text-foreground/70 underline underline-offset-4',
              )}
            >
              {isResending
                ? 'Sending…'
                : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend'}
            </button>
          </div>

          {/* Back to login */}
          <div className="mt-4 flex justify-center">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to login
            </Link>
          </div>

    </AuthShell>
  )
}
