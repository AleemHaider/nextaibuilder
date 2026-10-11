import { useEffect, useState } from 'react'

/**
 * Returns the current window.scrollY value, updated on scroll.
 * Uses a passive event listener and cleans up on unmount.
 */
export function useScrollY(): number {
  const [scrollY, setScrollY] = useState<number>(
    typeof window !== 'undefined' ? window.scrollY : 0
  )

  useEffect(() => {
    function handleScroll() {
      setScrollY(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return scrollY
}
