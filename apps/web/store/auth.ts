// Auth store (in-memory, no localStorage)
// Access token lives only in memory — refresh token is httpOnly cookie managed by API.

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN'
  avatarUrl?: string | null
  /** PBA-233: permission checkpoint strings. SUPER_ADMIN always gets [] — role check handles bypass. */
  permissions: string[]
  /** PBA-255: whether 2FA is enabled for this admin account */
  twoFactorEnabled?: boolean
  /** PBA-289: invite status — only present for STUDENT role users */
  inviteStatus?: 'PENDING' | 'ACCEPTED' | 'REVOKED'
  /** PBA-329: support agent fields — only present for ADMIN/SUPER_ADMIN users */
  takesStudentCalls?: boolean
  schedulingUrl?: string | null
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  isLoading: boolean
}

type Listener = () => void

// Simple reactive store — no external state lib needed yet
const state: AuthState = {
  accessToken: null,
  user: null,
  isLoading: true, // true until initial refresh attempt completes
}

const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((l) => l())
}

export const authStore = {
  getState: () => ({ ...state }),

  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  setAuth(accessToken: string, user: AuthUser) {
    state.accessToken = accessToken
    state.user = user
    state.isLoading = false
    // Lightweight indicator for Next.js middleware (no secrets — cookie path is '/')
    if (typeof document !== 'undefined') {
      document.cookie = `nab_s=1; path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
    }
    notify()
  },

  clearAuth() {
    state.accessToken = null
    state.user = null
    state.isLoading = false
    // Clear the middleware indicator cookie
    if (typeof document !== 'undefined') {
      document.cookie = 'nab_s=; path=/; SameSite=Lax; Max-Age=0'
    }
    notify()
    // Purge per-user cached data + tear down the realtime socket so a
    // subsequent login on the same tab doesn't inherit the previous user's
    // React Query cache or receive their notifications. Dynamic imports avoid
    // an import cycle (use-socket imports this store) and keep this module free
    // of client-only deps. Fire-and-forget; client-only.
    if (typeof window !== 'undefined') {
      void import('../lib/query-client').then((m) => m.queryClient.clear()).catch(() => {})
      void import('../hooks/use-socket').then((m) => m.disconnectSocket()).catch(() => {})
    }
  },

  setLoading(loading: boolean) {
    state.isLoading = loading
    notify()
  },
}

// ── API helpers ────────────────────────────────────────────────────────────────

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').trim()

export interface ApiError {
  error: string
  message?: string
}

async function doFetch(path: string, options?: RequestInit, token?: string | null) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...((token ?? state.accessToken)
        ? { Authorization: `Bearer ${token ?? state.accessToken}` }
        : {}),
      ...options?.headers,
    },
  })
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    let res = await doFetch(path, options)

    // On 401, attempt a silent token refresh then retry once
    if (res.status === 401) {
      const refreshed = await refreshSession()
      if (refreshed) {
        res = await doFetch(path, options, state.accessToken)
      }
    }

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { data: null, error: body as ApiError }
    }

    return { data: body as T, error: null }
  } catch {
    return {
      data: null,
      error: { error: 'NETWORK_ERROR', message: 'Something went wrong. Please try again.' },
    }
  }
}

// ── Auth actions ───────────────────────────────────────────────────────────────

export async function logout() {
  await apiFetch('/api/auth/logout', { method: 'POST' })
  authStore.clearAuth()
}

// Single-flight guard: many queries (dashboard, notifications, profile, …)
// can 401 simultaneously and each calls refreshSession. Without dedup they all
// POST /refresh in parallel; with rotating refresh tokens every call but one
// fails and clears auth → the user is spuriously logged out mid-session (also
// happens across two tabs). Share one in-flight refresh instead.
let refreshInFlight: Promise<boolean> | null = null

export function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = doRefreshSession().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function doRefreshSession(): Promise<boolean> {
  try {
    const refreshRes = await doFetch('/api/auth/refresh', { method: 'POST' })

    // Only clear auth for explicit auth failures (401/403).
    // Rate-limit (429) or server errors (5xx) should not sign the user out —
    // the session is still valid, the request just couldn't complete right now.
    if (!refreshRes.ok) {
      if (refreshRes.status === 401 || refreshRes.status === 403) {
        authStore.clearAuth()
      } else {
        authStore.setLoading(false)
      }
      return false
    }

    const refreshBody = await refreshRes.json().catch(() => ({})) as { accessToken?: string }
    if (!refreshBody.accessToken) { authStore.clearAuth(); return false }

    const newToken = refreshBody.accessToken

    // Re-fetch user info with the fresh token
    const meRes = await doFetch('/api/auth/me', undefined, newToken)
    if (!meRes.ok) { authStore.clearAuth(); return false }
    const meBody = await meRes.json().catch(() => ({})) as { user?: AuthUser }

    if (meBody.user) {
      authStore.setAuth(newToken, { ...meBody.user, permissions: meBody.user.permissions ?? [] })
      return true
    }

    authStore.clearAuth()
    return false
  } catch {
    // Network failure — don't sign out, just stop the loading spinner
    authStore.setLoading(false)
    return false
  }
}

// ── OAuth actions ─────────────────────────────────────────────────────────────

export async function loginWithGoogle(idToken: string) {
  const { data, error } = await apiFetch<{
    accessToken: string
    user: AuthUser
  }>('/api/auth/oauth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })

  if (data) {
    // PBA-233: ensure permissions is always present
    authStore.setAuth(data.accessToken, { ...data.user, permissions: data.user.permissions ?? [] })
  }

  return { data, error }
}

export async function loginWithApple(idToken: string, user?: { firstName?: string; lastName?: string }) {
  const { data, error } = await apiFetch<{
    accessToken: string
    user: AuthUser
  }>('/api/auth/oauth/apple', {
    method: 'POST',
    body: JSON.stringify({ idToken, user }),
  })

  if (data) {
    // PBA-233: ensure permissions is always present
    authStore.setAuth(data.accessToken, { ...data.user, permissions: data.user.permissions ?? [] })
  }

  return { data, error }
}

// ── Admin auth actions (PBA-255) ──────────────────────────────────────────────

export async function loginWithEmailPassword(email: string, password: string) {
  const { data, error } = await apiFetch<
    | { twoFactorRequired: false; accessToken: string; user: AuthUser }
    | { twoFactorRequired: true; preAuthToken: string }
  >('/api/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (data && !data.twoFactorRequired) {
    // No 2FA — set auth immediately
    authStore.setAuth(data.accessToken, { ...data.user, permissions: data.user.permissions ?? [] })
  }

  return { data, error }
}

export async function verifyAdminOtp(preAuthToken: string, code: string) {
  const { data, error } = await apiFetch<{
    accessToken: string
    user: AuthUser
  }>('/api/auth/admin/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ preAuthToken, code }),
  })

  if (data) {
    authStore.setAuth(data.accessToken, { ...data.user, permissions: data.user.permissions ?? [] })
  }

  return { data, error }
}

export async function adminResendOtp(preAuthToken: string) {
  return apiFetch<{ message: string }>('/api/auth/admin/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ preAuthToken }),
  })
}

export async function adminForgotPassword(email: string) {
  return apiFetch<{ message: string }>('/api/auth/admin/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function adminResetPassword(token: string, password: string, confirmPassword: string) {
  return apiFetch<{ message: string }>('/api/auth/admin/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password, confirmPassword }),
  })
}

export async function adminSetPassword(token: string, password: string, confirmPassword: string) {
  return apiFetch<{ message: string }>('/api/auth/admin/set-password', {
    method: 'POST',
    body: JSON.stringify({ token, password, confirmPassword }),
  })
}

// ── Student auth actions (PBA-281, PBA-286) ───────────────────────────────────

export async function studentSetPassword(token: string, password: string, confirmPassword: string) {
  return apiFetch<{ message: string }>('/api/auth/student/set-password', {
    method: 'POST',
    body: JSON.stringify({ token, password, confirmPassword }),
  })
}

export async function studentLogin(email: string, password: string) {
  const { data, error } = await apiFetch<{
    accessToken: string
    user: AuthUser
  }>('/api/auth/student/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (data) {
    authStore.setAuth(data.accessToken, { ...data.user, permissions: data.user.permissions ?? [] })
  }

  return { data, error }
}

// ── Student invite activation (PBA-340) ───────────────────────────────────────

export async function studentAcceptInvite(inviteToken: string, idToken: string) {
  const { data, error } = await apiFetch<{
    accessToken: string
    user: AuthUser
  }>('/api/auth/oauth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken, inviteToken }),
  })

  if (data) {
    authStore.setAuth(data.accessToken, { ...data.user, permissions: data.user.permissions ?? [] })
  }

  return { data, error }
}
