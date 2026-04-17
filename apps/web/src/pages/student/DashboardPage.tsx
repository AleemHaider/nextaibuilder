// FIR-51 — Student dashboard: enrolled courses grid with progress + installment schedule
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import {
  fetchStudentDashboard,
  fetchCohorts,
  type EnrollmentSummary,
  type Installment,
  type CohortSummary,
} from '../../lib/api'
import { TopNav } from '../../components/TopNav'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'Last visited today'
  if (hours < 24) return `Last visited ${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Last visited yesterday'
  if (days < 7) return `Last visited ${days} days ago`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return 'Last visited 1 week ago'
  return `Last visited ${weeks} weeks ago`
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const GRADIENT_MAP: Record<string, string> = {
  live:     'linear-gradient(135deg,#1a2744,#4a9ad4)',
  combined: 'linear-gradient(135deg,#0d1a3a,#2d4a8a)',
  recorded: 'linear-gradient(135deg,#054d28,#16a34a)',
}

const TYPE_LABEL: Record<string, string> = {
  live:     '🔴 Live Cohort',
  combined: '⚡ Combined',
  recorded: '📹 Recorded',
}

// ---------------------------------------------------------------------------
// Installment timeline (FIR-160)
// ---------------------------------------------------------------------------

function InstallmentTimeline({ installments }: { installments: Installment[] }) {
  const statusColor: Record<Installment['status'], string> = {
    PAID: 'bg-[#e6f4ec] text-[#054d28]',
    DUE: 'bg-[#fff8e6] text-[#8a5a00]',
    OVERDUE: 'bg-[#fdeaeb] text-[#d03238]',
  }

  return (
    <div className="mt-3 pt-3 border-t border-[rgba(26,39,68,0.06)]">
      <p className="text-[11px] font-700 text-[#717182] uppercase tracking-[0.6px] mb-2">
        Payment Schedule
      </p>
      <div className="flex flex-col gap-1.5">
        {installments.map((inst, i) => (
          <div key={inst.id} className="flex items-center justify-between">
            <span className="text-[12px] text-[#717182]">Month {i + 1} · {formatDate(inst.dueDate)}</span>
            <span
              className={cn(
                'text-[11px] font-600 px-2.5 py-0.5 rounded-full',
                statusColor[inst.status],
              )}
            >
              {inst.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Course card skeleton
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
        border: '1px solid rgba(26,39,68,0.07)',
      }}
      className="animate-pulse"
    >
      <div style={{ height: 80, background: 'linear-gradient(135deg,#e8ecf4,#dde3ee)' }} />
      <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ height: 13, background: '#e8ecf4', borderRadius: 6, width: '75%' }} />
        <div style={{ height: 8, background: '#e8ecf4', borderRadius: 9999, width: '100%' }} />
        <div style={{ height: 11, background: '#e8ecf4', borderRadius: 6, width: '50%' }} />
        <div style={{ height: 44, background: '#e8ecf4', borderRadius: 12, marginTop: 4 }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Enrollment card — premium redesign
// ---------------------------------------------------------------------------

interface EnrollmentCardProps {
  enrollment: EnrollmentSummary
}

function EnrollmentCard({ enrollment }: EnrollmentCardProps) {
  const navigate = useNavigate()
  const { cohort, completionPercentage, lessonsCompleted, totalLessons,
          paymentStatus, status, installments, lastActivityAt,
          nextLessonTitle, nextLiveSession } = enrollment

  const isCompleted = status === 'COMPLETED'
  const isPending = paymentStatus === 'PENDING'
  const isPartial = paymentStatus === 'PARTIAL'
  const hasFailed = paymentStatus === 'FAILED'

  function handleContinue() {
    navigate(`/student/course/${cohort.slug}`)
  }

  function handleViewCertificate() {
    navigate('/student/certificate')
  }

  const nextDueInstallment = installments?.find((i) => i.status === 'DUE' || i.status === 'OVERDUE')

  const coverGradient = GRADIENT_MAP[cohort.type] ?? GRADIENT_MAP.recorded

  return (
    <article
      style={{
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
        border: '1px solid rgba(26,39,68,0.07)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      aria-label={`Course: ${cohort.title}`}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(26,39,68,0.12), 0 0 0 1px rgba(26,39,68,0.08)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)'
      }}
    >
      {/* Gradient banner — 80px tall */}
      <div
        style={{
          height: 80,
          background: coverGradient,
          position: 'relative',
          opacity: isPending ? 0.7 : 1,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* Dot pattern overlay */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)',
            backgroundSize: '16px 16px',
          }}
        />
        {/* Type badge */}
        <div style={{ position: 'absolute', bottom: 10, left: 14 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 9999,
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.22)',
              letterSpacing: '0.3px',
            }}
          >
            {TYPE_LABEL[cohort.type]}
          </span>
        </div>
        {/* Completion badge */}
        {isCompleted && (
          <div style={{ position: 'absolute', top: 10, right: 12 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 9999,
                background: 'rgba(22,163,74,0.9)',
                color: '#fff',
                backdropFilter: 'blur(8px)',
              }}
            >
              Completed
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '20px 20px 22px', display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* Title */}
        <h3
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#1a2744',
            marginBottom: 14,
            lineHeight: 1.3,
            letterSpacing: -0.3,
          }}
        >
          {cohort.title}
        </h3>

        {/* Alert banners */}
        {isPartial && nextDueInstallment && (
          <div
            style={{
              background: '#fffbeb',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 12,
              fontSize: 12,
              color: '#92400e',
              fontWeight: 500,
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            🕐 Next installment due {formatDate(nextDueInstallment.dueDate)}
          </div>
        )}

        {hasFailed && (
          <div
            style={{
              background: '#fef2f2',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 12,
              fontSize: 12,
              color: '#dc2626',
              fontWeight: 500,
              border: '1px solid rgba(220,38,38,0.2)',
            }}
          >
            ⚠️ Payment failed — update your payment method
          </div>
        )}

        {isPending ? (
          <div
            style={{
              background: '#fffbeb',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 12,
              fontSize: 12,
              color: '#92400e',
              fontWeight: 500,
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            🕐 Payment receipt under review. Access unlocks upon approval.
          </div>
        ) : (
          <>
            {/* Progress bar — 8px height */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ height: 8, background: 'rgba(26,39,68,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${completionPercentage}%`,
                    background: isCompleted
                      ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                      : 'linear-gradient(90deg,#4a9ad4,#7bb8e0)',
                    borderRadius: 9999,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4a9ad4' }}>
                  {completionPercentage}% complete
                </span>
                <span style={{ fontSize: 12, color: '#717182' }}>
                  {lessonsCompleted}/{totalLessons} lessons
                </span>
              </div>
            </div>

            {isCompleted ? (
              <p style={{ fontSize: 12, color: '#717182', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                🎉 <span style={{ fontWeight: 600, color: '#1a2744' }}>
                  Completed on {lastActivityAt ? formatDate(lastActivityAt) : '—'}
                </span>
              </p>
            ) : nextLessonTitle ? (
              <p style={{ fontSize: 12, color: '#717182', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: '#1a2744' }}>Next:</span> {nextLessonTitle}
              </p>
            ) : null}

            {nextLiveSession && !isCompleted && (
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#cc4a00',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                📅 Next live: {nextLiveSession}
              </p>
            )}
          </>
        )}

        {/* CTA button */}
        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          {isPending ? (
            <button
              type="button"
              style={{
                width: '100%',
                padding: '11px 20px',
                borderRadius: 12,
                background: '#f4f6f9',
                color: '#1a2744',
                fontSize: 13,
                fontWeight: 700,
                border: '1px solid rgba(26,39,68,0.12)',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s ease',
              }}
              onClick={() => navigate(`/manual-payment/${cohort.slug}`)}
            >
              View Payment Status
            </button>
          ) : isCompleted ? (
            <button
              type="button"
              style={{
                width: '100%',
                padding: '11px 20px',
                borderRadius: 12,
                background: '#1a2744',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(26,39,68,0.2)',
              }}
              onClick={handleViewCertificate}
            >
              View Certificate
            </button>
          ) : (
            <button
              type="button"
              style={{
                width: '100%',
                padding: '11px 20px',
                borderRadius: 12,
                background: '#4a9ad4',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(74,154,212,0.3)',
              }}
              onClick={handleContinue}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#3a8ac4' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#4a9ad4' }}
            >
              Continue Learning →
            </button>
          )}
        </div>

        {/* Footer row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
            marginTop: 12,
            borderTop: '1px solid rgba(26,39,68,0.06)',
          }}
        >
          <span style={{ fontSize: 11, color: '#a3a3b8' }}>
            {lastActivityAt ? relativeTime(lastActivityAt) : 'Enrolled'}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 9999,
              background: isCompleted
                ? '#e8ecf4'
                : isPending
                ? '#fffbeb'
                : '#e6f4ec',
              color: isCompleted
                ? '#1a2744'
                : isPending
                ? '#92400e'
                : '#15803d',
            }}
          >
            {isCompleted ? 'Completed' : isPending ? 'Pending' : 'Active'}
          </span>
        </div>

        {installments && installments.length > 0 && (
          <InstallmentTimeline installments={installments} />
        )}
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Discover cohort card (empty state)
// ---------------------------------------------------------------------------

const DISCOVER_GRADIENTS: Record<string, string[]> = {
  live:     ['#0d1b42', '#1e4080', '#4a9ad4'],
  combined: ['#100d30', '#2a1f6e', '#6b5ce7'],
  recorded: ['#0a2a1a', '#0f5132', '#16a34a'],
}

const DISCOVER_ACCENT: Record<string, string> = {
  live:     '#4a9ad4',
  combined: '#6b5ce7',
  recorded: '#16a34a',
}

const DISCOVER_TYPE_LABEL: Record<string, { label: string; icon: string }> = {
  live:     { label: 'Live Cohort', icon: '🔴' },
  combined: { label: 'Combined',    icon: '⚡' },
  recorded: { label: 'Recorded',    icon: '📹' },
}

function DiscoverCard({ cohort }: { cohort: CohortSummary }) {
  const navigate = useNavigate()
  const stops = DISCOVER_GRADIENTS[cohort.type] ?? DISCOVER_GRADIENTS.recorded
  const accent = DISCOVER_ACCENT[cohort.type] ?? '#4a9ad4'
  const meta = DISCOVER_TYPE_LABEL[cohort.type] ?? { label: cohort.type, icon: '📦' }
  const gradient = `linear-gradient(145deg, ${stops[0]} 0%, ${stops[1]} 55%, ${stops[2]} 100%)`

  return (
    <article
      onClick={() => navigate(`/courses/${cohort.slug}`)}
      aria-label={`View ${cohort.title}`}
      style={{
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
        border: '1px solid rgba(26,39,68,0.07)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow =
          '0 12px 40px rgba(26,39,68,0.14), 0 0 0 1px rgba(26,39,68,0.08)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLElement).style.boxShadow =
          '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)'
      }}
    >
      {/* Cover */}
      <div
        style={{
          height: 160,
          background: gradient,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '18px 20px',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 130,
            height: 130,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}30 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -20,
            left: '30%',
            width: 90,
            height: 90,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 100,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '0.3px',
            alignSelf: 'flex-start',
          }}
        >
          {meta.icon} {meta.label}
        </span>

        <p
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.3,
            margin: 0,
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}
        >
          {cohort.title}
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', flex: 1, gap: 0 }}>
        {cohort.tagline && (
          <p
            style={{
              fontSize: 13,
              color: '#717182',
              lineHeight: 1.5,
              marginBottom: 16,
              flex: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {cohort.tagline}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#1a2744', lineHeight: 1 }}>
              {cohort.price === 0 ? 'Free' : `$${cohort.price}`}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/courses/${cohort.slug}`) }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: accent,
              color: '#fff',
              border: 'none',
              borderRadius: 100,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.2px',
              transition: 'opacity 0.15s',
              boxShadow: `0 4px 14px ${accent}40`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          >
            View details
          </button>
        </div>
      </div>
    </article>
  )
}

function DiscoverCardSkeleton() {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(26,39,68,0.06)',
        border: '1px solid rgba(26,39,68,0.07)',
      }}
    >
      <div style={{ height: 160, background: 'linear-gradient(135deg,#e8ecf4,#dde3ee)' }} />
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 14, width: '70%', background: '#e8ecf4', borderRadius: 8 }} />
        <div style={{ height: 12, width: '90%', background: '#e8ecf4', borderRadius: 8 }} />
        <div style={{ height: 12, width: '55%', background: '#e8ecf4', borderRadius: 8 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div style={{ height: 22, width: 50, background: '#e8ecf4', borderRadius: 8 }} />
          <div style={{ height: 36, width: 110, background: '#e8ecf4', borderRadius: 100 }} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Perk card
// ---------------------------------------------------------------------------

interface PerkProps {
  icon: string
  title: string
  desc: string
  bg: string
}

function PerkCard({ icon, title, desc, bg }: PerkProps) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 18,
        padding: '22px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
        border: '1px solid rgba(26,39,68,0.07)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 4, lineHeight: 1.3 }}>{title}</p>
        <p style={{ fontSize: 13, color: '#717182', lineHeight: 1.5, margin: 0 }}>{desc}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty + discover section
// ---------------------------------------------------------------------------

function EmptyState({ cohorts, cohortsLoading }: { cohorts: CohortSummary[]; cohortsLoading: boolean }) {
  const published = cohorts.filter((c) => c.published)

  return (
    <div>
      {/* Hero card */}
      <div
        className="dashboard-empty-hero"
        style={{
          borderRadius: 24,
          background: 'linear-gradient(135deg, #080f24 0%, #102040 45%, #1a3060 100%)',
          padding: '48px 44px',
          marginBottom: 28,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 36,
          flexWrap: 'wrap',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 340,
            height: 340,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(74,154,212,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -60,
            left: '40%',
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(74,154,212,0.10) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          className="dashboard-empty-hero-icon"
          style={{
            width: 88,
            height: 88,
            borderRadius: 22,
            flexShrink: 0,
            background: 'rgba(74,154,212,0.15)',
            border: '1px solid rgba(74,154,212,0.30)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
            backdropFilter: 'blur(4px)',
          }}
        >
          🚀
        </div>

        <div style={{ flex: 1, minWidth: 240, position: 'relative', zIndex: 1 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '1.4px',
              color: 'rgba(74,154,212,0.85)',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Start your journey
          </p>
          <h2
            style={{
              fontSize: 'clamp(22px, 3vw, 30px)',
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.25,
              marginBottom: 10,
            }}
          >
            Build real AI products.
            <br />
            <span style={{ color: '#7bb8e0' }}>Not toy demos.</span>
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.62)', lineHeight: 1.55, marginBottom: 24 }}>
            Join a cohort and ship production-grade AI apps alongside a community of founders and engineers.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              to="/courses"
              style={{
                display: 'inline-block',
                background: '#ff8c5a',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                padding: '11px 24px',
                borderRadius: 12,
                textDecoration: 'none',
                letterSpacing: '0.2px',
                boxShadow: '0 4px 16px rgba(255,140,90,0.4)',
              }}
            >
              Browse all cohorts
            </Link>
            <Link
              to="/courses?type=live"
              style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                padding: '11px 24px',
                borderRadius: 12,
                textDecoration: 'none',
                backdropFilter: 'blur(4px)',
              }}
            >
              Live cohorts →
            </Link>
          </div>
        </div>
      </div>

      {/* Perk cards */}
      <div
        className="dashboard-perk-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 40,
        }}
      >
        <PerkCard
          icon="🎯"
          title="Project-based"
          desc="Ship real products. Every cohort ends with something you can show off."
          bg="linear-gradient(135deg,#eef6fd,#c8e4f7)"
        />
        <PerkCard
          icon="👥"
          title="Live community"
          desc="Weekly live sessions and a private Slack with builders like you."
          bg="linear-gradient(135deg,#f3f0ff,#d6c9fc)"
        />
        <PerkCard
          icon="🏆"
          title="Certificate"
          desc="Earn a verified credential once you complete the full cohort."
          bg="linear-gradient(135deg,#ecfdf5,#a7f3d0)"
        />
      </div>

      {/* Available cohorts */}
      {(cohortsLoading || published.length > 0) && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#717182',
                textTransform: 'uppercase',
                letterSpacing: '1.2px',
                margin: 0,
                whiteSpace: 'nowrap',
              }}
            >
              Available cohorts
            </p>
            <div style={{ flex: 1, height: 1, background: 'rgba(26,39,68,0.08)' }} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {cohortsLoading ? (
              <>
                <DiscoverCardSkeleton />
                <DiscoverCardSkeleton />
                <DiscoverCardSkeleton />
              </>
            ) : (
              published.slice(0, 6).map((cohort) => (
                <DiscoverCard key={cohort.id} cohort={cohort} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI stats bar
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string | number
  sub: string
  iconBg: string
  icon: string
}

function KpiCard({ label, value, sub, iconBg, icon }: KpiCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: '20px 24px',
        boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
        border: '1px solid rgba(26,39,68,0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 'clamp(24px,3vw,32px)', fontWeight: 900, color: '#1a2744', lineHeight: 1, letterSpacing: -0.5 }}>
          {value}
        </p>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#717182', marginTop: 3 }}>{label}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState<EnrollmentSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cohorts, setCohorts] = useState<CohortSummary[]>([])
  const [cohortsLoading, setCohortsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await fetchStudentDashboard()
        if (!cancelled) {
          setEnrollments(data.enrollments)
          if (data.enrollments.length === 0) {
            setCohortsLoading(true)
            fetchCohorts()
              .then((list) => { if (!cancelled) setCohorts(list) })
              .catch(() => { /* silent */ })
              .finally(() => { if (!cancelled) setCohortsLoading(false) })
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load courses')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  const firstName = user ? getFirstName(user.name) : ''
  const activeCount = enrollments.filter((e) => e.status === 'ACTIVE').length
  const completedCount = enrollments.filter((e) => e.status === 'COMPLETED').length
  const isEmpty = !isLoading && enrollments.length === 0

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @media (max-width: 768px) {
          .dashboard-greeting { padding: 20px 20px !important; flex-direction: column !important; align-items: flex-start !important; }
          .dashboard-kpi-grid { grid-template-columns: 1fr 1fr !important; }
          .dashboard-courses-grid { grid-template-columns: 1fr !important; }
          .dashboard-discover-grid { grid-template-columns: 1fr !important; }
          .dashboard-empty-hero { padding: 28px 20px !important; gap: 20px !important; }
          .dashboard-empty-hero-icon { display: none !important; }
          .dashboard-perk-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <TopNav />

      <main style={{ padding: 'clamp(24px,3vw,40px) clamp(16px,3vw,32px) 64px', maxWidth: 1200, margin: '0 auto' }}>

        {/* ------------------------------------------------------------------ */}
        {/* GREETING BANNER                                                      */}
        {/* ------------------------------------------------------------------ */}
        <div
          className="dashboard-greeting"
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: '32px 40px',
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
            border: '1px solid rgba(26,39,68,0.07)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 20,
          }}
        >
          {/* Subtle right-side gradient */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '50%',
              height: '100%',
              background: 'radial-gradient(ellipse 60% 100% at 100% 50%, rgba(74,154,212,0.06), transparent)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1
              style={{
                fontSize: 'clamp(28px, 3vw, 38px)',
                fontWeight: 900,
                color: '#1a2744',
                letterSpacing: -1,
                lineHeight: 1.15,
                marginBottom: 8,
              }}
            >
              {getGreeting()}, {firstName} 👋
            </h1>
            <p style={{ fontSize: 15, color: '#717182', lineHeight: 1.5 }}>
              {isLoading
                ? 'Loading your courses…'
                : activeCount > 0
                ? `You have ${activeCount} course${activeCount !== 1 ? 's' : ''} in progress. Keep the momentum going!`
                : 'Your learning journey starts here. Browse a cohort and get building.'}
            </p>
          </div>

          {!isLoading && (
            <Link
              to="/courses"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '12px 24px',
                borderRadius: 12,
                background: '#ff8c5a',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(255,140,90,0.3)',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                position: 'relative',
                zIndex: 1,
              }}
            >
              Browse Courses →
            </Link>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* KPI STATS ROW (only when enrolled)                                  */}
        {/* ------------------------------------------------------------------ */}
        {!isLoading && enrollments.length > 0 && (
          <div
            className="dashboard-kpi-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 32,
            }}
          >
            <KpiCard
              icon="📚"
              iconBg="linear-gradient(135deg,#eef6fd,#c8e4f7)"
              label="Courses Enrolled"
              value={enrollments.length}
              sub="total programs"
            />
            <KpiCard
              icon="✅"
              iconBg="linear-gradient(135deg,#ecfdf5,#a7f3d0)"
              label="Completed"
              value={completedCount}
              sub={completedCount === 1 ? 'course finished' : 'courses finished'}
            />
            <KpiCard
              icon="🔥"
              iconBg="linear-gradient(135deg,#fff7ed,#fed7aa)"
              label="Active Courses"
              value={activeCount}
              sub="in progress"
            />
            <KpiCard
              icon="🏆"
              iconBg="linear-gradient(135deg,#fefce8,#fef08a)"
              label="Certificates"
              value={completedCount}
              sub="earned"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              marginBottom: 24,
              background: '#fef2f2',
              borderRadius: 14,
              padding: '14px 18px',
              color: '#dc2626',
              fontSize: 14,
              fontWeight: 600,
              border: '1px solid rgba(220,38,38,0.2)',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MY COURSES SECTION                                                   */}
        {/* ------------------------------------------------------------------ */}
        {(isLoading || enrollments.length > 0) && (
          <>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#1a2744',
                  letterSpacing: -0.5,
                  margin: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                My Courses
              </h2>
              {!isLoading && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#4a9ad4',
                    background: 'rgba(74,154,212,0.1)',
                    border: '1px solid rgba(74,154,212,0.2)',
                    borderRadius: 20,
                    padding: '3px 12px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {enrollments.length} enrolled
                </span>
              )}
              <div style={{ flex: 1, height: 1, background: 'rgba(26,39,68,0.08)' }} />
            </div>

            <div
              className="dashboard-courses-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 20,
                marginBottom: 40,
              }}
            >
              {isLoading ? (
                <>
                  <CardSkeleton />
                  <CardSkeleton />
                  <CardSkeleton />
                </>
              ) : (
                enrollments.map((enrollment) => (
                  <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
                ))
              )}
            </div>
          </>
        )}

        {/* Empty + discover */}
        {isEmpty && (
          <EmptyState cohorts={cohorts} cohortsLoading={cohortsLoading} />
        )}
      </main>
    </div>
  )
}
