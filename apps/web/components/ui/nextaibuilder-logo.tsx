'use client'

// The nextaibuilder brand mark — spark pixel-diamond + "NEXT" pill badge +
// "aibuilder" wordmark. Distinct from the Product Builder Academy course
// branding (see logo.tsx) — this is the site-level nextaibuilder identity,
// sourced from the canonical brand kit (logo-full-light/dark.svg).
import { cn } from '@/lib/utils'

interface NextAiBuilderMarkProps {
  size?: number
}

function NextAiBuilderMark({ size = 40 }: NextAiBuilderMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="nab-d" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a2744" />
          <stop offset="100%" stopColor="#4a90c4" />
        </linearGradient>
        <linearGradient id="nab-s" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7bb8e0" />
          <stop offset="100%" stopColor="#4a9ad4" />
        </linearGradient>
        <linearGradient id="nab-p" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a8d4f0" />
          <stop offset="100%" stopColor="#d4e8f7" />
        </linearGradient>
        <linearGradient id="nab-o" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8c5a" />
          <stop offset="50%" stopColor="#ff6347" />
          <stop offset="100%" stopColor="#d73027" />
        </linearGradient>
      </defs>
      <rect x="24" y="0" width="8" height="10" fill="url(#nab-d)" />
      <rect x="24" y="46" width="8" height="10" fill="url(#nab-d)" />
      <rect x="0" y="24" width="10" height="8" fill="url(#nab-d)" />
      <rect x="46" y="24" width="10" height="8" fill="url(#nab-d)" />
      <rect x="8" y="8" width="7" height="7" fill="url(#nab-s)" />
      <rect x="41" y="8" width="7" height="7" fill="url(#nab-s)" />
      <rect x="8" y="41" width="7" height="7" fill="url(#nab-s)" />
      <rect x="41" y="41" width="7" height="7" fill="url(#nab-s)" />
      <rect x="16" y="10" width="8" height="8" fill="url(#nab-s)" />
      <rect x="32" y="10" width="8" height="8" fill="url(#nab-s)" />
      <rect x="10" y="16" width="8" height="8" fill="url(#nab-s)" />
      <rect x="38" y="16" width="8" height="8" fill="url(#nab-s)" />
      <rect x="16" y="38" width="8" height="8" fill="url(#nab-s)" />
      <rect x="32" y="38" width="8" height="8" fill="url(#nab-s)" />
      <rect x="10" y="32" width="8" height="8" fill="url(#nab-s)" />
      <rect x="38" y="32" width="8" height="8" fill="url(#nab-s)" />
      <rect x="18" y="18" width="20" height="20" fill="url(#nab-p)" />
      <rect x="20" y="20" width="16" height="16" fill="url(#nab-s)" />
      <rect x="22" y="22" width="12" height="12" fill="url(#nab-d)" />
      <rect x="24" y="24" width="8" height="8" fill="url(#nab-o)" />
    </svg>
  )
}

interface NextAiBuilderLogoProps {
  variant?: 'full' | 'icon'
  size?: number
  onDark?: boolean
  className?: string
}

function NextAiBuilderLogo({ variant = 'full', size = 40, onDark = false, className }: NextAiBuilderLogoProps) {
  return (
    <div data-slot="nextaibuilder-logo" className={cn('flex items-center gap-2.5', className)}>
      <NextAiBuilderMark size={size} />
      {variant === 'full' && (
        <div className="flex flex-col leading-none gap-0.5">
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{
              backgroundColor: onDark ? 'rgba(74,154,212,0.20)' : '#e8f4fd',
              color: onDark ? '#a8d4f0' : '#4a9ad4',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: onDark ? '#ff8c5a' : '#1a2744' }}
            />
            Next
          </span>
          <span
            className="font-black leading-none tracking-tight"
            style={{
              fontSize: size * 0.68,
              color: onDark ? '#ffffff' : '#1a2744',
            }}
          >
            aibuilder
          </span>
        </div>
      )}
    </div>
  )
}

export { NextAiBuilderLogo, NextAiBuilderMark }
