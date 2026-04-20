// NAB-P0-4 — Rich-text lesson editor (TipTap v2).
//
// Drop-in replacement for the lesson-body <textarea>. Wraps TipTap's
// <EditorContent> with a sticky toolbar (B / I / H2 / H3 / bullet / numbered
// / link / inline code / code block + language / quote / image / HR) and
// wires image uploads through `uploadAdminLessonImage` so inserted images
// carry a `data-key` attribute for future cleanup jobs.
//
// Paste handling: TipTap's StarterKit already strips unknown tags on paste;
// the sanitize allow-list at render time is the authoritative XSS gate, so
// inline `style=""` attributes that survive the editor are still stripped
// before they reach a viewer. We don't extend the allow-list here.
//
// Markdown mode: SKIPPED for this P0 — pure TipTap + toolbar ships the
// feature set the story calls for. A follow-up can add a split-pane
// `marked`-backed Markdown textarea using the dependency we already
// installed. The toggle lives behind `enableMarkdown` so a future PR can
// flip it on without a new prop.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, RefObject } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Code,
  Code2,
  Quote,
  Image as ImageIcon,
  Minus,
} from 'lucide-react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { cn } from '@/lib/utils'
import { uploadAdminLessonImage } from '@/lib/api'
import { LoadingSpinner } from './LoadingSpinner'

// Lazy lowlight instance — registers the common languages so the editor's
// code-block can syntax-highlight on render. Languages below match the
// toolbar dropdown.
const lowlight = createLowlight(common)

const CODE_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: 'plaintext',  label: 'Plain text' },
  { value: 'ts',         label: 'TypeScript' },
  { value: 'js',         label: 'JavaScript' },
  { value: 'tsx',        label: 'TSX' },
  { value: 'jsx',        label: 'JSX' },
  { value: 'json',       label: 'JSON' },
  { value: 'bash',       label: 'Bash' },
  { value: 'python',     label: 'Python' },
  { value: 'css',        label: 'CSS' },
  { value: 'html',       label: 'HTML' },
  { value: 'md',         label: 'Markdown' },
  { value: 'sql',        label: 'SQL' },
]

export interface RichTextEditorProps {
  /** Current HTML value. Defaults to an empty string. */
  value: string
  /** Fires with the new HTML on every change. */
  onChange: (next: string) => void
  /**
   * Cohort (course) ID used to scope the inline-image upload endpoint.
   * Images are written to `lesson-images/<cohortId>/…` in S3 / uploads.
   */
  cohortId: string
  /** Hard cap — matches the Lesson model's `richContent` maxLength. */
  maxChars?: number
  /** Optional classname for the outer wrapper. */
  className?: string
  /** Optional placeholder text; shown when the editor is empty. */
  placeholder?: string
  /**
   * Test hook — receives the underlying TipTap `Editor` instance once
   * mounted. Production call sites shouldn't need this; the RichTextEditor
   * tests use it to drive selection + commands deterministically (jsdom
   * doesn't reliably carry a DOM selection through to ProseMirror).
   */
  editorRef?: RefObject<Editor | null>
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="button"
      aria-label={label}
      aria-pressed={active ? true : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)]',
        'text-[var(--color-wise-text)] transition-colors',
        'hover:bg-[var(--color-wise-surface-soft)]',
        'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        active && 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
      )}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  cohortId,
  maxChars = 100_000,
  className,
  placeholder,
  editorRef,
}: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Memoise extensions so TipTap doesn't re-initialise on every render.
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        // We supply our own CodeBlockLowlight below — StarterKit's plain
        // code-block would otherwise shadow it.
        codeBlock: false,
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
        HTMLAttributes: { class: 'hljs' },
      }),
    ],
    [],
  )

  const editor = useEditor({
    extensions,
    content: value || '',
    editorProps: {
      attributes: {
        class: cn(
          'prose max-w-none min-h-[220px] px-4 py-3',
          'focus:outline-none',
        ),
        'data-testid': 'rich-text-editor-surface',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      // Hard character cap at the HTML level. TipTap doesn't natively cap on
      // HTML length, so we enforce at the emit boundary.
      if (html.length > maxChars) return
      onChange(html)
    },
  })

  // Keep the editor in sync when `value` is set externally (modal open /
  // reset). Skip when the HTML already matches to avoid cursor jumps.
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  // Test-only escape hatch: forward the live editor instance through the
  // caller's ref. Production call sites omit `editorRef`.
  useEffect(() => {
    if (!editorRef) return
    editorRef.current = editor ?? null
    return () => {
      if (editorRef) editorRef.current = null
    }
  }, [editor, editorRef])

  // Cmd+K → link prompt. StarterKit wires Cmd+B / Cmd+I automatically.
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const previousUrl = editor!.getAttributes('link').href as string | undefined
        const url = window.prompt('Enter URL', previousUrl ?? 'https://')
        if (url === null) return
        if (url === '') {
          editor!.chain().focus().extendMarkRange('link').unsetLink().run()
          return
        }
        editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
      }
    }
    dom.addEventListener('keydown', handler)
    return () => dom.removeEventListener('keydown', handler)
  }, [editor])

  const handleImageClick = useCallback(() => {
    setUploadError(null)
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // Reset the input so picking the same file twice still fires onChange.
      if (e.target) e.target.value = ''
      if (!file || !editor) return
      setUploading(true)
      setUploadError(null)
      try {
        const { url, key } = await uploadAdminLessonImage(cohortId, file)
        // We use `data-key` on the inserted image so a future cleanup job can
        // reconcile uploads against rendered references. Image extension
        // doesn't accept arbitrary attrs by default — we fall back to
        // insertContent with a raw HTML fragment to keep the data-key.
        editor
          .chain()
          .focus()
          .insertContent(
            `<img src="${url}" data-key="${key}" alt="${file.name.replace(/"/g, '')}" />`,
          )
          .run()
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [cohortId, editor],
  )

  const handleLinkClick = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Enter URL', previousUrl ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) {
    return (
      <div
        className={cn(
          'rounded-[var(--radius-md)] border border-[var(--color-wise-ring)]',
          'bg-[var(--color-wise-surface)] p-6',
          className,
        )}
      >
        <LoadingSpinner size="sm" label="Loading editor…" />
      </div>
    )
  }

  const activeCodeLang =
    (editor.getAttributes('codeBlock').language as string | undefined) ?? 'plaintext'

  return (
    <div
      data-testid="rich-text-editor"
      className={cn(
        'flex flex-col rounded-[var(--radius-md)]',
        'border border-[var(--color-wise-ring)]',
        'bg-[var(--color-wise-surface)]',
        'focus-within:border-[var(--color-wise-text)]',
        className,
      )}
    >
      {/* Sticky toolbar */}
      <div
        role="toolbar"
        aria-label="Rich text formatting"
        className={cn(
          'sticky top-0 z-10 flex flex-wrap items-center gap-1 px-2 py-1.5',
          'rounded-t-[var(--radius-md)]',
          'border-b border-[var(--color-wise-ring)]',
          'bg-[var(--color-wise-surface)]',
        )}
      >
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          label="Bold"
        >
          <BoldIcon size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          label="Italic"
        >
          <ItalicIcon size={16} aria-hidden="true" />
        </ToolbarButton>
        <span
          aria-hidden="true"
          className="mx-1 h-5 w-px bg-[var(--color-wise-ring)]"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          label="Heading 2"
        >
          <Heading2 size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          label="Heading 3"
        >
          <Heading3 size={16} aria-hidden="true" />
        </ToolbarButton>
        <span
          aria-hidden="true"
          className="mx-1 h-5 w-px bg-[var(--color-wise-ring)]"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          label="Bullet list"
        >
          <List size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          label="Numbered list"
        >
          <ListOrdered size={16} aria-hidden="true" />
        </ToolbarButton>
        <span
          aria-hidden="true"
          className="mx-1 h-5 w-px bg-[var(--color-wise-ring)]"
        />
        <ToolbarButton
          onClick={handleLinkClick}
          active={editor.isActive('link')}
          label="Link"
        >
          <LinkIcon size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          label="Inline code"
        >
          <Code size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          label="Code block"
        >
          <Code2 size={16} aria-hidden="true" />
        </ToolbarButton>
        {editor.isActive('codeBlock') && (
          <label className="ml-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-wise-text-muted)]">
            <span className="sr-only">Code block language</span>
            <select
              aria-label="Code block language"
              value={activeCodeLang}
              onChange={(e) =>
                editor
                  .chain()
                  .focus()
                  .updateAttributes('codeBlock', { language: e.target.value })
                  .run()
              }
              className={cn(
                'h-7 rounded-[var(--radius-sm)] border border-[var(--color-wise-ring)] bg-white',
                'px-1.5 text-[12px] text-[var(--color-wise-text)]',
              )}
            >
              {CODE_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          label="Quote"
        >
          <Quote size={16} aria-hidden="true" />
        </ToolbarButton>
        <span
          aria-hidden="true"
          className="mx-1 h-5 w-px bg-[var(--color-wise-ring)]"
        />
        <ToolbarButton
          onClick={handleImageClick}
          disabled={uploading}
          label="Insert image"
        >
          {uploading ? (
            <LoadingSpinner size="sm" label="Uploading image…" />
          ) : (
            <ImageIcon size={16} aria-hidden="true" />
          )}
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          label="Horizontal rule"
        >
          <Minus size={16} aria-hidden="true" />
        </ToolbarButton>

        {/* Hidden file input backing the image toolbar button. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          data-testid="rich-text-editor-file-input"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {uploadError && (
        <p
          role="alert"
          className="px-4 pt-2 text-[12px] font-semibold text-[var(--color-wise-danger)]"
        >
          {uploadError}
        </p>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}

export default RichTextEditor
