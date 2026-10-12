import { useEffect, useRef, useState } from 'react'

interface UseCountUpOptions {
  target: number
  duration?: number
  start?: boolean
}

/**
 * Animates a number from 0 to `target` over `duration` ms using requestAnimationFrame.
 * Returns the current animated count. Only starts when `start` is true.
 * Respects prefers-reduced-motion — returns target immediately if motion is reduced.
 */
export function useCountUp({
  target,
  duration = 1500,
  start = false,
}: UseCountUpOptions): number {
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const [count, setCount] = useState<number>(prefersReducedMotion ? target : 0)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!start) return
    if (prefersReducedMotion) {
      const id = setTimeout(() => setCount(target), 0)
      return () => clearTimeout(id)
    }

    startTimeRef.current = null

    function step(timestamp: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [start, target, duration, prefersReducedMotion])

  return count
}
