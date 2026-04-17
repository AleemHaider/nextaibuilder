// PBA-342 — Student login page (Google + Apple sign-in)
// Route: /login  |  Guest-only via RequireGuest — redirects to /dashboard if already authenticated
import * as React from 'react'
import { useNavigate } from 'react-router'
import { AlertCircle } from 'lucide-react'
import { Logo } from '@/app/components/ui/logo'
import { Button } from '@/app/components/ui/button'
import { loginWithGoogle, loginWithApple } from '@/store/auth'
import { requestGoogleIdTokenViaPopup, requestAppleSignIn } from '@/lib/oauth'

// ── Google sign-in button icon (inline SVG) ────────────────────────────────

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

// ── Apple sign-in button icon (inline SVG) ─────────────────────────────────

function AppleIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="18"
      viewBox="0 0 814 1000"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.4 135.4-317 268.1-317 70.6 0 129.2 46.4 173.4 46.4 42.8 0 109.8-49 192.5-49 31.2 0 108.2 2.6 168.3 76.1zm-126.8-174.9c31.2-37.7 54.5-90.5 54.5-143.4 0-7.1-.6-14.3-1.9-20.8-51.4 2-112.3 34.5-148.4 78.3-28.5 32.4-55.1 83.1-55.1 136.7 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 46.4 0 102.8-30.5 135.4-70.2z" />
    </svg>
  )
}

// ── Error message mapping ──────────────────────────────────────────────────────

function getErrorMessage(errorCode: string | undefined, fallback: string): string {
  switch (errorCode) {
    case 'NOT_ENROLLED':
      return 'You are not enrolled in Product Builder Academy. Please contact your administrator.'
    case 'ACCOUNT_INACTIVE':
    case 'ACCOUNT_REVOKED':
      return 'Your account is inactive. Please contact your admin.'
    case 'NETWORK_ERROR':
      return 'Something went wrong. Please try again.'
    default:
      return fallback || 'Something went wrong. Please try again.'
  }
}

// ── Page component ─────────────────────────────────────────────────────────────

function StudentLoginPage() {
  const navigate = useNavigate()
  const [loadingProvider, setLoadingProvider] = React.useState<'google' | 'apple' | null>(null)
  const [apiError, setApiError] = React.useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setLoadingProvider('google')
    setApiError(null)

    try {
      const idToken = await requestGoogleIdTokenViaPopup()

      if (!idToken) {
        setLoadingProvider(null)
        return
      }

      const { error } = await loginWithGoogle(idToken)

      if (error) {
        setApiError(getErrorMessage(error.error, error.message ?? ''))
        setLoadingProvider(null)
        return
      }

      void navigate('/dashboard', { replace: true })
    } catch {
      setApiError('Something went wrong. Please try again.')
      setLoadingProvider(null)
    }
  }

  const handleAppleSignIn = async () => {
    setLoadingProvider('apple')
    setApiError(null)

    try {
      const result = await requestAppleSignIn()

      if (!result) {
        setLoadingProvider(null)
        return
      }

      const { error } = await loginWithApple(result.idToken, result.user)

      if (error) {
        setApiError(getErrorMessage(error.error, error.message ?? ''))
        setLoadingProvider(null)
        return
      }

      void navigate('/dashboard', { replace: true })
    } catch {
      setApiError('Something went wrong. Please try again.')
      setLoadingProvider(null)
    }
  }

  const isLoading = loadingProvider !== null

  return (
    <div
      data-slot="student-login-page"
      className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 py-12"
    >
      <div className="w-full max-w-[440px]">
        <div className="bg-card rounded-xl border border-black/[0.08] shadow-[0px_4px_12px_rgba(0,0,0,0.08)] px-10 py-10">

          {/* Logo */}
          <Logo size="sm" className="mb-8" />

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[24px] font-medium leading-tight text-foreground mb-1">
              Welcome back
            </h1>
            <p className="text-[15px] text-muted-foreground">
              Sign in to continue to your dashboard
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

          {/* Sign-in buttons */}
          <div className="flex flex-col gap-3">
            {/* Google */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-10 gap-2.5 font-medium"
              onClick={() => void handleGoogleSignIn()}
              disabled={isLoading}
            >
              {loadingProvider === 'google' ? (
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

            {/* Apple */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-10 gap-2.5 font-medium"
              onClick={() => void handleAppleSignIn()}
              disabled={isLoading}
            >
              {loadingProvider === 'apple' ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden="true"
                  />
                  Signing in…
                </>
              ) : (
                <>
                  <AppleIcon />
                  Continue with Apple
                </>
              )}
            </Button>
          </div>

        </div>
      </div>
    </div>
  )
}

export { StudentLoginPage }
