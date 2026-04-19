// Sprint 2 Story 12 — LessonPage TOOL_SETUP screenshot validation tests.
//
// Covers the real backend flow that replaced the hard-coded 2-second stub:
//
//   IDLE → UPLOADING → VALIDATING → (APPROVED | REJECTED | UNDER_REVIEW)
//
// Strategy
// --------
// - We stub `../../lib/api` because the page imports typed helpers; mocking
//   `fetch` directly would leak implementation details of the presign + PUT
//   two-step handshake.
// - We stub `../CoursePage` so we don't have to spin up the full curriculum
//   provider; LessonPage only consumes `useCourse()` for breadcrumbs +
//   `refreshCurriculum`.
// - The network-triggered polling loop uses `setTimeout` under the hood, so
//   we drive it with Vitest fake timers. After each `act(() => runAllTimers)`
//   call we need a micro-flush for the awaited poll promise to resolve, so
//   we also yield to the microtask queue.
//
// Regression surface
// ------------------
//   T1. A submit POST is fired with the upload handshake (presign → PUT →
//       submit) before polling begins.
//   T2. Polling stops on APPROVED, the success card appears, and the Mark
//       Complete button becomes visible. onApproved fires refreshCurriculum.
//   T3. REJECTED surfaces feedback + a Try Again action that resets.
//   T4. UNDER_REVIEW surfaces the neutral "team is reviewing" card (the dev
//       path without ANTHROPIC_API_KEY collapses into this state).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

// ── Module-level mocks ────────────────────────────────────────────────────

vi.mock('../../../lib/api', () => ({
  fetchLesson: vi.fn(),
  markLessonComplete: vi.fn(),
  presignToolSetupUpload: vi.fn(),
  uploadToolSetupScreenshot: vi.fn(),
  submitToolSetupScreenshot: vi.fn(),
  fetchLatestToolSetupSubmission: vi.fn(),
}))

vi.mock('../CoursePage', () => ({
  useCourse: vi.fn(),
}))

import LessonPage from '../LessonPage'
import {
  fetchLesson,
  fetchLatestToolSetupSubmission,
  presignToolSetupUpload,
  submitToolSetupScreenshot,
  uploadToolSetupScreenshot,
  markLessonComplete,
} from '../../../lib/api'
import { useCourse } from '../CoursePage'

// ── Fixtures ──────────────────────────────────────────────────────────────

const LESSON_ID = '507f1f77bcf86cd799439011'
const SLUG      = 'ai-builder-101'

const baseLessonResponse = {
  lesson: {
    id:               LESSON_ID,
    title:            'Install Node.js',
    type:             'TOOL_SETUP' as const,
    estimatedMinutes: 10,
    content:          '<p>Install Node.js LTS.</p>',
  },
  prevLesson: undefined,
  nextLesson: undefined,
  moduleTitle: 'Getting Started',
}

function setCourseContext(overrides: Partial<ReturnType<typeof useCourse>> = {}) {
  (useCourse as ReturnType<typeof vi.fn>).mockReturnValue({
    slug: SLUG,
    cohortTitle: 'AI Builder 101',
    completionPercentage: 0,
    lessonsCompleted: 0,
    totalLessons: 5,
    modules: [
      {
        id: 'm1',
        title: 'Getting Started',
        order: 0,
        lessons: [
          {
            id: LESSON_ID,
            title: 'Install Node.js',
            type: 'TOOL_SETUP',
            estimatedMinutes: 10,
            status: 'IN_PROGRESS',
          },
        ],
      },
    ],
    currentLessonId: LESSON_ID,
    refreshCurriculum: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as ReturnType<typeof useCourse>)
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/student/course/${SLUG}/lesson/${LESSON_ID}`]}>
      <Routes>
        <Route
          path="/student/course/:slug/lesson/:lessonId"
          element={<LessonPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

async function flushMicrotasks() {
  // Yielding to the microtask queue so any `await fetchLatestToolSetupSubmission`
  // promises inside the polling loop resolve before we read the DOM. Four
  // turns: the poll tick resolves a promise, setState schedules, React
  // commits, the next tick fires — each hop needs a yield.
  for (let i = 0; i < 6; i++) {
    await act(async () => { await Promise.resolve() })
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('<LessonPage> TOOL_SETUP — Sprint 2 Story 12', () => {
  beforeEach(() => {
    ;(fetchLesson as ReturnType<typeof vi.fn>).mockReset()
    ;(fetchLatestToolSetupSubmission as ReturnType<typeof vi.fn>).mockReset()
    ;(presignToolSetupUpload as ReturnType<typeof vi.fn>).mockReset()
    ;(uploadToolSetupScreenshot as ReturnType<typeof vi.fn>).mockReset()
    ;(submitToolSetupScreenshot as ReturnType<typeof vi.fn>).mockReset()
    ;(markLessonComplete as ReturnType<typeof vi.fn>).mockReset()
    ;(useCourse as ReturnType<typeof vi.fn>).mockReset()

    setCourseContext()
    ;(fetchLesson as ReturnType<typeof vi.fn>).mockResolvedValue(baseLessonResponse)
    // Default: no prior submission. Individual tests override as needed.
    ;(fetchLatestToolSetupSubmission as ReturnType<typeof vi.fn>).mockResolvedValue({
      submission: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // --------------------------------------------------------------------------

  it('renders the upload zone once the lesson loads', async () => {
    renderPage()
    expect(await screen.findByTestId('tool-setup-upload-zone')).toBeInTheDocument()
    // On load we only read the latest submission — no presign yet.
    expect(presignToolSetupUpload).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------------------------

  it(
    'fires presign → upload → submit on file drop, then transitions through ' +
      'VALIDATING to APPROVED and reveals Mark Complete',
    async () => {
      ;(presignToolSetupUpload as ReturnType<typeof vi.fn>).mockResolvedValue({
        presignedUrl: 'https://s3.test/put',
        s3Key:        `screenshots/u/${LESSON_ID}/1.png`,
        contentType:  'image/png',
      })
      ;(uploadToolSetupScreenshot as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
      ;(submitToolSetupScreenshot as ReturnType<typeof vi.fn>).mockResolvedValue({
        submissionId: 'sub-1',
        status:       'VALIDATING',
      })

      // Two polling ticks: first still VALIDATING, then APPROVED.
      ;(fetchLatestToolSetupSubmission as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ submission: null }) // initial hydration call
        .mockResolvedValueOnce({
          submission: {
            id: 'sub-1', status: 'VALIDATING', rawStatus: 'ML_PROCESSING',
            mlFeedback: null, mlScore: null, screenshotUrl: null,
            createdAt: new Date().toISOString(), reviewedAt: null,
          },
        })
        .mockResolvedValueOnce({
          submission: {
            id: 'sub-1', status: 'APPROVED', rawStatus: 'APPROVED',
            mlFeedback: 'Looks great', mlScore: 92, screenshotUrl: null,
            createdAt: new Date().toISOString(), reviewedAt: new Date().toISOString(),
          },
        })

      renderPage()

      // Initial hydration resolves.
      await screen.findByTestId('tool-setup-upload-zone')

      // Switch to fake timers so we can control the 3-second poll cadence.
      // `advanceTimersByTimeAsync` flushes microtasks each tick so awaited
      // network promises resolve inside the polling loop without us needing
      // to manually yield.
      vi.useFakeTimers({ shouldAdvanceTime: false })

      const fileInput = screen.getByTestId('tool-setup-file-input') as HTMLInputElement
      const file = new File([new Uint8Array(16)], 'screenshot.png', { type: 'image/png' })
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      // The presign → PUT → submit chain is entirely promise-driven. Flush
      // microtasks a few turns so each awaited step completes.
      await flushMicrotasks()

      expect(presignToolSetupUpload).toHaveBeenCalledWith(LESSON_ID, 'image/png')
      expect(uploadToolSetupScreenshot).toHaveBeenCalledWith('https://s3.test/put', file)
      expect(submitToolSetupScreenshot).toHaveBeenCalledWith(
        LESSON_ID,
        `screenshots/u/${LESSON_ID}/1.png`,
      )

      // Validating spinner appears immediately after submit resolves.
      expect(screen.getByTestId('tool-setup-validating')).toBeInTheDocument()

      // First poll tick — still VALIDATING, UI unchanged.
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
      await flushMicrotasks()
      expect(screen.getByTestId('tool-setup-validating')).toBeInTheDocument()

      // Second poll tick — APPROVED. Terminal state, polling should stop.
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
      await flushMicrotasks()

      expect(screen.getByTestId('tool-setup-approved')).toBeInTheDocument()
      expect(screen.queryByTestId('tool-setup-validating')).toBeNull()

      // Mark Complete CTA is now visible.
      expect(
        screen.getByRole('button', { name: /mark as complete/i }),
      ).toBeInTheDocument()

      // Advancing more time must NOT trigger another poll now that we're
      // in a terminal state.
      const pollCountAfterApproved = (
        fetchLatestToolSetupSubmission as ReturnType<typeof vi.fn>
      ).mock.calls.length
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
      await flushMicrotasks()
      expect(
        (fetchLatestToolSetupSubmission as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBe(pollCountAfterApproved)
    },
  )

  // --------------------------------------------------------------------------

  it('surfaces feedback + Try Again on REJECTED', async () => {
    ;(presignToolSetupUpload as ReturnType<typeof vi.fn>).mockResolvedValue({
      presignedUrl: 'https://s3.test/put',
      s3Key:        `screenshots/u/${LESSON_ID}/1.png`,
      contentType:  'image/png',
    })
    ;(uploadToolSetupScreenshot as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(submitToolSetupScreenshot as ReturnType<typeof vi.fn>).mockResolvedValue({
      submissionId: 'sub-2', status: 'VALIDATING',
    })
    ;(fetchLatestToolSetupSubmission as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ submission: null })
      .mockResolvedValueOnce({
        submission: {
          id: 'sub-2', status: 'REJECTED', rawStatus: 'REJECTED',
          mlFeedback: 'Your terminal output is missing the version number.',
          mlScore: 88, screenshotUrl: null,
          createdAt: new Date().toISOString(), reviewedAt: new Date().toISOString(),
        },
      })

    renderPage()
    await screen.findByTestId('tool-setup-upload-zone')

    vi.useFakeTimers({ shouldAdvanceTime: false })

    const input = screen.getByTestId('tool-setup-file-input') as HTMLInputElement
    const file = new File([new Uint8Array(8)], 'bad.png', { type: 'image/png' })
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }) })
    await flushMicrotasks()
    expect(submitToolSetupScreenshot).toHaveBeenCalled()

    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    await flushMicrotasks()

    const rejected = screen.getByTestId('tool-setup-rejected')
    expect(rejected).toHaveTextContent(/Screenshot not recognized/i)
    expect(rejected).toHaveTextContent(/missing the version number/i)

    // Try Again resets to IDLE, upload zone reappears.
    const retry = screen.getByRole('button', { name: /try again/i })
    await act(async () => { fireEvent.click(retry) })
    expect(screen.getByTestId('tool-setup-upload-zone')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------

  it(
    'lands in UNDER_REVIEW when the worker routes to HUMAN_REVIEW ' +
      '(this is the dev-without-ANTHROPIC_API_KEY path)',
    async () => {
      ;(presignToolSetupUpload as ReturnType<typeof vi.fn>).mockResolvedValue({
        presignedUrl: 'https://s3.test/put',
        s3Key:        `screenshots/u/${LESSON_ID}/1.png`,
        contentType:  'image/png',
      })
      ;(uploadToolSetupScreenshot as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
      ;(submitToolSetupScreenshot as ReturnType<typeof vi.fn>).mockResolvedValue({
        submissionId: 'sub-3', status: 'VALIDATING',
      })
      ;(fetchLatestToolSetupSubmission as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ submission: null })
        .mockResolvedValueOnce({
          submission: {
            id: 'sub-3', status: 'UNDER_REVIEW', rawStatus: 'HUMAN_REVIEW',
            mlFeedback: 'Automated validation unavailable — pending human review.',
            mlScore: null, screenshotUrl: null,
            createdAt: new Date().toISOString(), reviewedAt: new Date().toISOString(),
          },
        })

      renderPage()
      await screen.findByTestId('tool-setup-upload-zone')

      vi.useFakeTimers({ shouldAdvanceTime: false })

      const input = screen.getByTestId('tool-setup-file-input') as HTMLInputElement
      const file = new File([new Uint8Array(8)], 'ok.png', { type: 'image/png' })
      await act(async () => { fireEvent.change(input, { target: { files: [file] } }) })
      await flushMicrotasks()
      expect(submitToolSetupScreenshot).toHaveBeenCalled()

      await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
      await flushMicrotasks()

      expect(screen.getByTestId('tool-setup-under-review')).toBeInTheDocument()
      // The Mark Complete button must NOT appear — the lesson is not done yet.
      expect(
        screen.queryByRole('button', { name: /mark as complete/i }),
      ).toBeNull()
    },
  )

  // --------------------------------------------------------------------------

  it('rehydrates from an existing APPROVED submission without requiring a new upload', async () => {
    ;(fetchLatestToolSetupSubmission as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      submission: {
        id: 'existing', status: 'APPROVED', rawStatus: 'APPROVED',
        mlFeedback: 'Already approved previously.',
        mlScore: 95, screenshotUrl: null,
        createdAt: new Date().toISOString(), reviewedAt: new Date().toISOString(),
      },
    })

    renderPage()

    expect(await screen.findByTestId('tool-setup-approved')).toBeInTheDocument()
    // Upload zone is hidden — the student already has a terminal submission.
    expect(screen.queryByTestId('tool-setup-upload-zone')).toBeNull()
    expect(presignToolSetupUpload).not.toHaveBeenCalled()
  })
})
