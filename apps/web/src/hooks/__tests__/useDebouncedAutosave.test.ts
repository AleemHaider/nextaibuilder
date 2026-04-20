// NAB-P0-1 — Tests for the autosave hook.
//
// We use fake timers throughout so debounce timing is deterministic. For the
// "save serialises" test we deliberately resolve the first save *after*
// queuing a second change so the follow-up chaining path is exercised.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebouncedAutosave } from '../useDebouncedAutosave'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useDebouncedAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits delayMs before calling save and does not fire on initial render', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ value }: { value: string }) =>
        useDebouncedAutosave(value, save, 800),
      { initialProps: { value: 'a' } },
    )
    // Initial render must never fire a save — only edits do.
    expect(save).not.toHaveBeenCalled()

    rerender({ value: 'ab' })

    // Still nothing before the debounce window elapses.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(799)
    })
    expect(save).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('ab')
  })

  it('collapses rapid changes into a single save with the latest value', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ value }: { value: string }) =>
        useDebouncedAutosave(value, save, 800),
      { initialProps: { value: 'a' } },
    )

    rerender({ value: 'ab' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    rerender({ value: 'abc' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    rerender({ value: 'abcd' })

    // Full debounce window from the last change must elapse.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('abcd')
  })

  it('serialises concurrent saves: second change queues behind the in-flight first', async () => {
    const firstSave = deferred<void>()
    const save = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => Promise.resolve())

    const { rerender } = renderHook(
      ({ value }: { value: string }) =>
        useDebouncedAutosave(value, save, 800),
      { initialProps: { value: 'a' } },
    )

    // Trigger the first save.
    rerender({ value: 'ab' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenNthCalledWith(1, 'ab')

    // While the first save is in flight, queue more edits — none should fire
    // a parallel network call.
    rerender({ value: 'abc' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(save).toHaveBeenCalledTimes(1)

    rerender({ value: 'abcd' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(save).toHaveBeenCalledTimes(1)

    // Resolve the first save — the queued follow-up should then fire with
    // the *latest* snapshot, not any intermediate one.
    await act(async () => {
      firstSave.resolve()
      // Allow microtasks + setState flushes to settle.
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenNthCalledWith(2, 'abcd')
  })

  it('transitions idle → saving → saved on success', async () => {
    const saveDeferred = deferred<void>()
    const save = vi.fn().mockImplementation(() => saveDeferred.promise)

    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useDebouncedAutosave(value, save, 800),
      { initialProps: { value: 'a' } },
    )

    expect(result.current.state).toBe('idle')

    rerender({ value: 'ab' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(result.current.state).toBe('saving')
    expect(result.current.savedAt).toBeNull()

    await act(async () => {
      saveDeferred.resolve()
      await Promise.resolve()
    })
    expect(result.current.state).toBe('saved')
    expect(result.current.savedAt).toBeTypeOf('number')
  })

  it('transitions to error when save rejects and exposes the error', async () => {
    const err = new Error('network down')
    const save = vi.fn().mockRejectedValue(err)

    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useDebouncedAutosave(value, save, 800),
      { initialProps: { value: 'a' } },
    )

    rerender({ value: 'ab' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
      // Flush the rejected promise chain.
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toBe(err)
  })

  it('retry() re-fires the latest snapshot after a failed save', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)

    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useDebouncedAutosave(value, save, 800),
      { initialProps: { value: 'a' } },
    )

    rerender({ value: 'ab' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.state).toBe('error')

    // User keeps typing in the meantime — retry should send the latest.
    rerender({ value: 'abcd' })
    // Do NOT advance timers past 800 — we want the pending debounce to still
    // be alive so retry() has to cancel it, proving we don't double-fire.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    await act(async () => {
      result.current.retry()
      await Promise.resolve()
    })

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenNthCalledWith(2, 'abcd')
    expect(result.current.state).toBe('saved')
  })

  it('flush() resolves immediately when nothing is pending or in flight', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(
      ({ value }: { value: string }) =>
        useDebouncedAutosave(value, save, 800),
      { initialProps: { value: 'a' } },
    )

    await act(async () => {
      await result.current.flush()
    })
    expect(save).not.toHaveBeenCalled()
  })

  it('flush() awaits the in-flight save and cancels any pending debounce', async () => {
    const firstSave = deferred<void>()
    const save = vi.fn().mockImplementationOnce(() => firstSave.promise)

    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useDebouncedAutosave(value, save, 800),
      { initialProps: { value: 'a' } },
    )

    // Start a save, then land another edit to arm the debounce timer again.
    rerender({ value: 'ab' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(save).toHaveBeenCalledTimes(1)

    // Edit again — this arms a new debounce window mid-flight.
    rerender({ value: 'abc' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    // flush() should (a) cancel the pending debounce and (b) await the
    // in-flight save. Kick off flush() inside a single act() block, assert
    // it's still pending before resolving the first save, then resolve and
    // await.
    let flushResolved = false
    // Start flush() inside a running act() scope so internal setState calls
    // are captured. We do *not* await it yet — we want to resolve the
    // in-flight save first and observe ordering.
    let flushPromise!: Promise<void>
    await act(async () => {
      flushPromise = result.current.flush().then(() => {
        flushResolved = true
      })
      // Give microtasks a chance to flush — if flush() were synchronously
      // "done" it would have flipped flushResolved already.
      await Promise.resolve()
    })
    expect(flushResolved).toBe(false)

    await act(async () => {
      firstSave.resolve()
      await flushPromise
    })
    expect(flushResolved).toBe(true)

    // Even if we now advance past the debounce window, no new save fires —
    // flush() cancelled the pending debounce. The 'abc' edit only armed the
    // debounce timer (never reached runSave while in-flight), so no
    // follow-up was queued via pendingFollowupRef.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(save).toHaveBeenCalledTimes(1)
  })
})
