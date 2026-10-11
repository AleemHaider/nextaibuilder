// PBA-315 — Student Profile React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { profileApi } from '@/lib/api-client'
import type { NotificationPreferences, ChangePasswordPayload, DeleteAccountPayload } from '@/lib/api-client'
import { authStore, logout } from '@/store/auth'

// ── Query keys ────────────────────────────────────────────────────────────────

export const studentProfileKeys = {
  all:     ['student', 'profile'] as const,
  profile: () => [...studentProfileKeys.all] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useStudentProfile() {
  return useQuery({
    queryKey: studentProfileKeys.profile(),
    queryFn: async () => {
      const { data, error } = await profileApi.getProfile()
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load profile')
      }
      return data
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { firstName: string; lastName: string }) => {
      const { data, error } = await profileApi.updateProfile(payload)
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update profile')
      }
      return data
    },
    onSuccess: (data) => {
      // Invalidate profile query
      void queryClient.invalidateQueries({ queryKey: studentProfileKeys.profile() })

      // Update auth store with new name
      const store = authStore.getState()
      if (store.user && store.accessToken) {
        authStore.setAuth(store.accessToken, {
          ...store.user,
          firstName: data.firstName,
          lastName:  data.lastName,
          avatarUrl: data.avatarUrl,
        })
      }
    },
  })
}

export function usePresignAvatar() {
  return useMutation({
    mutationFn: async (contentType: 'image/jpeg' | 'image/png' | 'image/webp') => {
      const { data, error } = await profileApi.presignAvatar(contentType)
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to get presigned URL')
      }
      return data
    },
  })
}

export function useUpdateAvatarKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (s3Key: string) => {
      const { data, error } = await profileApi.updateAvatarKey(s3Key)
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update avatar')
      }
      return data
    },
    onSuccess: (data) => {
      // Invalidate profile query
      void queryClient.invalidateQueries({ queryKey: studentProfileKeys.profile() })

      // Update auth store with new avatar URL
      const store = authStore.getState()
      if (store.user && store.accessToken) {
        authStore.setAuth(store.accessToken, {
          ...store.user,
          avatarUrl: data.avatarUrl,
        })
      }
    },
  })
}

export function useUpdateNotifications() {
  return useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      const { error } = await profileApi.updateNotifications(prefs)
      if (error) {
        throw new Error(error?.message ?? 'Failed to update notifications')
      }
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: ChangePasswordPayload) => {
      const { data, error } = await profileApi.changePassword(payload)
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to change password')
      }
      return data
    },
  })
}

export function useDeleteAccount() {
  const router = useRouter()

  return useMutation({
    mutationFn: async (payload: DeleteAccountPayload) => {
      const { data, error } = await profileApi.deleteAccount(payload)
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to delete account')
      }
      return data
    },
    onSuccess: async () => {
      await logout()
      void router.push('/login')
    },
  })
}
