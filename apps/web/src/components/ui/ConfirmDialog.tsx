// Sprint 1 Story 4 — <ConfirmDialog>: the canonical replacement for
// `window.confirm()` calls scattered across the admin panel (e.g.
// EnrollmentManagementPage.tsx ~L782). This story only delivers the
// primitive — a later story sweeps the codebase to actually swap out the
// native confirm calls.
//
// Built on top of <Modal> so accessibility (focus trap, ESC, scroll lock,
// aria-*) is inherited, and styled to match Story 2's <Button> tokens so
// destructive vs. primary flows feel consistent with the rest of the app.
import { useState } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

export interface ConfirmDialogProps {
  /** Controlled open state. */
  open: boolean
  /** Radix-compatible open/close callback. */
  onOpenChange: (open: boolean) => void
  /** Accessible title. */
  title: string
  /** Accessible description. Required for confirm dialogs — explain what happens. */
  description: string
  /** Confirm button label. Defaults to "Confirm". */
  confirmLabel?: string
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string
  /**
   * `danger` (default) renders a red confirm button — use for destructive
   * actions (delete, revoke). `warning` renders the primary (green) confirm
   * button — use for non-destructive-but-consequential actions.
   */
  variant?: 'danger' | 'warning'
  /**
   * When true, Confirm is disabled and shows a spinner. Cancel stays enabled
   * so users can bail out of a stuck request.
   */
  isLoading?: boolean
  /**
   * Invoked when the user clicks Confirm. May return a promise — the dialog
   * awaits it and closes on success (resolve). If it throws/rejects, the
   * dialog stays open so the caller can surface an error state.
   */
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  // Local busy state handles the async `onConfirm` case when the caller does
  // not pass an explicit `isLoading` prop. If the caller is driving loading
  // state externally we still respect that via the OR below.
  const [internalBusy, setInternalBusy] = useState(false)
  const busy = isLoading || internalBusy

  const confirmVariant = variant === 'danger' ? 'danger' : 'primary'

  const handleConfirm = async () => {
    if (busy) return
    try {
      setInternalBusy(true)
      await onConfirm()
      // Only auto-close on success. If onConfirm throws the caller keeps
      // control and can show an inline error before the dialog dismisses.
      onOpenChange(false)
    } catch {
      // Swallow — caller's responsibility to surface the error. We still
      // need to clear busy so the user can retry.
    } finally {
      setInternalBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      showCloseButton={false}
      footer={
        <>
          <Button
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            // Cancel stays enabled during loading so users are never trapped
            // in a spinning dialog.
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            size="md"
            isLoading={busy}
            onClick={handleConfirm}
            data-testid="confirm-dialog-confirm"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {/*
        The description is already rendered by <Modal> via Dialog.Description
        and wired to aria-describedby, so we don't repeat it in the body.
        Consumers who need extra content can extend this primitive later.
      */}
      {null}
    </Modal>
  )
}
