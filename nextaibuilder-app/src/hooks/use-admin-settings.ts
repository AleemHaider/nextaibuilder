// PBA-132 — Admin Settings / Profile React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, authStore } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'ADMIN' | 'SUPER_ADMIN'
  avatarUrl: string | null
  joinedAt: string
  lastActiveAt: string | null
}

export interface UpdateProfilePayload {
  firstName: string
  lastName: string
}

export interface UpdateAvatarResponse {
  avatarUrl: string
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const adminSettingsKeys = {
  all: ['admin', 'settings'] as const,
  profile: () => [...adminSettingsKeys.all, 'profile'] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAdminProfile() {
  return useQuery({
    queryKey: adminSettingsKeys.profile(),
    queryFn: async () => {
      const { data, error } = await apiFetch<{ profile: Omit<AdminProfile, 'joinedAt'> & { createdAt: string } }>(
        '/api/admin/settings/profile'
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load profile')
      }
      // Normalise backend shape → frontend type
      const p = data.profile
      return {
        id:           p.id,
        email:        p.email,
        firstName:    p.firstName,
        lastName:     p.lastName,
        role:         p.role,
        avatarUrl:    p.avatarUrl,
        joinedAt:     p.createdAt,
        lastActiveAt: null,
      } satisfies AdminProfile
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      const { data, error } = await apiFetch<{ profile: Omit<AdminProfile, 'joinedAt'> & { createdAt: string } }>(
        '/api/admin/settings/profile',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update profile')
      }
      const p = data.profile
      return {
        id:           p.id,
        email:        p.email,
        firstName:    p.firstName,
        lastName:     p.lastName,
        role:         p.role,
        avatarUrl:    p.avatarUrl,
        joinedAt:     p.createdAt,
        lastActiveAt: null,
      } satisfies AdminProfile
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminSettingsKeys.profile() })
    },
  })
}

export function useUpdateAvatar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('avatar', file)

      // apiFetch adds Content-Type: application/json by default — bypass it for multipart
      const state = authStore.getState()
      const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').trim()

      const res = await fetch(`${API_BASE}/api/admin/settings/avatar`, {
        method: 'POST',
        credentials: 'include',
        headers: state.accessToken
          ? { Authorization: `Bearer ${state.accessToken}` }
          : {},
        body: formData,
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Failed to upload avatar')
      }

      return body as UpdateAvatarResponse
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: adminSettingsKeys.profile() })

      // Update auth store so sidebar/topbar avatar refreshes immediately
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
