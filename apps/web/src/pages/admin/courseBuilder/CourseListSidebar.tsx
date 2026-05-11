// Left sidebar of the Course Builder: search + "New Course" CTA + course list.
// Extracted from CourseBuilderPage to keep the page file focused.

import { Search, Plus } from 'lucide-react'
import type { AdminCourse } from '../../../lib/api'
import { cn } from '../../../lib/utils'
import { AVATAR_GRADIENTS, type CourseStatus } from './types'

interface CourseListSidebarProps {
  courses: AdminCourse[]
  isLoading: boolean
  selectedId: string | null
  onSelect: (course: AdminCourse | null) => void
  searchQuery: string
  onSearchChange: (q: string) => void
}

export function CourseListSidebar({
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
