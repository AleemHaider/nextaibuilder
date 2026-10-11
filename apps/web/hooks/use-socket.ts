// PBA-147 — Socket.io client hook
import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { authStore } from '../store/auth'

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

let sharedSocket: Socket | null = null

export function getSocket(): Socket {
  if (!sharedSocket) {
    // `auth` as a callback is re-invoked on every (re)connection, so reconnects
    // after an access-token refresh send the CURRENT token. A static
    // `auth: { token }` captured the token once, so any reconnect after the
    // token expired authenticated with a dead token and the server rejected it
    // — silently killing realtime updates.
    sharedSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: authStore.getState().accessToken ?? undefined }),
      autoConnect: true,
    })
  }
  return sharedSocket
}

export function disconnectSocket() {
  sharedSocket?.disconnect()
  sharedSocket = null
}

export interface SubmissionUpdatedPayload {
  submissionId: string
  status: string
  mlFeedback?: string | null
  mlScore?: number | null
}

export interface ProgressResetPayload {
  userId: string
}

/**
 * Hook to subscribe to progress:reset events.
 * When admin resets a student's progress, the backend emits this event
 * so the student's browser can immediately invalidate its cache.
 */
export function useProgressResetSocket(
  userId: string | undefined,
  onReset: (payload: ProgressResetPayload) => void,
) {
  const callbackRef = useRef(onReset)

  useEffect(() => {
    callbackRef.current = onReset
  })

  useEffect(() => {
    if (!userId) return

    const socket = getSocket()

    function handleReset(payload: ProgressResetPayload) {
      callbackRef.current(payload)
    }

    socket.on('progress:reset', handleReset)

    return () => {
      socket.off('progress:reset', handleReset)
    }
  }, [userId])
}

/**
 * Hook to subscribe to submission:updated events for the current user.
 * Calls onUpdate when an event arrives.
 */
export function useSubmissionSocket(
  userId: string | undefined,
  onUpdate: (payload: SubmissionUpdatedPayload) => void,
) {
  const callbackRef = useRef(onUpdate)

  useEffect(() => {
    callbackRef.current = onUpdate
  })

  useEffect(() => {
    if (!userId) return

    const socket = getSocket()

    // Join the student's private room
    socket.emit('join', { userId })

    function handleUpdate(payload: SubmissionUpdatedPayload) {
      callbackRef.current(payload)
    }

    socket.on('submission:updated', handleUpdate)

    return () => {
      socket.off('submission:updated', handleUpdate)
    }
  }, [userId])
}
