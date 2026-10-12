'use client'

// Course curriculum — modules + lessons with per-student status (FIR-52)
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  PlayCircle,
} from 'lucide-react'
import {
  lmsApi,
  type CurriculumLesson,
  type CurriculumModule,
} from '@/lib/api-client'
import { usePageMeta } from '@/hooks/use-page-meta'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

function CurriculumSkeleton() {
  return (
    <div data-slot="curriculum-skeleton" className="animate-pulse space-y-4 p-6">
      <div className="h-6 w-64 rounded-md bg-muted" />
      <div className="h-2 w-full rounded-full bg-muted" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 w-full rounded-xl bg-muted" />
      ))}
    </div>
  )
}

function LessonRow({
  lesson,
  slug,
}: {
  lesson: CurriculumLesson
  slug: string
}) {
  const locked = lesson.status === 'LOCKED'
  const completed = lesson.status === 'COMPLETED'

  const inner = (
    <div
      data-slot="lesson-row"
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors',
        locked
          ? 'cursor-not-allowed border-transparent bg-muted/50 text-muted-foreground'
          : 'bg-card hover:bg-accent',
      )}
    >
      {completed ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4a9ad4]" />
      ) : locked ? (
        <Lock className="h-4 w-4 shrink-0" />
      ) : (
        <PlayCircle className="h-4 w-4 shrink-0 text-[#ff8c5a]" />
      )}
      <span className={cn('flex-1 truncate', completed && 'text-muted-foreground')}>
        {lesson.title}
      </span>
      {lesson.estimatedMinutes != null && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {lesson.estimatedMinutes}m
        </span>
      )}
    </div>
  )

  if (locked) return inner

  return (
    <Link href={`/courses/${slug}/lessons/${lesson._id}`} className="block">
      {inner}
    </Link>
  )
}

function ModuleSection({
  module,
  slug,
}: {
  module: CurriculumModule
  slug: string
}) {
  const completed = module.lessons.filter((l) => l.status === 'COMPLETED').length

  return (
    <section data-slot="module-section" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">{module.title}</h2>
        <span className="shrink-0 text-xs text-muted-foreground">
          {completed}/{module.lessons.length}
        </span>
      </div>
      {module.description && (
        <p className="text-xs text-muted-foreground">{module.description}</p>
      )}
      <div className="space-y-1.5">
        {module.lessons.map((l) => (
          <LessonRow key={l._id} lesson={l} slug={slug} />
        ))}
      </div>
    </section>
  )
}

export default function Page() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const { data, isLoading, isError } = useQuery({
    queryKey: ['lms-curriculum', slug],
    queryFn: async () => {
      const { data, error } = await lmsApi.getCurriculum(slug)
      if (error) throw new Error(error.message ?? 'Failed to load curriculum')
      return data!
    },
    enabled: Boolean(slug),
  })

  usePageMeta({ title: `${data?.cohort.title ?? 'Course'} — Product Builder Academy` })

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <CurriculumSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-muted-foreground">
        Failed to load this course. You may not be enrolled, or the course may not exist.
        <div className="mt-4">
          <Link href="/courses" className="text-[#4a9ad4] hover:underline">
            Back to My Courses
          </Link>
        </div>
      </div>
    )
  }

  const allLessons = data.modules.flatMap((m) => m.lessons)
  const completedCount = allLessons.filter((l) => l.status === 'COMPLETED').length
  const percent =
    allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <Link
            href="/courses"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            My Courses
          </Link>
          <h1 className="mt-2 text-xl font-medium text-foreground">{data.cohort.title}</h1>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {completedCount} of {allLessons.length} lessons complete
              </span>
              <span>{percent}%</span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>
        </div>

        {data.modules.map((m) => (
          <ModuleSection key={m.id} module={m} slug={slug} />
        ))}
      </div>
    </div>
  )
}
