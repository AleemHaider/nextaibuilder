// FIR-52 — Curriculum browser: two-column LMS shell with sidebar accordion + content area
// FIR-73 — Mobile responsive: sidebar collapses to a toggle drawer on small screens
// Sprint 3 Story 15 — Wise theme migration.
//
// Curriculum sidebar now rides on Wise surface tokens with mint-accented
// active lessons. Lesson-status glyphs are lucide icons. The mobile drawer
// preserves the Wave 6 hamburger pattern (Menu + X) and is rendered via
// role="dialog" with a scrim. User dropdown is inline only for now — a later
// story may consolidate on a shared primitive.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router'
import {
  Menu,
  X,
  Check,
  Play,
  Lock,
  ArrowLeft,
  LogOut,
  GraduationCap,
  Bell,
  Settings as SettingsIcon,
  Calendar,
} from 'lucide-react'
import { fetchCurriculum, type CurriculumModule, type LessonSummary } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Lesson status icon — Wise mint for completed, primary for in-progress,
// muted for locked.
// ---------------------------------------------------------------------------

function LessonIcon({ status }: { status: LessonSummary['status'] }) {
  const base = 'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0'

  if (status === 'COMPLETED') {
    return (
      <div
        className={cn(
          base,
          'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
        )}
        aria-hidden="true"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </div>
    )
  }
  if (status === 'IN_PROGRESS') {
    return (
      <div
        className={cn(
          base,
          'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
        )}
        aria-hidden="true"
      >
        <Play className="h-3 w-3 fill-current" />
      </div>
    )
  }
  return (
    <div
      className={cn(
        base,
        'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]',
      )}
      aria-hidden="true"
    >
      <Lock className="h-3 w-3" />
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
    <div className="border-b border-[var(--color-wise-ring)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-[14px]',
          'cursor-pointer hover:bg-[var(--color-wise-surface-soft)] transition-colors',
          'bg-transparent border-none text-left font-sans',
          'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-[-2px]',
        )}
        aria-expanded={open}
      >
        <span className="text-[14px] font-bold text-[var(--color-wise-text)]">
          {module.title}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)] px-2 py-0.5 rounded-[var(--radius-pill)]">
            {module.lessons.length}
          </span>
          <span className="text-[14px] text-[var(--color-wise-text-muted)]">
            {open ? '↑' : '›'}
          </span>
        </div>
      </button>

      {open && (
        <div className="bg-[var(--color-wise-canvas)]">
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
                  'border-b border-[var(--color-wise-ring)] transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-[-2px]',
                  isCurrent
                    ? 'bg-[var(--color-wise-mint)] border-l-[3px] border-l-[var(--color-wise-primary)] pl-[25px]'
                    : 'pl-7 hover:bg-[var(--color-wise-surface-soft)]',
                  isLocked && 'cursor-not-allowed',
                )}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <LessonIcon status={lesson.status} />
                <span
                  className={cn(
                    'text-[13px] font-medium flex-1 leading-snug',
                    isCurrent && 'text-[var(--color-wise-primary-text)] font-semibold',
                    isLocked && 'text-[var(--color-wise-text-muted)]',
                    !isCurrent && !isLocked && 'text-[var(--color-wise-text)]',
                  )}
                >
                  {lesson.title}
                </span>
                <span className="text-[11px] text-[var(--color-wise-text-muted)] flex-shrink-0">
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
    <div className="p-4 flex flex-col gap-3">
      <LoadingSkeleton variant="rect" height={12} className="w-4/5 rounded-full" />
      <LoadingSkeleton variant="rect" height={8} className="w-full rounded-full" />
      <LoadingSkeleton variant="rect" height={8} className="w-1/2 rounded-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// User dropdown (Sign Out, Dashboard, Settings) — migrated to Wise tokens
// ---------------------------------------------------------------------------

function UserDropdown({ initials }: { initials: string }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center',
          'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
          'text-[12px] font-bold border-none cursor-pointer',
          'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
        )}
      >
        {initials}
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-[calc(100%+8px)] z-50 w-[200px]',
            'bg-[var(--color-wise-surface)] rounded-[var(--radius-sm)]',
            'shadow-[var(--shadow-card)]',
            'border border-[var(--color-wise-ring)] overflow-hidden py-1',
          )}
          role="menu"
        >
          <DropdownItem
            icon={<GraduationCap className="h-4 w-4" />}
            label="My Courses"
            onClick={() => { setOpen(false); navigate('/student/dashboard') }}
          />
          <DropdownItem
            icon={<Bell className="h-4 w-4" />}
            label="Notifications"
            onClick={() => { setOpen(false); navigate('/student/notifications') }}
          />
          <DropdownItem
            icon={<SettingsIcon className="h-4 w-4" />}
            label="Settings"
            onClick={() => { setOpen(false); navigate('/student/settings') }}
          />
          <div className="h-px bg-[var(--color-wise-ring)] mx-3 my-1" />
          <DropdownItem
            icon={<LogOut className="h-4 w-4" />}
            label="Sign out"
            onClick={handleSignOut}
            variant="danger"
          />
        </div>
      )}
    </div>
  )
}

interface DropdownItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
}

function DropdownItem({ icon, label, onClick, variant = 'default' }: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold',
        'text-left bg-transparent border-none cursor-pointer transition-colors',
        variant === 'danger'
          ? 'text-[var(--color-wise-danger)] hover:bg-[var(--color-wise-danger-soft)]'
          : 'text-[var(--color-wise-text)] hover:bg-[var(--color-wise-surface-soft)]',
      )}
    >
      <span className="text-[var(--color-wise-text-muted)]" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
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
      <div className="min-h-screen bg-[var(--color-wise-canvas)] flex flex-col">

        {/* Top bar */}
        <header
          className={cn(
            'h-14 bg-[var(--color-wise-surface)] flex items-center px-4 sm:px-5 gap-3 sm:gap-4 flex-shrink-0',
            'border-b border-[var(--color-wise-ring)]',
          )}
        >
          {/* Mobile sidebar toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open course curriculum"
            className={cn(
              'lg:hidden p-2 rounded-[var(--radius-sm)] text-[var(--color-wise-text-muted)]',
              'hover:bg-[var(--color-wise-surface-soft)] transition-colors flex-shrink-0',
              'bg-transparent border-none cursor-pointer',
              'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2',
            )}
          >
            <Menu size={18} aria-hidden="true" />
          </button>

          <Link
            to="/student/dashboard"
            className={cn(
              'hidden sm:flex items-center gap-1.5 text-[14px] font-semibold',
              'text-[var(--color-wise-text-muted)] no-underline',
              'hover:text-[var(--color-wise-text)] transition-colors flex-shrink-0',
            )}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Dashboard
          </Link>
          <div className="hidden sm:block w-px h-6 bg-[var(--color-wise-ring)]" />
          <p className="text-[14px] sm:text-[15px] font-semibold text-[var(--color-wise-text)] flex-1 text-center truncate">
            {isLoading ? '…' : cohortTitle}
          </p>
          <span
            className={cn(
              'hidden sm:inline text-[13px] font-semibold text-[var(--color-wise-primary-text)]',
              'bg-[var(--color-wise-mint)] px-3 py-1 rounded-[var(--radius-pill)] flex-shrink-0',
            )}
          >
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
                className="fixed inset-0 bg-black/40"
                aria-hidden="true"
                onClick={() => setSidebarOpen(false)}
              />
              <aside
                className={cn(
                  'relative z-50 w-[280px] bg-[var(--color-wise-surface)] h-full',
                  'overflow-y-auto shadow-[var(--shadow-card)] flex flex-col',
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-between px-5 py-4',
                    'border-b border-[var(--color-wise-ring)]',
                  )}
                >
                  <span className="text-[14px] font-bold text-[var(--color-wise-text)]">
                    Curriculum
                  </span>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close curriculum"
                    className={cn(
                      'p-1 rounded-[var(--radius-sm)] text-[var(--color-wise-text-muted)]',
                      'hover:bg-[var(--color-wise-surface-soft)] transition-colors',
                      'bg-transparent border-none cursor-pointer',
                      'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2',
                    )}
                  >
                    <X size={18} />
                  </button>
                </div>
                {isLoading ? (
                  <SidebarSkeleton />
                ) : error ? (
                  <p className="p-4 text-[13px] text-[var(--color-wise-danger)]">
                    Failed to load curriculum
                  </p>
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
            className={cn(
              'hidden lg:flex w-[280px] bg-[var(--color-wise-surface)]',
              'border-r border-[var(--color-wise-ring)] flex-col flex-shrink-0 overflow-y-auto',
            )}
            aria-label="Course curriculum"
          >
            {/* Sidebar header */}
            <div className="p-5 border-b border-[var(--color-wise-ring)]">
              <p className="text-[15px] font-bold text-[var(--color-wise-text)] mb-1 truncate">
                {cohortTitle}
              </p>
              <div className="flex justify-between mb-1.5">
                <span className="text-[13px] font-bold text-[var(--color-wise-text)]">
                  {completionPercentage}% complete
                </span>
                <span className="text-[12px] text-[var(--color-wise-text-muted)]">
                  {lessonsCompleted} / {totalLessons}
                </span>
              </div>
              <div className="h-1 bg-[var(--color-wise-surface-soft)] rounded-[var(--radius-pill)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-wise-primary)] rounded-[var(--radius-pill)] transition-all"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Modules */}
            {isLoading ? (
              <SidebarSkeleton />
            ) : error ? (
              <p className="p-4 text-[13px] text-[var(--color-wise-danger)]">
                Failed to load curriculum
              </p>
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
            <div className="mt-auto p-4 border-t border-[var(--color-wise-ring)]">
              <Link
                to={`/student/course/${slug}/sessions`}
                className={cn(
                  'flex items-center gap-2 text-[13px] font-semibold',
                  'text-[var(--color-wise-text-muted)] px-3 py-2 rounded-[var(--radius-sm)]',
                  'hover:bg-[var(--color-wise-surface-soft)] hover:text-[var(--color-wise-text)]',
                  'transition-colors no-underline',
                )}
              >
                <Calendar className="h-4 w-4" aria-hidden="true" /> Live Sessions
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
