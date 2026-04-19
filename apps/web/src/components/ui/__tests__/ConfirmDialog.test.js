import { jsx as _jsx } from "react/jsx-runtime";
// Sprint 1 Story 4 — Unit tests for <ConfirmDialog>.
//
// The dialog is built on top of <Modal> (which is itself tested) so these
// specs focus on the confirm/cancel contract: label overrides, one-shot
// onConfirm behaviour, loading state, and the "close on success" async
// flow that admin destructive actions will depend on.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';
describe('<ConfirmDialog>', () => {
    it('renders with default labels', () => {
        render(_jsx(ConfirmDialog, { open: true, onOpenChange: () => { }, title: "Delete?", description: "Are you sure?", onConfirm: () => { } }));
        expect(screen.getByText('Delete?')).toBeInTheDocument();
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
    it('respects custom confirmLabel and cancelLabel', () => {
        render(_jsx(ConfirmDialog, { open: true, onOpenChange: () => { }, title: "Remove user", description: "They will lose access.", confirmLabel: "Remove", cancelLabel: "Keep", onConfirm: () => { } }));
        expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    });
    it('fires onConfirm exactly once when Confirm is clicked', async () => {
        const onConfirm = vi.fn();
        render(_jsx(ConfirmDialog, { open: true, onOpenChange: () => { }, title: "Go", description: "Do it.", onConfirm: onConfirm }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    });
    it('calls onOpenChange(false) when Cancel is clicked', () => {
        const onOpenChange = vi.fn();
        render(_jsx(ConfirmDialog, { open: true, onOpenChange: onOpenChange, title: "Nope", description: "Back out.", onConfirm: () => { } }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    it('disables Confirm while isLoading=true but keeps Cancel enabled', () => {
        render(_jsx(ConfirmDialog, { open: true, onOpenChange: () => { }, title: "Busy", description: "Working...", isLoading: true, onConfirm: () => { } }));
        const confirm = screen.getByRole('button', { name: /confirm/i });
        const cancel = screen.getByRole('button', { name: 'Cancel' });
        expect(confirm).toBeDisabled();
        expect(confirm).toHaveAttribute('aria-busy', 'true');
        expect(cancel).not.toBeDisabled();
    });
    it('closes the dialog after an async onConfirm resolves', async () => {
        const onOpenChange = vi.fn();
        let resolveFn = () => { };
        const onConfirm = vi.fn(() => new Promise((resolve) => {
            resolveFn = resolve;
        }));
        render(_jsx(ConfirmDialog, { open: true, onOpenChange: onOpenChange, title: "Async", description: "Wait for me.", onConfirm: onConfirm }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        // Still open pre-resolve — we should not have closed yet.
        expect(onOpenChange).not.toHaveBeenCalled();
        resolveFn();
        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });
    it('does not close the dialog if onConfirm rejects', async () => {
        const onOpenChange = vi.fn();
        const onConfirm = vi.fn(async () => {
            throw new Error('boom');
        });
        render(_jsx(ConfirmDialog, { open: true, onOpenChange: onOpenChange, title: "Fail", description: "It will fail.", onConfirm: onConfirm }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
        expect(onOpenChange).not.toHaveBeenCalled();
    });
    it('renders the danger variant by default (red confirm button)', () => {
        render(_jsx(ConfirmDialog, { open: true, onOpenChange: () => { }, title: "Danger", description: "Red button.", onConfirm: () => { } }));
        const confirm = screen.getByRole('button', { name: 'Confirm' });
        expect(confirm).toHaveAttribute('data-variant', 'danger');
    });
    it('renders the primary variant when variant="warning"', () => {
        render(_jsx(ConfirmDialog, { open: true, onOpenChange: () => { }, title: "Warn", description: "Green button.", variant: "warning", onConfirm: () => { } }));
        const confirm = screen.getByRole('button', { name: 'Confirm' });
        expect(confirm).toHaveAttribute('data-variant', 'primary');
    });
});
