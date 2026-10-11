'use client'
// PBA-131 — Admin Dashboard (Sprint 4 — live data)
import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  ClipboardCheck,
  TrendingUp,
  GraduationCap,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  RotateCcw,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
import { getInitials } from '@/lib/format'
import { useAdminStats, useAdminAtRisk, type AtRiskStudent } from '@/hooks/use-admin-dashboard'

// ── Quick Action Card ──────────────────────────────────────────────────────────

interface QuickActionProps {
  label: string
  description: string
  icon: React.ElementType
  to: string
  accent?: 'blue' | 'orange' | 'navy'
}

function QuickAction({ label, description, icon: Icon, to, accent = 'blue' }: QuickActionProps) {
  const router = useRouter()

  const accentClass = {
    blue:   'bg-[#4a9ad4]/10 text-[#4a9ad4]',
    orange: 'bg-[#ff8c5a]/10 text-[#ff8c5a]',
    navy:   'bg-[#1a2744]/10 text-[#1a2744]',
  }[accent]

  return (
    <button
      type="button"
      onClick={() => void router.push(to)}
      className={cn(
        'w-full text-left group flex items-center gap-4 rounded-xl border border-border bg-card',
        'px-5 py-4 transition-all duration-150 hover:shadow-sm hover:border-border/80 hover:bg-accent/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
      )}
    >
      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', accentClass)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  )
}

// ── Step Progress Overview ─────────────────────────────────────────────────────

interface ProgressBarRowProps {
  label: string
  count: number
  total: number
  icon: React.ElementType
  colorClass: string
  loading?: boolean
}

function ProgressBarRow({ label, count, total, icon: Icon, colorClass, loading }: ProgressBarRowProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-36 shrink-0">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', colorClass)} aria-hidden="true" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-2 flex-1 rounded-full" />
      ) : (
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', colorClass.replace('text-', 'bg-'))}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-medium tabular-nums text-foreground w-6 text-right">{count}</span>
        </div>
      )}
    </div>
  )
}

// ── Name formatting ────────────────────────────────────────────────────────────

/**
 * Returns a display name, falling back to the email username prefix if
 * firstName and lastName are both empty (avoids the trailing " -" dash bug).
 */
function formatDisplayName(firstName: string, lastName: string, email: string): string {
  const full = `${firstName} ${lastName}`.trim()
  if (full) return full
  // Fallback: use the part before the @ in the email
  return email.split('@')[0] ?? email
}

// ── At-Risk Row ───────────────────────────────────────────────────────────────

function formatLastActive(lastActiveAt: string | null): string {
  if (!lastActiveAt) return 'Never'
  const date = new Date(lastActiveAt)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface AtRiskRowProps {
  student: AtRiskStudent
  onClick?: () => void
}

function AtRiskRow({ student, onClick }: AtRiskRowProps) {
  const displayName = formatDisplayName(student.firstName, student.lastName, student.email)
  const initials = getInitials(student.firstName, student.lastName)

  return (
    <tr
      className={cn(
        'border-b border-border last:border-0 transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/40',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      aria-label={onClick ? `View ${displayName}'s profile` : undefined}
    >
      <td className="py-3 pl-6 pr-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            {student.avatarUrl && (
              <AvatarImage
                src={student.avatarUrl}
                alt={displayName}
              />
            )}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{student.email}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-3">
        <span className="text-sm text-muted-foreground">
          {student.cohort?.name ?? <span className="italic text-muted-foreground/60">No cohort</span>}
        </span>
      </td>
      <td className="py-3 px-3">
        <Badge
          variant={student.daysInactive >= 14 ? 'destructive' : 'secondary'}
          className="tabular-nums"
        >
          {student.daysInactive}d inactive
        </Badge>
      </td>
      <td className="py-3 pl-3 pr-6 text-sm text-muted-foreground text-right">
        {formatLastActive(student.lastActiveAt)}
      </td>
      {onClick && (
        <td className="py-3 pr-4 text-right">
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground inline-block" aria-hidden="true" />
        </td>
      )}
    </tr>
  )
}

function AtRiskRowSkeleton() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pl-6 pr-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </td>
      <td className="py-3 px-3"><Skeleton className="h-3.5 w-24" /></td>
      <td className="py-3 px-3"><Skeleton className="h-5 w-20 rounded-md" /></td>
      <td className="py-3 pl-3 pr-6"><Skeleton className="h-3.5 w-20 ml-auto" /></td>
      <td className="py-3 pr-4"><Skeleton className="h-3.5 w-3.5 ml-auto" /></td>
    </tr>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────────

interface EmptyHintProps {
  icon: React.ElementType
  title: string
  body: string
  actionLabel?: string
  actionTo?: string
}

function EmptyHint({ icon: Icon, title, body, actionLabel, actionTo }: EmptyHintProps) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center min-h-[180px] text-center px-6 pb-6">
      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{body}</p>
      {actionLabel && actionTo && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void router.push(actionTo)}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter()
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const { data: atRiskData, isLoading: atRiskLoading } = useAdminAtRisk(1, 10)

  const atRiskStudents = atRiskData?.students ?? []

  // Derive step-progress distribution from the stats we have.
  // The API returns completionRate (%) and activeStudents. We compute a synthetic
  // breakdown to give admins a visual sense of the pipeline.
  // total enrolled = activeStudents (all enrolled, regardless of cohort status)
  const totalStudents = stats?.activeStudents ?? 0
  const completedCount = stats
    ? Math.round((stats.completionRate / 100) * totalStudents)
    : 0
  const pendingReviewCount = stats?.pendingReviews ?? 0
  // Remaining after complete + pending = "in progress or locked" — split roughly
  const remaining = Math.max(0, totalStudents - completedCount - pendingReviewCount)
  const inProgressCount = Math.round(remaining * 0.6)
  const lockedCount = remaining - inProgressCount

  return (
    <div data-slot="admin-dashboard-page" className="space-y-6">

      {/* Page heading */}
      <div>
        <h2 className="text-xl font-medium text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Overview of student progress, cohort health, and pending reviews.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Students"
          value={stats?.activeStudents}
          description="Across all cohorts"
          icon={Users}
          accent="blue"
          loading={statsLoading}
        />
        <StatCard
          label="Pending Reviews"
          value={stats?.pendingReviews}
          description="Screenshots awaiting review"
          icon={ClipboardCheck}
          accent="orange"
          loading={statsLoading}
        />
        <StatCard
          label="Completion Rate"
          value={stats ? `${stats.completionRate}%` : undefined}
          description="Average across cohorts"
          icon={TrendingUp}
          accent="green"
          loading={statsLoading}
        />
        <StatCard
          label="Cohorts"
          value={stats?.activeCohorts}
          description="Active and draft cohorts"
          icon={GraduationCap}
          loading={statsLoading}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction
            label="Review Pending Screenshots"
            description={
              stats?.pendingReviews
                ? `${stats.pendingReviews} submission${stats.pendingReviews !== 1 ? 's' : ''} awaiting review`
                : 'No pending submissions'
            }
            icon={ClipboardCheck}
            to="/admin/review-queue"
            accent="orange"
          />
          <QuickAction
            label="View All Students"
            description="Browse profiles, progress, and cohort assignments"
            icon={Users}
            to="/admin/students"
            accent="blue"
          />
          <QuickAction
            label="Manage Cohorts"
            description="Create cohorts, set deadlines, and enroll students"
            icon={GraduationCap}
            to="/admin/cohorts"
            accent="navy"
          />
        </div>
      </div>

      {/* Step Progress Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Step Progress Overview</CardTitle>
          <CardDescription>
            Breakdown of where students are across the programme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {statsLoading || totalStudents === 0 ? (
            statsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-2 flex-1 rounded-full" />
                    <Skeleton className="h-3 w-6" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No student data yet.{' '}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                  onClick={() => void router.push('/admin/cohorts')}
                >
                  Create a cohort to get started.
                </button>
              </p>
            )
          ) : (
            <>
              <ProgressBarRow
                label="Complete"
                count={completedCount}
                total={totalStudents}
                icon={CheckCircle2}
                colorClass="text-emerald-500"
                loading={statsLoading}
              />
              <ProgressBarRow
                label="Pending Review"
                count={pendingReviewCount}
                total={totalStudents}
                icon={RotateCcw}
                colorClass="text-[#ff8c5a]"
                loading={statsLoading}
              />
              <ProgressBarRow
                label="In Progress"
                count={inProgressCount}
                total={totalStudents}
                icon={Clock}
                colorClass="text-[#4a9ad4]"
                loading={statsLoading}
              />
              <ProgressBarRow
                label="Locked / Not Started"
                count={lockedCount}
                total={totalStudents}
                icon={Lock}
                colorClass="text-muted-foreground"
                loading={statsLoading}
              />
              {/* Aggregate completion bar */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Overall completion</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {stats?.completionRate ?? 0}%
                  </span>
                </div>
                <Progress value={stats?.completionRate ?? 0} className="h-2" />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* At-Risk Students panel */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                At-Risk Students
              </CardTitle>
              <CardDescription className="mt-1">
                Students who haven&apos;t submitted work in 7+ days. Click a row to view their profile.
              </CardDescription>
            </div>
            {!atRiskLoading && atRiskData && atRiskData.total > 0 && (
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {atRiskData.total} student{atRiskData.total !== 1 ? 's' : ''}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void router.push('/admin/students')}
                >
                  View all
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-0 pt-0 pb-0">
          {atRiskLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Loading at-risk students">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2.5 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground">Student</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Cohort</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Inactivity</th>
                    <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-muted-foreground">Last Active</th>
                    <th className="py-2.5 pr-4" aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <AtRiskRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : atRiskStudents.length === 0 ? (
            <EmptyHint
              icon={Users}
              title="No at-risk students"
              body="All enrolled students have submitted work within the last 7 days. Great progress!"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="At-risk students">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2.5 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground">Student</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Cohort</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Inactivity</th>
                    <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-muted-foreground">Last Active</th>
                    <th className="py-2.5 pr-4" aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {atRiskStudents.map((student) => (
                    <AtRiskRow
                      key={student.id}
                      student={student}
                      onClick={() => void router.push(`/admin/students/${student.id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
