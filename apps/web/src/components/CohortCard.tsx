// Shared cohort card — used in CatalogPage and featured section of HomePage
// Sprint 3 Story 14 — Wise theme migration:
//  · 30px radius + var(--shadow-ring) ring shadow
//  · Lime-on-dark gradient cover (kept data-driven so future types can tweak)
//  · Lime CTA matching the Wise Button primary variant
//  · Mint pill for type + seats badges, Wise danger for sold-out
import { Link } from 'react-router'
import { useState } from 'react'
import { cn } from '../lib/utils'
import type { CohortSummary } from '../lib/api'

interface CohortCardProps {
  cohort: CohortSummary
}

// Gradient palette derived from the Wise token set so every cohort type
// reads as part of the same family (warm-black → deep green → lime). Kept
// as a literal map so Tailwind's JIT picks them up and the inline SVG
// backgrounds continue to resolve.
const TYPE_CONFIG: Record<CohortSummary['type'], {
  label: string
  gradient: string
}> = {
  recorded: {
    label: 'Recorded',
    gradient: 'linear-gradient(140deg, #0e0f0c 0%, #163300 55%, #9fe870 100%)',
  },
  live: {
    label: 'Live Cohort',
    gradient: 'linear-gradient(140deg, #163300 0%, #2d5a12 45%, #9fe870 100%)',
  },
  combined: {
    label: 'Combined',
    gradient: 'linear-gradient(140deg, #0e0f0c 0%, #454745 45%, #cdffad 100%)',
  },
}

// Shared CTA styling that mirrors <Button variant="primary" size="md"> —
// we render it as a <Link> here so the whole cell stays a real anchor
// (preserves middle-click, right-click, and SEO).
const CTA_CLASSES = cn(
  'inline-flex w-full items-center justify-center',
  'h-11 rounded-full px-5 text-[15px] font-semibold',
  'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
  'transition-transform duration-150 ease-out',
  'hover:bg-[var(--color-wise-primary-hover)] hover:scale-[1.02]',
  'active:scale-[0.98]',
  'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
  'no-underline',
)

const CTA_DISABLED = cn(
  'inline-flex w-full items-center justify-center',
  'h-11 rounded-full px-5 text-[15px] font-semibold',
  'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]',
  'cursor-not-allowed border-none',
)

export function CohortCard({ cohort }: CohortCardProps) {
  const [hovered, setHovered] = useState(false)
  const cfg = TYPE_CONFIG[cohort.type]

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cohort.price)

  const formattedInstallment =
    cohort.installmentPrice != null
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(cohort.installmentPrice)
      : null

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'flex flex-col overflow-hidden bg-white',
        'rounded-[var(--radius-lg)]',
        'shadow-[var(--shadow-ring)]',
        'transition-transform duration-200 ease-out',
        hovered && 'scale-[1.02] shadow-[var(--shadow-card)]',
      )}
    >
      {/* ── Cover ─────────────────────────────────────────────────────────── */}
      <div
        className="relative h-48 flex-shrink-0"
        style={{ background: cfg.gradient }}
        role="img"
        aria-label={`${cohort.title} cover`}
      >
        {/* Subtle grid texture overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Type badge — mint pill */}
        <span
          className={cn(
            'absolute top-3.5 left-3.5 inline-flex items-center',
            'rounded-full px-2.5 py-1',
            'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
            'text-[11px] font-semibold tracking-[0.3px]',
          )}
        >
          {cfg.label}
        </span>

        {/* Seats indicator for live/combined */}
        {(cohort.type === 'live' || cohort.type === 'combined') &&
          cohort.meta?.includes('seats') && (
            <span
              className={cn(
                'absolute top-3.5 right-3.5 inline-flex items-center',
                'rounded-full px-2.5 py-1',
                'bg-white/15 text-white text-[11px] font-semibold',
                'backdrop-blur-sm border border-white/25',
              )}
            >
              {cohort.meta.split('·').pop()?.trim()}
            </span>
          )}

        {/* Sold out overlay */}
        {cohort.soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-wise-dark)]/65">
            <span
              className={cn(
                'rounded-full px-4.5 py-1.5 text-[13px] font-extrabold uppercase tracking-[1px]',
                'bg-[var(--color-wise-danger)] text-white',
              )}
              style={{ padding: '6px 18px' }}
            >
              Sold Out
            </span>
          </div>
        )}

        {/* Bottom gradient fade for depth */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-16"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.25), transparent)',
          }}
        />
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div
        className="flex flex-1 flex-col"
        style={{ padding: '20px 22px 22px' }}
      >
        <h3
          className={cn(
            'text-[17px] font-[800] leading-[1.3] mb-1.5',
            'text-[var(--color-wise-text)]',
          )}
        >
          {cohort.title}
        </h3>

        <p
          className={cn(
            'text-[13px] leading-[1.5] mb-4 overflow-hidden',
            'text-[var(--color-wise-text-muted)]',
          )}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {cohort.tagline}
        </p>

        {/* Meta row */}
        <p
          className={cn(
            'text-[12px] mb-3.5 flex items-center gap-1',
            'text-[var(--color-wise-text-muted)] opacity-80',
          )}
        >
          {cohort.meta}
        </p>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Price + installment */}
        <div className="mb-3.5 flex items-baseline justify-between">
          <span
            className={cn(
              'text-[24px] font-[900] tracking-[-0.5px]',
              'text-[var(--color-wise-text)]',
            )}
          >
            {formattedPrice}
          </span>
          {formattedInstallment != null && (
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
                'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
              )}
            >
              or {cohort.installmentCount ?? 3}×{formattedInstallment}/mo
            </span>
          )}
        </div>

        {/* CTA */}
        {cohort.soldOut ? (
          <button type="button" disabled className={CTA_DISABLED}>
            Sold Out
          </button>
        ) : (
          <Link to={`/courses/${cohort.slug}`} className={CTA_CLASSES}>
            View Course →
          </Link>
        )}
      </div>
    </article>
  )
}
