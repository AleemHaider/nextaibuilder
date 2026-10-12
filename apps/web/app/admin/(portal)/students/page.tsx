'use client'
// PBA-131 — Admin Students page (Sprint 4 — live data)
// PBA-288 — Invite student modal, inviteStatus badge, resend/revoke actions
// PBA-365 — Replace InviteStudentDialog with AddStudentsModal (multi-email + CSV)
// PBA-367 — Sort controls
// PBA-368 — Table / Card view toggle
// PBA-369 — Per-row action menu with nudge
// PBA-370 — Full numbered pagination
import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Users,
  UserPlus,
  MoreHorizontal,
  LayoutList,
  LayoutGrid,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PermissionGate } from '@/components/ui/permission-gate'
import { cn } from '@/lib/utils'
import { getInitials, formatRelative } from '@/lib/format'
import { useDebounce } from '@/hooks/use-debounce'
import { HealthStatusBadge, getProgressBarClass } from '@/components/admin/health-status-badge'
import { InviteStatusBadge } from '@/components/admin/invite-status-badge'
import {
  useAdminStudents,
  useNudgeStudent,
  type AdminStudent,
  type HealthStatus,
  type SortBy,
  type SortDir,
} from '@/hooks/use-admin-students'
import { useAdminCohorts } from '@/hooks/use-admin-cohorts'
import { AddStudentsModal } from '@/components/admin/add-students-modal'
import { useStudentPresence } from '@/hooks/use-student-presence'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 20
const VIEW_STORAGE_KEY = 'pba_students_view'

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEALTH_DOT_CLASS: Record<HealthStatus, string> = {
  on_track:  'bg-green-500',
  at_risk:   'bg-amber-500',
  blocked:   'bg-red-500',
  completed: 'bg-green-400',
}

// ── Student action menu (PBA-369) ──────────────────────────────────────────────

interface StudentActionMenuProps {
  student: AdminStudent
  onViewProfile: () => void
}

function StudentActionMenu({ student, onViewProfile }: StudentActionMenuProps) {
  const nudgeMutation = useNudgeStudent(student.id)

  const handleNudge = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await nudgeMutation.mutateAsync()
      toast.success('Nudge sent!')
    } catch {
      toast.error('Failed to send nudge. Please try again.')
    }
  }

  const handleOverrideStep = (e: React.MouseEvent) => {
    e.stopPropagation()
    toast.info('Coming soon')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={`More actions for ${student.firstName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onViewProfile() }}
        >
          View Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleNudge}
          disabled={nudgeMutation.isPending}
        >
          {nudgeMutation.isPending ? 'Sending…' : 'Send Nudge'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOverrideStep}>
          Override Step
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Table row (PBA-369: View + action menu) ────────────────────────────────────

interface StudentRowProps {
  student: AdminStudent
  sortBy: SortBy
  onClick: () => void
  isOnline: boolean
}

function StudentRow({ student, onClick, isOnline }: StudentRowProps) {
  const initials = getInitials(student.firstName, student.lastName)
  const pct = student.progressPercent ?? 0
  const healthStatus: HealthStatus = student.healthStatus ?? 'on_track'
  const isStale = (student.daysSinceActive ?? 0) > 14

  return (
    <tr
      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <td className="py-3 pl-6 pr-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Avatar className="h-8 w-8">
              {student.avatarUrl && (
                <AvatarImage src={student.avatarUrl} alt={`${student.firstName} ${student.lastName}`} />
              )}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            {/* Presence dot — top-right */}
            <span
              className={cn(
                'absolute top-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white',
                isOnline ? 'bg-green-500' : 'bg-gray-300',
              )}
              title={isOnline ? 'Online now' : 'Offline'}
              aria-label={isOnline ? 'Online now' : 'Offline'}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center">
              <p className="text-sm font-medium text-foreground truncate">
                {student.firstName} {student.lastName}
              </p>
              <InviteStatusBadge status={student.inviteStatus} />
            </div>
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
        <HealthStatusBadge status={healthStatus} />
      </td>
      <td className="py-3 px-3 min-w-[140px]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Progress value={pct} className={cn('h-1.5 flex-1', getProgressBarClass(healthStatus))} />
            <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {student.completedSteps}/{student.totalSteps} steps
          </p>
        </div>
      </td>
      <td className="py-3 px-3">
        <span className={cn('text-sm', isStale ? 'text-destructive' : 'text-muted-foreground')}>
          {formatRelative(student.lastActiveAt)}
        </span>
      </td>
      <td className="py-3 pl-3 pr-6">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={`View ${student.firstName}'s profile`}
            onClick={(e) => { e.stopPropagation(); onClick() }}
          >
            View
          </Button>
          <StudentActionMenu student={student} onViewProfile={onClick} />
        </div>
      </td>
    </tr>
  )
}

function StudentRowSkeleton() {
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
      <td className="py-3 px-3"><Skeleton className="h-5 w-16 rounded-md" /></td>
      <td className="py-3 px-3">
        <div className="space-y-1">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      </td>
      <td className="py-3 px-3"><Skeleton className="h-3.5 w-16" /></td>
      <td className="py-3 pl-3 pr-6"><Skeleton className="h-7 w-20 ml-auto" /></td>
    </tr>
  )
}

// ── Sort indicator (PBA-367) ───────────────────────────────────────────────────

interface SortIndicatorProps {
  column: SortBy
  activeSortBy: SortBy
  activeSortDir: SortDir
}

function SortIndicator({ column, activeSortBy, activeSortDir }: SortIndicatorProps) {
  const isActive = activeSortBy === column
  const Icon = isActive && activeSortDir === 'asc' ? ChevronUp : ChevronDown
  return (
    <Icon
      className={cn(
        'h-3 w-3 shrink-0 transition-opacity',
        isActive ? 'opacity-100 text-[#4a9ad4]' : 'opacity-30',
      )}
      aria-hidden="true"
    />
  )
}

// ── Student card (PBA-368) ─────────────────────────────────────────────────────

interface StudentCardProps {
  student: AdminStudent
  onClick: () => void
  isOnline: boolean
}

function StudentCard({ student, onClick, isOnline }: StudentCardProps) {
  const initials = getInitials(student.firstName, student.lastName)
  const pct = student.progressPercent ?? 0
  const healthStatus: HealthStatus = student.healthStatus ?? 'on_track'
  const isStale = (student.daysSinceActive ?? 0) > 14
  const dotClass = HEALTH_DOT_CLASS[healthStatus] ?? 'bg-muted-foreground'

  return (
    <div
      data-slot="student-card"
      className="relative bg-card border border-border rounded-xl p-4 cursor-pointer hover:bg-muted/20 transition-colors"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      aria-label={`View ${student.firstName} ${student.lastName}'s profile`}
    >
      {/* Top-right action menu */}
      <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
        <StudentActionMenu student={student} onViewProfile={onClick} />
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-3 pr-8 mb-3">
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            {student.avatarUrl && (
              <AvatarImage src={student.avatarUrl} alt={`${student.firstName} ${student.lastName}`} />
            )}
            <AvatarFallback className="text-sm">{initials}</AvatarFallback>
          </Avatar>
          {/* Presence dot — top-right */}
          <span
            className={cn(
              'absolute top-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white',
              isOnline ? 'bg-green-500' : 'bg-gray-300',
            )}
            title={isOnline ? 'Online now' : 'Offline'}
            aria-label={isOnline ? 'Online now' : 'Offline'}
          />
          {/* Health status dot — bottom-right (unchanged) */}
          <span
            className={cn(
              'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card',
              dotClass,
            )}
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {student.firstName} {student.lastName}
          </p>
          <p className="text-xs text-muted-foreground truncate">{student.email}</p>
        </div>
      </div>

      {/* Cohort */}
      <p className="text-xs text-muted-foreground mb-2">
        {student.cohort?.name ?? <span className="italic text-muted-foreground/60">No cohort</span>}
      </p>

      {/* Progress bar */}
      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-2">
          <Progress value={pct} className={cn('h-1.5 flex-1', getProgressBarClass(healthStatus))} />
          <span className="text-xs text-muted-foreground tabular-nums w-8 text-right shrink-0">{pct}%</span>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {student.completedSteps}/{student.totalSteps} steps
        </p>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <HealthStatusBadge status={healthStatus} />
        <span className={cn('text-xs', isStale ? 'text-destructive' : 'text-muted-foreground')}>
          {formatRelative(student.lastActiveAt)}
        </span>
      </div>
    </div>
  )
}

function StudentCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

// ── Full numbered pagination (PBA-370) ─────────────────────────────────────────

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPage: (page: number) => void
}

function buildPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = [1]

  if (currentPage > 3) {
    pages.push('...')
  }

  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (currentPage < totalPages - 2) {
    pages.push('...')
  }

  pages.push(totalPages)

  return pages
}

function Pagination({ page, totalPages, total, limit, onPage }: PaginationProps) {
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)
  const pageNumbers = buildPageNumbers(page, totalPages)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-t border-border">
      <p className="text-xs text-muted-foreground order-2 sm:order-1">
        {total === 0 ? 'No results' : `Showing ${start}–${end} of ${total} students`}
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        {/* Prev */}
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        {/* Page numbers */}
        {pageNumbers.map((p, i) =>
          p === '...' ? (
            <span
              key={`ellipsis-${i}`}
              className="h-7 w-7 flex items-center justify-center text-xs text-muted-foreground select-none"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'ghost'}
              size="icon"
              className={cn(
                'h-7 w-7 text-xs',
                p === page && 'bg-primary text-primary-foreground rounded-md',
              )}
              onClick={() => onPage(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Button>
          )
        )}

        {/* Next */}
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── View toggle (PBA-368) ──────────────────────────────────────────────────────

type ViewMode = 'table' | 'card'

interface ViewToggleProps {
  view: ViewMode
  onChange: (v: ViewMode) => void
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className="flex items-center bg-input-background rounded-lg p-0.5 gap-0.5"
    >
      <button
        type="button"
        aria-label="Table view"
        aria-pressed={view === 'table'}
        onClick={() => onChange('table')}
        className={cn(
          'h-7 w-7 flex items-center justify-center rounded-md transition-all',
          view === 'table'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutList className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Card view"
        aria-pressed={view === 'card'}
        onClick={() => onChange('card')}
        className={cn(
          'h-7 w-7 flex items-center justify-center rounded-md transition-all',
          view === 'card'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Sort config ────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { label: string; sortBy: SortBy; sortDir: SortDir }[] = [
  { label: 'Sort: Last Active', sortBy: 'lastActiveAt', sortDir: 'desc' },
  { label: 'Sort: Name A–Z',    sortBy: 'name',         sortDir: 'asc'  },
  { label: 'Sort: Progress',    sortBy: 'progress',     sortDir: 'desc' },
]

function sortKey(sortBy: SortBy, sortDir: SortDir) {
  return `${sortBy}:${sortDir}`
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter()
  const { isOnline } = useStudentPresence()
  const [search, setSearch] = React.useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [cohortId, setCohortId] = React.useState<string>('all')
  const [status, setStatus] = React.useState<string>('all')
  const [page, setPage] = React.useState(1)
  const [showInviteDialog, setShowInviteDialog] = React.useState(false)

  // PBA-367 — sort state
  const [sortBy, setSortBy] = React.useState<SortBy>('lastActiveAt')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  // PBA-368 — view toggle, persisted to localStorage
  const [view, setView] = React.useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY)
      return stored === 'card' ? 'card' : 'table'
    } catch {
      return 'table'
    }
  })

  const handleViewChange = (v: ViewMode) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v)
    } catch {
      // ignore storage errors
    }
  }

  // Reset page when search, filters, or sort change
  React.useEffect(() => { setPage(1) }, [debouncedSearch, cohortId, status, sortBy, sortDir])

  const { data: cohortsData } = useAdminCohorts()
  const { data, isLoading } = useAdminStudents({
    q: debouncedSearch || undefined,
    cohortId: cohortId !== 'all' ? cohortId : undefined,
    status: status !== 'all' ? (status as HealthStatus) : undefined,
    page,
    limit: PAGE_LIMIT,
    sortBy,
    sortDir,
  })

  const students = data?.students ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  const activeSortKey = sortKey(sortBy, sortDir)

  const handleSortChange = (val: string) => {
    const opt = SORT_OPTIONS.find((o) => sortKey(o.sortBy, o.sortDir) === val)
    if (opt) {
      setSortBy(opt.sortBy)
      setSortDir(opt.sortDir)
    }
  }

  return (
    <div data-slot="admin-students-page" className="space-y-6">

      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-foreground">Students</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            View and manage all students across cohorts.
          </p>
        </div>
        <PermissionGate permission="students:invite">
          <Button onClick={() => setShowInviteDialog(true)} className="shrink-0">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add Students
          </Button>
        </PermissionGate>
      </div>

      {/* Controls row — search, filters, sort, view toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search students"
          />
        </div>

        {/* Cohort filter */}
        <Select value={cohortId} onValueChange={setCohortId}>
          <SelectTrigger className="w-[160px]" aria-label="Filter by cohort">
            <SelectValue placeholder="All cohorts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cohorts</SelectItem>
            {cohortsData?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="on_track">On Track</SelectItem>
            <SelectItem value="at_risk">At Risk</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="completed">Complete</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort dropdown (PBA-367) */}
        <Select value={activeSortKey} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[180px]" aria-label="Sort students">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={sortKey(opt.sortBy, opt.sortDir)} value={sortKey(opt.sortBy, opt.sortDir)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View toggle (PBA-368) — pushed to the right */}
        <div className="sm:ml-auto">
          <ViewToggle view={view} onChange={handleViewChange} />
        </div>
      </div>

      {/* Table view */}
      {view === 'table' && (
        <Card>
          <CardHeader>
            <CardTitle>Student Progress</CardTitle>
            <CardDescription>
              {isLoading ? 'Loading students…' : `${total} student${total !== 1 ? 's' : ''} found`}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-0 pb-0">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Students table">
                <thead>
                  <tr className="border-b border-border">
                    {/* Student column with sort indicator (PBA-367) */}
                    <th className="py-2.5 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        Student
                        <SortIndicator column="name" activeSortBy={sortBy} activeSortDir={sortDir} />
                      </span>
                    </th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Cohort</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    {/* Progress column with sort indicator (PBA-367) */}
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        Progress
                        <SortIndicator column="progress" activeSortBy={sortBy} activeSortDir={sortDir} />
                      </span>
                    </th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Last Active</th>
                    <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 8 }).map((_, i) => <StudentRowSkeleton key={i} />)
                    : students.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                              <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                            </div>
                            <p className="text-sm font-medium text-foreground">No students found</p>
                            <p className="text-xs text-muted-foreground">
                              Try adjusting your filters or search query.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )
                    : students.map((student) => (
                      <StudentRow
                        key={student.id}
                        student={student}
                        sortBy={sortBy}
                        onClick={() => router.push(`/admin/students/${student.id}`)}
                        isOnline={isOnline(student.id)}
                      />
                    ))
                  }
                </tbody>
              </table>
            </div>

            {!isLoading && total > 0 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={PAGE_LIMIT}
                onPage={setPage}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Card view (PBA-368) */}
      {view === 'card' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Loading students…' : `${total} student${total !== 1 ? 's' : ''} found`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading
              ? Array.from({ length: 9 }).map((_, i) => <StudentCardSkeleton key={i} />)
              : students.length === 0
              ? (
                <div className="col-span-full py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No students found</p>
                    <p className="text-xs text-muted-foreground">
                      Try adjusting your filters or search query.
                    </p>
                  </div>
                </div>
              )
              : students.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  onClick={() => router.push(`/admin/students/${student.id}`)}
                  isOnline={isOnline(student.id)}
                />
              ))
            }
          </div>

          {/* Pagination for card view */}
          {!isLoading && total > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={PAGE_LIMIT}
                onPage={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Add Students modal (PBA-365) */}
      <AddStudentsModal
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
      />

    </div>
  )
}
