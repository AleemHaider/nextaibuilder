// PBA-131 — Admin students React Query hooks
// PBA-288 — invite, resend-invite, revoke-invite mutations
// PBA-367 — sort params (sortBy, sortDir)
// PBA-369 — nudge mutation
// PBA-387 — transfer to cohort mutation + cohorts list hook
// PBA-388 — reset progress mutation
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StudentStatus = 'active' | 'inactive' | 'completed'
export type HealthStatus = 'on_track' | 'at_risk' | 'blocked' | 'completed'

export interface AdminStudent {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string | null
  role: string
  cohort: { id: string; name: string } | null
  completedSteps: number
  totalSteps: number
  progressPercent: number
  lastActiveAt: string | null
  daysSinceActive: number | null
  joinedAt: string
  status: StudentStatus
  healthStatus: HealthStatus
  inviteStatus: 'PENDING' | 'ACCEPTED' | 'REVOKED'
}

export interface AdminStudentsResponse {
  students: AdminStudent[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AdminStudentStepProgress {
  studentStepId: string | null
  stepId: string
  stepTitle: string
  order: number
  status: string
  submissionId: string | null
  submittedAt: string | null
  mlScore: number | null
  reviewStatus: string | null
  reviewedAt: string | null
}

export interface AdminStudentSubmission {
  id: string
  stepId: string
  stepTitle: string | null
  stepOrder: number | null
  s3Key: string
  screenshotUrl: string | null
  status: 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW' | 'NEEDS_REVISION'
  mlScore: number | null
  reviewNote: string | null
  reviewedBy: { firstName: string; lastName: string } | null
  reviewedAt: string | null
  createdAt: string
}

export interface AdminStudentProgress {
  completedSteps: number
  totalSteps: number
  progressPercent: number
  healthStatus: HealthStatus
  daysUntilDeadline: number | null
  stepsRemaining: number
  daysSinceActive: number | null
}

export interface AdminStudentDetail extends AdminStudent {
  stepProgress: AdminStudentStepProgress[]
  submissions: AdminStudentSubmission[]
  progress: AdminStudentProgress
}

export type SortBy = 'lastActiveAt' | 'name' | 'progress'
export type SortDir = 'asc' | 'desc'

export interface AdminStudentsFilters {
  q?: string
  cohortId?: string
  status?: StudentStatus | HealthStatus | 'all'
  page?: number
  limit?: number
  sortBy?: SortBy
  sortDir?: SortDir
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const adminStudentKeys = {
  all: ['admin', 'students'] as const,
  list: (filters: AdminStudentsFilters) =>
    [...adminStudentKeys.all, 'list', filters] as const,
  detail: (id: string) => [...adminStudentKeys.all, 'detail', id] as const,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildQuery(filters: AdminStudentsFilters): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.cohortId) params.set('cohortId', filters.cohortId)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.page !== undefined) params.set('page', String(filters.page))
  if (filters.limit !== undefined) params.set('limit', String(filters.limit))
  if (filters.sortBy) params.set('sortBy', filters.sortBy)
  if (filters.sortDir) params.set('sortDir', filters.sortDir)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAdminStudents(filters: AdminStudentsFilters = {}) {
  return useQuery({
    queryKey: adminStudentKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await apiFetch<AdminStudentsResponse>(
        `/api/admin/students${buildQuery(filters)}`
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load students')
      }
      return data
    },
  })
}

export function useAdminStudent(id: string) {
  return useQuery({
    queryKey: adminStudentKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await apiFetch<AdminStudentDetail>(`/api/admin/students/${id}`)
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load student')
      }
      return data
    },
    enabled: Boolean(id),
  })
}

// ── Invite types ───────────────────────────────────────────────────────────────

export interface InviteStudentPayload {
  firstName: string
  lastName: string
  email: string
  cohortId: string
}

export interface InviteStudentResponse {
  student: {
    id: string
    firstName: string
    lastName: string
    email: string
    cohortId: string
    inviteStatus: 'PENDING' | 'ACCEPTED' | 'REVOKED'
  }
}

// ── Invite mutations (PBA-288) ─────────────────────────────────────────────────

export function useInviteStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: InviteStudentPayload) => {
      const { data, error } = await apiFetch<InviteStudentResponse>(
        '/api/admin/students/invite',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      )
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.all })
    },
  })
}

export function useResendInvite(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiFetch<{ message: string }>(
        `/api/admin/students/${id}/resend-invite`,
        { method: 'POST' },
      )
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.all })
    },
  })
}

export function useRevokeInvite(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiFetch<{ message: string }>(
        `/api/admin/students/${id}/revoke-invite`,
        { method: 'POST' },
      )
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.all })
    },
  })
}

// ── Batch invite + CSV import mutations (PBA-365/366) ─────────────────────────

export interface BatchInvitePayload {
  emails: string[]
  cohortId: string
}

export interface BatchInviteResponse {
  invited: number
  skipped: number
  errors: string[]
}

export function useBatchInviteStudents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BatchInvitePayload) => {
      const { data, error } = await apiFetch<BatchInviteResponse>(
        '/api/admin/students/batch-invite',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      )
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.all })
      // Cohort rosters (keyed ['admin','cohorts','students',id]) read a separate
      // query, so invalidate the cohorts tree too — otherwise inviting from a
      // roster page leaves the list stale until a manual reload.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'cohorts'] })
    },
  })
}

export interface CsvImportResponse {
  imported: number
  skipped: number
  errors: number
}

export function useCsvImportStudents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      // Use apiFetch but pass a custom header to signal multipart — doFetch spreads
      // options.headers last, so passing 'Content-Type': undefined won't unset the
      // json default. Instead we call the raw fetch via apiFetch with explicit headers
      // that include the Authorization token. We replicate the token injection here.
      const { authStore } = await import('@/store/auth')
      const token = authStore.getState().accessToken
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL as string | undefined) ?? 'http://localhost:4000'
      const res = await fetch(`${API_BASE}/api/admin/students/csv-import`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const body = await res.json().catch(() => ({})) as CsvImportResponse | { error: string; message?: string }
      if (!res.ok) throw body
      return body as CsvImportResponse
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'cohorts'] })
    },
  })
}

// ── Activity log (PBA-360) ────────────────────────────────────────────────────

export type ActivityEventType =
  | 'step_completed'
  | 'step_override_pass'
  | 'step_override_fail'
  | 'step_unlocked'
  | 'screenshot_submitted'
  | 'screenshot_approved'
  | 'screenshot_rejected'
  | 'nudge_sent'
  | 'invite_sent'
  | 'invite_accepted'
  | 'invite_revoked'
  | 'cohort_enrolled'
  | 'login'

export interface ActivityEvent {
  id: string
  type: ActivityEventType | string
  actorName: string | null
  actorRole: 'student' | 'admin' | 'sub_admin' | 'system'
  metadata: Record<string, unknown>
  createdAt: string
}

export interface ActivityLogResponse {
  events: ActivityEvent[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function useStudentActivityLog(
  studentId: string,
  page: number,
  typeFilter?: string,
) {
  return useQuery({
    queryKey: ['admin', 'students', studentId, 'activity-log', page, typeFilter ?? null],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (typeFilter) params.set('type', typeFilter)
      const { data, error } = await apiFetch<ActivityLogResponse>(
        `/api/admin/students/${studentId}/activity-log?${params.toString()}`,
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load activity log')
      }
      return data
    },
    enabled: Boolean(studentId),
  })
}

// ── Nudge mutation (PBA-369) ───────────────────────────────────────────────────

export function useNudgeStudent(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiFetch<{ message: string }>(
        `/api/admin/students/${id}/nudge`,
        { method: 'POST' },
      )
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.all })
    },
  })
}

// ── Cohorts list (PBA-387) ────────────────────────────────────────────────────

export interface AdminCohort {
  id: string
  name: string
}

export function useAdminCohorts() {
  return useQuery({
    queryKey: ['admin', 'cohorts', 'list'],
    queryFn: async () => {
      const { data, error } = await apiFetch<{ cohorts: AdminCohort[] }>('/api/admin/cohorts')
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load cohorts')
      }
      return data.cohorts
    },
  })
}

// ── Transfer to Cohort mutation (PBA-387) ─────────────────────────────────────

export function useTransferStudent(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ cohortId }: { cohortId: string }) => {
      const { data, error } = await apiFetch<{ message: string; cohortId: string }>(
        `/api/admin/students/${id}/transfer`,
        {
          method: 'POST',
          body: JSON.stringify({ cohortId }),
        },
      )
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.all })
    },
  })
}

// ── Reset Progress mutation (PBA-388) ─────────────────────────────────────────

export function useResetStudentProgress(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiFetch<{ message: string; stepsReset: number }>(
        `/api/admin/students/${id}/reset-progress`,
        { method: 'POST' },
      )
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: adminStudentKeys.all })
    },
  })
}
