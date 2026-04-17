// FIR-34 — Root app with AuthProvider and all auth/storefront routes
import { useEffect } from 'react'
import { Routes, Route, Link, Navigate } from 'react-router'
import { AuthProvider, useAuth } from './context/AuthContext'
import { registerAuthHelpers } from './lib/api'
import { ProtectedRoute, StudentRoute, AdminRoute } from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import CatalogPage from './pages/CatalogPage'
import CohortDetailPage from './pages/CohortDetailPage'
import AboutPage from './pages/AboutPage'
import StudentLoginPage from './pages/StudentLoginPage'
import StudentSignupPage from './pages/StudentSignupPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminOtpPage from './pages/AdminOtpPage'
import AdminForgotPasswordPage from './pages/AdminForgotPasswordPage'
import AdminResetPasswordPage from './pages/AdminResetPasswordPage'
// FIR-157 — Checkout + enrollment success pages
import CheckoutPage from './pages/CheckoutPage'
import EnrollmentSuccessPage from './pages/EnrollmentSuccessPage'
// FIR-158 — Manual payment student receipt upload page
import ManualPaymentPage from './pages/ManualPaymentPage'
// FIR-50 — Admin manual payment review queue
import ManualPaymentsPage from './pages/admin/ManualPaymentsPage'
// FIR-165 / FIR-166 / FIR-173 — Admin CMS (Epic 7)
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import CourseBuilderPage from './pages/admin/CourseBuilderPage'
import StudentListPage from './pages/admin/StudentListPage'
import ScreenshotReviewPage from './pages/admin/ScreenshotReviewPage'
import SubAdminPage from './pages/admin/SubAdminPage'
// FIR-51/52/53/57/58/164 — Student LMS (Epic 6)
import DashboardPage from './pages/student/DashboardPage'
import CoursePage from './pages/student/CoursePage'
import LessonPage from './pages/student/LessonPage'
import LiveSessionsPage from './pages/student/LiveSessionsPage'
import CertificatePage from './pages/student/CertificatePage'
import BadgesPage from './pages/student/BadgesPage'
// FIR-169 — Notifications page
import NotificationsPage from './pages/student/NotificationsPage'
// FIR-171 — Student settings
import SettingsPage from './pages/student/SettingsPage'
// FIR-167 — Admin broadcast email
import BroadcastEmailPage from './pages/admin/BroadcastEmailPage'
// FIR-76/77/78/79 — Admin reporting
import ReportingPage from './pages/admin/ReportingPage'
// FIR-216/217/218 — Unified payment ledger
import TransactionLedgerPage from './pages/admin/TransactionLedgerPage'
// FIR-209 — Student detail page
import StudentDetailPage from './pages/admin/StudentDetailPage'
// FIR-213/214/215 — Enrollment management
import EnrollmentManagementPage from './pages/admin/EnrollmentManagementPage'
// FIR-74 — PWA install prompt
import { PwaInstallPrompt } from './components/PwaInstallPrompt'
import { cn } from './lib/utils'

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

// ---------------------------------------------------------------------------
// Placeholder pages for routes not yet built (Epic 4–9)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Routes tree — wrapped in AuthProvider
// ---------------------------------------------------------------------------
function AppRoutes() {
  const { isAuthenticated, user } = useAuth()
  const isStudent = isAuthenticated && user?.role === 'STUDENT'

  return (
    <>
      <AuthHelperRegistrar />
      {/* FIR-74 — Show PWA install prompt globally for logged-in students */}
      {isStudent && <PwaInstallPrompt />}
      <Routes>
        {/* Public storefront routes (Epic 2) */}
        <Route path="/" element={<HomePage />} />
        <Route path="/courses" element={<CatalogPage />} />
        <Route path="/courses/:slug" element={<CohortDetailPage />} />
        <Route path="/about" element={<AboutPage />} />

        {/* Auth routes (Epic 3) */}
        <Route path="/login" element={<StudentLoginPage />} />
        <Route path="/signup" element={<StudentSignupPage />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/verify-otp" element={<AdminOtpPage />} />
        <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
        <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />

        {/* Student routes — Epic 4 + Epic 6 (protected: STUDENT role only) */}
        {/* FIR-157 — Checkout and enrollment success (student auth required) */}
        {/* FIR-158 — Manual payment receipt upload (student auth required) */}
        {/* FIR-51/52/53/57/58/164 — Student LMS (Epic 6) */}
        <Route element={<StudentRoute />}>
          <Route path="/checkout/:slug" element={<CheckoutPage />} />
          <Route path="/enrollment/success" element={<EnrollmentSuccessPage />} />
          <Route path="/manual-payment/:slug" element={<ManualPaymentPage />} />

          {/* FIR-51 — Student dashboard */}
          <Route path="/student/dashboard" element={<DashboardPage />} />

          {/* FIR-52/53/57 — LMS shell: curriculum + lesson player + live sessions */}
          <Route path="/student/course/:slug" element={<CoursePage />}>
            <Route path="lesson/:lessonId" element={<LessonPage />} />
            <Route path="sessions" element={<LiveSessionsPage />} />
          </Route>

          {/* FIR-58 — Certificates */}
          <Route path="/student/certificate" element={<CertificatePage />} />

          {/* FIR-164 — Badges */}
          <Route path="/student/badges" element={<BadgesPage />} />

          {/* FIR-169 — Notifications */}
          <Route path="/student/notifications" element={<NotificationsPage />} />

          {/* FIR-171 — Student settings */}
          <Route path="/student/settings" element={<SettingsPage />} />
        </Route>

        {/* Admin routes — Epics 5–9 (protected: ADMIN / SUPER_ADMIN role only) */}
        {/* FIR-50 — Manual payment review queue */}
        {/* FIR-165 — Screenshot review queue */}
        {/* FIR-166 — Student list */}
        {/* FIR-173 — Sub-admin management */}
        <Route element={<AdminRoute />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/manual-payments" element={<ManualPaymentsPage />} />
          <Route path="/admin/courses" element={<CourseBuilderPage />} />
          <Route path="/admin/students" element={<StudentListPage />} />
          <Route path="/admin/screenshot-review" element={<ScreenshotReviewPage />} />
          <Route path="/admin/team" element={<SubAdminPage />} />
          {/* FIR-167 — Broadcast email */}
          <Route path="/admin/broadcast-email" element={<BroadcastEmailPage />} />
          {/* FIR-76/77/78/79 — Reporting */}
          <Route path="/admin/reporting" element={<ReportingPage />} />
          {/* FIR-216/217/218 — Payment ledger */}
          <Route path="/admin/payments" element={<TransactionLedgerPage />} />
          {/* FIR-209 — Student detail */}
          <Route path="/admin/students/:id" element={<StudentDetailPage />} />
          {/* FIR-213/214/215 — Enrollment management */}
          <Route path="/admin/enrollments" element={<EnrollmentManagementPage />} />
          <Route
            path="/admin/*"
            element={<PlaceholderPage title="Admin Portal" />}
          />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
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
