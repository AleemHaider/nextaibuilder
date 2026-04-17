// PBA — Admin Step Library page
// PBA-237 — PermissionGate applied to write/delete actions
// PBA-275 — isActive badge in step list table
// Updated: Edit/Create now navigate to the full-page step editor
import * as React from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Plus, Pencil, Trash2, Video, Camera, PlusCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  useAdminSteps,
  useDeleteStep,
  type AdminStep,
} from '@/hooks/use-admin-steps'
import { PermissionGate } from '@/app/components/ui/permission-gate'

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden="true" />
}

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────

interface DeleteDialogProps {
  step: AdminStep | null
  onOpenChange: (open: boolean) => void
}

function DeleteStepDialog({ step, onOpenChange }: DeleteDialogProps) {
  const deleteStep = useDeleteStep()

  async function handleDelete() {
    if (!step) return
    try {
      await deleteStep.mutateAsync(step.id)
      toast.success('Step deleted')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete step')
    }
  }

  return (
    <Dialog open={Boolean(step)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Step</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{step?.title}</strong>? This action cannot be
            undone and will remove it from all cohorts.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteStep.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteStep.isPending}
          >
            {deleteStep.isPending ? 'Deleting…' : 'Delete Step'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Table row skeleton ────────────────────────────────────────────────────────

function StepRowSkeleton() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pl-6 pr-3"><Skeleton className="h-5 w-6 rounded" /></td>
      <td className="py-3 px-3"><Skeleton className="h-3.5 w-48" /></td>
      <td className="py-3 px-3"><Skeleton className="h-3 w-56" /></td>
      <td className="py-3 px-3"><Skeleton className="h-5 w-5 rounded-full" /></td>
      <td className="py-3 px-3"><Skeleton className="h-5 w-5 rounded-full" /></td>
      <td className="py-3 pl-3 pr-6"><Skeleton className="h-7 w-20 ml-auto" /></td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function AdminStepsPage() {
  const navigate = useNavigate()
  const { data: steps, isLoading } = useAdminSteps()
  const [deleteStep, setDeleteStep] = React.useState<AdminStep | null>(null)

  const sorted = React.useMemo(
    () => steps ? [...steps].sort((a, b) => a.order - b.order) : [],
    [steps]
  )

  return (
    <div data-slot="admin-steps-page" className="space-y-6">

      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-foreground">Step Library</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage the program steps that students complete. Steps can be reordered per cohort.
          </p>
        </div>
        <PermissionGate permission="steps:write">
          <Button onClick={() => void navigate('/admin/steps/new')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Step
          </Button>
        </PermissionGate>
      </div>

      {/* Steps table */}
      <Card>
        <CardHeader>
          <CardTitle>All Steps</CardTitle>
          <CardDescription>
            {isLoading
              ? 'Loading steps…'
              : `${sorted.length} step${sorted.length !== 1 ? 's' : ''} in the library`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Step library table">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2.5 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground w-12">#</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Title</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Description</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground w-20">Status</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground w-10" title="Screenshot criteria">
                    <Camera className="h-3.5 w-3.5" aria-label="Screenshot criteria" />
                  </th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground w-10" title="Video URL">
                    <Video className="h-3.5 w-3.5" aria-label="Video" />
                  </th>
                  <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => <StepRowSkeleton key={i} />)
                  : sorted.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <p className="text-sm font-medium text-foreground">No steps yet</p>
                          <p className="text-xs text-muted-foreground">Add the first step to get started.</p>
                          <PermissionGate permission="steps:write">
                            <Button
                              size="sm"
                              className="mt-2"
                              onClick={() => void navigate('/admin/steps/new')}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add Step
                            </Button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  )
                  : sorted.flatMap((step, index) => {
                    const stepRow = (
                      <tr
                        key={step.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 pl-6 pr-3">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground tabular-nums">
                            {step.order}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm font-medium text-foreground">{step.title}</span>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <span className="text-sm text-muted-foreground line-clamp-2">
                            {step.description}
                          </span>
                        </td>
                        {/* PBA-275 — isActive badge */}
                        <td className="py-3 px-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                              step.isActive
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {step.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {step.screenshotCriteria ? (
                            <Camera className="h-3.5 w-3.5 text-foreground" aria-label="Has screenshot criteria" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {step.videoUrl ? (
                            <Video className="h-3.5 w-3.5 text-foreground" aria-label="Has video" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 pl-3 pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            <PermissionGate permission="steps:write">
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Edit ${step.title}`}
                                onClick={() => void navigate(`/admin/steps/${step.id}/edit`)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                            </PermissionGate>
                            <PermissionGate permission="steps:delete">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                aria-label={`Delete ${step.title}`}
                                onClick={() => setDeleteStep(step)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    )

                    const nextStep = sorted[index + 1]
                    const insertRow = nextStep ? (
                      <tr
                        key={`insert-${step.id}`}
                        className="group border-b border-dashed border-border/50 h-6"
                        aria-hidden="true"
                      >
                        <td colSpan={7} className="py-0">
                          <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <PermissionGate permission="steps:write">
                              <button
                                type="button"
                                aria-label={`Insert step at position ${nextStep.order}`}
                                onClick={() => void navigate(`/admin/steps/new?insertAt=${nextStep.order}`)}
                                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              >
                                <PlusCircle className="h-3 w-3" />
                                Insert here
                              </button>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    ) : null

                    return insertRow ? [stepRow, insertRow] : [stepRow]
                  })
                }
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <DeleteStepDialog
        step={deleteStep}
        onOpenChange={(open) => { if (!open) setDeleteStep(null) }}
      />

    </div>
  )
}

export { AdminStepsPage }
