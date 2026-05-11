// NAB-P0-3 — InstructorSection (typeahead + attached chips + create modal).
//
// Two components in one file because they're tightly coupled:
//   • InstructorSection — search + chip list + "create new" trigger
//   • CreateInstructorProfileModal — the modal opened by the create trigger
//
// Splitting them across files would just push the modal one component deeper
// without any independent reuse value.

import { useState, useEffect, useMemo } from 'react'
import { Star, X as XIcon, Plus } from 'lucide-react'
import {
  fetchAdminInstructorProfiles,
  createAdminInstructorProfile,
  uploadAdminInstructorAvatar,
  instructorAvatarUrl,
  type InstructorProfile as InstructorProfileType,
  type InstructorSummary,
  type InstructorSocialLink,
  type InstructorSocialPlatform,
} from '../../../lib/api'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { FormField } from '../../../components/ui/FormField'
import { Modal } from '../../../components/ui/Modal'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { cn } from '../../../lib/utils'
import type { CourseDraft } from './types'

const INSTRUCTOR_SEARCH_DEBOUNCE_MS = 300
const INSTRUCTOR_SOCIAL_PLATFORMS: InstructorSocialPlatform[] = [
  'TWITTER', 'X', 'LINKEDIN', 'GITHUB', 'YOUTUBE', 'WEBSITE',
]
const INSTRUCTOR_AVATAR_ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const INSTRUCTOR_AVATAR_MAX_BYTES = 5 * 1024 * 1024
const INSTRUCTOR_BIO_MAX = 2000

export function InstructorSection({
  draft,
  onChange,
}: {
  draft: CourseDraft
  onChange: (updated: Partial<CourseDraft>) => void
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<InstructorProfileType[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  // Debounce the query — the spec calls for a typeahead so we avoid firing
  // a search per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), INSTRUCTOR_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  // Fetch matching profiles whenever the debounced query changes. An empty
  // query clears the result panel (we don't want to spam the endpoint just
  // to render the cold state — users must type at least 1 char).
  useEffect(() => {
    let cancelled = false
    if (!debouncedQuery.trim()) {
      setResults([])
      setSearchError(null)
      return
    }
    setIsSearching(true)
    fetchAdminInstructorProfiles(debouncedQuery)
      .then((res) => {
        if (cancelled) return
        setResults(res.profiles)
        setSearchError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setSearchError(err instanceof Error ? err.message : 'Failed to search instructors')
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  function attachInstructor(profile: InstructorProfileType) {
    if (draft.instructorIds.includes(profile.id)) return
    onChange({
      instructorIds: [...draft.instructorIds, profile.id],
      instructors:   [
        ...draft.instructors,
        {
          id:        profile.id,
          name:      profile.name,
          title:     profile.title ?? '',
          avatarKey: profile.avatarKey,
          avatarUrl: instructorAvatarUrl(profile.avatarKey),
        },
      ],
    })
    // Clear the typeahead after attach — mirrors Circle / Maven UX.
    setQuery('')
    setResults([])
  }

  function detachInstructor(id: string) {
    onChange({
      instructorIds: draft.instructorIds.filter((x) => x !== id),
      instructors:   draft.instructors.filter((x) => x.id !== id),
    })
  }

  function promoteToPrimary(id: string) {
    if (!draft.instructorIds.includes(id) || draft.instructorIds[0] === id) return
    const nextIds = [id, ...draft.instructorIds.filter((x) => x !== id)]
    const nextSummaries = nextIds
      .map((x) => draft.instructors.find((s) => s.id === x))
      .filter((v): v is InstructorSummary => Boolean(v))
    onChange({ instructorIds: nextIds, instructors: nextSummaries })
  }

  // Hide already-attached entries from the typeahead results — a no-op
  // "attach" is confusing UX. The back-end allows duplicates anyway.
  const visibleResults = useMemo(
    () => results.filter((r) => !draft.instructorIds.includes(r.id)),
    [results, draft.instructorIds],
  )

  return (
    <div data-testid="instructor-section">
      <label
        className="block text-[13px] font-[600] text-[#1a2744] mb-1.5"
        htmlFor="course-instructor-search"
      >
        Instructor
      </label>

      {/* Attached instructors render as pill chips above the input. */}
      {draft.instructors.length > 0 && (
        <ul
          data-testid="instructor-chip-list"
          className="mb-2 flex flex-wrap gap-2 list-none p-0 m-0"
        >
          {draft.instructors.map((ins, idx) => {
            const isPrimary = idx === 0
            return (
              <li
                key={ins.id}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full pl-1.5 pr-2 py-1',
                  'border border-[rgba(26,39,68,0.15)] bg-white',
                  isPrimary && 'border-[var(--color-wise-primary-text)] bg-[var(--color-wise-mint)]',
                )}
                data-testid={`instructor-chip-${ins.id}`}
              >
                {ins.avatarUrl ? (
                  <img
                    src={ins.avatarUrl}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-6 w-6 rounded-full bg-[#e8ecf4] flex items-center justify-center text-[11px] font-bold text-[#1a2744]"
                  >
                    {ins.name.charAt(0).toUpperCase()}
                  </span>
                )}
                {isPrimary ? (
                  <Star
                    size={12}
                    className="text-[var(--color-wise-primary-text)]"
                    aria-label="Primary instructor"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => promoteToPrimary(ins.id)}
                    aria-label={`Make ${ins.name} primary instructor`}
                    className="text-[#717182] hover:text-[#1a2744]"
                  >
                    <Star size={12} />
                  </button>
                )}
                <span className="text-[13px] font-[600] text-[#1a2744]">
                  {ins.name}
                </span>
                {ins.title ? (
                  <span className="text-[12px] text-[#717182]">{ins.title}</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => detachInstructor(ins.id)}
                  aria-label={`Remove ${ins.name}`}
                  className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full text-[#717182] hover:bg-[#f1f3f7] hover:text-[#1a2744]"
                >
                  <XIcon size={12} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Input
        id="course-instructor-search"
        data-testid="instructor-search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search instructor profiles by name or title…"
        aria-label="Search instructor profiles"
      />

      {/* Result list renders below the input, but only once the user has
          typed. An "empty search" state shows nothing — the initial state
          is already the input placeholder. */}
      {debouncedQuery.trim() ? (
        <div
          data-testid="instructor-search-results"
          className="mt-2 rounded-[12px] border border-[rgba(26,39,68,0.15)] bg-white overflow-hidden"
        >
          {isSearching ? (
            <div className="px-4 py-3 text-[13px] text-[#717182] flex items-center gap-2">
              <LoadingSpinner size="sm" /> Searching…
            </div>
          ) : searchError ? (
            <div className="px-4 py-3 text-[13px] text-[#d03238]" role="alert">
              {searchError}
            </div>
          ) : visibleResults.length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-[#717182]">
              No instructor profiles match "{debouncedQuery}".
            </div>
          ) : (
            <ul className="list-none p-0 m-0">
              {visibleResults.map((p) => (
                <li
                  key={p.id}
                  className="border-b last:border-b-0 border-[rgba(26,39,68,0.08)]"
                >
                  <button
                    type="button"
                    onClick={() => attachInstructor(p)}
                    data-testid={`instructor-result-${p.id}`}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f8f9fb]"
                  >
                    {p.avatarKey ? (
                      <img
                        src={instructorAvatarUrl(p.avatarKey) ?? ''}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="h-8 w-8 rounded-full bg-[#e8ecf4] flex items-center justify-center text-[12px] font-bold text-[#1a2744]"
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-[600] text-[#1a2744] truncate">
                        {p.name}
                      </div>
                      {p.title ? (
                        <div className="text-[12px] text-[#717182] truncate">
                          {p.title}
                        </div>
                      ) : null}
                    </div>
                    <Plus size={14} className="text-[#4a9ad4]" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            data-testid="instructor-create-link"
            className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] font-[600] text-[#4a9ad4] border-t border-[rgba(26,39,68,0.08)] hover:bg-[#eef6fd]"
          >
            <Plus size={14} aria-hidden="true" />
            Create new instructor profile
          </button>
        </div>
      ) : (
        <div className="mt-1.5 text-[12px] text-[#717182]">
          Attach one or more instructor profiles. The first is shown as the primary
          on the storefront.
        </div>
      )}

      {createOpen && (
        <CreateInstructorProfileModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(profile) => {
            attachInstructor(profile)
            setCreateOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ── Create-profile modal ───────────────────────────────────────────────────

function CreateInstructorProfileModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (profile: InstructorProfileType) => void
}) {
  const [userId, setUserId] = useState('')
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [socialLinks, setSocialLinks] = useState<InstructorSocialLink[]>([])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addSocial() {
    if (socialLinks.length >= 5) return
    setSocialLinks([...socialLinks, { platform: 'TWITTER', url: '' }])
  }
  function updateSocial(i: number, patch: Partial<InstructorSocialLink>) {
    setSocialLinks(socialLinks.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function removeSocial(i: number) {
    setSocialLinks(socialLinks.filter((_, idx) => idx !== i))
  }

  function onAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (!INSTRUCTOR_AVATAR_ACCEPTED.includes(file.type)) {
      setError('Headshot must be a JPEG, PNG, or WebP image.')
      e.target.value = ''
      return
    }
    if (file.size > INSTRUCTOR_AVATAR_MAX_BYTES) {
      setError('Headshot must be under 5 MB.')
      e.target.value = ''
      return
    }
    setError(null)
    setAvatarFile(file)
  }

  async function handleSubmit() {
    setError(null)
    if (!userId.trim() || !name.trim()) {
      setError('User ID and name are required.')
      return
    }
    if (bio.length > INSTRUCTOR_BIO_MAX) {
      setError(`Bio must be under ${INSTRUCTOR_BIO_MAX} characters.`)
      return
    }
    setSubmitting(true)
    try {
      const profile = await createAdminInstructorProfile({
        userId: userId.trim(),
        name:   name.trim(),
        title:  title.trim() || undefined,
        bio:    bio.trim() || undefined,
        socialLinks: socialLinks.filter((l) => l.url.trim().length > 0),
      })
      let final = profile
      if (avatarFile) {
        try {
          const { avatarKey } = await uploadAdminInstructorAvatar(profile.id, avatarFile)
          final = { ...profile, avatarKey }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Avatar upload failed — profile was created without a headshot.')
          // Still hand the parent the created profile so the attach happens.
        }
      }
      onCreated(final)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create instructor profile')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create instructor profile"
      description="This profile will be attached to the course as the primary instructor."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create profile'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-[10px] bg-[#fdeaeb] text-[#d03238] px-3 py-2 text-[13px] font-[500]"
          >
            {error}
          </div>
        )}

        <FormField
          id="instructor-user-id"
          label="User ID"
          helperText="Paste the Mongo ObjectId of the existing admin user this profile represents."
        >
          <Input
            id="instructor-user-id"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="64f0a1…"
          />
        </FormField>

        <FormField id="instructor-name" label="Name">
          <Input
            id="instructor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </FormField>

        <FormField id="instructor-title" label="Title">
          <Input
            id="instructor-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Senior AI Engineer"
          />
        </FormField>

        <FormField
          id="instructor-bio"
          label="Bio"
          helperText={`Plain text for now — rich text is a follow-up. ${bio.length}/${INSTRUCTOR_BIO_MAX}`}
        >
          <textarea
            id="instructor-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            maxLength={INSTRUCTOR_BIO_MAX}
            className={cn(
              'w-full rounded-[10px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white',
              'px-3 py-2 text-[14px] text-[#1a2744] outline-none resize-none',
              'focus:border-[#4a9ad4] transition-colors',
            )}
          />
        </FormField>

        <div>
          <p className="text-[13px] font-[600] text-[#1a2744] mb-1.5">
            Social links{' '}
            <span className="text-[12px] font-[400] text-[#717182]">
              ({socialLinks.length}/5)
            </span>
          </p>
          <div className="flex flex-col gap-2">
            {socialLinks.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  aria-label={`Social platform ${i + 1}`}
                  value={l.platform}
                  onChange={(e) =>
                    updateSocial(i, { platform: e.target.value as InstructorSocialPlatform })
                  }
                  className="h-9 rounded-[8px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white px-2 text-[13px] text-[#1a2744]"
                >
                  {INSTRUCTOR_SOCIAL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <Input
                  aria-label={`Social URL ${i + 1}`}
                  value={l.url}
                  onChange={(e) => updateSocial(i, { url: e.target.value })}
                  placeholder="https://…"
                />
                <button
                  type="button"
                  onClick={() => removeSocial(i)}
                  aria-label={`Remove social link ${i + 1}`}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[#717182] hover:bg-[#f1f3f7] hover:text-[#1a2744]"
                >
                  <XIcon size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={addSocial}
                disabled={socialLinks.length >= 5}
              >
                <Plus size={12} aria-hidden="true" />
                Add social link
              </Button>
            </div>
          </div>
        </div>

        <FormField
          id="instructor-avatar"
          label="Headshot"
          helperText="JPEG / PNG / WebP up to 5 MB. Uploaded after the profile is created."
        >
          <input
            id="instructor-avatar"
            type="file"
            accept={INSTRUCTOR_AVATAR_ACCEPTED.join(',')}
            onChange={onAvatarSelected}
            className="block w-full text-[13px] text-[#1a2744]"
          />
        </FormField>
      </div>
    </Modal>
  )
}
