// PBA-329 — Hook for admin agent self-service settings
import { useMutation } from '@tanstack/react-query'
import { apiFetch, authStore } from '@/store/auth'

export interface AgentSettingsPayload {
  schedulingUrl?: string | null
  isAvailableForCalls?: boolean
}

export interface AgentSettingsResponse {
  agentSettings: {
    takesStudentCalls: boolean
    schedulingUrl: string | null
    isAvailableForCalls: boolean
  }
}

export function useUpdateAgentSettings() {
  return useMutation({
    mutationFn: async (payload: AgentSettingsPayload) => {
      const { data, error } = await apiFetch<AgentSettingsResponse>(
        '/api/admin/profile/agent-settings',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update agent settings')
      }
      return data.agentSettings
    },
    onSuccess: (agentSettings) => {
      // Optimistically update the auth store so the UI reflects changes immediately
      const current = authStore.getState()
      if (current.user && current.accessToken) {
        authStore.setAuth(current.accessToken, {
          ...current.user,
          schedulingUrl: agentSettings.schedulingUrl,
        })
      }
    },
  })
}
