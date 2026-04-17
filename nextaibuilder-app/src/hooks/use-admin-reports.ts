// PBA-132 — Admin Reports & Analytics React Query hooks
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProgressReportCohort {
  cohortId: string
  cohortName: string
  totalStudents: number
  completedStudents: number
  avgProgressPercent: number
  stepPassRates: Array<{
    stepId: string
    stepTitle: string
    stepOrder: number
    passRate: number
    totalAttempts: number
  }>
}

export interface ProgressReport {
  cohorts: ProgressReportCohort[]
  generatedAt: string
}

export interface SubmissionsByDay {
  date: string
  count: number
}

export interface SubmissionsReport {
  totalSubmissions: number
  approvedToday: number
  rejectedToday: number
  pendingNow: number
  mlAccuracyRate: number | null
  submissionsByDay: SubmissionsByDay[]
  generatedAt: string
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const adminReportKeys = {
  all: ['admin', 'reports'] as const,
  progress: () => [...adminReportKeys.all, 'progress'] as const,
  submissions: () => [...adminReportKeys.all, 'submissions'] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useProgressReport() {
  return useQuery({
    queryKey: adminReportKeys.progress(),
    queryFn: async () => {
      const { data, error } = await apiFetch<ProgressReport>('/api/admin/reports/progress')
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load progress report')
      }
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 min — reports are expensive
  })
}

export function useSubmissionsReport() {
  return useQuery({
    queryKey: adminReportKeys.submissions(),
    queryFn: async () => {
      const { data, error } = await apiFetch<SubmissionsReport>('/api/admin/reports/submissions')
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load submissions report')
      }
      return data
    },
    staleTime: 2 * 60 * 1000,
  })
}

export async function downloadProgressExport(): Promise<void> {
  // Trigger a file download by creating a temporary anchor element
  const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
  const { data: tokenData } = await apiFetch<never>('/api/auth/me') // ensure session is live
  void tokenData

  const link = document.createElement('a')
  link.href = `${API_BASE}/api/admin/reports/export`
  link.download = `pba-progress-export-${new Date().toISOString().slice(0, 10)}.csv`
  // Credentials are sent via httpOnly cookie — no header needed for binary GET
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
