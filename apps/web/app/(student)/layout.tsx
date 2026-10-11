'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { studentApi } from '@/lib/api-client'
import { StudentShell } from '@/components/ui/student-shell'
import { StudentSidebarPanel } from '@/components/ui/student-sidebar-panel'
import { RequireAuth } from '@/components/ui/auth-guard'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user } = useAuth()
  const userName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Student'
  const userInitials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : 'S'
  const userAvatar = user?.avatarUrl ?? undefined

  const { data: dashboardData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data, error } = await studentApi.getDashboard()
      if (error) throw new Error(error.message ?? 'Failed to load dashboard')
      return data!
    },
  })

  return (
    <RequireAuth role="STUDENT">
      <StudentShell
        userName={userName}
        userInitials={userInitials}
        userAvatar={userAvatar}
        cohortName={dashboardData?.cohort?.name}
        cohortStartDate={dashboardData?.cohort?.startDate ?? undefined}
        cohortDeadline={dashboardData?.cohort?.deadline ?? undefined}
        stepPanel={
          <StudentSidebarPanel
            onStepClick={(stepId) => router.push(`/steps/${stepId}`)}
          />
        }
      >
        {children}
      </StudentShell>
    </RequireAuth>
  )
}
