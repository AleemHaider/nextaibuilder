import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
const SIZE_CLASSES = {
    sm: 'max-w-[420px]',
    md: 'max-w-[560px]',
    lg: 'max-w-[720px]',
};
export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', showCloseButton = true, className, }) {
    return (_jsx(Dialog.Root, { open: open, onOpenChange: onOpenChange, children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { "data-slot": "modal-overlay", className: cn('fixed inset-0 z-50 bg-[rgba(14,15,12,0.45)] backdrop-blur-sm', 'data-[state=open]:animate-in data-[state=closed]:animate-out', 'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0') }), _jsxs(Dialog.Content, { "data-slot": "modal-content", 
                    // `outline-none` removes the default browser focus ring — Radix
                    // still moves focus inside the dialog on open, and interactive
                    // descendants keep their own focus-visible styles.
                    className: cn('fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2', 'rounded-[30px] bg-white p-8 outline-none shadow-[var(--shadow-card)]', 'data-[state=open]:animate-in data-[state=closed]:animate-out', 'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0', SIZE_CLASSES[size], className), children: [_jsx(Dialog.Title, { "data-slot": "modal-title", className: "text-[24px] font-black tracking-[-0.5px] text-[var(--color-wise-text)]", children: title }), description ? (_jsx(Dialog.Description, { "data-slot": "modal-description", className: "mt-2 text-[15px] text-[var(--color-wise-text-muted)]", children: description })) : null, _jsx("div", { "data-slot": "modal-body", className: "mt-6 text-[15px] text-[var(--color-wise-text-warm)]", children: children }), footer ? (_jsx("div", { "data-slot": "modal-footer", className: "mt-8 flex justify-end gap-3", children: footer })) : null, showCloseButton ? (_jsx(Dialog.Close, { "data-slot": "modal-close", "aria-label": "Close", className: cn('absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full', 'text-[var(--color-wise-text)] transition-colors', 'hover:bg-[var(--color-wise-surface-soft)]', 'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2'), children: _jsx(X, { className: "h-4 w-4", "aria-hidden": "true" }) })) : null] })] }) }));
}
