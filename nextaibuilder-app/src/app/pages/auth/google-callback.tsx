// Google OAuth popup callback page
// Extracts id_token from URL fragment and posts it back to the opener, then closes.
import { useEffect } from 'react'

function GoogleCallbackPage() {
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const idToken = params.get('id_token')

    if (window.opener) {
      window.opener.postMessage(
        { type: 'google-oauth-callback', idToken: idToken ?? null },
        window.location.origin,
      )
    }
    window.close()
  }, [])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  )
}

export { GoogleCallbackPage }
