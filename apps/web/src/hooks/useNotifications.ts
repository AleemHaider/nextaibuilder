// FIR-169 — TanStack Query hook for student notifications (polls every 30s)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationsResponse,
} from '../lib/api'

const QUERY_KEY = ['student', 'notifications']

export function useNotifications() {
  const queryClient = useQueryClient()

  const query = useQuery<NotificationsResponse, Error>({
    queryKey: QUERY_KEY,
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  const markOneMutation = useMutation<{ success: true }, Error, string>({
    mutationFn: markNotificationRead,
    onSuccess: (_data, id) => {
      queryClient.setQueryData<NotificationsResponse>(QUERY_KEY, (prev) => {
        if (!prev) return prev
        const updated = prev.notifications.map((n) =>
          n._id === id ? { ...n, isRead: true } : n,
        )
        const unreadCount = updated.filter((n) => !n.isRead).length
        return { notifications: updated, unreadCount }
      })
    },
  })

  const markAllMutation = useMutation<{ success: true }, Error, void>({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.setQueryData<NotificationsResponse>(QUERY_KEY, (prev) => {
        if (!prev) return prev
        return {
          notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        }
      })
    },
  })

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    markOneRead: markOneMutation.mutate,
    markAllRead: markAllMutation.mutate,
    isMarkingAll: markAllMutation.isPending,
  }
}
