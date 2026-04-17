/* eslint-disable react-refresh/only-export-components -- router modules intentionally mix inline components with config exports */
// PBA-142 — Router with auth guards wired to real auth pages
// PBA-143/144/145/146/147/148 — Sprint 2 student pages wired
// PBA-129 — Sprint 3: Help & Support page wired
// PBA-130 — Sprint 3: Admin Layout Shell with nested routes
// PBA-236 — RequirePermission route guard wired to admin pages
// PBA-262 — Admin auth routes wired (login, verify-otp, set-password, forgot-password, reset-password)
// Sprint 1 — Landing page at root route (replaces redirect)
import * as React from 'react'
import { createBrowserRouter, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ErrorPage } from './pages/shared/error-page'
import { NotFoundPage } from './pages/shared/not-found'

// Layouts (shells)
import { StudentShell } from './components/ui/student-shell'
import { StudentSidebarPanel } from './components/ui/student-sidebar-panel'
import { useAuth } from '@/hooks/use-auth'
import { useQuery } from '@tanstack/react-query'
import { studentApi } from '@/lib/api-client'
import { AdminLayout } from './components/layout/AdminLayout'

// Auth guards (PBA-142, PBA-236, PBA-262)
import { RequireAuth, RequireGuest, RequireAdminGuest, RequirePermission } from './components/ui/auth-guard'

// ── Auth pages ───────────────────────────────────────────────────────────────
import { SignupPage } from './pages/auth/signup'
import { GoogleCallbackPage } from './pages/auth/google-callback'
import { AppleCallbackPage } from './pages/auth/apple-callback'

// ── Student auth pages (PBA-286, PBA-287, PBA-339, PBA-342) ─────────────────
import { StudentLoginPage }        from './pages/student/login'
import { StudentAcceptInvitePage } from './pages/student/accept-invite'

// ── Student pages (Sprint 2 / 3) ──────────────────────────────────────────────
import { StudentDashboardPage } from './pages/student/dashboard'
import { StepDetailPage } from './pages/student/step-detail'
import { HelpPage } from './pages/student/help'

// ── Student pages (Sprint 3 — Gamification, PBA-128) ──────────────────────────
import { BadgesPage } from './pages/student/badges'
import { CertificateVerifyPage } from './pages/student/certificate-verify'
import { MilestonesPage } from './pages/student/milestones'
import { CertificatePage } from './pages/student/certificate'
import { CourseCompletionPage } from './pages/student/course-completion'

// ── Admin pages (Sprint 3 / 4) ───────────────────────────────────────────────
import { AdminDashboardPage }      from './pages/admin/dashboard'
import { AdminReviewQueuePage }    from './pages/admin/review-queue'
import { AdminReviewDetailPage }   from './pages/admin/review-detail'
import { AdminStudentsPage }       from './pages/admin/students'
import { AdminCohortsPage }        from './pages/admin/cohorts'
import { AdminCohortDetailPage }   from './pages/admin/cohort-detail'
import { AdminStudentDetailPage }  from './pages/admin/student-detail'

// ── Admin pages (Sprint 5 — PBA-132) ─────────────────────────────────────────
import { AdminMessagesPage }  from './pages/admin/messages'
import { AdminReportsPage }   from './pages/admin/reports'
import { AdminSettingsPage }  from './pages/admin/settings'
import { AdminStepsPage }     from './pages/admin/steps'
import { StepEditorPage }     from './pages/admin/step-editor'

// ── Admin pages (PBA-236) ─────────────────────────────────────────────────────
import { AdminForbiddenPage } from './pages/admin/forbidden'

// ── Admin pages (PBA-241 — Sub-Admin Management) ──────────────────────────────
import { AdminSubAdminsPage } from './pages/admin/sub-admins'

// ── Admin pages (PBA-330 — My Calls) ─────────────────────────────────────────
import { AdminMyCallsPage } from './pages/admin/my-calls'
import { AdminCohortRosterPage } from './pages/admin/cohort-roster'

// ── Student pages (PBA-317 — Support Agent Call Booking) ──────────────────────
import { StudentAgentsPage }     from './pages/student/agents'
import { StudentAgentDetailPage } from './pages/student/agent-detail'
import { StudentCallReviewPage }  from './pages/student/call-review'

// ── Admin auth pages (PBA-262 — Email/Password auth flow) ─────────────────────
import { AdminLoginPage }          from './pages/admin/login'
import { AdminVerifyOtpPage }      from './pages/admin/verify-otp'
import { AdminSetPasswordPage }    from './pages/admin/set-password'
import { AdminForgotPasswordPage } from './pages/admin/forgot-password'
import { AdminResetPasswordPage }  from './pages/admin/reset-password'

// ── Student Profile page (PBA-315) ────────────────────────────────────────────
import { StudentProfilePage } from './pages/student/profile'

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
const LandingPage = React.lazy(() =>
  import('./pages/marketing/landing').then((m) => ({ default: m.LandingPage }))
)

/* ---- Redirect: /student/set-password → /student/accept-invite (preserve query string) ---- */
function SetPasswordRedirect() {
  const [searchParams] = useSearchParams()
  const qs = searchParams.toString()
  return <Navigate to={`/student/accept-invite${qs ? `?${qs}` : ''}`} replace />
}

/* ---- Student layout wrapper (uses real user from auth store) ---- */
function StudentLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Student'
  const userInitials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : 'S'
  const userAvatar = user?.avatarUrl ?? undefined

  // Pull cohort info from the cached dashboard query — no additional network request
  const { data: dashboardData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data, error } = await studentApi.getDashboard()
      if (error) throw new Error(error.message ?? 'Failed to load dashboard')
      return data!
    },
  })

  return (
    <StudentShell
      userName={userName}
      userInitials={userInitials}
      userAvatar={userAvatar}
      cohortName={dashboardData?.cohort?.name}
      cohortStartDate={dashboardData?.cohort?.startDate ?? undefined}
      cohortDeadline={dashboardData?.cohort?.deadline ?? undefined}
      stepPanel={
        <StudentSidebarPanel
          onStepClick={(stepId) => void navigate(`/steps/${stepId}`)}
        />
      }
    >
      {children}
    </StudentShell>
  )
}

export const router = createBrowserRouter([
  /* ── Auth routes (guest-only — redirect to /dashboard if signed in) ── */
  {
    path: '/login',
    element: <RequireGuest><StudentLoginPage /></RequireGuest>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/signup',
    element: <RequireGuest><SignupPage /></RequireGuest>,
    errorElement: <ErrorPage />,
  },
  /* ── Student accept-invite (public, no auth guard) — PBA-339 ── */
  {
    path: '/student/accept-invite',
    element: <StudentAcceptInvitePage />,
    errorElement: <ErrorPage />,
  },
  /* ── Student set-password — redirect permanently to accept-invite (PBA-341) ── */
  {
    path: '/student/set-password',
    element: <SetPasswordRedirect />,
    errorElement: <ErrorPage />,
  },
  /* ── Public certificate verification (PBA-314 — no auth required) ── */
  {
    path: '/verify/:token',
    element: <CertificateVerifyPage />,
    errorElement: <ErrorPage />,
  },
  // OAuth popup/redirect callbacks
  { path: '/auth/google/callback', element: <GoogleCallbackPage /> },
  { path: '/auth/apple/callback',  element: <AppleCallbackPage /> },

  // Legacy student password routes — redirect to student login (SSO only)
  { path: '/forgot-password', element: <Navigate to="/login" replace /> },
  { path: '/reset-password',  element: <Navigate to="/login" replace /> },
  { path: '/recovery',        element: <Navigate to="/login" replace /> },

  /* ── Admin auth routes (guest-only — redirect to /admin/dashboard if signed in as admin) ── */
  {
    path: '/admin/login',
    element: <RequireAdminGuest><AdminLoginPage /></RequireAdminGuest>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin/login/verify-otp',
    element: <AdminVerifyOtpPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin/set-password',
    element: <AdminSetPasswordPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin/forgot-password',
    element: <RequireAdminGuest><AdminForgotPasswordPage /></RequireAdminGuest>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin/reset-password',
    element: <AdminResetPasswordPage />,
    errorElement: <ErrorPage />,
  },

  /* ── Root — Marketing landing page (Sprint 1) ── */
  {
    path: '/',
    element: (
      <React.Suspense fallback={<div />}>
        <LandingPage />
      </React.Suspense>
    ),
    errorElement: <ErrorPage />,
  },

  /* ── Student routes (require auth + STUDENT role) ── */
  {
    path: '/dashboard',
    element: (
      <RequireAuth role="STUDENT">
        <StudentLayout><StudentDashboardPage /></StudentLayout>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/steps/:stepId',
    element: (
      <RequireAuth role="STUDENT">
        <StudentLayout><StepDetailPage /></StudentLayout>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/profile',
    element: (
      <RequireAuth role="STUDENT">
        <StudentLayout><StudentProfilePage /></StudentLayout>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/help',
    element: (
      <RequireAuth role="STUDENT">
        <StudentLayout><HelpPage /></StudentLayout>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/badges',
    element: (
      <RequireAuth role="STUDENT">
        <StudentLayout><BadgesPage /></StudentLayout>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/milestones',
    element: (
      <RequireAuth role="STUDENT">
        <StudentLayout><MilestonesPage /></StudentLayout>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/certificate',
    element: (
      <RequireAuth role="STUDENT">
        <StudentLayout><CertificatePage /></StudentLayout>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/completion',
    element: (
      <RequireAuth role="STUDENT">
        <StudentLayout><CourseCompletionPage /></StudentLayout>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
  },
  /* ── PBA-317 — Support Agent Call Booking routes ── */
  {
    path: '/student/agents',
    element: (
      <RequireAuth role="STUDENT">
        <StudentLayout><StudentAgentsPage /></StudentLayout>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/agents/:id',
    element: (
      <RequireAuth role="STUDENT">
        <StudentLayout><StudentAgentDetailPage /></StudentLayout>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/calls/:callId/review',
    element: (
      <RequireAuth role="STUDENT">
        <StudentLayout><StudentCallReviewPage /></StudentLayout>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
  },

  /* ── Admin routes (nested under AdminLayout — role guard built into layout) ── */
  {
    path: '/admin',
    element: <AdminLayout />,
    errorElement: <ErrorPage />,
    children: [
      // /admin → redirect to /admin/dashboard for a clean URL
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      // Dashboard and Settings are always accessible to any authenticated admin
      { path: 'dashboard',  element: <AdminDashboardPage /> },
      { path: 'settings',   element: <AdminSettingsPage /> },
      // Forbidden page — shown when RequirePermission redirects
      { path: 'forbidden',  element: <AdminForbiddenPage /> },
      // Permission-gated routes (PBA-236)
      {
        path: 'review',
        element: (
          <RequirePermission permission="submissions:read">
            <AdminReviewQueuePage />
          </RequirePermission>
        ),
      },
      {
        path: 'review-queue',
        element: (
          <RequirePermission permission="submissions:read">
            <AdminReviewQueuePage />
          </RequirePermission>
        ),
      },
      {
        path: 'review-queue/:id',
        element: (
          <RequirePermission permission="submissions:read">
            <AdminReviewDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'students',
        element: (
          <RequirePermission permission="students:read">
            <AdminStudentsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'students/:id',
        element: (
          <RequirePermission permission="students:read">
            <AdminStudentDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'cohorts',
        element: (
          <RequirePermission permission="cohorts:read">
            <AdminCohortsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'cohorts/:id',
        element: (
          <RequirePermission permission="cohorts:read">
            <AdminCohortDetailPage />
          </RequirePermission>
        ),
      },
      // PBA-364 — Cohort Roster page
      {
        path: 'cohorts/:cohortId/roster',
        element: (
          <RequirePermission permission="cohorts:read">
            <AdminCohortRosterPage />
          </RequirePermission>
        ),
      },
      {
        path: 'steps',
        element: (
          <RequirePermission permission="steps:read">
            <AdminStepsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'steps/new',
        element: (
          <RequirePermission permission="steps:write">
            <StepEditorPage />
          </RequirePermission>
        ),
      },
      {
        path: 'steps/:stepId/edit',
        element: (
          <RequirePermission permission="steps:write">
            <StepEditorPage />
          </RequirePermission>
        ),
      },
      {
        path: 'messages',
        element: (
          <RequirePermission permission="messages:read">
            <AdminMessagesPage />
          </RequirePermission>
        ),
      },
      {
        path: 'reports',
        element: (
          <RequirePermission permission="reports:read">
            <AdminReportsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'sub-admins',
        element: (
          <RequirePermission permission="settings:manage-sub-admins">
            <AdminSubAdminsPage />
          </RequirePermission>
        ),
      },
      // PBA-330 — My Calls (agent only — no permission gate, just a UI guard)
      { path: 'my-calls', element: <AdminMyCallsPage /> },
    ],
  },

  /* ── 404 catch-all ── */
  { path: '*', element: <NotFoundPage /> },
])
