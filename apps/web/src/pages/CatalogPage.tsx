// FIR-29 — Course catalog page
// Sprint 3 Story 13 — Wise theme migration.
//
// Legacy inline-styled header, filter pills, skeleton shimmer, and empty
// state are replaced with Tailwind classes that consume the `--color-wise-*`
// tokens. The <EmptyState> swap pulls in the Wave 6 primitive. <CohortCard>
// itself is owned by a separate story and only consumed here.
import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import { CohortCard } from '../components/CohortCard'
import { EmptyState } from '../components/ui/EmptyState'
import { usePageMeta } from '../hooks/usePageMeta'
import { fetchCohorts } from '../lib/api'
import type { CohortSummary } from '../lib/api'
import { cn } from '../lib/utils'

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

const shimmerClass =
  'animate-pulse bg-[var(--color-wise-surface-soft)]'

function SkeletonCard() {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-wise-surface)]',
        'shadow-[var(--shadow-ring)]',
      )}
    >
      <div className={cn('h-48', shimmerClass)} />
      <div className="px-5 pt-5 pb-[22px]">
        <div className={cn('mb-2.5 h-[18px] w-[65%] rounded', shimmerClass)} />
        <div className={cn('mb-1.5 h-[13px] w-[90%] rounded', shimmerClass)} />
        <div className={cn('mb-5 h-[13px] w-[70%] rounded', shimmerClass)} />
        <div className={cn('mb-4 h-7 w-[40%] rounded', shimmerClass)} />
        <div className={cn('h-11 rounded-xl', shimmerClass)} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CatalogPage() {
  usePageMeta({
    title: 'All Courses',
    description:
      'Explore our full catalog of AI education cohorts and recorded courses.',
  })

  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState('featured')

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
    <div className="min-h-screen bg-[var(--color-wise-canvas)]">
      <TopNav />

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <header
        className={cn(
          'bg-[var(--color-wise-surface)]',
          'border-b border-[var(--color-wise-ring)]',
          'px-6 sm:px-12 lg:px-20 pt-12 pb-9',
        )}
      >
        {/* Breadcrumb */}
        <p className="mb-5 text-[13px] text-[var(--color-wise-text-muted)]">
          <Link
            to="/"
            className="font-medium text-[var(--color-wise-primary-text)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2 rounded"
          >
            Home
          </Link>{' '}
          ›{' '}All Courses
        </p>

        {/* Title row */}
        <div className="mb-7 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 flex-wrap">
          <div>
            <h1
              className={cn(
                'mb-2 font-black tracking-[-1.5px] leading-[1.05]',
                'text-3xl sm:text-4xl md:text-5xl',
                'text-[var(--color-wise-text)]',
              )}
            >
              All Courses
            </h1>
            <p className="text-base text-[var(--color-wise-text-muted)]">
              Explore our full catalog of AI education cohorts and recorded courses
            </p>
          </div>

          {/* Sort */}
          <label className="flex items-center gap-2 flex-shrink-0">
            <span className="sr-only">Sort courses</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort courses"
              className={cn(
                'rounded-[var(--radius-sm)] px-4 py-2.5',
                'bg-white text-[var(--color-wise-text)]',
                'ring-1 ring-[var(--color-wise-ring)]',
                'text-sm font-medium cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wise-primary)]',
              )}
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </label>
        </div>

        {/* Filter pills */}
        <div
          role="group"
          aria-label="Filter by type"
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map(({ key, label }) => {
            const isActive = activeFilter === key
            const count = countFor(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                aria-pressed={isActive}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-5 py-2.5',
                  'text-sm font-semibold cursor-pointer',
                  'transition-[background-color,color,box-shadow] duration-150',
                  'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
                  isActive
                    ? 'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] ring-2 ring-[var(--color-wise-primary-text)]'
                    : 'bg-[var(--color-wise-surface)] text-[var(--color-wise-text)] ring-1 ring-[var(--color-wise-ring)] hover:bg-[var(--color-wise-mint)]',
                )}
              >
                {label}
                {cohorts != null && (
                  <span
                    className={cn(
                      'inline-block min-w-5 rounded-[var(--radius-pill)] px-1.5 text-[11px] font-bold text-center',
                      isActive
                        ? 'bg-[var(--color-wise-primary-text)] text-[var(--color-wise-primary)]'
                        : 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                    )}
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
      <main className="max-w-[1280px] mx-auto px-4 sm:px-12 lg:px-20 pt-10 pb-20">
        {/* Results bar */}
        {!isPending && !isError && (
          <p className="mb-6 text-sm font-medium text-[var(--color-wise-text-muted)]">
            Showing{' '}
            <strong className="font-bold text-[var(--color-wise-text)]">
              {filtered.length} course{filtered.length !== 1 ? 's' : ''}
            </strong>
            {activeFilter !== 'all' && (
              <>
                {' '}in{' '}
                <span className="text-[var(--color-wise-primary-text)]">
                  {FILTERS.find((f) => f.key === activeFilter)?.label}
                </span>
              </>
            )}
          </p>
        )}

        {/* Error */}
        {isError && (
          <div
            className={cn(
              'rounded-[var(--radius-md)] bg-[var(--color-wise-surface)]',
              'px-10 py-20 text-center',
              'shadow-[var(--shadow-ring)]',
            )}
          >
            <p className="text-base text-[var(--color-wise-text-muted)]">
              Failed to load courses. Please try again.
            </p>
          </div>
        )}

        {/* Card grid */}
        <div
          className={cn(
            'grid gap-4 sm:gap-7',
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
          )}
        >
          {isPending ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : filtered.length === 0 ? (
            <div
              className={cn(
                'col-span-full rounded-[var(--radius-lg)] bg-[var(--color-wise-surface)]',
                'shadow-[var(--shadow-ring)]',
              )}
            >
              <EmptyState
                icon={Search}
                title="No courses match your filters"
                description="Try adjusting your filters to find what you're looking for."
                action={{
                  label: 'Clear filters',
                  onClick: () => setActiveFilter('all'),
                }}
              />
            </div>
          ) : (
            filtered.map((cohort) => (
              <CohortCard key={cohort.id} cohort={cohort} />
            ))
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
