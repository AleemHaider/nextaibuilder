// NAB-P0-1 — Autosave hook backing the Course Builder Overview tab.
//
// Given a source `value` and an async `save(value)` callback, this hook:
//   * debounces value changes by `delayMs` (default 800ms),
//   * skips the *initial* render so merely mounting never fires a save,
//   * serialises saves — if a new change arrives while a save is in flight
//     it waits for the in-flight promise to settle before firing the next
//     save with the *latest* snapshot (collapsing all intermediate ones),
//   * exposes a state machine (idle -> saving -> saved | error) consumed by
//     <SaveStateIndicator>,
//   * exposes `flush()` so the manual Save button can await any pending
//     debounced save before firing its own mutation, avoiding a race where
//     the autosave PATCH lands *after* the manual save's request started.
//
// State transitions
// ─────────────────
//
//            enqueue()          save() resolves
//     idle ─────────────► saving ─────────────► saved
//       ▲                   │
//       │                   │ save() rejects
//       │                   ▼
//       └──── retry() ◄── error
//
// Notes on the "serialise concurrent saves" guarantee: when a change lands
// while a save is in flight, we do NOT cancel or await a second parallel
// request. We queue it — the in-flight promise resolves, then we fire a
// fresh save with the *most recent* snapshot. Users who type through a save
// window see exactly two network calls (one for the first keystroke batch,
// one for the latest state) instead of N.
import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface UseDebouncedAutosaveResult {
  state: AutosaveState
  savedAt: number | null
  error: Error | null
  retry: () => void
  flush: () => Promise<void>
}

export function useDebouncedAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  delayMs = 800,
): UseDebouncedAutosaveResult {
  const [state, setState] = useState<AutosaveState>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Keep the latest `value` + `save` in refs so the debounce callback doesn't
  // need to be torn down on every change (avoids re-creating timers).
  const valueRef = useRef<T>(value)
  const saveRef = useRef(save)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)
  // When a new change lands mid-flight, we set this flag instead of firing a
  // second request. Once the in-flight save resolves, we kick off a fresh
  // save with the *current* valueRef snapshot.
  const pendingFollowupRef = useRef(false)
  // Skip the save on initial mount — we only want to autosave user edits.
  const didMountRef = useRef(false)
  // Guard against state updates after unmount (tests + HMR).
  const mountedRef = useRef(true)

  useEffect(() => {
    saveRef.current = save
  }, [save])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  // Mirror the latest state in a ref so the save closure can branch on it
  // without being recreated each render (which would reset the debounce
  // timer mid-typing).
  const stateRef = useRef<AutosaveState>(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Run the save with the latest snapshot. Handles serialisation — if a save
  // is already in flight, we queue this request via pendingFollowupRef instead
  // of racing a second network call.
  const runSave = useCallback(() => {
    if (inFlightRef.current) {
      pendingFollowupRef.current = true
      return
    }
    if (mountedRef.current) {
      setState('saving')
      stateRef.current = 'saving'
      setError(null)
    }
    const snapshot = valueRef.current
    const promise = (async () => {
      try {
        await saveRef.current(snapshot)
        if (mountedRef.current) {
          setState('saved')
          stateRef.current = 'saved'
          setSavedAt(Date.now())
          setError(null)
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        if (mountedRef.current) {
          setState('error')
          stateRef.current = 'error'
          setError(e)
        }
      } finally {
        inFlightRef.current = null
        // If more changes landed while we were saving, fire once more with
        // the freshest snapshot. We only chain when the previous save
        // succeeded — an error state holds until `retry()` is called so the
        // user can see what went wrong rather than silently retrying.
        if (
          pendingFollowupRef.current &&
          mountedRef.current &&
          stateRef.current !== 'error'
        ) {
          pendingFollowupRef.current = false
          // Use a microtask so React flushes the previous state update first.
          queueMicrotask(() => {
            if (mountedRef.current) runSave()
          })
        }
      }
    })()
    inFlightRef.current = promise
  }, [])

  // Debounce on value changes. We intentionally depend only on `value` (and
  // `delayMs`) — the `runSave` callback is stable enough via refs that we
  // don't want to reset the timer on every render.
  useEffect(() => {
    valueRef.current = value

    // Skip initial render — mounting with a hydrated value should not fire a
    // save. Subsequent renders (real edits) do.
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      runSave()
    }, delayMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runSave is
    // recreated when `state` changes; we intentionally do not want that to
    // reset the debounce timer mid-typing.
  }, [value, delayMs])

  const retry = useCallback(() => {
    // Re-fire the latest snapshot immediately. `runSave` clears the error
    // state itself before firing.
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    runSave()
  }, [runSave])

  const flush = useCallback(async () => {
    // Cancel any pending debounce — the caller is about to save manually, so
    // letting the debounced save race the manual one would double-fire.
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    // Await any in-flight save so the caller knows the server is settled.
    if (inFlightRef.current) {
      try {
        await inFlightRef.current
      } catch {
        // Swallow — the error state has already been set by runSave. The
        // manual Save button treats flush() as advisory and will fire its
        // own request regardless.
      }
    }
  }, [])

  return { state, savedAt, error, retry, flush }
}
