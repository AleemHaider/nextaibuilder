// Sprint 2 Story 11 — unit tests for <CourseBuilderPage>.
//
// These tests exercise the API-backed handleSave / pricing / live-session /
// publish flows added by Story 11. We stub `../../../lib/api` (not fetch)
// because the page imports typed helpers, mirror the ManualPaymentPage test
// strategy already used in the codebase. The AuthContext is mocked to force
// an ADMIN role so drag-handles and action buttons render.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Module-level mocks ──────────────────────────────────────────────────
//
// Stub every api helper the page imports. Each test resets these and wires
// the specific return values it needs. The two "list" helpers default to
// returning empty arrays so the tab bodies don't race while other flows run.
vi.mock('../../../lib/api', () => ({
  fetchAdminCourses: vi.fn(),
  // NAB-P0-2 — the builder now hydrates description + marketing bullets from
  // the admin detail endpoint when a course is selected. Default the mock to
  // a resolved empty-detail response so existing tests that don't care about
  // the Overview tab continue to pass.
  fetchAdminCourseDetail: vi.fn().mockResolvedValue({
    id: 'course-1',
    title: 'AI Builder 101',
    slug: 'ai-builder-101',
    type: 'RECORDED',
    tagline: null,
    description: null,
    coverImageKey: null,
    maxSeats: null,
    isPublished: false,
    status: 'DRAFT',
    liveStartDate: null,
    liveEndDate: null,
    learningOutcomes: [],
    requirements: [],
    targetAudience: [],
  }),
  fetchAdminCourseModules: vi.fn(),
  fetchAdminModuleLessons: vi.fn(),
  reorderModules: vi.fn(),
  reorderLessons: vi.fn(),
  createAdminCourse: vi.fn(),
  updateAdminCourse: vi.fn(),
  publishAdminCourse: vi.fn(),
  uploadAdminCourseCover: vi.fn(),
  cohortCoverImageUrl: (key: string | null) => (key ? `/api/uploads/${key}` : null),
  fetchAdminPaymentPlans: vi.fn(),
  createAdminPaymentPlan: vi.fn(),
  updateAdminPaymentPlan: vi.fn(),
  toggleAdminPaymentPlan: vi.fn(),
  fetchAdminLiveSessions: vi.fn(),
  createAdminLiveSession: vi.fn(),
  updateAdminLiveSession: vi.fn(),
  deleteAdminLiveSession: vi.fn(),
  // Sprint 2 Story 12 — module + lesson CRUD helpers.
  createAdminModule: vi.fn(),
  updateAdminModule: vi.fn(),
  deleteAdminModule: vi.fn(),
  createAdminLesson: vi.fn(),
  updateAdminLesson: vi.fn(),
  toggleAdminLessonPublish: vi.fn(),
  deleteAdminLesson: vi.fn(),
}))

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// AdminShell pulls in NavLink + a lot of context. The behaviour we care
// about lives entirely inside the CourseBuilderPage body, so we stub the
// shell to just render its children — keeps the render tree small and
// deterministic.
vi.mock('../../../components/admin/AdminShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-shell">{children}</div>
  ),
}))

// SortableList from @dnd-kit needs layout APIs jsdom doesn't provide for a
// full drag, and it's not under test here. Replace it with a plain list
// renderer so the Curriculum tab still mounts.
vi.mock('../../../components/common/SortableList', () => ({
  SortableList: <T extends { id: string }>({
    items,
    renderItem,
  }: {
    items: T[]
    renderItem: (item: T, dragProps: object, dragging: boolean) => React.ReactNode
  }) => (
    <ul data-testid="sortable-list">
      {items.map((it) => (
        <li key={it.id}>{renderItem(it, {}, false)}</li>
      ))}
    </ul>
  ),
}))

import CourseBuilderPage from '../CourseBuilderPage'
import {
  fetchAdminCourses,
  fetchAdminCourseModules,
  fetchAdminModuleLessons,
  createAdminCourse,
  updateAdminCourse,
  publishAdminCourse,
  fetchAdminPaymentPlans,
  createAdminPaymentPlan,
  toggleAdminPaymentPlan,
  fetchAdminLiveSessions,
  createAdminLiveSession,
  deleteAdminLiveSession,
  createAdminModule,
  createAdminLesson,
} from '../../../lib/api'
import { useAuth } from '../../../context/AuthContext'

// ── Test helpers ────────────────────────────────────────────────────────

// One QueryClient per test. retry: false keeps failed mutation errors from
// stalling assertions, and a 0-stale-time matches vitest's expectation that
// invalidated queries refetch synchronously when possible.
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function renderPage() {
  const client = makeClient()
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CourseBuilderPage />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

function asMock<T extends (...args: never[]) => unknown>(fn: T) {
  return fn as unknown as ReturnType<typeof vi.fn>
}

function setAdminAuth() {
  asMock(useAuth).mockReturnValue({
    user: {
      id: 'admin-1',
      email: 'admin@devspots.us',
      name: 'Admin',
      role: 'ADMIN',
    },
    accessToken: 'tok',
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
  })
}

// Fixture: one saved course the sidebar can render, used by the update-flow
// and publish-toggle tests to enter "server-backed" mode.
const existingCourse = {
  id: 'cohort-1',
  title: 'AI Builder 101',
  slug: 'ai-builder-101',
  tagline: 'Ship AI features',
  description: '',
  type: 'recorded' as const,
  status: 'DRAFT' as const,
  enrollmentCount: 0,
  lessonCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
}

// ─────────────────────────────────────────────────────────────────────────

describe('<CourseBuilderPage> — Sprint 2 Story 11', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAdminAuth()
    asMock(fetchAdminCourses).mockResolvedValue({
      courses: [existingCourse],
      total: 1,
      page: 1,
      limit: 20,
    })
    asMock(fetchAdminPaymentPlans).mockResolvedValue([])
    asMock(fetchAdminLiveSessions).mockResolvedValue([])
    asMock(fetchAdminCourseModules).mockResolvedValue([])
    asMock(fetchAdminModuleLessons).mockResolvedValue([])
  })

  // ── handleSave ─────────────────────────────────────────────────────────

  it('create flow: Save on a new draft POSTs to createAdminCourse and flips draft.id', async () => {
    asMock(createAdminCourse).mockResolvedValue({
      id: 'new-cohort',
      title: 'Untitled Course',
      slug: 'untitled-course',
      type: 'RECORDED',
      tagline: null,
      isPublished: false,
    })
    const user = userEvent.setup()
    renderPage()

    // Enter draft mode via the "New Course" button in the sidebar.
    await user.click(await screen.findByRole('button', { name: /new course/i }))

    // Find the Save button inside the editor topbar (there are two "Save"-like
    // buttons only after the modal opens, so this is unambiguous at this stage).
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(createAdminCourse).toHaveBeenCalledTimes(1)
    })
    // Body shape sanity: the helper should be called with the draft's type
    // mapped to the back-end's upper-cased enum.
    const [payload] = asMock(createAdminCourse).mock.calls[0]
    expect(payload).toMatchObject({ title: 'Untitled Course', type: 'RECORDED' })

    // Success toast confirms the happy path and the draft.id flip.
    expect(await screen.findByText(/course created/i)).toBeInTheDocument()
  })

  it('update flow: Save on an existing course fires updateAdminCourse (not create)', async () => {
    asMock(updateAdminCourse).mockResolvedValue({
      id: existingCourse.id,
      title: existingCourse.title,
      slug: existingCourse.slug,
      type: 'RECORDED',
      tagline: existingCourse.tagline,
      isPublished: false,
    })
    const user = userEvent.setup()
    renderPage()

    // Select the existing course from the sidebar.
    const row = await screen.findByRole('listitem', { name: /ai builder 101/i }).catch(() => null)
    // Fallback: the listitem role is on the button; grab by title text.
    const listItem =
      row ??
      (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem as HTMLElement)

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(updateAdminCourse).toHaveBeenCalledTimes(1)
    })
    expect(updateAdminCourse).toHaveBeenCalledWith(
      existingCourse.id,
      expect.objectContaining({ title: existingCourse.title }),
    )
    expect(createAdminCourse).not.toHaveBeenCalled()
  })

  it('surfaces a toast when createAdminCourse rejects', async () => {
    asMock(createAdminCourse).mockRejectedValue(new Error('Slug exists'))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /new course/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/slug exists/i)).toBeInTheDocument()
  })

  // ── Pricing tab ────────────────────────────────────────────────────────

  it('Pricing tab renders fetched payment plans from usePaymentPlans', async () => {
    asMock(fetchAdminPaymentPlans).mockResolvedValue([
      {
        id: 'plan-1',
        name: 'Founding Cohort',
        type: 'ONE_TIME',
        totalAmount: 49900,
        currency: 'usd',
        isActive: true,
      },
      {
        id: 'plan-2',
        name: '3-pay',
        type: 'INSTALLMENT',
        totalAmount: 59700,
        currency: 'usd',
        intervalDays: 30,
        isActive: true,
        installments: [
          { number: 1, amount: 19900, dueDate: '2026-01-01', status: 'PENDING' },
          { number: 2, amount: 19900, dueDate: '2026-02-01', status: 'PENDING' },
          { number: 3, amount: 19900, dueDate: '2026-03-01', status: 'PENDING' },
        ],
      },
    ])
    const user = userEvent.setup()
    renderPage()

    // Enter the existing server-backed course.
    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)

    // Switch to the Pricing tab.
    await user.click(screen.getByRole('tab', { name: 'Pricing' }))

    expect(await screen.findByText('Founding Cohort')).toBeInTheDocument()
    expect(screen.getByText('3-pay')).toBeInTheDocument()
    expect(screen.getByText(/One-time/)).toBeInTheDocument()
  })

  it('Add Plan flow: opens modal, submits, and invalidates the plans query', async () => {
    asMock(fetchAdminPaymentPlans).mockResolvedValue([])
    asMock(createAdminPaymentPlan).mockResolvedValue({
      id: 'plan-new',
      name: 'Starter',
      type: 'ONE_TIME',
      totalAmount: 49900,
      currency: 'usd',
      isActive: true,
    })
    const user = userEvent.setup()
    renderPage()

    // Select existing course + open Pricing tab.
    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)
    await user.click(screen.getByRole('tab', { name: 'Pricing' }))

    // Both the header and the EmptyState render an "Add Plan" button until
    // the modal is open. Either one opens the modal; click the first.
    const addButtons = await screen.findAllByRole('button', { name: /add plan/i })
    await user.click(addButtons[0])

    const nameInput = await screen.findByLabelText(/plan name/i)
    const amountInput = screen.getByLabelText(/total amount/i)

    await user.type(nameInput, 'Starter')
    await user.type(amountInput, '49900')

    // The submit button lives in the modal footer and has a unique label.
    await user.click(screen.getByRole('button', { name: /create plan/i }))

    await waitFor(() => {
      expect(createAdminPaymentPlan).toHaveBeenCalledTimes(1)
    })
    const [cohortIdArg, payloadArg] = asMock(createAdminPaymentPlan).mock.calls[0]
    expect(cohortIdArg).toBe(existingCourse.id)
    expect(payloadArg).toMatchObject({
      name: 'Starter',
      type: 'ONE_TIME',
      totalAmount: 49900,
    })
  })

  it('Deactivate Plan via ConfirmDialog calls toggleAdminPaymentPlan', async () => {
    asMock(fetchAdminPaymentPlans).mockResolvedValue([
      {
        id: 'plan-1',
        name: 'Founding Cohort',
        type: 'ONE_TIME',
        totalAmount: 49900,
        currency: 'usd',
        isActive: true,
      },
    ])
    asMock(toggleAdminPaymentPlan).mockResolvedValue({ isActive: false })
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)
    await user.click(screen.getByRole('tab', { name: 'Pricing' }))

    // Wait for the table to render the plan row.
    await screen.findByText('Founding Cohort')

    // Click Deactivate on the row (only one row exists).
    await user.click(screen.getByRole('button', { name: /deactivate/i }))

    // Confirm in the dialog. The dialog's Confirm button has data-testid.
    const confirm = await screen.findByTestId('confirm-dialog-confirm')
    await user.click(confirm)

    await waitFor(() => {
      expect(toggleAdminPaymentPlan).toHaveBeenCalledWith(
        existingCourse.id,
        'plan-1',
      )
    })
  })

  // ── Live Sessions tab ─────────────────────────────────────────────────

  it('Live Sessions tab renders API-fetched sessions (no DEMO_SESSIONS)', async () => {
    asMock(fetchAdminLiveSessions).mockResolvedValue([
      {
        id: 'sess-1',
        title: 'Week 1: Kickoff',
        scheduledAt: '2026-06-01T18:00:00.000Z',
        durationMinutes: 90,
        zoomUrl: 'https://zoom.us/j/real',
      },
    ])
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)
    await user.click(screen.getByRole('tab', { name: 'Live Sessions' }))

    // The real session is rendered; the hardcoded demo titles are gone.
    expect(await screen.findByText('Week 1: Kickoff')).toBeInTheDocument()
    expect(screen.queryByText(/Week 1: AI Fundamentals/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Building with Claude API/i)).not.toBeInTheDocument()
  })

  it('Schedule Session flow submits createAdminLiveSession with the form values', async () => {
    asMock(fetchAdminLiveSessions).mockResolvedValue([])
    asMock(createAdminLiveSession).mockResolvedValue({
      id: 'sess-new',
      title: 'Week 1: Kickoff',
      scheduledAt: '2026-06-01T18:00:00.000Z',
      durationMinutes: 90,
      zoomUrl: 'https://zoom.us/j/99',
    })
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)
    await user.click(screen.getByRole('tab', { name: 'Live Sessions' }))

    // Header + EmptyState both render "Schedule Session" CTAs until the
    // modal opens. Click the first one to open the schedule modal.
    const scheduleButtons = await screen.findAllByRole('button', {
      name: /schedule session/i,
    })
    await user.click(scheduleButtons[0])

    // Fill form fields.
    const titleInput = await screen.findByLabelText(/^title/i)
    await user.type(titleInput, 'Week 1: Kickoff')

    const scheduledInput = screen.getByLabelText(/scheduled at/i) as HTMLInputElement
    // jsdom's datetime-local input accepts an ISO-ish local string.
    fireEvent.change(scheduledInput, { target: { value: '2026-06-01T18:00' } })

    const zoomInput = screen.getByLabelText(/zoom url/i)
    await user.type(zoomInput, 'https://zoom.us/j/99')

    // Footer submit button is labelled "Schedule Session" (same label used
    // for the modal submit on the create flow).
    const buttons = screen.getAllByRole('button', { name: /schedule session/i })
    // The last matching button is the modal footer submit.
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(createAdminLiveSession).toHaveBeenCalledTimes(1)
    })
    const [cohortIdArg, payloadArg] = asMock(createAdminLiveSession).mock.calls[0]
    expect(cohortIdArg).toBe(existingCourse.id)
    expect(payloadArg).toMatchObject({
      title: 'Week 1: Kickoff',
      zoomUrl: 'https://zoom.us/j/99',
      durationMinutes: 90,
    })
    expect(typeof payloadArg.scheduledAt).toBe('string')
  })

  it('Cancel session flow calls deleteAdminLiveSession via ConfirmDialog', async () => {
    asMock(fetchAdminLiveSessions).mockResolvedValue([
      {
        id: 'sess-1',
        title: 'Week 1: Kickoff',
        scheduledAt: '2026-06-01T18:00:00.000Z',
        durationMinutes: 90,
        zoomUrl: 'https://zoom.us/j/real',
      },
    ])
    asMock(deleteAdminLiveSession).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)
    await user.click(screen.getByRole('tab', { name: 'Live Sessions' }))

    await screen.findByText('Week 1: Kickoff')

    // Row Cancel button.
    const rowCancel = screen
      .getAllByRole('button', { name: /^cancel$/i })
      // The row-level Cancel button sits inside a table cell. That's enough
      // to distinguish it from any modal Cancel buttons (none are open yet).
      .find((b) => b.closest('td'))
    expect(rowCancel).toBeTruthy()
    await user.click(rowCancel!)

    const confirm = await screen.findByTestId('confirm-dialog-confirm')
    await user.click(confirm)

    await waitFor(() => {
      expect(deleteAdminLiveSession).toHaveBeenCalledWith(
        existingCourse.id,
        'sess-1',
      )
    })
  })

  // ── Publish toggle ─────────────────────────────────────────────────────

  it('Publish toggle: optimistic update + rollback on error', async () => {
    asMock(publishAdminCourse).mockRejectedValue(new Error('Missing active plan'))
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)

    // Course starts in DRAFT, so the button reads "Publish".
    const publishBtn = screen.getByRole('button', { name: /^publish$/i })
    await user.click(publishBtn)

    // Publish fired.
    await waitFor(() => {
      expect(publishAdminCourse).toHaveBeenCalledWith(existingCourse.id, true)
    })

    // Error toast surfaces the server message and the button rolls back
    // to "Publish" (the status never became PUBLISHED past the optimistic
    // flip, because the catch branch reverts state).
    expect(await screen.findByText(/missing active plan/i)).toBeInTheDocument()
    await waitFor(() => {
      // After rollback the Publish button is visible again rather than
      // "Unpublish" — a signal the optimistic state was reverted.
      expect(
        screen.getByRole('button', { name: /^publish$/i }),
      ).toBeInTheDocument()
    })
  })

  it('Publish toggle succeeds and shows the confirmation toast', async () => {
    asMock(publishAdminCourse).mockResolvedValue({ isPublished: true })
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)

    await user.click(screen.getByRole('button', { name: /^publish$/i }))

    expect(await screen.findByText(/course published/i)).toBeInTheDocument()
  })

  // ── Sprint 2 Story 12 — Curriculum tab: Add Module + Add Lesson ────────

  it('Add Module flow: opens modal, submits, and calls createAdminModule', async () => {
    asMock(fetchAdminCourseModules).mockResolvedValue([])
    asMock(createAdminModule).mockResolvedValue({
      id: 'mod-new',
      title: 'Week 1: Foundations',
      order: 0,
      lessonCount: 0,
    })
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)
    await user.click(screen.getByRole('tab', { name: 'Curriculum' }))

    // Open the Add Module modal via the dashed row button.
    await user.click(await screen.findByRole('button', { name: /\+ add module/i }))

    // The modal renders a <FormField id="module-title" label="Title" />, so
    // the associated <input> has id="module-title". We query by that explicit
    // id to avoid a clash with the "Course title" input in the editor topbar.
    await waitFor(() =>
      expect(document.getElementById('module-title')).toBeTruthy(),
    )
    const titleInput = document.getElementById('module-title') as HTMLInputElement
    await user.type(titleInput, 'Week 1: Foundations')

    await user.click(screen.getByRole('button', { name: /create module/i }))

    await waitFor(() => {
      expect(createAdminModule).toHaveBeenCalledTimes(1)
    })
    const [cohortIdArg, payloadArg] = asMock(createAdminModule).mock.calls[0]
    expect(cohortIdArg).toBe(existingCourse.id)
    expect(payloadArg).toMatchObject({
      title: 'Week 1: Foundations',
      order: 0,
    })

    // Success toast confirms the invalidate-and-close path fired.
    expect(await screen.findByText(/module created/i)).toBeInTheDocument()
  })

  it('Add Module error: backend 400 keeps modal open with inline error', async () => {
    asMock(fetchAdminCourseModules).mockResolvedValue([])
    asMock(createAdminModule).mockRejectedValue(new Error('Title already exists'))
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)
    await user.click(screen.getByRole('tab', { name: 'Curriculum' }))

    await user.click(await screen.findByRole('button', { name: /\+ add module/i }))

    await waitFor(() =>
      expect(document.getElementById('module-title')).toBeTruthy(),
    )
    const titleInput = document.getElementById('module-title') as HTMLInputElement
    await user.type(titleInput, 'Dupe module')
    await user.click(screen.getByRole('button', { name: /create module/i }))

    // Backend message surfaces as an inline alert under the form; modal is
    // still visible (submit button is still in the DOM).
    expect(await screen.findByText(/title already exists/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create module/i }),
    ).toBeInTheDocument()
  })

  it('Add Lesson (VIDEO) flow: submits createAdminLesson with videoUrl + videoProvider (Loom)', async () => {
    asMock(fetchAdminCourseModules).mockResolvedValue([
      { id: 'mod-1', title: 'Module 1', order: 0, lessonCount: 0 },
    ])
    asMock(fetchAdminModuleLessons).mockResolvedValue([])
    asMock(createAdminLesson).mockResolvedValue({
      id: 'lesson-new',
      title: 'Intro',
      order: 0,
      type: 'VIDEO',
      estimatedMinutes: 0,
      published: false,
    })
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)
    await user.click(screen.getByRole('tab', { name: 'Curriculum' }))

    // Expand the module to reveal its lesson list + Add Lesson button.
    await user.click(await screen.findByRole('button', { name: /expand module 1/i }))
    await user.click(await screen.findByRole('button', { name: /add lesson/i }))

    await waitFor(() =>
      expect(document.getElementById('lesson-title')).toBeTruthy(),
    )
    const titleInput = document.getElementById('lesson-title') as HTMLInputElement
    await user.type(titleInput, 'Intro')
    // Default type is VIDEO, so the generic Video URL field is rendered.
    const videoInput = document.getElementById('lesson-video-url') as HTMLInputElement
    await user.type(videoInput, 'https://www.loom.com/share/abc123')

    // NAB-P0-5 — Provider detection hint renders live.
    expect(await screen.findByText(/loom detected/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /create lesson/i }))

    await waitFor(() => {
      expect(createAdminLesson).toHaveBeenCalledTimes(1)
    })
    const [cohortIdArg, moduleIdArg, payloadArg] =
      asMock(createAdminLesson).mock.calls[0]
    expect(cohortIdArg).toBe(existingCourse.id)
    expect(moduleIdArg).toBe('mod-1')
    expect(payloadArg).toMatchObject({
      title: 'Intro',
      type: 'VIDEO',
      videoUrl: 'https://www.loom.com/share/abc123',
      videoProvider: 'LOOM',
    })
  })

  it('Add Lesson (VIDEO) flow: YouTube URL shows "YouTube detected" and submits videoProvider=YOUTUBE', async () => {
    asMock(fetchAdminCourseModules).mockResolvedValue([
      { id: 'mod-1', title: 'Module 1', order: 0, lessonCount: 0 },
    ])
    asMock(fetchAdminModuleLessons).mockResolvedValue([])
    asMock(createAdminLesson).mockResolvedValue({
      id: 'lesson-yt',
      title: 'YT intro',
      order: 0,
      type: 'VIDEO',
      estimatedMinutes: 0,
      published: false,
    })
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)
    await user.click(screen.getByRole('tab', { name: 'Curriculum' }))

    await user.click(await screen.findByRole('button', { name: /expand module 1/i }))
    await user.click(await screen.findByRole('button', { name: /add lesson/i }))

    await waitFor(() =>
      expect(document.getElementById('lesson-title')).toBeTruthy(),
    )
    const titleInput = document.getElementById('lesson-title') as HTMLInputElement
    await user.type(titleInput, 'YT intro')

    const videoInput = document.getElementById('lesson-video-url') as HTMLInputElement
    await user.type(videoInput, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    // NAB-P0-5 — Detection indicator flips to "YouTube detected".
    expect(await screen.findByText(/youtube detected/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /create lesson/i }))

    await waitFor(() => {
      expect(createAdminLesson).toHaveBeenCalledTimes(1)
    })
    const [, , payloadArg] = asMock(createAdminLesson).mock.calls[0]
    expect(payloadArg).toMatchObject({
      title: 'YT intro',
      type: 'VIDEO',
      videoProvider: 'YOUTUBE',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    })
  })

  it('Add Lesson (VIDEO): unsupported URL surfaces a red hint and blocks save', async () => {
    asMock(fetchAdminCourseModules).mockResolvedValue([
      { id: 'mod-1', title: 'Module 1', order: 0, lessonCount: 0 },
    ])
    asMock(fetchAdminModuleLessons).mockResolvedValue([])
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)
    await user.click(screen.getByRole('tab', { name: 'Curriculum' }))

    await user.click(await screen.findByRole('button', { name: /expand module 1/i }))
    await user.click(await screen.findByRole('button', { name: /add lesson/i }))

    await waitFor(() =>
      expect(document.getElementById('lesson-title')).toBeTruthy(),
    )
    const titleInput = document.getElementById('lesson-title') as HTMLInputElement
    await user.type(titleInput, 'Wistia?')
    const videoInput = document.getElementById('lesson-video-url') as HTMLInputElement
    await user.type(videoInput, 'https://wistia.com/medias/abc')

    // Unsupported hint renders under the field.
    expect(await screen.findByText(/unsupported url/i)).toBeInTheDocument()

    // Clicking Create does not fire the API call — client-side validation
    // blocks submission.
    await user.click(screen.getByRole('button', { name: /create lesson/i }))
    expect(createAdminLesson).not.toHaveBeenCalled()
  })

  it('Add Lesson (TEXT) flow: switching type swaps Video URL for Content field', async () => {
    asMock(fetchAdminCourseModules).mockResolvedValue([
      { id: 'mod-1', title: 'Module 1', order: 0, lessonCount: 0 },
    ])
    asMock(fetchAdminModuleLessons).mockResolvedValue([])
    const user = userEvent.setup()
    renderPage()

    const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
    await user.click(listItem)
    await user.click(screen.getByRole('tab', { name: 'Curriculum' }))

    await user.click(await screen.findByRole('button', { name: /expand module 1/i }))
    await user.click(await screen.findByRole('button', { name: /add lesson/i }))

    // Default is VIDEO → generic Video URL is shown.
    expect(await screen.findByLabelText(/video url/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^content$/i)).not.toBeInTheDocument()

    // Switching to TEXT replaces the Video URL field with the Content textarea.
    const typeSelect = screen.getByLabelText(/^type/i)
    await user.selectOptions(typeSelect, 'TEXT')

    expect(screen.queryByLabelText(/video url/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^content$/i)).toBeInTheDocument()
  })

  // ── NAB-P0-1 — Autosave + "last saved" indicator ─────────────────────
  //
  // These tests run under vi.useFakeTimers() because the autosave hook
  // debounces by 800ms. We advance timers manually and flush promises so
  // the component settles into the next render without a real wall clock.

  it('autosave: typing in the title field fires updateAdminCourse after the debounce window', async () => {
    asMock(updateAdminCourse).mockResolvedValue({
      id: existingCourse.id,
      title: 'AI Builder 101 edited',
      slug: existingCourse.slug,
      type: 'RECORDED',
      tagline: null,
      isPublished: false,
    })

    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPage()

      // Select the existing server-backed course so autosave can PATCH.
      const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
      await user.click(listItem)

      // The editor topbar has an input with aria-label="Course title" — edit it.
      // Two elements share "Course title" (topbar aria-label + OverviewTab
      // <label>). The topbar input is the first rendered and is the one the
      // editor uses as the primary title editor — pick it explicitly.
      const titleInputs = await screen.findAllByLabelText(/^course title$/i)
      const titleInput = titleInputs[0] as HTMLInputElement
      await user.clear(titleInput)
      await user.type(titleInput, 'AI Builder 101 edited')

      // Before the debounce elapses no PATCH has fired.
      expect(updateAdminCourse).not.toHaveBeenCalled()

      // Advance past the 800ms debounce window. We use act-wrapped timer
      // advancement so the hook's setState + microtask chain settle.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900)
      })

      await waitFor(() => {
        expect(updateAdminCourse).toHaveBeenCalled()
      })
      // The payload should carry the latest title, not an intermediate value.
      const [cohortIdArg, payloadArg] = asMock(updateAdminCourse).mock.calls.at(-1) as [
        string,
        Record<string, unknown>,
      ]
      expect(cohortIdArg).toBe(existingCourse.id)
      expect(payloadArg).toMatchObject({ title: 'AI Builder 101 edited' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('autosave indicator: chip transitions from "Saving…" to "Saved just now"', async () => {
    // Use a deferred promise so we can observe the "saving" state before the
    // PATCH resolves and we fall through to "saved".
    let resolveSave!: () => void
    const saveDeferred = new Promise<void>((res) => {
      resolveSave = () => res()
    })
    asMock(updateAdminCourse).mockImplementation(() => saveDeferred)

    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPage()

      const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
      await user.click(listItem)

      // Two elements share "Course title" (topbar aria-label + OverviewTab
      // <label>). The topbar input is the first rendered and is the one the
      // editor uses as the primary title editor — pick it explicitly.
      const titleInputs = await screen.findAllByLabelText(/^course title$/i)
      const titleInput = titleInputs[0] as HTMLInputElement
      await user.type(titleInput, '!')

      // Flush the debounce — save fires but does not resolve yet, so the
      // chip should read "Saving…".
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900)
      })

      const indicator = await screen.findByTestId('save-state-indicator')
      await waitFor(() => {
        expect(indicator).toHaveTextContent(/saving/i)
      })

      // Resolve the save — chip should flip to "Saved just now".
      await act(async () => {
        resolveSave()
        await Promise.resolve()
        await Promise.resolve()
      })
      await waitFor(() => {
        expect(indicator).toHaveTextContent(/saved just now/i)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('manual Save still works and awaits any pending autosave before firing', async () => {
    // The autosave PATCH resolves on demand via a deferred. If handleSave
    // does *not* flush() it first, the manual PATCH would fire before the
    // autosave PATCH — we verify the ordering below.
    let resolveAutosave!: () => void
    const autosavePromise = new Promise<void>((res) => {
      resolveAutosave = () => res()
    })
    const callOrder: string[] = []
    asMock(updateAdminCourse).mockImplementation(() => {
      callOrder.push('updateAdminCourse')
      // The first call is the autosave — pause. Subsequent calls resolve
      // immediately (the manual Save).
      if (callOrder.length === 1) return autosavePromise
      return Promise.resolve({
        id: existingCourse.id,
        title: 'whatever',
        slug: existingCourse.slug,
        type: 'RECORDED',
        tagline: null,
        isPublished: false,
      })
    })

    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPage()

      const listItem = (await screen.findByText('AI Builder 101')).closest('button')!
      await user.click(listItem)

      // Type to kick off autosave.
      // Two elements share "Course title" (topbar aria-label + OverviewTab
      // <label>). The topbar input is the first rendered and is the one the
      // editor uses as the primary title editor — pick it explicitly.
      const titleInputs = await screen.findAllByLabelText(/^course title$/i)
      const titleInput = titleInputs[0] as HTMLInputElement
      await user.type(titleInput, 'Z')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900)
      })

      // At this point the autosave is in flight (pending on our deferred).
      expect(updateAdminCourse).toHaveBeenCalledTimes(1)

      // Kick off the manual Save — it should await the autosave flush first.
      const saveBtn = screen.getByRole('button', { name: /^save$|^saving…$/i })
      const clickPromise = user.click(saveBtn)

      // Before we resolve the autosave, the manual Save must still be waiting.
      // Allow a tick for React to settle but no more.
      await act(async () => {
        await Promise.resolve()
      })
      expect(updateAdminCourse).toHaveBeenCalledTimes(1)

      // Resolve the autosave — now the manual Save should proceed and fire
      // a second PATCH.
      await act(async () => {
        resolveAutosave()
      })
      await clickPromise

      await waitFor(() => {
        expect(updateAdminCourse).toHaveBeenCalledTimes(2)
      })
      expect(callOrder).toEqual(['updateAdminCourse', 'updateAdminCourse'])
    } finally {
      vi.useRealTimers()
    }
  })
})
