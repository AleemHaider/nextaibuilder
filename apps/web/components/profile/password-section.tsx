'use client'

// PBA-315 — Expandable password change form with strength indicator
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { ChevronRight, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useChangePassword } from '@/hooks/use-student-profile'

interface PasswordSectionProps {
  hasPassword: boolean
  className?: string
}

interface PasswordFormValues {
  currentPassword: string
  newPassword:     string
  confirmPassword: string
}

// ── Password strength ──────────────────────────────────────────────────────

function computeStrength(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= 8)      score++
  if (/[A-Z]/.test(password))    score++
  if (/[0-9]/.test(password))    score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score // 0–4
}

const STRENGTH_COLORS: Record<number, string> = {
  0: '',
  1: 'bg-[#d4183d]',
  2: 'bg-[#ff8c5a]',
  3: 'bg-[#ff8c5a]',
  4: 'bg-[#16a34a]',
}

const STRENGTH_LABELS: Record<number, string> = {
  0: '',
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
}

function StrengthBar({ strength }: { strength: number }) {
  if (!strength) return null
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className={cn(
              'flex-1 h-[4px] rounded-full transition-colors',
              seg <= strength ? STRENGTH_COLORS[strength] : 'bg-[#e5e7eb]',
            )}
          />
        ))}
      </div>
      <p className={cn('text-xs mt-1', strength >= 4 ? 'text-[#16a34a]' : 'text-[#717182]')}>
        {STRENGTH_LABELS[strength]}
      </p>
    </div>
  )
}

// ── Password field with show/hide ─────────────────────────────────────────

function PasswordInput({
  id,
  placeholder,
  error,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; placeholder: string; error?: string }) {
  const [show, setShow] = React.useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          className={cn(
            'w-full h-10 px-3 pr-10 rounded-md text-sm text-[#1a2744] bg-[#f3f3f5]',
            'border border-black/10 focus:outline-none focus:border-[#4a9ad4] focus:ring-2 focus:ring-[#4a9ad4]/20',
            'placeholder:text-[#717182]',
            error && 'border-[#d4183d] focus:border-[#d4183d] focus:ring-[#d4183d]/20',
          )}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717182] hover:text-[#1a2744] transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-[#d4183d]">{error}</p>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

function PasswordSection({ hasPassword, className }: PasswordSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const changePassword = useChangePassword()

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting },
    setError,
    clearErrors,
    formState,
  } = useForm<PasswordFormValues>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const newPasswordValue = watch('newPassword')
  const strength = computeStrength(newPasswordValue ?? '')

  // If user has no password, hide this section entirely
  if (!hasPassword) return null

  async function onSubmit(values: PasswordFormValues) {
    clearErrors()
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword:     values.newPassword,
        confirmPassword: values.confirmPassword,
      })
      toast.success('Password updated successfully.')
      reset()
      setIsExpanded(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update password.'
      // Map known error codes to field errors
      if (msg.includes('Current password')) {
        setError('currentPassword', { message: msg })
      } else if (msg.includes('do not match')) {
        setError('confirmPassword', { message: msg })
      } else {
        toast.error(msg)
      }
    }
  }

  function handleCancel() {
    reset()
    setIsExpanded(false)
  }

  return (
    <div data-slot="password-section" className={className}>
      {/* Trigger row */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <p className="text-sm font-medium text-[#1a2744]">Change password</p>
          <p className="text-xs text-[#717182] mt-0.5">Update your account password</p>
        </div>
        <ChevronRight
          className={cn(
            'w-4 h-4 text-[#717182] transition-transform',
            isExpanded && 'rotate-90',
          )}
        />
      </button>

      {/* Expanded form */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {/* Current password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1a2744]" htmlFor="currentPassword">
                Current password
              </label>
              <PasswordInput
                id="currentPassword"
                placeholder="Enter current password"
                error={formState.errors.currentPassword?.message}
                {...register('currentPassword', { required: 'Current password is required' })}
              />
            </div>

            {/* New password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1a2744]" htmlFor="newPassword">
                New password
              </label>
              <PasswordInput
                id="newPassword"
                placeholder="Enter new password"
                error={formState.errors.newPassword?.message}
                {...register('newPassword', {
                  required: 'New password is required',
                  minLength: { value: 8, message: 'Password must be at least 8 characters' },
                })}
              />
              <StrengthBar strength={strength} />
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1a2744]" htmlFor="confirmPassword">
                Confirm new password
              </label>
              <PasswordInput
                id="confirmPassword"
                placeholder="Confirm new password"
                error={formState.errors.confirmPassword?.message}
                {...register('confirmPassword', {
                  required: 'Please confirm your new password',
                  validate: (val) => val === newPasswordValue || 'Passwords do not match',
                })}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  'h-10 px-5 rounded-md text-sm font-medium bg-[#030213] text-white transition-opacity',
                  isSubmitting && 'opacity-40 cursor-not-allowed',
                )}
              >
                {isSubmitting ? 'Updating…' : 'Update password'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="h-10 px-4 rounded-md text-sm font-medium text-[#717182] hover:text-[#1a2744] transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export { PasswordSection }
