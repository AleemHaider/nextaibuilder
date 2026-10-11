// PBA-142 — useAuth hook: subscribes to auth store
import { useState, useEffect } from 'react'
import { authStore, refreshSession } from '@/store/auth'

export function useAuth() {
  const [state, setState] = useState(authStore.getState())

  useEffect(() => {
    const unsub = authStore.subscribe(() => setState(authStore.getState()))
    return () => { unsub() }
  }, [])

  return state
}

// Attempt to restore session from httpOnly refresh cookie on app boot
let refreshAttempted = false

export function useInitAuth() {
  useEffect(() => {
    if (refreshAttempted) return
    refreshAttempted = true
    void refreshSession()
  }, [])
}
