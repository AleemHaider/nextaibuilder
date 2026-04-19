import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Inbox } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';
export function EmptyState({ icon: Icon = Inbox, title, description, action, className, children, }) {
    return (_jsxs("div", { "data-testid": "empty-state", className: cn('flex flex-col items-center text-center gap-4 py-12 px-6', className), children: [_jsx("div", { "data-testid": "empty-state-icon-chip", className: cn('h-14 w-14 rounded-2xl flex items-center justify-center', 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]'), children: _jsx(Icon, { className: "h-7 w-7", "aria-hidden": "true" }) }), _jsx("h3", { className: cn('text-[20px] font-black tracking-[-0.3px]', 'text-[var(--color-wise-text)]'), children: title }), description ? (_jsx("p", { className: cn('text-[15px] max-w-md mx-auto', 'text-[var(--color-wise-text-muted)]'), children: description })) : null, action ? _jsx(EmptyStateActionView, { action: action }) : null, children] }));
}
// Split out so the main component stays scannable and the action rendering
// branches are easy to cover in tests.
function EmptyStateActionView({ action }) {
    const { label, onClick, href } = action;
    if (href) {
        // Anchor variant — we don't use <Button asChild> here to avoid coupling
        // to a Slot API that Story 2's Button does not currently expose. Styles
        // mirror Button variant='primary'.
        return (_jsx("a", { href: href, "data-testid": "empty-state-action", className: cn('inline-flex items-center justify-center gap-2', 'rounded-full font-semibold h-11 px-5 text-[15px]', 'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]', 'hover:bg-[var(--color-wise-primary-hover)]', 'transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]', 'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2'), children: label }));
    }
    return (_jsx(Button, { variant: "primary", size: "md", onClick: onClick, "data-testid": "empty-state-action", children: label }));
}
