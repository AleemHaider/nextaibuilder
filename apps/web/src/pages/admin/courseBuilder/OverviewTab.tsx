// Overview tab — course metadata, marketing bullets, instructor, dates, seats,
// cover image. Renders the draft-recovery banner at the top when the parent
// has a stored localStorage draft.

import { AlertTriangle } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { FormField } from '../../../components/ui/FormField'
import { TagInput } from '../../../components/ui/TagInput'
import { cn } from '../../../lib/utils'
import {
  type CourseDraft,
  COURSE_TYPES,
  TYPE_ICON_COLORS,
  MAX_LEARNING_OUTCOMES,
  MAX_REQUIREMENTS,
  MAX_TARGET_AUDIENCE,
  BULLET_ENTRY_MAX_LENGTH,
} from './types'
import { type StoredDraftEntry, formatBannerRelative } from './draftStorage'
import { InstructorSection } from './InstructorSection'
import { CoverImageDropzone } from './CoverImageDropzone'

export function OverviewTab({
  draft,
  onChange,
  recoverableDraft,
  onResumeDraft,
  onDiscardDraft,
}: {
  draft: CourseDraft
  onChange: (updated: Partial<CourseDraft>) => void
  recoverableDraft?: StoredDraftEntry | null
  onResumeDraft?: () => void
  onDiscardDraft?: () => void
}) {
  return (
    <div className="p-8">
      {/* NAB-P0-1 — localStorage draft recovery banner. Only appears when
          the parent page detected an unsaved draft in localStorage *and*
          the current draft is the blank "new course" shape. Once the user
          either resumes or discards, the parent hides this. */}
      {recoverableDraft && onResumeDraft && onDiscardDraft && (
        <div
          role="status"
          aria-live="polite"
          data-testid="draft-recovery-banner"
          className="mb-6 flex items-center gap-3 p-4 rounded-[12px] border border-[var(--color-wise-ring)] bg-[var(--color-wise-mint)]"
        >
          <AlertTriangle
            size={18}
            className="text-[var(--color-wise-primary-text)] flex-shrink-0"
            aria-hidden="true"
          />
          <p className="flex-1 text-[14px] text-[var(--color-wise-text)]">
            Resume unsaved draft from{' '}
            {formatBannerRelative(recoverableDraft.savedAt, Date.now())} ago?
          </p>
          <Button variant="primary" size="sm" onClick={onResumeDraft}>
            Resume
          </Button>
          <Button variant="ghost" size="sm" onClick={onDiscardDraft}>
            Discard
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          {/* Title */}
          <div>
            <label htmlFor="course-title" className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
              Course title
            </label>
            <input
              id="course-title"
              type="text"
              value={draft.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className={cn(
                'w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white',
                'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none',
                'focus:border-[#4a9ad4] transition-colors',
              )}
            />
          </div>

          {/* Course type */}
          <div>
            <label className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
              Course type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {COURSE_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => onChange({ type: ct.value })}
                  className={cn(
                    'border-2 rounded-[14px] p-4 flex items-start gap-3 text-left transition-colors',
                    draft.type === ct.value
                      ? 'border-[#4a9ad4] bg-[#eef6fd]'
                      : 'border-[rgba(26,39,68,0.12)] hover:border-[#4a9ad4]',
                  )}
                  aria-pressed={draft.type === ct.value}
                >
                  <div className={cn('w-9 h-9 rounded-[10px] flex items-center justify-center text-[18px] flex-shrink-0', TYPE_ICON_COLORS[ct.value])}>
                    {ct.icon}
                  </div>
                  <div>
                    <div className="text-[14px] font-[700] text-[#1a2744]">{ct.label}</div>
                    <div className="text-[12px] text-[#717182]">{ct.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tagline */}
          <div>
            <label htmlFor="course-tagline" className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
              Tagline
            </label>
            <input
              id="course-tagline"
              type="text"
              value={draft.tagline}
              onChange={(e) => onChange({ tagline: e.target.value })}
              placeholder="Short compelling summary…"
              className={cn(
                'w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white',
                'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none',
                'focus:border-[#4a9ad4] transition-colors',
              )}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="course-desc" className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
              Description
            </label>
            <textarea
              id="course-desc"
              value={draft.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={4}
              placeholder="Describe what students will learn…"
              className={cn(
                'w-full rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white',
                'px-4 py-3 text-[15px] text-[#1a2744] font-[inherit] outline-none resize-none',
                'focus:border-[#4a9ad4] transition-colors',
              )}
            />
          </div>

          {/* NAB-P0-2 — Marketing bullets. Three lists share the TagInput
              shape; caps vary per spec. Storefront cohort page renders these
              as "What you'll learn / Requirements / Who this course is for". */}
          <FormField
            id="course-learning-outcomes"
            label="What you'll learn"
            helperText="Bullets shown on the public cohort page. Press Enter or comma to add."
          >
            <TagInput
              id="course-learning-outcomes"
              value={draft.learningOutcomes}
              onChange={(next) => onChange({ learningOutcomes: next })}
              maxTags={MAX_LEARNING_OUTCOMES}
              maxLength={BULLET_ENTRY_MAX_LENGTH}
              placeholder="e.g. Ship a full-stack AI app end-to-end"
            />
          </FormField>

          <FormField
            id="course-requirements"
            label="Requirements"
            helperText="Prerequisites students need before enrolling."
          >
            <TagInput
              id="course-requirements"
              value={draft.requirements}
              onChange={(next) => onChange({ requirements: next })}
              maxTags={MAX_REQUIREMENTS}
              maxLength={BULLET_ENTRY_MAX_LENGTH}
              placeholder="e.g. Basic JavaScript or Python"
            />
          </FormField>

          <FormField
            id="course-target-audience"
            label="Who this course is for"
            helperText="Short bullets that describe the ideal student."
          >
            <TagInput
              id="course-target-audience"
              value={draft.targetAudience}
              onChange={(next) => onChange({ targetAudience: next })}
              maxTags={MAX_TARGET_AUDIENCE}
              maxLength={BULLET_ENTRY_MAX_LENGTH}
              placeholder="e.g. Founders ready to ship their first AI product"
            />
          </FormField>

          {/* NAB-P0-3 — Instructor picker. Typeahead search + attached-chip
              list + "Create new instructor profile" modal. First chip is
              marked primary via a lucide Star icon. */}
          <InstructorSection draft={draft} onChange={onChange} />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="course-start" className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
                Start date
              </label>
              <input
                id="course-start"
                type="date"
                value={draft.startDate}
                onChange={(e) => onChange({ startDate: e.target.value })}
                className={cn(
                  'w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white',
                  'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none',
                  'focus:border-[#4a9ad4] transition-colors',
                )}
              />
            </div>
            <div>
              <label htmlFor="course-end" className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
                End date
              </label>
              <input
                id="course-end"
                type="date"
                value={draft.endDate}
                onChange={(e) => onChange({ endDate: e.target.value })}
                className={cn(
                  'w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white',
                  'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none',
                  'focus:border-[#4a9ad4] transition-colors',
                )}
              />
            </div>
          </div>

          {/* Max seats */}
          <div>
            <label htmlFor="course-seats" className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
              Maximum seats
            </label>
            <input
              id="course-seats"
              type="number"
              value={draft.maxSeats}
              onChange={(e) => onChange({ maxSeats: e.target.value })}
              min="0"
              placeholder="0 = unlimited"
              className={cn(
                'w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white',
                'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none',
                'focus:border-[#4a9ad4] transition-colors',
              )}
            />
          </div>
        </div>

        {/* Right column: cover image */}
        <div>
          <label className="block text-[13px] font-[600] text-[#1a2744] mb-1.5">
            Cover image
          </label>
          <CoverImageDropzone
            cohortId={draft.id}
            coverImageKey={draft.coverImageKey}
            onUploaded={(key) => onChange({ coverImageKey: key })}
          />
        </div>
      </div>
    </div>
  )
}
