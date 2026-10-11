'use client'

// Lesson player — content viewer + mark complete + prev/next nav (FIR-53/54)
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { lmsApi } from '@/lib/api-client'
import { usePageMeta } from '@/hooks/use-page-meta'
import { Button } from '@/components/ui/button'

function LessonSkeleton() {
  return (
    <div data-slot="lesson-skeleton" className="animate-pulse space-y-4 p-6">
      <div className="h-4 w-40 rounded-md bg-muted" />
      <div className="h-6 w-72 rounded-md bg-muted" />
      <div className="aspect-video w-full rounded-xl bg-muted" />
      <div className="h-4 w-full rounded-md bg-muted" />
      <div className="h-4 w-2/3 rounded-md bg-muted" />
    </div>
  )
}

export default function Page() {
  const params = useParams<{ slug: string; lessonId: string }>()
  const { slug, lessonId } = params
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['lms-lesson', slug, lessonId],
    queryFn: async () => {
      const { data, error } = await lmsApi.getLesson(slug, lessonId)
      if (error) throw new Error(error.message ?? 'Failed to load lesson')
      return data!
    },
    enabled: Boolean(slug && lessonId),
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await lmsApi.completeLesson(lessonId)
      if (error) throw new Error(error.message ?? 'Failed to mark lesson complete')
      return data!
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lms-curriculum', slug] })
      void queryClient.invalidateQueries({ queryKey: ['lms-lesson', slug] })
      void queryClient.invalidateQueries({ queryKey: ['lms-dashboard'] })
      // Advance to the next lesson if there is one; otherwise back to curriculum
      if (data?.nextLesson) {
        router.push(`/courses/${slug}/lessons/${data.nextLesson.id}`)
      } else {
        router.push(`/courses/${slug}`)
      }
    },
  })

  usePageMeta({ title: `${data?.lesson.title ?? 'Lesson'} — Product Builder Academy` })

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <LessonSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-muted-foreground">
        {error?.message ?? 'Failed to load this lesson.'}
        <div className="mt-4">
          <Link href={`/courses/${slug}`} className="text-[#4a9ad4] hover:underline">
            Back to course
          </Link>
        </div>
      </div>
    )
  }

  const { lesson, prevLesson, nextLesson } = data
  const completed = lesson.status === 'COMPLETED'

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Header */}
        <div>
          <Link
            href={`/courses/${slug}`}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Course overview
          </Link>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className="text-xl font-medium text-foreground">{lesson.title}</h1>
            {completed && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-[#4a9ad4] dark:bg-blue-950/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Completed
              </span>
            )}
          </div>
          {lesson.estimatedMinutes != null && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {lesson.estimatedMinutes} min
            </p>
          )}
        </div>

        {/* Video embed */}
        {lesson.embedUrl && (
          <div className="aspect-video w-full overflow-hidden rounded-xl border bg-muted">
            <iframe
              src={lesson.embedUrl}
              title={lesson.title}
              className="h-full w-full"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
            />
          </div>
        )}

        {/* Written content — prefer TipTap-authored rich HTML over plain text */}
        {lesson.richContent ? (
          <div
            data-slot="lesson-rich-content"
            className="space-y-3 text-sm leading-relaxed text-foreground [&_a]:text-[#4a9ad4] [&_a]:underline [&_h1]:text-lg [&_h1]:font-medium [&_h2]:text-base [&_h2]:font-medium [&_h3]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:text-xs [&_img]:max-w-full [&_img]:rounded-md"
            dangerouslySetInnerHTML={{ __html: lesson.richContent }}
          />
        ) : lesson.content ? (
          <div data-slot="lesson-content" className="whitespace-pre-wrap text-sm text-foreground">
            {lesson.content}
          </div>
        ) : !lesson.embedUrl ? (
          <p className="text-sm text-muted-foreground">
            This lesson&apos;s content hasn&apos;t been published yet. Check back soon.
          </p>
        ) : null}

        {/* Transcript */}
        {lesson.transcript && (
          <details className="rounded-lg border bg-card px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Transcript
            </summary>
            <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {lesson.transcript}
            </div>
          </details>
        )}

        {completeMutation.isError && (
          <p role="alert" className="text-xs text-destructive">
            {(completeMutation.error as Error).message}
          </p>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          {prevLesson ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/courses/${slug}/lessons/${prevLesson.id}`}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Previous
              </Link>
            </Button>
          ) : (
            <span />
          )}

          {!completed ? (
            <Button
              size="sm"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending
                ? 'Saving…'
                : nextLesson
                  ? 'Complete & continue'
                  : 'Complete lesson'}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : nextLesson ? (
            <Button asChild size="sm">
              <Link href={`/courses/${slug}/lessons/${nextLesson.id}`}>
                Next lesson
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href={`/courses/${slug}`}>Back to course</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
