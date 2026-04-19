import { jsx as _jsx } from "react/jsx-runtime";
// Sprint 1 Story 5 — Unit tests for <LoadingSpinner>. Covers role=status
// wiring, the sr-only label, icon sizing by `size` prop, and the centered
// wrapper for page-level loading.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../LoadingSpinner';
describe('<LoadingSpinner>', () => {
    it('renders with role=status and aria-live=polite', () => {
        render(_jsx(LoadingSpinner, {}));
        const status = screen.getByRole('status');
        expect(status).toBeInTheDocument();
        expect(status).toHaveAttribute('aria-live', 'polite');
    });
    it('renders the default "Loading" sr-only label', () => {
        render(_jsx(LoadingSpinner, {}));
        // sr-only <span>, so assert on text content rather than visibility.
        expect(screen.getByText('Loading')).toBeInTheDocument();
        expect(screen.getByText('Loading').className).toContain('sr-only');
    });
    it('renders a custom label when provided', () => {
        render(_jsx(LoadingSpinner, { label: "Fetching users" }));
        expect(screen.getByText('Fetching users')).toBeInTheDocument();
        expect(screen.getByRole('status')).toBeInTheDocument();
    });
    it('renders an animate-spin svg', () => {
        const { container } = render(_jsx(LoadingSpinner, {}));
        expect(container.querySelector('svg.animate-spin')).not.toBeNull();
    });
    it.each([
        ['sm', 16],
        ['md', 24],
        ['lg', 32],
        ['xl', 48],
    ])('size=%s maps to a %spx icon', (size, px) => {
        const { container } = render(_jsx(LoadingSpinner, { size: size }));
        expect(screen.getByRole('status')).toHaveAttribute('data-size', size);
        const svg = container.querySelector('svg.animate-spin');
        expect(svg).not.toBeNull();
        // style.width is set inline via the style prop.
        expect(svg.style.width).toBe(`${px}px`);
        expect(svg.style.height).toBe(`${px}px`);
    });
    it('does NOT wrap in the centered container by default', () => {
        render(_jsx(LoadingSpinner, {}));
        expect(screen.queryByTestId('loading-spinner-centered')).toBeNull();
    });
    it('wraps in a flex-centered container when centered=true', () => {
        render(_jsx(LoadingSpinner, { centered: true }));
        const wrapper = screen.getByTestId('loading-spinner-centered');
        expect(wrapper).toBeInTheDocument();
        expect(wrapper.className).toContain('flex');
        expect(wrapper.className).toContain('items-center');
        expect(wrapper.className).toContain('justify-center');
        // The status region still lives inside the wrapper.
        expect(wrapper.contains(screen.getByRole('status'))).toBe(true);
    });
    it('merges custom className onto the status region', () => {
        render(_jsx(LoadingSpinner, { className: "my-custom-cls" }));
        expect(screen.getByRole('status').className).toContain('my-custom-cls');
    });
});
