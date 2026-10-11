// PBA-131 — Admin dashboard React Query hooks
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminStats {
  activeStudents: number
  pendingReviews: number
  completionRate: number
  activeCohorts: number
}

export interface AtRiskStudent {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string | null
  cohort: { id: string; name: string } | null
  daysInactive: number
  lastActiveAt: string | null
}

export interface AtRiskResponse {
  students: AtRiskStudent[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const adminDashboardKeys = {
  all: ['admin', 'dashboard'] as const,
  stats: () => [...adminDashboardKeys.all, 'stats'] as const,
  atRisk: (page: number, limit: number) =>
    [...adminDashboardKeys.all, 'at-risk', page, limit] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery({
    queryKey: adminDashboardKeys.stats(),
    queryFn: async () => {
      const { data, error } = await apiFetch<AdminStats>('/api/admin/stats')
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load dashboard stats')
      }
      return data
    },
    staleTime: 60_000,
  })
}

export function useAdminAtRisk(page = 1, limit = 10) {
  return useQuery({
    queryKey: adminDashboardKeys.atRisk(page, limit),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      const { data, error } = await apiFetch<AtRiskResponse>(
        `/api/admin/at-risk?${params.toString()}`
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load at-risk students')
      }
      return data
    },
  })
}
