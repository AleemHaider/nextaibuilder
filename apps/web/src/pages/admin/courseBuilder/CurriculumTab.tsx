// Curriculum tab — Wave 5 Story Y.
//
// Two modes:
//   1. Unsaved draft (cohortId === null) — uses local ModuleDraft state, no API.
//      Drag-reorder is disabled here because persisted IDs do not yet exist.
//      The user must save the course once for a real cohortId before editing
//      curriculum, matching the two-phase approach in Story Y.
//   2. Persisted course (cohortId is a string) — uses TanStack Query for
//      modules and lessons, with optimistic drag-reorder wired to the
//      PATCH /modules/reorder and /lessons/reorder endpoints.
//
// Three components live in this file because they share state shape and are
// only ever used together:
//   • CurriculumTab       — top-level dispatcher (draft vs server mode)
//   • DraftCurriculumList — local-only list shown before first save
//   • ServerCurriculumList — module CRUD with drag-reorder
//   • ServerLessonList    — lesson CRUD nested inside a module

import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, GripVertical, ChevronDown, ChevronUp, Video, Pencil, Trash2 } from 'lucide-react'
import {
  fetchAdminCourseModules,
  fetchAdminModuleLessons,
  reorderModules,
  reorderLessons,
  createAdminModule,
  updateAdminModule,
  deleteAdminModule,
  createAdminLesson,
  updateAdminLesson,
  deleteAdminLesson,
  type AdminModule,
  type AdminLesson,
  type AdminLessonType,
  type CreateModulePayload,
  type UpdateModulePayload,
  type CreateLessonPayload,
  type UpdateLessonPayload,
} from '../../../lib/api'
import { SortableList } from '../../../components/common/SortableList'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { FormField } from '../../../components/ui/FormField'
import { Modal } from '../../../components/ui/Modal'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { RichTextEditor } from '../../../components/ui/RichTextEditor'
import { detectVideoProvider, type VideoProvider } from '../../../lib/detectVideoProvider'
import { STALE_TIME } from '../../../lib/queryConfig'
import { cn } from '../../../lib/utils'
import {
  type ModuleDraft,
  newModule,
  newLesson,
  lessonTypeIcon,
} from './types'

// ---------------------------------------------------------------------------
// Curriculum Tab
// ---------------------------------------------------------------------------
//
// Two modes:
//   1. Unsaved draft (cohortId === null) — uses local ModuleDraft state, no API.
//      Drag-reorder is disabled here because persisted IDs do not yet exist.
//      The user must save the course once for a real cohortId before editing
//      curriculum, matching the two-phase approach in Story Y.
//   2. Persisted course (cohortId is a string) — uses TanStack Query for
//      modules and lessons, with optimistic drag-reorder wired to the
//      PATCH /modules/reorder and /lessons/reorder endpoints.
//
// The draft-state props are preserved so Overview-tab edits (title etc.) keep
// working; only the curriculum list rendering branches on cohortId.

export function CurriculumTab({
  cohortId,
  draftModules,
  onDraftChange,
  isAdmin,
  addToast,
}: {
  cohortId: string | null
  draftModules: ModuleDraft[]
  onDraftChange: (modules: ModuleDraft[]) => void
  isAdmin: boolean
  addToast: (message: string, variant: 'success' | 'error') => void
}) {
  return (
    <div className="px-8 pt-6 pb-8">
      {cohortId ? (
        <ServerCurriculumList
          cohortId={cohortId}
          isAdmin={isAdmin}
          addToast={addToast}
        />
      ) : (
        <DraftCurriculumList modules={draftModules} onChange={onDraftChange} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DraftCurriculumList — unsaved course: local-only curriculum preview.
// Drag handles are rendered inert (grey, no listeners) to preview the UI.
// ---------------------------------------------------------------------------

function DraftCurriculumList({
  modules,
  onChange,
}: {
  modules: ModuleDraft[]
  onChange: (modules: ModuleDraft[]) => void
}) {
  function addModule() {
    onChange([...modules, newModule(modules.length)])
  }

  function toggleModule(id: string) {
    onChange(modules.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : m)))
  }

  function updateModuleTitle(id: string, title: string) {
    onChange(modules.map((m) => (m.id === id ? { ...m, title } : m)))
  }

  function addLesson(moduleId: string) {
    onChange(
      modules.map((m) =>
        m.id === moduleId ? { ...m, lessons: [...m.lessons, newLesson()] } : m,
      ),
    )
  }

  function toggleLesson(moduleId: string, lessonId: string) {
    onChange(
      modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              lessons: m.lessons.map((l) =>
                l.id === lessonId ? { ...l, published: !l.published } : l,
              ),
            }
          : m,
      ),
    )
  }

  return (
    <>
      <div
        role="note"
        className="mb-3 text-[12px] text-[#717182] bg-[#fff8e6] border border-[rgba(138,90,0,0.15)] rounded-[10px] px-3 py-2"
      >
        Save this course to enable drag-reorder and server persistence for modules and lessons.
      </div>

      {modules.map((module) => (
        <div
          key={module.id}
          className="bg-white rounded-[14px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] mb-3 overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3.5">
            <GripVertical size={16} className="text-[#d4d4d4] flex-shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={module.title}
              onChange={(e) => updateModuleTitle(module.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Module title: ${module.title}`}
              className="flex-1 text-[15px] font-[700] text-[#1a2744] bg-transparent border-none outline-none"
            />
            <span className="text-[12px] text-[#717182] bg-[#f0f0f0] px-[10px] py-[2px] rounded-full">
              {module.lessons.length} lessons
            </span>
            <button
              type="button"
              onClick={() => toggleModule(module.id)}
              aria-expanded={module.expanded}
              aria-label={`${module.expanded ? 'Collapse' : 'Expand'} ${module.title}`}
              className="p-1 text-[#a3a3a3] hover:text-[#1a2744] transition-colors"
            >
              {module.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {module.expanded && (
            <>
              {module.lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex items-center gap-3 px-4 py-2.5 pl-11 border-t border-[rgba(26,39,68,0.05)]"
                >
                  <div
                    className="w-6 h-6 rounded-[6px] bg-[#e8f4fd] flex items-center justify-center text-[#4a9ad4] flex-shrink-0"
                    aria-hidden="true"
                  >
                    {lessonTypeIcon(lesson.type)}
                  </div>
                  <span className="flex-1 text-[13px] font-[500] text-[#1a2744]">
                    {lesson.title}
                  </span>
                  <span className="text-[12px] text-[#717182]">{lesson.estimatedMinutes}m</span>
                  <button
                    type="button"
                    onClick={() => toggleLesson(module.id, lesson.id)}
                    role="switch"
                    aria-checked={lesson.published}
                    aria-label={`${lesson.published ? 'Unpublish' : 'Publish'} ${lesson.title}`}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
                      lesson.published ? 'bg-[#4a9ad4]' : 'bg-[#e8ecf4]',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
                        lesson.published ? 'right-0.5' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>
              ))}

              <div className="border-t border-[rgba(26,39,68,0.05)] px-4 py-2.5 pl-11">
                <button
                  type="button"
                  onClick={() => addLesson(module.id)}
                  className="text-[13px] font-[600] text-[#4a9ad4] hover:underline flex items-center gap-1"
                >
                  <Plus size={13} aria-hidden="true" />
                  Add Lesson
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addModule}
        className={cn(
          'w-full py-3.5 border-2 border-dashed border-[rgba(26,39,68,0.2)] rounded-[14px]',
          'text-[14px] font-[600] text-[#717182] hover:border-[#4a9ad4] hover:text-[#4a9ad4]',
          'transition-colors bg-transparent font-[inherit]',
        )}
      >
        + Add Module
      </button>
    </>
  )
}

// ---------------------------------------------------------------------------
// ServerCurriculumList — API-backed module list with drag-reorder.
// ---------------------------------------------------------------------------

interface ModuleFormState {
  title: string
  description: string
}

function blankModuleForm(): ModuleFormState {
  return { title: '', description: '' }
}

function ServerCurriculumList({
  cohortId,
  isAdmin,
  addToast,
}: {
  cohortId: string
  isAdmin: boolean
  addToast: (message: string, variant: 'success' | 'error') => void
}) {
  const queryClient = useQueryClient()
  const modulesKey = ['admin', 'courses', cohortId, 'modules'] as const
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Sprint 2 Story 12 — Add / Edit / Delete module flows. The Add and Edit
  // paths share a single Modal (prefilled in edit mode). Delete uses the
  // shared ConfirmDialog with `variant="danger"`.
  const [moduleModalOpen, setModuleModalOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<AdminModule | null>(null)
  const [moduleForm, setModuleForm] = useState<ModuleFormState>(blankModuleForm)
  const [moduleFormError, setModuleFormError] = useState<string | null>(null)
  const [deletingModule, setDeletingModule] = useState<AdminModule | null>(null)

  // Serialize rapid reorder mutations behind a single in-flight promise so
  // a user dragging twice in quick succession doesn't race the server.
  const inFlightRef = useRef<Promise<unknown> | null>(null)

  const {
    data: modules = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: modulesKey,
    queryFn: () => fetchAdminCourseModules(cohortId),
    staleTime: STALE_TIME.medium,
  })

  const reorderModulesMutation = useMutation<
    { updated: number },
    Error,
    Array<{ id: string; order: number }>,
    { snapshot: AdminModule[] | undefined }
  >({
    mutationFn: async (items) => {
      // Chain after any in-flight reorder before dispatching.
      if (inFlightRef.current) {
        try {
          await inFlightRef.current
        } catch {
          // Previous error already surfaced — continue with this attempt.
        }
      }
      const promise = reorderModules(cohortId, items)
      inFlightRef.current = promise
      try {
        return await promise
      } finally {
        if (inFlightRef.current === promise) inFlightRef.current = null
      }
    },
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: modulesKey })
      const snapshot = queryClient.getQueryData<AdminModule[]>(modulesKey)
      if (snapshot) {
        const byId = new Map(snapshot.map((m) => [m.id, m]))
        const optimistic = items
          .map(({ id, order }) => {
            const prev = byId.get(id)
            return prev ? { ...prev, order } : null
          })
          .filter((m): m is AdminModule => m !== null)
          .sort((a, b) => a.order - b.order)
        queryClient.setQueryData<AdminModule[]>(modulesKey, optimistic)
      }
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData<AdminModule[]>(modulesKey, ctx.snapshot)
      }
      addToast('Failed to reorder modules', 'error')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey })
    },
  })

  const handleReorderModules = useCallback(
    (next: Array<{ id: string; order: number }>) => {
      reorderModulesMutation.mutate(next)
    },
    [reorderModulesMutation],
  )

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Create / update / delete mutations. Create + update share a single modal
  // (see the JSX below); delete is gated by ConfirmDialog. On success we
  // invalidate the modules list so the cache reflects the change.
  const createModuleMutation = useMutation({
    mutationFn: (payload: CreateModulePayload) => createAdminModule(cohortId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey })
      addToast('Module created', 'success')
      setModuleModalOpen(false)
      setEditingModule(null)
      setModuleForm(blankModuleForm())
    },
    onError: (err: Error) => setModuleFormError(err.message),
  })

  const updateModuleMutation = useMutation({
    mutationFn: (args: { moduleId: string; payload: UpdateModulePayload }) =>
      updateAdminModule(cohortId, args.moduleId, args.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey })
      addToast('Module updated', 'success')
      setModuleModalOpen(false)
      setEditingModule(null)
      setModuleForm(blankModuleForm())
    },
    onError: (err: Error) => setModuleFormError(err.message),
  })

  const deleteModuleMutation = useMutation({
    mutationFn: (moduleId: string) => deleteAdminModule(cohortId, moduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey })
      addToast('Module deleted', 'success')
      setDeletingModule(null)
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  function openAddModuleModal() {
    setEditingModule(null)
    setModuleForm(blankModuleForm())
    setModuleFormError(null)
    setModuleModalOpen(true)
  }

  function openEditModuleModal(mod: AdminModule) {
    setEditingModule(mod)
    setModuleForm({ title: mod.title, description: '' })
    setModuleFormError(null)
    setModuleModalOpen(true)
  }

  function handleModuleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setModuleFormError(null)
    const title = moduleForm.title.trim()
    if (!title) {
      setModuleFormError('Title is required')
      return
    }
    const description = moduleForm.description.trim()
    if (editingModule) {
      updateModuleMutation.mutate({
        moduleId: editingModule.id,
        payload: {
          title,
          ...(description ? { description } : {}),
        },
      })
    } else {
      createModuleMutation.mutate({
        title,
        ...(description ? { description } : {}),
        order: modules.length,
      })
    }
  }

  const isSavingModule =
    createModuleMutation.isPending || updateModuleMutation.isPending

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading modules">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-14 bg-[#e8ecf4] rounded-[14px] animate-pulse" aria-hidden="true" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-[13px] text-[#d03238]">
        Failed to load modules. Try refreshing.
      </div>
    )
  }

  return (
    <>
      <SortableList<AdminModule>
        items={modules}
        onReorder={handleReorderModules}
        disabled={!isAdmin}
        className="mb-3"
        renderItem={(module, dragHandleProps, isDragging) => (
          <div
            className={cn(
              'bg-white rounded-[14px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden',
              isDragging && 'shadow-[rgba(26,39,68,0.25)_0_8px_24px]',
            )}
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              {isAdmin && (
                <button
                  type="button"
                  aria-label={`Drag to reorder ${module.title}`}
                  className="flex-shrink-0 text-[#a3a3a3] hover:text-[#1a2744] cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9ad4] rounded"
                  {...dragHandleProps}
                >
                  <GripVertical size={16} aria-hidden="true" />
                </button>
              )}
              <span className="flex-1 text-[15px] font-[700] text-[#1a2744]">
                {module.title}
              </span>
              <span className="text-[12px] text-[#717182] bg-[#f0f0f0] px-[10px] py-[2px] rounded-full">
                {module.lessonCount ?? 0} lessons
              </span>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => openEditModuleModal(module)}
                    aria-label={`Edit ${module.title}`}
                    className="p-1 text-[#a3a3a3] hover:text-[#1a2744] transition-colors"
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingModule(module)}
                    aria-label={`Delete ${module.title}`}
                    className="p-1 text-[#a3a3a3] hover:text-[#d03238] transition-colors"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => toggleExpand(module.id)}
                aria-expanded={!!expanded[module.id]}
                aria-label={`${expanded[module.id] ? 'Collapse' : 'Expand'} ${module.title}`}
                className="p-1 text-[#a3a3a3] hover:text-[#1a2744] transition-colors"
              >
                {expanded[module.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {expanded[module.id] && (
              <ServerLessonList
                cohortId={cohortId}
                moduleId={module.id}
                isAdmin={isAdmin}
                addToast={addToast}
              />
            )}
          </div>
        )}
      />

      <button
        type="button"
        onClick={openAddModuleModal}
        disabled={!isAdmin}
        className={cn(
          'w-full py-3.5 border-2 border-dashed border-[rgba(26,39,68,0.2)] rounded-[14px]',
          'text-[14px] font-[600] text-[#717182] hover:border-[#4a9ad4] hover:text-[#4a9ad4]',
          'transition-colors bg-transparent font-[inherit]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        + Add Module
      </button>

      {/* Add / Edit module modal */}
      <Modal
        open={moduleModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setModuleModalOpen(false)
            setEditingModule(null)
            setModuleFormError(null)
          }
        }}
        title={editingModule ? 'Edit module' : 'Add module'}
        description="Give this module a title. Lessons can be added once the module is saved."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setModuleModalOpen(false)
                setEditingModule(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="module-form"
              disabled={isSavingModule}
            >
              {isSavingModule && (
                <LoadingSpinner size="sm" label="Saving…" />
              )}
              {editingModule ? 'Save Changes' : 'Create Module'}
            </Button>
          </>
        }
      >
        <form
          id="module-form"
          onSubmit={handleModuleSubmit}
          className={cn('flex flex-col gap-4')}
        >
          <FormField id="module-title" label="Title" required>
            <Input
              value={moduleForm.title}
              onChange={(e) =>
                setModuleForm({ ...moduleForm, title: e.target.value })
              }
              placeholder="Week 1: Foundations"
            />
          </FormField>
          {moduleFormError && (
            <p
              role="alert"
              className="text-[12px] font-semibold text-[var(--color-wise-danger)]"
            >
              {moduleFormError}
            </p>
          )}
          <div>
            <label
              htmlFor="module-description"
              className="block text-[14px] font-semibold text-[var(--color-wise-text)] mb-1.5"
            >
              Description
            </label>
            <textarea
              id="module-description"
              value={moduleForm.description}
              onChange={(e) =>
                setModuleForm({ ...moduleForm, description: e.target.value })
              }
              rows={4}
              placeholder="Optional overview of what students will learn in this module."
              className={cn(
                'w-full rounded-xl bg-white text-[var(--color-wise-text)] border',
                'border-[var(--color-wise-ring)] px-4 py-3 text-[15px] outline-none',
                'placeholder:text-[var(--color-wise-text-muted)]',
                'focus:ring-4 focus:ring-[var(--color-wise-primary)]/25',
                'focus:border-[var(--color-wise-text)] resize-y',
              )}
            />
          </div>
        </form>
      </Modal>

      {/* Delete module confirm dialog */}
      <ConfirmDialog
        open={Boolean(deletingModule)}
        onOpenChange={(open) => {
          if (!open) setDeletingModule(null)
        }}
        title="Delete this module?"
        description={
          deletingModule
            ? `This will permanently remove "${deletingModule.title}" and all its lessons. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete module"
        cancelLabel="Keep"
        variant="danger"
        isLoading={deleteModuleMutation.isPending}
        onConfirm={async () => {
          if (deletingModule) {
            await deleteModuleMutation.mutateAsync(deletingModule.id)
          }
        }}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// ServerLessonList — API-backed lesson list for an expanded module.
// ---------------------------------------------------------------------------

interface LessonFormState {
  title: string
  type: AdminLessonType
  /** NAB-P0-5 — replaces the old loom-only URL field. */
  videoUrl: string
  content: string
  /** NAB-P0-4 — TipTap HTML body for TEXT lessons. */
  richContent: string
  estimatedMinutes: string
}

function blankLessonForm(): LessonFormState {
  return {
    title: '',
    type: 'VIDEO',
    videoUrl: '',
    content: '',
    richContent: '',
    estimatedMinutes: '0',
  }
}

/**
 * NAB-P0-4 — Derive an initial rich-text value from an existing lesson. If
 * the lesson has been edited with the TipTap editor before, we use the
 * stored HTML verbatim. Otherwise we wrap the legacy plain-text `content`
 * in a paragraph tag so the editor has valid HTML to bootstrap into. Empty
 * strings stay empty — the placeholder in the editor picks up the slack.
 */
function initialRichContentFor(lesson: AdminLesson): string {
  if (lesson.richContent && lesson.richContent.trim().length > 0) {
    return lesson.richContent
  }
  const plain = (lesson.content ?? '').trim()
  if (!plain) return ''
  // Escape before wrapping so pre-existing `<` / `>` in a plain-text body
  // don't accidentally execute as HTML inside the editor.
  const escaped = plain
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<p>${escaped.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br />')}</p>`
}

// NAB-P0-5 — Human-readable label for the provider pill / detection hint.
function providerLabel(provider: VideoProvider | null): string {
  if (provider === 'LOOM')    return 'Loom'
  if (provider === 'YOUTUBE') return 'YouTube'
  if (provider === 'VIMEO')   return 'Vimeo'
  return ''
}

function ServerLessonList({
  cohortId,
  moduleId,
  isAdmin,
  addToast,
}: {
  cohortId: string
  moduleId: string
  isAdmin: boolean
  addToast: (message: string, variant: 'success' | 'error') => void
}) {
  const queryClient = useQueryClient()
  const lessonsKey = [
    'admin',
    'courses',
    cohortId,
    'modules',
    moduleId,
    'lessons',
  ] as const
  const modulesKey = ['admin', 'courses', cohortId, 'modules'] as const

  const inFlightRef = useRef<Promise<unknown> | null>(null)

  // Sprint 2 Story 12 — Create / edit / delete lessons. Same Modal + Confirm
  // pattern as modules; lesson type drives the conditional "Loom URL" vs
  // "Content" field below.
  const [lessonModalOpen, setLessonModalOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<AdminLesson | null>(null)
  const [lessonForm, setLessonForm] = useState<LessonFormState>(blankLessonForm)
  const [lessonFormError, setLessonFormError] = useState<string | null>(null)
  const [deletingLesson, setDeletingLesson] = useState<AdminLesson | null>(null)

  const {
    data: lessons = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: lessonsKey,
    queryFn: () => fetchAdminModuleLessons(cohortId, moduleId),
    staleTime: STALE_TIME.medium,
  })

  const reorderLessonsMutation = useMutation<
    { updated: number },
    Error,
    Array<{ id: string; order: number }>,
    { snapshot: AdminLesson[] | undefined }
  >({
    mutationFn: async (items) => {
      if (inFlightRef.current) {
        try {
          await inFlightRef.current
        } catch {
          // Continue — previous error already reported.
        }
      }
      const promise = reorderLessons(cohortId, moduleId, items)
      inFlightRef.current = promise
      try {
        return await promise
      } finally {
        if (inFlightRef.current === promise) inFlightRef.current = null
      }
    },
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: lessonsKey })
      const snapshot = queryClient.getQueryData<AdminLesson[]>(lessonsKey)
      if (snapshot) {
        const byId = new Map(snapshot.map((l) => [l.id, l]))
        const optimistic = items
          .map(({ id, order }) => {
            const prev = byId.get(id)
            return prev ? { ...prev, order } : null
          })
          .filter((l): l is AdminLesson => l !== null)
          .sort((a, b) => a.order - b.order)
        queryClient.setQueryData<AdminLesson[]>(lessonsKey, optimistic)
      }
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData<AdminLesson[]>(lessonsKey, ctx.snapshot)
      }
      addToast('Failed to reorder lessons', 'error')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: lessonsKey })
    },
  })

  const handleReorderLessons = useCallback(
    (next: Array<{ id: string; order: number }>) => {
      reorderLessonsMutation.mutate(next)
    },
    [reorderLessonsMutation],
  )

  const createLessonMutation = useMutation({
    mutationFn: (payload: CreateLessonPayload) =>
      createAdminLesson(cohortId, moduleId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lessonsKey })
      // Also invalidate the module list so the "N lessons" pill refreshes.
      queryClient.invalidateQueries({ queryKey: modulesKey })
      addToast('Lesson created', 'success')
      setLessonModalOpen(false)
      setEditingLesson(null)
      setLessonForm(blankLessonForm())
    },
    onError: (err: Error) => setLessonFormError(err.message),
  })

  const updateLessonMutation = useMutation({
    mutationFn: (args: { lessonId: string; payload: UpdateLessonPayload }) =>
      updateAdminLesson(cohortId, moduleId, args.lessonId, args.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lessonsKey })
      addToast('Lesson updated', 'success')
      setLessonModalOpen(false)
      setEditingLesson(null)
      setLessonForm(blankLessonForm())
    },
    onError: (err: Error) => setLessonFormError(err.message),
  })

  const deleteLessonMutation = useMutation({
    mutationFn: (lessonId: string) => deleteAdminLesson(cohortId, moduleId, lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lessonsKey })
      queryClient.invalidateQueries({ queryKey: modulesKey })
      addToast('Lesson deleted', 'success')
      setDeletingLesson(null)
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  function openAddLessonModal() {
    setEditingLesson(null)
    setLessonForm(blankLessonForm())
    setLessonFormError(null)
    setLessonModalOpen(true)
  }

  function openEditLessonModal(lesson: AdminLesson) {
    setEditingLesson(lesson)
    setLessonForm({
      title: lesson.title,
      type: lesson.type,
      // NAB-P0-5 — Seed the field from the new videoUrl, falling back to the
      // legacy loomUrl so existing lessons render the value on edit.
      videoUrl: lesson.videoUrl ?? lesson.loomUrl ?? '',
      content: lesson.content ?? '',
      // NAB-P0-4 — Prefer the rich HTML; fall back to wrapping legacy plain
      // `content` in <p>…</p> so the editor has valid HTML to bootstrap.
      richContent: initialRichContentFor(lesson),
      estimatedMinutes: String(lesson.estimatedMinutes),
    })
    setLessonFormError(null)
    setLessonModalOpen(true)
  }

  function handleLessonSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLessonFormError(null)
    const title = lessonForm.title.trim()
    if (!title) {
      setLessonFormError('Title is required')
      return
    }
    const videoUrl = lessonForm.videoUrl.trim()
    const content = lessonForm.content.trim()
    // NAB-P0-4 — richContent is the TipTap HTML body. We DON'T `.trim()`
    // the HTML because TipTap emits a trailing empty paragraph by default;
    // an emptyish document is filtered via a regex below.
    const richContent = lessonForm.richContent
    const richContentIsEmpty =
      richContent.replace(/<[^>]+>/g, '').trim().length === 0
    // NAB-P0-5 — Client-side validation: VIDEO lessons require a recognised
    // multi-provider URL. Block save on empty or unsupported input.
    let videoProvider: VideoProvider | null = null
    if (lessonForm.type === 'VIDEO') {
      if (!videoUrl) {
        setLessonFormError('Video URL is required for video lessons')
        return
      }
      videoProvider = detectVideoProvider(videoUrl)
      if (!videoProvider) {
        setLessonFormError('Unsupported URL — use Loom, YouTube, or Vimeo')
        return
      }
    }
    const estimatedMinutesRaw = Number(lessonForm.estimatedMinutes)
    const estimatedMinutes = Number.isFinite(estimatedMinutesRaw)
      ? Math.max(0, Math.floor(estimatedMinutesRaw))
      : 0

    // Strip empty optional fields before dispatching so the backend zod
    // schemas don't choke on `videoUrl: ''` (which fails url().optional()).
    if (editingLesson) {
      const payload: UpdateLessonPayload = {
        title,
        type: lessonForm.type,
        estimatedMinutes,
        ...(lessonForm.type === 'VIDEO' && videoUrl && videoProvider
          ? { videoUrl, videoProvider }
          : {}),
        // NAB-P0-4 — send richContent + RICH_HTML format for TEXT lessons.
        // The backend derives a plain-text `content` fallback automatically.
        ...(lessonForm.type === 'TEXT' && !richContentIsEmpty
          ? { richContent, contentFormat: 'RICH_HTML' as const }
          : lessonForm.type === 'TEXT' && content
            ? { content }
            : {}),
      }
      updateLessonMutation.mutate({ lessonId: editingLesson.id, payload })
    } else {
      const payload: CreateLessonPayload = {
        title,
        type: lessonForm.type,
        estimatedMinutes,
        order: lessons.length,
        ...(lessonForm.type === 'VIDEO' && videoUrl && videoProvider
          ? { videoUrl, videoProvider }
          : {}),
        // NAB-P0-4 — same split as above; richContent wins for TEXT lessons.
        ...(lessonForm.type === 'TEXT' && !richContentIsEmpty
          ? { richContent, contentFormat: 'RICH_HTML' as const }
          : lessonForm.type === 'TEXT' && content
            ? { content }
            : {}),
      }
      createLessonMutation.mutate(payload)
    }
  }

  const isSavingLesson =
    createLessonMutation.isPending || updateLessonMutation.isPending

  if (isLoading) {
    return (
      <div className="border-t border-[rgba(26,39,68,0.05)] px-4 py-3 pl-11">
        <div className="h-5 bg-[#e8ecf4] rounded animate-pulse" aria-hidden="true" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="border-t border-[rgba(26,39,68,0.05)] px-4 py-3 pl-11 text-[12px] text-[#d03238]">
        Failed to load lessons.
      </div>
    )
  }

  return (
    <div className="border-t border-[rgba(26,39,68,0.05)]">
      {lessons.length > 0 && (
        <SortableList<AdminLesson>
          items={lessons}
          onReorder={handleReorderLessons}
          disabled={!isAdmin}
          className="!gap-0"
          renderItem={(lesson, dragHandleProps, isDragging) => (
            <div
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 pl-11 border-b border-[rgba(26,39,68,0.05)] bg-white',
                isDragging && 'shadow-[rgba(26,39,68,0.15)_0_4px_12px]',
              )}
            >
              {isAdmin && (
                <button
                  type="button"
                  aria-label={`Drag to reorder ${lesson.title}`}
                  className="flex-shrink-0 text-[#a3a3a3] hover:text-[#1a2744] cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9ad4] rounded"
                  {...dragHandleProps}
                >
                  <GripVertical size={14} aria-hidden="true" />
                </button>
              )}
              <div
                className="w-6 h-6 rounded-[6px] bg-[#e8f4fd] flex items-center justify-center text-[#4a9ad4] flex-shrink-0"
                aria-hidden="true"
              >
                {lessonTypeIcon(lesson.type)}
              </div>
              <span className="flex-1 text-[13px] font-[500] text-[#1a2744]">
                {lesson.title}
              </span>
              {/* NAB-P0-5 — provider pill for VIDEO lessons. Falls back to
                  detecting from the URL when the server hasn't migrated yet. */}
              {lesson.type === 'VIDEO' && (() => {
                const provider =
                  lesson.videoProvider ??
                  (lesson.videoUrl
                    ? detectVideoProvider(lesson.videoUrl)
                    : lesson.loomUrl
                      ? detectVideoProvider(lesson.loomUrl)
                      : null)
                if (!provider) return null
                return (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-[2px]',
                      'text-[10px] font-semibold uppercase tracking-wide',
                      'bg-[#e8f4fd] text-[#1a2744]',
                    )}
                    aria-label={`${providerLabel(provider)} video`}
                  >
                    <Video size={10} aria-hidden="true" />
                    {providerLabel(provider)}
                  </span>
                )
              })()}
              <span className="text-[12px] text-[#717182]">{lesson.estimatedMinutes}m</span>
              <span
                className={cn(
                  'text-[11px] font-[600] px-[9px] py-[3px] rounded-full',
                  lesson.published ? 'bg-[#e6f4ec] text-[#054d28]' : 'bg-[#fff8e6] text-[#8a5a00]',
                )}
              >
                {lesson.published ? 'Published' : 'Draft'}
              </span>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => openEditLessonModal(lesson)}
                    aria-label={`Edit ${lesson.title}`}
                    className="p-1 text-[#a3a3a3] hover:text-[#1a2744] transition-colors"
                  >
                    <Pencil size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingLesson(lesson)}
                    aria-label={`Delete ${lesson.title}`}
                    className="p-1 text-[#a3a3a3] hover:text-[#d03238] transition-colors"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          )}
        />
      )}

      <div className="px-4 py-2.5 pl-11">
        <button
          type="button"
          onClick={openAddLessonModal}
          disabled={!isAdmin}
          className="text-[13px] font-[600] text-[#4a9ad4] hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={13} aria-hidden="true" />
          Add Lesson
        </button>
      </div>

      {/* Add / Edit lesson modal */}
      <Modal
        open={lessonModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLessonModalOpen(false)
            setEditingLesson(null)
            setLessonFormError(null)
          }
        }}
        title={editingLesson ? 'Edit lesson' : 'Add lesson'}
        description="Choose a lesson type and fill in the matching fields. You can publish the lesson later from the row menu."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setLessonModalOpen(false)
                setEditingLesson(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="lesson-form"
              disabled={isSavingLesson}
            >
              {isSavingLesson && (
                <LoadingSpinner size="sm" label="Saving…" />
              )}
              {editingLesson ? 'Save Changes' : 'Create Lesson'}
            </Button>
          </>
        }
      >
        <form
          id="lesson-form"
          onSubmit={handleLessonSubmit}
          className={cn('flex flex-col gap-4')}
        >
          <FormField id="lesson-title" label="Title" required>
            <Input
              value={lessonForm.title}
              onChange={(e) =>
                setLessonForm({ ...lessonForm, title: e.target.value })
              }
              placeholder="Intro to prompt engineering"
            />
          </FormField>
          {lessonFormError && (
            <p
              role="alert"
              className="text-[12px] font-semibold text-[var(--color-wise-danger)]"
            >
              {lessonFormError}
            </p>
          )}
          <div>
            <label
              htmlFor="lesson-type"
              className="block text-[14px] font-semibold text-[var(--color-wise-text)] mb-1.5"
            >
              Type
              <span
                aria-hidden="true"
                className="ml-0.5 text-[var(--color-wise-danger)]"
              >
                *
              </span>
            </label>
            <select
              id="lesson-type"
              value={lessonForm.type}
              onChange={(e) =>
                setLessonForm({
                  ...lessonForm,
                  type: e.target.value as AdminLessonType,
                })
              }
              className={cn(
                'w-full h-11 px-4 rounded-xl border bg-white text-[15px]',
                'border-[var(--color-wise-ring)] outline-none',
                'focus:ring-4 focus:ring-[var(--color-wise-primary)]/25',
              )}
            >
              <option value="VIDEO">Video</option>
              <option value="TEXT">Text</option>
              <option value="TOOL_SETUP">Tool Setup</option>
            </select>
          </div>

          {lessonForm.type === 'VIDEO' && (() => {
            // NAB-P0-5 — Live provider detection for the Video URL field.
            const trimmed = lessonForm.videoUrl.trim()
            const detected = trimmed ? detectVideoProvider(trimmed) : null
            const isUnsupported = trimmed.length > 0 && detected === null
            const hint: string = detected
              ? `${providerLabel(detected)} detected`
              : 'Paste a Loom, YouTube, or Vimeo URL.'
            return (
              <FormField
                id="lesson-video-url"
                label="Video URL"
                required
                helperText={isUnsupported ? undefined : hint}
                errorText={
                  isUnsupported
                    ? 'Unsupported URL — use Loom, YouTube, or Vimeo'
                    : undefined
                }
              >
                <Input
                  type="url"
                  value={lessonForm.videoUrl}
                  onChange={(e) =>
                    setLessonForm({ ...lessonForm, videoUrl: e.target.value })
                  }
                  placeholder="Loom, YouTube, or Vimeo link…"
                />
              </FormField>
            )
          })()}

          {lessonForm.type === 'TEXT' && (
            <div>
              <label
                htmlFor="lesson-content"
                className="block text-[14px] font-semibold text-[var(--color-wise-text)] mb-1.5"
              >
                Content
              </label>
              {/* NAB-P0-4 — TipTap rich-text editor. Emits HTML into
                  `richContent`; the backend derives a plain-text `content`
                  fallback automatically. */}
              <RichTextEditor
                value={lessonForm.richContent}
                onChange={(next) =>
                  setLessonForm({ ...lessonForm, richContent: next })
                }
                cohortId={cohortId}
                maxChars={100_000}
                placeholder="Write the lesson body. Use the toolbar for headings, code blocks, images, and links."
              />
              {/* Hidden textarea — retained so React Testing Library + form
                  submission fall-back tests that still reach `#lesson-content`
                  keep working if someone disables JS. */}
              <textarea
                id="lesson-content"
                value={lessonForm.content}
                onChange={(e) =>
                  setLessonForm({ ...lessonForm, content: e.target.value })
                }
                rows={6}
                placeholder="Markdown / plain-text body for this lesson."
                className={cn(
                  'sr-only',
                  'w-full rounded-xl bg-white text-[var(--color-wise-text)] border',
                  'border-[var(--color-wise-ring)] px-4 py-3 text-[15px] outline-none',
                  'placeholder:text-[var(--color-wise-text-muted)]',
                  'focus:ring-4 focus:ring-[var(--color-wise-primary)]/25',
                  'focus:border-[var(--color-wise-text)] resize-y',
                )}
              />
            </div>
          )}

          <FormField id="lesson-estimated-minutes" label="Estimated minutes">
            <Input
              type="number"
              min={0}
              value={lessonForm.estimatedMinutes}
              onChange={(e) =>
                setLessonForm({
                  ...lessonForm,
                  estimatedMinutes: e.target.value,
                })
              }
              placeholder="0"
            />
          </FormField>
        </form>
      </Modal>

      {/* Delete lesson confirm dialog */}
      <ConfirmDialog
        open={Boolean(deletingLesson)}
        onOpenChange={(open) => {
          if (!open) setDeletingLesson(null)
        }}
        title="Delete this lesson?"
        description={
          deletingLesson
            ? `This will permanently remove "${deletingLesson.title}" from the module. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete lesson"
        cancelLabel="Keep"
        variant="danger"
        isLoading={deleteLessonMutation.isPending}
        onConfirm={async () => {
          if (deletingLesson) {
            await deleteLessonMutation.mutateAsync(deletingLesson.id)
          }
        }}
      />
    </div>
  )
}
