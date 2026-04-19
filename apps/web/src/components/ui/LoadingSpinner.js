import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
// Icon pixel sizes from the story spec. Stored as an object for test
// introspection rather than inline switch for readability.
const SIZE_PX = {
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
};
export function LoadingSpinner({ size = 'md', label = 'Loading', centered = false, className, ...rest }) {
    const px = SIZE_PX[size];
    const statusNode = (_jsxs("div", { role: "status", "aria-live": "polite", "data-size": size, className: cn('inline-flex items-center justify-center', className), ...rest, children: [_jsx(Loader2, { "aria-hidden": "true", className: "animate-spin", style: {
                    width: px,
                    height: px,
                    color: 'var(--color-wise-text-muted)',
                } }), _jsx("span", { className: "sr-only", children: label })] }));
    if (!centered)
        return statusNode;
    // Page / card level wrapper. `min-h-[200px]` keeps the spinner from sitting
    // flush against the top edge inside empty containers.
    return (_jsx("div", { "data-testid": "loading-spinner-centered", className: "flex items-center justify-center w-full min-h-[200px]", children: statusNode }));
}
