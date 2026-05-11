// FIR-173 — Admin sub-admin management: invite, view permissions, edit, deactivate
import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  ChevronDown,
  ChevronUp,
  Check,
  BookOpen,
  Users,
  CreditCard,
  GraduationCap,
  Camera,
  MessageSquare,
  BarChart2,
  Settings,
  AlertTriangle,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  fetchSubAdmins,
  inviteSubAdmin,
  updateSubAdminPermissions,
  deactivateSubAdmin,
  type SubAdmin,
  type SubAdminPermission,
} from '../../lib/api'
import { STALE_TIME } from '../../lib/queryConfig'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Permission definitions
// ---------------------------------------------------------------------------

interface PermissionDef {
  key: SubAdminPermission
  label: string
}

interface PermissionGroup {
  label: string
  icon: LucideIcon
  permissions: PermissionDef[]
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Courses',
    icon: BookOpen,
    permissions: [
      { key: 'courses:read', label: 'View courses' },
      { key: 'courses:write', label: 'Create & edit courses' },
    ],
  },
  {
    label: 'Enrollments',
    icon: Users,
    permissions: [
      { key: 'enrollments:read', label: 'View enrollments' },
      { key: 'enrollments:write', label: 'Manage enrollments' },
    ],
  },
  {
    label: 'Payments',
    icon: CreditCard,
    permissions: [
      { key: 'payments:read', label: 'View payments' },
      { key: 'payments:write', label: 'Process payments' },
    ],
  },
  {
    label: 'Students',
    icon: GraduationCap,
    permissions: [
      { key: 'students:read', label: 'View students' },
      { key: 'students:write', label: 'Manage students' },
    ],
  },
  {
    label: 'Submissions',
    icon: Camera,
    permissions: [
      { key: 'submissions:read', label: 'View submissions' },
      { key: 'submissions:write', label: 'Review submissions' },
    ],
  },
  {
    label: 'Messages',
    icon: MessageSquare,
    permissions: [
      { key: 'messages:read', label: 'View messages' },
      { key: 'messages:write', label: 'Send messages' },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart2,
    permissions: [{ key: 'reports:read', label: 'View reports & revenue' }],
  },
  {
    label: 'Settings',
    icon: Settings,
    permissions: [
      { key: 'settings:read', label: 'View settings' },
      { key: 'settings:write', label: 'Change settings' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Permission presets
// ---------------------------------------------------------------------------

const ALL_PERMISSIONS: SubAdminPermission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
)

const PRESETS: Record<string, SubAdminPermission[]> = {
  'Full Access': ALL_PERMISSIONS,
  'Read Only': ALL_PERMISSIONS.filter((p) => p.endsWith(':read')),
  'Course Manager': [
    'courses:read',
    'courses:write',
    'enrollments:read',
    'students:read',
    'submissions:read',
    'submissions:write',
  ],
  'Enrollment Manager': [
    'enrollments:read',
    'enrollments:write',
    'students:read',
    'students:write',
    'payments:read',
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-text))',
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-primary))',
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-success))',
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-primary-text))',
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-primary-text))',
]

function getAvatarGradient(name: string): string {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length]
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 2) return 'Just now'
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface ToastMessage {
  id: string
  message: string
  variant: 'success' | 'error'
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 rounded-[14px] shadow-[var(--color-wise-ring-strong)_0_4px_20px]',
        'text-[14px] font-semibold',
        toast.variant === 'success'
          ? 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)] border border-[rgba(5,77,40,0.15)]'
          : 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] border border-[rgba(208,50,56,0.15)]',
      )}
    >
      <span aria-hidden="true" className="inline-flex items-center">
        {toast.variant === 'success' ? <Check size={16} /> : <X size={16} />}
      </span>
      {toast.message}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const addToast = useCallback((message: string, variant: 'success' | 'error') => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, variant }])
  }, [])
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])
  return { toasts, addToast, dismissToast }
}

// ---------------------------------------------------------------------------
// PermissionSelector — shared between invite form and edit inline
// ---------------------------------------------------------------------------

interface PermissionSelectorProps {
  selected: SubAdminPermission[]
  onChange: (next: SubAdminPermission[]) => void
}

function PermissionSelector({ selected, onChange }: PermissionSelectorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Courses']))
  const selectedSet = new Set(selected)

  function togglePermission(key: SubAdminPermission) {
    const next = new Set(selectedSet)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    onChange(Array.from(next) as SubAdminPermission[])
  }

  function toggleGroup(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function applyPreset(presetName: string) {
    onChange(PRESETS[presetName] ?? [])
  }

  return (
    <div>
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(PRESETS).map((preset) => {
          const isActive =
            JSON.stringify([...PRESETS[preset]].sort()) ===
            JSON.stringify([...selected].sort())
          return (
            <button
              key={preset}
              type="button"
              onClick={() => applyPreset(preset)}
              className={cn(
                'px-4 py-2 rounded-full border-[1.5px] text-[13px] font-[600] transition-colors',
                isActive
                  ? 'border-[var(--color-wise-primary-text)] bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]'
                  : 'border-[var(--color-wise-ring-strong)] text-[var(--color-wise-text-muted)] hover:border-[var(--color-wise-primary-text)] hover:text-[var(--color-wise-primary-text)]',
              )}
            >
              {preset}
            </button>
          )
        })}
      </div>

      {/* Permission groups */}
      <div className="flex flex-col gap-2.5">
        {PERMISSION_GROUPS.map((group) => {
          const isExpanded = expandedGroups.has(group.label)
          return (
            <div
              key={group.label}
              className="border border-[var(--color-wise-ring)] rounded-[14px] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                aria-expanded={isExpanded}
                className="flex items-center justify-between w-full px-4 py-3 bg-[var(--color-wise-canvas)] hover:bg-[var(--color-wise-surface-soft)] transition-colors text-left"
              >
                <span className="flex items-center gap-2 text-[14px] font-[700] text-[var(--color-wise-text)]">
                  <group.icon size={14} aria-hidden="true" className="text-[var(--color-wise-primary-text)]" />
                  {group.label}
                </span>
                {isExpanded ? (
                  <ChevronUp size={14} className="text-[var(--color-wise-text-muted)]" />
                ) : (
                  <ChevronDown size={14} className="text-[var(--color-wise-text-muted)]" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-1">
                  {group.permissions.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2.5 py-2.5 border-b border-[var(--color-wise-ring)] last:border-b-0 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSet.has(perm.key)}
                        onChange={() => togglePermission(perm.key)}
                        className="w-[18px] h-[18px] rounded-[5px] accent-[var(--color-wise-primary-text)]"
                      />
                      <span className="text-[13px] font-[500] text-[var(--color-wise-text-muted)]">{perm.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Invite slide-in panel
// ---------------------------------------------------------------------------

interface InvitePanelProps {
  onClose: () => void
  onSuccess: () => void
}

function InvitePanel({ onClose, onSuccess }: InvitePanelProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [permissions, setPermissions] = useState<SubAdminPermission[]>(PRESETS['Course Manager'])

  const { toasts, addToast, dismissToast } = useToast()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const inviteMutation = useMutation({
    mutationFn: () => inviteSubAdmin({ email, name, permissions }),
    onSuccess: () => {
      onSuccess()
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Failed to send invite', 'error')
    },
  })

  const isValid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Invite team member"
    >
      <div
        className="fixed inset-0 bg-[rgba(14,15,12,0.4)]"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside className="relative z-50 w-full max-w-[560px] h-full bg-white shadow-[-8px_0_40px_var(--color-wise-ring-strong)] overflow-y-auto">
        {/* Toast inside drawer */}
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none w-[420px]">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <Toast toast={t} onDismiss={dismissToast} />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-7 py-6 border-b border-[var(--color-wise-ring)]">
          <div>
            <h2 className="text-[20px] font-[800] text-[var(--color-wise-text)]">Invite Team Member</h2>
            <p className="text-[14px] text-[var(--color-wise-text-muted)] mt-0.5">
              They'll receive an email to set up their account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="w-9 h-9 rounded-full bg-[var(--color-wise-surface-soft)] flex items-center justify-center hover:bg-[var(--color-wise-surface-soft)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form
          className="px-7 py-6"
          onSubmit={(e) => {
            e.preventDefault()
            inviteMutation.mutate()
          }}
        >
          {/* Name */}
          <div className="mb-5">
            <label htmlFor="invite-name" className="block text-[13px] font-[600] text-[var(--color-wise-text)] mb-1.5">
              Full name
            </label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              className={cn(
                'w-full h-12 rounded-[12px] border-[1.5px] border-[var(--color-wise-ring-strong)] bg-[var(--color-wise-canvas)]',
                'px-4 text-[15px] text-[var(--color-wise-text)] font-[inherit] outline-none transition-colors',
                'focus:border-[var(--color-wise-primary-text)] focus:bg-white',
              )}
            />
          </div>

          {/* Email */}
          <div className="mb-6">
            <label htmlFor="invite-email" className="block text-[13px] font-[600] text-[var(--color-wise-text)] mb-1.5">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="team@nextaibuilder.com"
              required
              className={cn(
                'w-full h-12 rounded-[12px] border-[1.5px] border-[var(--color-wise-ring-strong)] bg-[var(--color-wise-canvas)]',
                'px-4 text-[15px] text-[var(--color-wise-text)] font-[inherit] outline-none transition-colors',
                'focus:border-[var(--color-wise-primary-text)] focus:bg-white',
              )}
            />
          </div>

          {/* Permissions */}
          <div className="mb-6">
            <label className="block text-[13px] font-[600] text-[var(--color-wise-text)] mb-3">
              Permissions
            </label>
            <PermissionSelector selected={permissions} onChange={setPermissions} />
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-2 border-t border-[var(--color-wise-ring)]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-full bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)] text-[14px] font-[700] hover:bg-[var(--color-wise-surface-soft)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || inviteMutation.isPending}
              className={cn(
                'px-5 py-3 rounded-full bg-[var(--color-wise-primary-text)] text-[var(--color-wise-dark)] text-[14px] font-[700] transition-colors',
                'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {inviteMutation.isPending ? 'Sending…' : 'Send Invite →'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Deactivate confirm modal
// ---------------------------------------------------------------------------

function DeactivateModal({
  member,
  onConfirm,
  onClose,
  isPending,
}: {
  member: SubAdmin
  onConfirm: () => void
  onClose: () => void
  isPending: boolean
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(14,15,12,0.45)] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-[20px] p-8 w-full max-w-[440px] shadow-[var(--color-wise-ring-strong)_0_20px_60px]">
        <h2 className="text-[20px] font-[800] text-[var(--color-wise-text)] mb-2">Deactivate Member</h2>
        <p className="text-[14px] text-[var(--color-wise-text-muted)] mb-6">
          Are you sure you want to deactivate{' '}
          <span className="font-semibold text-[var(--color-wise-text)]">{member.name}</span>? They will lose
          all admin access immediately.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-5 py-2.5 rounded-full bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)] text-[14px] font-[700] hover:bg-[var(--color-wise-surface-soft)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-5 py-2.5 rounded-full bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] text-[14px] font-[700] hover:bg-[var(--color-wise-danger-soft)] transition-colors disabled:opacity-50"
          >
            {isPending ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SubAdminRow — table row with inline permission editor
// ---------------------------------------------------------------------------

interface SubAdminRowProps {
  member: SubAdmin
  onDeactivate: (m: SubAdmin) => void
  onPermissionsUpdated: (id: string, permissions: SubAdminPermission[]) => void
  isOwner?: boolean
}

function SubAdminRow({ member, onDeactivate, onPermissionsUpdated, isOwner }: SubAdminRowProps) {
  const [editExpanded, setEditExpanded] = useState(false)
  const [editPermissions, setEditPermissions] = useState<SubAdminPermission[]>(
    member.permissions,
  )

  const updateMutation = useMutation({
    mutationFn: () => updateSubAdminPermissions(member.id, editPermissions),
    onSuccess: () => {
      onPermissionsUpdated(member.id, editPermissions)
      setEditExpanded(false)
    },
  })

  const statusStyles: Record<SubAdmin['status'], string> = {
    ACTIVE: 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
    INVITED: 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)]',
    INACTIVE: 'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]',
  }

  // Derive a label to summarise permissions briefly
  const permLabel =
    member.permissions.length === ALL_PERMISSIONS.length
      ? 'All Access'
      : member.permissions.length === 0
        ? 'No Access'
        : `${member.permissions.length} permissions`

  return (
    <>
      <tr className="hover:[&>td]:bg-[var(--color-wise-surface-soft)] transition-colors">
        <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)]">
          <div className="flex items-center gap-2.5">
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[14px] font-[700]"
                style={{ background: getAvatarGradient(member.name) }}
                aria-hidden="true"
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-[700] text-[var(--color-wise-text)]">{member.name}</span>
                {isOwner && (
                  <span className="text-[11px] font-[600] bg-[var(--color-wise-text)] text-white px-[9px] py-[3px] rounded-full">
                    Owner
                  </span>
                )}
              </div>
              <div className="text-[12px] text-[var(--color-wise-text-muted)]">{member.email}</div>
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)]">
          <span className="text-[11px] font-[600] bg-[var(--color-wise-mint)] text-[var(--color-wise-text)] px-[9px] py-[3px] rounded-full">
            {permLabel}
          </span>
        </td>
        <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)]">
          <span className={cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', statusStyles[member.status])}>
            {member.status === 'INVITED' ? 'Invited' : member.status === 'ACTIVE' ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)] text-[12px] text-[var(--color-wise-text-muted)]">
          {formatRelativeTime(member.lastActiveAt)}
        </td>
        <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)]">
          {isOwner ? (
            <div className="flex gap-3">
              <span className="text-[13px] text-[var(--color-wise-text-muted)] cursor-not-allowed">Edit</span>
              <span className="text-[13px] text-[var(--color-wise-text-muted)] cursor-not-allowed">Deactivate</span>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditPermissions(member.permissions)
                  setEditExpanded((v) => !v)
                }}
                className="text-[13px] font-[600] text-[var(--color-wise-primary-text)] hover:underline"
              >
                {editExpanded ? 'Cancel' : 'Edit'}
              </button>
              {member.status === 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() => onDeactivate(member)}
                  className="text-[13px] font-[600] text-[var(--color-wise-danger)] hover:underline"
                >
                  Deactivate
                </button>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* Inline permission editor */}
      {editExpanded && (
        <tr>
          <td colSpan={5} className="border-b border-[var(--color-wise-ring)] bg-[var(--color-wise-surface-soft)]">
            <div className="px-5 py-5">
              <PermissionSelector
                selected={editPermissions}
                onChange={setEditPermissions}
              />
              <div className="flex gap-3 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setEditExpanded(false)}
                  className="px-4 py-2 rounded-full bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)] text-[13px] font-[700] hover:bg-[var(--color-wise-surface-soft)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 rounded-full bg-[var(--color-wise-primary-text)] text-[var(--color-wise-dark)] text-[13px] font-[700] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// SubAdminPage
// ---------------------------------------------------------------------------

export default function SubAdminPage() {
  const [showInvite, setShowInvite] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<SubAdmin | null>(null)

  const { toasts, addToast, dismissToast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sub-admins'],
    queryFn: fetchSubAdmins,
    staleTime: STALE_TIME.long,
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateSubAdmin(id),
    onSuccess: () => {
      setDeactivateTarget(null)
      queryClient.invalidateQueries({ queryKey: ['sub-admins'] })
      addToast('Member deactivated', 'success')
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Failed to deactivate', 'error')
    },
  })

  function handleInviteSuccess() {
    setShowInvite(false)
    queryClient.invalidateQueries({ queryKey: ['sub-admins'] })
    addToast('Invitation sent!', 'success')
  }

  function handlePermissionsUpdated(id: string, permissions: SubAdminPermission[]) {
    queryClient.setQueryData(['sub-admins'], (old: typeof data) => {
      if (!old) return old
      return {
        ...old,
        subAdmins: old.subAdmins.map((m) => (m.id === id ? { ...m, permissions } : m)),
      }
    })
    addToast('Permissions updated', 'success')
  }

  const members = data?.subAdmins ?? []

  return (
    <AdminShell
      title="Team"
      actions={
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className={cn(
            'px-5 py-2.5 rounded-full bg-[var(--color-wise-primary-text)] text-[var(--color-wise-dark)]',
            'text-[14px] font-[700] hover:opacity-90 transition-opacity',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wise-primary-text)]',
          )}
        >
          + Invite Member
        </button>
      }
    >
      {/* Toast stack */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={dismissToast} />
          </div>
        ))}
      </div>

      {/* Invite panel */}
      {showInvite && (
        <InvitePanel onClose={() => setShowInvite(false)} onSuccess={handleInviteSuccess} />
      )}

      {/* Deactivate modal */}
      {deactivateTarget && (
        <DeactivateModal
          member={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={() => deactivateMutation.mutate(deactivateTarget.id)}
          isPending={deactivateMutation.isPending}
        />
      )}

      <div className="px-8 py-6">
        {isLoading && (
          <div
            className="bg-white rounded-[16px] shadow-[var(--color-wise-ring)_0_0_0_1px] overflow-hidden"
            aria-busy="true"
            aria-label="Loading team members"
          >
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="flex items-center gap-4 px-5 py-4 border-b border-[var(--color-wise-ring)] last:border-b-0"
                aria-hidden="true"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--color-wise-surface-soft)] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-1/4" />
                  <div className="h-3 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-1/5" />
                </div>
                <div className="h-3 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-20" />
                <div className="h-3 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-16" />
              </div>
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load team"
            description="There was a problem loading the team members. Please try again."
          />
        )}

        {!isLoading && !isError && members.length === 0 && (
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Invite your first team member above."
          />
        )}

        {!isLoading && !isError && members.length > 0 && (
          <div className="bg-white rounded-[16px] shadow-[var(--color-wise-ring)_0_0_0_1px] overflow-hidden">
            <table className="w-full border-collapse" aria-label="Team members">
              <thead>
                <tr>
                  {['Member', 'Permissions', 'Status', 'Last Active', 'Actions'].map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className="text-left text-[11px] font-[600] text-[var(--color-wise-text-muted)] px-5 py-3 border-b border-[var(--color-wise-ring)] uppercase tracking-[0.5px] bg-[var(--color-wise-canvas)]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((member, idx) => (
                  <SubAdminRow
                    key={member.id}
                    member={member}
                    isOwner={idx === 0}
                    onDeactivate={setDeactivateTarget}
                    onPermissionsUpdated={handlePermissionsUpdated}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
