// PBA-131 — Admin cohort React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CohortStatus = 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'

export interface Cohort {
  id: string
  name: string
  code: string
  status: CohortStatus
  studentCount: number
  startDate: string
  endDate: string
  createdAt: string
}

export interface CohortStudent {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string | null
  completedSteps: number
  totalSteps: number
  progressPercent: number
  lastActiveAt: string | null
  enrolledAt: string
}

export interface CohortDetail extends Cohort {
  description?: string
}

export interface CreateCohortPayload {
  name: string
  code: string
  startDate: string
  endDate: string
}

export interface UpdateCohortPayload extends Partial<CreateCohortPayload> {
  status?: CohortStatus
}

export interface EnrollStudentPayload {
  email: string
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const adminCohortKeys = {
  all: ['admin', 'cohorts'] as const,
  list: () => [...adminCohortKeys.all, 'list'] as const,
  detail: (id: string) => [...adminCohortKeys.all, 'detail', id] as const,
  students: (id: string) => [...adminCohortKeys.all, 'students', id] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAdminCohorts() {
  return useQuery({
    queryKey: adminCohortKeys.list(),
    queryFn: async () => {
      const { data, error } = await apiFetch<{ cohorts: Cohort[] }>('/api/admin/cohorts')
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load cohorts')
      }
      return data.cohorts
    },
  })
}

export function useAdminCohort(id: string) {
  return useQuery({
    queryKey: adminCohortKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await apiFetch<{ cohort: CohortDetail }>(`/api/admin/cohorts/${id}`)
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load cohort')
      }
      return data.cohort
    },
    enabled: Boolean(id),
  })
}

export function useAdminCohortStudents(id: string) {
  return useQuery({
    queryKey: adminCohortKeys.students(id),
    queryFn: async () => {
      const { data, error } = await apiFetch<{ students: CohortStudent[] }>(
        `/api/admin/cohorts/${id}/students`
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load cohort students')
      }
      return data.students
    },
    enabled: Boolean(id),
  })
}

export function useCreateCohort() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateCohortPayload) => {
      const { data, error } = await apiFetch<Cohort>('/api/admin/cohorts', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create cohort')
      }
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminCohortKeys.list() })
    },
  })
}

export function useUpdateCohort() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateCohortPayload }) => {
      const { data, error } = await apiFetch<Cohort>(`/api/admin/cohorts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update cohort')
      }
      return data
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: adminCohortKeys.list() })
      void queryClient.invalidateQueries({ queryKey: adminCohortKeys.detail(id) })
    },
  })
}

export function useEnrollStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ cohortId, payload }: { cohortId: string; payload: EnrollStudentPayload }) => {
      const { data, error } = await apiFetch<{ success: boolean }>(
        `/api/admin/cohorts/${cohortId}/enroll`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to enroll student')
      }
      return data
    },
    onSuccess: (_data, { cohortId }) => {
      void queryClient.invalidateQueries({ queryKey: adminCohortKeys.students(cohortId) })
      void queryClient.invalidateQueries({ queryKey: adminCohortKeys.detail(cohortId) })
    },
  })
}

export function useRemoveStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ cohortId, studentId }: { cohortId: string; studentId: string }) => {
      const { error } = await apiFetch<null>(
        `/api/admin/cohorts/${cohortId}/students/${studentId}`,
        { method: 'DELETE' }
      )
      if (error) {
        throw new Error(error.message ?? 'Failed to remove student')
      }
    },
    onSuccess: (_data, { cohortId }) => {
      void queryClient.invalidateQueries({ queryKey: adminCohortKeys.students(cohortId) })
      void queryClient.invalidateQueries({ queryKey: adminCohortKeys.detail(cohortId) })
    },
  })
}
