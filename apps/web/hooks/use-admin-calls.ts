// PBA-330 — Admin calls React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CallStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'all'

export interface CallStudent {
  _id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
}

export interface AdminCall {
  _id: string
  studentId: CallStudent
  agentId: string
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  schedulingUrl: string
  bookedAt: string
  completedAt: string | null
  cancelledAt: string | null
}

export interface AdminCallsResponse {
  calls: AdminCall[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const adminCallKeys = {
  all: ['admin', 'calls'] as const,
  list: (params: object) => [...adminCallKeys.all, 'list', params] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAdminCalls(status: CallStatus = 'all', page = 1, limit = 20) {
  return useQuery({
    queryKey: adminCallKeys.list({ status, page, limit }),
    queryFn: async () => {
      const params = new URLSearchParams({
        status,
        page: String(page),
        limit: String(limit),
      })
      const { data, error } = await apiFetch<AdminCallsResponse>(
        `/api/admin/my-calls?${params.toString()}`,
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load calls')
      }
      return data
    },
  })
}

export function useCompleteCall() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (callId: string) => {
      const { data, error } = await apiFetch<{ call: AdminCall }>(
        `/api/admin/calls/${callId}/complete`,
        { method: 'POST' },
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to complete call')
      }
      return data.call
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminCallKeys.all })
    },
  })
}
