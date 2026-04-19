// FIR-164 — Badges page: earned badges grid + locked badges
// Sprint 3 Story 15 — Wise theme migration. Badge chips moved onto the mint
// surface with Award lucide glyphs; locked variant uses opacity + grayscale
// rather than a separate locked emoji. Empty state now routes through the
// canonical <EmptyState>.
import { useQuery } from '@tanstack/react-query'
import { Award, Lock } from 'lucide-react'
import { TopNav } from '../../components/TopNav'
import { fetchStudentBadges, type StudentBadge } from '../../lib/api'
import { CardSkeleton } from '../../components/ui/LoadingSkeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Badge card
// ---------------------------------------------------------------------------

function BadgeCard({ badge }: { badge: StudentBadge }) {
  const earned = badge.earned

  return (
    <div
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] p-6 text-center flex flex-col items-center gap-3',
        'shadow-[var(--shadow-ring)] transition-transform hover:scale-[1.02]',
        'focus-within:outline-2 focus-within:outline-[var(--color-wise-primary)]',
        !earned && 'opacity-60 grayscale',
      )}
      aria-label={earned ? `${badge.name} badge — earned` : `${badge.name} badge — locked`}
    >
      {/* Badge chip — circular mint surface with Award glyph. Locked badges
          render the Lock icon and rely on the grayscale filter from the
          wrapper for the muted aesthetic. */}
      <div
        className={cn(
          'w-20 h-20 rounded-full flex items-center justify-center',
          'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
          earned && 'shadow-[var(--shadow-ring)]',
        )}
        aria-hidden="true"
      >
        {earned ? (
          <Award className="h-10 w-10" />
        ) : (
          <Lock className="h-9 w-9" />
        )}
      </div>

      <div>
        <p
          className={cn(
            'text-[16px] font-bold mb-1',
            earned ? 'text-[var(--color-wise-text)]' : 'text-[var(--color-wise-text-muted)]',
          )}
        >
          {badge.name}
        </p>
        <p className="text-[13px] text-[var(--color-wise-text-muted)] leading-snug max-w-[160px]">
          {badge.description}
        </p>
      </div>

      {earned ? (
        <span className="text-[11px] font-bold bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)] px-3 py-1 rounded-[var(--radius-pill)]">
          Earned
        </span>
      ) : (
        <span className="text-[11px] font-semibold bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)] px-3 py-1 rounded-[var(--radius-pill)]">
          Locked
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BadgesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'badges'],
    queryFn: fetchStudentBadges,
  })

  const badges = data?.badges ?? []
  const earnedCount = badges.filter((b) => b.earned).length

  return (
    <div className="min-h-screen bg-[var(--color-wise-canvas)]">
      <TopNav />

      <main id="main-content" tabIndex={-1} className="p-4 sm:p-10 focus:outline-none">
        <h1 className="text-[32px] font-bold text-[var(--color-wise-text)] mb-2 tracking-[-0.5px]">
          My Badges
        </h1>
        <p className="text-[16px] text-[var(--color-wise-text-muted)] mb-8">
          {isLoading
            ? 'Loading your badges…'
            : `${earnedCount} of ${badges.length} badges earned. Keep learning to unlock more!`}
        </p>

        {error && (
          <div className="mb-6 bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] text-[14px] font-semibold rounded-[var(--radius-sm)] px-4 py-3">
            Failed to load badges. Please refresh.
          </div>
        )}

        <p className="text-[13px] font-bold text-[var(--color-wise-text-muted)] uppercase tracking-[0.8px] mb-5">
          All Badges
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 max-w-[900px]">
          {isLoading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : badges.length === 0 ? (
            <div className="col-span-full bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-ring)]">
              <EmptyState
                icon={Award}
                title="Earn your first badge"
                description="Complete lessons and milestones to start earning badges."
              />
            </div>
          ) : (
            badges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} />
            ))
          )}
        </div>
      </main>
    </div>
  )
}
