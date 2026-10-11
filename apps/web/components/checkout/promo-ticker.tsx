'use client'

import { Zap } from 'lucide-react'
import { useFlashPromo } from '@/hooks/use-flash-promo'
import { cn } from '@/lib/utils'

interface PromoTickerProps {
  className?: string
  /** Compact single-line variant for cards. */
  compact?: boolean
}

/** "50% OFF — ends in 01:59:59" countdown. Renders nothing when no promo is live. */
function PromoTicker({ className, compact }: PromoTickerProps) {
  const promo = useFlashPromo()
  if (!promo.active) return null

  return (
    <div
      data-slot="promo-ticker"
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg bg-[#ff8c5a]/10 text-[#d73027]',
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
        className,
      )}
    >
      <Zap className={cn('shrink-0 text-[#ff8c5a]', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      <span className="font-semibold">{promo.percentOff}% OFF</span>
      <span className="text-[#1a2744]/70">ends in</span>
      <span className="font-mono font-semibold tabular-nums text-[#1a2744]">{promo.countdown}</span>
    </div>
  )
}

export { PromoTicker }
