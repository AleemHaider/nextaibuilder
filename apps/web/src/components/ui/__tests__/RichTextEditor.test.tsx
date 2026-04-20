// NAB-P0-4 — Unit tests for <RichTextEditor>.
//
// The editor runs ProseMirror under the hood, which jsdom only partially
// supports. We lean on the public props (`value` / `onChange`) and the
// toolbar button behaviour to exercise the wrapper, rather than simulating
// real keyboard events that ProseMirror would try to resolve against
// absent layout APIs. The layout shims in `src/test/setup.ts` keep the
// editor from crashing when transactions dispatch.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRef } from 'react'
import { fireEvent, render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Editor } from '@tiptap/react'

// Mock the API helper BEFORE importing the component so the mocked module
// is the one the component's import resolves to.
vi.mock('../../../lib/api', () => ({
  uploadAdminLessonImage: vi.fn().mockResolvedValue({
    url: '/api/uploads/lesson-images/cohort-1/fake.png',
    key: 'lesson-images/cohort-1/fake.png',
  }),
}))

import { RichTextEditor } from '../RichTextEditor'
import { uploadAdminLessonImage } from '../../../lib/api'

// jsdom doesn't provide `window.prompt`. Stub to return a fixed URL so the
// link button's behaviour is deterministic.
beforeEach(() => {
  vi.spyOn(window, 'prompt').mockReturnValue('https://example.com')
})

function noop() {}

describe('<RichTextEditor>', () => {
  it('renders the full toolbar with accessible button names', () => {
    render(
      <RichTextEditor value="" onChange={noop} cohortId="cohort-1" />,
    )

    // The core toolbar set — role=button with aria-label, so the query is
    // stable against lucide icon swaps.
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Heading 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Heading 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bullet list' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Numbered list' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inline code' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Code block' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quote' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Insert image' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Horizontal rule' })).toBeInTheDocument()
  })

  it('exposes a sticky toolbar labelled "Rich text formatting"', () => {
    render(
      <RichTextEditor value="" onChange={noop} cohortId="cohort-1" />,
    )
    const toolbar = screen.getByRole('toolbar', { name: /rich text formatting/i })
    expect(toolbar).toBeInTheDocument()
  })

  it('syncs external value updates into the editor surface', async () => {
    const { rerender } = render(
      <RichTextEditor value="<p>first</p>" onChange={noop} cohortId="cohort-1" />,
    )
    await waitFor(() => {
      expect(
        screen.getByTestId('rich-text-editor-surface').textContent,
      ).toMatch(/first/)
    })

    rerender(
      <RichTextEditor value="<p>second</p>" onChange={noop} cohortId="cohort-1" />,
    )
    await waitFor(() => {
      expect(
        screen.getByTestId('rich-text-editor-surface').textContent,
      ).toMatch(/second/)
    })
  })

  it('Bold button wraps the current selection in <strong>', async () => {
    const onChange = vi.fn()
    const editorRef = createRef<Editor | null>()
    render(
      <RichTextEditor
        value="<p>hello world</p>"
        onChange={onChange}
        cohortId="cohort-1"
        editorRef={editorRef}
      />,
    )

    // Use the editor's own selectAll command — ProseMirror tracks selection
    // in its state machine, independent of the DOM, so this is the correct
    // entry point.
    await waitFor(() => expect(editorRef.current).not.toBeNull())
    await act(async () => {
      editorRef.current!.chain().focus().selectAll().run()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })
    const emitted = onChange.mock.calls.map((c) => c[0] as string).join('\n')
    expect(emitted).toContain('<strong>')
  })

  it('Heading 2 button emits an <h2>', async () => {
    const onChange = vi.fn()
    render(
      <RichTextEditor
        value="<p>title candidate</p>"
        onChange={onChange}
        cohortId="cohort-1"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Heading 2' }))
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })
    const emitted = onChange.mock.calls.map((c) => c[0] as string).join('\n')
    expect(emitted).toMatch(/<h2>/)
  })

  it('Code block button emits a <pre><code>', async () => {
    const onChange = vi.fn()
    const editorRef = createRef<Editor | null>()
    render(
      <RichTextEditor
        value="<p>code me</p>"
        onChange={onChange}
        cohortId="cohort-1"
        editorRef={editorRef}
      />,
    )
    await waitFor(() => expect(editorRef.current).not.toBeNull())
    await act(async () => {
      editorRef.current!.chain().focus().selectAll().run()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Code block' }))
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })
    const emitted = onChange.mock.calls.map((c) => c[0] as string).join('\n')
    expect(emitted).toMatch(/<pre[\s>]/)
    expect(emitted).toMatch(/<code\s+class="language-/)
  })

  it('Link button prompts for a URL and wraps content in <a>', async () => {
    const onChange = vi.fn()
    const editorRef = createRef<Editor | null>()
    render(
      <RichTextEditor
        value="<p>click me</p>"
        onChange={onChange}
        cohortId="cohort-1"
        editorRef={editorRef}
      />,
    )
    await waitFor(() => expect(editorRef.current).not.toBeNull())
    await act(async () => {
      editorRef.current!.chain().focus().selectAll().run()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })
    const emitted = onChange.mock.calls.map((c) => c[0] as string).join('\n')
    expect(emitted).toContain('href="https://example.com"')
  })

  it('image button triggers the hidden file picker + uploads through the API helper', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <RichTextEditor value="" onChange={onChange} cohortId="cohort-1" />,
    )

    const fileInput = screen.getByTestId(
      'rich-text-editor-file-input',
    ) as HTMLInputElement

    // Click the image toolbar button — it should forward-click the input.
    const clickSpy = vi.spyOn(fileInput, 'click')
    await user.click(screen.getByRole('button', { name: 'Insert image' }))
    expect(clickSpy).toHaveBeenCalledTimes(1)

    // Now simulate the user picking a file directly on the input.
    const file = new File(['binary'], 'diagram.png', { type: 'image/png' })
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } })
    })
    // Flush the async upload + insertContent.
    await waitFor(() => {
      expect(uploadAdminLessonImage).toHaveBeenCalledWith('cohort-1', file)
    })
  })

  it('does not re-emit onChange when external value matches current HTML (idempotent sync)', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <RichTextEditor
        value="<p>stable</p>"
        onChange={onChange}
        cohortId="cohort-1"
      />,
    )
    await waitFor(() => {
      expect(
        screen.getByTestId('rich-text-editor-surface').textContent,
      ).toMatch(/stable/)
    })
    const beforeCount = onChange.mock.calls.length

    // Re-render with the same value — the useEffect should NOT push a new
    // setContent() call (which would itself emit onChange via the onUpdate
    // handler). We assert the count stays constant after a React tick.
    rerender(
      <RichTextEditor
        value="<p>stable</p>"
        onChange={onChange}
        cohortId="cohort-1"
      />,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(onChange.mock.calls.length).toBe(beforeCount)
  })
})
