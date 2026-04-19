import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Sprint 1 Story 3 — <FormField>: label + control + helper/error wrapper.
//
// Takes a single child (typically <Input>) and clones it with the a11y wiring
// the designer shouldn't have to remember: `id`, `aria-invalid`, and an
// `aria-describedby` that points at whichever helper/error node is currently
// visible. Helper text is replaced by error text when `errorText` is set so
// screen readers never announce both simultaneously.
import { cloneElement, isValidElement } from 'react';
import { cn } from '@/lib/utils';
export function FormField({ id, label, helperText, errorText, required = false, className, children, }) {
    const hasError = Boolean(errorText);
    const describedId = hasError
        ? `${id}-error`
        : helperText
            ? `${id}-helper`
            : undefined;
    if (!isValidElement(children)) {
        throw new Error('FormField expects a single React element as its child');
    }
    const childProps = (children.props ?? {});
    const mergedDescribedBy = cn(childProps['aria-describedby'], describedId) || undefined;
    const control = cloneElement(children, {
        id,
        'aria-invalid': hasError ? true : childProps['aria-invalid'],
        'aria-describedby': mergedDescribedBy,
        hasError: hasError || childProps.hasError,
    });
    return (_jsxs("div", { "data-slot": "form-field", "data-has-error": hasError ? 'true' : undefined, className: cn('flex flex-col gap-1.5', className), children: [_jsxs("label", { htmlFor: id, "data-slot": "form-field-label", className: "text-[14px] font-semibold text-[var(--color-wise-text)]", children: [label, required ? (_jsx("span", { "aria-hidden": "true", "data-slot": "form-field-required", className: "ml-0.5 text-[var(--color-wise-danger)]", children: "*" })) : null] }), control, hasError ? (_jsx("p", { id: `${id}-error`, "data-slot": "form-field-error", className: "text-[12px] font-semibold text-[var(--color-wise-danger)]", children: errorText })) : helperText ? (_jsx("p", { id: `${id}-helper`, "data-slot": "form-field-helper", className: "text-[12px] text-[var(--color-wise-text-muted)]", children: helperText })) : null] }));
}
