// PBA-128 — Achievement hooks: badges + certificate
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../store/auth'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Badge {
  id: string
  name: string
  description: string
  iconUrl: string | null
  triggerCriteria: string
  earned: boolean
  earnedAt: string | null
}

export interface BadgesResponse {
  badges: Badge[]
}

export interface Certificate {
  id: string
  publicToken: string
  issuedAt: string
  studentName: string
  cohortName: string
}

export interface CertificateResponse {
  certificate: Certificate | null
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useStudentBadges() {
  return useQuery({
    queryKey: ['student-badges'],
    queryFn: async () => {
      const { data, error } = await apiFetch<BadgesResponse>('/api/student/badges')
      if (error) throw new Error(error.message ?? 'Failed to load badges')
      return data!
    },
  })
}

export function useStudentCertificate() {
  return useQuery({
    queryKey: ['student-certificate'],
    queryFn: async () => {
      const { data, error } = await apiFetch<CertificateResponse>('/api/student/certificate')
      if (error) throw new Error(error.message ?? 'Failed to load certificate')
      return data!
    },
  })
}
