import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Sprint 1 Story 2 — Canonical <Button> for the NAB web app.
//
// Wave 6 consolidation: the codebase historically shipped at least three
// button patterns (blue pill, rounded rect, Wise green pill) with divergent
// hover/focus/disabled handling. This is the single button component every
// new surface should adopt. It is intentionally un-wired from existing pages
// here — a later story handles the cross-codebase sweep.
//
// Design is driven by the Wise token set landed in Story 1. We reference the
// tokens via CSS custom properties (`var(--color-wise-*)`) rather than
// Tailwind theme keys, so this component keeps working even if token
// wiring order shifts under us.
import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
// CVA wraps the full variant matrix. Shared classes live on the root and
// cover the motion rules from DESIGN.md (1.02 hover lift, 0.98 active press)
// plus the universal pill radius and focus-visible ring.
const buttonVariants = cva([
    'inline-flex items-center justify-center gap-2',
    'rounded-full font-semibold',
    'transition-transform duration-150 ease-out',
    'hover:enabled:scale-[1.02] active:enabled:scale-[0.98]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
    'select-none',
].join(' '), {
    variants: {
        variant: {
            primary: 'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] hover:enabled:bg-[var(--color-wise-primary-hover)]',
            secondary: 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)] hover:enabled:bg-[var(--color-wise-primary-hover)]',
            outline: 'bg-transparent text-[var(--color-wise-text)] ring-1 ring-[var(--color-wise-ring-strong)] hover:enabled:bg-[var(--color-wise-mint)]',
            ghost: 'bg-transparent text-[var(--color-wise-text)] hover:enabled:bg-[var(--color-wise-surface-soft)]',
            danger: 'bg-[var(--color-wise-danger)] text-white hover:enabled:bg-[#b82a2f]',
        },
        size: {
            sm: 'h-9 px-4 text-[14px]',
            md: 'h-11 px-5 text-[15px]',
            lg: 'h-[52px] px-6 text-[16px]',
        },
    },
    defaultVariants: {
        variant: 'primary',
        size: 'md',
    },
});
export const Button = forwardRef(function Button({ className, variant = 'primary', size = 'md', isLoading = false, leftIcon, rightIcon, children, disabled, type, ...props }, ref) {
    const isDisabled = disabled || isLoading;
    // While loading the spinner replaces the leftIcon slot. We keep the original
    // label rendered to preserve button width and avoid layout shift during
    // async submits — this matches the pattern documented above.
    const resolvedLeftIcon = isLoading ? (_jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" })) : (leftIcon);
    return (_jsxs("button", { ref: ref, 
        // Default to type="button" so buttons inside forms don't accidentally
        // submit — callers that want submit behaviour pass it explicitly.
        type: type ?? 'button', disabled: isDisabled, "aria-busy": isLoading || undefined, "data-variant": variant, "data-size": size, className: cn(buttonVariants({ variant, size }), className), ...props, children: [resolvedLeftIcon, children, rightIcon] }));
});
