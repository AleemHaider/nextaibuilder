import { jsx as _jsx } from "react/jsx-runtime";
// FIR-34 — Auth state management (student login/logout)
import { createContext, useCallback, useContext, useEffect, useRef, useState, } from 'react';
const AuthContext = createContext(null);
const AUTH_BASE = '/api/auth';
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    // Keep a ref so callbacks can always read the latest token without stale closures
    const tokenRef = useRef(null);
    tokenRef.current = accessToken;
    const login = useCallback((token, authUser) => {
        setAccessToken(token);
        setUser(authUser);
    }, []);
    const logout = useCallback(async () => {
        try {
            await fetch(`${AUTH_BASE}/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        }
        catch {
            // Fire-and-forget — clear local state regardless
        }
        setAccessToken(null);
        setUser(null);
    }, []);
    const refreshToken = useCallback(async () => {
        try {
            const res = await fetch(`${AUTH_BASE}/refresh`, {
                method: 'POST',
                credentials: 'include', // sends nab_refresh httpOnly cookie
            });
            if (!res.ok)
                return false;
            const data = (await res.json());
            setAccessToken(data.accessToken);
            tokenRef.current = data.accessToken;
            return true;
        }
        catch {
            return false;
        }
    }, []);
    // On mount: silently try to restore session from the refresh cookie
    useEffect(() => {
        let cancelled = false;
        async function restore() {
            try {
                const refreshed = await refreshToken();
                if (!refreshed || cancelled) {
                    setIsLoading(false);
                    return;
                }
                // Hydrate the user object with the fresh token
                const meRes = await fetch(`${AUTH_BASE}/me`, {
                    headers: { Authorization: `Bearer ${tokenRef.current}` },
                    credentials: 'include',
                });
                if (meRes.ok && !cancelled) {
                    const userData = (await meRes.json());
                    setUser(userData);
                }
            }
            catch {
                // No valid session — that is fine, user stays logged out
            }
            finally {
                if (!cancelled)
                    setIsLoading(false);
            }
        }
        restore();
        return () => {
            cancelled = true;
        };
    }, [refreshToken]);
    const value = {
        user,
        accessToken,
        isLoading,
        isAuthenticated: user !== null && accessToken !== null,
        login,
        logout,
        refreshToken,
    };
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used inside <AuthProvider>');
    }
    return ctx;
}
