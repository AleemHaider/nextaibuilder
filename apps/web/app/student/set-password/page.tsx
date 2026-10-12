'use client'

// Legacy URL: /student/set-password?token=... → now /student/accept-invite?token=...
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function Redirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const qs = searchParams.toString()
    router.replace(`/student/accept-invite${qs ? `?${qs}` : ''}`)
  }, [router, searchParams])

  return null
}

export default function SetPasswordRedirectPage() {
  return <Suspense><Redirect /></Suspense>
}
