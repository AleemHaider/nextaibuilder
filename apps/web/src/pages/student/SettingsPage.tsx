// FIR-171 — Student settings: Profile + Notification preferences
// Sprint 3 Story 15 — Wise theme migration.
//
//   - Pill tabs with mint-green active state
//   - Form fields use <FormField><Input /></FormField> with shared a11y wiring
//   - Save buttons are <Button variant="primary"> with isLoading
//   - Toggle rows preserve the existing aria-switch semantics but switch to
//     Wise primary/mint surfaces
//   - The danger-zone account-deletion section is a theme hook only — we
//     render the CTA + <ConfirmDialog> plumbing wired to a TODO so the audit
//     has a pattern to point at; the backend delete endpoint is intentionally
//     deferred to a separate sprint (no new business logic here).
import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, X, AlertTriangle } from 'lucide-react'
import { TopNav } from '../../components/TopNav'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FormField } from '../../components/ui/FormField'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  fetchStudentProfile,
  updateStudentProfile,
  changeStudentPassword,
  type NotificationPreferences,
  type NotificationPreferencesResponse,
  type StudentProfile,
} from '../../lib/api'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SettingsTab = 'profile' | 'notifications'

// ---------------------------------------------------------------------------
// Toggle Switch — Wise primary fill when on, soft surface when off
// ---------------------------------------------------------------------------

interface ToggleSwitchProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

function ToggleSwitch({ id, checked, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wise-primary)] focus-visible:ring-offset-2',
        checked
          ? 'bg-[var(--color-wise-primary)]'
          : 'bg-[var(--color-wise-surface-soft)]',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
          'transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// ToggleRow
// ---------------------------------------------------------------------------

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

function ToggleRow({ label, description, checked, onChange, disabled }: ToggleRowProps) {
  const id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--color-wise-ring)] last:border-b-0">
      <div className="flex-1">
        <label
          htmlFor={id}
          className="text-[15px] font-semibold text-[var(--color-wise-text)] cursor-pointer"
        >
          {label}
        </label>
        <p className="text-[13px] text-[var(--color-wise-text-muted)] mt-0.5">{description}</p>
      </div>
      <ToggleSwitch
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

type ToastState = { message: string; type: 'success' | 'error' } | null

function Toast({ state, onDismiss }: { state: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!state) return
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [state, onDismiss])

  if (!state) return null

  const Icon = state.type === 'success' ? CircleCheck : X

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-[var(--radius-sm)] shadow-lg',
        'text-[14px] font-semibold max-w-[320px] flex items-center gap-2',
        'transition-all',
        state.type === 'success'
          ? 'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]'
          : 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{state.message}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NotificationsTab
// ---------------------------------------------------------------------------

const DEFAULT_PREFS: NotificationPreferences = {
  emailEnrollment: true,
  emailPayments: true,
  emailReminders: true,
  emailBroadcast: false,
}

function NotificationsTab() {
  const [toast, setToast] = useState<ToastState>(null)
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS)

  const { data: prefsData, isLoading, error } = useQuery<NotificationPreferencesResponse, Error>({
    queryKey: ['student', 'settings', 'notifications'],
    queryFn: fetchNotificationPreferences,
  })

  useEffect(() => {
    if (prefsData?.notifications) {
      setLocalPrefs(prefsData.notifications)
    }
  }, [prefsData])

  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      setToast({ message: 'Notification preferences saved.', type: 'success' })
    },
    onError: (err: Error) => {
      setToast({ message: err.message || 'Failed to save preferences.', type: 'error' })
    },
  })

  function handleToggle(key: keyof NotificationPreferences, value: boolean) {
    const updated = { ...localPrefs, [key]: value }
    setLocalPrefs(updated)
    mutation.mutate(updated)
  }

  const isSaving = mutation.isPending

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex justify-between items-center py-4 border-b border-[var(--color-wise-ring)]"
          >
            <div className="space-y-1.5 flex-1">
              <LoadingSkeleton variant="rect" height={14} className="w-40 rounded" />
              <LoadingSkeleton variant="rect" height={12} className="w-64 rounded" />
            </div>
            <LoadingSkeleton variant="rect" height={24} className="w-11 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] text-[14px] font-semibold rounded-[var(--radius-sm)] px-4 py-3 mt-4">
        Failed to load preferences. Please refresh.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-[var(--color-wise-text)] mb-1">
          Email Notifications
        </h2>
        <p className="text-[14px] text-[var(--color-wise-text-muted)]">
          Control which email notifications you receive from nextaibuilder.
        </p>
      </div>

      <div className="bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-ring)] px-5">
        <ToggleRow
          label="Enrollment & access updates"
          description="Get notified when your enrollment is confirmed or your course access changes."
          checked={localPrefs.emailEnrollment}
          onChange={(v) => handleToggle('emailEnrollment', v)}
          disabled={isSaving}
        />
        <ToggleRow
          label="Payment notifications"
          description="Receive emails about payment approvals, receipts, and installment reminders."
          checked={localPrefs.emailPayments}
          onChange={(v) => handleToggle('emailPayments', v)}
          disabled={isSaving}
        />
        <ToggleRow
          label="Course reminders"
          description="Weekly course reminders and re-engagement nudges to keep you on track."
          checked={localPrefs.emailReminders}
          onChange={(v) => handleToggle('emailReminders', v)}
          disabled={isSaving}
        />
        <ToggleRow
          label="Broadcast announcements"
          description="Platform-wide announcements, new course launches, and important updates."
          checked={localPrefs.emailBroadcast}
          onChange={(v) => handleToggle('emailBroadcast', v)}
          disabled={isSaving}
        />
      </div>

      {isSaving && (
        <p className="text-[13px] text-[var(--color-wise-text-muted)] mt-3 animate-pulse">
          Saving…
        </p>
      )}

      <Toast state={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProfileTab
// ---------------------------------------------------------------------------

function ProfileTab() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<ToastState>(null)

  // Profile form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const { data: profile, isLoading: profileLoading } = useQuery<StudentProfile, Error>({
    queryKey: ['student', 'profile'],
    queryFn: fetchStudentProfile,
  })

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName)
      setLastName(profile.lastName)
    }
  }, [profile])

  const profileMutation = useMutation({
    mutationFn: updateStudentProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student', 'profile'] })
      setToast({ message: 'Profile updated.', type: 'success' })
    },
    onError: (err: Error) => {
      setToast({ message: err.message || 'Failed to save profile.', type: 'error' })
    },
  })

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) return
    profileMutation.mutate({ firstName: firstName.trim(), lastName: lastName.trim() })
  }

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const passwordMutation = useMutation({
    mutationFn: changeStudentPassword,
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setToast({ message: 'Password changed successfully.', type: 'success' })
    },
    onError: (err: Error) => {
      setToast({ message: err.message || 'Failed to change password.', type: 'error' })
    },
  })

  function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) return
    passwordMutation.mutate({ currentPassword, newPassword, confirmPassword })
  }

  // Danger zone — account deletion placeholder. We render the surface but
  // keep the action inert (console.warn) because there is no delete endpoint
  // yet; a follow-up sprint will wire the real mutation.
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (profileLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton variant="rect" height={16} className="w-32 rounded" />
        <LoadingSkeleton variant="rect" height={44} className="rounded-xl" />
        <LoadingSkeleton variant="rect" height={44} className="rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <form
        onSubmit={handleProfileSave}
        className="bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-ring)] p-6"
      >
        <h2 className="text-[18px] font-bold text-[var(--color-wise-text)] mb-1">Profile</h2>
        <p className="text-[13px] text-[var(--color-wise-text-muted)] mb-5">
          Update your display name. Your email ({user?.email}) cannot be changed here.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <FormField id="settings-first-name" label="First name" required>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              required
            />
          </FormField>
          <FormField id="settings-last-name" label="Last name">
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </FormField>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={profileMutation.isPending}
          disabled={profileMutation.isPending}
        >
          {profileMutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>

      {/* Password — only shown for password-auth accounts */}
      {profile?.hasPassword && (
        <form
          onSubmit={handlePasswordChange}
          className="bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-ring)] p-6"
        >
          <h2 className="text-[18px] font-bold text-[var(--color-wise-text)] mb-1">
            Change Password
          </h2>
          <p className="text-[13px] text-[var(--color-wise-text-muted)] mb-5">
            Minimum 8 characters with at least one uppercase letter and one number.
          </p>

          <div className="space-y-4 mb-5">
            <FormField id="settings-current-password" label="Current password">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
              />
            </FormField>
            <FormField id="settings-new-password" label="New password">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
              />
            </FormField>
            <FormField id="settings-confirm-password" label="Confirm new password">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </FormField>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={passwordMutation.isPending}
            disabled={
              passwordMutation.isPending ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
          >
            {passwordMutation.isPending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      )}

      {/* Danger zone — account deletion surface (inert until a future sprint
          wires the backend mutation). We still render the confirm-dialog
          pattern so the audit can validate the UX contract. */}
      <div
        className={cn(
          'bg-[var(--color-wise-danger-soft)] rounded-[var(--radius-md)] p-6',
          'border border-[var(--color-wise-danger)]/30',
        )}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="h-5 w-5 text-[var(--color-wise-danger)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-[var(--color-wise-danger)] mb-1">
              Danger zone
            </h2>
            <p className="text-[13px] text-[var(--color-wise-text-muted)] mb-4">
              Deleting your account removes your enrollments, progress, and
              certificates. This action cannot be undone.
            </p>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => setDeleteOpen(true)}
            >
              Delete account
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your account?"
        description="This permanently removes your enrollments, progress, and certificates. This action cannot be undone."
        confirmLabel="Delete account"
        variant="danger"
        onConfirm={() => {
          // No delete endpoint yet — surfaced in the next sprint. For now we
          // just show a toast so the surface is observable in QA.
          setToast({
            message: 'Account deletion is not yet available. Please contact support.',
            type: 'error',
          })
        }}
      />

      <Toast state={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

const TABS: Array<{ key: SettingsTab; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'notifications', label: 'Notifications' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('notifications')

  return (
    <div className="min-h-screen bg-[var(--color-wise-canvas)]">
      <TopNav />

      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-[28px] sm:text-[32px] font-black text-[var(--color-wise-text)] mb-6 tracking-[-0.5px]">
          Settings
        </h1>

        {/* Wise pill tabs — mint surface-soft container, primary-mint active. */}
        <div
          className="flex gap-1 bg-[var(--color-wise-surface-soft)] rounded-[var(--radius-pill)] p-1 mb-7 w-fit"
          role="tablist"
          aria-label="Settings sections"
        >
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              aria-controls={`panel-${key}`}
              onClick={() => setActiveTab(key)}
              className={cn(
                'px-5 py-2 rounded-[var(--radius-pill)] text-[14px] font-semibold',
                'transition-colors border-none cursor-pointer',
                'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2',
                activeTab === key
                  ? 'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]'
                  : 'bg-transparent text-[var(--color-wise-text-muted)] hover:text-[var(--color-wise-text)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
        </div>
      </main>
    </div>
  )
}
