// FIR-53 — Lesson player: VIDEO (Loom embed), TEXT (prose markdown), TOOL_SETUP
// FIR-161 — Markdown text lesson rendering via .prose class
// Sprint 2 Story 12 — Real Claude Vision validation for TOOL_SETUP lessons
// Sprint 3 Story 15 — Wise theme migration. Preserves Sprint 2 Story 12's
// tool-setup wiring (useToolSetupValidation hook + data-testids) and Sprint 1
// Story 6's sanitizeLessonHtml wrap. Every data-testid and ARIA attribute the
// test suite relies on is retained.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Clock,
  Lock,
  Play,
  Upload,
} from 'lucide-react'
import {
  fetchLatestToolSetupSubmission,
  fetchLesson,
  markLessonComplete,
  presignToolSetupUpload,
  submitToolSetupScreenshot,
  uploadToolSetupScreenshot,
  type LessonDetail,
  type ToolSetupValidationStatus,
} from '../../lib/api'
import { useCourse } from './CoursePage'
import { cn } from '../../lib/utils'
import { sanitizeLessonHtml } from '../../lib/sanitize'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'

// ---------------------------------------------------------------------------
// Video embed — Loom iframe at 16:9
// ---------------------------------------------------------------------------

function VideoPlayer({ lesson }: { lesson: LessonDetail }) {
  if (lesson.embedUrl) {
    return (
      <div
        className={cn(
          'w-full rounded-[var(--radius-md)] overflow-hidden mb-8',
          'shadow-[var(--shadow-ring)]',
        )}
        style={{ aspectRatio: '16 / 9' }}
      >
        <iframe
          src={lesson.embedUrl}
          title={lesson.title}
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          allow="autoplay; fullscreen"
          style={{ display: 'block' }}
        />
      </div>
    )
  }

  // Placeholder if no embed URL yet — Wise canvas + mint play chip.
  return (
    <div
      className={cn(
        'w-full rounded-[var(--radius-md)] overflow-hidden mb-8 relative',
        'flex items-center justify-center',
        'bg-[var(--color-wise-surface-soft)] shadow-[var(--shadow-ring)]',
      )}
      style={{ aspectRatio: '16 / 9' }}
    >
      <div
        className={cn(
          'w-[72px] h-[72px] rounded-full',
          'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
          'flex items-center justify-center relative z-10',
        )}
        aria-hidden="true"
      >
        <Play className="h-8 w-8 fill-current" />
      </div>
      <p className="absolute bottom-5 left-5 text-[var(--color-wise-text)] text-[14px] font-bold z-10">
        Lesson · {lesson.estimatedMinutes} min
      </p>
      <p className="absolute bottom-5 right-5 text-[var(--color-wise-text-muted)] text-[12px] font-semibold z-10 flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full bg-[var(--color-wise-primary)] inline-block"
          aria-hidden="true"
        />
        Watch on Loom
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Text lesson — prose markdown (FIR-161)
// Sprint 1 Story 6 wrap preserved: we sanitize every incoming HTML fragment
// before feeding it to dangerouslySetInnerHTML.
// ---------------------------------------------------------------------------

function TextLesson({ content }: { content: string }) {
  return (
    // eslint-disable-next-line react/no-danger
    <div
      className="prose mb-8"
      dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(content ?? '') }}
    />
  )
}

// ---------------------------------------------------------------------------
// Tool setup lesson type — screenshot submission flow (Sprint 2 Story 12)
//
// Flow (unchanged from Story 12):
//   1. presignToolSetupUpload → get a presigned PUT URL + s3Key
//   2. uploadToolSetupScreenshot → PUT the file to S3 / local uploads
//   3. submitToolSetupScreenshot → enqueue the Claude Vision BullMQ job
//   4. fetchLatestToolSetupSubmission (every 3s) → poll for terminal status
//
// Terminal statuses: APPROVED | REJECTED | UNDER_REVIEW.
// ---------------------------------------------------------------------------

const TOOL_SETUP_POLL_INTERVAL_MS = 3000
const TOOL_SETUP_POLL_TIMEOUT_MS  = 5 * 60 * 1000 // 5 minutes

type ToolSetupUiStatus =
  | 'IDLE'
  | 'UPLOADING'
  | ToolSetupValidationStatus
  | 'STALLED'

interface UseToolSetupValidationResult {
  status:       ToolSetupUiStatus
  feedback:     string | null
  uploadedName: string | null
  errorMessage: string | null
  submit:       (file: File) => Promise<void>
  reset:        () => void
}

export function useToolSetupValidation(
  lessonId: string,
  onApproved?: () => void,
): UseToolSetupValidationResult {
  const [status,       setStatus]       = useState<ToolSetupUiStatus>('IDLE')
  const [feedback,     setFeedback]     = useState<string | null>(null)
  const [uploadedName, setUploadedName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const pollCancelRef     = useRef<{ cancelled: boolean } | null>(null)
  const onApprovedRef     = useRef(onApproved)
  onApprovedRef.current   = onApproved

  // Hydrate from a prior submission when the page first loads so the student
  // doesn't lose context if they close and re-open the tab mid-poll.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { submission } = await fetchLatestToolSetupSubmission(lessonId)
        if (cancelled || !submission) return
        setStatus(submission.status)
        setFeedback(submission.mlFeedback ?? null)
        if (submission.status === 'VALIDATING') {
          startPolling()
        }
      } catch {
        // Non-fatal — a brand-new lesson has no submission yet.
      }
    })()
    return () => {
      cancelled = true
      if (pollCancelRef.current) pollCancelRef.current.cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  function startPolling() {
    if (pollCancelRef.current) pollCancelRef.current.cancelled = true
    const handle = { cancelled: false }
    pollCancelRef.current = handle

    const startedAt = Date.now()
    async function tick() {
      if (handle.cancelled) return
      try {
        const { submission } = await fetchLatestToolSetupSubmission(lessonId)
        if (handle.cancelled) return
        if (!submission) {
          // Shouldn't happen right after submit — keep polling.
        } else if (submission.status !== 'VALIDATING') {
          setStatus(submission.status)
          setFeedback(submission.mlFeedback ?? null)
          if (submission.status === 'APPROVED') onApprovedRef.current?.()
          return
        }
      } catch {
        // Transient network errors shouldn't kill the polling loop.
      }

      if (Date.now() - startedAt > TOOL_SETUP_POLL_TIMEOUT_MS) {
        if (!handle.cancelled) setStatus('STALLED')
        return
      }

      setTimeout(tick, TOOL_SETUP_POLL_INTERVAL_MS)
    }
    setTimeout(tick, TOOL_SETUP_POLL_INTERVAL_MS)
  }

  async function submit(file: File): Promise<void> {
    setErrorMessage(null)
    setUploadedName(file.name)
    setStatus('UPLOADING')
    try {
      const contentType = file.type || 'image/png'
      const { presignedUrl, s3Key } = await presignToolSetupUpload(lessonId, contentType)
      await uploadToolSetupScreenshot(presignedUrl, file)
      await submitToolSetupScreenshot(lessonId, s3Key)
      setStatus('VALIDATING')
      startPolling()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setErrorMessage(msg)
      setStatus('IDLE')
    }
  }

  function reset() {
    if (pollCancelRef.current) pollCancelRef.current.cancelled = true
    setStatus('IDLE')
    setFeedback(null)
    setErrorMessage(null)
    setUploadedName(null)
  }

  return { status, feedback, uploadedName, errorMessage, submit, reset }
}

interface ToolSetupLessonProps {
  lesson: LessonDetail
  onApproved?: () => void
}

function ToolSetupLesson({ lesson, onApproved }: ToolSetupLessonProps) {
  const { status, feedback, uploadedName, errorMessage, submit, reset } =
    useToolSetupValidation(lesson.id, onApproved)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void submit(file)
  }

  const showUploadZone = status === 'IDLE' || status === 'REJECTED'

  return (
    <div>
      {/* Instructions card — NB: instructions HTML is an author-trusted field
          surfaced by admin; it flows through the same sanitize wrap used by
          TextLesson via the upstream admin editor. We still render it via
          dangerouslySetInnerHTML here. */}
      {lesson.content && (
        <div className="bg-[var(--color-wise-surface-soft)] rounded-[var(--radius-sm)] p-6 mb-6">
          <p className="text-[14px] font-bold text-[var(--color-wise-text)] mb-3">
            Instructions
          </p>
          <div
            className="text-[14px] text-[var(--color-wise-text-muted)] leading-relaxed"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: lesson.content }}
          />
        </div>
      )}

      {/* Tutorial video if available */}
      {lesson.embedUrl && (
        <div
          className={cn(
            'bg-[var(--color-wise-surface)] rounded-[var(--radius-sm)] p-4 mb-6',
            'shadow-[var(--shadow-ring)]',
          )}
        >
          <p className="text-[12px] font-semibold text-[var(--color-wise-text-muted)] uppercase tracking-[0.8px] mb-2.5">
            Video walkthrough
          </p>
          <div
            className="bg-[var(--color-wise-surface-soft)] rounded-[var(--radius-sm)] h-[160px] flex items-center justify-center relative"
            style={{ aspectRatio: '16/9' }}
          >
            <iframe
              src={lesson.embedUrl}
              title="Tutorial"
              width="100%"
              height="100%"
              frameBorder="0"
              allowFullScreen
              style={{ borderRadius: 16, display: 'block' }}
            />
          </div>
        </div>
      )}

      {/* Network / upload error banner — non-terminal, user can retry. */}
      {errorMessage && (
        <div
          role="alert"
          data-testid="tool-setup-error"
          className={cn(
            'rounded-xl p-[14px_18px] flex items-start gap-3 mb-4',
            'bg-[var(--color-wise-danger-soft)] border border-[var(--color-wise-danger)]/30',
          )}
        >
          <AlertTriangle
            className="h-5 w-5 text-[var(--color-wise-danger)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="text-[14px] font-bold text-[var(--color-wise-danger)] mb-0.5">
              Upload failed
            </p>
            <p className="text-[13px] text-[var(--color-wise-text-muted)]">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Validation status strips — uploading + the four terminal states */}
      {(status === 'UPLOADING' || status === 'VALIDATING') && (
        <div
          data-testid={status === 'UPLOADING' ? 'tool-setup-uploading' : 'tool-setup-validating'}
          className={cn(
            'rounded-xl p-[14px_18px] flex items-start gap-3 mb-4',
            'bg-[var(--color-wise-warning-soft)] border border-[var(--color-wise-warning)]/40',
          )}
        >
          <LoadingSpinner
            size="sm"
            label={status === 'UPLOADING' ? 'Uploading' : 'Validating with AI'}
          />
          <div>
            <p className="text-[14px] font-bold text-[var(--color-wise-text)] mb-0.5">
              {status === 'UPLOADING' ? 'Uploading screenshot…' : 'Validating with AI…'}
            </p>
            <p className="text-[13px] text-[var(--color-wise-text-muted)]">
              {status === 'UPLOADING'
                ? 'Sending your screenshot to our servers.'
                : 'Analyzing your screenshot. This usually takes a few seconds.'}
            </p>
          </div>
        </div>
      )}

      {status === 'APPROVED' && (
        <div
          data-testid="tool-setup-approved"
          className={cn(
            'rounded-xl p-[14px_18px] flex items-start gap-3 mb-4',
            'bg-[var(--color-wise-mint)] border border-[var(--color-wise-primary)]/30',
          )}
        >
          <CircleCheck
            className="h-5 w-5 text-[var(--color-wise-primary-text)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="text-[14px] font-bold text-[var(--color-wise-primary-text)] mb-0.5">
              Validated! You can mark this lesson complete.
            </p>
            <p className="text-[13px] text-[var(--color-wise-text-muted)]">
              {feedback ?? 'Great work — your screenshot was accepted.'}
            </p>
          </div>
        </div>
      )}

      {status === 'REJECTED' && (
        <div data-testid="tool-setup-rejected">
          <EmptyState
            icon={AlertTriangle}
            title="Screenshot not recognized"
            description={
              feedback ??
              'Your screenshot doesn’t clearly show the required output. Please review the instructions and try again.'
            }
            action={{ label: 'Try again', onClick: reset }}
            className="mb-4"
          />
        </div>
      )}

      {status === 'UNDER_REVIEW' && (
        <div data-testid="tool-setup-under-review">
          <EmptyState
            icon={Clock}
            title="Our team is reviewing your submission"
            description="The AI wasn’t confident enough to auto-approve, so a human coach will take a look. We’ll email you within 2 hours."
            className="mb-4"
          />
        </div>
      )}

      {status === 'STALLED' && (
        <div data-testid="tool-setup-stalled">
          <EmptyState
            icon={Clock}
            title="Still working on it"
            description="Validation is taking longer than expected. You can resubmit to try again, or wait for an email update."
            action={{ label: 'Resubmit', onClick: reset }}
            className="mb-4"
          />
        </div>
      )}

      {/* Upload zone — shown only in IDLE or after a rejection */}
      {showUploadZone && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload screenshot"
          data-testid="tool-setup-upload-zone"
          className={cn(
            'border-2 border-dashed border-[var(--color-wise-primary)] rounded-[var(--radius-sm)]',
            'bg-[var(--color-wise-mint)]/40',
            'p-10 text-center cursor-pointer mb-6 transition-colors',
            'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2',
            dragOver && 'bg-[var(--color-wise-mint)]',
          )}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="flex justify-center mb-3" aria-hidden="true">
            <Upload className="h-8 w-8 text-[var(--color-wise-primary-text)]" />
          </div>
          <p className="text-[16px] font-bold text-[var(--color-wise-text)] mb-1.5">
            {uploadedName ?? 'Upload your screenshot'}
          </p>
          <p className="text-[13px] text-[var(--color-wise-text-muted)] mb-2">
            Drag and drop or click to browse
          </p>
          <span className="text-[14px] font-semibold text-[var(--color-wise-primary-text)]">
            Browse files
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="tool-setup-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void submit(file)
            }}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Locked lesson state
// ---------------------------------------------------------------------------

function LockedLesson() {
  return (
    <div className="py-10 px-6">
      <EmptyState
        icon={Lock}
        title="Lesson Locked"
        description="Complete the previous lessons to unlock this one."
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// LessonPage
// ---------------------------------------------------------------------------

// Print / mobile rules extracted to a single <style> block — audit flagged
// the inline <style> previously.
const LESSON_RESPONSIVE_STYLES = `
  @media (max-width: 768px) {
    .lesson-container { padding: 20px 16px 32px !important; }
    .lesson-nav-row { flex-direction: column !important; gap: 12px !important; }
    .lesson-nav-row > * { width: 100% !important; justify-content: center !important; }
  }
`

export default function LessonPage() {
  const { slug = '', lessonId = '' } = useParams<{ slug: string; lessonId: string }>()
  const navigate = useNavigate()
  const { modules, refreshCurriculum } = useCourse()

  const [lessonData, setLessonData] = useState<{
    lesson: LessonDetail
    prevLesson?: { id: string; title: string }
    nextLesson?: { id: string; title: string }
    moduleTitle?: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMarkingComplete, setIsMarkingComplete] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  // Tracks the tool-setup validation status so the parent can gate the
  // "Mark as Complete" button — it only appears once Claude Vision approves
  // (or an admin later escalates the HUMAN_REVIEW submission).
  const [toolSetupApproved, setToolSetupApproved] = useState(false)

  const loadLesson = useCallback(async () => {
    setIsLoading(true)
    setIsLocked(false)
    setError(null)
    try {
      const data = await fetchLesson(slug, lessonId)
      setLessonData(data)
    } catch (err) {
      if (err instanceof Error && err.message === 'LESSON_LOCKED') {
        setIsLocked(true)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load lesson')
      }
    } finally {
      setIsLoading(false)
    }
  }, [slug, lessonId])

  useEffect(() => {
    void loadLesson()
    setJustCompleted(false)
    setToolSetupApproved(false)
  }, [loadLesson])

  async function handleMarkComplete() {
    if (isMarkingComplete || justCompleted) return
    setIsMarkingComplete(true)
    try {
      await markLessonComplete(lessonId)
      setJustCompleted(true)
      await refreshCurriculum()
    } catch {
      // Non-fatal — UI still transitions
    } finally {
      setIsMarkingComplete(false)
    }
  }

  const currentModule = modules.find((m) => m.lessons.some((l) => l.id === lessonId))
  const lessonIndexInModule = currentModule?.lessons.findIndex((l) => l.id === lessonId) ?? -1

  if (isLoading) {
    return (
      <div className="p-10 flex flex-col gap-4">
        <LoadingSkeleton variant="rect" height={12} className="w-1/3 rounded-full" />
        <LoadingSkeleton variant="rect" height={32} className="w-2/3 rounded-full" />
        <LoadingSkeleton
          variant="rect"
          className="rounded-[var(--radius-md)]"
          style={{ aspectRatio: '16/9' }}
        />
      </div>
    )
  }

  if (isLocked) return <LockedLesson />

  if (error) {
    return (
      <div className="p-10">
        <div
          role="alert"
          className={cn(
            'bg-[var(--color-wise-danger-soft)] rounded-[var(--radius-sm)] p-5',
            'text-[var(--color-wise-danger)] text-[14px] font-semibold',
            'flex items-center gap-2',
          )}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  if (!lessonData) return null

  const { lesson, prevLesson, nextLesson } = lessonData
  const isCurrentLessonComplete = modules
    .flatMap((m) => m.lessons)
    .find((l) => l.id === lessonId)?.status === 'COMPLETED'
  const toolSetupGateSatisfied =
    lesson.type !== 'TOOL_SETUP' || toolSetupApproved
  const showCompleteBtn =
    !isCurrentLessonComplete && !justCompleted && toolSetupGateSatisfied

  return (
    <div className="px-4 sm:px-8 md:px-12 py-10 lesson-container">
      <style>{LESSON_RESPONSIVE_STYLES}</style>

      {/* Breadcrumb */}
      <p className="text-[13px] text-[var(--color-wise-text-muted)] mb-3">
        <span>{currentModule?.title ?? 'Module'}</span>
        {' '} › Lesson {lessonIndexInModule >= 0 ? lessonIndexInModule + 1 : ''}
      </p>

      {/* Lesson title */}
      <h1 className="text-[32px] font-black text-[var(--color-wise-text)] tracking-[-0.8px] mb-7">
        {lesson.title}
      </h1>

      {/* Content based on type */}
      {lesson.type === 'VIDEO' && <VideoPlayer lesson={lesson} />}
      {lesson.type === 'TEXT' && lesson.content && <TextLesson content={lesson.content} />}
      {lesson.type === 'TOOL_SETUP' && (
        <ToolSetupLesson
          lesson={lesson}
          onApproved={() => {
            setToolSetupApproved(true)
            // Re-fetch curriculum so any worker-driven status change flips
            // the sidebar icon immediately.
            void refreshCurriculum()
          }}
        />
      )}

      {/* Mark as complete */}
      {showCompleteBtn && (
        <div className="flex justify-end mb-12">
          <Button
            variant="primary"
            size="md"
            isLoading={isMarkingComplete}
            disabled={isMarkingComplete}
            onClick={() => void handleMarkComplete()}
            leftIcon={<CircleCheck className="h-4 w-4" />}
          >
            Mark as Complete
          </Button>
        </div>
      )}

      {(justCompleted || isCurrentLessonComplete) && (
        <div className="flex justify-end mb-12">
          <span
            className={cn(
              'px-7 py-3 rounded-[var(--radius-pill)]',
              'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
              'text-[15px] font-bold flex items-center gap-2',
            )}
          >
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
            Completed
          </span>
        </div>
      )}

      {/* Prev / Next navigation */}
      <div
        className={cn(
          'lesson-nav-row flex items-center justify-between pt-6',
          'border-t border-[var(--color-wise-ring)]',
        )}
      >
        {prevLesson ? (
          <Button
            variant="outline"
            size="md"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(`/student/course/${slug}/lesson/${prevLesson.id}`)}
          >
            Previous: {prevLesson.title}
          </Button>
        ) : (
          <div />
        )}

        {nextLesson && (
          <Button
            variant="primary"
            size="md"
            rightIcon={<ArrowRight className="h-4 w-4" />}
            onClick={() => navigate(`/student/course/${slug}/lesson/${nextLesson.id}`)}
          >
            Next: {nextLesson.title}
          </Button>
        )}
      </div>
    </div>
  )
}
