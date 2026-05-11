// Shared types, constants, and helpers extracted from CourseBuilderPage.
// Kept in one file so cross-tab imports don't ripple.

import { Video, FileText, Wrench } from 'lucide-react'
import type { InstructorSummary } from '../../../lib/api'

// ── Discriminated unions ────────────────────────────────────────────────────

export type CourseType = 'recorded' | 'live' | 'combined'
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type EditorTab = 'Overview' | 'Curriculum' | 'Live Sessions' | 'Pricing' | 'Enrollments'

// ── Draft shapes (local-editor state, distinct from server AdminCourse) ─────

export interface LessonDraft {
  id: string
  title: string
  type: 'VIDEO' | 'TEXT' | 'TOOL_SETUP'
  estimatedMinutes: number
  published: boolean
}

export interface ModuleDraft {
  id: string
  title: string
  order: number
  expanded: boolean
  lessons: LessonDraft[]
}

export interface CourseDraft {
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
  // NAB-P0-2 — marketing bullets edited in the Overview tab and persisted
  // via the same PATCH /admin/courses/:id call as the rest of the draft.
  learningOutcomes: string[]
  requirements: string[]
  targetAudience: string[]
  // NAB-P0-3 — assigned instructor profile IDs (ordered, first = primary)
  // plus the populated summary used to render chips in the Overview tab.
  instructorIds: string[]
  instructors: InstructorSummary[]
}

// ── Caps ────────────────────────────────────────────────────────────────────
// NAB-P0-2 — caps match the backend Zod schema (apps/api/src/routes/admin/courses.ts)
// and the Cohort schema validators.

export const MAX_LEARNING_OUTCOMES = 12
export const MAX_REQUIREMENTS = 10
export const MAX_TARGET_AUDIENCE = 8
export const BULLET_ENTRY_MAX_LENGTH = 140

// ── Tab strip + course-type metadata ────────────────────────────────────────

export const TABS: EditorTab[] = ['Overview', 'Curriculum', 'Live Sessions', 'Pricing', 'Enrollments']

export const COURSE_TYPES: Array<{
  value: CourseType
  label: string
  desc: string
  icon: string
  color: string
}> = [
  { value: 'recorded', label: 'Recorded',    desc: 'Self-paced video',    icon: '📹', color: 'blue' },
  { value: 'live',     label: 'Live Cohort', desc: 'Scheduled sessions',  icon: '🔴', color: 'orange' },
  { value: 'combined', label: 'Combined',    desc: 'Both formats',        icon: '⚡', color: 'navy' },
]

export const TYPE_ICON_COLORS: Record<CourseType, string> = {
  recorded: 'bg-[#e8f4fd]',
  live:     'bg-[#fff0e8]',
  combined: 'bg-[#e8ecf4]',
}

export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #1a2744, #4a9ad4)',
  'linear-gradient(135deg, #cc4a00, #ff8c5a)',
  'linear-gradient(135deg, #0d1a3a, #2d4a8a)',
]

// ── Factories ───────────────────────────────────────────────────────────────

export function newCourse(): CourseDraft {
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
    learningOutcomes: [],
    requirements: [],
    targetAudience: [],
    instructorIds: [],
    instructors: [],
  }
}

export function newModule(order: number): ModuleDraft {
  return {
    id: crypto.randomUUID(),
    title: 'New Module',
    order,
    expanded: true,
    lessons: [],
  }
}

export function newLesson(): LessonDraft {
  return {
    id: crypto.randomUUID(),
    title: 'New Lesson',
    type: 'VIDEO',
    estimatedMinutes: 10,
    published: false,
  }
}

// ── Small render helpers ────────────────────────────────────────────────────

export function lessonTypeIcon(type: LessonDraft['type']) {
  if (type === 'VIDEO') return <Video size={12} />
  if (type === 'TEXT') return <FileText size={12} />
  return <Wrench size={12} />
}
