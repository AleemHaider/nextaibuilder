// FIR-171 — Student settings: Profile + Notification preferences
import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TopNav } from '../../components/TopNav'
import { useAuth } from '../../context/AuthContext'
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
// Toggle Switch
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
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9ad4] focus-visible:ring-offset-2',
        checked ? 'bg-[#4a9ad4]' : 'bg-[#e8ecf4]',
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
    <div className="flex items-center justify-between gap-4 py-4 border-b border-[rgba(26,39,68,0.06)] last:border-b-0">
      <div className="flex-1">
        <label
          htmlFor={id}
          className="text-[15px] font-[600] text-[#1a2744] cursor-pointer"
        >
          {label}
        </label>
        <p className="text-[13px] text-[#717182] mt-0.5">{description}</p>
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
// Toast (inline, no external lib dependency)
// ---------------------------------------------------------------------------

type ToastState = { message: string; type: 'success' | 'error' } | null

function Toast({ state, onDismiss }: { state: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!state) return
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [state, onDismiss])

  if (!state) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-[14px] shadow-lg',
        'text-[14px] font-[600] max-w-[320px]',
        'transition-all',
        state.type === 'success'
          ? 'bg-[#1a2744] text-white'
          : 'bg-[#fdeaeb] text-[#d03238]',
      )}
    >
      {state.type === 'success' ? '✓ ' : '✕ '}
      {state.message}
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

  // Sync fetched preferences into local state
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
      <div className="animate-pulse space-y-4 py-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between items-center py-4 border-b border-[rgba(26,39,68,0.06)]">
            <div className="space-y-1.5">
              <div className="h-3.5 w-40 bg-[#e8ecf4] rounded-full" />
              <div className="h-3 w-64 bg-[#e8ecf4] rounded-full" />
            </div>
            <div className="h-6 w-11 bg-[#e8ecf4] rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#fdeaeb] text-[#d03238] text-[14px] font-[600] rounded-[12px] px-4 py-3 mt-4">
        Failed to load preferences. Please refresh.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[18px] font-[700] text-[#1a2744] mb-1">Email Notifications</h2>
        <p className="text-[14px] text-[#717182]">
          Control which email notifications you receive from nextaibuilder.
        </p>
      </div>

      <div className="bg-white rounded-[16px] border border-[rgba(26,39,68,0.08)] px-5">
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
        <p className="text-[13px] text-[#717182] mt-3 animate-pulse">Saving…</p>
      )}

      <Toast state={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProfileTab — name editing + password change
// ---------------------------------------------------------------------------

function ProfileTab() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<ToastState>(null)

  // ── Profile form state ─────────────────────────────────────────────────
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

  // ── Password form state ────────────────────────────────────────────────
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

  const inputClass = cn(
    'w-full h-[42px] px-4 rounded-[10px] text-[14px] font-[400] text-[#1a2744]',
    'bg-[#f3f3f5] border border-transparent outline-none',
    'focus:border-[#4a9ad4] focus:ring-[3px] focus:ring-[#4a9ad4]/20 transition-all',
  )

  if (profileLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-32 bg-[#e8ecf4] rounded-full" />
        <div className="h-[42px] bg-[#e8ecf4] rounded-[10px]" />
        <div className="h-[42px] bg-[#e8ecf4] rounded-[10px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Name */}
      <form
        onSubmit={handleProfileSave}
        className="bg-white rounded-[16px] border border-[rgba(26,39,68,0.08)] p-6"
      >
        <h2 className="text-[18px] font-[700] text-[#1a2744] mb-1">Profile</h2>
        <p className="text-[13px] text-[#717182] mb-5">
          Update your display name. Your email ({user?.email}) cannot be changed here.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
              First name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
              placeholder="First name"
              required
            />
          </div>
          <div>
            <label className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
              Last name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
              placeholder="Last name"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={profileMutation.isPending}
          className={cn(
            'px-6 py-2.5 rounded-full text-[14px] font-[700] border-none cursor-pointer transition-opacity',
            'bg-[#1a2744] text-white hover:opacity-90',
            profileMutation.isPending && 'opacity-50 cursor-not-allowed',
          )}
        >
          {profileMutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {/* Password — only shown for password-auth accounts */}
      {profile?.hasPassword && (
        <form
          onSubmit={handlePasswordChange}
          className="bg-white rounded-[16px] border border-[rgba(26,39,68,0.08)] p-6"
        >
          <h2 className="text-[18px] font-[700] text-[#1a2744] mb-1">Change Password</h2>
          <p className="text-[13px] text-[#717182] mb-5">
            Minimum 8 characters with at least one uppercase letter and one number.
          </p>

          <div className="space-y-4 mb-5">
            <div>
              <label className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
                Current password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                placeholder="Current password"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="New password"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            className={cn(
              'px-6 py-2.5 rounded-full text-[14px] font-[700] border-none cursor-pointer transition-opacity',
              'bg-[#4a9ad4] text-[#0d1a3a] hover:opacity-90',
              (passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword) &&
                'opacity-50 cursor-not-allowed',
            )}
          >
            {passwordMutation.isPending ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}

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
    <div className="min-h-screen bg-[#f8f9fb]">
      <TopNav />

      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header */}
        <h1 className="text-[28px] sm:text-[32px] font-[800] text-[#1a2744] mb-6">Settings</h1>

        {/* Tabs */}
        <div
          className="flex gap-1 bg-[#e8ecf4] rounded-[12px] p-1 mb-7 w-fit"
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
                'px-5 py-2 rounded-[9px] text-[14px] font-[600] transition-all border-none cursor-pointer',
                activeTab === key
                  ? 'bg-white text-[#1a2744] shadow-[0_1px_4px_rgba(26,39,68,0.12)]'
                  : 'bg-transparent text-[#717182] hover:text-[#1a2744]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
        </div>
      </main>
    </div>
  )
}
