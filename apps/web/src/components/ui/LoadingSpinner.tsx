// Sprint 1 Story 5 — Canonical <LoadingSpinner> primitive.
//
// ProtectedRoute historically hand-rolled its own animated circle; other
// surfaces used the button's Loader2 directly with no live-region wrapper.
// This primitive consolidates the pattern and guarantees the aria contract:
// every spinner is wrapped in `role="status" aria-live="polite"` with an
// sr-only label so screen readers announce "Loading" (or the caller-supplied
// phrase) without a visible text block.
import type { HTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type LoadingSpinnerSize = 'sm' | 'md' | 'lg' | 'xl'

export interface LoadingSpinnerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'aria-live'> {
  /** Icon size. Defaults to `md` (24px). */
  size?: LoadingSpinnerSize
  /**
   * Accessible label announced by screen readers. Defaults to "Loading".
   * Also rendered visually as sr-only inside the status region.
   */
  label?: string
  /**
   * When true, wraps the spinner in a flex-centered block suitable for
   * full-page / full-card loading states. Otherwise renders inline.
   */
  centered?: boolean
  className?: string
}

// Icon pixel sizes from the story spec. Stored as an object for test
// introspection rather than inline switch for readability.
const SIZE_PX: Record<LoadingSpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
}

export function LoadingSpinner({
  size = 'md',
  label = 'Loading',
  centered = false,
  className,
  ...rest
}: LoadingSpinnerProps) {
  const px = SIZE_PX[size]

  const statusNode = (
    <div
      role="status"
      aria-live="polite"
      data-size={size}
      className={cn('inline-flex items-center justify-center', className)}
      {...rest}
    >
      <Loader2
        aria-hidden="true"
        className="animate-spin"
        style={{
          width: px,
          height: px,
          color: 'var(--color-wise-text-muted)',
        }}
      />
      {/* sr-only label — visually hidden but announced. */}
      <span className="sr-only">{label}</span>
    </div>
  )

  if (!centered) return statusNode

  // Page / card level wrapper. `min-h-[200px]` keeps the spinner from sitting
  // flush against the top edge inside empty containers.
  return (
    <div
      data-testid="loading-spinner-centered"
      className="flex items-center justify-center w-full min-h-[200px]"
    >
      {statusNode}
    </div>
  )
}
