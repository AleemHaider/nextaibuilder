// FIR-165 — Admin Course Builder: list + edit with tabs (Overview, Curriculum, Live Sessions, Pricing)
import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, GripVertical, ChevronDown, ChevronUp, X, Video, FileText, Wrench } from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import { fetchAdminCourses, type AdminCourse } from '../../lib/api'
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

function CurriculumTab({
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
    <div className="px-8 pt-6 pb-8">
      {modules.map((module) => (
        <div
          key={module.id}
          className="bg-white rounded-[14px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] mb-3 overflow-hidden"
        >
          {/* Module header */}
          <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[#f8f9fb] transition-colors">
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

          {/* Lesson list */}
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
                  {/* Publish toggle */}
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

              {/* Add lesson */}
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

      {/* Add module button */}
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Live Sessions Tab (placeholder table matching 20-admin-live-sessions design)
// ---------------------------------------------------------------------------

const DEMO_SESSIONS = [
  {
    id: '1',
    title: 'Week 1: AI Fundamentals',
    scheduledAt: '2025-01-20T18:00:00Z',
    durationMinutes: 90,
    zoomUrl: 'https://zoom.us/j/12345678',
    status: 'UPCOMING',
  },
  {
    id: '2',
    title: 'Week 2: Building with Claude API',
    scheduledAt: '2025-01-27T18:00:00Z',
    durationMinutes: 90,
    zoomUrl: 'https://zoom.us/j/87654321',
    status: 'PAST',
  },
]

function LiveSessionsTab() {
  const statusStyles: Record<string, string> = {
    LIVE: 'bg-[#fdeaeb] text-[#d03238]',
    UPCOMING: 'bg-[#e8f4fd] text-[#1a2744]',
    PAST: 'bg-[#e6f4ec] text-[#054d28]',
    CANCELLED: 'bg-[#f0f0f0] text-[#717182]',
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-[700] text-[#1a2744]">Live Sessions</h3>
        <button
          type="button"
          className="px-4 py-2 rounded-full bg-[#4a9ad4] text-[#0d1a3a] text-[13px] font-[700] hover:opacity-90 transition-opacity"
        >
          + Schedule Session
        </button>
      </div>
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
            {DEMO_SESSIONS.map((session) => (
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
                  <span className={cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', statusStyles[session.status])}>
                    {session.status.charAt(0) + session.status.slice(1).toLowerCase()}
                  </span>
                </td>
                <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                  <div className="flex gap-3">
                    <button type="button" className="text-[13px] font-[600] text-[#4a9ad4] hover:underline">
                      Edit
                    </button>
                    <button type="button" className="text-[13px] font-[600] text-[#d03238] hover:underline">
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pricing / Enrollments placeholder tabs
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
}

function CourseEditor({ draft, onChange, onSave, onTogglePublish, isSaving }: CourseEditorProps) {
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
            className="px-5 py-2 rounded-full bg-[#4a9ad4] text-[#0d1a3a] text-[14px] font-[700] hover:opacity-90 transition-opacity"
          >
            {draft.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
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
            modules={draft.modules}
            onChange={(modules) => onChange({ modules })}
          />
        )}
        {activeTab === 'Live Sessions' && <LiveSessionsTab />}
        {activeTab === 'Pricing' && <PlaceholderTabContent label="Pricing Plans" />}
        {activeTab === 'Enrollments' && <PlaceholderTabContent label="Course Enrollments" />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CourseBuilderPage
// ---------------------------------------------------------------------------

export default function CourseBuilderPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<AdminCourse | null | undefined>(undefined)
  const [draft, setDraft] = useState<CourseDraft | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const { toasts, addToast, dismissToast } = useToast()

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

  async function handleSave() {
    if (!draft) return
    setIsSaving(true)
    // Stub: in a real implementation this calls createAdminCourse / updateAdminCourse
    await new Promise((resolve) => setTimeout(resolve, 600))
    setIsSaving(false)
    addToast('Course saved', 'success')
  }

  function handleTogglePublish() {
    if (!draft) return
    const nextStatus: CourseStatus = draft.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    setDraft((prev) => (prev ? { ...prev, status: nextStatus } : prev))
    addToast(
      nextStatus === 'PUBLISHED' ? 'Course published' : 'Course unpublished',
      'success',
    )
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
