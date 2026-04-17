// FIR-156 — Admin 2FA OTP verification page
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { adminVerifyOtp, adminResendOtp } from '../lib/api'
import { AdminLeftPanel } from './AdminLoginPage'
import { cn } from '../lib/utils'

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60
const MAX_ATTEMPTS = 3

// ---------------------------------------------------------------------------
// OTP input box
// ---------------------------------------------------------------------------
interface OtpBoxProps {
  index: number
  value: string
  isFocused: boolean
  hasError: boolean
  inputRef: (el: HTMLInputElement | null) => void
  onChange: (index: number, value: string) => void
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void
  onFocus: (index: number) => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
}

function OtpBox({
  index,
  value,
  isFocused,
  hasError,
  inputRef,
  onChange,
  onKeyDown,
  onFocus,
  onPaste,
}: OtpBoxProps) {
  return (
    <input
      ref={inputRef}
      id={`otp-${index}`}
      type="text"
      inputMode="numeric"
      pattern="[0-9]"
      maxLength={1}
      value={value}
      aria-label={`OTP digit ${index + 1}`}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '')
        onChange(index, raw.slice(-1))
      }}
      onKeyDown={(e) => onKeyDown(index, e)}
      onFocus={() => onFocus(index)}
      onPaste={onPaste}
      className={cn(
        'w-[62px] h-[72px] rounded-xl text-center',
        'text-[28px] font-extrabold text-[#1a2744]',
        'border-[1.5px] outline-none transition-[border-color,background,box-shadow]',
        'caret-transparent',
        hasError
          ? 'border-[#d03238] bg-[#fef2f2]'
          : value
            ? 'border-[#4a9ad4] bg-white'
            : isFocused
              ? 'border-[#1a2744] bg-white shadow-[0_0_0_3px_rgba(26,39,68,0.1)]'
              : 'border-[rgba(26,39,68,0.15)] bg-[#f3f3f5]',
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// AdminOtpPage
// ---------------------------------------------------------------------------
interface OtpLocationState {
  preAuthToken?: string
  email?: string
}

export default function AdminOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const state = location.state as OtpLocationState | null
  const preAuthToken = state?.preAuthToken ?? null
  const email = state?.email ?? 'your email'

  // Guard: no preAuthToken → back to login
  useEffect(() => {
    if (!preAuthToken) {
      navigate('/admin/login', { replace: true })
    }
  }, [preAuthToken, navigate])

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const [isLockedOut, setIsLockedOut] = useState(false)

  // Resend cooldown
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS)
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }, [])

  // Input refs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  function focusBox(index: number) {
    inputRefs.current[index]?.focus()
  }

  function handleChange(index: number, value: string) {
    setError(null)
    const next = [...digits]
    next[index] = value
    setDigits(next)
    if (value && index < OTP_LENGTH - 1) {
      focusBox(index + 1)
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ''
        setDigits(next)
      } else if (index > 0) {
        focusBox(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusBox(index - 1)
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusBox(index + 1)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = [...digits]
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i]
    }
    setDigits(next)
    const nextFocus = Math.min(pasted.length, OTP_LENGTH - 1)
    focusBox(nextFocus)
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!preAuthToken) return

    const code = digits.join('')
    if (code.length < OTP_LENGTH) {
      setError('Please enter all 6 digits.')
      return
    }

    setError(null)
    setIsPending(true)

    try {
      const result = await adminVerifyOtp(preAuthToken, code)
      login(result.accessToken, result.user)
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      const newCount = attemptCount + 1
      setAttemptCount(newCount)

      if (newCount >= MAX_ATTEMPTS) {
        setIsLockedOut(true)
        setError(
          `Too many incorrect attempts. Please go back and sign in again.`,
        )
      } else {
        setError(
          err instanceof Error
            ? err.message
            : `Invalid code. ${MAX_ATTEMPTS - newCount} attempt${MAX_ATTEMPTS - newCount === 1 ? '' : 's'} remaining.`,
        )
      }
      // Clear digits on error
      setDigits(Array(OTP_LENGTH).fill(''))
      focusBox(0)
    } finally {
      setIsPending(false)
    }
  }

  async function handleResend() {
    if (!preAuthToken || cooldown > 0 || isLockedOut) return
    try {
      await adminResendOtp(preAuthToken)
      startCooldown()
      setDigits(Array(OTP_LENGTH).fill(''))
      setError(null)
      setAttemptCount(0)
      focusBox(0)
    } catch {
      setError('Failed to resend code. Please try again.')
    }
  }

  const allFilled = digits.every((d) => d !== '')

  if (!preAuthToken) return null

  return (
    <div className="flex min-h-screen w-full">
      <AdminLeftPanel tagline="Two-factor authentication keeps your admin account secure." />

      <div
        className={cn(
          'flex-1 flex items-center justify-center',
          'px-6 py-16 bg-[#f8f9fb]',
        )}
      >
        <form
          onSubmit={handleVerify}
          noValidate
          className="w-full max-w-[440px]"
          aria-label="OTP verification form"
        >
          {/* Email icon */}
          <p className="text-[48px] mb-5" aria-hidden="true">📧</p>

          <h1
            className={cn(
              'text-[36px] font-black text-[#1a2744]',
              'tracking-[-1px] mb-2',
            )}
          >
            Check your email
          </h1>
          <p className="text-[16px] text-[#717182] mb-1">
            We sent a 6-digit code to
          </p>
          <p className="text-[16px] font-bold text-[#1a2744] mb-8">{email}</p>

          {/* OTP boxes */}
          <div
            className="flex gap-2.5 mb-6"
            role="group"
            aria-label="One-time password input"
          >
            {digits.map((digit, i) => (
              <OtpBox
                key={i}
                index={i}
                value={digit}
                isFocused={focusedIndex === i}
                hasError={error !== null}
                inputRef={(el) => { inputRefs.current[i] = el }}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={setFocusedIndex}
                onPaste={handlePaste}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className={cn(
                'flex items-start gap-2.5 mb-5',
                'bg-[#fdeaeb] border border-[rgba(208,50,56,0.25)]',
                'rounded-xl px-4 py-3.5',
              )}
            >
              <span className="text-base flex-shrink-0 mt-0.5" aria-hidden="true">⚠️</span>
              <p className="text-[14px] text-[#d03238] font-medium leading-snug">
                {error}
              </p>
            </div>
          )}

          {/* Verify button */}
          <button
            type="submit"
            disabled={isPending || isLockedOut || !allFilled}
            className={cn(
              'w-full h-[52px] rounded-full mb-5',
              'bg-[#4a9ad4] text-[#0d1a3a] text-[16px] font-bold',
              'border-none cursor-pointer',
              'hover:opacity-90 transition-opacity',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus-visible:outline-2 focus-visible:outline-[#4a9ad4] focus-visible:outline-offset-2',
            )}
          >
            {isPending ? 'Verifying…' : 'Verify Code'}
          </button>

          {/* Resend row */}
          <div className="text-center">
            <span className="text-[14px] text-[#717182]">
              Didn't receive it?{' '}
              {cooldown > 0 ? (
                <span className="text-[#a3a3a3] font-semibold">
                  Resend code ({Math.floor(cooldown / 60)}:
                  {String(cooldown % 60).padStart(2, '0')})
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLockedOut}
                  className={cn(
                    'text-[#4a9ad4] font-semibold bg-transparent border-none',
                    'cursor-pointer p-0 hover:underline',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  Resend code
                </button>
              )}
            </span>
          </div>

          {/* Expiry note */}
          <p className="text-[12px] text-[#a3a3a3] text-center mt-3">
            Code expires in 10 minutes ·{' '}
            <button
              type="button"
              onClick={() => navigate('/admin/login', { replace: true })}
              className={cn(
                'text-[#4a9ad4] bg-transparent border-none',
                'cursor-pointer p-0 text-[12px] hover:underline',
              )}
            >
              Sign out
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
