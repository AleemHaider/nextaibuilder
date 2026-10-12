'use client'

// PBA-342 — Student login page (Google + Apple sign-in)
// Route: /login  |  Guest-only via RequireGuest — redirects to /dashboard if already authenticated
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/ui/auth-shell'
import { GoogleIcon, AppleIcon } from '@/components/ui/sso-icons'
import { loginWithGoogle, loginWithApple } from '@/store/auth'
import { requestGoogleIdTokenViaPopup, requestAppleSignIn } from '@/lib/oauth'
import { getAuthErrorMessage } from '@/lib/auth-errors'

// ── Page component ─────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter()
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
        setApiError(getAuthErrorMessage(error.error, error.message ?? ''))
        setLoadingProvider(null)
        return
      }

      void router.replace('/dashboard')
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
        setApiError(getAuthErrorMessage(error.error, error.message ?? ''))
        setLoadingProvider(null)
        return
      }

      void router.replace('/dashboard')
    } catch {
      setApiError('Something went wrong. Please try again.')
      setLoadingProvider(null)
    }
  }

  const isLoading = loadingProvider !== null

  return (
    <AuthShell data-slot="student-login-page" maxWidth="md">

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
                  <Loader2 className="h-4 w-4 animate-spin" />
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
                  <Loader2 className="h-4 w-4 animate-spin" />
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

    </AuthShell>
  )
}
