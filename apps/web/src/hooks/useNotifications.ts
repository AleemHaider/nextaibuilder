// FIR-169 — TanStack Query hook for student notifications (polls every 30s)
// Sprint 4 Story 20 — added deleteNotification + deleteAllRead mutations so
// the NotificationsPage per-row trash icon and the "Delete all read" header
// CTA have a single place to live.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification as deleteNotificationApi,
  deleteAllNotifications as deleteAllNotificationsApi,
  type NotificationsResponse,
} from '../lib/api'
import { STALE_TIME } from '../lib/queryConfig'

const QUERY_KEY = ['student', 'notifications']

export function useNotifications() {
  const queryClient = useQueryClient()

  const query = useQuery<NotificationsResponse, Error>({
    queryKey: QUERY_KEY,
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
    staleTime: STALE_TIME.short,
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

  // ── Sprint 4 Story 20 — delete mutations ──────────────────────────────
  //
  // Both mutations optimistically update the cache rather than invalidating
  // it. The /notifications endpoint polls every 30s anyway, so a
  // background refetch will reconcile any drift; the optimistic path keeps
  // the row from hanging visible for the 500ms round-trip.
  const deleteOneMutation = useMutation<{ ok: true }, Error, string>({
    mutationFn: deleteNotificationApi,
    onSuccess: (_data, id) => {
      queryClient.setQueryData<NotificationsResponse>(QUERY_KEY, (prev) => {
        if (!prev) return prev
        const remaining = prev.notifications.filter((n) => n._id !== id)
        return {
          notifications: remaining,
          unreadCount:   remaining.filter((n) => !n.isRead).length,
        }
      })
    },
  })

  const deleteAllReadMutation = useMutation<{ ok: true; deletedCount: number }, Error, void>({
    mutationFn: () => deleteAllNotificationsApi('read'),
    onSuccess: () => {
      queryClient.setQueryData<NotificationsResponse>(QUERY_KEY, (prev) => {
        if (!prev) return prev
        const remaining = prev.notifications.filter((n) => !n.isRead)
        // unreadCount is unchanged because we only removed read rows
        return { notifications: remaining, unreadCount: prev.unreadCount }
      })
    },
  })

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount:   query.data?.unreadCount    ?? 0,
    isLoading:     query.isLoading,
    error:         query.error,
    markOneRead:   markOneMutation.mutate,
    markAllRead:   markAllMutation.mutate,
    isMarkingAll:  markAllMutation.isPending,
    // Sprint 4 Story 20 — delete mutations
    deleteNotification:  deleteOneMutation.mutateAsync,
    isDeletingOne:       deleteOneMutation.isPending,
    deleteAllRead:       deleteAllReadMutation.mutateAsync,
    isDeletingAllRead:   deleteAllReadMutation.isPending,
  }
}
