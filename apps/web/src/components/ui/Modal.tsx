// Sprint 1 Story 4 — Canonical <Modal> for the NAB web app.
//
// Wraps Radix Dialog primitives so every surface gets the same Wise-styled
// shell, with a working focus trap, ESC-to-close, scroll lock, and
// aria-labelledby/aria-describedby wiring for free. Existing modal-like
// experiences (the public CohortDetailPage lesson preview, admin
// window.confirm calls, etc.) are NOT migrated in this story — this story
// only delivers the primitive so later stories can consolidate.
//
// Visual rules come from DESIGN.md (Wise aesthetic): 30px rounded surface,
// var(--shadow-card) drop shadow, mint-on-hover pills, and the shared token
// set from Story 1. Classes reference tokens via `var(--color-wise-*)` so
// this component keeps working even if Tailwind theme wiring shifts.
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  /** Controlled open state. */
  open: boolean
  /** Radix-compatible open/close callback. Invoked on ESC, overlay click, and close button click. */
  onOpenChange: (open: boolean) => void
  /** Accessible title. Rendered visually and wired to aria-labelledby by Radix. */
  title: string
  /** Optional accessible description. Wired to aria-describedby by Radix. */
  description?: string
  /** Body content below the header. */
  children: React.ReactNode
  /** Optional footer slot — consumers place action buttons here. */
  footer?: React.ReactNode
  /** Max-width preset. Defaults to `md` (560px). */
  size?: 'sm' | 'md' | 'lg'
  /** Show the top-right close button. Defaults to true. */
  showCloseButton?: boolean
  /** Optional className appended to the content surface. */
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay: scrim + subtle backdrop blur, animated via Radix data-state. */}
        <Dialog.Overlay
          data-slot="modal-overlay"
          className={cn(
            'fixed inset-0 z-50 bg-[rgba(14,15,12,0.45)] backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        />
        <Dialog.Content
          data-slot="modal-content"
          // `outline-none` removes the default browser focus ring — Radix
          // still moves focus inside the dialog on open, and interactive
          // descendants keep their own focus-visible styles.
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2',
            'rounded-[30px] bg-white p-8 outline-none shadow-[var(--shadow-card)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            SIZE_CLASSES[size],
            className,
          )}
        >
          <Dialog.Title
            data-slot="modal-title"
            className="text-[24px] font-black tracking-[-0.5px] text-[var(--color-wise-text)]"
          >
            {title}
          </Dialog.Title>
          {description ? (
            <Dialog.Description
              data-slot="modal-description"
              className="mt-2 text-[15px] text-[var(--color-wise-text-muted)]"
            >
              {description}
            </Dialog.Description>
          ) : null}

          <div
            data-slot="modal-body"
            className="mt-6 text-[15px] text-[var(--color-wise-text-warm)]"
          >
            {children}
          </div>

          {footer ? (
            <div data-slot="modal-footer" className="mt-8 flex justify-end gap-3">
              {footer}
            </div>
          ) : null}

          {showCloseButton ? (
            <Dialog.Close
              data-slot="modal-close"
              aria-label="Close"
              className={cn(
                'absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full',
                'text-[var(--color-wise-text)] transition-colors',
                'hover:bg-[var(--color-wise-surface-soft)]',
                'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
              )}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
