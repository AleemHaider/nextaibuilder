// NAB-P0-2 — Shared tag-style editor for bullet-array fields on the course
// builder: "What you'll learn", "Requirements", "Who this course is for".
//
// Behaviour contract:
//   - Type and press Enter (or comma) to commit a tag.
//   - Backspace on an empty field pops the trailing tag (quick undo).
//   - Click the × on a pill to remove that tag.
//   - `maxTags` caps the array length; the committer silently no-ops when
//     hit and the input is disabled visually.
//   - `maxLength` caps per-entry length, matched to the backend Zod schema
//     (140 chars).
//   - Drag-to-reorder is delegated to the caller via <SortableList> wrapping
//     this input's items — keeping TagInput itself stateless about order.
//
// Styling pulls the wise-mint pill tokens called out in the P0-2 spec and
// reuses the <Input> primitive for the editor so focus/hover rings stay
// consistent with the rest of the admin builder surfaces.
import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from './Input'

export interface TagInputProps {
  /** Current tag array. Controlled. */
  value: string[]
  /** Emitted whenever the array changes (add / remove). */
  onChange: (next: string[]) => void
  /** Maximum number of tags. Once reached the input disables commits. */
  maxTags: number
  /** Per-tag character cap. Defaults to 140 (matches backend Zod schema). */
  maxLength?: number
  /** Placeholder shown in the editor. */
  placeholder?: string
  /** Id applied to the input — pair with a <FormField> / <label htmlFor>. */
  id?: string
  /** aria-describedby target for form-field wiring. */
  'aria-describedby'?: string
  /** Visual-only disable (e.g. while parent is saving). */
  disabled?: boolean
}

export function TagInput({
  value,
  onChange,
  maxTags,
  maxLength = 140,
  placeholder,
  id,
  'aria-describedby': ariaDescribedBy,
  disabled = false,
}: TagInputProps) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const atCap = value.length >= maxTags
  const canCommit = !disabled && !atCap

  function commit(raw: string) {
    if (!canCommit) return
    const entry = raw.trim()
    if (!entry) return
    // Silent truncate — the backend rejects anything longer, and losing the
    // tail is better than losing the whole submit.
    const clipped = entry.slice(0, maxLength)
    // De-dupe so rapid Enter taps don't pile up the same bullet.
    if (value.includes(clipped)) {
      setDraft('')
      return
    }
    onChange([...value, clipped])
    setDraft('')
  }

  function removeAt(index: number) {
    if (disabled) return
    const next = value.slice()
    next.splice(index, 1)
    onChange(next)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Enter / comma commit. preventDefault stops form submission + literal
    // comma chars in the input.
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
      return
    }
    // Backspace on an empty input pops the last tag — a common pattern from
    // email/chip inputs (Gmail, Slack) that power users expect.
    if (e.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      e.preventDefault()
      removeAt(value.length - 1)
    }
  }

  return (
    <div
      data-slot="tag-input"
      data-at-cap={atCap ? 'true' : undefined}
      className="flex flex-col gap-2"
    >
      {/* Pills — rendered in array order. Drag-reorder is wired by the caller. */}
      {value.length > 0 ? (
        <ul
          data-slot="tag-input-list"
          className="flex flex-wrap gap-2 list-none p-0 m-0"
        >
          {value.map((tag, index) => (
            <li key={`${tag}-${index}`} className="list-none">
              <span
                data-slot="tag-input-pill"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1',
                  'text-[13px] font-semibold',
                  'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                )}
              >
                <span className="max-w-[30ch] truncate">{tag}</span>
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  onClick={() => removeAt(index)}
                  disabled={disabled}
                  className={cn(
                    'inline-flex h-4 w-4 items-center justify-center rounded-full',
                    'text-[var(--color-wise-primary-text)]/70',
                    'hover:enabled:bg-[var(--color-wise-primary-text)]/10 hover:enabled:text-[var(--color-wise-primary-text)]',
                    'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <X size={12} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Editor row: input + counter. Disabled appearance once cap is hit so
          users understand why Enter stops committing. */}
      <div className="flex items-center gap-3">
        <Input
          ref={inputRef}
          id={id}
          aria-describedby={ariaDescribedBy}
          inputSize="md"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Commit on blur too — matches Kajabi/Teachable tag inputs.
            if (draft.trim()) commit(draft)
          }}
          placeholder={
            atCap
              ? `Max ${maxTags} entries reached`
              : placeholder ?? 'Type and press Enter…'
          }
          disabled={disabled || atCap}
          maxLength={maxLength}
        />
        <span
          data-slot="tag-input-counter"
          aria-live="polite"
          className={cn(
            'shrink-0 text-[12px] font-semibold tabular-nums',
            atCap
              ? 'text-[var(--color-wise-danger)]'
              : 'text-[var(--color-wise-text-muted)]',
          )}
        >
          {value.length} / {maxTags}
        </span>
      </div>
    </div>
  )
}
