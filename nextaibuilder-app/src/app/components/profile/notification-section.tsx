// PBA-315 — Notification preferences section with optimistic toggle updates
import * as React from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUpdateNotifications } from '@/hooks/use-student-profile'
import type { NotificationPreferences } from '@/lib/api-client'

interface NotificationSectionProps {
  initial: NotificationPreferences
  className?: string
}

const NOTIFICATION_ITEMS: {
  key: keyof NotificationPreferences
  label: string
  description: string
}[] = [
  {
    key:         'setupReminders',
    label:       'Setup reminders',
    description: 'Reminders to complete your next setup step',
  },
  {
    key:         'progressUpdates',
    label:       'Progress updates',
    description: 'Updates when your submissions are reviewed',
  },
  {
    key:         'deadlineAlerts',
    label:       'Deadline alerts',
    description: 'Alerts when your cohort deadline is approaching',
  },
  {
    key:         'tipsAndEncouragement',
    label:       'Tips & encouragement',
    description: 'Helpful tips and motivational messages',
  },
]

function Toggle({ checked, onChange, id }: { checked: boolean; onChange: () => void; id: string }) {
  return (
    <button
      id={id}
      role="switch"
      type="button"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'relative inline-flex w-[44px] h-[24px] rounded-full transition-colors focus:outline-none',
        'focus-visible:ring-2 focus-visible:ring-[#4a9ad4] focus-visible:ring-offset-2',
        checked ? 'bg-[#1a2744]' : 'bg-[#cbced4]',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[23px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  )
}

function NotificationSection({ initial, className }: NotificationSectionProps) {
  const [prefs, setPrefs] = React.useState<NotificationPreferences>(initial)
  const updateMutation = useUpdateNotifications()

  async function handleToggle(key: keyof NotificationPreferences) {
    const newValue = !prefs[key]

    // Optimistic update
    setPrefs((prev) => ({ ...prev, [key]: newValue }))

    try {
      await updateMutation.mutateAsync({ [key]: newValue })
    } catch (err) {
      // Revert on error
      setPrefs((prev) => ({ ...prev, [key]: !newValue }))
      toast.error(err instanceof Error ? err.message : 'Failed to update notification preferences.')
    }
  }

  return (
    <section
      data-slot="notification-section"
      className={cn('border-b border-black/10 pb-10 mb-10', className)}
    >
      <h2 className="text-[18px] font-medium text-[#1a2744] mb-2">Notifications</h2>
      <p className="text-sm text-[#717182] mb-6">Choose which email notifications you receive.</p>

      <div className="flex flex-col gap-0 divide-y divide-black/10 border border-black/10 rounded-xl overflow-hidden">
        {NOTIFICATION_ITEMS.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex flex-col">
              <label
                htmlFor={`notif-${key}`}
                className="text-sm font-medium text-[#1a2744] cursor-pointer"
              >
                {label}
              </label>
              <span className="text-xs text-[#717182] mt-0.5">{description}</span>
            </div>
            <Toggle
              id={`notif-${key}`}
              checked={prefs[key]}
              onChange={() => handleToggle(key)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

export { NotificationSection }
