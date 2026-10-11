// PBA-132 — Admin Messages / Broadcast React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MessageRecipientType = 'COHORT' | 'INDIVIDUAL'
export type MessageStatus = 'SENT' | 'FAILED' | 'PENDING'

export interface BroadcastMessagePayload {
  recipientType: MessageRecipientType
  /** cohortId when recipientType === 'COHORT' */
  cohortId?: string
  /** email when recipientType === 'INDIVIDUAL' */
  recipientEmail?: string
  subject: string
  body: string
}

export interface MessageHistoryItem {
  id: string
  recipientType: MessageRecipientType
  recipientLabel: string // cohort name or student email
  subject: string
  status: MessageStatus
  sentAt: string
  failureReason?: string | null
}

export interface MessageHistoryResponse {
  messages: MessageHistoryItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const adminMessageKeys = {
  all: ['admin', 'messages'] as const,
  history: (page: number, limit: number) =>
    [...adminMessageKeys.all, 'history', { page, limit }] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useMessageHistory(page = 1, limit = 20) {
  return useQuery({
    queryKey: adminMessageKeys.history(page, limit),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      const { data, error } = await apiFetch<MessageHistoryResponse>(
        `/api/admin/messages/history?${params.toString()}`
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load message history')
      }
      return data
    },
  })
}

export function useBroadcastMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: BroadcastMessagePayload) => {
      const { data, error } = await apiFetch<{ messageId: string; status: MessageStatus }>(
        '/api/admin/messages/broadcast',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to send message')
      }
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminMessageKeys.all })
    },
  })
}
