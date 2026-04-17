// FIR-52 — Curriculum browser: two-column LMS shell with sidebar accordion + content area
// FIR-73 — Mobile responsive: sidebar collapses to a toggle drawer on small screens
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router'
import { Menu, X } from 'lucide-react'
import { fetchCurriculum, type CurriculumModule, type LessonSummary } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Lesson status icon
// ---------------------------------------------------------------------------

function LessonIcon({ status }: { status: LessonSummary['status'] }) {
  if (status === 'COMPLETED') {
    return (
      <div className="w-6 h-6 rounded-full bg-[#e8f4fd] text-[#4a9ad4] text-[11px] font-700 flex items-center justify-center flex-shrink-0">
        ✓
      </div>
    )
  }
  if (status === 'IN_PROGRESS') {
    return (
      <div className="w-6 h-6 rounded-full bg-[#4a9ad4] text-white text-[11px] font-700 flex items-center justify-center flex-shrink-0">
        ▶
      </div>
    )
  }
  return (
    <div className="w-6 h-6 rounded-full bg-[#f0f0f0] text-[#d4d4d4] text-[10px] flex items-center justify-center flex-shrink-0">
      🔒
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar module accordion row
// ---------------------------------------------------------------------------

interface ModuleRowProps {
  module: CurriculumModule
  currentLessonId?: string
  slug: string
  defaultOpen?: boolean
}

function ModuleRow({ module, currentLessonId, slug, defaultOpen = false }: ModuleRowProps) {
  const [open, setOpen] = useState(defaultOpen)
  const navigate = useNavigate()

  // Auto-open if this module contains the current lesson
  useEffect(() => {
    if (module.lessons.some((l) => l.id === currentLessonId)) {
      setOpen(true)
    }
  }, [currentLessonId, module.lessons])

  return (
    <div className="border-b border-[rgba(26,39,68,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-[14px]',
          'cursor-pointer hover:bg-[#f8f9fb] transition-colors',
          'bg-transparent border-none text-left font-sans',
        )}
        aria-expanded={open}
      >
        <span className="text-[14px] font-700 text-[#1a2744]">{module.title}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-600 bg-[#e8ecf4] text-[#717182] px-2 py-0.5 rounded-full">
            {module.lessons.length}
          </span>
          <span className="text-[14px] text-[#a3a3a3]">{open ? '↑' : '›'}</span>
        </div>
      </button>

      {open && (
        <div className="bg-[#f8f9fb]">
          {module.lessons.map((lesson) => {
            const isCurrent = lesson.id === currentLessonId
            const isLocked = lesson.status === 'LOCKED'

            return (
              <button
                key={lesson.id}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (!isLocked) navigate(`/student/course/${slug}/lesson/${lesson.id}`)
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 py-[10px] pr-4 font-sans text-left',
                  'cursor-pointer border-none bg-transparent',
                  'border-b border-[rgba(26,39,68,0.04)] transition-colors',
                  isCurrent
                    ? 'bg-[#eef6fd] border-l-[3px] border-l-[#4a9ad4] pl-[25px]'
                    : 'pl-7 hover:bg-[#f0f4f8]',
                  isLocked && 'cursor-not-allowed',
                )}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <LessonIcon status={lesson.status} />
                <span
                  className={cn(
                    'text-[13px] font-500 flex-1 leading-snug',
                    isCurrent && 'text-[#4a9ad4] font-600',
                    isLocked && 'text-[#a3a3a3]',
                    !isCurrent && !isLocked && 'text-[#1a2744]',
                  )}
                >
                  {lesson.title}
                </span>
                <span className="text-[11px] text-[#a3a3a3] flex-shrink-0">
                  {lesson.estimatedMinutes}m
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Context: share curriculum data with child pages (LessonPage, LiveSessionsPage)
// ---------------------------------------------------------------------------

export interface CourseContextValue {
  slug: string
  cohortTitle: string
  completionPercentage: number
  lessonsCompleted: number
  totalLessons: number
  modules: CurriculumModule[]
  currentLessonId?: string
  refreshCurriculum: () => Promise<void>
}

export const CourseContext = createContext<CourseContextValue | null>(null)

export function useCourse(): CourseContextValue {
  const ctx = useContext(CourseContext)
  if (!ctx) throw new Error('useCourse must be used inside CoursePage')
  return ctx
}

// ---------------------------------------------------------------------------
// Sidebar skeleton
// ---------------------------------------------------------------------------

function SidebarSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-3 animate-pulse">
      <div className="h-3 bg-[#e8ecf4] rounded-full w-4/5" />
      <div className="h-2 bg-[#e8ecf4] rounded-full w-full" />
      <div className="h-2 bg-[#e8ecf4] rounded-full w-1/2" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// User dropdown (Sign Out, Dashboard, Settings)
// ---------------------------------------------------------------------------

function UserDropdown({ initials }: { initials: string }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleSignOut() {
    logout()
    navigate('/')
  }

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="User menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-700 border-none cursor-pointer"
        style={{ background: 'linear-gradient(135deg,#4a9ad4,#1a2744)' }}
      >
        {initials}
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-[calc(100%+8px)] z-50 w-[180px]',
            'bg-white rounded-[14px] shadow-[0_8px_32px_rgba(13,26,58,0.18)]',
            'border border-[rgba(26,39,68,0.08)] overflow-hidden py-1',
          )}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); navigate('/student/dashboard') }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-[600] text-[#1a2744] hover:bg-[#f0f7ff] text-left bg-transparent border-none cursor-pointer"
          >
            <span>📚</span> My Courses
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); navigate('/student/notifications') }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-[600] text-[#1a2744] hover:bg-[#f0f7ff] text-left bg-transparent border-none cursor-pointer"
          >
            <span>🔔</span> Notifications
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); navigate('/student/settings') }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-[600] text-[#1a2744] hover:bg-[#f0f7ff] text-left bg-transparent border-none cursor-pointer"
          >
            <span>⚙️</span> Settings
          </button>
          <div className="h-px bg-[rgba(26,39,68,0.08)] mx-3 my-1" />
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-[600] text-[#d03238] hover:bg-[#fdeaeb] text-left bg-transparent border-none cursor-pointer"
          >
            <span>↩</span> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CoursePage — LMS shell
// ---------------------------------------------------------------------------

export default function CoursePage() {
  const { slug = '', lessonId } = useParams<{ slug: string; lessonId?: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [cohortTitle, setCohortTitle] = useState('')
  const [completionPercentage, setCompletionPercentage] = useState(0)
  const [lessonsCompleted, setLessonsCompleted] = useState(0)
  const [totalLessons, setTotalLessons] = useState(0)
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCurriculum = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchCurriculum(slug)
      setCohortTitle(data.cohort.title)
      setCompletionPercentage(data.completionPercentage)
      setLessonsCompleted(data.lessonsCompleted)
      setTotalLessons(data.totalLessons)
      setModules(data.modules)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load curriculum')
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void loadCurriculum()
  }, [loadCurriculum])

  // Navigate to first in-progress or first lesson if no lessonId yet
  useEffect(() => {
    if (isLoading || lessonId || modules.length === 0) return

    const firstInProgress = modules.flatMap((m) => m.lessons).find((l) => l.status === 'IN_PROGRESS')
    const firstLesson = modules[0]?.lessons[0]
    const target = firstInProgress ?? firstLesson
    if (target) {
      navigate(`/student/course/${slug}/lesson/${target.id}`, { replace: true })
    }
  }, [isLoading, lessonId, modules, slug, navigate])

  const initials = user?.name
    ? user.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : 'S'

  const contextValue: CourseContextValue = {
    slug,
    cohortTitle,
    completionPercentage,
    lessonsCompleted,
    totalLessons,
    modules,
    currentLessonId: lessonId,
    refreshCurriculum: loadCurriculum,
  }

  const allLessons = modules.flatMap((m) => m.lessons)
  const currentIndex = lessonId ? allLessons.findIndex((l) => l.id === lessonId) : -1
  const lessonFraction = currentIndex >= 0
    ? `${currentIndex + 1} / ${allLessons.length} lessons`
    : `${allLessons.length} lessons`

  return (
    <CourseContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#f8f9fb] flex flex-col">

        {/* Top bar */}
        <header
          className={cn(
            'h-14 bg-white flex items-center px-4 sm:px-5 gap-3 sm:gap-4 flex-shrink-0',
            '[box-shadow:inset_0_-1px_0_rgba(26,39,68,0.1)]',
          )}
        >
          {/* Mobile sidebar toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open course curriculum"
            className="lg:hidden p-2 rounded-lg text-[#717182] hover:bg-[#f0f0f0] transition-colors flex-shrink-0 bg-transparent border-none cursor-pointer"
          >
            <Menu size={18} aria-hidden="true" />
          </button>

          <Link
            to="/student/dashboard"
            className="hidden sm:flex items-center gap-1.5 text-[14px] font-600 text-[#717182] no-underline hover:text-[#1a2744] transition-colors flex-shrink-0"
          >
            <span className="text-[18px]">←</span> Dashboard
          </Link>
          <div className="hidden sm:block w-px h-6 bg-[rgba(26,39,68,0.12)]" />
          <p className="text-[14px] sm:text-[15px] font-600 text-[#1a2744] flex-1 text-center truncate">
            {isLoading ? '…' : cohortTitle}
          </p>
          <span className="hidden sm:inline text-[13px] font-600 text-[#717182] bg-[#f0f0f0] px-3 py-1 rounded-full flex-shrink-0">
            {lessonFraction}
          </span>
          <UserDropdown initials={initials} />
        </header>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div
              className="lg:hidden fixed inset-0 z-40 flex"
              role="dialog"
              aria-modal="true"
              aria-label="Course curriculum"
            >
              <div
                className="fixed inset-0 bg-[rgba(13,26,58,0.4)]"
                aria-hidden="true"
                onClick={() => setSidebarOpen(false)}
              />
              <aside className="relative z-50 w-[280px] bg-white h-full overflow-y-auto shadow-xl flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(26,39,68,0.08)]">
                  <span className="text-[14px] font-[700] text-[#1a2744]">Curriculum</span>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close curriculum"
                    className="p-1 rounded-lg text-[#717182] hover:bg-[#f0f0f0] transition-colors bg-transparent border-none cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
                {isLoading ? (
                  <SidebarSkeleton />
                ) : error ? (
                  <p className="p-4 text-[13px] text-[#d03238]">Failed to load curriculum</p>
                ) : (
                  modules.map((mod, i) => (
                    <ModuleRow
                      key={mod.id}
                      module={mod}
                      currentLessonId={lessonId}
                      slug={slug}
                      defaultOpen={i === 0}
                    />
                  ))
                )}
              </aside>
            </div>
          )}

          {/* Desktop Sidebar */}
          <aside
            className="hidden lg:flex w-[280px] bg-white border-r border-[rgba(26,39,68,0.1)] flex-col flex-shrink-0 overflow-y-auto"
            aria-label="Course curriculum"
          >
            {/* Sidebar header */}
            <div className="p-5 border-b border-[rgba(26,39,68,0.08)]">
              <p className="text-[15px] font-700 text-[#1a2744] mb-1 truncate">{cohortTitle}</p>
              <div className="flex justify-between mb-1.5">
                <span className="text-[13px] font-700 text-[#1a2744]">{completionPercentage}% complete</span>
                <span className="text-[12px] text-[#717182]">{lessonsCompleted} / {totalLessons}</span>
              </div>
              <div className="h-1 bg-[#e8ecf4] rounded-full">
                <div
                  className="h-full bg-[#4a9ad4] rounded-full transition-all"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Modules */}
            {isLoading ? (
              <SidebarSkeleton />
            ) : error ? (
              <p className="p-4 text-[13px] text-[#d03238]">Failed to load curriculum</p>
            ) : (
              modules.map((mod, i) => (
                <ModuleRow
                  key={mod.id}
                  module={mod}
                  currentLessonId={lessonId}
                  slug={slug}
                  defaultOpen={i === 0}
                />
              ))
            )}

            {/* Footer links */}
            <div className="mt-auto p-4 border-t border-[rgba(26,39,68,0.08)]">
              <Link
                to={`/student/course/${slug}/sessions`}
                className="flex items-center gap-2 text-[13px] font-600 text-[#717182] px-3 py-2 rounded-lg hover:bg-[#f0f0f0] hover:text-[#1a2744] transition-colors no-underline"
              >
                <span className="text-[16px]">📅</span> Live Sessions
              </Link>
            </div>
          </aside>

          {/* Main content area — Outlet renders LessonPage or LiveSessionsPage */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </CourseContext.Provider>
  )
}
