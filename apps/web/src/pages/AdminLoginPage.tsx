// FIR-35 — Admin login page (email + password, optional OTP redirect)
// Reskinned to Wise theme per DESIGN.md (root workspace)
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AlertTriangle, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { adminLogin } from '../lib/api'
import { Logo } from '../components/Logo'
import { cn } from '../lib/utils'
import { usePageMeta } from '../hooks/usePageMeta'

// ---------------------------------------------------------------------------
// Shared admin left panel — Wise-themed
// ---------------------------------------------------------------------------
interface AdminLeftPanelProps {
  tagline: string
}

export function AdminLeftPanel({ tagline }: AdminLeftPanelProps) {
  return (
    <div
      className={cn(
        'relative flex w-[500px] shrink-0 flex-col items-start justify-center',
        'overflow-hidden px-20 py-20 min-h-screen',
        'bg-[#1a2744] text-white',
      )}
    >
      {/* Navy-tinted blob — decorative background accents */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -bottom-24 -right-24 h-[420px] w-[420px] rounded-full',
          'bg-[#4a9ad4]/15 blur-3xl',
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -top-20 -left-20 h-[240px] w-[240px] rounded-full',
          'bg-[#4a9ad4]/5 blur-2xl',
        )}
      />

      <div className="relative z-10 max-w-[340px]">
        <div className="mb-12">
          <Logo size="md" variant="dark" />
        </div>

        <div
          className={cn(
            'mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5',
            'bg-[#4a9ad4]/15 text-[#4a9ad4] text-[13px] font-semibold',
            'ring-1 ring-[#4a9ad4]/25',
          )}
        >
          <Lock className="h-3.5 w-3.5" strokeWidth={2.5} />
          Admin Portal
        </div>

        <h1
          className={cn(
            'text-[44px] leading-[0.9] tracking-[-1.5px] text-white mb-5',
            'font-black',
          )}
          style={{ fontFeatureSettings: '"calt"' }}
        >
          {tagline}
        </h1>
        <p className="text-[17px] leading-[1.55] text-white/55">
          Manage cohorts, enrollments, payments, and your team from one powerful dashboard.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared input styles
// ---------------------------------------------------------------------------
const inputBase = cn(
  'w-full h-12 rounded-xl px-4 text-[15px] font-medium',
  'bg-white text-[#1a2744] placeholder:text-[#717182]',
  'border outline-none transition-[border-color,box-shadow,background]',
  'focus:bg-white focus:ring-4 focus:ring-[#4a9ad4]/25',
)

// ---------------------------------------------------------------------------
// AdminLoginPage
// ---------------------------------------------------------------------------
export default function AdminLoginPage() {
  usePageMeta({ title: 'Admin sign in' })
  const { isAuthenticated, isLoading, user, login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        navigate('/admin/dashboard', { replace: true })
      }
    }
  }, [isAuthenticated, isLoading, user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    try {
      const result = await adminLogin(email, password)

      if ('twoFactorRequired' in result && result.twoFactorRequired) {
        navigate('/admin/verify-otp', {
          state: { preAuthToken: result.preAuthToken, email },
        })
      } else {
        const authResult = result as { accessToken: string; user: import('../lib/api').AuthUser }
        login(authResult.accessToken, authResult.user)
        navigate('/admin/dashboard', { replace: true })
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Invalid email or password. Please check your credentials and try again.',
      )
    } finally {
      setIsPending(false)
    }
  }

  if (isLoading) return null

  const hasError = error !== null

  return (
    <div className="flex min-h-screen w-full bg-[#f8f9fb]">
      <AdminLeftPanel tagline="Course administration made simple." />

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <form
          onSubmit={handleSubmit}
          noValidate
          className={cn(
            'w-full max-w-[460px] rounded-[30px] bg-white p-10',
            'shadow-[0_0_0_1px_rgba(26,39,68,0.08),0_24px_60px_-24px_rgba(26,39,68,0.18)]',
          )}
          aria-label="Admin sign in form"
        >
          <h1
            className="text-[36px] font-black text-[#1a2744] tracking-[-1px] mb-1.5"
            style={{ fontFeatureSettings: '"calt"' }}
          >
            Admin Sign In
          </h1>
          <p className="text-[16px] text-[#717182] mb-9">
            Access the nextaibuilder admin portal
          </p>

          {hasError && (
            <div
              role="alert"
              className={cn(
                'mb-6 flex items-start gap-2.5 rounded-2xl px-4 py-3.5',
                'bg-[#fef2f2] ring-1 ring-[#d4183d]/25',
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[#d4183d]" strokeWidth={2.5} />
              <p className="text-[14px] font-semibold leading-snug text-[#d4183d]">
                {error}
              </p>
            </div>
          )}

          {/* Email */}
          <label htmlFor="admin-email" className="block mb-1.5 text-[14px] font-semibold text-[#1a2744]">
            Email address
          </label>
          <div className="relative mb-5">
            <Mail
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#717182]"
              strokeWidth={2.25}
              aria-hidden="true"
            />
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              placeholder="admin@nextaibuilder.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={cn(inputBase, 'pl-11', hasError ? 'border-[#d4183d] bg-[#fef2f2]' : 'border-[rgba(26,39,68,0.12)]')}
            />
          </div>

          {/* Password */}
          <label htmlFor="admin-password" className="block mb-1.5 text-[14px] font-semibold text-[#1a2744]">
            Password
          </label>
          <div className="relative mb-2">
            <Lock
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#717182]"
              strokeWidth={2.25}
              aria-hidden="true"
            />
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={cn(inputBase, 'pl-11', hasError ? 'border-[#d4183d] bg-[#fef2f2]' : 'border-[rgba(26,39,68,0.12)]')}
            />
          </div>

          <div className="flex justify-end mb-6">
            <Link
              to="/admin/forgot-password"
              className="text-[13px] font-semibold text-[#0d1a3a] hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit — navy blue pill */}
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              'w-full h-[52px] rounded-full',
              'bg-[#4a9ad4] text-white text-[16px] font-bold',
              'border-none cursor-pointer',
              'transition-transform duration-150 ease-out',
              'hover:enabled:scale-[1.02] active:enabled:scale-[0.98]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus-visible:outline-2 focus-visible:outline-[#0d1a3a] focus-visible:outline-offset-2',
            )}
          >
            {isPending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
