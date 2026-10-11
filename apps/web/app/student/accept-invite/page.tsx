'use client'

// PBA-339 — Student accept-invite page
// Route: /student/accept-invite?token=<invite-token>
// Public — no auth guard required
import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/ui/auth-shell'
import { GoogleIcon } from '@/components/ui/sso-icons'
import { studentAcceptInvite } from '@/store/auth'
import { requestGoogleIdTokenViaPopup } from '@/lib/oauth'

// ── Expired / invalid token card ───────────────────────────────────────────

function ExpiredCard() {
  return (
    <AuthShell data-slot="accept-invite-page" maxWidth="md" className="text-center">
          <Logo size="sm" className="mb-8 mx-auto" />
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="text-[20px] font-medium text-foreground mb-2">Link Expired or Invalid</h1>
          <p className="text-sm text-muted-foreground">
            Please contact your admin for a new invite link.
          </p>
    </AuthShell>
  )
}

// ── Page component ─────────────────────────────────────────────────────────

function StudentAcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
      router.replace('/dashboard')
    } catch {
      setApiError('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <AuthShell data-slot="accept-invite-page" maxWidth="md">

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

    </AuthShell>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]" />}>
      <StudentAcceptInviteContent />
    </Suspense>
  )
}
