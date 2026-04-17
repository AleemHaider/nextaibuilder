// PBA-339 — Student accept-invite page
// Route: /student/accept-invite?token=<invite-token>
// Public — no auth guard required
import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AlertCircle } from 'lucide-react'
import { Logo } from '@/app/components/ui/logo'
import { Button } from '@/app/components/ui/button'
import { studentAcceptInvite } from '@/store/auth'
import { requestGoogleIdTokenViaPopup } from '@/lib/oauth'

// ── Google sign-in button (inline SVG wordmark) ────────────────────────────

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}

// ── Expired / invalid token card ───────────────────────────────────────────

function ExpiredCard() {
  return (
    <div
      data-slot="accept-invite-page"
      className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 py-12"
    >
      <div className="w-full max-w-[440px]">
        <div className="bg-card rounded-xl border border-black/[0.08] shadow-[0px_4px_12px_rgba(0,0,0,0.08)] px-10 py-10 text-center">
          <Logo size="sm" className="mb-8 mx-auto" />
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="text-[20px] font-medium text-foreground mb-2">Link Expired or Invalid</h1>
          <p className="text-sm text-muted-foreground">
            Please contact your admin for a new invite link.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Page component ─────────────────────────────────────────────────────────

function StudentAcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [isLoading, setIsLoading] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [isExpired, setIsExpired] = React.useState(false)

  // No token → show expired card immediately
  if (!token || isExpired) {
    return <ExpiredCard />
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setApiError(null)

    try {
      const idToken = await requestGoogleIdTokenViaPopup()

      if (!idToken) {
        // User closed the popup without completing sign-in
        setIsLoading(false)
        return
      }

      const { error } = await studentAcceptInvite(token, idToken)

      if (error) {
        if (error.error === 'EMAIL_MISMATCH') {
          setApiError(
            'The Google account you used does not match your invite email. Please try a different Google account.',
          )
          setIsLoading(false)
          return
        }

        if (
          error.error === 'INVALID_TOKEN' ||
          error.error === 'INVITE_ALREADY_ACCEPTED'
        ) {
          setIsExpired(true)
          return
        }

        setApiError(error.message ?? 'Something went wrong. Please try again.')
        setIsLoading(false)
        return
      }

      // Success — navigate to dashboard
      void navigate('/dashboard', { replace: true })
    } catch {
      setApiError('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div
      data-slot="accept-invite-page"
      className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 py-12"
    >
      <div className="w-full max-w-[440px]">
        <div className="bg-card rounded-xl border border-black/[0.08] shadow-[0px_4px_12px_rgba(0,0,0,0.08)] px-10 py-10">

          {/* Logo */}
          <Logo size="sm" className="mb-8" />

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[24px] font-medium leading-tight text-foreground mb-1">
              Complete your registration
            </h1>
            <p className="text-[15px] text-muted-foreground">
              Sign in with your Google account to activate your PBA account
            </p>
          </div>

          {/* Error banner */}
          {apiError && (
            <div
              role="alert"
              className="flex items-start gap-3 mb-5 px-3.5 py-3 rounded-lg bg-destructive/[0.06] border border-destructive/20"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
              <p className="text-sm text-destructive">{apiError}</p>
            </div>
          )}

          {/* Google sign-in button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 gap-2.5 font-medium"
            onClick={() => void handleGoogleSignIn()}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
                Signing in…
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </Button>

        </div>
      </div>
    </div>
  )
}

export { StudentAcceptInvitePage }
