// NAB-P0-1 — SaveStateIndicator chip shown next to the Save/Publish buttons
// while editing a course. Renders a screen-reader-friendly status region and
// ticks the "Saved Xm ago" label every 60s while sitting in `saved` state.

import { useEffect, useState } from 'react'
import { Loader2, Check, AlertTriangle } from 'lucide-react'
import type { AutosaveState } from '../../../hooks/useDebouncedAutosave'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../lib/utils'

/**
 * Formats a "Saved Xm ago" relative label. Uses Intl.RelativeTimeFormat when
 * available (wide browser support — we don't need to polyfill). We keep the
 * output in English because the rest of the admin is single-locale.
 */
function formatRelativeSaved(savedAt: number, now: number): string {
  const diffMs = Math.max(0, now - savedAt)
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 1) return 'Saved just now'
  if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function') {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'always', style: 'short' })
    return `Saved ${rtf.format(-diffMinutes, 'minute')}`
  }
  return `Saved ${diffMinutes}m ago`
}

export function SaveStateIndicator({
  state,
  savedAt,
  onRetry,
}: {
  state: AutosaveState
  savedAt: number | null
  onRetry: () => void
}) {
  // Tick every 60s so the "Saved Xm ago" label keeps itself fresh without
  // re-rendering the entire editor. The interval only runs while we're
  // sitting in the 'saved' state so idle pages don't burn timers.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (state !== 'saved') return
    const interval = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [state])

  if (state === 'idle') {
    // Render an empty aria-live region so screen readers are primed for the
    // first transition announcement without a layout jump.
    return <div aria-live="polite" className="sr-only" data-testid="save-state-indicator" />
  }

  const baseClass =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-[600] transition-colors'

  let content: React.ReactNode
  if (state === 'saving') {
    content = (
      <span
        className={cn(
          baseClass,
          'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-warm)]',
        )}
        data-state="saving"
      >
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        Saving…
      </span>
    )
  } else if (state === 'saved') {
    const label = savedAt ? formatRelativeSaved(savedAt, now) : 'Saved just now'
    content = (
      <span
        className={cn(
          baseClass,
          'bg-[var(--color-wise-mint)] text-[var(--color-wise-success)]',
        )}
        data-state="saved"
      >
        <Check size={12} aria-hidden="true" />
        {label}
      </span>
    )
  } else {
    content = (
      <span
        className={cn(
          baseClass,
          'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',
        )}
        data-state="error"
      >
        <AlertTriangle size={12} aria-hidden="true" />
        Save failed
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[12px]"
          onClick={onRetry}
        >
          Retry
        </Button>
      </span>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="save-state-indicator"
      className="flex items-center"
    >
      {content}
    </div>
  )
}
