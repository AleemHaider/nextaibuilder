import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
function toCssLength(value) {
    if (value === undefined)
        return undefined;
    return typeof value === 'number' ? `${value}px` : value;
}
// Base classes shared by every variant. The pulse is driven by Tailwind's
// built-in `animate-pulse` keyframe; `aria-hidden` is set on every wrapper
// (see `ariaHidden` in the render paths below).
const SKELETON_BASE = 'animate-pulse bg-[var(--color-wise-surface-soft)]';
export function LoadingSkeleton({ variant = 'rect', width, height, lines, className, style, ...rest }) {
    const w = toCssLength(width);
    const h = toCssLength(height);
    if (variant === 'text') {
        const count = Math.max(1, lines ?? 1);
        return (_jsx("div", { "aria-hidden": "true", "data-variant": "text", className: cn('flex flex-col gap-2', className), style: style, ...rest, children: Array.from({ length: count }).map((_, i) => {
                const isLast = i === count - 1 && count > 1;
                const lineStyle = {
                    width: w ?? (isLast ? '70%' : '100%'),
                    height: h,
                };
                return (_jsx("div", { "data-testid": "skeleton-line", className: cn(SKELETON_BASE, 'rounded h-[0.875em]'), style: lineStyle }, i));
            }) }));
    }
    if (variant === 'circle') {
        const size = w ?? h ?? '2.5rem';
        return (_jsx("div", { "aria-hidden": "true", "data-variant": "circle", className: cn(SKELETON_BASE, 'rounded-full', className), style: { width: size, height: h ?? size, ...style }, ...rest }));
    }
    // Default rect.
    return (_jsx("div", { "aria-hidden": "true", "data-variant": "rect", className: cn(SKELETON_BASE, 'rounded-xl', className), style: { width: w, height: h, ...style }, ...rest }));
}
/**
 * Full Wise card placeholder (30px corner radius, ~140px height). Drops into
 * any card grid while data loads.
 */
export function CardSkeleton({ className }) {
    return (_jsx("div", { "aria-hidden": "true", "data-testid": "card-skeleton", className: cn('animate-pulse bg-[var(--color-wise-surface-soft)]', 'rounded-[30px] w-full h-[140px]', className) }));
}
/** Horizontal strip of N equal-width placeholder cells for table rows. */
export function TableRowSkeleton({ columns = 4, className, }) {
    const count = Math.max(1, columns);
    return (_jsx("div", { "aria-hidden": "true", "data-testid": "table-row-skeleton", className: cn('flex items-center gap-3 w-full', className), children: Array.from({ length: count }).map((_, i) => (_jsx("div", { className: "animate-pulse bg-[var(--color-wise-surface-soft)] rounded-lg h-6 flex-1" }, i))) }));
}
/** Avatar + two text lines — the canonical list-row placeholder. */
export function ListItemSkeleton({ className }) {
    return (_jsxs("div", { "aria-hidden": "true", "data-testid": "list-item-skeleton", className: cn('flex items-center gap-3 w-full', className), children: [_jsx(LoadingSkeleton, { variant: "circle", width: 40, height: 40 }), _jsxs("div", { className: "flex-1 flex flex-col gap-2", children: [_jsx(LoadingSkeleton, { variant: "rect", height: 10, className: "rounded w-1/2" }), _jsx(LoadingSkeleton, { variant: "rect", height: 10, className: "rounded w-3/4" })] })] }));
}
