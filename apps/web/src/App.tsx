// FIR-34 — Root app with AuthProvider and all auth/storefront routes.
// Pages are loaded via React.lazy() so the initial bundle does not include
// the admin CMS for unauthenticated visitors. The Suspense fallback uses
// the canonical LoadingSpinner primitive.
import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Link, Navigate } from 'react-router'
import { AuthProvider, useAuth } from './context/AuthContext'
import { registerAuthHelpers } from './lib/api'
import { StudentRoute, AdminRoute } from './components/ProtectedRoute'
// Auth + landing pages stay eager — they are on the first-paint critical path
// and small. Everything else is code-split below.
import HomePage from './pages/HomePage'
import StudentLoginPage from './pages/StudentLoginPage'
import StudentSignupPage from './pages/StudentSignupPage'
import AdminLoginPage from './pages/AdminLoginPage'
import { PwaInstallPrompt } from './components/PwaInstallPrompt'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { cn } from './lib/utils'

// ── Storefront (public) ────────────────────────────────────────────────────
const CatalogPage = lazy(() => import('./pages/CatalogPage'))
const CohortDetailPage = lazy(() => import('./pages/CohortDetailPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const CertificateVerifyPage = lazy(() => import('./pages/CertificateVerifyPage'))
const ManualPaymentPage = lazy(() => import('./pages/ManualPaymentPage'))

// ── Auth (admin) ───────────────────────────────────────────────────────────
const AdminOtpPage = lazy(() => import('./pages/AdminOtpPage'))
const AdminForgotPasswordPage = lazy(() => import('./pages/AdminForgotPasswordPage'))
const AdminResetPasswordPage = lazy(() => import('./pages/AdminResetPasswordPage'))

// ── Student checkout + LMS ─────────────────────────────────────────────────
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const EnrollmentSuccessPage = lazy(() => import('./pages/EnrollmentSuccessPage'))
const DashboardPage = lazy(() => import('./pages/student/DashboardPage'))
const CoursePage = lazy(() => import('./pages/student/CoursePage'))
const LessonPage = lazy(() => import('./pages/student/LessonPage'))
const LiveSessionsPage = lazy(() => import('./pages/student/LiveSessionsPage'))
const CertificatePage = lazy(() => import('./pages/student/CertificatePage'))
const BadgesPage = lazy(() => import('./pages/student/BadgesPage'))
const NotificationsPage = lazy(() => import('./pages/student/NotificationsPage'))
const SettingsPage = lazy(() => import('./pages/student/SettingsPage'))

// ── Admin CMS ──────────────────────────────────────────────────────────────
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const ManualPaymentsPage = lazy(() => import('./pages/admin/ManualPaymentsPage'))
const CourseBuilderPage = lazy(() => import('./pages/admin/CourseBuilderPage'))
const StudentListPage = lazy(() => import('./pages/admin/StudentListPage'))
const ScreenshotReviewPage = lazy(() => import('./pages/admin/ScreenshotReviewPage'))
const SubAdminPage = lazy(() => import('./pages/admin/SubAdminPage'))
const BroadcastEmailPage = lazy(() => import('./pages/admin/BroadcastEmailPage'))
const ReportingPage = lazy(() => import('./pages/admin/ReportingPage'))
const TransactionLedgerPage = lazy(() => import('./pages/admin/TransactionLedgerPage'))
const StudentDetailPage = lazy(() => import('./pages/admin/StudentDetailPage'))
const EnrollmentManagementPage = lazy(() => import('./pages/admin/EnrollmentManagementPage'))

// ---------------------------------------------------------------------------
// Register auth helpers so authFetch can attach tokens + refresh silently.
// Must be inside AuthProvider so useAuth() resolves.
// ---------------------------------------------------------------------------
function AuthHelperRegistrar() {
  const { accessToken, refreshToken } = useAuth()
  useEffect(() => {
    registerAuthHelpers(
      () => accessToken,
      refreshToken,
    )
  }, [accessToken, refreshToken])
  return null
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div
      className={cn(
        'min-h-screen flex flex-col items-center justify-center gap-4',
        'bg-[#f8f9fb] text-[#1a2744]',
      )}
    >
      <p className="text-2xl font-bold">{title}</p>
      <p className="text-[#717182]">Coming in a future epic.</p>
      <Link
        to="/"
        className={cn(
          'px-6 py-2.5 rounded-full bg-[#4a9ad4] text-[#0d1a3a]',
          'text-[15px] font-semibold hover:opacity-90 transition-opacity no-underline',
        )}
      >
        Back to Home
      </Link>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div
      className={cn(
        'min-h-screen flex flex-col items-center justify-center gap-6',
        'bg-[#f8f9fb] text-[#1a2744]',
      )}
    >
      <p className="text-[80px] font-black leading-none tracking-tighter">404</p>
      <p className="text-xl font-medium text-[#717182]">Page not found</p>
      <Link
        to="/"
        className={cn(
          'px-8 py-3 rounded-full bg-[#4a9ad4] text-[#0d1a3a]',
          'text-[15px] font-bold hover:opacity-90 transition-opacity no-underline',
        )}
      >
        Back to Home
      </Link>
    </div>
  )
}

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
      <LoadingSpinner size="lg" label="Loading page" />
    </div>
  )
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth()
  const isStudent = isAuthenticated && user?.role === 'STUDENT'

  return (
    <>
      <AuthHelperRegistrar />
      {isStudent && <PwaInstallPrompt />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public storefront */}
          <Route path="/" element={<HomePage />} />
          <Route path="/courses" element={<CatalogPage />} />
          <Route path="/courses/:slug" element={<CohortDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/verify-certificate" element={<CertificateVerifyPage />} />
          <Route path="/verify-certificate/:token" element={<CertificateVerifyPage />} />
          <Route path="/manual-payment/:slug" element={<ManualPaymentPage />} />

          {/* Auth */}
          <Route path="/login" element={<StudentLoginPage />} />
          <Route path="/signup" element={<StudentSignupPage />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/verify-otp" element={<AdminOtpPage />} />
          <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
          <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />

          {/* Student-only */}
          <Route element={<StudentRoute />}>
            <Route path="/checkout/:slug" element={<CheckoutPage />} />
            <Route path="/enrollment/success" element={<EnrollmentSuccessPage />} />
            <Route path="/student/dashboard" element={<DashboardPage />} />
            <Route path="/student/course/:slug" element={<CoursePage />}>
              <Route path="lesson/:lessonId" element={<LessonPage />} />
              <Route path="sessions" element={<LiveSessionsPage />} />
            </Route>
            <Route path="/student/certificate" element={<CertificatePage />} />
            <Route path="/student/badges" element={<BadgesPage />} />
            <Route path="/student/notifications" element={<NotificationsPage />} />
            <Route path="/student/settings" element={<SettingsPage />} />
          </Route>

          {/* Admin-only */}
          <Route element={<AdminRoute />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/manual-payments" element={<ManualPaymentsPage />} />
            <Route path="/admin/courses" element={<CourseBuilderPage />} />
            <Route path="/admin/students" element={<StudentListPage />} />
            <Route path="/admin/screenshot-review" element={<ScreenshotReviewPage />} />
            <Route path="/admin/team" element={<SubAdminPage />} />
            <Route path="/admin/broadcast-email" element={<BroadcastEmailPage />} />
            <Route path="/admin/reporting" element={<ReportingPage />} />
            <Route path="/admin/payments" element={<TransactionLedgerPage />} />
            <Route path="/admin/students/:id" element={<StudentDetailPage />} />
            <Route path="/admin/enrollments" element={<EnrollmentManagementPage />} />
            <Route path="/admin/*" element={<PlaceholderPage title="Admin Portal" />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
