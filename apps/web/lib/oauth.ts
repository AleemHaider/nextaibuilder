// OAuth helpers for Google and Apple sign-in

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')
const APPLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI ?? `${APP_URL}/auth/apple/callback`

// ── Google Identity Services ────────────────────────────────────────────────

let googleScriptLoaded = false

export async function loadGoogleIdentity() {
  if (!googleScriptLoaded) {
    await new Promise<void>((resolve, reject) => {
      if (document.getElementById('google-gsi')) {
        googleScriptLoaded = true
        resolve()
        return
      }
      const script = document.createElement('script')
      script.id = 'google-gsi'
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => { googleScriptLoaded = true; resolve() }
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
      document.head.appendChild(script)
    })
  }

  return {
    requestIdToken(): Promise<string | null> {
      return new Promise((resolve) => {
        const google = (window as unknown as { google: { accounts: { id: { initialize: (config: unknown) => void; prompt: (callback?: (notification: { isNotDisplayed: () => boolean }) => void) => void } } } }).google

        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential: string }) => {
            resolve(response.credential)
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })

        google.accounts.id.prompt((notification: { isNotDisplayed: () => boolean }) => {
          if (notification.isNotDisplayed()) {
            // Fall back to popup if One Tap is blocked
            openGooglePopup(resolve)
          }
        })
      })
    },
  }
}

/**
 * Request a Google ID token via popup only, forcing account selection.
 * Use this for flows where One Tap must NOT appear (e.g. invite activation).
 * PBA-339 / PBA-342
 */
export async function requestGoogleIdTokenViaPopup(): Promise<string | null> {
  await loadGoogleIdentity()
  return new Promise((resolve) => {
    openGooglePopup(resolve)
  })
}

function openGooglePopup(resolve: (token: string | null) => void) {
  const width = 500
  const height = 600
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${APP_URL}/auth/google/callback`,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: crypto.randomUUID(),
  })

  const popup = window.open(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    'google-signin',
    `width=${width},height=${height},left=${left},top=${top},popup=1`,
  )

  // Listen for the callback
  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== APP_URL) return
    if (event.data?.type === 'google-oauth-callback') {
      window.removeEventListener('message', handleMessage)
      resolve(event.data.idToken ?? null)
    }
  }
  window.addEventListener('message', handleMessage)

  // Clean up if popup is closed without completing
  const checkClosed = setInterval(() => {
    if (popup?.closed) {
      clearInterval(checkClosed)
      window.removeEventListener('message', handleMessage)
      resolve(null)
    }
  }, 500)
}

// ── Apple Sign-In ───────────────────────────────────────────────────────────

export async function requestAppleSignIn(): Promise<{ idToken: string; user?: { firstName?: string; lastName?: string } } | null> {
  // Load Apple JS SDK if not loaded
  if (!document.getElementById('apple-signin-sdk')) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.id = 'apple-signin-sdk'
      script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Apple Sign-In SDK'))
      document.head.appendChild(script)
    })
  }

  const AppleID = (window as unknown as { AppleID: { auth: { init: (config: unknown) => void; signIn: () => Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string } } }> } } }).AppleID

  AppleID.auth.init({
    clientId: APPLE_CLIENT_ID,
    scope: 'name email',
    redirectURI: APPLE_REDIRECT_URI,
    usePopup: true,
  })

  try {
    const response = await AppleID.auth.signIn()
    return {
      idToken: response.authorization.id_token,
      user: response.user?.name
        ? { firstName: response.user.name.firstName, lastName: response.user.name.lastName }
        : undefined,
    }
  } catch {
    // User cancelled or error
    return null
  }
}
