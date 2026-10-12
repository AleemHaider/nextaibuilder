'use client'

// Flash promo ("X% off for the next N hours") — reads the server-issued window
// (GET /api/v1/storefront/promo, which starts the clock via a signed session
// cookie) and ticks a countdown. The API enforces the same discount at
// checkout, so this hook is display-only.
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { storefrontApi, type FlashPromo } from '@/lib/api-client'

export interface FlashPromoState extends FlashPromo {
  remainingMs: number
  /** "HH:MM:SS" */
  countdown: string
  /** Applies the promo to a whole-dollar price. */
  discounted: (price: number) => number
}

function pad(n: number) { return String(n).padStart(2, '0') }

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function useFlashPromo(): FlashPromoState {
  const { data } = useQuery({
    queryKey: ['flash-promo'],
    queryFn: async () => {
      const { data, error } = await storefrontApi.getPromo()
      if (error) throw new Error(error.message ?? 'Failed to load promo')
      return data!
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!data?.expiresAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [data?.expiresAt])

  const expiresMs  = data?.expiresAt ? new Date(data.expiresAt).getTime() : 0
  const remainingMs = Math.max(0, expiresMs - now)
  const active = !!data?.active && remainingMs > 0
  const percentOff = data?.percentOff ?? 0

  return {
    active,
    percentOff,
    windowHours: data?.windowHours ?? 0,
    startedAt:   data?.startedAt ?? null,
    expiresAt:   data?.expiresAt ?? null,
    remainingMs,
    countdown:   formatCountdown(remainingMs),
    discounted:  (price: number) => (active ? Math.round(price * (100 - percentOff) / 100) : price),
  }
}
