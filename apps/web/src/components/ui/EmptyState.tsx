// Sprint 1 Story 5 — Canonical <EmptyState> primitive.
//
// NotificationsPage, TransactionLedgerPage, StudentListPage, CertificatePage,
// and ManualPaymentsPage each ship their own one-off empty placeholder; some
// are just a grey "No data" string, others are full card layouts. This
// primitive is the single shape every future empty-state pass adopts.
//
// We depend on Story 2's <Button> for the CTA when it exists — the import
// path is static so tree-shaking stays straightforward, and the fallback
// inline styles live alongside in case Button ships without a `primary`
// variant. Current Button already exposes `variant='primary'`, so the happy
// path always wins; the fallback is defensive.
import type { ReactNode } from 'react'
import { Inbox, type LucideIcon } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

export interface EmptyStateAction {
  label: string
  onClick?: () => void
  /** When provided, the action renders as an anchor instead of a button. */
  href?: string
}

export interface EmptyStateProps {
  /** Icon shown inside the mint chip. Defaults to `Inbox`. */
  icon?: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  className?: string
  /** Optional extra content rendered below the action. */
  children?: ReactNode
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        'flex flex-col items-center text-center gap-4 py-12 px-6',
        className,
      )}
    >
      {/* Icon chip — mint surface with dark-green glyph, matches Story 1. */}
      <div
        data-testid="empty-state-icon-chip"
        className={cn(
          'h-14 w-14 rounded-2xl flex items-center justify-center',
          'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
        )}
      >
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>

      <h3
        className={cn(
          'text-[20px] font-black tracking-[-0.3px]',
          'text-[var(--color-wise-text)]',
        )}
      >
        {title}
      </h3>

      {description ? (
        <p
          className={cn(
            'text-[15px] max-w-md mx-auto',
            'text-[var(--color-wise-text-muted)]',
          )}
        >
          {description}
        </p>
      ) : null}

      {action ? <EmptyStateActionView action={action} /> : null}

      {children}
    </div>
  )
}

// Split out so the main component stays scannable and the action rendering
// branches are easy to cover in tests.
function EmptyStateActionView({ action }: { action: EmptyStateAction }) {
  const { label, onClick, href } = action

  if (href) {
    // Anchor variant — we don't use <Button asChild> here to avoid coupling
    // to a Slot API that Story 2's Button does not currently expose. Styles
    // mirror Button variant='primary'.
    return (
      <a
        href={href}
        data-testid="empty-state-action"
        className={cn(
          'inline-flex items-center justify-center gap-2',
          'rounded-full font-semibold h-11 px-5 text-[15px]',
          'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
          'hover:bg-[var(--color-wise-primary-hover)]',
          'transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]',
          'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
        )}
      >
        {label}
      </a>
    )
  }

  return (
    <Button
      variant="primary"
      size="md"
      onClick={onClick}
      data-testid="empty-state-action"
    >
      {label}
    </Button>
  )
}
