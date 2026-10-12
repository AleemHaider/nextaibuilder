// PBA-238 — useSubAdmins React Query hooks
// PBA-267 — inviteStatus + useReinviteSubAdmin
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubAdmin {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  isActive: boolean
  role: 'ADMIN' | 'SUPER_ADMIN'
  createdAt: string
  permissions: string[]
  inviteStatus: 'PENDING' | 'ACCEPTED'
  inviteAcceptedAt: string | null
  // PBA-321 — agent fields
  takesStudentCalls: boolean
  schedulingUrl: string | null
  isAvailableForCalls: boolean
}

export interface CreateSubAdminPayload {
  firstName: string
  lastName: string
  email: string
  role?: 'ADMIN' | 'SUPER_ADMIN'
  permissions: string[]
  // PBA-321 — agent fields
  takesStudentCalls?: boolean
  schedulingUrl?: string | null
}

export interface UpdateSubAdminPayload {
  firstName?: string
  lastName?: string
  permissions?: string[]
  // PBA-321 — agent fields
  takesStudentCalls?: boolean
  schedulingUrl?: string | null
  isAvailableForCalls?: boolean
}

export interface SubAdminListParams {
  page?: number
  limit?: number
  q?: string
  isActive?: boolean | undefined
}

export interface SubAdminListResponse {
  subAdmins: SubAdmin[]
  total: number
  page: number
  limit: number
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const subAdminKeys = {
  all: ['admin', 'sub-admins'] as const,
  list: (params: object) => [...subAdminKeys.all, 'list', params] as const,
  detail: (id: string) => [...subAdminKeys.all, 'detail', id] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useSubAdmins(params: SubAdminListParams = {}) {
  const { page = 1, limit = 20, q, isActive } = params

  return useQuery({
    queryKey: subAdminKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      searchParams.set('page', String(page))
      searchParams.set('limit', String(limit))
      if (q) searchParams.set('q', q)
      if (isActive !== undefined) searchParams.set('isActive', String(isActive))

      const { data, error } = await apiFetch<SubAdminListResponse>(
        `/api/admin/sub-admins?${searchParams.toString()}`
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load sub-admins')
      }
      return data
    },
  })
}

export function useSubAdmin(id: string) {
  return useQuery({
    queryKey: subAdminKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await apiFetch<{ subAdmin: SubAdmin }>(
        `/api/admin/sub-admins/${id}`
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load sub-admin')
      }
      return data.subAdmin
    },
    enabled: Boolean(id),
  })
}

export function useCreateSubAdmin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateSubAdminPayload) => {
      const { data, error } = await apiFetch<{ subAdmin: SubAdmin }>(
        '/api/admin/sub-admins',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create sub-admin')
      }
      return data.subAdmin
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subAdminKeys.all })
    },
  })
}

export function useUpdateSubAdmin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateSubAdminPayload }) => {
      const { data, error } = await apiFetch<{ subAdmin: SubAdmin }>(
        `/api/admin/sub-admins/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update sub-admin')
      }
      return data.subAdmin
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: subAdminKeys.all })
      void queryClient.invalidateQueries({ queryKey: subAdminKeys.detail(id) })
    },
  })
}

export function useDeactivateSubAdmin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiFetch<null>(
        `/api/admin/sub-admins/${id}/deactivate`,
        { method: 'POST' }
      )
      if (error) {
        throw new Error(error.message ?? 'Failed to deactivate sub-admin')
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subAdminKeys.all })
    },
  })
}

export function useReactivateSubAdmin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiFetch<null>(
        `/api/admin/sub-admins/${id}/reactivate`,
        { method: 'POST' }
      )
      if (error) {
        throw new Error(error.message ?? 'Failed to reactivate sub-admin')
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subAdminKeys.all })
    },
  })
}

export function useReinviteSubAdmin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiFetch<{ subAdmin: SubAdmin }>(
        `/api/admin/sub-admins/${id}/reinvite`,
        { method: 'POST' }
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to re-send invitation')
      }
      return data.subAdmin
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subAdminKeys.all })
    },
  })
}
