'use client'

// Signup screen — SSO only (Google + Apple)
// Route: /signup  |  Redirect if authenticated: /dashboard

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'
import { loginWithGoogle, loginWithApple } from '@/store/auth'
import { loadGoogleIdentity, requestAppleSignIn } from '@/lib/oauth'
import { GoogleIcon, AppleIcon } from '@/components/ui/sso-icons'
import { AuthShell } from '@/components/ui/auth-shell'

type FormState = 'idle' | 'loading' | 'error'

export default function Page() {
  const router = useRouter()
  const [formState, setFormState] = useState<FormState>('idle')

  const isLoading = formState === 'loading'

  async function handleGoogleSignUp() {
    setFormState('loading')
    try {
      const google = await loadGoogleIdentity()
      const idToken = await google.requestIdToken()
      if (!idToken) { setFormState('idle'); return }

      const { error } = await loginWithGoogle(idToken)
      if (!error) { router.replace('/dashboard'); return }
      setFormState('error')
    } catch {
      setFormState('error')
    }
  }

  async function handleAppleSignUp() {
    setFormState('loading')
    try {
      const result = await requestAppleSignIn()
      if (!result) { setFormState('idle'); return }

      const { error } = await loginWithApple(result.idToken, result.user)
      if (!error) { router.replace('/dashboard'); return }
      setFormState('error')
    } catch {
      setFormState('error')
    }
  }

  return (
    <AuthShell data-slot="signup-page" maxWidth="md">

          {/* Logo */}
          <Logo size="sm" className="mb-8" />

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[24px] font-medium leading-tight text-brand-navy mb-1">
              Join Product Builder Academy
            </h1>
            <p className="text-[14px] text-muted-foreground">
              Create your account to get started with your setup.
            </p>
          </div>

          {/* Error banner */}
          {formState === 'error' && (
            <div
              role="alert"
              className="flex items-center gap-3 mb-5 px-3.5 py-3 rounded-lg bg-destructive/[0.06] border border-destructive/20"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-[#9b0d28]">
                Something went wrong. Please try again.
              </p>
            </div>
          )}

          {/* SSO buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={isLoading}
              className={cn(
                'flex items-center justify-center gap-2.5 w-full h-10 rounded-lg border border-black/[0.12] bg-white text-[14px] font-medium text-foreground',
                'hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              type="button"
              onClick={handleAppleSignUp}
              disabled={isLoading}
              className={cn(
                'flex items-center justify-center gap-2.5 w-full h-10 rounded-lg border border-black/[0.12] bg-black text-[14px] font-medium text-white',
                'hover:bg-black/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <AppleIcon />
              Continue with Apple
            </button>
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-center mt-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Login link */}
          <p className="mt-6 text-[14px] text-muted-foreground text-center">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-brand-blue hover:text-brand-blue-mid transition-colors"
            >
              Log in
            </Link>
          </p>

    </AuthShell>
  )
}
