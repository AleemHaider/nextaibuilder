'use client'

// My Courses — student LMS dashboard (FIR-51)
// Lists active enrollments with progress and a continue-learning CTA.
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BookOpen, GraduationCap } from 'lucide-react'
import { lmsApi, type LmsEnrollment } from '@/lib/api-client'
import { usePageMeta } from '@/hooks/use-page-meta'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

function CoursesSkeleton() {
  return (
    <div data-slot="courses-skeleton" className="animate-pulse space-y-4 p-6">
      <div className="h-6 w-40 rounded-md bg-muted" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="h-32 w-full rounded-xl bg-muted" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center space-y-4 py-16 text-center px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/30">
        <GraduationCap className="h-8 w-8 text-[#4a9ad4]" />
      </div>
      <div>
        <h1 className="text-xl font-medium text-foreground">No courses yet</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Once you enroll in a cohort, your courses will appear here.
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  )
}

function CourseCard({ enrollment }: { enrollment: LmsEnrollment }) {
  const { cohort, completionPercentage, lessonsCompleted, totalLessons, nextLessonTitle, status } =
    enrollment
  const complete = completionPercentage >= 100

  return (
    <div
      data-slot="course-card"
      className="rounded-xl border bg-card text-card-foreground p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {cohort.type === 'live' ? 'Live cohort' : 'Self-paced'}
          </p>
          <h2 className="mt-1 text-base font-medium text-foreground truncate">{cohort.title}</h2>
          {!complete && nextLessonTitle && (
            <p className="mt-1 text-sm text-muted-foreground truncate">
              Next up: {nextLessonTitle}
            </p>
          )}
          {complete && (
            <p className="mt-1 text-sm text-[#4a9ad4]">Course complete — congratulations! 🎉</p>
          )}
          {status !== 'ACTIVE' && (
            <p className="mt-1 text-xs text-destructive">Enrollment {status.toLowerCase()}</p>
          )}
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href={`/courses/${cohort.slug}`}>
            {complete ? 'Review' : lessonsCompleted > 0 ? 'Continue' : 'Start'}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            {lessonsCompleted} of {totalLessons} lessons
          </span>
          <span>{completionPercentage}%</span>
        </div>
        <Progress value={completionPercentage} className="h-2" />
      </div>
    </div>
  )
}

export default function Page() {
  usePageMeta({ title: 'My Courses — Product Builder Academy' })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['lms-dashboard'],
    queryFn: async () => {
      const { data, error } = await lmsApi.getDashboard()
      if (error) throw new Error(error.message ?? 'Failed to load courses')
      return data!
    },
  })

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <CoursesSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-muted-foreground">
        Failed to load your courses. Please refresh.
      </div>
    )
  }

  if (data.enrollments.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-xl font-medium text-foreground">My Courses</h1>
        {data.enrollments.map((e) => (
          <CourseCard key={e.id} enrollment={e} />
        ))}
      </div>
    </div>
  )
}
