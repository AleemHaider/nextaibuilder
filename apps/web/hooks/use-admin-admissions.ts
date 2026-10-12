// sdk.nextaibuilder.com — Admin admissions React Query hook
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/store/auth'

export type AdmissionTrack = '6-month' | '1-year'

export interface AdmissionApplicationItem {
  id: string
  fullName: string
  email: string
  phone: string
  // null on submissions from before the track field existed.
  track: AdmissionTrack | null
  message: string | null
  source: string
  createdAt: string
}

export interface AdmissionApplicationsResponse {
  applications: AdmissionApplicationItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const adminAdmissionKeys = {
  all: ['admin', 'admissions'] as const,
  list: (page: number, limit: number) => [...adminAdmissionKeys.all, 'list', { page, limit }] as const,
}

export function useAdminAdmissions(page = 1, limit = 20) {
  return useQuery({
    queryKey: adminAdmissionKeys.list(page, limit),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      const { data, error } = await apiFetch<AdmissionApplicationsResponse>(
        `/api/v1/admin/admissions?${params.toString()}`
      )
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to load admission applications')
      }
      return data
    },
  })
}
