'use client'
// PBA-131 — Admin Cohorts page (Sprint 4 — live data)
// PBA-237 — PermissionGate applied to write actions
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, GraduationCap, Eye, Pencil, CalendarDays, Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAdminCohorts,
  useCreateCohort,
  useUpdateCohort,
  type Cohort,
  type CohortStatus,
  type CreateCohortPayload,
  type UpdateCohortPayload,
} from '@/hooks/use-admin-cohorts'
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

// ── Cohort Form ───────────────────────────────────────────────────────────────

interface CohortFormValues {
  name: string
  code: string
  startDate: string
  endDate: string
  status?: CohortStatus
}

interface CohortFormProps {
  defaultValues?: Partial<CohortFormValues>
  showStatus?: boolean
  onSubmit: (values: CohortFormValues) => Promise<void>
  onCancel: () => void
  submitLabel: string
  isSubmitting: boolean
}

function CohortForm({
  defaultValues,
  showStatus,
  onSubmit,
  onCancel,
  submitLabel,
  isSubmitting,
}: CohortFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CohortFormValues>({ defaultValues })

  const statusValue = watch('status')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cohort-name">Name</Label>
        <Input
          id="cohort-name"
          placeholder="e.g. Spring 2026"
          aria-invalid={Boolean(errors.name)}
          {...register('name', { required: 'Name is required' })}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cohort-code">Code</Label>
        <Input
          id="cohort-code"
          placeholder="e.g. SP2026"
          aria-invalid={Boolean(errors.code)}
          {...register('code', { required: 'Code is required' })}
        />
        {errors.code && (
          <p className="text-xs text-destructive">{errors.code.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cohort-start">Start Date</Label>
          <Input
            id="cohort-start"
            type="date"
            aria-invalid={Boolean(errors.startDate)}
            {...register('startDate', { required: 'Start date is required' })}
          />
          {errors.startDate && (
            <p className="text-xs text-destructive">{errors.startDate.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cohort-end">End Date</Label>
          <Input
            id="cohort-end"
            type="date"
            aria-invalid={Boolean(errors.endDate)}
            {...register('endDate', { required: 'End date is required' })}
          />
          {errors.endDate && (
            <p className="text-xs text-destructive">{errors.endDate.message}</p>
          )}
        </div>
      </div>

      {showStatus && (
        <div className="space-y-1.5">
          <Label htmlFor="cohort-status">Status</Label>
          <Select
            value={statusValue ?? 'DRAFT'}
            onValueChange={(v) => setValue('status', v as CohortStatus)}
          >
            <SelectTrigger id="cohort-status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="UPCOMING">Upcoming</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ── Create Dialog ─────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CreateCohortDialog({ open, onOpenChange }: CreateDialogProps) {
  const createCohort = useCreateCohort()

  async function handleSubmit(values: CohortFormValues) {
    try {
      const payload: CreateCohortPayload = {
        name: values.name,
        code: values.code,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
      }
      await createCohort.mutateAsync(payload)
      toast.success('Cohort created successfully')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create cohort')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Cohort</DialogTitle>
          <DialogDescription>
            Create a new program cohort. Students can be enrolled after creation.
          </DialogDescription>
        </DialogHeader>
        <CohortForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          submitLabel="Create Cohort"
          isSubmitting={createCohort.isPending}
        />
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Dialog ───────────────────────────────────────────────────────────────

interface EditDialogProps {
  cohort: Cohort | null
  onOpenChange: (open: boolean) => void
}

function EditCohortDialog({ cohort, onOpenChange }: EditDialogProps) {
  const updateCohort = useUpdateCohort()

  async function handleSubmit(values: CohortFormValues) {
    if (!cohort) return
    try {
      const payload: UpdateCohortPayload = {
        name: values.name,
        code: values.code,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
        endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
        status: values.status,
      }
      await updateCohort.mutateAsync({ id: cohort.id, payload })
      toast.success('Cohort updated successfully')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update cohort')
    }
  }

  return (
    <Dialog open={Boolean(cohort)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Cohort</DialogTitle>
          <DialogDescription>
            Update cohort details and status.
          </DialogDescription>
        </DialogHeader>
        {cohort && (
          <CohortForm
            defaultValues={{
              name: cohort.name,
              code: cohort.code,
              startDate: cohort.startDate ? cohort.startDate.slice(0, 10) : '',
              endDate: cohort.endDate ? cohort.endDate.slice(0, 10) : '',
              status: cohort.status,
            }}
            showStatus
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            submitLabel="Save Changes"
            isSubmitting={updateCohort.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Table row skeleton ────────────────────────────────────────────────────────

function CohortRowSkeleton() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pl-6 pr-3"><Skeleton className="h-3.5 w-32" /></td>
      <td className="py-3 px-3"><Skeleton className="h-3.5 w-16" /></td>
      <td className="py-3 px-3"><Skeleton className="h-5 w-16 rounded-md" /></td>
      <td className="py-3 px-3"><Skeleton className="h-3.5 w-10" /></td>
      <td className="py-3 px-3"><Skeleton className="h-3.5 w-24" /></td>
      <td className="py-3 px-3"><Skeleton className="h-3.5 w-24" /></td>
      <td className="py-3 pl-3 pr-6"><Skeleton className="h-7 w-28 ml-auto" /></td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter()
  const { data: cohorts, isLoading } = useAdminCohorts()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editCohort, setEditCohort] = React.useState<Cohort | null>(null)
  const [search, setSearch] = React.useState('')

  const activeCohorts = cohorts?.filter((c) => c.status === 'ACTIVE').length ?? 0
  const upcomingCohorts = cohorts?.filter(
    (c) => c.status === 'DRAFT' || c.status === 'UPCOMING' || new Date(c.startDate) > new Date()
  ).length ?? 0

  // Client-side search filter (backend does not support a `q` param)
  const filteredCohorts = React.useMemo(() => {
    if (!cohorts) return []
    const q = search.trim().toLowerCase()
    if (!q) return cohorts
    return cohorts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    )
  }, [cohorts, search])

  return (
    <div data-slot="admin-cohorts-page" className="space-y-6">

      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-foreground">Cohorts</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage program cohorts, enrollment windows, and student assignments.
          </p>
        </div>
        <PermissionGate permission="cohorts:write">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Cohort
          </Button>
        </PermissionGate>
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          placeholder="Search cohorts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search cohorts"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-7 w-8 mb-1" />
                ) : (
                  <p className="text-2xl font-semibold text-foreground tabular-nums">{activeCohorts}</p>
                )}
                <p className="text-xs text-muted-foreground">Active cohorts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-7 w-8 mb-1" />
                ) : (
                  <p className="text-2xl font-semibold text-foreground tabular-nums">{upcomingCohorts}</p>
                )}
                <p className="text-xs text-muted-foreground">Upcoming / draft</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cohorts table */}
      <Card>
        <CardHeader>
          <CardTitle>Cohort Management</CardTitle>
          <CardDescription>
            View all cohorts. Click a row or "View" to see enrolled students.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Cohorts table">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2.5 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Code</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Students</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Start Date</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">End Date</th>
                  <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => <CohortRowSkeleton key={i} />)
                  : filteredCohorts.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                            <GraduationCap className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                          </div>
                          {search.trim() ? (
                            <>
                              <p className="text-sm font-medium text-foreground">No cohorts match your search</p>
                              <p className="text-xs text-muted-foreground">Try a different name or code.</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-medium text-foreground">No cohorts yet</p>
                              <p className="text-xs text-muted-foreground">Create your first cohort to get started.</p>
                              <PermissionGate permission="cohorts:write">
                                <Button
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => setCreateOpen(true)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  New Cohort
                                </Button>
                              </PermissionGate>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                  : filteredCohorts.map((cohort) => (
                    <tr
                      key={cohort.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/cohorts/${cohort.id}/roster`)}
                    >
                      <td className="py-3 pl-6 pr-3">
                        <span className="text-sm font-medium text-foreground">{cohort.name}</span>
                      </td>
                      <td className="py-3 px-3">
                        <code className="text-xs bg-muted rounded px-1.5 py-0.5 text-foreground font-mono">
                          {cohort.code}
                        </code>
                      </td>
                      <td className="py-3 px-3">
                        <CohortStatusBadge status={cohort.status} />
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-sm text-foreground tabular-nums">{cohort.studentCount}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-sm text-muted-foreground">{formatDate(cohort.startDate)}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-sm text-muted-foreground">{formatDate(cohort.endDate)}</span>
                      </td>
                      <td className="py-3 pl-3 pr-6">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`View ${cohort.name}`}
                            onClick={() => router.push(`/admin/cohorts/${cohort.id}/roster`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                          <PermissionGate permission="cohorts:write">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Edit ${cohort.name}`}
                              onClick={() => setEditCohort(cohort)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateCohortDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditCohortDialog
        cohort={editCohort}
        onOpenChange={(open) => { if (!open) setEditCohort(null) }}
      />

    </div>
  )
}
