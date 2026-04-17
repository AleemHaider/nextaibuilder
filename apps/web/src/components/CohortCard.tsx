// Shared cohort card — used in CatalogPage and featured section of HomePage
import { Link } from 'react-router'
import { useState } from 'react'
import type { CohortSummary } from '../lib/api'

interface CohortCardProps {
  cohort: CohortSummary
}

const TYPE_CONFIG: Record<CohortSummary['type'], {
  label: string
  badgeBg: string
  badgeColor: string
  gradient: string
  accentColor: string
}> = {
  recorded: {
    label: 'Recorded',
    badgeBg: 'rgba(255,255,255,0.18)',
    badgeColor: '#fff',
    gradient: 'linear-gradient(140deg, #1a2744 0%, #2d5a8e 60%, #4a9ad4 100%)',
    accentColor: '#4a9ad4',
  },
  live: {
    label: 'Live Cohort',
    badgeBg: 'rgba(255,255,255,0.18)',
    badgeColor: '#fff',
    gradient: 'linear-gradient(140deg, #7a2400 0%, #cc4a00 55%, #ff8c5a 100%)',
    accentColor: '#ff8c5a',
  },
  combined: {
    label: 'Combined',
    badgeBg: 'rgba(255,255,255,0.18)',
    badgeColor: '#fff',
    gradient: 'linear-gradient(140deg, #0d1a3a 0%, #1a3460 55%, #2d5a8e 100%)',
    accentColor: '#7bb8e0',
  },
}

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
      style={{
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: hovered
          ? '0 12px 40px rgba(26,39,68,0.14), 0 0 0 1px rgba(26,39,68,0.06)'
          : '0 1px 3px rgba(26,39,68,0.08), 0 0 0 1px rgba(26,39,68,0.1)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Cover ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 192,
          background: cfg.gradient,
          position: 'relative',
          flexShrink: 0,
        }}
        role="img"
        aria-label={`${cohort.title} cover`}
      >
        {/* Subtle grid texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden="true"
        />

        {/* Type badge */}
        <span
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            background: cfg.badgeBg,
            color: cfg.badgeColor,
            padding: '4px 10px',
            borderRadius: 9999,
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          {cfg.label}
        </span>

        {/* Seats indicator for live/combined */}
        {(cohort.type === 'live' || cohort.type === 'combined') &&
          cohort.meta?.includes('seats') && (
            <span
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: 9999,
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              {cohort.meta.split('·').pop()?.trim()}
            </span>
          )}

        {/* Sold out overlay */}
        {cohort.soldOut && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(13,26,58,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                background: '#d03238',
                color: '#fff',
                fontSize: 13,
                fontWeight: 800,
                padding: '6px 18px',
                borderRadius: 9999,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Sold Out
            </span>
          </div>
        )}

        {/* Bottom gradient fade for depth */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            background: 'linear-gradient(to top, rgba(0,0,0,0.25), transparent)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '20px 22px 22px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        <h3
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: '#1a2744',
            lineHeight: 1.3,
            marginBottom: 6,
          }}
        >
          {cohort.title}
        </h3>

        <p
          style={{
            fontSize: 13,
            color: '#717182',
            lineHeight: 1.5,
            marginBottom: 16,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {cohort.tagline}
        </p>

        {/* Meta row */}
        <p
          style={{
            fontSize: 12,
            color: '#9499a8',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {cohort.meta}
        </p>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Price + installment */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: '#1a2744',
              letterSpacing: -0.5,
            }}
          >
            {formattedPrice}
          </span>
          {formattedInstallment != null && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#ff8c5a',
                background: '#fff0e8',
                padding: '3px 10px',
                borderRadius: 9999,
              }}
            >
              or {cohort.installmentCount ?? 3}×{formattedInstallment}/mo
            </span>
          )}
        </div>

        {/* CTA */}
        {cohort.soldOut ? (
          <button
            disabled
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 12,
              background: '#f0f1f4',
              color: '#9499a8',
              fontSize: 14,
              fontWeight: 700,
              border: 'none',
              cursor: 'not-allowed',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Sold Out
          </button>
        ) : (
          <Link
            to={`/courses/${cohort.slug}`}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 0',
              borderRadius: 12,
              background: '#1a2744',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              textAlign: 'center',
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2d3f6b')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#1a2744')}
          >
            View Course →
          </Link>
        )}
      </div>
    </article>
  )
}
