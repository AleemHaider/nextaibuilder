import { jsx as _jsx } from "react/jsx-runtime";
// Sprint 1 Story 5 — Unit tests for <LoadingSkeleton>. Covers the contract
// callers depend on: text-variant line counting + last-line narrowing,
// aria-hidden on every wrapper, and custom width / height threading.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardSkeleton, ListItemSkeleton, LoadingSkeleton, TableRowSkeleton, } from '../LoadingSkeleton';
describe('<LoadingSkeleton>', () => {
    it('defaults to rect variant with rounded-xl and aria-hidden', () => {
        const { container } = render(_jsx(LoadingSkeleton, {}));
        const root = container.firstElementChild;
        expect(root).toHaveAttribute('aria-hidden', 'true');
        expect(root).toHaveAttribute('data-variant', 'rect');
        expect(root.className).toContain('rounded-xl');
        expect(root.className).toContain('animate-pulse');
    });
    it('text variant renders N stacked lines with last line narrower', () => {
        render(_jsx(LoadingSkeleton, { variant: "text", lines: 3 }));
        const lines = screen.getAllByTestId('skeleton-line');
        expect(lines).toHaveLength(3);
        // First two lines full width, last line 70%.
        expect(lines[0].style.width).toBe('100%');
        expect(lines[1].style.width).toBe('100%');
        expect(lines[2].style.width).toBe('70%');
    });
    it('text variant with lines=1 renders a single line without narrowing', () => {
        render(_jsx(LoadingSkeleton, { variant: "text", lines: 1 }));
        const lines = screen.getAllByTestId('skeleton-line');
        expect(lines).toHaveLength(1);
        // Single-line mode does not apply the 70% narrowing.
        expect(lines[0].style.width).toBe('100%');
    });
    it('text variant wrapper carries aria-hidden', () => {
        const { container } = render(_jsx(LoadingSkeleton, { variant: "text", lines: 2 }));
        const root = container.firstElementChild;
        expect(root).toHaveAttribute('aria-hidden', 'true');
        expect(root).toHaveAttribute('data-variant', 'text');
    });
    it('circle variant applies rounded-full and defaults to square dims', () => {
        const { container } = render(_jsx(LoadingSkeleton, { variant: "circle", width: 32 }));
        const root = container.firstElementChild;
        expect(root).toHaveAttribute('data-variant', 'circle');
        expect(root.className).toContain('rounded-full');
        expect(root.style.width).toBe('32px');
        expect(root.style.height).toBe('32px');
    });
    it('applies numeric width / height as px on rect variant', () => {
        const { container } = render(_jsx(LoadingSkeleton, { width: 120, height: 40 }));
        const root = container.firstElementChild;
        expect(root.style.width).toBe('120px');
        expect(root.style.height).toBe('40px');
    });
    it('applies string width / height verbatim on rect variant', () => {
        const { container } = render(_jsx(LoadingSkeleton, { width: "50%", height: "2rem" }));
        const root = container.firstElementChild;
        expect(root.style.width).toBe('50%');
        expect(root.style.height).toBe('2rem');
    });
    it('merges custom className via cn()', () => {
        const { container } = render(_jsx(LoadingSkeleton, { className: "custom-cls" }));
        const root = container.firstElementChild;
        expect(root.className).toContain('custom-cls');
    });
});
describe('<CardSkeleton>', () => {
    it('renders a 140px-tall card shape with 30px radius and aria-hidden', () => {
        render(_jsx(CardSkeleton, {}));
        const el = screen.getByTestId('card-skeleton');
        expect(el).toHaveAttribute('aria-hidden', 'true');
        expect(el.className).toContain('rounded-[30px]');
        expect(el.className).toContain('h-[140px]');
        expect(el.className).toContain('animate-pulse');
    });
});
describe('<TableRowSkeleton>', () => {
    it('renders the default 4 cells', () => {
        const { container } = render(_jsx(TableRowSkeleton, {}));
        const row = screen.getByTestId('table-row-skeleton');
        expect(row).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelectorAll('[data-testid="table-row-skeleton"] > div'))
            .toHaveLength(4);
    });
    it('renders the requested column count', () => {
        const { container } = render(_jsx(TableRowSkeleton, { columns: 6 }));
        expect(container.querySelectorAll('[data-testid="table-row-skeleton"] > div')).toHaveLength(6);
    });
});
describe('<ListItemSkeleton>', () => {
    it('renders an avatar circle + two text lines', () => {
        render(_jsx(ListItemSkeleton, {}));
        const root = screen.getByTestId('list-item-skeleton');
        expect(root).toHaveAttribute('aria-hidden', 'true');
        // One circle + two rect children inside the text column.
        const circles = root.querySelectorAll('[data-variant="circle"]');
        const rects = root.querySelectorAll('[data-variant="rect"]');
        expect(circles).toHaveLength(1);
        expect(rects).toHaveLength(2);
    });
});
