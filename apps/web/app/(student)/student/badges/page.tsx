'use client'

// PBA-128 — Badges page: earned + locked badge grid
// Badge icons use gradient circles matching Figma story17 design
import { format } from 'date-fns'
import { useStudentBadges, type Badge } from '@/hooks/use-achievements'
import { Skeleton } from '@/components/ui/skeleton'
import { badgeGradient, getBadgeSpec } from '@/lib/badges'
import { usePageMeta } from '@/hooks/use-page-meta'

// ── Brand tokens ───────────────────────────────────────────────────────────────
const NAVY     = '#1a2744'
const MID_BLUE = '#4a9ad4'
const MUTED    = '#717182'

// ── Trophy SVG (local — used only by progress summary) ────────────────────────

function TrophyIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
    </svg>
  )
}

// ── Badge card ─────────────────────────────────────────────────────────────────

function BadgeCard({ badge, index }: { badge: Badge; index: number }) {
  const { from, to } = badgeGradient(badge.name, index)
  const spec = getBadgeSpec(badge.name)

  return (
    <div
      data-slot="badge-card"
      style={{
        background: badge.earned ? 'white' : '#fafbfc',
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: '14px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '20px 16px 16px', gap: '10px',
        boxShadow: badge.earned ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
        opacity: badge.earned ? 1 : 0.5,
        transition: 'box-shadow 200ms',
      }}
    >
      {/* Gradient circle or locked circle */}
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: badge.earned ? `linear-gradient(135deg, ${from}, ${to})` : '#e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '28px',
      }}>
        {badge.earned
          ? spec.emoji
          : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          )
        }
      </div>

      {/* Name */}
      <div style={{ fontSize: '13px', fontWeight: 500, color: badge.earned ? NAVY : MUTED, textAlign: 'center', lineHeight: 1.3 }}>
        {badge.name}
      </div>

      {/* Description */}
      <div style={{ fontSize: '11px', color: MUTED, textAlign: 'center', lineHeight: 1.4 }}>
        {badge.description}
      </div>

      {/* Earned date or locked chip */}
      {badge.earned && badge.earnedAt ? (
        <div style={{
          fontSize: '10px', fontWeight: 600, color: '#16a34a',
          background: 'rgba(22,163,74,0.1)', padding: '3px 10px', borderRadius: '20px',
        }}>
          Earned {format(new Date(badge.earnedAt), 'd MMM yyyy')}
        </div>
      ) : (
        <div style={{
          fontSize: '10px', color: MUTED,
          border: '1px solid rgba(0,0,0,0.1)', padding: '3px 10px', borderRadius: '20px',
        }}>
          Not yet earned
        </div>
      )}
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function BadgesSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-6 w-40 rounded-md" />
      <Skeleton className="h-4 w-56 rounded-md" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Page() {
  const { data, isLoading, isError } = useStudentBadges()

  usePageMeta({ title: 'Badges — Product Builder Academy' })

  if (isLoading) return <BadgesSkeleton />

  if (isError || !data) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Failed to load badges. Please refresh.
      </div>
    )
  }

  const { badges } = data
  const earnedCount = badges.filter((b) => b.earned).length
  const totalCount  = badges.length

  return (
    <div data-slot="badges-page" style={{ height: '100%', overflowY: 'auto', background: 'white' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 500, color: NAVY, margin: 0 }}>Badges</h1>
          <p style={{ fontSize: '14px', color: MUTED, marginTop: '4px' }}>
            Your achievements and milestones
          </p>
        </div>

        {/* Progress summary */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px',
          padding: '12px 16px', marginBottom: '32px', background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${NAVY}, ${MID_BLUE})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <TrophyIcon size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 500, color: NAVY, margin: 0 }}>
              {earnedCount} of {totalCount} badges earned
            </p>
            <p style={{ fontSize: '12px', color: MUTED, margin: 0 }}>
              {totalCount - earnedCount > 0 ? `${totalCount - earnedCount} still to unlock` : 'All badges unlocked!'}
            </p>
          </div>
          <div style={{
            fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px',
            background: earnedCount === totalCount && totalCount > 0 ? 'rgba(22,163,74,0.1)' : 'rgba(74,154,212,0.1)',
            color: earnedCount === totalCount && totalCount > 0 ? '#16a34a' : MID_BLUE,
          }}>
            {earnedCount === totalCount && totalCount > 0 ? 'Complete!' : `${Math.round((earnedCount / (totalCount || 1)) * 100)}%`}
          </div>
        </div>

        {/* Earned section */}
        {earnedCount > 0 && (
          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              Earned ({earnedCount})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
              {badges
                .filter((b) => b.earned)
                .map((badge, i) => (
                  <BadgeCard key={badge.id} badge={badge} index={i} />
                ))}
            </div>
          </section>
        )}

        {/* Locked section */}
        {totalCount - earnedCount > 0 && (
          <section>
            <h2 style={{ fontSize: '11px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              Locked ({totalCount - earnedCount})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
              {badges
                .filter((b) => !b.earned)
                .map((badge, i) => (
                  <BadgeCard key={badge.id} badge={badge} index={earnedCount + i} />
                ))}
            </div>
          </section>
        )}

        {badges.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 0', textAlign: 'center' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: '#f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrophyIcon size={24} />
            </div>
            <p style={{ fontSize: '14px', color: MUTED }}>No badges available yet. Keep progressing!</p>
          </div>
        )}

      </div>
    </div>
  )
}
