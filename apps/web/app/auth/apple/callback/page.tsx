'use client'

// Apple OAuth redirect-mode fallback callback page.
// With usePopup: true the SDK resolves via JS promise and this page is never hit.
// This page handles the edge case where Apple falls back to redirect mode,
// preventing a 404 from the catch-all route.
import { useEffect } from 'react'

export default function Page() {
  useEffect(() => {
    if (window.opener) {
      // Opened as a popup — relay the error back to opener and close
      window.opener.postMessage(
        { type: 'apple-oauth-callback', error: 'redirect-mode-unsupported' },
        window.location.origin,
      )
      window.close()
    } else {
      // Full redirect fallback — send user back to login
      window.location.replace('/login')
    }
  }, [])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  )
}
