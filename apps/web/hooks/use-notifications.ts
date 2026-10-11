// PBA-383 — React Query hooks for student notification inbox
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi, type NotificationsResponse } from '@/lib/api-client'

// ── Query keys ────────────────────────────────────────────────────────────────

export const notificationKeys = {
  all:  ['student', 'notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useNotifications(options?: { refetchInterval?: number }) {
  return useQuery<NotificationsResponse>({
    queryKey: notificationKeys.list(),
    queryFn: async () => {
      const { data, error } = await notificationsApi.getNotifications()
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load notifications')
      }
      return data
    },
    refetchInterval: options?.refetchInterval,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useDeleteNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.deleteNotification(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
