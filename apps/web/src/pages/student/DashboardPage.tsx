// FIR-51 — Student dashboard: enrolled courses grid with progress + installment schedule
// Sprint 3 Story 15 — Wise theme migration. Converts the navy/blue gradients
// and emoji meta to Wise tokens + lucide icons, reroutes the empty state
// through <EmptyState>, and swaps the hand-rolled CTAs for <Button>. Gradient
// hero is replaced by a flat Wise surface with a mint accent so the same
// surface can be used on light + dark backdrops.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CircleCheck,
  Clock,
  Flame,
  GraduationCap,
  PartyPopper,
  Radio,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  fetchStudentDashboard,
  fetchCohorts,
  type EnrollmentSummary,
  type Installment,
  type CohortSummary,
} from '../../lib/api'
import { TopNav } from '../../components/TopNav'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { CardSkeleton } from '../../components/ui/LoadingSkeleton'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
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

interface CohortTypeMeta {
  label: string
  icon: LucideIcon
}

const COHORT_TYPE_META: Record<string, CohortTypeMeta> = {
  live:     { label: 'Live Cohort', icon: Radio },
  combined: { label: 'Combined',    icon: Zap },
  recorded: { label: 'Recorded',    icon: Video },
}

// ---------------------------------------------------------------------------
// Installment timeline (FIR-160)
// ---------------------------------------------------------------------------

function InstallmentTimeline({ installments }: { installments: Installment[] }) {
  const statusStyle: Record<Installment['status'], string> = {
    PAID:    'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
    DUE:     'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text)]',
    OVERDUE: 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',
  }

  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-wise-ring)]">
      <p className="text-[11px] font-bold text-[var(--color-wise-text-muted)] uppercase tracking-[0.6px] mb-2">
        Payment Schedule
      </p>
      <div className="flex flex-col gap-1.5">
        {installments.map((inst, i) => (
          <div key={inst.id} className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--color-wise-text-muted)]">
              Month {i + 1} · {formatDate(inst.dueDate)}
            </span>
            <span
              className={cn(
                'text-[11px] font-semibold px-2.5 py-0.5 rounded-[var(--radius-pill)]',
                statusStyle[inst.status],
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
// Enrollment card
// ---------------------------------------------------------------------------

interface EnrollmentCardProps {
  enrollment: EnrollmentSummary
}

function EnrollmentCard({ enrollment }: EnrollmentCardProps) {
  const navigate = useNavigate()
  const {
    cohort, completionPercentage, lessonsCompleted, totalLessons,
    paymentStatus, status, installments, lastActivityAt,
    nextLessonTitle, nextLiveSession,
  } = enrollment

  const isCompleted = status === 'COMPLETED'
  const isPending = paymentStatus === 'PENDING'
  const isPartial = paymentStatus === 'PARTIAL'
  const hasFailed = paymentStatus === 'FAILED'

  const meta = COHORT_TYPE_META[cohort.type] ?? COHORT_TYPE_META.recorded
  const TypeIcon = meta.icon

  function handleContinue() {
    navigate(`/student/course/${cohort.slug}`)
  }

  function handleViewCertificate() {
    navigate('/student/certificate')
  }

  const nextDueInstallment = installments?.find(
    (i) => i.status === 'DUE' || i.status === 'OVERDUE',
  )

  return (
    <article
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-[var(--radius-lg)] overflow-hidden',
        'shadow-[var(--shadow-ring)] flex flex-col',
        'transition-transform duration-200 hover:-translate-y-[3px]',
      )}
      aria-label={`Course: ${cohort.title}`}
    >
      {/* Banner — Wise mint surface with type chip */}
      <div
        className={cn(
          'h-20 relative flex items-end px-4 pb-3',
          'bg-[var(--color-wise-mint)]',
          isPending && 'opacity-70',
        )}
      >
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[11px] font-bold',
            'px-[10px] py-[3px] rounded-[var(--radius-pill)]',
            'bg-[var(--color-wise-surface)] text-[var(--color-wise-primary-text)]',
            'shadow-[var(--shadow-ring)]',
          )}
        >
          <TypeIcon className="h-3 w-3" aria-hidden="true" />
          {meta.label}
        </span>
        {isCompleted && (
          <span
            className={cn(
              'absolute top-3 right-3 inline-flex items-center gap-1.5 text-[11px] font-bold',
              'px-[10px] py-[3px] rounded-[var(--radius-pill)]',
              'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
            )}
          >
            <CircleCheck className="h-3 w-3" aria-hidden="true" />
            Completed
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-[16px] font-extrabold text-[var(--color-wise-text)] mb-3.5 leading-[1.3] tracking-[-0.3px]">
          {cohort.title}
        </h3>

        {/* Alert banners */}
        {isPartial && nextDueInstallment && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2.5 mb-3',
              'bg-[var(--color-wise-warning-soft)] border border-[var(--color-wise-warning)]/40',
              'text-[12px] font-medium text-[var(--color-wise-text)]',
            )}
          >
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Next installment due {formatDate(nextDueInstallment.dueDate)}</span>
          </div>
        )}

        {hasFailed && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2.5 mb-3',
              'bg-[var(--color-wise-danger-soft)] border border-[var(--color-wise-danger)]/30',
              'text-[12px] font-medium text-[var(--color-wise-danger)]',
            )}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Payment failed — update your payment method</span>
          </div>
        )}

        {isPending ? (
          <div
            className={cn(
              'flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2.5 mb-3',
              'bg-[var(--color-wise-warning-soft)] border border-[var(--color-wise-warning)]/40',
              'text-[12px] font-medium text-[var(--color-wise-text)]',
            )}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Payment receipt under review. Access unlocks upon approval.</span>
          </div>
        ) : (
          <>
            {/* Progress bar — Wise tokens, mint track, primary fill */}
            <div className="mb-2.5">
              <div className="h-2 bg-[var(--color-wise-surface-soft)] rounded-[var(--radius-pill)] overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-[var(--radius-pill)] transition-[width] duration-400',
                    isCompleted
                      ? 'bg-[var(--color-wise-success)]'
                      : 'bg-[var(--color-wise-primary)]',
                  )}
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[12px] font-bold text-[var(--color-wise-primary-text)]">
                  {completionPercentage}% complete
                </span>
                <span className="text-[12px] text-[var(--color-wise-text-muted)]">
                  {lessonsCompleted}/{totalLessons} lessons
                </span>
              </div>
            </div>

            {isCompleted ? (
              <p className="text-[12px] text-[var(--color-wise-text-muted)] mb-2 flex items-center gap-1.5">
                <PartyPopper className="h-4 w-4 text-[var(--color-wise-primary-text)]" aria-hidden="true" />
                <span className="font-semibold text-[var(--color-wise-text)]">
                  Completed on {lastActivityAt ? formatDate(lastActivityAt) : '—'}
                </span>
              </p>
            ) : nextLessonTitle ? (
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 text-[12px] mb-2 max-w-full',
                  'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                  'px-2.5 py-1 rounded-[var(--radius-pill)]',
                )}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate font-semibold">Next: {nextLessonTitle}</span>
              </div>
            ) : null}

            {nextLiveSession && !isCompleted && (
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 text-[12px] mb-2 max-w-full',
                  'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                  'px-2.5 py-1 rounded-[var(--radius-pill)]',
                )}
              >
                <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate font-semibold">Next live: {nextLiveSession}</span>
              </div>
            )}
          </>
        )}

        {/* CTA */}
        <div className="mt-auto pt-3">
          {isPending ? (
            <Button
              variant="outline"
              size="md"
              className="w-full"
              onClick={() => navigate(`/manual-payment/${cohort.slug}`)}
            >
              View Payment Status
            </Button>
          ) : isCompleted ? (
            <Button
              variant="primary"
              size="md"
              className="w-full"
              leftIcon={<Award className="h-4 w-4" />}
              onClick={handleViewCertificate}
            >
              View Certificate
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              className="w-full"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              onClick={handleContinue}
            >
              Continue Learning
            </Button>
          )}
        </div>

        {/* Footer row */}
        <div
          className={cn(
            'flex items-center justify-between pt-3 mt-3',
            'border-t border-[var(--color-wise-ring)]',
          )}
        >
          <span className="text-[11px] text-[var(--color-wise-text-muted)]">
            {lastActivityAt ? relativeTime(lastActivityAt) : 'Enrolled'}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold px-[10px] py-[3px] rounded-[var(--radius-pill)]',
              isCompleted
                ? 'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text)]'
                : isPending
                  ? 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text)]'
                  : 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
            )}
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

function DiscoverCard({ cohort }: { cohort: CohortSummary }) {
  const navigate = useNavigate()
  const meta = COHORT_TYPE_META[cohort.type] ?? COHORT_TYPE_META.recorded
  const TypeIcon = meta.icon

  return (
    <article
      onClick={() => navigate(`/courses/${cohort.slug}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(`/courses/${cohort.slug}`)
      }}
      role="button"
      tabIndex={0}
      aria-label={`View ${cohort.title}`}
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-[var(--radius-lg)] overflow-hidden',
        'shadow-[var(--shadow-ring)] flex flex-col cursor-pointer',
        'transition-transform duration-150 hover:-translate-y-1',
        'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2',
      )}
    >
      {/* Cover — Wise mint canvas with lucide type icon. */}
      <div
        className={cn(
          'h-40 flex flex-col justify-between p-5 relative overflow-hidden',
          'bg-[var(--color-wise-mint)]',
        )}
      >
        <span
          className={cn(
            'inline-flex items-center gap-1.5 self-start',
            'bg-[var(--color-wise-surface)] rounded-[var(--radius-pill)] px-3 py-1',
            'text-[11px] font-bold text-[var(--color-wise-primary-text)]',
            'shadow-[var(--shadow-ring)]',
          )}
        >
          <TypeIcon className="h-3 w-3" aria-hidden="true" />
          {meta.label}
        </span>

        <p className="text-[17px] font-extrabold text-[var(--color-wise-text)] leading-[1.3]">
          {cohort.title}
        </p>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        {cohort.tagline && (
          <p
            className="text-[13px] text-[var(--color-wise-text-muted)] leading-[1.5] mb-4 flex-1"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {cohort.tagline}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto gap-3">
          <span className="text-[22px] font-extrabold text-[var(--color-wise-text)] leading-none">
            {cohort.price === 0 ? 'Free' : `$${cohort.price}`}
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); navigate(`/courses/${cohort.slug}`) }}
          >
            View details
          </Button>
        </div>
      </div>
    </article>
  )
}

function DiscoverCardSkeleton() {
  return <CardSkeleton className="h-[320px]" />
}

// ---------------------------------------------------------------------------
// Perk card
// ---------------------------------------------------------------------------

interface PerkProps {
  Icon: LucideIcon
  title: string
  desc: string
}

function PerkCard({ Icon, title, desc }: PerkProps) {
  return (
    <div
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] p-5',
        'flex flex-col gap-3 shadow-[var(--shadow-ring)]',
      )}
    >
      <div
        className={cn(
          'w-12 h-12 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0',
          'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
        )}
        aria-hidden="true"
      >
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-[14px] font-bold text-[var(--color-wise-text)] mb-1 leading-[1.3]">
          {title}
        </p>
        <p className="text-[13px] text-[var(--color-wise-text-muted)] leading-[1.5]">
          {desc}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty + discover section
// ---------------------------------------------------------------------------

function EmptyDashboard({
  cohorts,
  cohortsLoading,
}: {
  cohorts: CohortSummary[]
  cohortsLoading: boolean
}) {
  const published = cohorts.filter((c) => c.published)

  return (
    <div>
      {/* Hero */}
      <div
        className={cn(
          'rounded-[var(--radius-lg)] bg-[var(--color-wise-surface)] shadow-[var(--shadow-ring)]',
          'mb-7 overflow-hidden',
        )}
      >
        <EmptyState
          icon={GraduationCap}
          title="Build real AI products. Not toy demos."
          description="Join a cohort and ship production-grade AI apps alongside a community of founders and engineers."
          action={{ label: 'Browse all cohorts', href: '/courses' }}
        />
      </div>

      {/* Perks */}
      <div className="dashboard-perk-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <PerkCard
          Icon={GraduationCap}
          title="Project-based"
          desc="Ship real products. Every cohort ends with something you can show off."
        />
        <PerkCard
          Icon={Users}
          title="Live community"
          desc="Weekly live sessions and a private Slack with builders like you."
        />
        <PerkCard
          Icon={Award}
          title="Certificate"
          desc="Earn a verified credential once you complete the full cohort."
        />
      </div>

      {/* Available cohorts */}
      {(cohortsLoading || published.length > 0) && (
        <>
          <div className="flex items-center gap-3.5 mb-5">
            <p className="text-[11px] font-extrabold text-[var(--color-wise-text-muted)] uppercase tracking-[1.2px] m-0 whitespace-nowrap">
              Available cohorts
            </p>
            <div className="flex-1 h-px bg-[var(--color-wise-ring)]" />
          </div>

          <div className="dashboard-discover-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
// KPI cards
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string | number
  Icon: LucideIcon
}

function KpiCard({ label, value, Icon }: KpiCardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] p-5',
        'shadow-[var(--shadow-ring)] flex items-center gap-3.5',
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0',
          'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
        )}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[clamp(24px,3vw,32px)] font-black text-[var(--color-wise-text)] leading-none tracking-[-0.5px]">
          {value}
        </p>
        <p className="text-[12px] font-semibold text-[var(--color-wise-text-muted)] mt-1">
          {label}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// Responsive rules collected in one <style> block so we don't scatter inline
// media queries across the tree.
const DASHBOARD_RESPONSIVE_STYLES = `
  @media (max-width: 768px) {
    .dashboard-greeting { padding: 20px 20px !important; flex-direction: column !important; align-items: flex-start !important; }
    .dashboard-kpi-grid { grid-template-columns: 1fr 1fr !important; }
    .dashboard-courses-grid { grid-template-columns: 1fr !important; }
    .dashboard-discover-grid { grid-template-columns: 1fr !important; }
    .dashboard-perk-grid { grid-template-columns: 1fr !important; }
  }
`

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

  // PENDING payment alert — any enrollment whose payment is pending should
  // surface at the top of the dashboard.
  const pendingPaymentEnrollment = enrollments.find(
    (e) => e.paymentStatus === 'PENDING',
  )

  return (
    <div className="min-h-screen bg-[var(--color-wise-canvas)] font-sans">
      <style>{DASHBOARD_RESPONSIVE_STYLES}</style>
      <TopNav />

      <main
        className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 pt-6 md:pt-10 pb-16"
      >

        {/* Greeting banner */}
        <div
          className={cn(
            'dashboard-greeting bg-[var(--color-wise-surface)] rounded-[var(--radius-lg)]',
            'p-6 md:p-8 mb-6 shadow-[var(--shadow-ring)]',
            'flex items-center justify-between flex-wrap gap-5',
          )}
        >
          <div className="relative z-10">
            <h1
              className={cn(
                'text-[clamp(28px,3vw,38px)] font-black text-[var(--color-wise-text)]',
                'tracking-[-1px] leading-[1.15] mb-2',
              )}
            >
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-[15px] text-[var(--color-wise-text-muted)] leading-[1.5]">
              {isLoading
                ? 'Loading your courses…'
                : activeCount > 0
                  ? `You have ${activeCount} course${activeCount !== 1 ? 's' : ''} in progress. Keep the momentum going!`
                  : 'Your learning journey starts here. Browse a cohort and get building.'}
            </p>
          </div>

          {!isLoading && (
            <Button
              variant="primary"
              size="md"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              onClick={() => { window.location.href = '/courses' }}
            >
              Browse Courses
            </Button>
          )}
        </div>

        {/* PENDING payment banner */}
        {pendingPaymentEnrollment && (
          <div
            role="alert"
            className={cn(
              'flex items-center gap-3 mb-6 rounded-[var(--radius-sm)] px-4 py-3',
              'bg-[var(--color-wise-warning-soft)] border border-[var(--color-wise-warning)]/50',
              'text-[14px] font-medium text-[var(--color-wise-text)]',
            )}
          >
            <AlertTriangle
              className="h-5 w-5 shrink-0 text-[var(--color-wise-text)]"
              aria-hidden="true"
            />
            <p>
              We're reviewing your payment for
              {' '}<strong>{pendingPaymentEnrollment.cohort.title}</strong>.
              You'll unlock full access once it's approved.
            </p>
          </div>
        )}

        {/* KPI stats (only when enrolled) */}
        {!isLoading && enrollments.length > 0 && (
          <div
            className={cn(
              'dashboard-kpi-grid grid gap-4 mb-8',
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
            )}
          >
            <KpiCard Icon={BookOpen} label="Courses Enrolled" value={enrollments.length} />
            <KpiCard Icon={CircleCheck} label="Completed" value={completedCount} />
            <KpiCard Icon={Flame} label="Active Courses" value={activeCount} />
            <KpiCard Icon={Award} label="Certificates" value={completedCount} />
          </div>
        )}

        {error && (
          <div
            role="alert"
            className={cn(
              'flex items-center gap-2 mb-6 rounded-[var(--radius-sm)] px-4 py-3.5',
              'bg-[var(--color-wise-danger-soft)] border border-[var(--color-wise-danger)]/30',
              'text-[14px] font-semibold text-[var(--color-wise-danger)]',
            )}
          >
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* My Courses section */}
        {(isLoading || enrollments.length > 0) && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-[22px] font-extrabold text-[var(--color-wise-text)] tracking-[-0.5px] m-0 whitespace-nowrap">
                My Courses
              </h2>
              {!isLoading && (
                <span
                  className={cn(
                    'text-[12px] font-semibold px-3 py-0.5 rounded-[var(--radius-pill)] whitespace-nowrap',
                    'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                  )}
                >
                  {enrollments.length} enrolled
                </span>
              )}
              <div className="flex-1 h-px bg-[var(--color-wise-ring)]" />
            </div>

            <div
              className={cn(
                'dashboard-courses-grid grid gap-5 mb-10',
                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
              )}
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
          <EmptyDashboard cohorts={cohorts} cohortsLoading={cohortsLoading} />
        )}
      </main>
    </div>
  )
}
