// Sprint 1 Story 5 — Canonical <LoadingSkeleton> primitive.
//
// The audit called out that admin pages flip from "nothing" to "fully
// rendered" without any skeleton state, which makes the app feel janky on
// slow connections. This component is the single skeleton every future
// loading pass adopts. We deliberately keep it visual-only (no announcement
// to AT — the sibling <LoadingSpinner> handles that via role="status") so a
// page-level loader with many skeleton children does not spam readers.
//
// Tokens come from Story 1 (`--color-wise-surface-soft`). Using the CSS
// custom property directly — rather than a Tailwind theme key — keeps the
// component working if token wiring order shifts.
import type { CSSProperties, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type LoadingSkeletonVariant = 'text' | 'circle' | 'rect'

export interface LoadingSkeletonProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Shape of the skeleton. Defaults to `rect` (the catch-all card placeholder). */
  variant?: LoadingSkeletonVariant
  /** Fixed width. Strings are applied verbatim; numbers are treated as px. */
  width?: string | number
  /** Fixed height. Strings are applied verbatim; numbers are treated as px. */
  height?: string | number
  /**
   * Only used when `variant='text'`. Renders N stacked lines; the final line
   * is narrowed to ~70% so the block reads like a paragraph rather than a
   * rectangle.
   */
  lines?: number
  className?: string
}

function toCssLength(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'number' ? `${value}px` : value
}

// Base classes shared by every variant. The pulse is driven by Tailwind's
// built-in `animate-pulse` keyframe; `aria-hidden` is set on every wrapper
// (see `ariaHidden` in the render paths below).
const SKELETON_BASE = 'animate-pulse bg-[var(--color-wise-surface-soft)]'

export function LoadingSkeleton({
  variant = 'rect',
  width,
  height,
  lines,
  className,
  style,
  ...rest
}: LoadingSkeletonProps) {
  const w = toCssLength(width)
  const h = toCssLength(height)

  if (variant === 'text') {
    const count = Math.max(1, lines ?? 1)
    return (
      <div
        aria-hidden="true"
        data-variant="text"
        className={cn('flex flex-col gap-2', className)}
        style={style}
        {...rest}
      >
        {Array.from({ length: count }).map((_, i) => {
          const isLast = i === count - 1 && count > 1
          const lineStyle: CSSProperties = {
            width: w ?? (isLast ? '70%' : '100%'),
            height: h,
          }
          return (
            <div
              key={i}
              data-testid="skeleton-line"
              className={cn(SKELETON_BASE, 'rounded h-[0.875em]')}
              style={lineStyle}
            />
          )
        })}
      </div>
    )
  }

  if (variant === 'circle') {
    const size = w ?? h ?? '2.5rem'
    return (
      <div
        aria-hidden="true"
        data-variant="circle"
        className={cn(SKELETON_BASE, 'rounded-full', className)}
        style={{ width: size, height: h ?? size, ...style }}
        {...rest}
      />
    )
  }

  // Default rect.
  return (
    <div
      aria-hidden="true"
      data-variant="rect"
      className={cn(SKELETON_BASE, 'rounded-xl', className)}
      style={{ width: w, height: h, ...style }}
      {...rest}
    />
  )
}

// ---- Convenience composites -------------------------------------------------
// These cover the three placeholder shapes every admin surface needs. They
// compose <LoadingSkeleton> so a tweak to the base pulse propagates here for
// free.

export interface CardSkeletonProps {
  className?: string
}

/**
 * Full Wise card placeholder (30px corner radius, ~140px height). Drops into
 * any card grid while data loads.
 */
export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="card-skeleton"
      className={cn(
        'animate-pulse bg-[var(--color-wise-surface-soft)]',
        'rounded-[30px] w-full h-[140px]',
        className,
      )}
    />
  )
}

export interface TableRowSkeletonProps {
  /** Number of cell placeholders to render. Defaults to 4. */
  columns?: number
  className?: string
}

/** Horizontal strip of N equal-width placeholder cells for table rows. */
export function TableRowSkeleton({
  columns = 4,
  className,
}: TableRowSkeletonProps) {
  const count = Math.max(1, columns)
  return (
    <div
      aria-hidden="true"
      data-testid="table-row-skeleton"
      className={cn('flex items-center gap-3 w-full', className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-[var(--color-wise-surface-soft)] rounded-lg h-6 flex-1"
        />
      ))}
    </div>
  )
}

export interface ListItemSkeletonProps {
  className?: string
}

/** Avatar + two text lines — the canonical list-row placeholder. */
export function ListItemSkeleton({ className }: ListItemSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="list-item-skeleton"
      className={cn('flex items-center gap-3 w-full', className)}
    >
      <LoadingSkeleton variant="circle" width={40} height={40} />
      <div className="flex-1 flex flex-col gap-2">
        <LoadingSkeleton
          variant="rect"
          height={10}
          className="rounded w-1/2"
        />
        <LoadingSkeleton
          variant="rect"
          height={10}
          className="rounded w-3/4"
        />
      </div>
    </div>
  )
}
