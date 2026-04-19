import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// Sprint 1 Story 4 — <ConfirmDialog>: the canonical replacement for
// `window.confirm()` calls scattered across the admin panel (e.g.
// EnrollmentManagementPage.tsx ~L782). This story only delivers the
// primitive — a later story sweeps the codebase to actually swap out the
// native confirm calls.
//
// Built on top of <Modal> so accessibility (focus trap, ESC, scroll lock,
// aria-*) is inherited, and styled to match Story 2's <Button> tokens so
// destructive vs. primary flows feel consistent with the rest of the app.
import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', isLoading = false, onConfirm, }) {
    // Local busy state handles the async `onConfirm` case when the caller does
    // not pass an explicit `isLoading` prop. If the caller is driving loading
    // state externally we still respect that via the OR below.
    const [internalBusy, setInternalBusy] = useState(false);
    const busy = isLoading || internalBusy;
    const confirmVariant = variant === 'danger' ? 'danger' : 'primary';
    const handleConfirm = async () => {
        if (busy)
            return;
        try {
            setInternalBusy(true);
            await onConfirm();
            // Only auto-close on success. If onConfirm throws the caller keeps
            // control and can show an inline error before the dialog dismisses.
            onOpenChange(false);
        }
        catch {
            // Swallow — caller's responsibility to surface the error. We still
            // need to clear busy so the user can retry.
        }
        finally {
            setInternalBusy(false);
        }
    };
    return (_jsx(Modal, { open: open, onOpenChange: onOpenChange, title: title, description: description, size: "sm", showCloseButton: false, footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", size: "md", onClick: () => onOpenChange(false), children: cancelLabel }), _jsx(Button, { variant: confirmVariant, size: "md", isLoading: busy, onClick: handleConfirm, "data-testid": "confirm-dialog-confirm", children: confirmLabel })] }), children: null }));
}
