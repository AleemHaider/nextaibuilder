// FIR-29 — Course catalog page
import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import { CohortCard } from '../components/CohortCard'
import { usePageMeta } from '../hooks/usePageMeta'
import { fetchCohorts } from '../lib/api'
import type { CohortSummary } from '../lib/api'

type FilterType = 'all' | 'recorded' | 'live' | 'combined'

const FILTERS: Array<{ key: FilterType; label: string }> = [
  { key: 'all', label: 'All Courses' },
  { key: 'recorded', label: 'Recorded' },
  { key: 'live', label: 'Live Cohort' },
  { key: 'combined', label: 'Combined' },
]

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(26,39,68,0.08), 0 0 0 1px rgba(26,39,68,0.1)',
      }}
    >
      <div
        style={{
          height: 192,
          background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <div style={{ padding: '20px 22px 22px' }}>
        <div
          style={{
            height: 18,
            width: '65%',
            borderRadius: 6,
            marginBottom: 10,
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
        <div
          style={{
            height: 13,
            width: '90%',
            borderRadius: 4,
            marginBottom: 6,
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
        <div
          style={{
            height: 13,
            width: '70%',
            borderRadius: 4,
            marginBottom: 20,
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
        <div
          style={{
            height: 28,
            width: '40%',
            borderRadius: 6,
            marginBottom: 16,
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
        <div
          style={{
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        textAlign: 'center',
        padding: '80px 40px',
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 1px 3px rgba(26,39,68,0.08), 0 0 0 1px rgba(26,39,68,0.1)',
      }}
    >
      <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>🔍</div>
      <h3
        style={{ fontSize: 22, fontWeight: 700, color: '#1a2744', marginBottom: 8 }}
      >
        No courses match your filters
      </h3>
      <p style={{ fontSize: 15, color: '#717182', marginBottom: 24 }}>
        Try adjusting your filters to find what you're looking for.
      </p>
      <button
        onClick={onClear}
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#4a9ad4',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: "'Inter', sans-serif",
          textDecoration: 'underline',
        }}
      >
        Clear filters
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CatalogPage() {
  usePageMeta({
    title: 'All Courses',
    description: 'Explore our full catalog of AI education cohorts and recorded courses.',
  })

  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState('featured')
  const [filterHovered, setFilterHovered] = useState<FilterType | null>(null)

  const { data: cohorts, isPending, isError } = useQuery<CohortSummary[]>({
    queryKey: ['cohorts'],
    queryFn: fetchCohorts,
  })

  let filtered: CohortSummary[] = (cohorts ?? []).filter((c) =>
    activeFilter === 'all' ? true : c.type === activeFilter,
  )

  if (sort === 'price-asc') {
    filtered = [...filtered].sort((a, b) => a.price - b.price)
  } else if (sort === 'price-desc') {
    filtered = [...filtered].sort((a, b) => b.price - a.price)
  }

  const countFor = (key: FilterType) =>
    key === 'all'
      ? (cohorts ?? []).length
      : (cohorts ?? []).filter((c) => c.type === key).length

  return (
    <div style={{ minHeight: '100vh', background: '#f6f7fb' }}>
      <TopNav />

      <style>{`
        @media (max-width: 768px) {
          .catalog-header { padding: 28px 20px 20px !important; }
          .catalog-title-row { flex-direction: column !important; align-items: flex-start !important; }
          .catalog-h1 { font-size: clamp(28px, 7vw, 48px) !important; }
          .catalog-main { padding: 24px 16px 48px !important; }
          .catalog-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
        }
      `}</style>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <header
        className="catalog-header"
        style={{
          background: '#fff',
          borderBottom: '1px solid rgba(26,39,68,0.08)',
          padding: '48px 80px 36px',
        }}
      >
        {/* Breadcrumb */}
        <p style={{ fontSize: 13, color: '#9499a8', marginBottom: 20 }}>
          <Link
            to="/"
            style={{ color: '#4a9ad4', textDecoration: 'none', fontWeight: 500 }}
          >
            Home
          </Link>
          {' '}›{' '}All Courses
        </p>

        {/* Title row */}
        <div
          className="catalog-title-row"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
            marginBottom: 28,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              className="catalog-h1"
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: '#1a2744',
                letterSpacing: -1.5,
                lineHeight: 1.05,
                marginBottom: 8,
              }}
            >
              All Courses
            </h1>
            <p style={{ fontSize: 16, color: '#717182' }}>
              Explore our full catalog of AI education cohorts and recorded courses
            </p>
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1.5px solid rgba(26,39,68,0.15)',
              background: '#fff',
              fontSize: 14,
              fontWeight: 500,
              color: '#1a2744',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              outline: 'none',
              flexShrink: 0,
            }}
            aria-label="Sort courses"
          >
            <option value="featured">Sort: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>

        {/* Filter pills */}
        <div
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
          role="group"
          aria-label="Filter by type"
        >
          {FILTERS.map(({ key, label }) => {
            const isActive = activeFilter === key
            const isHov = filterHovered === key
            const count = countFor(key)
            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                onMouseEnter={() => setFilterHovered(key)}
                onMouseLeave={() => setFilterHovered(null)}
                aria-pressed={isActive}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 20px',
                  borderRadius: 9999,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  background: isActive ? '#1a2744' : isHov ? '#f0f1f4' : '#fff',
                  color: isActive ? '#fff' : '#1a2744',
                  border: isActive ? '2px solid #1a2744' : '2px solid rgba(26,39,68,0.15)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
                {cohorts != null && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: isActive ? 'rgba(255,255,255,0.2)' : '#e8f4fd',
                      color: isActive ? '#fff' : '#4a9ad4',
                      borderRadius: 9999,
                      padding: '1px 7px',
                      minWidth: 20,
                      textAlign: 'center',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="catalog-main" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 80px 80px' }}>
        {/* Results bar */}
        {!isPending && !isError && (
          <p
            style={{
              fontSize: 14,
              color: '#9499a8',
              marginBottom: 24,
              fontWeight: 500,
            }}
          >
            Showing{' '}
            <strong style={{ color: '#1a2744', fontWeight: 700 }}>
              {filtered.length} course{filtered.length !== 1 ? 's' : ''}
            </strong>
            {activeFilter !== 'all' && (
              <>
                {' '}in{' '}
                <span style={{ color: '#4a9ad4' }}>
                  {FILTERS.find((f) => f.key === activeFilter)?.label}
                </span>
              </>
            )}
          </p>
        )}

        {/* Error */}
        {isError && (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 40px',
              background: '#fff',
              borderRadius: 20,
              boxShadow: '0 1px 3px rgba(26,39,68,0.08)',
            }}
          >
            <p style={{ fontSize: 16, color: '#717182' }}>
              Failed to load courses. Please try again.
            </p>
          </div>
        )}

        {/* Card grid */}
        <div
          className="catalog-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 28,
          }}
        >
          {isPending ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : filtered.length === 0 ? (
            <EmptyState onClear={() => setActiveFilter('all')} />
          ) : (
            filtered.map((cohort) => <CohortCard key={cohort.id} cohort={cohort} />)
          )}
        </div>
      </main>

      <Footer />

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
