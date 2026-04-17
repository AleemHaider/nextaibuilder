// FIR-34 — Auth state management (student login/logout)
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN'
  avatarUrl?: string
}

interface AuthContextValue {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => Promise<void>
  refreshToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const AUTH_BASE = '/api/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Keep a ref so callbacks can always read the latest token without stale closures
  const tokenRef = useRef<string | null>(null)
  tokenRef.current = accessToken

  const login = useCallback((token: string, authUser: AuthUser) => {
    setAccessToken(token)
    setUser(authUser)
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Fire-and-forget — clear local state regardless
    }
    setAccessToken(null)
    setUser(null)
  }, [])

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${AUTH_BASE}/refresh`, {
        method: 'POST',
        credentials: 'include', // sends nab_refresh httpOnly cookie
      })
      if (!res.ok) return false

      const data = (await res.json()) as { accessToken: string }
      setAccessToken(data.accessToken)
      tokenRef.current = data.accessToken
      return true
    } catch {
      return false
    }
  }, [])

  // On mount: silently try to restore session from the refresh cookie
  useEffect(() => {
    let cancelled = false

    async function restore() {
      try {
        const refreshed = await refreshToken()
        if (!refreshed || cancelled) {
          setIsLoading(false)
          return
        }

        // Hydrate the user object with the fresh token
        const meRes = await fetch(`${AUTH_BASE}/me`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          credentials: 'include',
        })

        if (meRes.ok && !cancelled) {
          const userData = (await meRes.json()) as AuthUser
          setUser(userData)
        }
      } catch {
        // No valid session — that is fine, user stays logged out
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    restore()
    return () => {
      cancelled = true
    }
  }, [refreshToken])

  const value: AuthContextValue = {
    user,
    accessToken,
    isLoading,
    isAuthenticated: user !== null && accessToken !== null,
    login,
    logout,
    refreshToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
