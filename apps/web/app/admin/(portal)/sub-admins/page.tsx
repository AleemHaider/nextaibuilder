'use client'
// PBA-239 — Sub-Admin list page
// PBA-240 — Create/Edit Sub-Admin modal with permission checkpoint grid
import * as React from 'react'
import { Plus, UserX, Search, Pencil, UserCheck, UserMinus, Mail, Phone, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/format'
import { useDebounce } from '@/hooks/use-debounce'
import {
  useSubAdmins,
  useCreateSubAdmin,
  useUpdateSubAdmin,
  useDeactivateSubAdmin,
  useReactivateSubAdmin,
  useReinviteSubAdmin,
  type SubAdmin,
  type SubAdminListParams,
} from '@/hooks/use-sub-admins'

// ── Permission definitions ─────────────────────────────────────────────────────

const TOTAL_PERMISSIONS = 20

const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
  {
    label: 'Cohort Management',
    permissions: [
      'cohorts:read',
      'cohorts:write',
      'cohorts:delete',
      'cohorts:manage-status',
      'cohorts:manage-steps',
    ],
  },
  {
    label: 'Student Management',
    permissions: [
      'students:read',
      'students:enroll',
      'students:remove',
      'students:override',
    ],
  },
  {
    label: 'Step Library',
    permissions: ['steps:read', 'steps:write', 'steps:delete'],
  },
  {
    label: 'Submissions & Reviews',
    permissions: ['submissions:read', 'submissions:review'],
  },
  {
    label: 'Messages',
    permissions: ['messages:read', 'messages:send'],
  },
  {
    label: 'Reports & Analytics',
    permissions: ['reports:read', 'reports:export'],
  },
  {
    label: 'Settings',
    permissions: ['settings:read-own-profile', 'settings:manage-sub-admins'],
  },
]

type RolePreset =
  | 'custom'
  | 'content-manager'
  | 'student-support'
  | 'reviewer'
  | 'communications-manager'
  | 'analytics-viewer'
  | 'read-only'

const ROLE_PRESETS: { value: RolePreset; label: string; permissions: string[] }[] = [
  { value: 'custom', label: 'Custom', permissions: [] },
  {
    value: 'content-manager',
    label: 'Content Manager',
    permissions: [
      'cohorts:read',
      'cohorts:write',
      'cohorts:manage-status',
      'cohorts:manage-steps',
      'steps:read',
      'steps:write',
      'steps:delete',
    ],
  },
  {
    value: 'student-support',
    label: 'Student Support',
    permissions: [
      'students:read',
      'students:enroll',
      'students:remove',
      'students:override',
      'submissions:read',
      'submissions:review',
    ],
  },
  {
    value: 'reviewer',
    label: 'Reviewer',
    permissions: ['submissions:read', 'submissions:review'],
  },
  {
    value: 'communications-manager',
    label: 'Communications Manager',
    permissions: ['messages:read', 'messages:send'],
  },
  {
    value: 'analytics-viewer',
    label: 'Analytics Viewer',
    permissions: ['cohorts:read', 'students:read', 'reports:read', 'reports:export'],
  },
  {
    value: 'read-only',
    label: 'Read Only',
    permissions: [
      'cohorts:read',
      'students:read',
      'steps:read',
      'submissions:read',
      'messages:read',
      'reports:read',
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function permissionLabel(permissions: string[]) {
  if (permissions.length === TOTAL_PERMISSIONS) return 'Full Access'
  return `${permissions.length} permission${permissions.length !== 1 ? 's' : ''}`
}

function detectPreset(permissions: string[]): RolePreset {
  for (const preset of ROLE_PRESETS) {
    if (preset.value === 'custom') continue
    if (
      preset.permissions.length === permissions.length &&
      preset.permissions.every((p) => permissions.includes(p))
    ) {
      return preset.value
    }
  }
  return 'custom'
}

// ── Permission Grid ───────────────────────────────────────────────────────────

interface PermissionGridProps {
  selected: string[]
  onChange: (permissions: string[]) => void
}

function PermissionGrid({ selected, onChange }: PermissionGridProps) {
  const allPermissions = PERMISSION_GROUPS.flatMap((g) => g.permissions)
  const allSelected = allPermissions.every((p) => selected.includes(p))

  function toggle(permission: string) {
    if (selected.includes(permission)) {
      onChange(selected.filter((p) => p !== permission))
    } else {
      onChange([...selected, permission])
    }
  }

  function selectAll() {
    onChange(allPermissions)
  }

  function clearAll() {
    onChange([])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {selected.length} of {allPermissions.length} selected
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={selectAll}
            disabled={allSelected}
          >
            Select All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={clearAll}
            disabled={selected.length === 0}
          >
            Clear All
          </Button>
        </div>
      </div>
      <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-medium text-foreground mb-2">{group.label}</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {group.permissions.map((permission) => (
                <label
                  key={permission}
                  className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={selected.includes(permission)}
                    onCheckedChange={() => toggle(permission)}
                    id={`perm-${permission}`}
                  />
                  <span className="text-xs text-foreground font-mono">{permission}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SubAdmin Modal (Create + Edit) ────────────────────────────────────────────

interface SubAdminModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pass a SubAdmin to edit mode; omit for create mode */
  subAdmin?: SubAdmin | null
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function SubAdminModal({ open, onOpenChange, subAdmin }: SubAdminModalProps) {
  const isEdit = Boolean(subAdmin)

  const createSubAdmin = useCreateSubAdmin()
  const updateSubAdmin = useUpdateSubAdmin()

  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<'ADMIN' | 'SUPER_ADMIN'>('ADMIN')
  const [permissions, setPermissions] = React.useState<string[]>([])
  const [preset, setPreset] = React.useState<RolePreset>('custom')
  const [takesStudentCalls, setTakesStudentCalls] = React.useState(false)
  const [schedulingUrl, setSchedulingUrl] = React.useState('')
  const [isAvailableForCalls, setIsAvailableForCalls] = React.useState(true)
  const [errors, setErrors] = React.useState<{
    firstName?: string
    lastName?: string
    email?: string
    schedulingUrl?: string
  }>({})

  // Populate fields when modal opens or subAdmin changes
  React.useEffect(() => {
    if (open) {
      if (subAdmin) {
        setFirstName(subAdmin.firstName)
        setLastName(subAdmin.lastName)
        setEmail(subAdmin.email)
        setRole(subAdmin.role ?? 'ADMIN')
        setPermissions(subAdmin.permissions)
        setPreset(detectPreset(subAdmin.permissions))
        setTakesStudentCalls(subAdmin.takesStudentCalls ?? false)
        setSchedulingUrl(subAdmin.schedulingUrl ?? '')
        setIsAvailableForCalls(subAdmin.isAvailableForCalls ?? true)
      } else {
        setFirstName('')
        setLastName('')
        setEmail('')
        setRole('ADMIN')
        setPermissions([])

        setPreset('custom')
        setTakesStudentCalls(false)
        setSchedulingUrl('')
        setIsAvailableForCalls(true)
      }
      setErrors({})
    }
  }, [open, subAdmin])

  function handlePresetChange(value: string) {
    const selected = value as RolePreset
    setPreset(selected)
    if (selected !== 'custom') {
      const presetDef = ROLE_PRESETS.find((p) => p.value === selected)
      if (presetDef) setPermissions(presetDef.permissions)
    }
  }

  function handlePermissionsChange(newPermissions: string[]) {
    setPermissions(newPermissions)
    setPreset(detectPreset(newPermissions))
  }

  function validate() {
    const errs: typeof errors = {}
    if (!firstName.trim()) errs.firstName = 'First name is required'
    if (!lastName.trim()) errs.lastName = 'Last name is required'
    if (!isEdit) {
      if (!email.trim()) errs.email = 'Email is required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errs.email = 'Enter a valid email address'
      }
    }
    if (takesStudentCalls && schedulingUrl.trim() && !isValidUrl(schedulingUrl.trim())) {
      errs.schedulingUrl = 'Enter a valid URL (e.g. https://calendly.com/...)'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const isPending = createSubAdmin.isPending || updateSubAdmin.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    try {
      if (isEdit && subAdmin) {
        await updateSubAdmin.mutateAsync({
          id: subAdmin.id,
          payload: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            permissions,
            takesStudentCalls,
            schedulingUrl: schedulingUrl.trim() || null,
            isAvailableForCalls,
          },
        })
        toast.success('Sub-admin updated successfully')
      } else {
        await createSubAdmin.mutateAsync({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          role,
          permissions: role === 'SUPER_ADMIN' ? [] : permissions,
          takesStudentCalls,
          schedulingUrl: schedulingUrl.trim() || null,
        })
        toast.success(role === 'SUPER_ADMIN' ? 'Super admin created successfully' : 'Sub-admin created successfully')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Sub-Admin' : 'New Sub-Admin'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this admin account and their access permissions.'
              : 'Create a new admin account with scoped access permissions.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub-admin-first">First name</Label>
              <Input
                id="sub-admin-first"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                aria-invalid={Boolean(errors.firstName)}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-admin-last">Last name</Label>
              <Input
                id="sub-admin-last"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                aria-invalid={Boolean(errors.lastName)}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* Email — only in create mode */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="sub-admin-email">Email</Label>
              <Input
                id="sub-admin-email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>
          )}

          {/* Role selector — only in create mode */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('ADMIN')}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    role === 'ADMIN'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent'
                  )}
                >
                  <span className="text-sm font-medium">Admin</span>
                  <span className="text-xs text-muted-foreground">Scoped access via permissions</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('SUPER_ADMIN')}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    role === 'SUPER_ADMIN'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent'
                  )}
                >
                  <span className="text-sm font-medium">Super Admin</span>
                  <span className="text-xs text-muted-foreground">Full unrestricted access</span>
                </button>
              </div>
            </div>
          )}

          <Separator />

          {/* Support Agent section — PBA-328 */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Support Agent</p>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <Switch
                checked={takesStudentCalls}
                onCheckedChange={(checked) => setTakesStudentCalls(checked)}
              />
              <div>
                <span className="text-sm font-medium text-foreground">Enable Support Agent</span>
                <p className="text-xs text-muted-foreground">Allow students to book 15-min calls</p>
              </div>
            </label>

            {takesStudentCalls && (
              <div className="space-y-1.5 pl-12">
                <Label htmlFor="scheduling-url">Scheduling URL</Label>
                <Input
                  id="scheduling-url"
                  type="url"
                  placeholder="https://calendly.com/your-link"
                  value={schedulingUrl}
                  onChange={(e) => setSchedulingUrl(e.target.value)}
                  aria-invalid={Boolean(errors.schedulingUrl)}
                />
                {errors.schedulingUrl && (
                  <p className="text-xs text-destructive">{errors.schedulingUrl}</p>
                )}
              </div>
            )}

            {isEdit && takesStudentCalls && (
              <label className="flex items-center gap-3 cursor-pointer select-none pl-12">
                <Switch
                  checked={isAvailableForCalls}
                  onCheckedChange={(checked) => setIsAvailableForCalls(checked)}
                />
                <div>
                  <span className="text-sm text-foreground">Available for calls</span>
                  <p className="text-xs text-muted-foreground">Shown on student booking page</p>
                </div>
              </label>
            )}
          </div>

          <Separator />

          {/* Permission section — hidden for SUPER_ADMIN (full access) */}
          {role === 'SUPER_ADMIN' ? (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-sm font-medium text-foreground">Full Access</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Super admins have unrestricted access to all features and settings.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="role-preset">Role Preset</Label>
                <Select value={preset} onValueChange={handlePresetChange}>
                  <SelectTrigger id="role-preset">
                    <SelectValue placeholder="Select a preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Pick a preset or configure permissions individually below.
                </p>
              </div>

              <PermissionGrid selected={permissions} onChange={handlePermissionsChange} />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {isEdit ? 'Saving…' : 'Creating…'}
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : role === 'SUPER_ADMIN' ? (
                'Create Super Admin'
              ) : (
                'Create Sub-Admin'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Deactivate confirmation dialog ────────────────────────────────────────────

interface DeactivateDialogProps {
  subAdmin: SubAdmin | null
  onOpenChange: (open: boolean) => void
}

function DeactivateDialog({ subAdmin, onOpenChange }: DeactivateDialogProps) {
  const deactivate = useDeactivateSubAdmin()

  async function handleConfirm() {
    if (!subAdmin) return
    try {
      await deactivate.mutateAsync(subAdmin.id)
      toast.success(`${subAdmin.firstName} ${subAdmin.lastName} deactivated`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate')
    }
  }

  return (
    <Dialog open={Boolean(subAdmin)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Deactivate Sub-Admin</DialogTitle>
          <DialogDescription>
            {subAdmin
              ? `Are you sure you want to deactivate ${subAdmin.firstName} ${subAdmin.lastName}? They will immediately lose access to the admin panel.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deactivate.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={deactivate.isPending}
          >
            {deactivate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Deactivating…
              </>
            ) : (
              'Deactivate'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Agent role badge (PBA-328) ────────────────────────────────────────────────

function AgentRoleBadge({ subAdmin }: { subAdmin: SubAdmin }) {
  if (!subAdmin.takesStudentCalls) return null
  if (subAdmin.schedulingUrl) {
    return (
      <Badge variant="secondary" className="gap-1 bg-green-50 text-green-700 border-green-200 text-xs">
        <Phone className="h-2.5 w-2.5" aria-hidden="true" />
        Support Agent
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50 text-xs">
      <Phone className="h-2.5 w-2.5" aria-hidden="true" />
      Agent — no link
    </Badge>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
        Active
      </Badge>
    )
  }
  return <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
}

// ── Invite status badge (PBA-267) ─────────────────────────────────────────────

function InviteBadge({ status }: { status: 'PENDING' | 'ACCEPTED' }) {
  if (status === 'ACCEPTED') {
    return (
      <Badge variant="secondary" className="gap-1.5 bg-green-50 text-green-700 border-green-200">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
        Accepted
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-300 bg-amber-50">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
      Pending
    </Badge>
  )
}

// ── Table row skeleton ────────────────────────────────────────────────────────

function SubAdminRowSkeleton() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pl-6 pr-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </td>
      <td className="py-3 px-3"><Skeleton className="h-3.5 w-44" /></td>
      <td className="py-3 px-3"><Skeleton className="h-5 w-24 rounded-md" /></td>
      <td className="py-3 px-3"><Skeleton className="h-5 w-16 rounded-md" /></td>
      <td className="py-3 px-3"><Skeleton className="h-5 w-20 rounded-md" /></td>
      <td className="py-3 pl-3 pr-6"><Skeleton className="h-7 w-28 ml-auto" /></td>
    </tr>
  )
}

// ── Filter type ───────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'inactive'

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editSubAdmin, setEditSubAdmin] = React.useState<SubAdmin | null>(null)
  const [deactivateSubAdmin, setDeactivateSubAdmin] = React.useState<SubAdmin | null>(null)
  const [searchInput, setSearchInput] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [page, setPage] = React.useState(1)

  const LIMIT = 20

  const debouncedSearch = useDebounce(searchInput, 300)

  const queryParams: SubAdminListParams = {
    page,
    limit: LIMIT,
    q: debouncedSearch || undefined,
    isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
  }

  const { data, isLoading } = useSubAdmins(queryParams)
  const reactivate = useReactivateSubAdmin()
  const reinvite = useReinviteSubAdmin()

  const subAdmins = data?.subAdmins ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / LIMIT)

  async function handleReactivate(sa: SubAdmin) {
    try {
      await reactivate.mutateAsync(sa.id)
      toast.success(`${sa.firstName} ${sa.lastName} reactivated`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reactivate')
    }
  }

  async function handleReinvite(sa: SubAdmin) {
    try {
      await reinvite.mutateAsync(sa.id)
      toast.success(`Invitation re-sent to ${sa.email}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to re-send invitation')
    }
  }

  return (
    <div data-slot="admin-sub-admins-page" className="space-y-6">

      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-foreground">Sub-Admins</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage admin accounts and their access permissions.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Sub-Admin
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search sub-admins"
          />
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {(['all', 'active', 'inactive'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setStatusFilter(f); setPage(1) }}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize',
                statusFilter === f
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Accounts</CardTitle>
          <CardDescription>
            {total > 0 ? `${total} admin account${total !== 1 ? 's' : ''} found` : 'No accounts found'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Sub-admins table">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2.5 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Email</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Permissions</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Role</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Invite</th>
                  <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <SubAdminRowSkeleton key={i} />)
                ) : subAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                          <UserX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No sub-admins yet</p>
                        <p className="text-xs text-muted-foreground">
                          {debouncedSearch
                            ? 'No results match your search. Try a different term.'
                            : 'Create your first sub-admin to get started.'}
                        </p>
                        {!debouncedSearch && (
                          <Button
                            size="sm"
                            className="mt-2"
                            onClick={() => setCreateOpen(true)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Create your first sub-admin
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  subAdmins.map((sa) => (
                    <tr
                      key={sa.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      {/* Name */}
                      <td className="py-3 pl-6 pr-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={sa.avatarUrl ?? undefined} alt={`${sa.firstName} ${sa.lastName}`} />
                            <AvatarFallback className="text-xs font-medium">
                              {getInitials(sa.firstName, sa.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-foreground">
                            {sa.firstName} {sa.lastName}
                          </span>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="py-3 px-3">
                        <span className="text-sm text-muted-foreground">{sa.email}</span>
                      </td>
                      {/* Permissions */}
                      <td className="py-3 px-3">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {sa.role === 'SUPER_ADMIN' ? 'Full Access' : permissionLabel(sa.permissions)}
                        </Badge>
                      </td>
                      {/* Role — super admin badge or agent badge */}
                      <td className="py-3 px-3">
                        {sa.role === 'SUPER_ADMIN' ? (
                          <Badge className="text-xs bg-[#1a2744] text-white border-0">Super Admin</Badge>
                        ) : (
                          <AgentRoleBadge subAdmin={sa} />
                        )}
                      </td>
                      {/* Status */}
                      <td className="py-3 px-3">
                        <StatusBadge isActive={sa.isActive} />
                      </td>
                      {/* Invite status */}
                      <td className="py-3 px-3">
                        <InviteBadge status={sa.inviteStatus ?? 'PENDING'} />
                      </td>
                      {/* Actions */}
                      <td className="py-3 pl-3 pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit ${sa.firstName} ${sa.lastName}`}
                            onClick={() => setEditSubAdmin(sa)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {sa.inviteStatus === 'PENDING' && sa.isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Re-invite ${sa.firstName} ${sa.lastName}`}
                              onClick={() => handleReinvite(sa)}
                              disabled={reinvite.isPending}
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Re-invite
                            </Button>
                          )}
                          {sa.role !== 'SUPER_ADMIN' && (sa.isActive ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              aria-label={`Deactivate ${sa.firstName} ${sa.lastName}`}
                              onClick={() => setDeactivateSubAdmin(sa)}
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Reactivate ${sa.firstName} ${sa.lastName}`}
                              onClick={() => handleReactivate(sa)}
                              disabled={reactivate.isPending}
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              Reactivate
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} &middot; {total} total
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SubAdminModal
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <SubAdminModal
        open={Boolean(editSubAdmin)}
        onOpenChange={(open) => { if (!open) setEditSubAdmin(null) }}
        subAdmin={editSubAdmin}
      />
      <DeactivateDialog
        subAdmin={deactivateSubAdmin}
        onOpenChange={(open) => { if (!open) setDeactivateSubAdmin(null) }}
      />
    </div>
  )
}
