// FIR-165 — Admin Course Builder: list + edit with tabs (Overview, Curriculum, Live Sessions, Pricing)
// Wave 5 Story Y — Curriculum tab is API-backed with drag-reorder for modules + lessons.
// Sprint 2 Story 11 — handleSave / Pricing / Live Sessions wired to the admin API.
import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, GripVertical, ChevronDown, ChevronUp, Video, FileText, Wrench, Calendar, DollarSign } from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import {
  fetchAdminCourses,
  fetchAdminCourseModules,
  fetchAdminModuleLessons,
  reorderModules,
  reorderLessons,
  createAdminCourse,
  updateAdminCourse,
  publishAdminCourse,
  fetchAdminPaymentPlans,
  createAdminPaymentPlan,
  updateAdminPaymentPlan,
  toggleAdminPaymentPlan,
  fetchAdminLiveSessions,
  createAdminLiveSession,
  updateAdminLiveSession,
  deleteAdminLiveSession,
  type AdminCourse,
  type AdminModule,
  type AdminLesson,
  type AdminPaymentPlan,
  type AdminLiveSession,
  type AdminCourseType,
  type CreatePaymentPlanPayload,
  type CreateLiveSessionPayload,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { SortableList } from '../../components/common/SortableList'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FormField } from '../../components/ui/FormField'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CourseType = 'recorded' | 'live' | 'combined'
type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
type EditorTab = 'Overview' | 'Curriculum' | 'Live Sessions' | 'Pricing' | 'Enrollments'

interface LessonDraft {
  id: string
  title: string
  type: 'VIDEO' | 'TEXT' | 'TOOL_SETUP'
  estimatedMinutes: number
  published: boolean
}

interface ModuleDraft {
  id: string
  title: string
  order: number
  expanded: boolean
  lessons: LessonDraft[]
}

interface CourseDraft {
  id: string | null
  title: string
  slug: string
  tagline: string
  description: string
  type: CourseType
  status: CourseStatus
  startDate: string
  endDate: string
  maxSeats: string
  coverImageKey: string | null
  modules: ModuleDraft[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: EditorTab[] = ['Overview', 'Curriculum', 'Live Sessions', 'Pricing', 'Enrollments']

const COURSE_TYPES: Array<{ value: CourseType; label: string; desc: string; icon: string; color: string }> = [
  { value: 'recorded', label: 'Recorded', desc: 'Self-paced video', icon: '📹', color: 'blue' },
  { value: 'live', label: 'Live Cohort', desc: 'Scheduled sessions', icon: '🔴', color: 'orange' },
  { value: 'combined', label: 'Combined', desc: 'Both formats', icon: '⚡', color: 'navy' },
]

const TYPE_ICON_COLORS: Record<CourseType, string> = {
  recorded: 'bg-[#e8f4fd]',
  live: 'bg-[#fff0e8]',
  combined: 'bg-[#e8ecf4]',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newCourse(): CourseDraft {
  return {
    id: null,
    title: 'Untitled Course',
    slug: '',
    tagline: '',
    description: '',
    type: 'recorded',
    status: 'DRAFT',
    startDate: '',
    endDate: '',
    maxSeats: '',
    coverImageKey: null,
    modules: [],
  }
}

function newModule(order: number): ModuleDraft {
  return {
    id: crypto.randomUUID(),
    title: 'New Module',
    order,
    expanded: true,
    lessons: [],
  }
}

function newLesson(): LessonDraft {
  return {
    id: crypto.randomUUID(),
    title: 'New Lesson',
    type: 'VIDEO',
    estimatedMinutes: 10,
    published: false,
  }
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #1a2744, #4a9ad4)',
  'linear-gradient(135deg, #cc4a00, #ff8c5a)',
  'linear-gradient(135deg, #0d1a3a, #2d4a8a)',
]

function lessonTypeIcon(type: LessonDraft['type']) {
  if (type === 'VIDEO') return <Video size={12} />
  if (type === 'TEXT') return <FileText size={12} />
  return <Wrench size={12} />
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface ToastMessage { id: string; message: string; variant: 'success' | 'error' }

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 3500)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 rounded-[14px] shadow-[rgba(26,39,68,0.2)_0_4px_20px] text-[14px] font-semibold',
        toast.variant === 'success'
          ? 'bg-[#e6f4ec] text-[#054d28] border border-[rgba(5,77,40,0.15)]'
          : 'bg-[#fdeaeb] text-[#d03238] border border-[rgba(208,50,56,0.15)]',
      )}
    >
      <span aria-hidden="true">{toast.variant === 'success' ? '✓' : '✗'}</span>
      {toast.message}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const addToast = useCallback((message: string, variant: 'success' | 'error') => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, variant }])
  }, [])
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])
  return { toasts, addToast, dismissToast }
}

// ---------------------------------------------------------------------------
// Course List Sidebar
// ---------------------------------------------------------------------------

interface CourseListSidebarProps {
  courses: AdminCourse[]
  isLoading: boolean
  selectedId: string | null
  onSelect: (course: AdminCourse | null) => void
  searchQuery: string
  onSearchChange: (q: string) => void
}

function CourseListSidebar({
  courses,
  isLoading,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
}: CourseListSidebarProps) {
  const statusColors: Record<CourseStatus, string> = {
    PUBLISHED: 'text-[#054d28]',
    DRAFT: 'text-[#8a5a00]',
    ARCHIVED: 'text-[#717182]',
  }

  return (
    <aside className="w-72 bg-white border-r border-[rgba(26,39,68,0.08)] flex flex-col h-full">
      {/* Search + new */}
      <div className="p-4 border-b border-[rgba(26,39,68,0.06)]">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search courses…"
            aria-label="Search courses"
            className={cn(
              'w-full pl-8 pr-3 py-2 rounded-[9999px] text-[13px] font-[inherit]',
              'border-[1.5px] border-[rgba(26,39,68,0.12)] bg-[#f8f9fb] text-[#1a2744] outline-none',
              'focus:border-[#4a9ad4] focus:bg-white transition-colors',
            )}
          />
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-[10px]',
            'text-[13px] font-[700] transition-colors',
            selectedId === null
              ? 'bg-[#4a9ad4] text-white'
              : 'bg-[#f0f0f0] text-[#1a2744] hover:bg-[#e8ecf4]',
          )}
        >
          <Plus size={14} aria-hidden="true" />
          New Course
        </button>
      </div>

      {/* Course list */}
      <div className="flex-1 overflow-y-auto" role="list" aria-label="Course list">
        {isLoading && (
          <div className="p-4 space-y-2" aria-busy="true" aria-label="Loading courses">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-14 bg-[#e8ecf4] rounded-[10px] animate-pulse" aria-hidden="true" />
            ))}
          </div>
        )}
        {!isLoading &&
          courses.map((course, idx) => (
            <button
              key={course.id}
              type="button"
              role="listitem"
              onClick={() => onSelect(course)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3.5 border-b border-[rgba(26,39,68,0.04)]',
                'text-left transition-colors hover:bg-[#f8fbff]',
                selectedId === course.id && 'bg-[#eef6fd]',
              )}
              aria-current={selectedId === course.id ? 'true' : undefined}
            >
              <div
                className="w-10 h-8 rounded-[8px] flex-shrink-0"
                style={{ background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length] }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-[700] text-[#1a2744] truncate">{course.title}</div>
                <div className={cn('text-[11px] font-[600] mt-0.5', statusColors[course.status])}>
                  {course.status.charAt(0) + course.status.slice(1).toLowerCase()} ·{' '}
                  {course.enrollmentCount} enrolled
                </div>
              </div>
            </button>
          ))}
        {!isLoading && courses.length === 0 && (
          <div className="p-6 text-center text-[13px] text-[#717182]">No courses found</div>
        )}
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  draft,
  onChange,
}: {
  draft: CourseDraft
  onChange: (updated: Partial<CourseDraft>) => void
}) {
  return (
    <div className="p-8">
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
          <div className="border-2 border-dashed border-[rgba(26,39,68,0.2)] rounded-[16px] p-8 text-center bg-[#f8f9fb] cursor-pointer hover:border-[#4a9ad4] hover:bg-[#eef6fd] transition-colors">
            <div className="text-[32px] mb-2" aria-hidden="true">🖼</div>
            <div className="text-[14px] text-[#717182]">
              Drag & drop or{' '}
              <span className="text-[14px] font-[600] text-[#4a9ad4]">browse files</span>
            </div>
            <div className="text-[12px] text-[#a3a3a3] mt-1">
              PNG, JPG · Max 5MB · 1920×1080px recommended
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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

function CurriculumTab({
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
    staleTime: 30_000,
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
        onClick={() => addToast('Create module UI is tracked in a follow-up story', 'error')}
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
// ServerLessonList — API-backed lesson list for an expanded module.
// ---------------------------------------------------------------------------

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

  const inFlightRef = useRef<Promise<unknown> | null>(null)

  const {
    data: lessons = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: lessonsKey,
    queryFn: () => fetchAdminModuleLessons(cohortId, moduleId),
    staleTime: 30_000,
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
              <span className="text-[12px] text-[#717182]">{lesson.estimatedMinutes}m</span>
              <span
                className={cn(
                  'text-[11px] font-[600] px-[9px] py-[3px] rounded-full',
                  lesson.published ? 'bg-[#e6f4ec] text-[#054d28]' : 'bg-[#fff8e6] text-[#8a5a00]',
                )}
              >
                {lesson.published ? 'Published' : 'Draft'}
              </span>
            </div>
          )}
        />
      )}

      <div className="px-4 py-2.5 pl-11">
        <button
          type="button"
          onClick={() =>
            addToast('Create lesson UI is tracked in a follow-up story', 'error')
          }
          className="text-[13px] font-[600] text-[#4a9ad4] hover:underline flex items-center gap-1"
        >
          <Plus size={13} aria-hidden="true" />
          Add Lesson
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Live Sessions Tab — Sprint 2 Story 11
//
// API-backed. When no cohortId is set (draft course) we render an empty
// state with guidance, matching the Pricing tab's behaviour. CRUD is done
// via a shared Schedule modal that also handles edit (prefilled), plus a
// ConfirmDialog for the destructive Cancel action.
// ---------------------------------------------------------------------------

// Derive a display status from scheduledAt + durationMinutes since the
// back-end stores absolute dates only. LIVE = within the session window.
function deriveSessionStatus(
  scheduledAt: string,
  durationMinutes: number,
  now: Date = new Date(),
): 'LIVE' | 'UPCOMING' | 'PAST' {
  const start = new Date(scheduledAt).getTime()
  const end = start + durationMinutes * 60_000
  const t = now.getTime()
  if (t < start) return 'UPCOMING'
  if (t <= end) return 'LIVE'
  return 'PAST'
}

interface LiveSessionFormState {
  title: string
  scheduledAt: string
  durationMinutes: string
  zoomUrl: string
}

function blankSessionForm(): LiveSessionFormState {
  return { title: '', scheduledAt: '', durationMinutes: '90', zoomUrl: '' }
}

function sessionToForm(s: AdminLiveSession): LiveSessionFormState {
  // HTML `datetime-local` expects `YYYY-MM-DDTHH:mm` in local time. Convert
  // the stored ISO by trimming seconds/ms and Z suffix after shifting to the
  // browser's local zone (matches the datetime-local control's contract).
  const d = new Date(s.scheduledAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const localValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  return {
    title: s.title,
    scheduledAt: localValue,
    durationMinutes: String(s.durationMinutes),
    zoomUrl: s.zoomUrl,
  }
}

function LiveSessionsTab({
  cohortId,
  isAdmin,
  addToast,
}: {
  cohortId: string | null
  isAdmin: boolean
  addToast: (message: string, variant: 'success' | 'error') => void
}) {
  const queryClient = useQueryClient()
  const sessionsKey = ['admin', 'courses', cohortId ?? '__draft__', 'sessions'] as const

  const [modalOpen, setModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<AdminLiveSession | null>(null)
  const [form, setForm] = useState<LiveSessionFormState>(blankSessionForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingSession, setDeletingSession] = useState<AdminLiveSession | null>(null)

  const {
    data: sessions = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: sessionsKey,
    queryFn: () => fetchAdminLiveSessions(cohortId as string),
    enabled: Boolean(cohortId),
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateLiveSessionPayload) =>
      createAdminLiveSession(cohortId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKey })
      addToast('Session scheduled', 'success')
      setModalOpen(false)
      setForm(blankSessionForm())
    },
    onError: (err: Error) => {
      setFormError(err.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (args: { sessionId: string; payload: CreateLiveSessionPayload }) =>
      updateAdminLiveSession(cohortId as string, args.sessionId, args.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKey })
      addToast('Session updated', 'success')
      setModalOpen(false)
      setEditingSession(null)
      setForm(blankSessionForm())
    },
    onError: (err: Error) => {
      setFormError(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteAdminLiveSession(cohortId as string, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKey })
      addToast('Session cancelled', 'success')
      setDeletingSession(null)
    },
    onError: (err: Error) => {
      addToast(err.message, 'error')
    },
  })

  function openScheduleModal() {
    setEditingSession(null)
    setForm(blankSessionForm())
    setFormError(null)
    setModalOpen(true)
  }

  function openEditModal(s: AdminLiveSession) {
    setEditingSession(s)
    setForm(sessionToForm(s))
    setFormError(null)
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.title.trim()) {
      setFormError('Title is required')
      return
    }
    if (!form.scheduledAt) {
      setFormError('Scheduled date/time is required')
      return
    }
    if (!form.zoomUrl.trim()) {
      setFormError('Zoom URL is required')
      return
    }
    const duration = Number(form.durationMinutes)
    if (!Number.isFinite(duration) || duration < 1) {
      setFormError('Duration must be at least 1 minute')
      return
    }
    const payload: CreateLiveSessionPayload = {
      title: form.title.trim(),
      // `datetime-local` values are local; convert to ISO via Date.
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      durationMinutes: duration,
      zoomUrl: form.zoomUrl.trim(),
    }
    if (editingSession) {
      updateMutation.mutate({ sessionId: editingSession.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const statusStyles: Record<string, string> = {
    LIVE: 'bg-[#fdeaeb] text-[#d03238]',
    UPCOMING: 'bg-[#e8f4fd] text-[#1a2744]',
    PAST: 'bg-[#e6f4ec] text-[#054d28]',
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  // Draft mode (no saved cohort yet)
  if (!cohortId) {
    return (
      <div className="px-8 py-6">
        <EmptyState
          icon={Calendar}
          title="Save the course first"
          description="Live sessions are attached to a saved course. Save the draft on the Overview tab to start scheduling sessions."
        />
      </div>
    )
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-[700] text-[#1a2744]">Live Sessions</h3>
        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} aria-hidden="true" />}
            onClick={openScheduleModal}
          >
            Schedule Session
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="py-10">
          <LoadingSpinner centered label="Loading live sessions" />
        </div>
      )}

      {isError && (
        <div className="p-6 text-center text-[13px] text-[#d03238]">
          Failed to load live sessions. Try refreshing.
        </div>
      )}

      {!isLoading && !isError && sessions.length === 0 && (
        <EmptyState
          icon={Calendar}
          title="No live sessions yet"
          description="Schedule the first session for this cohort."
          action={
            isAdmin
              ? { label: 'Schedule Session', onClick: openScheduleModal }
              : undefined
          }
        />
      )}

      {!isLoading && !isError && sessions.length > 0 && (
        <div className="bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden">
          <table className="w-full border-collapse" aria-label="Live sessions">
            <thead>
              <tr>
                {['Title', 'Date & Time', 'Duration', 'Zoom Link', 'Status', 'Actions'].map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="text-left text-[12px] font-[600] text-[#717182] px-5 py-3 border-b border-[rgba(26,39,68,0.08)] uppercase tracking-[0.5px] bg-[#f8f9fb]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const status = deriveSessionStatus(
                  session.scheduledAt,
                  session.durationMinutes,
                )
                return (
                  <tr key={session.id} className="hover:[&>td]:bg-[#f8f9fb] transition-colors">
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[14px] font-[600] text-[#1a2744]">
                      {session.title}
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]">
                      {new Date(session.scheduledAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]">
                      {session.durationMinutes}m
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                      <span className="text-[13px] text-[#717182] font-mono truncate max-w-[180px] block overflow-hidden text-ellipsis whitespace-nowrap">
                        {session.zoomUrl}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                      <span className={cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', statusStyles[status])}>
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="text-[13px] font-[600] text-[#4a9ad4] hover:underline"
                          onClick={() => openEditModal(session)}
                          disabled={!isAdmin}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-[13px] font-[600] text-[#d03238] hover:underline"
                          onClick={() => setDeletingSession(session)}
                          disabled={!isAdmin}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule / Edit session modal */}
      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setModalOpen(false)
            setEditingSession(null)
            setFormError(null)
          }
        }}
        title={editingSession ? 'Edit Session' : 'Schedule Session'}
        description="Add the session details. Students enrolled in this cohort will see the session in their live sessions list."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false)
                setEditingSession(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="live-session-form"
              isLoading={isSaving}
            >
              {editingSession ? 'Save Changes' : 'Schedule Session'}
            </Button>
          </>
        }
      >
        <form
          id="live-session-form"
          onSubmit={handleSubmit}
          className={cn('flex flex-col gap-4')}
        >
          <FormField id="session-title" label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Week 1: Kickoff"
            />
          </FormField>
          <FormField id="session-scheduled" label="Scheduled at" required>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </FormField>
          <FormField
            id="session-duration"
            label="Duration (minutes)"
            required
          >
            <Input
              type="number"
              min={1}
              value={form.durationMinutes}
              onChange={(e) =>
                setForm({ ...form, durationMinutes: e.target.value })
              }
            />
          </FormField>
          <FormField id="session-zoom" label="Zoom URL" required>
            <Input
              type="url"
              value={form.zoomUrl}
              onChange={(e) => setForm({ ...form, zoomUrl: e.target.value })}
              placeholder="https://zoom.us/j/…"
            />
          </FormField>
          {formError && (
            <p
              role="alert"
              className="text-[12px] font-semibold text-[var(--color-wise-danger)]"
            >
              {formError}
            </p>
          )}
        </form>
      </Modal>

      {/* Cancel-session confirm dialog */}
      <ConfirmDialog
        open={Boolean(deletingSession)}
        onOpenChange={(open) => {
          if (!open) setDeletingSession(null)
        }}
        title="Cancel this session?"
        description={
          deletingSession
            ? `This will remove "${deletingSession.title}" from the cohort's live sessions list. Students enrolled will no longer see it.`
            : ''
        }
        confirmLabel="Cancel session"
        cancelLabel="Keep"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (deletingSession) {
            await deleteMutation.mutateAsync(deletingSession.id)
          }
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pricing Tab — Sprint 2 Story 11
//
// API-backed CRUD for PaymentPlans. Supports ONE_TIME + INSTALLMENT variants
// with a shared modal for add / edit, a toggle for active/inactive, and a
// ConfirmDialog-gated deactivation (backend has no DELETE; deactivation is
// the safe equivalent — historic plans remain tied to past enrolments).
// ---------------------------------------------------------------------------

interface PaymentPlanFormState {
  name: string
  type: 'ONE_TIME' | 'INSTALLMENT'
  totalAmount: string
  currency: string
  intervalDays: string
}

function blankPlanForm(): PaymentPlanFormState {
  return {
    name: '',
    type: 'ONE_TIME',
    totalAmount: '',
    currency: 'usd',
    intervalDays: '30',
  }
}

function planToForm(p: AdminPaymentPlan): PaymentPlanFormState {
  return {
    name: p.name,
    type: p.type,
    totalAmount: String(p.totalAmount),
    currency: p.currency,
    intervalDays: p.intervalDays != null ? String(p.intervalDays) : '30',
  }
}

function formatAmount(amount: number, currency: string): string {
  // Amount is stored in cents (see createPaymentPlanSchema z.number().int().min(100)).
  // Render as a user-facing currency string.
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100)
  } catch {
    return `$${(amount / 100).toFixed(0)}`
  }
}

function PricingTab({
  cohortId,
  isAdmin,
  addToast,
}: {
  cohortId: string | null
  isAdmin: boolean
  addToast: (message: string, variant: 'success' | 'error') => void
}) {
  const queryClient = useQueryClient()
  const plansKey = ['admin', 'courses', cohortId ?? '__draft__', 'payment-plans'] as const

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<AdminPaymentPlan | null>(null)
  const [form, setForm] = useState<PaymentPlanFormState>(blankPlanForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingPlan, setDeletingPlan] = useState<AdminPaymentPlan | null>(null)

  const {
    data: plans = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: plansKey,
    queryFn: () => fetchAdminPaymentPlans(cohortId as string),
    enabled: Boolean(cohortId),
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreatePaymentPlanPayload) =>
      createAdminPaymentPlan(cohortId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plansKey })
      addToast('Payment plan created', 'success')
      setModalOpen(false)
      setForm(blankPlanForm())
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: (args: {
      planId: string
      payload: Omit<CreatePaymentPlanPayload, 'type'>
    }) =>
      updateAdminPaymentPlan(cohortId as string, args.planId, args.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plansKey })
      addToast('Payment plan updated', 'success')
      setModalOpen(false)
      setEditingPlan(null)
      setForm(blankPlanForm())
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const toggleMutation = useMutation({
    mutationFn: (planId: string) =>
      toggleAdminPaymentPlan(cohortId as string, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plansKey })
      addToast('Payment plan updated', 'success')
      setDeletingPlan(null)
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  function openAddModal() {
    setEditingPlan(null)
    setForm(blankPlanForm())
    setFormError(null)
    setModalOpen(true)
  }

  function openEditModal(plan: AdminPaymentPlan) {
    setEditingPlan(plan)
    setForm(planToForm(plan))
    setFormError(null)
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) {
      setFormError('Plan name is required')
      return
    }
    const amount = Number(form.totalAmount)
    if (!Number.isFinite(amount) || amount < 100) {
      setFormError('Total amount must be at least 100 (cents)')
      return
    }
    const currency = form.currency.trim() || 'usd'
    if (currency.length !== 3) {
      setFormError('Currency must be a 3-letter ISO code')
      return
    }
    if (editingPlan) {
      // type is immutable on the back end — we strip it from the PATCH body.
      updateMutation.mutate({
        planId: editingPlan.id,
        payload: {
          name: form.name.trim(),
          totalAmount: amount,
          currency,
          ...(form.type === 'INSTALLMENT'
            ? { intervalDays: Number(form.intervalDays) || 30 }
            : {}),
        },
      })
    } else {
      createMutation.mutate({
        name: form.name.trim(),
        type: form.type,
        totalAmount: amount,
        currency,
        ...(form.type === 'INSTALLMENT'
          ? { intervalDays: Number(form.intervalDays) || 30 }
          : {}),
      })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  if (!cohortId) {
    return (
      <div className="px-8 py-6">
        <EmptyState
          icon={DollarSign}
          title="Save the course first"
          description="Payment plans are attached to a saved course. Save the draft on the Overview tab to start defining pricing."
        />
      </div>
    )
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-[700] text-[#1a2744]">Payment Plans</h3>
        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} aria-hidden="true" />}
            onClick={openAddModal}
          >
            Add Plan
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="py-10">
          <LoadingSpinner centered label="Loading payment plans" />
        </div>
      )}

      {isError && (
        <div className="p-6 text-center text-[13px] text-[#d03238]">
          Failed to load payment plans. Try refreshing.
        </div>
      )}

      {!isLoading && !isError && plans.length === 0 && (
        <EmptyState
          icon={DollarSign}
          title="No payment plans yet"
          description="Add a one-time or installment plan to start selling this cohort."
          action={
            isAdmin
              ? { label: 'Add Plan', onClick: openAddModal }
              : undefined
          }
        />
      )}

      {!isLoading && !isError && plans.length > 0 && (
        <div
          className="bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden"
          data-testid="payment-plans-list"
        >
          <table className="w-full border-collapse" aria-label="Payment plans">
            <thead>
              <tr>
                {['Name', 'Type', 'Amount', 'Installments', 'Active', 'Actions'].map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="text-left text-[12px] font-[600] text-[#717182] px-5 py-3 border-b border-[rgba(26,39,68,0.08)] uppercase tracking-[0.5px] bg-[#f8f9fb]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:[&>td]:bg-[#f8f9fb] transition-colors">
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[14px] font-[600] text-[#1a2744]">
                    {plan.name}
                  </td>
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]">
                    {plan.type === 'ONE_TIME' ? 'One-time' : 'Installment'}
                  </td>
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#1a2744] font-[600]">
                    {formatAmount(plan.totalAmount, plan.currency)}
                  </td>
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]">
                    {plan.type === 'INSTALLMENT'
                      ? `${plan.installments?.length ?? 3} × every ${plan.intervalDays ?? 30}d`
                      : '—'}
                  </td>
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                    <span
                      className={cn(
                        'text-[11px] font-[600] px-[9px] py-[3px] rounded-full',
                        plan.isActive
                          ? 'bg-[#e6f4ec] text-[#054d28]'
                          : 'bg-[#f0f0f0] text-[#717182]',
                      )}
                    >
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="text-[13px] font-[600] text-[#4a9ad4] hover:underline"
                        onClick={() => openEditModal(plan)}
                        disabled={!isAdmin}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-[13px] font-[600] text-[#d03238] hover:underline"
                        onClick={() => setDeletingPlan(plan)}
                        disabled={!isAdmin}
                      >
                        {plan.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit plan modal */}
      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setModalOpen(false)
            setEditingPlan(null)
            setFormError(null)
          }
        }}
        title={editingPlan ? 'Edit Payment Plan' : 'Add Payment Plan'}
        description="Define the price, currency, and schedule for this cohort."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false)
                setEditingPlan(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="payment-plan-form"
              isLoading={isSaving}
            >
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </>
        }
      >
        <form
          id="payment-plan-form"
          onSubmit={handleSubmit}
          className={cn('flex flex-col gap-4')}
        >
          <FormField id="plan-name" label="Plan name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Founding cohort"
            />
          </FormField>
          <div>
            <label
              htmlFor="plan-type"
              className="block text-[14px] font-semibold text-[var(--color-wise-text)] mb-1.5"
            >
              Type
            </label>
            <select
              id="plan-type"
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as 'ONE_TIME' | 'INSTALLMENT',
                })
              }
              disabled={Boolean(editingPlan)}
              className={cn(
                'w-full h-11 px-4 rounded-xl border bg-white text-[15px]',
                'border-[var(--color-wise-ring)] outline-none',
                'focus:ring-4 focus:ring-[var(--color-wise-primary)]/25',
                'disabled:opacity-50',
              )}
            >
              <option value="ONE_TIME">One-time</option>
              <option value="INSTALLMENT">Installment (3 payments)</option>
            </select>
            {editingPlan && (
              <p className="mt-1.5 text-[12px] text-[var(--color-wise-text-muted)]">
                Plan type cannot be changed after creation.
              </p>
            )}
          </div>
          <FormField
            id="plan-amount"
            label="Total amount (cents)"
            helperText="Store the amount in cents — e.g. $499 → 49900."
            required
          >
            <Input
              type="number"
              min={100}
              value={form.totalAmount}
              onChange={(e) =>
                setForm({ ...form, totalAmount: e.target.value })
              }
              placeholder="49900"
            />
          </FormField>
          <FormField
            id="plan-currency"
            label="Currency (3-letter ISO)"
            required
          >
            <Input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              placeholder="usd"
              maxLength={3}
            />
          </FormField>
          {form.type === 'INSTALLMENT' && (
            <FormField
              id="plan-interval"
              label="Days between installments"
            >
              <Input
                type="number"
                min={1}
                value={form.intervalDays}
                onChange={(e) =>
                  setForm({ ...form, intervalDays: e.target.value })
                }
              />
            </FormField>
          )}
          {formError && (
            <p
              role="alert"
              className="text-[12px] font-semibold text-[var(--color-wise-danger)]"
            >
              {formError}
            </p>
          )}
        </form>
      </Modal>

      {/* Delete / toggle confirm dialog */}
      <ConfirmDialog
        open={Boolean(deletingPlan)}
        onOpenChange={(open) => {
          if (!open) setDeletingPlan(null)
        }}
        title={deletingPlan?.isActive ? 'Deactivate plan?' : 'Activate plan?'}
        description={
          deletingPlan
            ? deletingPlan.isActive
              ? `"${deletingPlan.name}" will no longer be purchasable. Existing enrolments are unaffected.`
              : `"${deletingPlan.name}" will become purchasable again.`
            : ''
        }
        confirmLabel={deletingPlan?.isActive ? 'Deactivate' : 'Activate'}
        cancelLabel="Cancel"
        variant={deletingPlan?.isActive ? 'danger' : 'warning'}
        isLoading={toggleMutation.isPending}
        onConfirm={async () => {
          if (deletingPlan) {
            await toggleMutation.mutateAsync(deletingPlan.id)
          }
        }}
      />
    </div>
  )
}

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
        <div className="flex gap-2.5 ml-auto">
          <button
            type="button"
            onClick={onSave}
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
          <OverviewTab draft={draft} onChange={onChange} />
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

export default function CourseBuilderPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<AdminCourse | null | undefined>(undefined)
  const [draft, setDraft] = useState<CourseDraft | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

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
    staleTime: 60_000,
  })

  const courses = data?.courses ?? []

  function handleSelectCourse(course: AdminCourse | null) {
    setSelectedCourse(course)
    if (course === null) {
      setDraft(newCourse())
    } else {
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
      })
    }
  }

  function handleDraftChange(updated: Partial<CourseDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...updated } : prev))
  }

  // Sprint 2 Story 11 — real handleSave.
  // Creates a cohort via POST when draft.id is empty, otherwise PATCHes the
  // existing cohort. On success we flip draft.id (or update the selected
  // course row) and invalidate the admin-courses list so the sidebar refreshes
  // without a full refetch loop.
  async function handleSave() {
    if (!draft) return
    setIsSaving(true)

    // Shared payload — the back-end schema expects specific key names
    // (liveStartDate / liveEndDate, maxSeats as a number) so we normalise
    // once here. Empty strings/NaNs are stripped rather than sent as nulls.
    const maxSeatsNumber =
      draft.maxSeats.trim() === '' ? undefined : Number(draft.maxSeats)
    const payload = {
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
    }

    try {
      if (!draft.id) {
        const created = await createAdminCourse(payload)
        // Flip into server-backed mode — setting draft.id unlocks the
        // ServerCurriculumList / PricingTab / LiveSessionsTab data fetches.
        setDraft((prev) => (prev ? { ...prev, id: created.id } : prev))
        queryClient.invalidateQueries({ queryKey: ['admin-courses'] })
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
