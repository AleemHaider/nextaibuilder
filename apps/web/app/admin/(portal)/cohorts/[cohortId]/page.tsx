'use client'
// PBA-131 — Admin Cohort Detail page
// PBA-237 — PermissionGate applied to enroll/remove actions
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  UserPlus,
  Trash2,
  ChevronRight,
  GraduationCap,
  CalendarDays,
  GripVertical,
  BookOpen,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { getInitials, formatDate, formatRelative } from '@/lib/format'
import {
  useAdminCohort,
  useAdminCohortStudents,
  useEnrollStudent,
  useRemoveStudent,
  type CohortStatus,
  type CohortStudent,
} from '@/hooks/use-admin-cohorts'
import { useAdminSteps, useReorderCohortSteps, type AdminStep } from '@/hooks/use-admin-steps'
import { PermissionGate } from '@/components/ui/permission-gate'

// ── Status Badge ──────────────────────────────────────────────────────────────

function CohortStatusBadge({ status }: { status: CohortStatus }) {
  const map: Record<CohortStatus, { label: string; variant: 'success' | 'secondary' | 'outline' | 'warning' }> = {
    ACTIVE:    { label: 'Active',    variant: 'success' },
    UPCOMING:  { label: 'Upcoming',  variant: 'secondary' },
    DRAFT:     { label: 'Draft',     variant: 'outline' },
    COMPLETED: { label: 'Completed', variant: 'secondary' },
    ARCHIVED:  { label: 'Archived',  variant: 'warning' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'outline' }
  return <Badge variant={variant}>{label}</Badge>
}

// ── Enroll Dialog ─────────────────────────────────────────────────────────────

interface EnrollDialogProps {
  cohortId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function EnrollStudentDialog({ cohortId, open, onOpenChange }: EnrollDialogProps) {
  const enrollStudent = useEnrollStudent()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ email: string }>()

  async function handleEnroll(values: { email: string }) {
    try {
      await enrollStudent.mutateAsync({ cohortId, payload: { email: values.email } })
      toast.success('Student enrolled successfully')
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to enroll student')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll Student</DialogTitle>
          <DialogDescription>
            Enter the student&apos;s email address to enroll them in this cohort.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleEnroll)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="enroll-email">Email address</Label>
            <Input
              id="enroll-email"
              type="email"
              placeholder="student@example.com"
              aria-invalid={Boolean(errors.email)}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
              })}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false) }}
              disabled={enrollStudent.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={enrollStudent.isPending}>
              {enrollStudent.isPending ? 'Enrolling…' : 'Enroll Student'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Remove Confirm Dialog ─────────────────────────────────────────────────────

interface RemoveDialogProps {
  student: CohortStudent | null
  cohortId: string
  onOpenChange: (open: boolean) => void
}

function RemoveStudentDialog({ student, cohortId, onOpenChange }: RemoveDialogProps) {
  const removeStudent = useRemoveStudent()

  async function handleRemove() {
    if (!student) return
    try {
      await removeStudent.mutateAsync({ cohortId, studentId: student.id })
      toast.success(`${student.firstName} ${student.lastName} removed from cohort`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove student')
    }
  }

  return (
    <Dialog open={Boolean(student)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Student</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove{' '}
            <strong>{student?.firstName} {student?.lastName}</strong> from this cohort?
            Their progress will be preserved but they will lose access.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={removeStudent.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={removeStudent.isPending}
          >
            {removeStudent.isPending ? 'Removing…' : 'Remove Student'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Student Row ───────────────────────────────────────────────────────────────

interface StudentRowProps {
  student: CohortStudent
  onRemove: (student: CohortStudent) => void
}

function StudentRow({ student, onRemove }: StudentRowProps) {
  const initials = getInitials(student.firstName, student.lastName)
  const pct = student.progressPercent ?? 0

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
        <span className="text-sm text-foreground tabular-nums">
          {student.completedSteps}/{student.totalSteps}
        </span>
      </td>
      <td className="py-3 px-3 min-w-[120px]">
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
        </div>
      </td>
      <td className="py-3 px-3">
        <span className="text-sm text-muted-foreground">{formatRelative(student.lastActiveAt)}</span>
      </td>
      <td className="py-3 pl-3 pr-6">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            asChild
            aria-label={`View ${student.firstName}'s profile`}
          >
            <Link href={`/admin/students/${student.id}`}>
              <ChevronRight className="h-3.5 w-3.5" />
              View
            </Link>
          </Button>
          <PermissionGate permission="students:remove">
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              aria-label={`Remove ${student.firstName} from cohort`}
              onClick={() => onRemove(student)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </PermissionGate>
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
      <td className="py-3 px-3"><Skeleton className="h-3.5 w-10" /></td>
      <td className="py-3 px-3"><Skeleton className="h-2 w-24 rounded-full" /></td>
      <td className="py-3 px-3"><Skeleton className="h-3.5 w-16" /></td>
      <td className="py-3 pl-3 pr-6"><Skeleton className="h-7 w-20 ml-auto" /></td>
    </tr>
  )
}

// ── Sortable Step Row ─────────────────────────────────────────────────────────

interface SortableStepRowProps {
  step: AdminStep
  isDraftCohort: boolean
}

function SortableStepRow({ step, isDraftCohort }: SortableStepRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, disabled: !isDraftCohort })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-border last:border-0',
        'hover:bg-muted/30 transition-colors',
        isDragging && 'bg-muted/50'
      )}
    >
      {isDraftCohort ? (
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          aria-label={`Drag to reorder step ${step.order}`}
          type="button"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <div className="h-4 w-4 shrink-0" />
      )}
      <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground tabular-nums shrink-0">
        {step.order}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{step.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{step.description}</p>
      </div>
    </div>
  )
}

function StepListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4 shrink-0" />
          <Skeleton className="h-6 w-6 rounded shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Step Order Card ───────────────────────────────────────────────────────────

interface StepOrderCardProps {
  cohortId: string
  isDraftCohort: boolean
}

function StepOrderCard({ cohortId, isDraftCohort }: StepOrderCardProps) {
  const { data: steps, isLoading: stepsLoading } = useAdminSteps()
  const reorderSteps = useReorderCohortSteps()

  const [orderedSteps, setOrderedSteps] = React.useState<AdminStep[]>([])

  React.useEffect(() => {
    if (steps) {
      setOrderedSteps([...steps].sort((a, b) => a.order - b.order))
    }
  }, [steps])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = orderedSteps.findIndex((s) => s.id === active.id)
    const newIndex = orderedSteps.findIndex((s) => s.id === over.id)
    const prevSteps = orderedSteps
    const nextSteps = arrayMove(orderedSteps, oldIndex, newIndex)

    setOrderedSteps(nextSteps)

    void reorderSteps.mutateAsync({ cohortId, stepIds: nextSteps.map((s) => s.id) }).catch((err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reorder steps')
      setOrderedSteps(prevSteps)
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Step Order</CardTitle>
            <CardDescription className="mt-1">
              {isDraftCohort
                ? 'Drag steps to set the order students will complete them.'
                : 'Step order is locked once the cohort is active.'}
            </CardDescription>
          </div>
          {!isDraftCohort && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 mt-0.5">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Locked
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0 pt-0 pb-0">
        {stepsLoading ? (
          <StepListSkeleton />
        ) : orderedSteps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
              <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">No steps in library</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add steps in the Step Library first.
            </p>
          </div>
        ) : isDraftCohort ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedSteps.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedSteps.map((step) => (
                <SortableStepRow key={step.id} step={step} isDraftCohort={isDraftCohort} />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <div>
            {orderedSteps.map((step) => (
              <SortableStepRow key={step.id} step={step} isDraftCohort={false} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const { cohortId } = useParams<{ cohortId: string }>()
  const router = useRouter()
  const [enrollOpen, setEnrollOpen] = React.useState(false)
  const [removeStudent, setRemoveStudent] = React.useState<CohortStudent | null>(null)

  const { data: cohort, isLoading: cohortLoading } = useAdminCohort(cohortId ?? '')
  const { data: students, isLoading: studentsLoading } = useAdminCohortStudents(cohortId ?? '')

  if (!cohortId) {
    router.replace('/admin/cohorts')
    return null
  }

  return (
    <div data-slot="admin-cohort-detail-page" className="space-y-6">

      {/* Back nav */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-4"
          onClick={() => router.push('/admin/cohorts')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cohorts
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {cohortLoading ? (
              <>
                <Skeleton className="h-6 w-40 mb-1" />
                <Skeleton className="h-4 w-56" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-medium text-foreground">{cohort?.name}</h2>
                  {cohort && <CohortStatusBadge status={cohort.status} />}
                </div>
                <p className="text-sm text-muted-foreground">
                  <code className="bg-muted rounded px-1.5 py-0.5 text-xs font-mono mr-2">
                    {cohort?.code}
                  </code>
                  {formatDate(cohort?.startDate)} – {formatDate(cohort?.endDate)}
                </p>
              </>
            )}
          </div>
          <PermissionGate permission="students:enroll">
            <Button onClick={() => setEnrollOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Enroll Student
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                {cohortLoading ? (
                  <Skeleton className="h-6 w-8 mb-1" />
                ) : (
                  <p className="text-xl font-semibold text-foreground tabular-nums">
                    {cohort?.studentCount ?? 0}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Enrolled students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                {cohortLoading ? (
                  <Skeleton className="h-5 w-24 mb-1" />
                ) : (
                  <p className="text-sm font-medium text-foreground">{formatDate(cohort?.startDate)}</p>
                )}
                <p className="text-xs text-muted-foreground">Start date</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                {cohortLoading ? (
                  <Skeleton className="h-5 w-24 mb-1" />
                ) : (
                  <p className="text-sm font-medium text-foreground">{formatDate(cohort?.endDate)}</p>
                )}
                <p className="text-xs text-muted-foreground">End date</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students roster */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Students Roster</CardTitle>
              <CardDescription className="mt-1">
                {studentsLoading
                  ? 'Loading students…'
                  : `${students?.length ?? 0} enrolled student${(students?.length ?? 0) !== 1 ? 's' : ''}`
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pt-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Cohort students roster">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2.5 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground">Student</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Steps</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Progress</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Last Active</th>
                  <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentsLoading
                  ? Array.from({ length: 5 }).map((_, i) => <StudentRowSkeleton key={i} />)
                  : students?.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                            <GraduationCap className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <p className="text-sm font-medium text-foreground">No students enrolled</p>
                          <p className="text-xs text-muted-foreground">Enroll students to get started.</p>
                          <PermissionGate permission="students:enroll">
                            <Button size="sm" className="mt-2" onClick={() => setEnrollOpen(true)}>
                              <UserPlus className="h-3.5 w-3.5" />
                              Enroll Student
                            </Button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  )
                  : students?.map((student) => (
                    <StudentRow
                      key={student.id}
                      student={student}
                      onRemove={setRemoveStudent}
                    />
                  ))
                }
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Step order */}
      <StepOrderCard cohortId={cohortId} isDraftCohort={cohort?.status === 'DRAFT'} />

      {/* Dialogs */}
      <EnrollStudentDialog
        cohortId={cohortId}
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
      />
      <RemoveStudentDialog
        student={removeStudent}
        cohortId={cohortId}
        onOpenChange={(open) => { if (!open) setRemoveStudent(null) }}
      />

    </div>
  )
}
