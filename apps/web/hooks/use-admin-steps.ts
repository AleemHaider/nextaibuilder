// PBA — Admin step library React Query hooks
// PBA-269 — isActive field added
// PBA-272 — useAdminStep(id) hook for single step fetch
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminStep {
  id: string
  title: string
  order: number
  description: string
  videoUrl: string | null
  screenshotCriteria: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  estimatedMinutes?: number | null
  checklist?: string[]
  whyItMatters?: string | null
  quickReferenceChecklist?: string[]
  keyLinks?: { label: string; url: string }[]
  videoTranscript?: string | null
}

export interface CreateStepPayload {
  title: string
  description: string
  screenshotCriteria: string
  videoUrl?: string
  order?: number
  isActive?: boolean
  estimatedMinutes?: number | null
  checklist?: string[]
  whyItMatters?: string | null
  quickReferenceChecklist?: string[]
  keyLinks?: { label: string; url: string }[]
  videoTranscript?: string | null
}

export interface UpdateStepPayload {
  title?: string
  description?: string
  screenshotCriteria?: string
  videoUrl?: string | null
  order?: number
  isActive?: boolean
  estimatedMinutes?: number | null
  checklist?: string[]
  whyItMatters?: string | null
  quickReferenceChecklist?: string[]
  keyLinks?: { label: string; url: string }[]
  videoTranscript?: string | null
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const adminStepKeys = {
  all: ['admin', 'steps'] as const,
  list: () => [...adminStepKeys.all, 'list'] as const,
  detail: (id: string) => [...adminStepKeys.all, 'detail', id] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAdminSteps() {
  return useQuery({
    queryKey: adminStepKeys.list(),
    queryFn: async () => {
      const { data, error } = await apiFetch<{ steps: AdminStep[] }>('/api/admin/steps')
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load steps')
      }
      return data.steps
    },
  })
}

// PBA-272 — Fetch a single step by id
export function useAdminStep(id: string) {
  return useQuery({
    queryKey: adminStepKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await apiFetch<{ step: AdminStep }>(`/api/admin/steps/${id}`)
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load step')
      }
      return data.step
    },
    enabled: Boolean(id),
  })
}

export function useCreateStep() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateStepPayload) => {
      const { data, error } = await apiFetch<AdminStep>('/api/admin/steps', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create step')
      }
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStepKeys.list() })
    },
  })
}

export function useUpdateStep() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateStepPayload }) => {
      const { data, error } = await apiFetch<AdminStep>(`/api/admin/steps/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update step')
      }
      return data
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminStepKeys.list() })
      // Also invalidate the step-detail cache — otherwise re-opening the editor
      // within staleTime repopulates the form from pre-edit data (looks like the
      // save reverted).
      void queryClient.invalidateQueries({ queryKey: adminStepKeys.detail(variables.id) })
    },
  })
}

export function useDeleteStep() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiFetch<null>(`/api/admin/steps/${id}`, { method: 'DELETE' })
      if (error) {
        throw new Error(error.message ?? 'Failed to delete step')
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStepKeys.list() })
    },
  })
}

export function useReorderCohortSteps() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ cohortId, stepIds }: { cohortId: string; stepIds: string[] }) => {
      const { data, error } = await apiFetch<{ success: boolean }>(
        `/api/admin/cohorts/${cohortId}/steps/reorder`,
        {
          method: 'POST',
          body: JSON.stringify({ stepIds }),
        }
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to reorder steps')
      }
      return data
    },
    onSuccess: (_data, { cohortId }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'cohorts', 'detail', cohortId] })
    },
  })
}
