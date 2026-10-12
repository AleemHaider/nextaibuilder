/* eslint-disable react-refresh/only-export-components -- router modules intentionally mix inline components with config exports */
import * as React from 'react'
import { createBrowserRouter, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ErrorPage } from './pages/shared/error-page'
import { NotFoundPage } from './pages/shared/not-found'

// Layouts and guards are kept eager — they're tiny and needed on every route
import { StudentShell } from './components/ui/student-shell'
import { StudentSidebarPanel } from './components/ui/student-sidebar-panel'
import { useAuth } from '@/hooks/use-auth'
import { useQuery } from '@tanstack/react-query'
import { studentApi } from '@/lib/api-client'
import { AdminLayout } from './components/layout/AdminLayout'
import { RequireAuth, RequireGuest, RequireAdminGuest, RequirePermission } from './components/ui/auth-guard'

// ── Lazy page imports ─────────────────────────────────────────────────────────

// Marketing
const LandingPage = React.lazy(() =>
  import('./pages/marketing/landing').then((m) => ({ default: m.LandingPage }))
)

// Auth (SSO callbacks)
const SignupPage           = React.lazy(() => import('./pages/auth/signup').then((m) => ({ default: m.SignupPage })))
const GoogleCallbackPage   = React.lazy(() => import('./pages/auth/google-callback').then((m) => ({ default: m.GoogleCallbackPage })))
const AppleCallbackPage    = React.lazy(() => import('./pages/auth/apple-callback').then((m) => ({ default: m.AppleCallbackPage })))

// Student auth
const StudentLoginPage        = React.lazy(() => import('./pages/student/login').then((m) => ({ default: m.StudentLoginPage })))
const StudentAcceptInvitePage = React.lazy(() => import('./pages/student/accept-invite').then((m) => ({ default: m.StudentAcceptInvitePage })))

// Student pages
const StudentDashboardPage  = React.lazy(() => import('./pages/student/dashboard').then((m) => ({ default: m.StudentDashboardPage })))
const StepDetailPage        = React.lazy(() => import('./pages/student/step-detail').then((m) => ({ default: m.StepDetailPage })))
const HelpPage              = React.lazy(() => import('./pages/student/help').then((m) => ({ default: m.HelpPage })))
const BadgesPage            = React.lazy(() => import('./pages/student/badges').then((m) => ({ default: m.BadgesPage })))
const MilestonesPage        = React.lazy(() => import('./pages/student/milestones').then((m) => ({ default: m.MilestonesPage })))
const CertificatePage       = React.lazy(() => import('./pages/student/certificate').then((m) => ({ default: m.CertificatePage })))
const CertificateVerifyPage = React.lazy(() => import('./pages/student/certificate-verify').then((m) => ({ default: m.CertificateVerifyPage })))
const CourseCompletionPage  = React.lazy(() => import('./pages/student/course-completion').then((m) => ({ default: m.CourseCompletionPage })))
const StudentAgentsPage     = React.lazy(() => import('./pages/student/agents').then((m) => ({ default: m.StudentAgentsPage })))
const StudentAgentDetailPage = React.lazy(() => import('./pages/student/agent-detail').then((m) => ({ default: m.StudentAgentDetailPage })))
const StudentCallReviewPage  = React.lazy(() => import('./pages/student/call-review').then((m) => ({ default: m.StudentCallReviewPage })))
const StudentProfilePage    = React.lazy(() => import('./pages/student/profile').then((m) => ({ default: m.StudentProfilePage })))

// Admin pages
const AdminDashboardPage     = React.lazy(() => import('./pages/admin/dashboard').then((m) => ({ default: m.AdminDashboardPage })))
const AdminReviewQueuePage   = React.lazy(() => import('./pages/admin/review-queue').then((m) => ({ default: m.AdminReviewQueuePage })))
const AdminReviewDetailPage  = React.lazy(() => import('./pages/admin/review-detail').then((m) => ({ default: m.AdminReviewDetailPage })))
const AdminStudentsPage      = React.lazy(() => import('./pages/admin/students').then((m) => ({ default: m.AdminStudentsPage })))
const AdminCohortsPage       = React.lazy(() => import('./pages/admin/cohorts').then((m) => ({ default: m.AdminCohortsPage })))
const AdminCohortDetailPage  = React.lazy(() => import('./pages/admin/cohort-detail').then((m) => ({ default: m.AdminCohortDetailPage })))
const AdminStudentDetailPage = React.lazy(() => import('./pages/admin/student-detail').then((m) => ({ default: m.AdminStudentDetailPage })))
const AdminMessagesPage      = React.lazy(() => import('./pages/admin/messages').then((m) => ({ default: m.AdminMessagesPage })))
const AdminReportsPage       = React.lazy(() => import('./pages/admin/reports').then((m) => ({ default: m.AdminReportsPage })))
const AdminSettingsPage      = React.lazy(() => import('./pages/admin/settings').then((m) => ({ default: m.AdminSettingsPage })))
const AdminStepsPage         = React.lazy(() => import('./pages/admin/steps').then((m) => ({ default: m.AdminStepsPage })))
const StepEditorPage         = React.lazy(() => import('./pages/admin/step-editor').then((m) => ({ default: m.StepEditorPage })))
const AdminForbiddenPage     = React.lazy(() => import('./pages/admin/forbidden').then((m) => ({ default: m.AdminForbiddenPage })))
const AdminSubAdminsPage     = React.lazy(() => import('./pages/admin/sub-admins').then((m) => ({ default: m.AdminSubAdminsPage })))
const AdminMyCallsPage       = React.lazy(() => import('./pages/admin/my-calls').then((m) => ({ default: m.AdminMyCallsPage })))
const AdminCohortRosterPage  = React.lazy(() => import('./pages/admin/cohort-roster').then((m) => ({ default: m.AdminCohortRosterPage })))

// Admin auth pages
const AdminLoginPage          = React.lazy(() => import('./pages/admin/login').then((m) => ({ default: m.AdminLoginPage })))
const AdminVerifyOtpPage      = React.lazy(() => import('./pages/admin/verify-otp').then((m) => ({ default: m.AdminVerifyOtpPage })))
const AdminSetPasswordPage    = React.lazy(() => import('./pages/admin/set-password').then((m) => ({ default: m.AdminSetPasswordPage })))
const AdminForgotPasswordPage = React.lazy(() => import('./pages/admin/forgot-password').then((m) => ({ default: m.AdminForgotPasswordPage })))
const AdminResetPasswordPage  = React.lazy(() => import('./pages/admin/reset-password').then((m) => ({ default: m.AdminResetPasswordPage })))

// ── Shared suspense fallback ───────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  )
}

function S({ children }: { children: React.ReactNode }) {
  return <React.Suspense fallback={<PageLoader />}>{children}</React.Suspense>
}

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
  /* ── Auth routes (guest-only) ── */
  {
    path: '/login',
    element: <RequireGuest><S><StudentLoginPage /></S></RequireGuest>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/signup',
    element: <RequireGuest><S><SignupPage /></S></RequireGuest>,
    errorElement: <ErrorPage />,
  },

  /* ── Public student routes ── */
  {
    path: '/student/accept-invite',
    element: <S><StudentAcceptInvitePage /></S>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/set-password',
    element: <SetPasswordRedirect />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/verify/:token',
    element: <S><CertificateVerifyPage /></S>,
    errorElement: <ErrorPage />,
  },

  // OAuth callbacks
  { path: '/auth/google/callback', element: <S><GoogleCallbackPage /></S> },
  { path: '/auth/apple/callback',  element: <S><AppleCallbackPage /></S> },

  // Legacy student password routes — redirect to student login (SSO only)
  { path: '/forgot-password', element: <Navigate to="/login" replace /> },
  { path: '/reset-password',  element: <Navigate to="/login" replace /> },
  { path: '/recovery',        element: <Navigate to="/login" replace /> },

  /* ── Admin auth routes ── */
  {
    path: '/admin/login',
    element: <RequireAdminGuest><S><AdminLoginPage /></S></RequireAdminGuest>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin/login/verify-otp',
    element: <S><AdminVerifyOtpPage /></S>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin/set-password',
    element: <S><AdminSetPasswordPage /></S>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin/forgot-password',
    element: <RequireAdminGuest><S><AdminForgotPasswordPage /></S></RequireAdminGuest>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin/reset-password',
    element: <S><AdminResetPasswordPage /></S>,
    errorElement: <ErrorPage />,
  },

  /* ── Root — Marketing landing page ── */
  {
    path: '/',
    element: <S><LandingPage /></S>,
    errorElement: <ErrorPage />,
  },

  /* ── Student routes (require auth + STUDENT role) ── */
  {
    path: '/dashboard',
    element: <RequireAuth role="STUDENT"><StudentLayout><S><StudentDashboardPage /></S></StudentLayout></RequireAuth>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/steps/:stepId',
    element: <RequireAuth role="STUDENT"><StudentLayout><S><StepDetailPage /></S></StudentLayout></RequireAuth>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/profile',
    element: <RequireAuth role="STUDENT"><StudentLayout><S><StudentProfilePage /></S></StudentLayout></RequireAuth>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/help',
    element: <RequireAuth role="STUDENT"><StudentLayout><S><HelpPage /></S></StudentLayout></RequireAuth>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/badges',
    element: <RequireAuth role="STUDENT"><StudentLayout><S><BadgesPage /></S></StudentLayout></RequireAuth>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/milestones',
    element: <RequireAuth role="STUDENT"><StudentLayout><S><MilestonesPage /></S></StudentLayout></RequireAuth>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/certificate',
    element: <RequireAuth role="STUDENT"><StudentLayout><S><CertificatePage /></S></StudentLayout></RequireAuth>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/completion',
    element: <RequireAuth role="STUDENT"><StudentLayout><S><CourseCompletionPage /></S></StudentLayout></RequireAuth>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/agents',
    element: <RequireAuth role="STUDENT"><StudentLayout><S><StudentAgentsPage /></S></StudentLayout></RequireAuth>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/agents/:id',
    element: <RequireAuth role="STUDENT"><StudentLayout><S><StudentAgentDetailPage /></S></StudentLayout></RequireAuth>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/student/calls/:callId/review',
    element: <RequireAuth role="STUDENT"><StudentLayout><S><StudentCallReviewPage /></S></StudentLayout></RequireAuth>,
    errorElement: <ErrorPage />,
  },

  /* ── Admin routes (nested under AdminLayout — role guard built into layout) ── */
  {
    path: '/admin',
    element: <AdminLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <S><AdminDashboardPage /></S> },
      { path: 'settings',  element: <S><AdminSettingsPage /></S> },
      { path: 'forbidden', element: <S><AdminForbiddenPage /></S> },
      {
        path: 'review',
        element: <RequirePermission permission="submissions:read"><S><AdminReviewQueuePage /></S></RequirePermission>,
      },
      {
        path: 'review-queue',
        element: <RequirePermission permission="submissions:read"><S><AdminReviewQueuePage /></S></RequirePermission>,
      },
      {
        path: 'review-queue/:id',
        element: <RequirePermission permission="submissions:read"><S><AdminReviewDetailPage /></S></RequirePermission>,
      },
      {
        path: 'students',
        element: <RequirePermission permission="students:read"><S><AdminStudentsPage /></S></RequirePermission>,
      },
      {
        path: 'students/:id',
        element: <RequirePermission permission="students:read"><S><AdminStudentDetailPage /></S></RequirePermission>,
      },
      {
        path: 'cohorts',
        element: <RequirePermission permission="cohorts:read"><S><AdminCohortsPage /></S></RequirePermission>,
      },
      {
        path: 'cohorts/:id',
        element: <RequirePermission permission="cohorts:read"><S><AdminCohortDetailPage /></S></RequirePermission>,
      },
      {
        path: 'cohorts/:cohortId/roster',
        element: <RequirePermission permission="cohorts:read"><S><AdminCohortRosterPage /></S></RequirePermission>,
      },
      {
        path: 'steps',
        element: <RequirePermission permission="steps:read"><S><AdminStepsPage /></S></RequirePermission>,
      },
      {
        path: 'steps/new',
        element: <RequirePermission permission="steps:write"><S><StepEditorPage /></S></RequirePermission>,
      },
      {
        path: 'steps/:stepId/edit',
        element: <RequirePermission permission="steps:write"><S><StepEditorPage /></S></RequirePermission>,
      },
      {
        path: 'messages',
        element: <RequirePermission permission="messages:read"><S><AdminMessagesPage /></S></RequirePermission>,
      },
      {
        path: 'reports',
        element: <RequirePermission permission="reports:read"><S><AdminReportsPage /></S></RequirePermission>,
      },
      {
        path: 'sub-admins',
        element: <RequirePermission permission="settings:manage-sub-admins"><S><AdminSubAdminsPage /></S></RequirePermission>,
      },
      // my-calls: role-guarded by AdminLayout (ADMIN/SUPER_ADMIN only), no fine-grained permission needed
      { path: 'my-calls', element: <S><AdminMyCallsPage /></S> },
    ],
  },

  /* ── 404 catch-all ── */
  { path: '*', element: <NotFoundPage /> },
])
