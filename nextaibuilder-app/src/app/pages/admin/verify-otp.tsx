// PBA-257 — Admin OTP verification page
// Route: /admin/login/verify-otp  |  Reads preAuthToken from router location state
import * as React from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Logo } from '@/app/components/ui/logo'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { cn } from '@/lib/utils'
import { verifyAdminOtp, adminResendOtp } from '@/store/auth'

// ── Error message mapping ──────────────────────────────────────────────────────

function getOtpErrorMessage(errorCode: string | undefined, fallback: string): string {
  switch (errorCode) {
    case 'OTP_EXPIRED':
      return 'Code has expired. Please request a new one.'
    case 'OTP_LOCKED':
      return 'Too many attempts. Please go back and log in again.'
    case 'OTP_INVALID':
      return 'Incorrect code. Please try again.'
    case 'NETWORK_ERROR':
      return 'Something went wrong. Please try again.'
    default:
      return fallback || 'Something went wrong. Please try again.'
  }
}

const RESEND_COOLDOWN_SECONDS = 60

// ── Page component ─────────────────────────────────────────────────────────────

function AdminVerifyOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const preAuthToken = (location.state as { preAuthToken?: string } | null)?.preAuthToken

  const [code, setCode] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = React.useState(0)
  const [isResending, setIsResending] = React.useState(false)

  // Redirect if no preAuthToken in state
  React.useEffect(() => {
    if (!preAuthToken) {
      navigate('/admin/login', { replace: true })
    }
  }, [preAuthToken, navigate])

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

    navigate('/admin/dashboard', { replace: true })
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
    <div
      data-slot="admin-verify-otp-page"
      className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 py-12"
    >
      <div className="w-full max-w-[440px]">
        <div className="bg-card rounded-xl border border-black/[0.08] shadow-[0px_4px_12px_rgba(0,0,0,0.08)] px-10 py-10">

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
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden="true"
                  />
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
              to="/admin/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to login
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

export { AdminVerifyOtpPage }
