// FIR-165 — Admin Course Builder: list + edit with tabs (Overview, Curriculum, Live Sessions, Pricing)
// Wave 5 Story Y — Curriculum tab is API-backed with drag-reorder for modules + lessons.
// Sprint 2 Story 11 — handleSave / Pricing / Live Sessions wired to the admin API.
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebouncedAutosave, type AutosaveState } from '../../hooks/useDebouncedAutosave'
import AdminShell from '../../components/admin/AdminShell'
import {
  fetchAdminCourses,
  fetchAdminCourseDetail,
  createAdminCourse,
  updateAdminCourse,
  publishAdminCourse,
  type AdminCourse,
  type AdminCourseType,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { STALE_TIME } from '../../lib/queryConfig'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Types, constants, helpers, toast + save-state indicator moved into separate
// modules to keep this page focused. See:
//   - ./courseBuilder/types        — shared types + constants + factories
//   - ./courseBuilder/draftStorage — localStorage draft recovery helpers
//   - ./courseBuilder/SaveStateIndicator — header autosave chip
//   - ../../components/ui/Toast    — toast primitive promoted to ui/
// ---------------------------------------------------------------------------

// Re-export so existing intra-file references compile unchanged.
import {
  type CourseType,
  type CourseStatus,
  type EditorTab,
  type CourseDraft,
  TABS,
  newCourse,
} from './courseBuilder/types'
import {
  DRAFT_PERSIST_INTERVAL_MS,
  type StoredDraftEntry,
  getOrCreateSessionUuid,
  readStoredDraft,
  writeStoredDraft,
  clearStoredDraft,
  isEmptyNewDraft,
} from './courseBuilder/draftStorage'
import { SaveStateIndicator } from './courseBuilder/SaveStateIndicator'
import { CourseListSidebar } from './courseBuilder/CourseListSidebar'
import { PricingTab } from './courseBuilder/PricingTab'
import { LiveSessionsTab } from './courseBuilder/LiveSessionsTab'
import { OverviewTab } from './courseBuilder/OverviewTab'
import { CurriculumTab } from './courseBuilder/CurriculumTab'
import { Toast, useToast } from '../../components/ui/Toast'

// ---------------------------------------------------------------------------
// Course List Sidebar
// ---------------------------------------------------------------------------

// CourseListSidebar moved to ./courseBuilder/CourseListSidebar





// ---------------------------------------------------------------------------
// Enrollments placeholder (still a future epic)
// ---------------------------------------------------------------------------

function PlaceholderTabContent({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
      <div className="text-[48px] mb-4" aria-hidden="true">🚧</div>
      <p className="text-[16px] font-[600] text-[#1a2744]">{label}</p>
      <p className="text-[14px] text-[#717182] mt-1">This tab is managed in a future epic.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CourseEditor — right panel
// ---------------------------------------------------------------------------

interface CourseEditorProps {
  draft: CourseDraft
  onChange: (updated: Partial<CourseDraft>) => void
  onSave: () => void
  onTogglePublish: () => void
  isSaving: boolean
  isPublishing: boolean
  isAdmin: boolean
  addToast: (message: string, variant: 'success' | 'error') => void
  // NAB-P0-1 — autosave state + draft-recovery plumbed from the parent.
  autosaveState: AutosaveState
  autosaveSavedAt: number | null
  onAutosaveRetry: () => void
  recoverableDraft: StoredDraftEntry | null
  onResumeDraft: () => void
  onDiscardDraft: () => void
}

function CourseEditor({
  draft,
  onChange,
  onSave,
  onTogglePublish,
  isSaving,
  isPublishing,
  isAdmin,
  addToast,
  autosaveState,
  autosaveSavedAt,
  onAutosaveRetry,
  recoverableDraft,
  onResumeDraft,
  onDiscardDraft,
}: CourseEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('Overview')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Editor topbar */}
      <div className="bg-white border-b border-[rgba(26,39,68,0.08)] px-8 py-4 flex items-center gap-4">
        <input
          type="text"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-label="Course title"
          className="flex-1 text-[20px] font-[700] text-[#1a2744] bg-transparent border-none outline-none"
        />
        <span
          className={cn(
            'text-[11px] font-[600] px-[9px] py-[3px] rounded-full',
            draft.status === 'PUBLISHED' ? 'bg-[#e6f4ec] text-[#054d28]' : 'bg-[#fff8e6] text-[#8a5a00]',
          )}
        >
          {draft.status.charAt(0) + draft.status.slice(1).toLowerCase()}
        </span>
        {/* NAB-P0-1 — autosave chip sits to the right of the status pill so
            it stays in the user's eyeline without bumping the Save/Publish
            buttons. `aria-live=polite` is inside the component. */}
        <SaveStateIndicator
          state={autosaveState}
          savedAt={autosaveSavedAt}
          onRetry={onAutosaveRetry}
        />
        <div className="flex gap-2.5 ml-auto">
          <button
            type="button"
            onClick={onSave}
            // NAB-P0-1 — the Save button stays enabled even while an autosave
            // is in flight; handleSave() flushes the autosave first. We only
            // disable during the *manual* save request.
            disabled={isSaving}
            className="px-5 py-2 rounded-full bg-[#f0f0f0] text-[#1a2744] text-[14px] font-[700] hover:bg-[#e8ecf4] disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onTogglePublish}
            disabled={isPublishing}
            aria-busy={isPublishing || undefined}
            className="px-5 py-2 rounded-full bg-[#4a9ad4] text-[#0d1a3a] text-[14px] font-[700] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPublishing
              ? draft.status === 'PUBLISHED'
                ? 'Publishing…'
                : 'Unpublishing…'
              : draft.status === 'PUBLISHED'
                ? 'Unpublish'
                : 'Publish'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-0 bg-white border-b-2 border-[rgba(26,39,68,0.08)] px-8"
        role="tablist"
        aria-label="Course editor sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-5 py-3.5 text-[14px] font-[600] border-b-2 transition-colors -mb-[2px]',
              activeTab === tab
                ? 'text-[#4a9ad4] border-[#4a9ad4]'
                : 'text-[#717182] border-transparent hover:text-[#1a2744]',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto bg-[#f8f9fb]">
        {activeTab === 'Overview' && (
          <OverviewTab
            draft={draft}
            onChange={onChange}
            recoverableDraft={recoverableDraft}
            onResumeDraft={onResumeDraft}
            onDiscardDraft={onDiscardDraft}
          />
        )}
        {activeTab === 'Curriculum' && (
          <CurriculumTab
            cohortId={draft.id}
            draftModules={draft.modules}
            onDraftChange={(modules) => onChange({ modules })}
            isAdmin={isAdmin}
            addToast={addToast}
          />
        )}
        {activeTab === 'Live Sessions' && (
          <LiveSessionsTab
            cohortId={draft.id}
            isAdmin={isAdmin}
            addToast={addToast}
          />
        )}
        {activeTab === 'Pricing' && (
          <PricingTab
            cohortId={draft.id}
            isAdmin={isAdmin}
            addToast={addToast}
          />
        )}
        {activeTab === 'Enrollments' && <PlaceholderTabContent label="Course Enrollments" />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CourseBuilderPage
// ---------------------------------------------------------------------------

// The back-end course `type` enum is upper-cased (`RECORDED` / `LIVE` /
// `COMBINED`) whereas the UI draft uses lower-case. This keeps conversion in
// one place so handleSave and handleSelectCourse can't disagree.
function uiTypeToApi(t: CourseType): AdminCourseType {
  return t.toUpperCase() as AdminCourseType
}

// Convert an HTML <input type="date"> value (YYYY-MM-DD) into an ISO datetime
// string at UTC midnight. Empty / invalid input returns undefined so the
// field is omitted from the request body.
function dateInputToIso(value: string): string | undefined {
  if (!value) return undefined
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

// NAB-P0-1 — shared payload builder so autosave and the manual Save button
// send identical shapes. Keeping it free-standing keeps the parent component
// body small and makes the test surface straightforward (pass a draft, check
// what would be sent).
function buildCoursePayload(draft: CourseDraft) {
  const maxSeatsNumber =
    draft.maxSeats.trim() === '' ? undefined : Number(draft.maxSeats)
  return {
    title: draft.title,
    type: uiTypeToApi(draft.type),
    tagline: draft.tagline || undefined,
    description: draft.description || undefined,
    maxSeats:
      Number.isFinite(maxSeatsNumber) && (maxSeatsNumber as number) > 0
        ? (maxSeatsNumber as number)
        : undefined,
    liveStartDate: dateInputToIso(draft.startDate),
    liveEndDate: dateInputToIso(draft.endDate),
    learningOutcomes: draft.learningOutcomes,
    requirements: draft.requirements,
    targetAudience: draft.targetAudience,
    // NAB-P0-3 — instructor assignments. Always sent so removals persist.
    instructorIds: draft.instructorIds,
  }
}

export default function CourseBuilderPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<AdminCourse | null | undefined>(undefined)
  const [draft, setDraft] = useState<CourseDraft | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  // NAB-P0-1 — draft recovery banner state. Populated once when the page
  // first mounts in "new course" mode and there's a stored draft in
  // localStorage. Resume/Discard clear this to null so the banner drops.
  const [recoverableDraft, setRecoverableDraft] = useState<StoredDraftEntry | null>(null)
  const sessionUuid = useMemo(() => getOrCreateSessionUuid(), [])

  const queryClient = useQueryClient()
  const { toasts, addToast, dismissToast } = useToast()

  // Belt-and-braces role guard on top of <AdminRoute>. The drag handles only
  // render when the authenticated user is ADMIN/SUPER_ADMIN — if somehow this
  // page is rendered without that role, drag is disabled at the SortableList.
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-courses', debouncedQuery],
    queryFn: () => fetchAdminCourses(debouncedQuery || undefined),
    staleTime: STALE_TIME.long,
  })

  const courses = data?.courses ?? []

  function handleSelectCourse(course: AdminCourse | null) {
    setSelectedCourse(course)
    if (course === null) {
      setDraft(newCourse())
      return
    }

    // Seed the draft synchronously from the list row so the editor mounts
    // immediately, then hydrate the fields that live only on the detail
    // endpoint (description + NAB-P0-2 bullet arrays). If the detail fetch
    // fails we keep the sidebar-seeded defaults and surface a toast.
    setDraft({
      id: course.id,
      title: course.title,
      slug: course.slug,
      tagline: course.tagline ?? '',
      description: '',
      type: course.type,
      status: course.status,
      startDate: course.startDate ?? '',
      endDate: course.endDate ?? '',
      maxSeats: course.maxSeats != null ? String(course.maxSeats) : '',
      coverImageKey: course.coverImageKey ?? null,
      modules: [],
      learningOutcomes: [],
      requirements: [],
      targetAudience: [],
      instructorIds: [],
      instructors: [],
    })

    void (async () => {
      try {
        const detail = await fetchAdminCourseDetail(course.id)
        // Guard against the user jumping to a different course before the
        // fetch resolves — only merge if we're still looking at the same id.
        setDraft((prev) =>
          prev && prev.id === course.id
            ? {
                ...prev,
                description:      detail.description ?? '',
                learningOutcomes: detail.learningOutcomes,
                requirements:     detail.requirements,
                targetAudience:   detail.targetAudience,
                // NAB-P0-3 — hydrate the instructor chips + the ordered id list.
                instructorIds:    detail.instructorIds,
                instructors:      detail.instructors,
              }
            : prev,
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load course detail'
        addToast(message, 'error')
      }
    })()
  }

  function handleDraftChange(updated: Partial<CourseDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...updated } : prev))
  }

  // ── NAB-P0-1 — Autosave wiring ────────────────────────────────────────
  //
  // The hook observes `draft` and fires `save(snapshot)` 800ms after the last
  // edit. We only PATCH when draft.id is set — for brand-new drafts the
  // localStorage effect below handles persistence, and the first create is
  // intentionally left to the manual Save button (so users have explicit
  // control over when a new cohort record is born server-side).
  const autosaveCallback = useCallback(
    async (snapshot: CourseDraft) => {
      if (!snapshot.id) return
      await updateAdminCourse(snapshot.id, buildCoursePayload(snapshot))
      // Keep the sidebar row + detail cache in sync after a successful PATCH
      // so a subsequent selectCourse() sees fresh data without a hard refetch.
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses', snapshot.id] })
    },
    [queryClient],
  )

  const autosave = useDebouncedAutosave<CourseDraft | null>(
    draft,
    async (snapshot) => {
      if (snapshot) await autosaveCallback(snapshot)
    },
    800,
  )

  // ── NAB-P0-1 — localStorage draft recovery ────────────────────────────
  //
  // When an unsaved draft (no id) is being edited we persist it to
  // localStorage at most every 500ms. Once the draft flips to server-backed
  // (id is set) we clear the entry — the server is now the source of truth.
  const lastPersistRef = useRef(0)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!draft) return
    if (draft.id !== null) {
      // Draft is now server-backed — the localStorage copy is redundant.
      clearStoredDraft(sessionUuid)
      return
    }
    // Throttle writes to at most one per 500ms to match the spec.
    const now = Date.now()
    const elapsed = now - lastPersistRef.current
    const scheduleWrite = () => {
      lastPersistRef.current = Date.now()
      writeStoredDraft(sessionUuid, draft)
    }
    if (elapsed >= DRAFT_PERSIST_INTERVAL_MS) {
      scheduleWrite()
    } else {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
      persistTimerRef.current = setTimeout(scheduleWrite, DRAFT_PERSIST_INTERVAL_MS - elapsed)
    }
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }
  }, [draft, sessionUuid])

  // Whenever the draft becomes an "empty new course" (the user just clicked
  // + New Course without typing), check localStorage for a recoverable draft
  // and surface the banner. Typing into the form shifts the draft away from
  // the empty shape so the banner naturally drops.
  useEffect(() => {
    if (!draft) {
      setRecoverableDraft(null)
      return
    }
    if (draft.id !== null) {
      setRecoverableDraft(null)
      return
    }
    if (!isEmptyNewDraft(draft)) {
      // User has typed — don't nag with a recovery banner over their input.
      setRecoverableDraft(null)
      return
    }
    const existing = readStoredDraft(sessionUuid)
    // Only surface the banner when the stored draft is *different* from the
    // current blank one; otherwise there's nothing to resume.
    if (existing && !isEmptyNewDraft(existing.draft)) {
      setRecoverableDraft(existing)
    } else {
      setRecoverableDraft(null)
    }
  }, [draft, sessionUuid])

  const handleResumeDraft = useCallback(() => {
    if (!recoverableDraft) return
    setDraft(recoverableDraft.draft)
    setSelectedCourse(null)
    setRecoverableDraft(null)
  }, [recoverableDraft])

  const handleDiscardDraft = useCallback(() => {
    clearStoredDraft(sessionUuid)
    setRecoverableDraft(null)
  }, [sessionUuid])

  // Sprint 2 Story 11 — real handleSave.
  // Creates a cohort via POST when draft.id is empty, otherwise PATCHes the
  // existing cohort. On success we flip draft.id (or update the selected
  // course row) and invalidate the admin-courses list so the sidebar refreshes
  // without a full refetch loop.
  //
  // NAB-P0-1 — we now flush() the autosave hook first so any debounced save
  // either completes or is cancelled before the manual request fires. Without
  // this the two PATCHes could race and the later one could clobber a stale
  // snapshot. If the autosave is in the `error` state we still push through
  // with a fresh payload — the manual Save is the user's explicit escape
  // hatch from a stuck autosave.
  async function handleSave() {
    if (!draft) return
    setIsSaving(true)
    try {
      await autosave.flush()
    } catch {
      // flush() never rejects — but guard anyway so we always fall through.
    }

    const payload = buildCoursePayload(draft)

    try {
      if (!draft.id) {
        const created = await createAdminCourse(payload)
        // Flip into server-backed mode — setting draft.id unlocks the
        // ServerCurriculumList / PricingTab / LiveSessionsTab data fetches.
        setDraft((prev) => (prev ? { ...prev, id: created.id } : prev))
        queryClient.invalidateQueries({ queryKey: ['admin-courses'] })
        // Once the draft has a real id, the localStorage copy is redundant.
        clearStoredDraft(sessionUuid)
        addToast('Course created', 'success')
      } else {
        await updateAdminCourse(draft.id, payload)
        queryClient.invalidateQueries({ queryKey: ['admin-courses'] })
        // Also invalidate the per-cohort detail cache used by the curriculum
        // tab — the title/slug may have changed.
        queryClient.invalidateQueries({
          queryKey: ['admin', 'courses', draft.id],
        })
        addToast('Course saved', 'success')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save course'
      addToast(message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Sprint 2 Story 11 — real publish toggle with optimistic UI and rollback.
  // Matches the module-reorder pattern from Wave 5 Story Y: flip the status
  // locally, fire the PATCH, and on failure restore the prior status + toast.
  async function handleTogglePublish() {
    if (!draft) return
    // Publish is only meaningful once the course is persisted. Early-return
    // with a toast so users understand why the button is a no-op for drafts.
    if (!draft.id) {
      addToast('Save the course before publishing', 'error')
      return
    }
    if (isPublishing) return

    const currentStatus = draft.status
    const nextStatus: CourseStatus =
      currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    const targetPublished = nextStatus === 'PUBLISHED'

    setIsPublishing(true)
    // Optimistic update.
    setDraft((prev) => (prev ? { ...prev, status: nextStatus } : prev))

    try {
      await publishAdminCourse(draft.id, targetPublished)
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] })
      addToast(
        targetPublished ? 'Course published' : 'Course unpublished',
        'success',
      )
    } catch (err) {
      // Rollback the optimistic status.
      setDraft((prev) => (prev ? { ...prev, status: currentStatus } : prev))
      const message =
        err instanceof Error ? err.message : 'Failed to toggle publish'
      addToast(message, 'error')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <AdminShell title="Courses">
      {/* Toast stack */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={dismissToast} />
          </div>
        ))}
      </div>

      <div className="flex h-full overflow-hidden">
        {/* Course list sidebar */}
        <CourseListSidebar
          courses={courses}
          isLoading={isLoading}
          selectedId={selectedCourse?.id ?? (selectedCourse === null ? null : undefined) ?? null}
          onSelect={handleSelectCourse}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Editor or empty state */}
        {draft ? (
          <CourseEditor
            draft={draft}
            onChange={handleDraftChange}
            onSave={handleSave}
            onTogglePublish={handleTogglePublish}
            isSaving={isSaving}
            isPublishing={isPublishing}
            isAdmin={isAdmin}
            addToast={addToast}
            autosaveState={autosave.state}
            autosaveSavedAt={autosave.savedAt}
            onAutosaveRetry={autosave.retry}
            recoverableDraft={recoverableDraft}
            onResumeDraft={handleResumeDraft}
            onDiscardDraft={handleDiscardDraft}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#f8f9fb]">
            <div className="text-[56px] mb-5" aria-hidden="true">📚</div>
            <p className="text-[18px] font-[700] text-[#1a2744]">Select a course to edit</p>
            <p className="text-[14px] text-[#717182] mt-1 max-w-xs">
              Choose a course from the left panel, or create a new one.
            </p>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
