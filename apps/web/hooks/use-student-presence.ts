// PBA-398 — Real-time student online/offline presence hook (admin-only)
import { useState, useEffect, useCallback } from 'react'
import { getSocket } from './use-socket'
import { authStore } from '../store/auth'

export interface PresenceSnapshotPayload {
  onlineUserIds: string[]
}

export interface PresenceUpdatePayload {
  userId: string
  online: boolean
}

/**
 * Hook for admin users to track real-time student online/offline presence.
 *
 * Listens for:
 *   - `presence:snapshot` — initial full set of online student IDs on connect
 *   - `presence:update`   — incremental add/remove when a student connects/disconnects
 *
 * Only activates when the current authenticated user has an admin role.
 * Uses the shared socket connection from `use-socket.ts` — no new connection is made.
 */
export function useStudentPresence() {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const { user } = authStore.getState()

    // Only admins receive presence events — skip entirely for students
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return
    }

    const socket = getSocket()

    function handleSnapshot(payload: PresenceSnapshotPayload) {
      setOnlineIds(new Set(payload.onlineUserIds))
    }

    function handleUpdate(payload: PresenceUpdatePayload) {
      setOnlineIds((prev) => {
        const next = new Set(prev)
        if (payload.online) {
          next.add(payload.userId)
        } else {
          next.delete(payload.userId)
        }
        return next
      })
    }

    socket.on('presence:snapshot', handleSnapshot)
    socket.on('presence:update', handleUpdate)

    return () => {
      socket.off('presence:snapshot', handleSnapshot)
      socket.off('presence:update', handleUpdate)
    }
  }, [])

  const isOnline = useCallback(
    (userId: string): boolean => onlineIds.has(userId),
    [onlineIds],
  )

  return { isOnline, onlineIds }
}
