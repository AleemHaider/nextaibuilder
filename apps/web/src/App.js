import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-34 — Root app with AuthProvider and all auth/storefront routes
import { useEffect } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { registerAuthHelpers } from './lib/api';
import { StudentRoute, AdminRoute } from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import CohortDetailPage from './pages/CohortDetailPage';
import AboutPage from './pages/AboutPage';
import StudentLoginPage from './pages/StudentLoginPage';
import StudentSignupPage from './pages/StudentSignupPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminOtpPage from './pages/AdminOtpPage';
import AdminForgotPasswordPage from './pages/AdminForgotPasswordPage';
import AdminResetPasswordPage from './pages/AdminResetPasswordPage';
// FIR-157 — Checkout + enrollment success pages
import CheckoutPage from './pages/CheckoutPage';
import EnrollmentSuccessPage from './pages/EnrollmentSuccessPage';
// FIR-158 — Manual payment student receipt upload page
import ManualPaymentPage from './pages/ManualPaymentPage';
// FIR-50 — Admin manual payment review queue
import ManualPaymentsPage from './pages/admin/ManualPaymentsPage';
// FIR-165 / FIR-166 / FIR-173 — Admin CMS (Epic 7)
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import CourseBuilderPage from './pages/admin/CourseBuilderPage';
import StudentListPage from './pages/admin/StudentListPage';
import ScreenshotReviewPage from './pages/admin/ScreenshotReviewPage';
import SubAdminPage from './pages/admin/SubAdminPage';
// FIR-51/52/53/57/58/164 — Student LMS (Epic 6)
import DashboardPage from './pages/student/DashboardPage';
import CoursePage from './pages/student/CoursePage';
import LessonPage from './pages/student/LessonPage';
import LiveSessionsPage from './pages/student/LiveSessionsPage';
import CertificatePage from './pages/student/CertificatePage';
import BadgesPage from './pages/student/BadgesPage';
// FIR-169 — Notifications page
import NotificationsPage from './pages/student/NotificationsPage';
// FIR-171 — Student settings
import SettingsPage from './pages/student/SettingsPage';
// FIR-167 — Admin broadcast email
import BroadcastEmailPage from './pages/admin/BroadcastEmailPage';
// FIR-76/77/78/79 — Admin reporting
import ReportingPage from './pages/admin/ReportingPage';
// FIR-216/217/218 — Unified payment ledger
import TransactionLedgerPage from './pages/admin/TransactionLedgerPage';
// FIR-209 — Student detail page
import StudentDetailPage from './pages/admin/StudentDetailPage';
// FIR-213/214/215 — Enrollment management
import EnrollmentManagementPage from './pages/admin/EnrollmentManagementPage';
// FIR-74 — PWA install prompt
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { cn } from './lib/utils';
// ---------------------------------------------------------------------------
// Register auth helpers so authFetch can attach tokens + refresh silently.
// Must be inside AuthProvider so useAuth() resolves.
// ---------------------------------------------------------------------------
function AuthHelperRegistrar() {
    const { accessToken, refreshToken } = useAuth();
    useEffect(() => {
        registerAuthHelpers(() => accessToken, refreshToken);
    }, [accessToken, refreshToken]);
    return null;
}
// ---------------------------------------------------------------------------
// Placeholder pages for routes not yet built (Epic 4–9)
// ---------------------------------------------------------------------------
function PlaceholderPage({ title }) {
    return (_jsxs("div", { className: cn('min-h-screen flex flex-col items-center justify-center gap-4', 'bg-[#f8f9fb] text-[#1a2744]'), children: [_jsx("p", { className: "text-2xl font-bold", children: title }), _jsx("p", { className: "text-[#717182]", children: "Coming in a future epic." }), _jsx(Link, { to: "/", className: cn('px-6 py-2.5 rounded-full bg-[#4a9ad4] text-[#0d1a3a]', 'text-[15px] font-semibold hover:opacity-90 transition-opacity no-underline'), children: "Back to Home" })] }));
}
function NotFoundPage() {
    return (_jsxs("div", { className: cn('min-h-screen flex flex-col items-center justify-center gap-6', 'bg-[#f8f9fb] text-[#1a2744]'), children: [_jsx("p", { className: "text-[80px] font-black leading-none tracking-tighter", children: "404" }), _jsx("p", { className: "text-xl font-medium text-[#717182]", children: "Page not found" }), _jsx(Link, { to: "/", className: cn('px-8 py-3 rounded-full bg-[#4a9ad4] text-[#0d1a3a]', 'text-[15px] font-bold hover:opacity-90 transition-opacity no-underline'), children: "Back to Home" })] }));
}
// ---------------------------------------------------------------------------
// Routes tree — wrapped in AuthProvider
// ---------------------------------------------------------------------------
function AppRoutes() {
    const { isAuthenticated, user } = useAuth();
    const isStudent = isAuthenticated && user?.role === 'STUDENT';
    return (_jsxs(_Fragment, { children: [_jsx(AuthHelperRegistrar, {}), isStudent && _jsx(PwaInstallPrompt, {}), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/courses", element: _jsx(CatalogPage, {}) }), _jsx(Route, { path: "/courses/:slug", element: _jsx(CohortDetailPage, {}) }), _jsx(Route, { path: "/about", element: _jsx(AboutPage, {}) }), _jsx(Route, { path: "/login", element: _jsx(StudentLoginPage, {}) }), _jsx(Route, { path: "/signup", element: _jsx(StudentSignupPage, {}) }), _jsx(Route, { path: "/admin", element: _jsx(Navigate, { to: "/admin/dashboard", replace: true }) }), _jsx(Route, { path: "/admin/login", element: _jsx(AdminLoginPage, {}) }), _jsx(Route, { path: "/admin/verify-otp", element: _jsx(AdminOtpPage, {}) }), _jsx(Route, { path: "/admin/forgot-password", element: _jsx(AdminForgotPasswordPage, {}) }), _jsx(Route, { path: "/admin/reset-password", element: _jsx(AdminResetPasswordPage, {}) }), _jsxs(Route, { element: _jsx(StudentRoute, {}), children: [_jsx(Route, { path: "/checkout/:slug", element: _jsx(CheckoutPage, {}) }), _jsx(Route, { path: "/enrollment/success", element: _jsx(EnrollmentSuccessPage, {}) }), _jsx(Route, { path: "/manual-payment/:slug", element: _jsx(ManualPaymentPage, {}) }), _jsx(Route, { path: "/student/dashboard", element: _jsx(DashboardPage, {}) }), _jsxs(Route, { path: "/student/course/:slug", element: _jsx(CoursePage, {}), children: [_jsx(Route, { path: "lesson/:lessonId", element: _jsx(LessonPage, {}) }), _jsx(Route, { path: "sessions", element: _jsx(LiveSessionsPage, {}) })] }), _jsx(Route, { path: "/student/certificate", element: _jsx(CertificatePage, {}) }), _jsx(Route, { path: "/student/badges", element: _jsx(BadgesPage, {}) }), _jsx(Route, { path: "/student/notifications", element: _jsx(NotificationsPage, {}) }), _jsx(Route, { path: "/student/settings", element: _jsx(SettingsPage, {}) })] }), _jsxs(Route, { element: _jsx(AdminRoute, {}), children: [_jsx(Route, { path: "/admin/dashboard", element: _jsx(AdminDashboardPage, {}) }), _jsx(Route, { path: "/admin/manual-payments", element: _jsx(ManualPaymentsPage, {}) }), _jsx(Route, { path: "/admin/courses", element: _jsx(CourseBuilderPage, {}) }), _jsx(Route, { path: "/admin/students", element: _jsx(StudentListPage, {}) }), _jsx(Route, { path: "/admin/screenshot-review", element: _jsx(ScreenshotReviewPage, {}) }), _jsx(Route, { path: "/admin/team", element: _jsx(SubAdminPage, {}) }), _jsx(Route, { path: "/admin/broadcast-email", element: _jsx(BroadcastEmailPage, {}) }), _jsx(Route, { path: "/admin/reporting", element: _jsx(ReportingPage, {}) }), _jsx(Route, { path: "/admin/payments", element: _jsx(TransactionLedgerPage, {}) }), _jsx(Route, { path: "/admin/students/:id", element: _jsx(StudentDetailPage, {}) }), _jsx(Route, { path: "/admin/enrollments", element: _jsx(EnrollmentManagementPage, {}) }), _jsx(Route, { path: "/admin/*", element: _jsx(PlaceholderPage, { title: "Admin Portal" }) })] }), _jsx(Route, { path: "*", element: _jsx(NotFoundPage, {}) })] })] }));
}
export default function App() {
    return (_jsx(AuthProvider, { children: _jsx(AppRoutes, {}) }));
}
