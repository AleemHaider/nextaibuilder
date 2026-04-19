import { jsx as _jsx } from "react/jsx-runtime";
// Sprint 1 Story 3 — Unit tests for <Input>.
// Covers the surface area consumers depend on: placeholder, error styling,
// icon slots (and the corresponding padding offsets), ref forwarding, and
// the onChange pass-through. Styling assertions use class membership rather
// than computed styles since jsdom does not resolve CSS custom properties.
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Input } from '../Input';
describe('<Input>', () => {
    it('renders with placeholder', () => {
        render(_jsx(Input, { placeholder: "you@example.com" }));
        expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    });
    it('applies danger styling when hasError is true', () => {
        render(_jsx(Input, { placeholder: "email", hasError: true }));
        const input = screen.getByPlaceholderText('email');
        expect(input.className).toMatch(/border-\[var\(--color-wise-danger\)\]/);
        expect(input.className).toMatch(/bg-\[var\(--color-wise-danger-soft\)\]/);
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('data-has-error', 'true');
    });
    it('uses neutral border when hasError is false', () => {
        render(_jsx(Input, { placeholder: "email" }));
        const input = screen.getByPlaceholderText('email');
        expect(input.className).toMatch(/border-\[var\(--color-wise-ring\)\]/);
        expect(input).not.toHaveAttribute('aria-invalid');
    });
    it('renders leftIcon and adds left padding to the input', () => {
        render(_jsx(Input, { placeholder: "search", leftIcon: _jsx("svg", { "data-testid": "left-icon" }) }));
        expect(screen.getByTestId('left-icon')).toBeInTheDocument();
        const input = screen.getByPlaceholderText('search');
        expect(input.className).toContain('pl-11');
    });
    it('renders rightIcon and adds right padding to the input', () => {
        render(_jsx(Input, { placeholder: "amount", rightIcon: _jsx("svg", { "data-testid": "right-icon" }) }));
        expect(screen.getByTestId('right-icon')).toBeInTheDocument();
        const input = screen.getByPlaceholderText('amount');
        expect(input.className).toContain('pr-11');
    });
    it('forwards refs to the underlying input element', () => {
        const ref = createRef();
        render(_jsx(Input, { ref: ref, placeholder: "with-ref" }));
        expect(ref.current).toBeInstanceOf(HTMLInputElement);
        expect(ref.current?.placeholder).toBe('with-ref');
    });
    it('fires onChange when the value changes', () => {
        const handleChange = vi.fn();
        render(_jsx(Input, { placeholder: "typed", onChange: handleChange }));
        fireEvent.change(screen.getByPlaceholderText('typed'), {
            target: { value: 'hello' },
        });
        expect(handleChange).toHaveBeenCalledTimes(1);
        expect(handleChange.mock.calls[0][0].target.value).toBe('hello');
    });
    it('applies size-specific height classes', () => {
        const { rerender } = render(_jsx(Input, { placeholder: "p", inputSize: "sm" }));
        expect(screen.getByPlaceholderText('p').className).toContain('h-9');
        rerender(_jsx(Input, { placeholder: "p", inputSize: "md" }));
        expect(screen.getByPlaceholderText('p').className).toContain('h-11');
        rerender(_jsx(Input, { placeholder: "p", inputSize: "lg" }));
        expect(screen.getByPlaceholderText('p').className).toContain('h-12');
    });
});
