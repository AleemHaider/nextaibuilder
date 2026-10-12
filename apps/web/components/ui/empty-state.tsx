'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Button } from './button'

const emptyStateVariants = cva(
  'flex flex-col items-center text-center justify-center rounded-xl border border-border bg-card px-8',
  {
    variants: {
      size: {
        sm:      'py-10 min-h-[200px]',
        default: 'py-12 min-h-[280px]',
        lg:      'py-16 min-h-[360px]',
      },
    },
    defaultVariants: { size: 'default' },
  }
)

interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
  variant?: 'default' | 'outline' | 'ghost'
}

interface EmptyStateProps extends VariantProps<typeof emptyStateVariants> {
  illustration?: React.ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  className?: string
}

function EmptyState({
  illustration,
  title,
  description,
  action,
  secondaryAction,
  size,
  className,
}: EmptyStateProps) {
  return (
    <div data-slot="empty-state" className={cn(emptyStateVariants({ size }), className)}>
      {illustration && (
        <div className="mb-5 text-muted-foreground">
          {illustration}
        </div>
      )}
      <h3 className="text-lg font-medium text-brand-navy mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mb-5">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {action && (
            <Button variant={action.variant ?? 'default'} size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant={secondaryAction.variant ?? 'outline'} size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/* ---- Preset Illustrations (inline SVG, line-art style with brand accents) ---- */

function NoStepsIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="24" width="56" height="8" rx="4" fill="#e9ebef"/>
      <rect x="12" y="38" width="40" height="8" rx="4" fill="#e9ebef"/>
      <rect x="12" y="52" width="48" height="8" rx="4" fill="#e9ebef"/>
      <circle cx="60" cy="20" r="12" fill="#f3f3f5" stroke="#ececf0" strokeWidth="1.5"/>
      <path d="M56 20h8M60 16v8" stroke="#cbced4" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function NoStudentsIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="28" r="14" fill="#f3f3f5" stroke="#ececf0" strokeWidth="1.5"/>
      <circle cx="40" cy="28" r="7" fill="#e9ebef"/>
      <path d="M16 64c0-13.255 10.745-24 24-24s24 10.745 24 24" stroke="#ececf0" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <circle cx="60" cy="18" r="8" fill="#fff7f3" stroke="#ff8c5a" strokeWidth="1.5"/>
      <path d="M57 18h6M60 15v6" stroke="#ff8c5a" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function NoReviewsIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="14" width="52" height="52" rx="8" fill="#f3f3f5" stroke="#ececf0" strokeWidth="1.5"/>
      <path d="M26 36l8 8 20-20" stroke="#d4e8f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="58" cy="22" r="8" fill="#fff7f3" stroke="#ff8c5a" strokeWidth="1.5"/>
      <path d="M58 19v6M55 22h6" stroke="#ff8c5a" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function NoCohortIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="18" width="28" height="44" rx="6" fill="#f3f3f5" stroke="#ececf0" strokeWidth="1.5"/>
      <rect x="42" y="28" width="28" height="34" rx="6" fill="#f3f3f5" stroke="#ececf0" strokeWidth="1.5"/>
      <rect x="14" y="26" width="18" height="4" rx="2" fill="#e9ebef"/>
      <rect x="14" y="36" width="14" height="4" rx="2" fill="#e9ebef"/>
      <rect x="46" y="36" width="18" height="4" rx="2" fill="#e9ebef"/>
      <circle cx="58" cy="20" r="8" fill="#fff0f0" stroke="#d4183d" strokeWidth="1.5"/>
      <path d="M55.5 17.5l5 5M60.5 17.5l-5 5" stroke="#d4183d" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function NoMessagesIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="20" width="50" height="36" rx="8" fill="#f3f3f5" stroke="#ececf0" strokeWidth="1.5"/>
      <path d="M10 42l20-8 6 6 6-6 18 8" stroke="#e9ebef" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <path d="M60 48l8 8" stroke="#cbced4" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="24" y="30" width="22" height="4" rx="2" fill="#e9ebef"/>
    </svg>
  )
}

function NoResultsIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="36" cy="36" r="22" fill="#f3f3f5" stroke="#ececf0" strokeWidth="1.5"/>
      <path d="M52 52l14 14" stroke="#ececf0" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M29 29l14 14M43 29L29 43" stroke="#cbced4" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export {
  EmptyState,
  NoStepsIllustration,
  NoStudentsIllustration,
  NoReviewsIllustration,
  NoCohortIllustration,
  NoMessagesIllustration,
  NoResultsIllustration,
}
