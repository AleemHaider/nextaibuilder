// Sprint 1 Story 3 — Unit tests for <FormField>.
// Verifies the label + control + helper/error composition, the required
// asterisk affordance, and — most importantly — the a11y wiring that
// <FormField> injects into its child: `id`, `aria-invalid`, and
// `aria-describedby` pointing at either the helper or error node.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormField } from '../FormField'
import { Input } from '../Input'

describe('<FormField>', () => {
  it('renders the label text', () => {
    render(
      <FormField id="email" label="Email address">
        <Input />
      </FormField>,
    )
    expect(screen.getByText('Email address')).toBeInTheDocument()
  })

  it('shows a required asterisk when required is true', () => {
    render(
      <FormField id="email" label="Email" required>
        <Input />
      </FormField>,
    )
    const asterisk = screen.getByText('*')
    expect(asterisk).toBeInTheDocument()
    expect(asterisk).toHaveAttribute('aria-hidden', 'true')
  })

  it('omits the asterisk when required is false', () => {
    render(
      <FormField id="email" label="Email">
        <Input />
      </FormField>,
    )
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('renders helper text when no error is provided', () => {
    render(
      <FormField
        id="email"
        label="Email"
        helperText="We will never share your address"
      >
        <Input />
      </FormField>,
    )
    const helper = screen.getByText('We will never share your address')
    expect(helper).toBeInTheDocument()
    expect(helper).toHaveAttribute('id', 'email-helper')
  })

  it('replaces helper text with error text when errorText is provided', () => {
    render(
      <FormField
        id="email"
        label="Email"
        helperText="We will never share your address"
        errorText="Email is required"
      >
        <Input />
      </FormField>,
    )
    expect(
      screen.queryByText('We will never share your address'),
    ).not.toBeInTheDocument()
    const error = screen.getByText('Email is required')
    expect(error).toBeInTheDocument()
    expect(error).toHaveAttribute('id', 'email-error')
  })

  it('sets aria-invalid="true" on the input when an error is present', () => {
    render(
      <FormField id="email" label="Email" errorText="Required">
        <Input />
      </FormField>,
    )
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('wires aria-describedby to the helper id when no error is set', () => {
    render(
      <FormField id="email" label="Email" helperText="Optional hint">
        <Input />
      </FormField>,
    )
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-describedby', 'email-helper')
  })

  it('wires aria-describedby to the error id when an error is set', () => {
    render(
      <FormField
        id="email"
        label="Email"
        helperText="Optional hint"
        errorText="Required"
      >
        <Input />
      </FormField>,
    )
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-describedby', 'email-error')
  })

  it('omits aria-describedby when there is neither helper nor error text', () => {
    render(
      <FormField id="email" label="Email">
        <Input />
      </FormField>,
    )
    const input = screen.getByLabelText('Email')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('focuses the input when the label is clicked (via htmlFor)', async () => {
    const user = userEvent.setup()
    render(
      <FormField id="email" label="Email">
        <Input />
      </FormField>,
    )
    const label = screen.getByText('Email')
    const input = screen.getByLabelText('Email')
    expect(label).toHaveAttribute('for', 'email')
    await user.click(label)
    expect(input).toHaveFocus()
  })
})
