import { jsx as _jsx } from "react/jsx-runtime";
// Sprint 1 Story 2 — Unit tests for <Button>. Covers the contract callers
// depend on: label rendering, click gating (enabled / disabled / loading),
// variant class application, the loading spinner swap, and ref forwarding.
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../Button';
describe('<Button>', () => {
    it('renders its label', () => {
        render(_jsx(Button, { children: "Save changes" }));
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    });
    it('fires onClick when enabled', () => {
        const onClick = vi.fn();
        render(_jsx(Button, { onClick: onClick, children: "Click me" }));
        fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
    it('does not fire onClick when disabled', () => {
        const onClick = vi.fn();
        render(_jsx(Button, { onClick: onClick, disabled: true, children: "Nope" }));
        fireEvent.click(screen.getByRole('button', { name: 'Nope' }));
        expect(onClick).not.toHaveBeenCalled();
    });
    it('does not fire onClick when isLoading', () => {
        const onClick = vi.fn();
        render(_jsx(Button, { onClick: onClick, isLoading: true, children: "Submitting" }));
        const btn = screen.getByRole('button', { name: /submitting/i });
        fireEvent.click(btn);
        expect(onClick).not.toHaveBeenCalled();
        // aria-busy is set to signal assistive tech that the control is working.
        expect(btn).toHaveAttribute('aria-busy', 'true');
        // Native disabled is set too so click / focus are blocked consistently.
        expect(btn).toBeDisabled();
    });
    it('applies the primary variant background class', () => {
        render(_jsx(Button, { variant: "primary", children: "Primary" }));
        const btn = screen.getByRole('button', { name: 'Primary' });
        // Variant is exposed via data-variant for style hooks and asserted on the
        // class string for the Wise Green token mapping.
        expect(btn).toHaveAttribute('data-variant', 'primary');
        expect(btn.className).toContain('bg-[var(--color-wise-primary)]');
        expect(btn.className).toContain('text-[var(--color-wise-primary-text)]');
    });
    it('applies a non-primary variant class (danger)', () => {
        render(_jsx(Button, { variant: "danger", children: "Delete" }));
        const btn = screen.getByRole('button', { name: 'Delete' });
        expect(btn).toHaveAttribute('data-variant', 'danger');
        expect(btn.className).toContain('bg-[var(--color-wise-danger)]');
    });
    it('renders an animate-spin svg when isLoading', () => {
        const { container } = render(_jsx(Button, { isLoading: true, children: "Saving" }));
        const spinner = container.querySelector('svg.animate-spin');
        expect(spinner).not.toBeNull();
        // Original label stays visible so width does not collapse.
        expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });
    it('renders leftIcon + rightIcon slots when provided and not loading', () => {
        render(_jsx(Button, { leftIcon: _jsx("span", { "data-testid": "left" }), rightIcon: _jsx("span", { "data-testid": "right" }), children: "Go" }));
        expect(screen.getByTestId('left')).toBeInTheDocument();
        expect(screen.getByTestId('right')).toBeInTheDocument();
    });
    it('replaces leftIcon with spinner when loading', () => {
        const { container } = render(_jsx(Button, { isLoading: true, leftIcon: _jsx("span", { "data-testid": "left" }), children: "Go" }));
        expect(screen.queryByTestId('left')).toBeNull();
        expect(container.querySelector('svg.animate-spin')).not.toBeNull();
    });
    it('forwards refs to the underlying <button>', () => {
        const ref = createRef();
        render(_jsx(Button, { ref: ref, children: "Ref me" }));
        expect(ref.current).toBeInstanceOf(HTMLButtonElement);
        expect(ref.current?.textContent).toBe('Ref me');
    });
    it('defaults type to "button" so it does not submit forms by accident', () => {
        render(_jsx(Button, { children: "Safe" }));
        expect(screen.getByRole('button', { name: 'Safe' })).toHaveAttribute('type', 'button');
    });
});
