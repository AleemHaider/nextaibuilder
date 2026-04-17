// FIR-164 — Badges page: earned badges grid + locked badges
import { useQuery } from '@tanstack/react-query'
import { TopNav } from '../../components/TopNav'
import { fetchStudentBadges, type StudentBadge } from '../../lib/api'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Badge card
// ---------------------------------------------------------------------------

function BadgeCard({ badge }: { badge: StudentBadge }) {
  return (
    <div
      className={cn(
        'bg-white rounded-[20px] p-6 text-center flex flex-col items-center gap-3',
        'shadow-[rgba(26,39,68,0.12)_0_0_0_1px] transition-transform hover:scale-[1.02]',
        !badge.earned && 'opacity-50',
      )}
      aria-label={badge.earned ? `${badge.name} badge — earned` : `${badge.name} badge — locked`}
    >
      {/* Badge circle */}
      <div
        className={cn(
          'w-20 h-20 rounded-full flex items-center justify-center text-[40px]',
          badge.earned
            ? 'shadow-[rgba(26,39,68,0.15)_0_4px_20px]'
            : 'bg-[#f0f0f0]',
        )}
        style={badge.earned ? { background: 'linear-gradient(135deg,#eef6fd,#c8e4f7)' } : undefined}
      >
        {badge.earned ? (badge.iconUrl ?? '🏅') : '🔒'}
      </div>

      <div>
        <p
          className={cn(
            'text-[16px] font-700 mb-1',
            badge.earned ? 'text-[#1a2744]' : 'text-[#a3a3a3]',
          )}
        >
          {badge.name}
        </p>
        <p className="text-[13px] text-[#717182] leading-snug max-w-[160px]">
          {badge.description}
        </p>
      </div>

      {badge.earned ? (
        <span className="text-[11px] font-700 bg-[#e6f4ec] text-[#054d28] px-3 py-1 rounded-full">
          Earned
        </span>
      ) : (
        <span className="text-[11px] font-600 bg-[#f0f0f0] text-[#a3a3a3] px-3 py-1 rounded-full">
          Locked
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function BadgeSkeleton() {
  return (
    <div className="bg-white rounded-[20px] p-6 flex flex-col items-center gap-3 shadow-[rgba(26,39,68,0.12)_0_0_0_1px] animate-pulse">
      <div className="w-20 h-20 rounded-full bg-[#e8ecf4]" />
      <div className="h-3.5 w-24 bg-[#e8ecf4] rounded-full" />
      <div className="h-3 w-32 bg-[#e8ecf4] rounded-full" />
      <div className="h-6 w-16 bg-[#e8ecf4] rounded-full" />
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
    <div className="min-h-screen bg-[#f8f9fb]">
      <TopNav />

      <main className="p-4 sm:p-10">
        <h1 className="text-[32px] font-700 text-[#1a2744] mb-2">My Badges</h1>
        <p className="text-[16px] text-[#717182] mb-8">
          {isLoading
            ? 'Loading your badges…'
            : `${earnedCount} of ${badges.length} badges earned. Keep learning to unlock more!`}
        </p>

        {error && (
          <div className="mb-6 bg-[#fdeaeb] text-[#d03238] text-[14px] font-[600] rounded-[12px] px-4 py-3">
            Failed to load badges. Please refresh.
          </div>
        )}

        <p className="text-[13px] font-700 text-[#717182] uppercase tracking-[0.8px] mb-5">
          All Badges
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 max-w-[900px]">
          {isLoading ? (
            <>
              <BadgeSkeleton />
              <BadgeSkeleton />
              <BadgeSkeleton />
              <BadgeSkeleton />
            </>
          ) : badges.length === 0 ? (
            <div className="col-span-full bg-white rounded-[20px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] py-16 px-10 text-center">
              <div className="text-[56px] mb-4">🏅</div>
              <h2 className="text-[20px] font-700 text-[#1a2744] mb-2">No badges yet</h2>
              <p className="text-[15px] text-[#717182]">Complete lessons to start earning badges.</p>
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
