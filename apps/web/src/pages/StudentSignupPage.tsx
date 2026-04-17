// FIR-155 — Student sign-up page (email + password self-serve)
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { loginWithGoogle, registerStudent } from '../lib/api'

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

const AVATARS = [
  { initials: 'AK', bg: '#4a9ad4' },
  { initials: 'SR', bg: '#ff8c5a' },
  { initials: 'MJ', bg: '#7bb8e0' },
  { initials: 'PL', bg: '#2d5a8e' },
  { initials: 'TW', bg: '#4a9ad4' },
]

const PERKS = [
  { text: 'Project-first curriculum — ship something real' },
  { text: 'AI-validated tool setup and workflow' },
  { text: 'Live instructor Q&A every week' },
  { text: 'Certificate of completion + LinkedIn badge' },
]

function inputStyle(focused: boolean): React.CSSProperties {
  return {
    width: '100%',
    height: 48,
    borderRadius: 12,
    border: `1.5px solid ${focused ? '#4a9ad4' : 'rgba(26,39,68,0.1)'}`,
    background: focused ? '#fff' : '#f9fafb',
    padding: '0 14px',
    fontSize: 14,
    color: '#1a2744',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
    boxShadow: focused ? '0 0 0 3px rgba(74,154,212,0.12)' : 'none',
  }
}

export default function StudentSignupPage() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const navigate = useNavigate()

  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [googleHov, setGoogleHov] = useState(false)
  const [submitHov, setSubmitHov] = useState(false)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Focus state for each input
  const [f1, setF1] = useState(false)
  const [f2, setF2] = useState(false)
  const [f3, setF3] = useState(false)
  const [f4, setF4] = useState(false)

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @keyframes pulse-glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .signup-left-perk { transition: background 0.2s; }
        .signup-left-perk:hover { background: rgba(255,255,255,0.07) !important; }
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
        className="signup-left-panel"
        style={{
          width: '50%',
          minWidth: 520,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px 52px',
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
          background: '#040e24',
        }}
      >
        {/* Layered radial gradients */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 100% 80% at -10% 50%, rgba(74,154,212,0.25) 0%, transparent 60%),' +
              'radial-gradient(ellipse 70% 60% at 110% 80%, rgba(255,140,90,0.12) 0%, transparent 55%)',
            pointerEvents: 'none',
          }}
        />
        {/* Grid texture */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            pointerEvents: 'none',
          }}
        />

        {/* Top */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #4a9ad4, #1a2744)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(74,154,212,0.4)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 15 L10 5 L16 15" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 11 L13 11" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>Product Builder Academy</span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: 'clamp(42px, 4vw, 56px)',
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1.0,
              letterSpacing: -2,
              marginBottom: 0,
              marginTop: 64,
            }}
          >
            Start your builder
          </h1>
          <h1
            style={{
              fontSize: 'clamp(42px, 4vw, 56px)',
              fontWeight: 900,
              lineHeight: 1.0,
              letterSpacing: -2,
              marginBottom: 16,
              background: 'linear-gradient(90deg, #4a9ad4, #7bb8e0)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            journey.
          </h1>

          {/* Pill badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(74,154,212,0.12)',
              border: '1px solid rgba(74,154,212,0.25)',
              borderRadius: 9999,
              padding: '5px 14px',
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: '#4a9ad4', letterSpacing: 0.8 }}>FREE TO JOIN</span>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#4a9ad4',
                display: 'inline-block',
                boxShadow: '0 0 6px #4a9ad4',
                animation: 'pulse-glow 2s ease-in-out infinite',
              }}
            />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>No credit card needed</span>
          </div>

          <p
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.65,
              marginBottom: 36,
              maxWidth: 340,
            }}
          >
            Create a free account to browse courses, watch preview lessons, and join a cohort when you're ready.
          </p>

          {/* Perks list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PERKS.map((p) => (
              <div
                key={p.text}
                className="signup-left-perk"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'rgba(74,154,212,0.2)',
                    border: '1px solid rgba(74,154,212,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                    <path d="M1 4.5L4 7.5L10 1.5" stroke="#4a9ad4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, fontWeight: 500 }}>{p.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: trust stats */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: '20px 22px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex' }}>
              {AVATARS.map((a, i) => (
                <div
                  key={a.initials}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: a.bg,
                    border: '2px solid rgba(4,14,36,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#fff',
                    marginLeft: i === 0 ? 0 : -10,
                    zIndex: AVATARS.length - i,
                    position: 'relative',
                  }}
                >
                  {a.initials}
                </div>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1 }}>500+ builders joined</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} width="10" height="10" viewBox="0 0 12 12" fill="#FFB800" aria-hidden="true">
                    <path d="M6 0l1.5 4.5H12L8.25 7.25l1.5 4.5L6 9.25l-3.75 2.5 1.5-4.5L0 4.5h4.5z" />
                  </svg>
                ))}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 3 }}>4.9/5 rating</span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {[
                { val: '500+', label: 'Students' },
                { val: '12', label: 'Cohorts' },
                { val: '98%', label: 'Satisfaction' },
                { val: '4.9★', label: 'Rating' },
              ].map((s, i) => (
                <div
                  key={s.label}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                  }}
                >
                  <p style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: -0.5, lineHeight: 1 }}>{s.val}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* RIGHT PANEL — Sign Up Form                                          */}
      {/* ================================================================== */}
      <div className="signup-right-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {/* Top bar */}
        <div
          className="signup-topbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 40px',
            borderBottom: '1px solid rgba(26,39,68,0.07)',
          }}
        >
          <span style={{ fontSize: 13, color: '#717182' }}>Already have an account?</span>
          <Link
            to="/login"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#1a2744',
              textDecoration: 'none',
              padding: '8px 18px',
              borderRadius: 10,
              border: '1.5px solid rgba(26,39,68,0.12)',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(26,39,68,0.06)',
            }}
          >
            Sign in
          </Link>
        </div>

        {/* Form */}
        <div
          className="signup-right-inner"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 48px',
          }}
        >
          <div style={{ width: '100%', maxWidth: 420 }}>

            <h2
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: '#1a2744',
                letterSpacing: -1.5,
                lineHeight: 1.1,
                marginBottom: 6,
              }}
            >
              Create your account
            </h2>
            <p style={{ fontSize: 14, color: '#717182', marginBottom: 28, lineHeight: 1.5 }}>
              Free to join — no credit card required.
            </p>

            {/* Error */}
            {error && (
              <div
                role="alert"
                style={{
                  marginBottom: 20,
                  background: '#fff5f5',
                  border: '1px solid #fca5a5',
                  borderRadius: 12,
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                  <p style={{ fontSize: 13, color: '#dc2626', lineHeight: 1.4 }}>{error}</p>
                </div>
                {error.toLowerCase().includes('already exists') && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #fecaca' }}>
                    <Link
                      to="/login"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#fff',
                        background: '#1a2744',
                        padding: '7px 16px',
                        borderRadius: 8,
                        textDecoration: 'none',
                      }}
                    >
                      Sign in to your account
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Google button */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={isPending}
              onMouseEnter={() => setGoogleHov(true)}
              onMouseLeave={() => setGoogleHov(false)}
              style={{
                width: '100%',
                height: 50,
                borderRadius: 12,
                border: `1.5px solid ${googleHov ? '#c8d4e0' : 'rgba(26,39,68,0.1)'}`,
                background: googleHov ? '#f9fafb' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontSize: 14,
                fontWeight: 600,
                color: '#1a2744',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.5 : 1,
                transition: 'all 0.15s',
                fontFamily: "'Inter', sans-serif",
                marginBottom: 20,
                boxShadow: '0 1px 3px rgba(26,39,68,0.06)',
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(26,39,68,0.08)' }} />
              <span style={{ fontSize: 12, color: '#a3a3b8', fontWeight: 500, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                or sign up with email
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(26,39,68,0.08)' }} />
            </div>

            {/* Registration form */}
            <form onSubmit={handleEmailSignup}>
              {/* Name row */}
              <div className="signup-name-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label
                    htmlFor="first-name"
                    style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1a2744', marginBottom: 6 }}
                  >
                    First name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="first-name"
                    type="text"
                    autoComplete="given-name"
                    placeholder="Alex"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onFocus={() => setF1(true)}
                    onBlur={() => setF1(false)}
                    style={inputStyle(f1)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="last-name"
                    style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1a2744', marginBottom: 6 }}
                  >
                    Last name
                  </label>
                  <input
                    id="last-name"
                    type="text"
                    autoComplete="family-name"
                    placeholder="Kim"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onFocus={() => setF2(true)}
                    onBlur={() => setF2(false)}
                    style={inputStyle(f2)}
                  />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <label
                  htmlFor="signup-email"
                  style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1a2744', marginBottom: 6 }}
                >
                  Email address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setF3(true)}
                  onBlur={() => setF3(false)}
                  style={inputStyle(f3)}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 8 }}>
                <label
                  htmlFor="signup-password"
                  style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1a2744', marginBottom: 6 }}
                >
                  Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setF4(true)}
                  onBlur={() => setF4(false)}
                  style={inputStyle(f4)}
                />
                <p style={{ fontSize: 11, color: '#a3a3b8', marginTop: 6, lineHeight: 1.4 }}>
                  Must be 8+ characters with 1 uppercase letter and 1 number.
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending}
                onMouseEnter={() => setSubmitHov(true)}
                onMouseLeave={() => setSubmitHov(false)}
                style={{
                  width: '100%',
                  height: 52,
                  borderRadius: 12,
                  background: submitHov ? '#e87040' : '#ff8c5a',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  border: 'none',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.7 : 1,
                  fontFamily: "'Inter', sans-serif",
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 16px rgba(255,140,90,0.3)',
                  marginTop: 20,
                  marginBottom: 16,
                }}
              >
                {isPending ? 'Creating account…' : 'Create Account →'}
              </button>

              <p style={{ fontSize: 11, color: '#a3a3b8', textAlign: 'center', lineHeight: 1.6 }}>
                By signing up, you agree to our{' '}
                <a href="#" style={{ color: '#717182', textDecoration: 'underline' }}>Terms of Service</a>{' '}
                and{' '}
                <a href="#" style={{ color: '#717182', textDecoration: 'underline' }}>Privacy Policy</a>
              </p>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            padding: '16px 40px',
            borderTop: '1px solid rgba(26,39,68,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ fontSize: 12, color: '#a3a3b8' }}>
            Admin?{' '}
            <Link to="/admin/login" style={{ color: '#717182', fontWeight: 600, textDecoration: 'none' }}>
              Sign in to admin portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
