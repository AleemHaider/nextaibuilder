// PBA-315 — Student Profile & Settings page
import { Loader2 } from 'lucide-react'
import { useStudentProfile } from '@/hooks/use-student-profile'
import { ProfileSection } from '@/app/components/profile/profile-section'
import { NotificationSection } from '@/app/components/profile/notification-section'
import { AccountSection } from '@/app/components/profile/account-section'

function StudentProfilePage() {
  const { data: profile, isLoading, isError } = useStudentProfile()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#4a9ad4] animate-spin" />
      </div>
    )
  }

  if (isError || !profile) {
    return (
      <div className="p-10 max-w-[720px]">
        <p className="text-sm text-[#d4183d]">Failed to load profile. Please refresh the page.</p>
      </div>
    )
  }

  return (
    <div className="p-10 max-w-[720px]">
      <h1 className="text-[28px] font-medium text-[#1a2744] mb-8">Your Profile</h1>

      <ProfileSection profile={profile} />

      <NotificationSection initial={profile.notifications} />

      <AccountSection hasPassword={profile.hasPassword} />
    </div>
  )
}

export { StudentProfilePage }
