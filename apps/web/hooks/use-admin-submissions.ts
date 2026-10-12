// PBA-130 — Admin submission review hooks (React Query)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SubmissionStatus =
  | 'PENDING'
  | 'ML_PROCESSING'
  | 'HUMAN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

export interface AdminSubmissionRow {
  id: string
  student: {
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string | null
  }
  step: {
    id: string
    title: string
    order: number
  }
  cohort: {
    id: string
    name: string
  } | null
  status: SubmissionStatus
  mlScore: number | null
  mlFeedback: string | null
  screenshotUrl?: string | null
  attemptCount?: number
  createdAt: string
  reviewedAt: string | null
  adminNote: string | null
}

export interface AdminSubmissionsResponse {
  submissions: AdminSubmissionRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AdminSubmissionDetail extends Omit<AdminSubmissionRow, 'screenshotUrl' | 'attemptCount' | 'student' | 'step' | 'cohort'> {
  student: {
    id: string
    email: string
    firstName: string
    lastName: string
    avatarUrl?: string | null
    attempts: number
  }
  step: {
    id: string
    title: string
    order: number
    description: string
    screenshotCriteria: string
    videoUrl?: string | null
  }
  reviewedBy: {
    id: string
    email: string
    firstName: string
    lastName: string
  } | null
  cohort: { id: string; name: string } | null
  screenshotUrl: string | null
  attemptCount: number
  adminNote: string | null
}

export interface AdminSubmissionsFilters {
  status?: SubmissionStatus | 'ALL'
  search?: string
  cohortId?: string
  stepId?: string
  page?: number
  limit?: number
}

export interface ReviewPayload {
  status: 'APPROVED' | 'REJECTED'
  adminNote?: string
}

export interface AdminQueueStats {
  totalPending: number
  approvedToday: number
  rejectedToday: number
  avgMlScore: number | null
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const adminSubmissionKeys = {
  all: ['admin', 'submissions'] as const,
  list: (filters: AdminSubmissionsFilters) =>
    [...adminSubmissionKeys.all, 'list', filters] as const,
  detail: (id: string) =>
    [...adminSubmissionKeys.all, 'detail', id] as const,
  stats: () =>
    [...adminSubmissionKeys.all, 'stats'] as const,
}

// ── API calls ─────────────────────────────────────────────────────────────────

function buildQuery(filters: AdminSubmissionsFilters): string {
  const params = new URLSearchParams()
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  if (filters.cohortId) params.set('cohortId', filters.cohortId)
  if (filters.stepId) params.set('stepId', filters.stepId)
  if (filters.page !== undefined) params.set('page', String(filters.page))
  if (filters.limit !== undefined) params.set('limit', String(filters.limit))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const adminApi = {
  getSubmissions: (filters: AdminSubmissionsFilters) =>
    apiFetch<AdminSubmissionsResponse>(
      `/api/admin/submissions${buildQuery(filters)}`
    ),

  getSubmission: (id: string) =>
    apiFetch<AdminSubmissionDetail>(`/api/admin/submissions/${id}`),

  getStats: () =>
    apiFetch<AdminQueueStats>('/api/admin/submissions/stats'),

  reviewSubmission: (id: string, payload: ReviewPayload) =>
    apiFetch<AdminSubmissionRow>(`/api/admin/submissions/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAdminSubmissions(filters: AdminSubmissionsFilters = {}) {
  return useQuery({
    queryKey: adminSubmissionKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await adminApi.getSubmissions(filters)
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load submissions')
      }
      return data
    },
  })
}

export function useAdminSubmission(id: string) {
  return useQuery({
    queryKey: adminSubmissionKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await adminApi.getSubmission(id)
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load submission')
      }
      return data
    },
    enabled: Boolean(id),
  })
}

export function useAdminQueueStats(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: adminSubmissionKeys.stats(),
    queryFn: async () => {
      const { data, error } = await adminApi.getStats()
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load stats')
      }
      return data
    },
    refetchInterval: options?.refetchInterval,
  })
}

export function useReviewSubmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ReviewPayload }) => {
      const { data, error } = await adminApi.reviewSubmission(id, payload)
      if (error || !data) throw new Error(error?.message ?? 'Failed to review submission')
      return data
    },

    onSuccess: (_result, { id }) => {
      // Invalidate the specific detail + the full list + stats
      void queryClient.invalidateQueries({ queryKey: adminSubmissionKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: adminSubmissionKeys.all })
    },
  })
}
