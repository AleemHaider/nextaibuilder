// NAB-P0-2 — Unit tests for <TagInput>.
//
// Contract under test (see TagInput.tsx header):
//   - Enter key commits the draft into the array.
//   - Comma key also commits (the UX "type-a-list" accelerator).
//   - Clicking the × on a pill calls onChange with that entry removed.
//   - maxTags caps the array: additional commits are silent no-ops and the
//     input flips to disabled with the "Max N entries reached" hint.
//   - Backspace on an empty input pops the trailing tag (quick undo).
//   - Whitespace-only drafts are rejected so stray Enter presses don't
//     pollute the array with empty pills.
//   - Duplicate entries are deduped (case-sensitive) so rapid double-Enter
//     doesn't stack identical bullets.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TagInput } from '../TagInput'

function setup(props: Partial<React.ComponentProps<typeof TagInput>> = {}) {
  const onChange = vi.fn()
  const utils = render(
    <TagInput
      value={props.value ?? []}
      onChange={props.onChange ?? onChange}
      maxTags={props.maxTags ?? 5}
      maxLength={props.maxLength}
      placeholder={props.placeholder ?? 'Type here'}
      id={props.id ?? 'tags'}
    />,
  )
  return { onChange, ...utils }
}

describe('<TagInput>', () => {
  it('adds a tag when Enter is pressed', () => {
    const { onChange } = setup({ value: [] })
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Build AI apps' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['Build AI apps'])
  })

  it('adds a tag when comma is pressed', () => {
    const { onChange } = setup({ value: [] })
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Ship a product' } })
    fireEvent.keyDown(input, { key: ',' })
    expect(onChange).toHaveBeenCalledWith(['Ship a product'])
  })

  it('trims surrounding whitespace before committing', () => {
    const { onChange } = setup({ value: [] })
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement
    fireEvent.change(input, { target: { value: '   Ship a product   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['Ship a product'])
  })

  it('does not commit whitespace-only input', () => {
    const { onChange } = setup({ value: [] })
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('de-duplicates identical entries silently', () => {
    const { onChange } = setup({ value: ['Build AI apps'] })
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Build AI apps' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes a tag when the × button is clicked', () => {
    const { onChange } = setup({ value: ['a', 'b', 'c'] })
    const removeB = screen.getByRole('button', { name: /remove b/i })
    fireEvent.click(removeB)
    expect(onChange).toHaveBeenCalledWith(['a', 'c'])
  })

  it('renders one pill per value entry', () => {
    setup({ value: ['alpha', 'beta', 'gamma'] })
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByText('beta')).toBeInTheDocument()
    expect(screen.getByText('gamma')).toBeInTheDocument()
  })

  it('shows an N / max counter', () => {
    setup({ value: ['one', 'two'], maxTags: 5 })
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
  })

  it('respects the max cap — further commits are no-ops and the input disables', () => {
    const { onChange } = setup({ value: ['a', 'b', 'c'], maxTags: 3 })
    const input = screen.getByPlaceholderText('Max 3 entries reached') as HTMLInputElement
    expect(input).toBeDisabled()

    // Programmatically try to commit anyway — fireEvent ignores disabled, so
    // this exercises the guard inside TagInput itself.
    fireEvent.change(input, { target: { value: 'd' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('pops the trailing tag when Backspace is pressed on empty input', () => {
    const { onChange } = setup({ value: ['a', 'b'] })
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(onChange).toHaveBeenCalledWith(['a'])
  })

  it('does not pop when there is a draft to preserve typing', () => {
    const { onChange } = setup({ value: ['a'] })
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'x' } })
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('truncates entries over maxLength silently', () => {
    const { onChange } = setup({ value: [], maxLength: 5 })
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement
    // Bypass DOM maxLength by firing change directly.
    fireEvent.change(input, { target: { value: 'abcdefghij' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['abcde'])
  })
})
