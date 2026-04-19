// FIR-53 — Lesson player: VIDEO (Loom embed), TEXT (prose markdown), TOOL_SETUP
// FIR-161 — Markdown text lesson rendering via .prose class
// Sprint 2 Story 12 — Real Claude Vision validation for TOOL_SETUP lessons
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
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
import { EmptyState } from '../../components/ui/EmptyState'
import { AlertTriangle, Clock } from 'lucide-react'

// ---------------------------------------------------------------------------
// Video embed — Loom iframe at 16:9
// ---------------------------------------------------------------------------

function VideoPlayer({ lesson }: { lesson: LessonDetail }) {
  // If embedUrl present use it; fall back to showing a placeholder
  if (lesson.embedUrl) {
    return (
      <div
        className="w-full rounded-[20px] overflow-hidden mb-8"
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

  // Placeholder if no embed URL yet
  return (
    <div
      className="w-full rounded-[20px] overflow-hidden mb-8 relative flex items-center justify-center"
      style={{
        aspectRatio: '16 / 9',
        background: 'linear-gradient(135deg,#0d1a3a 0%,#1a2744 60%,#2d4a8a 100%)',
      }}
    >
      <div className="absolute inset-0 opacity-30" />
      <div
        className={cn(
          'w-[72px] h-[72px] rounded-full border-2 border-[rgba(255,255,255,0.4)]',
          'bg-[rgba(255,255,255,0.15)] backdrop-blur-sm',
          'flex items-center justify-center text-white text-[28px]',
          'relative z-10',
        )}
      >
        ▶
      </div>
      <p className="absolute bottom-5 left-5 text-white text-[14px] font-700 z-10">
        Lesson · {lesson.estimatedMinutes} min
      </p>
      <p className="absolute bottom-5 right-5 text-[rgba(255,255,255,0.6)] text-[12px] font-600 z-10 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#4a9ad4] inline-block" />
        Watch on Loom
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Text lesson — prose markdown (FIR-161)
// The .prose class lives in index.css; we render raw HTML from the API.
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
// Previously this flow simulated validation with a hardcoded `setTimeout`.
// We now hit the real backend:
//
//   1. presignToolSetupUpload → get a presigned PUT URL + s3Key
//   2. uploadToolSetupScreenshot → PUT the file to S3 / local uploads
//   3. submitToolSetupScreenshot → enqueue the Claude Vision BullMQ job
//   4. fetchLatestToolSetupSubmission (every 3s) → poll for terminal status
//
// Terminal statuses: APPROVED | REJECTED | UNDER_REVIEW. The worker routes
// low-confidence and Claude-unavailable outcomes to UNDER_REVIEW (HUMAN_REVIEW
// in DB terms). In dev without ANTHROPIC_API_KEY the worker always produces
// UNDER_REVIEW, so the UI still surfaces a useful state.
// ---------------------------------------------------------------------------

// The hook owns the submit → poll → terminal state transitions so the render
// tree stays thin and easy to test.
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

  // Guard against setting state on an unmounted component and against
  // overlapping poll sessions (e.g. student clicks Retry during a poll).
  const pollCancelRef     = useRef<{ cancelled: boolean } | null>(null)
  const onApprovedRef     = useRef(onApproved)
  onApprovedRef.current   = onApproved

  // Hydrate from a prior submission when the page first loads so the
  // student doesn't lose context if they close and re-open the tab mid-poll.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { submission } = await fetchLatestToolSetupSubmission(lessonId)
        if (cancelled || !submission) return
        setStatus(submission.status)
        setFeedback(submission.mlFeedback ?? null)
        if (submission.status === 'VALIDATING') {
          // The worker may still be crunching — re-enter polling.
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
    // Cancel any prior poll session before starting a fresh one.
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
        // Transient network errors shouldn't kill the polling loop — the
        // next tick will retry.
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
      {/* Instructions card */}
      {lesson.content && (
        <div className="bg-[#f8f9fb] rounded-[16px] p-6 mb-6">
          <p className="text-[14px] font-700 text-[#1a2744] mb-3">Instructions</p>
          <div
            className="text-[14px] text-[#717182] leading-relaxed"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: lesson.content }}
          />
        </div>
      )}

      {/* Tutorial video if available */}
      {lesson.embedUrl && (
        <div className="bg-white rounded-[16px] p-4 shadow-[rgba(26,39,68,0.12)_0_0_0_1px] mb-6">
          <p className="text-[12px] font-600 text-[#717182] uppercase tracking-[0.8px] mb-2.5">
            Video walkthrough
          </p>
          <div
            className="bg-[#0d1a3a] rounded-xl h-[160px] flex items-center justify-center relative"
            style={{ aspectRatio: '16/9' }}
          >
            <iframe
              src={lesson.embedUrl}
              title="Tutorial"
              width="100%"
              height="100%"
              frameBorder="0"
              allowFullScreen
              style={{ borderRadius: 12, display: 'block' }}
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
            'bg-[var(--color-wise-danger-soft)] border border-[rgba(208,50,56,0.2)]',
          )}
        >
          <AlertTriangle className="h-5 w-5 text-[var(--color-wise-danger)] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-[14px] font-700 text-[var(--color-wise-danger)] mb-0.5">Upload failed</p>
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
            'bg-[var(--color-wise-warning-soft)] border border-[rgba(255,192,145,0.4)]',
          )}
        >
          <LoadingSpinner size="sm" label={status === 'UPLOADING' ? 'Uploading' : 'Validating with AI'} />
          <div>
            <p className="text-[14px] font-700 text-[#8a5a00] mb-0.5">
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
            'bg-[var(--color-wise-mint)] border border-[rgba(5,77,40,0.2)]',
          )}
        >
          <span className="text-[20px]" aria-hidden="true">✓</span>
          <div>
            <p className="text-[14px] font-700 text-[var(--color-wise-success)] mb-0.5">
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
            'border-2 border-dashed border-[#4a9ad4] rounded-[16px] bg-[#f8fbff]',
            'p-10 text-center cursor-pointer mb-6 transition-colors',
            dragOver && 'bg-[#eef6fd]',
          )}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="text-[32px] mb-3" aria-hidden="true">+</div>
          <p className="text-[16px] font-700 text-[#1a2744] mb-1.5">
            {uploadedName ?? 'Upload your screenshot'}
          </p>
          <p className="text-[13px] text-[#717182] mb-2">Drag and drop or click to browse</p>
          <span className="text-[14px] font-600 text-[#4a9ad4]">Browse files</span>
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
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-[64px] mb-5">🔒</div>
      <h2 className="text-[24px] font-700 text-[#1a2744] mb-2">Lesson Locked</h2>
      <p className="text-[16px] text-[#717182] max-w-sm">
        Complete the previous lessons to unlock this one.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LessonPage
// ---------------------------------------------------------------------------

export default function LessonPage() {
  const { slug = '', lessonId = '' } = useParams<{ slug: string; lessonId: string }>()
  const navigate = useNavigate()
  const { cohortTitle, modules, refreshCurriculum } = useCourse()

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

  // Derive module + lesson index for breadcrumb
  const currentModule = modules.find((m) => m.lessons.some((l) => l.id === lessonId))
  const lessonIndexInModule = currentModule?.lessons.findIndex((l) => l.id === lessonId) ?? -1

  if (isLoading) {
    return (
      <div className="p-10 animate-pulse flex flex-col gap-4">
        <div className="h-3 bg-[#e8ecf4] rounded-full w-1/3" />
        <div className="h-8 bg-[#e8ecf4] rounded-full w-2/3" />
        <div className="rounded-[20px] bg-[#e8ecf4]" style={{ aspectRatio: '16/9' }} />
      </div>
    )
  }

  if (isLocked) return <LockedLesson />

  if (error) {
    return (
      <div className="p-10">
        <div className="bg-[#fdeaeb] rounded-xl p-5 text-[#d03238] text-[14px] font-600">
          ⚠️ {error}
        </div>
      </div>
    )
  }

  if (!lessonData) return null

  const { lesson, prevLesson, nextLesson } = lessonData
  const isCurrentLessonComplete = modules
    .flatMap((m) => m.lessons)
    .find((l) => l.id === lessonId)?.status === 'COMPLETED'
  // For TOOL_SETUP lessons the Mark-Complete CTA is gated on Claude Vision
  // approval. For VIDEO/TEXT it shows unconditionally once the lesson is
  // unlocked.
  const toolSetupGateSatisfied =
    lesson.type !== 'TOOL_SETUP' || toolSetupApproved
  const showCompleteBtn =
    !isCurrentLessonComplete && !justCompleted && toolSetupGateSatisfied

  return (
    <div className="px-12 py-10 lesson-container">
      <style>{`
        @media (max-width: 768px) {
          .lesson-container { padding: 20px 16px 32px !important; }
          .lesson-nav-row { flex-direction: column !important; gap: 12px !important; }
          .lesson-nav-row button { width: 100% !important; justify-content: center !important; }
        }
      `}</style>
      {/* Breadcrumb */}
      <p className="text-[13px] text-[#a3a3a3] mb-3">
        <span className="text-[#717182]">{currentModule?.title ?? 'Module'}</span>
        {' '} › Lesson {lessonIndexInModule >= 0 ? lessonIndexInModule + 1 : ''}
      </p>

      {/* Lesson title */}
      <h1 className="text-[32px] font-800 text-[#1a2744] tracking-[-0.8px] mb-7">
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
            // Re-fetch curriculum so any worker-driven status change (e.g.
            // StudentLesson flip) reflects in the sidebar immediately.
            void refreshCurriculum()
          }}
        />
      )}

      {/* Mark as complete */}
      {showCompleteBtn && (
        <div className="flex justify-end mb-12">
          <button
            type="button"
            disabled={isMarkingComplete}
            onClick={() => void handleMarkComplete()}
            className={cn(
              'px-7 py-3.5 rounded-full bg-[#e6f4ec] text-[#054d28]',
              'text-[15px] font-700 border-none cursor-pointer font-sans',
              'flex items-center gap-2 transition-opacity',
              isMarkingComplete && 'opacity-60 cursor-not-allowed',
            )}
          >
            {isMarkingComplete ? '…' : '✓ Mark as Complete'}
          </button>
        </div>
      )}

      {(justCompleted || isCurrentLessonComplete) && (
        <div className="flex justify-end mb-12">
          <span className="px-7 py-3.5 rounded-full bg-[#e6f4ec] text-[#054d28] text-[15px] font-700 flex items-center gap-2">
            ✓ Completed
          </span>
        </div>
      )}

      {/* Prev / Next navigation */}
      <div className="lesson-nav-row flex items-center justify-between pt-6 border-t border-[rgba(26,39,68,0.1)]">
        {prevLesson ? (
          <button
            type="button"
            onClick={() => navigate(`/student/course/${slug}/lesson/${prevLesson.id}`)}
            className={cn(
              'px-[22px] py-3 rounded-full',
              'bg-transparent border border-[rgba(26,39,68,0.15)]',
              'text-[#717182] text-[14px] font-600 cursor-pointer font-sans',
              'hover:border-[#4a9ad4] hover:text-[#4a9ad4] transition-colors',
            )}
          >
            ← Previous: {prevLesson.title}
          </button>
        ) : (
          <div />
        )}

        {nextLesson && (
          <button
            type="button"
            onClick={() => navigate(`/student/course/${slug}/lesson/${nextLesson.id}`)}
            className={cn(
              'px-7 py-3 rounded-full bg-[#4a9ad4] text-[#0d1a3a]',
              'text-[14px] font-700 border-none cursor-pointer font-sans',
              'hover:opacity-90 transition-opacity flex items-center gap-2',
            )}
          >
            Next: {nextLesson.title} →
          </button>
        )}
      </div>
    </div>
  )
}
