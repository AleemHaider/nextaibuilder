// Sprint 1 Story 3 — Shared <Input> with Wise aesthetic.
//
// Consolidates the varied input styles scattered across NAB (h-10/h-12,
// px-3/px-4, mixed radii and rings) into a single token-driven primitive.
// Mirrors the AdminLoginPage Wise reskin: `h-12 px-4 rounded-xl` with the
// soft neutral border `rgba(14,15,12,0.12)` and a lime focus ring.
//
// Stays focused on visual shell + a11y hooks. Label/helper/error wiring is
// delegated to <FormField> so the Input can also be used bare inside custom
// layouts (e.g. inline search).
import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** When true, swaps border/background to the danger palette. */
  hasError?: boolean
  /** Optional decorative icon rendered inside the left edge. */
  leftIcon?: ReactNode
  /** Optional decorative icon rendered inside the right edge. */
  rightIcon?: ReactNode
  /** Visual size. Defaults to `md`. */
  inputSize?: 'sm' | 'md' | 'lg'
}

const BASE =
  'w-full rounded-xl font-medium bg-white text-[var(--color-wise-text)] ' +
  'placeholder:text-[var(--color-wise-text-muted)] border outline-none ' +
  'transition-[border-color,box-shadow,background] duration-150 ' +
  'focus:ring-4 focus:ring-[var(--color-wise-primary)]/25 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const SIZE_CLASSES: Record<NonNullable<InputProps['inputSize']>, string> = {
  sm: 'h-9 px-3 text-[14px]',
  md: 'h-11 px-4 text-[15px]',
  lg: 'h-12 px-4 text-[16px]',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    hasError = false,
    leftIcon,
    rightIcon,
    inputSize = 'md',
    type = 'text',
    ...props
  },
  ref,
) {
  const sizeClass = SIZE_CLASSES[inputSize]
  const stateClass = hasError
    ? 'border-[var(--color-wise-danger)] bg-[var(--color-wise-danger-soft)] focus:ring-[var(--color-wise-danger)]/20'
    : 'border-[var(--color-wise-ring)] hover:border-[var(--color-wise-ring-strong)] focus:border-[var(--color-wise-text)]'

  const paddingOverride = cn(
    leftIcon && 'pl-11',
    rightIcon && 'pr-11',
  )

  const input = (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      data-has-error={hasError ? 'true' : undefined}
      aria-invalid={hasError || undefined}
      className={cn(BASE, sizeClass, stateClass, paddingOverride, className)}
      {...props}
    />
  )

  if (!leftIcon && !rightIcon) {
    return input
  }

  return (
    <div className="relative w-full" data-slot="input-wrapper">
      {leftIcon ? (
        <span
          aria-hidden="true"
          data-slot="input-left-icon"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-[var(--color-wise-text-muted)]"
        >
          {leftIcon}
        </span>
      ) : null}
      {input}
      {rightIcon ? (
        <span
          aria-hidden="true"
          data-slot="input-right-icon"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-[var(--color-wise-text-muted)]"
        >
          {rightIcon}
        </span>
      ) : null}
    </div>
  )
})
