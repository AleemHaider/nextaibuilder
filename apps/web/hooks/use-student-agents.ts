// PBA-331 — Student agent listing + booking hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentSummary {
  id: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  schedulingUrl: string | null
  avgRating: number | null
  reviewCount: number
}

export interface AgentReviewItem {
  id: string
  rating: number
  comment: string
  createdAt: string
  reviewer: { firstName: string; lastName: string }
}

export interface AgentDetail {
  id: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  schedulingUrl: string | null
  isAvailableForCalls: boolean
  avgRating: number | null
  reviewCount: number
}

export interface AgentsResponse {
  agents: AgentSummary[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface AgentDetailResponse {
  agent: AgentDetail
  reviews: AgentReviewItem[]
}

export interface ActiveCallResponse {
  call: {
    _id: string
    agentId: { _id: string; firstName: string; lastName: string; avatarUrl: string | null }
    schedulingUrl: string
    bookedAt: string
    status: 'ACTIVE'
  } | null
}

export interface BookCallPayload { agentId: string }
export interface BookCallResponse {
  call: { id: string; agentId: string; schedulingUrl: string; bookedAt: string; status: string }
}
export interface SubmitReviewPayload { rating: number; comment: string }
export interface SubmitReviewResponse {
  review: { id: string; rating: number; comment: string; createdAt: string }
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const studentAgentKeys = {
  all: ['student', 'agents'] as const,
  list: (params: object) => [...studentAgentKeys.all, 'list', params] as const,
  detail: (id: string) => [...studentAgentKeys.all, 'detail', id] as const,
  activeCall: ['student', 'calls', 'active'] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useStudentAgents(search: string, page: number, limit = 12) {
  return useQuery({
    queryKey: studentAgentKeys.list({ search, page, limit }),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set('search', search)
      const { data, error } = await apiFetch<AgentsResponse>(
        `/api/student/agents?${params.toString()}`,
      )
      if (error || !data) throw new Error(error?.message ?? 'Failed to load agents')
      return data
    },
  })
}

export function useStudentAgent(id: string) {
  return useQuery({
    queryKey: studentAgentKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await apiFetch<AgentDetailResponse>(`/api/student/agents/${id}`)
      if (error || !data) throw new Error(error?.message ?? 'Failed to load agent')
      return data
    },
    enabled: Boolean(id),
  })
}

export function useActiveCall() {
  return useQuery({
    queryKey: studentAgentKeys.activeCall,
    queryFn: async () => {
      const { data, error } = await apiFetch<ActiveCallResponse>('/api/student/calls/active')
      if (error || !data) throw new Error(error?.message ?? 'Failed to load active call')
      return data
    },
  })
}

export function useBookCall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BookCallPayload) => {
      const { data, error } = await apiFetch<BookCallResponse>('/api/student/calls', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (error || !data) throw Object.assign(new Error(error?.message ?? 'Failed to book call'), { apiError: error })
      return data.call
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studentAgentKeys.activeCall })
    },
  })
}

export function useSubmitCallReview(callId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SubmitReviewPayload) => {
      const { data, error } = await apiFetch<SubmitReviewResponse>(
        `/api/student/calls/${callId}/review`,
        { method: 'POST', body: JSON.stringify(payload) },
      )
      if (error || !data) throw Object.assign(new Error(error?.message ?? 'Failed to submit review'), { apiError: error })
      return data.review
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studentAgentKeys.all })
      void queryClient.invalidateQueries({ queryKey: studentAgentKeys.activeCall })
    },
  })
}
