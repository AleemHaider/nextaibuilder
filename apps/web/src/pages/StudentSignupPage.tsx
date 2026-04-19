// FIR-155 — Student sign-up page (email + password self-serve)
// Sprint 3 Story 14 — Wise theme migration. Left hero + right form both
// re-skinned to match AdminLoginPage / StudentLoginPage: dark-green panel,
// white 30px card, Wave 6 primitives, lucide icons.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AlertTriangle, Check, Mail, Star, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { loginWithGoogle, registerStudent } from '../lib/api'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Input } from '../components/ui/Input'
import { Logo } from '../components/Logo'
import { usePageMeta } from '../hooks/usePageMeta'

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

const PERKS = [
  'Project-first curriculum — ship something real',
  'AI-validated tool setup and workflow',
  'Live instructor Q&A every week',
  'Certificate of completion + LinkedIn badge',
]

export default function StudentSignupPage() {
  usePageMeta({ title: 'Create account' })
  const { isAuthenticated, isLoading, login } = useAuth()
  const navigate = useNavigate()

  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate('/student/dashboard', { replace: true })
  }, [isAuthenticated, isLoading, navigate])

  async function handleGoogleSignup() {
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      setError('Google sign-up is not configured yet.')
      return
    }
    setError(null)
    setIsPending(true)
    try {
      const result = await loginWithGoogle('STUB_ID_TOKEN')
      login(result.accessToken, result.user)
      navigate('/student/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-up failed')
    } finally {
      setIsPending(false)
    }
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName || !email || !password) {
      setError('Please fill in all required fields.')
      return
    }
    setError(null)
    setIsPending(true)
    try {
      const result = await registerStudent({ email, password, firstName, lastName })
      login(result.accessToken, result.user)
      navigate('/student/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed')
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
          .signup-left-panel { display: none !important; }
          .signup-right-panel { min-width: 0 !important; width: 100% !important; }
          .signup-right-inner { padding: 32px 20px !important; }
          .signup-topbar { padding: 16px 20px !important; }
          .signup-name-row { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ================================================================== */}
      {/* LEFT PANEL                                                           */}
      {/* ================================================================== */}
      <div
        className={cn(
          'signup-left-panel relative flex w-[500px] shrink-0 flex-col',
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

          <div
            className={cn(
              'mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5',
              'bg-[var(--color-wise-primary)]/15',
              'text-[var(--color-wise-primary)]',
              'ring-1 ring-[var(--color-wise-primary)]/25',
              'text-[13px] font-semibold',
            )}
          >
            FREE TO JOIN
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-wise-primary)]" aria-hidden="true" />
            <span className="text-white/60 font-medium">No credit card needed</span>
          </div>

          <h1
            className={cn(
              'text-[44px] leading-[0.9] tracking-[-1.5px] mb-5 font-black text-white',
            )}
            style={{ fontFeatureSettings: '"calt"' }}
          >
            Start your builder journey.
          </h1>
          <p className="text-[17px] leading-[1.55] text-white/55 mb-10">
            Create a free account to browse courses, watch preview lessons, and
            join a cohort when you're ready.
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

        {/* Bottom — trust stats */}
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
                4.9/5 — 500+ builders joined
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 border-t border-white/10 pt-3">
              {[
                { val: '500+', label: 'Students' },
                { val: '12', label: 'Cohorts' },
                { val: '98%', label: 'Satisfaction' },
                { val: '4.9', label: 'Rating' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-[17px] font-[900] text-white tracking-[-0.5px] leading-none">
                    {s.val}
                  </p>
                  <p className="text-[10px] text-white/40 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* RIGHT PANEL — Sign Up Form                                          */}
      {/* ================================================================== */}
      <div className="signup-right-panel flex flex-1 flex-col bg-[var(--color-wise-canvas)]">
        {/* Top bar */}
        <div
          className={cn(
            'signup-topbar flex items-center justify-between bg-white',
            'border-b border-[var(--color-wise-ring)]',
          )}
          style={{ padding: '20px 40px' }}
        >
          <span className="text-[13px] text-[var(--color-wise-text-muted)]">
            Already have an account?
          </span>
          <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </div>

        {/* Form */}
        <div
          className="signup-right-inner flex flex-1 flex-col items-center justify-center"
          style={{ padding: '40px 48px' }}
        >
          <div
            className={cn(
              'w-full max-w-[480px] rounded-[30px] bg-white p-10',
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
              Create your account
            </h1>
            <p className="text-[15px] text-[var(--color-wise-text-muted)] mb-7 leading-[1.5]">
              Free to join — no credit card required.
            </p>

            {/* Error */}
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
                  {error!.toLowerCase().includes('already exists') && (
                    <Link
                      to="/login"
                      className={cn(
                        'mt-3 inline-flex items-center gap-1.5 rounded-full',
                        'bg-[var(--color-wise-primary)] px-4 py-1.5',
                        'text-[13px] font-[700] text-[var(--color-wise-primary-text)]',
                        'no-underline hover:bg-[var(--color-wise-primary-hover)] transition-colors',
                      )}
                    >
                      Sign in to your account
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Google button */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleGoogleSignup}
              disabled={isPending}
              leftIcon={<GoogleIcon />}
              className="w-full mb-5"
            >
              Continue with Google
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-[var(--color-wise-ring)]" />
              <span className="text-[11px] uppercase tracking-[0.8px] font-semibold text-[var(--color-wise-text-muted)]">
                or sign up with email
              </span>
              <div className="flex-1 h-px bg-[var(--color-wise-ring)]" />
            </div>

            {/* Registration form */}
            <form onSubmit={handleEmailSignup} noValidate>
              {/* Name row */}
              <div className="signup-name-row grid grid-cols-2 gap-3 mb-3.5">
                <FormField id="first-name" label="First name" required>
                  <Input
                    type="text"
                    autoComplete="given-name"
                    placeholder="Alex"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    inputSize="lg"
                    leftIcon={<User size={16} strokeWidth={2.25} />}
                  />
                </FormField>
                <FormField id="last-name" label="Last name">
                  <Input
                    type="text"
                    autoComplete="family-name"
                    placeholder="Kim"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    inputSize="lg"
                  />
                </FormField>
              </div>

              {/* Email */}
              <FormField
                id="signup-email"
                label="Email address"
                required
                className="mb-3.5"
              >
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

              {/* Password */}
              <FormField
                id="signup-password"
                label="Password"
                required
                helperText="Must be 8+ characters with 1 uppercase letter and 1 number."
                className="mb-6"
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  inputSize="lg"
                  hasError={hasError}
                />
              </FormField>

              {/* Submit */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isPending}
                className="w-full"
              >
                {isPending ? 'Creating account…' : 'Create Account →'}
              </Button>

              <p className="text-[11px] text-[var(--color-wise-text-muted)] text-center leading-[1.6] mt-4">
                By signing up, you agree to our{' '}
                <a
                  href="#"
                  className="text-[var(--color-wise-text-warm)] underline"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="#"
                  className="text-[var(--color-wise-text-warm)] underline"
                >
                  Privacy Policy
                </a>
              </p>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className={cn(
            'flex items-center justify-center bg-white',
            'border-t border-[var(--color-wise-ring)]',
          )}
          style={{ padding: '16px 40px' }}
        >
          <p className="text-[12px] text-[var(--color-wise-text-muted)]">
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
  )
}
