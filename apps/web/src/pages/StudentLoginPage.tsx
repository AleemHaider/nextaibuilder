// FIR-155 — Student OAuth login page (Google + Apple)
// Sprint 3 Story 14 — Wise theme migration. The left hero is now the Wise
// dark-green panel (mirroring AdminLoginPage) and the right card uses Wave 6
// primitives (<Button>, <Input>, <FormField>). Business logic is untouched —
// the OAuth-only reconciliation is tracked as a separate story.
import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { AlertTriangle, Check, Lock, Mail, Star } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { loginWithGoogle, loginWithApple, loginStudent } from '../lib/api'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Input } from '../components/ui/Input'
import { Logo } from '../components/Logo'
import { usePageMeta } from '../hooks/usePageMeta'

// ---------------------------------------------------------------------------
// SSO icons — kept as inline SVGs so Google's brand colours remain literal
// and Apple's monochrome wordmark stays crisp. These are brand assets, not
// raw style hex, so they stay out of the "hex sweep" for this story.
// ---------------------------------------------------------------------------
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.1-6.1C34.39 3.13 29.45 1 24 1 14.82 1 6.96 6.43 3.18 14.3l7.08 5.5C12.04 13.58 17.56 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.64 24.52c0-1.64-.15-3.22-.43-4.74H24v9h12.74c-.55 2.98-2.2 5.5-4.7 7.2l7.18 5.58C43.26 37.74 46.64 31.62 46.64 24.52z" />
      <path fill="#FBBC05" d="M10.26 28.2a14.53 14.53 0 0 1 0-8.4L3.18 14.3A23.94 23.94 0 0 0 0 24c0 3.86.93 7.5 2.58 10.7l7.68-5.97-.01-.53z" />
      <path fill="#34A853" d="M24 47c5.45 0 10.03-1.8 13.37-4.9l-7.18-5.58C28.4 38.36 26.3 39 24 39c-6.44 0-11.96-4.08-13.74-9.8l-7.68 5.97C6.96 41.57 14.82 47 24 47z" />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="15" height="19" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.8-162.5-116.8C181.3 742 118 637.5 118 537c0-175.9 114.4-269.3 228.7-269.3 60.3 0 110.6 39.5 148.4 39.5 36 0 92.7-41.8 160.8-41.8 28.2 0 130.6 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Left-panel perks
// ---------------------------------------------------------------------------
const PERKS = [
  'Project-first curriculum — ship something real',
  'AI-validated tool setup at every step',
  'Live instructor Q&A and code reviews',
  'Verified certificate on completion',
]

// ---------------------------------------------------------------------------
// StudentLoginPage
// ---------------------------------------------------------------------------
export default function StudentLoginPage() {
  usePageMeta({ title: 'Sign in' })
  const { isAuthenticated, isLoading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    '/student/dashboard'

  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, isLoading, navigate, from])

  async function handleGoogleLogin() {
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      setError('Google login is not configured yet — set VITE_GOOGLE_CLIENT_ID in .env')
      return
    }
    setError(null)
    setIsPending(true)
    try {
      const result = await loginWithGoogle('STUB_ID_TOKEN')
      login(result.accessToken, result.user)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed')
    } finally {
      setIsPending(false)
    }
  }

  async function handleAppleLogin() {
    if (!import.meta.env.VITE_APPLE_CLIENT_ID) {
      setError('Apple login is not configured yet — set VITE_APPLE_CLIENT_ID in .env')
      return
    }
    setError(null)
    setIsPending(true)
    try {
      const result = await loginWithApple('STUB_ID_TOKEN')
      login(result.accessToken, result.user)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apple login failed')
    } finally {
      setIsPending(false)
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setError(null)
    setIsPending(true)
    try {
      const result = await loginStudent(email, password)
      login(result.accessToken, result.user)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsPending(false)
    }
  }

  if (isLoading) return null

  const hasError = error !== null

  return (
    <div className="flex min-h-screen w-full bg-[var(--color-wise-canvas)]">
      <style>{`
        @media (max-width: 768px) {
          .login-left-panel { display: none !important; }
          .login-right-panel { min-width: 0 !important; width: 100% !important; }
          .login-right-inner { padding: 32px 20px !important; }
          .login-topbar { padding: 16px 20px !important; }
        }
      `}</style>

      {/* ================================================================== */}
      {/* LEFT PANEL — Wise dark-green hero                                     */}
      {/* ================================================================== */}
      <div
        className={cn(
          'login-left-panel relative flex w-[500px] shrink-0 flex-col',
          'justify-between overflow-hidden px-14 py-14 min-h-screen',
          'bg-[var(--color-wise-dark)] text-white',
        )}
      >
        {/* Lime blobs */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -bottom-24 -right-24',
            'h-[420px] w-[420px] rounded-full',
            'bg-[var(--color-wise-primary)]/15 blur-3xl',
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -top-20 -left-20',
            'h-[240px] w-[240px] rounded-full',
            'bg-[var(--color-wise-primary)]/5 blur-2xl',
          )}
        />

        {/* Top */}
        <div className="relative z-10 max-w-[380px]">
          <div className="mb-12">
            <Logo size="md" variant="dark" />
          </div>

          <h1
            className={cn(
              'text-[44px] leading-[0.9] tracking-[-1.5px] mb-5 font-black text-white',
            )}
            style={{ fontFeatureSettings: '"calt"' }}
          >
            Welcome back, builder.
          </h1>
          <p className="text-[17px] leading-[1.55] text-white/55 mb-10">
            Sign in to continue your learning journey and pick up right where
            you left off.
          </p>

          {/* Perks list */}
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {PERKS.map((p) => (
              <li
                key={p}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5',
                  'bg-white/5 border border-white/10',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0',
                    'bg-[var(--color-wise-primary)]/20 text-[var(--color-wise-primary)]',
                    'border border-[var(--color-wise-primary)]/40',
                  )}
                  aria-hidden="true"
                >
                  <Check size={12} strokeWidth={2.75} />
                </span>
                <span className="text-[13px] font-medium text-white/75 leading-[1.4]">
                  {p}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom — rating chip */}
        <div className="relative z-10">
          <div
            className={cn(
              'rounded-[var(--radius-md)] px-5 py-4',
              'bg-white/[0.06] border border-white/10',
            )}
          >
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={13}
                  className="text-[var(--color-wise-primary)]"
                  fill="currentColor"
                  strokeWidth={0}
                  aria-hidden="true"
                />
              ))}
              <span className="ml-1.5 text-[12px] text-white/60 font-semibold">
                4.9/5 — 500+ builders enrolled
              </span>
            </div>
            <p className="text-[13px] italic leading-[1.6] text-white/70">
              "Within 3 weeks I shipped a working AI tool and landed a $120k
              offer. This cohort changed my career trajectory."
            </p>
            <p className="mt-3 text-[12px] text-white/50">
              — Sarah R., cohort graduate
            </p>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* RIGHT PANEL — Login Form                                            */}
      {/* ================================================================== */}
      <div
        className="login-right-panel flex flex-1 flex-col bg-[var(--color-wise-canvas)]"
      >
        {/* Top bar */}
        <div
          className={cn(
            'login-topbar flex items-center justify-between',
            'border-b border-[var(--color-wise-ring)] bg-white',
          )}
          style={{ padding: '20px 40px' }}
        >
          <span className="text-[13px] text-[var(--color-wise-text-muted)]">
            New here?
          </span>
          <Button variant="outline" size="sm" onClick={() => navigate('/signup')}>
            Create account
          </Button>
        </div>

        {/* Form centered */}
        <div
          className={cn(
            'login-right-inner flex flex-1 flex-col items-center justify-center',
          )}
          style={{ padding: 48 }}
        >
          <div
            className={cn(
              'w-full max-w-[460px] rounded-[30px] bg-white p-10',
              'shadow-[var(--shadow-card)]',
            )}
          >
            <h1
              className={cn(
                'text-[36px] font-black text-[var(--color-wise-text)]',
                'tracking-[-1px] mb-1.5',
              )}
              style={{ fontFeatureSettings: '"calt"' }}
            >
              Sign in
            </h1>
            <p className="text-[15px] text-[var(--color-wise-text-muted)] mb-7 leading-[1.5]">
              Continue your learning journey where you left off.
            </p>

            {/* Error alert */}
            {hasError && (
              <div
                role="alert"
                className={cn(
                  'mb-6 flex items-start gap-2.5 rounded-2xl px-4 py-3.5',
                  'bg-[var(--color-wise-danger-soft)]',
                  'ring-1 ring-[var(--color-wise-danger)]/25',
                )}
              >
                <AlertTriangle
                  className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-wise-danger)]"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <p className="text-[14px] font-semibold leading-snug text-[var(--color-wise-danger)]">
                    {error}
                  </p>
                  {error!.toLowerCase().includes('google') && (
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className={cn(
                        'mt-3 inline-flex items-center gap-2 rounded-full',
                        'bg-white px-4 py-1.5 text-[13px] font-[700]',
                        'text-[var(--color-wise-text)]',
                        'border border-[var(--color-wise-ring-strong)]',
                        'hover:bg-[var(--color-wise-canvas)] cursor-pointer transition-colors',
                      )}
                    >
                      <GoogleIcon /> Sign in with Google instead
                    </button>
                  )}
                  {error!.toLowerCase().includes('no account') && (
                    <Link
                      to="/signup"
                      className={cn(
                        'mt-3 inline-flex items-center gap-1.5 rounded-full',
                        'bg-[var(--color-wise-primary)] px-4 py-1.5',
                        'text-[13px] font-[700] text-[var(--color-wise-primary-text)]',
                        'no-underline hover:bg-[var(--color-wise-primary-hover)] transition-colors',
                      )}
                    >
                      Create a free account
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Google OAuth button */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleGoogleLogin}
              disabled={isPending}
              leftIcon={<GoogleIcon />}
              className="w-full mb-2.5"
            >
              Continue with Google
            </Button>

            {/* Apple OAuth button — dark chrome */}
            <button
              type="button"
              onClick={handleAppleLogin}
              disabled={isPending}
              className={cn(
                'w-full h-[52px] rounded-full inline-flex items-center justify-center gap-2.5',
                'bg-[var(--color-wise-dark)] text-white',
                'text-[15px] font-semibold cursor-pointer',
                'transition-transform duration-150 ease-out',
                'hover:enabled:scale-[1.02] active:enabled:scale-[0.98]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2',
                'border-none',
              )}
            >
              <AppleIcon />
              Continue with Apple
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[var(--color-wise-ring)]" />
              <span className="text-[11px] uppercase tracking-[0.8px] font-semibold text-[var(--color-wise-text-muted)]">
                or continue with email
              </span>
              <div className="flex-1 h-px bg-[var(--color-wise-ring)]" />
            </div>

            {/* Email + Password form */}
            <form onSubmit={handleEmailLogin} noValidate>
              <div className="flex flex-col gap-4 mb-2">
                <FormField id="student-email" label="Email address">
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    inputSize="lg"
                    hasError={hasError}
                    leftIcon={<Mail size={16} strokeWidth={2.25} />}
                  />
                </FormField>
                <FormField id="student-password" label="Password">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    inputSize="lg"
                    hasError={hasError}
                    leftIcon={<Lock size={16} strokeWidth={2.25} />}
                  />
                </FormField>
              </div>

              {/* Forgot password */}
              <div className="flex justify-end mt-2 mb-5">
                <Link
                  to="/admin/forgot-password"
                  className="text-[13px] font-semibold text-[var(--color-wise-primary-text)] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Sign In CTA */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isPending}
                className="w-full"
              >
                {isPending ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>

            {/* Sign up link */}
            <p className="mt-5 text-center text-[13px] text-[var(--color-wise-text-muted)]">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="text-[var(--color-wise-primary-text)] font-semibold hover:underline"
              >
                Create one free
              </Link>
            </p>

            {/* Admin link */}
            <p className="mt-3 text-center text-[12px] text-[var(--color-wise-text-muted)] opacity-70">
              Admin?{' '}
              <Link
                to="/admin/login"
                className="font-semibold hover:underline"
              >
                Sign in to admin portal
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
