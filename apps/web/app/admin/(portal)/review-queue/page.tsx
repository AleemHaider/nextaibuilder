'use client'
// PBA-130 — Admin Review Queue (Sprint 3 full implementation)
import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  TrendingUp,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
import { SubmissionStatusBadge, mlScoreColor, mlScoreBg } from '@/components/admin/submission-status-badge'
import type { SubmissionStatus } from '@/components/admin/submission-status-badge'
import {
  useAdminSubmissions,
  useAdminQueueStats,
  type AdminSubmissionsFilters,
  type AdminSubmissionRow,
} from '@/hooks/use-admin-submissions'
import { useDebounce } from '@/hooks/use-debounce'
import { getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <tr>
      <td colSpan={6}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <ClipboardCheck className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {hasFilters ? 'No submissions match your filters' : 'No submissions yet'}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {hasFilters
              ? 'Try adjusting your search or status filter.'
              : 'Student screenshot submissions will appear here for review.'}
          </p>
        </div>
      </td>
    </tr>
  )
}

// ── Submission row ─────────────────────────────────────────────────────────────

interface SubmissionRowProps {
  submission: AdminSubmissionRow
  onReview: (id: string) => void
}

function SubmissionRow({ submission, onReview }: SubmissionRowProps) {
  const { student, step, status, mlScore, createdAt } = submission
  const fullName = `${student.firstName} ${student.lastName}`.trim()
  const initials = getInitials(student.firstName, student.lastName)

  return (
    <tr className="border-b border-border hover:bg-accent/40 transition-colors group">
      {/* Student */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={student.avatarUrl ?? undefined} alt={fullName} />
            <AvatarFallback className="text-[10px] font-medium bg-secondary text-secondary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-tight">{fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{student.email}</p>
          </div>
        </div>
      </td>

      {/* Step */}
      <td className="px-4 py-3">
        <p className="text-sm text-foreground">
          <span className="text-muted-foreground mr-1.5 tabular-nums">#{step.order}</span>
          {step.title}
        </p>
      </td>

      {/* Submitted */}
      <td className="px-4 py-3">
        <p className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
        </p>
      </td>

      {/* ML Score */}
      <td className="px-4 py-3">
        {mlScore !== null ? (
          <div className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums', mlScoreBg(mlScore), mlScoreColor(mlScore))}>
            {mlScore}
            <span className="text-xs font-normal opacity-70">/ 100</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <SubmissionStatusBadge status={status} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReview(submission.id)}
          className="h-7 px-2.5 text-xs gap-1.5"
          aria-label={`Review ${fullName}'s submission for step ${step.order}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Review
        </Button>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function Page() {
  const router = useRouter()

  const [search, setSearch] = React.useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = React.useState<SubmissionStatus | 'ALL'>('HUMAN_REVIEW')
  const [page, setPage] = React.useState(1)

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter])

  const filters: AdminSubmissionsFilters = {
    status: statusFilter,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  }

  const { data, isLoading, isError } = useAdminSubmissions(filters)
  const { data: stats, isLoading: statsLoading } = useAdminQueueStats()

  const hasFilters = Boolean(debouncedSearch) || statusFilter !== 'ALL'
  const totalPages = data?.totalPages ?? 1

  function handleReview(id: string) {
    void router.push(`/admin/review-queue/${id}`)
  }

  return (
    <div data-slot="admin-review-queue-page" className="space-y-6">

      {/* Page heading */}
      <div>
        <h2 className="text-xl font-medium text-foreground">Review Queue</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Student screenshot submissions awaiting admin review and feedback.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pending review"
          value={stats?.totalPending ?? 0}
          icon={Clock}
          loading={statsLoading}
          accent="orange"
        />
        <StatCard
          label="Approved today"
          value={stats?.approvedToday ?? 0}
          icon={CheckCircle2}
          loading={statsLoading}
          accent="green"
        />
        <StatCard
          label="Rejected today"
          value={stats?.rejectedToday ?? 0}
          icon={XCircle}
          loading={statsLoading}
          accent="default"
        />
        <StatCard
          label="Avg ML score"
          value={
            stats?.avgMlScore !== null && stats?.avgMlScore !== undefined
              ? `${Math.round(stats.avgMlScore)}`
              : undefined
          }
          icon={TrendingUp}
          loading={statsLoading}
          accent="blue"
        />
      </div>

      {/* Filter bar + table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Submission Queue</CardTitle>
              <CardDescription className="mt-1">
                {data
                  ? `${data.total} submission${data.total !== 1 ? 's' : ''} total`
                  : 'Loading…'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-full"
                  aria-label="Search submissions"
                />
              </div>

              {/* Status filter */}
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as SubmissionStatus | 'ALL')}
              >
                <SelectTrigger className="w-44 h-8 text-xs" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ML_PROCESSING">ML Processing</SelectItem>
                  <SelectItem value="HUMAN_REVIEW">Awaiting Review</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {/* Error state */}
          {isError && (
            <div className="flex items-center justify-center py-16 text-center px-6">
              <div>
                <p className="text-sm font-medium text-foreground">Failed to load submissions</p>
                <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
              </div>
            </div>
          )}

          {/* Table */}
          {!isError && (
            <div className="overflow-x-auto">
              <table className="w-full text-left" aria-label="Submission review queue">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground w-52">Student</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Step</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">Submitted</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">ML Score</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  )}

                  {!isLoading && (!data?.submissions || data.submissions.length === 0) && (
                    <EmptyState hasFilters={hasFilters} />
                  )}

                  {!isLoading && data?.submissions.map((sub) => (
                    <SubmissionRow
                      key={sub.id}
                      submission={sub}
                      onReview={handleReview}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isError && !isLoading && data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} &middot; {data.total} total
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>

                {/* Page number pills */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? 'default' : 'outline'}
                      size="icon"
                      className="h-7 w-7 text-xs"
                      onClick={() => setPage(pageNum)}
                      aria-label={`Go to page ${pageNum}`}
                      aria-current={pageNum === page ? 'page' : undefined}
                    >
                      {pageNum}
                    </Button>
                  )
                })}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
