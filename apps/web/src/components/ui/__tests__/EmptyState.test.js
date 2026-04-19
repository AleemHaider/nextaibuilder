import { jsx as _jsx } from "react/jsx-runtime";
// Sprint 1 Story 5 — Unit tests for <EmptyState>. Covers the contract
// callers depend on: title + description rendering, icon chip, and the two
// action forms (button via onClick, link via href) plus the absent-action
// case.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Bell } from 'lucide-react';
import { EmptyState } from '../EmptyState';
describe('<EmptyState>', () => {
    it('renders the title and description', () => {
        render(_jsx(EmptyState, { title: "No notifications yet", description: "You're all caught up." }));
        expect(screen.getByRole('heading', { name: 'No notifications yet' })).toBeInTheDocument();
        expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    });
    it('renders the mint icon chip with the default icon', () => {
        render(_jsx(EmptyState, { title: "Empty" }));
        const chip = screen.getByTestId('empty-state-icon-chip');
        expect(chip).toBeInTheDocument();
        expect(chip.className).toContain('bg-[var(--color-wise-mint)]');
        expect(chip.className).toContain('text-[var(--color-wise-primary-text)]');
        // Default icon renders an <svg>.
        expect(chip.querySelector('svg')).not.toBeNull();
    });
    it('uses a custom icon when provided', () => {
        render(_jsx(EmptyState, { icon: Bell, title: "Empty" }));
        const chip = screen.getByTestId('empty-state-icon-chip');
        expect(chip.querySelector('svg')).not.toBeNull();
    });
    it('omits the description paragraph when not provided', () => {
        render(_jsx(EmptyState, { title: "No results" }));
        // There should be exactly one text block (the heading); no additional <p>.
        const container = screen.getByTestId('empty-state');
        expect(container.querySelector('p')).toBeNull();
    });
    it('does not render an action when `action` is undefined', () => {
        render(_jsx(EmptyState, { title: "Empty" }));
        expect(screen.queryByTestId('empty-state-action')).toBeNull();
    });
    it('renders the action as a button when only onClick is provided', () => {
        const onClick = vi.fn();
        render(_jsx(EmptyState, { title: "Empty", action: { label: 'Add first item', onClick } }));
        const action = screen.getByTestId('empty-state-action');
        expect(action.tagName).toBe('BUTTON');
        expect(action).toHaveTextContent('Add first item');
        fireEvent.click(action);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
    it('renders the action as a link when href is provided', () => {
        render(_jsx(EmptyState, { title: "Empty", action: { label: 'Go to docs', href: '/docs' } }));
        const action = screen.getByTestId('empty-state-action');
        expect(action.tagName).toBe('A');
        expect(action).toHaveAttribute('href', '/docs');
        expect(action).toHaveTextContent('Go to docs');
    });
    it('container uses the centered Wise layout', () => {
        render(_jsx(EmptyState, { title: "Empty" }));
        const container = screen.getByTestId('empty-state');
        expect(container.className).toContain('flex');
        expect(container.className).toContain('flex-col');
        expect(container.className).toContain('items-center');
        expect(container.className).toContain('text-center');
    });
    it('merges custom className', () => {
        render(_jsx(EmptyState, { title: "Empty", className: "my-cls" }));
        expect(screen.getByTestId('empty-state').className).toContain('my-cls');
    });
    it('renders children below the action slot', () => {
        render(_jsx(EmptyState, { title: "Empty", children: _jsx("div", { "data-testid": "child", children: "custom" }) }));
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });
});
