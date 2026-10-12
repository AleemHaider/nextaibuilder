'use client'
// PBA-364 — Admin Cohort Roster page
// Route: /admin/cohorts/:cohortId/roster
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  UserPlus,
  MoreHorizontal,
  Users,
  ChevronLeft,
  ArrowLeft,
  Eye,
  BellRing,
  ArrowRightLeft,
  UserMinus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PermissionGate } from '@/components/ui/permission-gate'
import { cn } from '@/lib/utils'
import { useNudgeStudent, type AdminStudent } from '@/hooks/use-admin-students'
import { useAdminCohort, useAdminCohortStudents } from '@/hooks/use-admin-cohorts'
import { AddStudentsModal } from '@/components/admin/add-students-modal'
import { Skeleton } from '@/components/ui/skeleton'
import { getInitials, formatDate } from '@/lib/format'
import { HealthStatusBadge, getProgressBarClass, type HealthStatus } from '@/components/admin/health-status-badge'

// ── Nudge button (isolated so each row has its own mutation instance) ─────────

function NudgeMenuItem({ studentId, onDone }: { studentId: string; onDone?: () => void }) {
  const nudge = useNudgeStudent(studentId)
  return (
    <DropdownMenuItem
      disabled={nudge.isPending}
      onSelect={async (e) => {
        e.preventDefault()
        try {
          await nudge.mutateAsync()
          toast.success('Nudge sent')
          onDone?.()
        } catch (err) {
          const er = err as { message?: string }
          toast.error(er.message ?? 'Failed to send nudge')
        }
      }}
    >
      <BellRing className="h-4 w-4" aria-hidden="true" />
      Send Nudge
    </DropdownMenuItem>
  )
}

// ── Row actions dropdown ───────────────────────────────────────────────────────

interface RowActionsProps {
  student: AdminStudent
  onRemoveRequest: (student: AdminStudent) => void
}

function RowActions({ student, onRemoveRequest }: RowActionsProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={`Actions for ${student.firstName} ${student.lastName}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => router.push(`/admin/students/${student.id}`)}>
          <Eye className="h-4 w-4" aria-hidden="true" />
          View Profile
        </DropdownMenuItem>
        <NudgeMenuItem studentId={student.id} onDone={() => setOpen(false)} />
        <DropdownMenuItem
          onSelect={() => {
            toast.info('Transfer to cohort — coming soon')
            setOpen(false)
          }}
        >
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
          Transfer to Cohort
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
          onSelect={() => {
            onRemoveRequest(student)
            setOpen(false)
          }}
        >
          <UserMinus className="h-4 w-4" aria-hidden="true" />
          Remove from Cohort
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Roster table row ───────────────────────────────────────────────────────────

interface RosterRowProps {
  student: AdminStudent
  onRemoveRequest: (student: AdminStudent) => void
}

function RosterRow({ student, onRemoveRequest }: RosterRowProps) {
  const initials = getInitials(student.firstName, student.lastName)
  const pct = student.progressPercent ?? 0
  const healthStatus: HealthStatus = student.healthStatus ?? 'on_track'

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-3 pl-6 pr-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            {student.avatarUrl && (
              <AvatarImage src={student.avatarUrl} alt={`${student.firstName} ${student.lastName}`} />
            )}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link
              href={`/admin/students/${student.id}`}
              className="text-sm font-medium text-foreground hover:underline truncate block"
            >
              {student.firstName} {student.lastName}
            </Link>
            <p className="text-xs text-muted-foreground truncate">{student.email}</p>
          </div>
        </div>
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
        <span className="text-sm text-muted-foreground">{formatDate(student.joinedAt)}</span>
      </td>
      <td className="py-3 pl-3 pr-6 text-right">
        <RowActions student={student} onRemoveRequest={onRemoveRequest} />
      </td>
    </tr>
  )
}

function RosterRowSkeleton() {
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
      <td className="py-3 px-3"><Skeleton className="h-5 w-16 rounded-md" /></td>
      <td className="py-3 px-3">
        <div className="space-y-1">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      </td>
      <td className="py-3 px-3"><Skeleton className="h-3.5 w-20" /></td>
      <td className="py-3 pl-3 pr-6"><Skeleton className="h-7 w-8 ml-auto rounded-md" /></td>
    </tr>
  )
}

// ── Remove confirm dialog ──────────────────────────────────────────────────────

interface RemoveDialogProps {
  student: AdminStudent | null
  onClose: () => void
}

function RemoveConfirmDialog({ student, onClose }: RemoveDialogProps) {
  return (
    <AlertDialog open={Boolean(student)} onOpenChange={(v) => { if (!v) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from Cohort</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove{' '}
            <strong>{student?.firstName} {student?.lastName}</strong> from this cohort?
            Their progress will be preserved but they will lose access.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => {
              toast.info('Remove from cohort — coming soon')
              onClose()
            }}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Page() {
  const { cohortId } = useParams<{ cohortId: string }>()
  const router = useRouter()

  const [showAddModal, setShowAddModal] = React.useState(false)
  const [removeStudent, setRemoveStudent] = React.useState<AdminStudent | null>(null)

  const { data: cohort, isLoading: cohortLoading } = useAdminCohort(cohortId ?? '')
  const { data: rawStudents, isLoading: studentsLoading } = useAdminCohortStudents(cohortId ?? '')

  const students: AdminStudent[] = (rawStudents ?? []).map((s) => ({
    ...s,
    role: 'student',
    cohort: null,
    daysSinceActive: null,
    joinedAt: s.enrolledAt ?? '',
    status: 'active' as const,
    healthStatus: 'on_track' as const,
    inviteStatus: 'ACCEPTED' as const,
  }))

  if (!cohortId) {
    router.replace('/admin/cohorts')
    return null
  }

  return (
    <div data-slot="admin-cohort-roster-page" className="space-y-6">

      {/* Back nav */}
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => router.push(`/admin/cohorts/${cohortId}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Cohort
      </Button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronLeft className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        <Link href="/admin/cohorts" className="hover:text-foreground transition-colors">Cohorts</Link>
        <ChevronLeft className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        {cohortLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <Link
            href={`/admin/cohorts/${cohortId}`}
            className="hover:text-foreground transition-colors"
          >
            {cohort?.name ?? cohortId}
          </Link>
        )}
        <ChevronLeft className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        <span className="text-foreground font-medium">Roster</span>
      </nav>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-foreground">Student Roster</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {cohortLoading ? (
              <Skeleton className="h-4 w-40 inline-block" />
            ) : (
              `Students enrolled in ${cohort?.name ?? ''}`
            )}
          </p>
        </div>
        <PermissionGate permission="students:invite">
          <Button onClick={() => setShowAddModal(true)} className="shrink-0">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add Students
          </Button>
        </PermissionGate>
      </div>

      {/* Roster table */}
      <Card>
        <CardHeader>
          <CardTitle>Enrolled Students</CardTitle>
          <CardDescription>
            {studentsLoading
              ? 'Loading students…'
              : `${students.length} student${students.length !== 1 ? 's' : ''} enrolled`}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Cohort student roster">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2.5 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground">Student</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Progress</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Joined</th>
                  <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentsLoading
                  ? Array.from({ length: 6 }).map((_, i) => <RosterRowSkeleton key={i} />)
                  : students.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                            <Users className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">No students in this cohort yet</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Add students to get started.
                            </p>
                          </div>
                          <PermissionGate permission="students:invite">
                            <Button size="sm" onClick={() => setShowAddModal(true)}>
                              <UserPlus className="h-3.5 w-3.5" />
                              Add Students
                            </Button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  )
                  : students.map((student) => (
                    <RosterRow
                      key={student.id}
                      student={student}
                      onRemoveRequest={setRemoveStudent}
                    />
                  ))
                }
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Students Modal */}
      <AddStudentsModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        cohortId={cohortId}
        cohortName={cohort?.name}
      />

      {/* Remove confirm dialog */}
      <RemoveConfirmDialog
        student={removeStudent}
        onClose={() => setRemoveStudent(null)}
      />

    </div>
  )
}
