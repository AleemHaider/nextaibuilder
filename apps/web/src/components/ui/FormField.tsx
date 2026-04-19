// Sprint 1 Story 3 — <FormField>: label + control + helper/error wrapper.
//
// Takes a single child (typically <Input>) and clones it with the a11y wiring
// the designer shouldn't have to remember: `id`, `aria-invalid`, and an
// `aria-describedby` that points at whichever helper/error node is currently
// visible. Helper text is replaced by error text when `errorText` is set so
// screen readers never announce both simultaneously.
import { cloneElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface FormFieldProps {
  /** Required — used for label `htmlFor` and control `id`. */
  id: string
  label: ReactNode
  helperText?: ReactNode
  errorText?: ReactNode
  required?: boolean
  className?: string
  /** The control (Input / Textarea / Select). */
  children: ReactElement
}

// Props we may inject onto the child control. Kept permissive so we can
// merge the caller's existing a11y attributes rather than clobber them.
type InjectedProps = {
  id?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  hasError?: boolean
}

export function FormField({
  id,
  label,
  helperText,
  errorText,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const hasError = Boolean(errorText)
  const describedId = hasError
    ? `${id}-error`
    : helperText
      ? `${id}-helper`
      : undefined

  if (!isValidElement(children)) {
    throw new Error('FormField expects a single React element as its child')
  }

  const childProps = (children.props ?? {}) as InjectedProps & {
    'aria-describedby'?: string
  }
  const mergedDescribedBy = cn(childProps['aria-describedby'], describedId) || undefined

  const control = cloneElement(children as ReactElement<InjectedProps>, {
    id,
    'aria-invalid': hasError ? true : childProps['aria-invalid'],
    'aria-describedby': mergedDescribedBy,
    hasError: hasError || childProps.hasError,
  })

  return (
    <div
      data-slot="form-field"
      data-has-error={hasError ? 'true' : undefined}
      className={cn('flex flex-col gap-1.5', className)}
    >
      <label
        htmlFor={id}
        data-slot="form-field-label"
        className="text-[14px] font-semibold text-[var(--color-wise-text)]"
      >
        {label}
        {required ? (
          <span
            aria-hidden="true"
            data-slot="form-field-required"
            className="ml-0.5 text-[var(--color-wise-danger)]"
          >
            *
          </span>
        ) : null}
      </label>

      {control}

      {hasError ? (
        // Sprint 4 Story 18 — announce validation errors to assistive tech.
        // `role="alert"` + implicit `aria-live="assertive"` on a freshly-
        // mounted element ensures screen readers speak the message the
        // instant the control becomes invalid.
        <p
          id={`${id}-error`}
          data-slot="form-field-error"
          role="alert"
          aria-live="polite"
          className="text-[12px] font-semibold text-[var(--color-wise-danger)]"
        >
          {errorText}
        </p>
      ) : helperText ? (
        <p
          id={`${id}-helper`}
          data-slot="form-field-helper"
          className="text-[12px] text-[var(--color-wise-text-muted)]"
        >
          {helperText}
        </p>
      ) : null}
    </div>
  )
}
