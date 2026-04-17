// PBA-132 — Admin Reports & Analytics page
import * as React from 'react'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Download,
  TrendingUp,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Clock,
  BarChart2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  useProgressReport,
  useSubmissionsReport,
  downloadProgressExport,
  type ProgressReportCohort,
} from '@/hooks/use-admin-reports'

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden="true" />
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number | undefined
  description: string
  icon: React.ElementType
  loading?: boolean
  className?: string
}

function StatCard({ label, value, description, icon: Icon, loading, className }: StatCardProps) {
  return (
    <Card data-slot="stat-card" className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">
            {label}
          </CardDescription>
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3.5 w-32" />
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold text-foreground tabular-nums">{value ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Cohort progress row ───────────────────────────────────────────────────────

function CohortProgressRow({ cohort }: { cohort: ProgressReportCohort }) {
  const [expanded, setExpanded] = React.useState(false)
  const pct = Math.round(cohort.avgProgressPercent)

  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
        <td className="py-3 pl-6 pr-3">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${cohort.cohortName} step pass rates`}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            )}
            {cohort.cohortName}
          </button>
        </td>
        <td className="py-3 px-3 text-sm text-muted-foreground tabular-nums">
          {cohort.totalStudents}
        </td>
        <td className="py-3 px-3 text-sm text-muted-foreground tabular-nums">
          {cohort.completedStudents}
        </td>
        <td className="py-3 pl-3 pr-6">
          <div className="flex items-center gap-2.5 min-w-[140px]">
            <Progress value={pct} className="h-1.5 flex-1" aria-label={`${pct}% average progress`} />
            <span className="text-sm font-medium text-foreground tabular-nums w-9 text-right shrink-0">
              {pct}%
            </span>
          </div>
        </td>
      </tr>
      {expanded && cohort.stepPassRates.length > 0 && (
        <tr className="border-b border-border last:border-0">
          <td colSpan={4} className="px-6 pb-3 pt-0">
            <div className="bg-muted/40 rounded-lg p-4 mt-1 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Step Pass Rates
              </p>
              {cohort.stepPassRates
                .slice()
                .sort((a, b) => a.stepOrder - b.stepOrder)
                .map((step) => (
                  <div key={step.stepId} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                      {step.stepOrder}
                    </span>
                    <span className="text-sm text-foreground flex-1 truncate">{step.stepTitle}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Progress
                        value={Math.round(step.passRate)}
                        className="h-1.5 w-24"
                        aria-label={`${Math.round(step.passRate)}% pass rate`}
                      />
                      <span className="text-xs font-medium text-foreground tabular-nums w-9 text-right">
                        {Math.round(step.passRate)}%
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {step.totalAttempts} attempt{step.totalAttempts !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground mt-0.5">{payload[0].value} submissions</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function AdminReportsPage() {
  const [exporting, setExporting] = React.useState(false)
  const { data: submissionsData, isLoading: submissionsLoading } = useSubmissionsReport()
  const { data: progressData, isLoading: progressLoading } = useProgressReport()

  const cohorts = progressData?.cohorts ?? []
  const chartData = (submissionsData?.submissionsByDay ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: d.count,
  }))

  const handleExport = async () => {
    try {
      setExporting(true)
      await downloadProgressExport()
      toast.success('Export started — check your downloads.')
    } catch {
      toast.error('Failed to start export')
    } finally {
      setExporting(false)
    }
  }

  const mlRate = submissionsData?.mlAccuracyRate
  const mlLabel = mlRate !== null && mlRate !== undefined ? `${Math.round(mlRate * 100)}%` : '—'

  return (
    <div data-slot="admin-reports-page" className="space-y-6">

      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-foreground">Reports &amp; Analytics</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submission metrics, cohort progress, and trend data.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          aria-label="Export progress report as CSV"
        >
          {exporting ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              Exporting…
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export CSV
            </>
          )}
        </Button>
      </div>

      {/* Submissions stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Submissions"
          value={submissionsData?.totalSubmissions}
          description="All time"
          icon={ClipboardCheck}
          loading={submissionsLoading}
        />
        <StatCard
          label="Approved Today"
          value={submissionsData?.approvedToday}
          description="In the last 24 hours"
          icon={CheckCircle}
          loading={submissionsLoading}
        />
        <StatCard
          label="Rejected Today"
          value={submissionsData?.rejectedToday}
          description="In the last 24 hours"
          icon={XCircle}
          loading={submissionsLoading}
        />
        <StatCard
          label="Pending Now"
          value={submissionsData?.pendingNow}
          description="Awaiting review"
          icon={Clock}
          loading={submissionsLoading}
        />
        <StatCard
          label="ML Accuracy"
          value={mlLabel}
          description="Model vs. admin decisions"
          icon={TrendingUp}
          loading={submissionsLoading}
        />
      </div>

      {/* Submissions by day chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" aria-hidden="true" />
            Submissions (Last 30 Days)
          </CardTitle>
          <CardDescription>Daily submission volume across all cohorts.</CardDescription>
        </CardHeader>
        <CardContent>
          {submissionsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <BarChart2 className="h-8 w-8 text-muted-foreground/40 mb-2" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">No submission data yet.</p>
            </div>
          ) : (
            <div className="h-48" aria-label="Submissions by day bar chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
                  <Bar
                    dataKey="count"
                    fill="var(--primary)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cohort progress table */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                Cohort Progress
              </CardTitle>
              <CardDescription className="mt-1">
                Average completion across each cohort. Click a row to expand step pass rates.
              </CardDescription>
            </div>
            {!progressLoading && progressData && (
              <Badge variant="secondary" className="shrink-0 mt-0.5">
                {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-0 pt-0 pb-0">
          {progressLoading ? (
            <div className="px-6 pb-6 space-y-3 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-2 flex-1 rounded-full" />
                </div>
              ))}
            </div>
          ) : cohorts.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[160px] text-center px-6 pb-6">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground">No cohort data yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Progress data will appear once students begin submitting work.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Cohort progress">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2.5 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground">
                      Cohort
                    </th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">
                      Students
                    </th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">
                      Completed
                    </th>
                    <th className="py-2.5 pl-3 pr-6 text-left text-xs font-medium text-muted-foreground">
                      Avg Progress
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort) => (
                    <CohortProgressRow key={cohort.cohortId} cohort={cohort} />
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

export { AdminReportsPage }
