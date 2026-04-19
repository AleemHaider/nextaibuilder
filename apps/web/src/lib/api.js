// API client for nextaibuilder storefront
// FIR-34 / FIR-35 / FIR-36 / FIR-155 / FIR-156 — Auth API calls added
const BASE = '/api/v1';
const AUTH_BASE = '/api/auth';
// ---------------------------------------------------------------------------
// authFetch — attaches Bearer token, retries once on 401 via refreshToken
// ---------------------------------------------------------------------------
// This is set by the AuthProvider after boot; avoids a circular import.
let _getToken = null;
let _refreshToken = null;
// Singleton refresh promise — prevents concurrent 401s from firing multiple
// refresh requests and racing each other (the second attempt would fail if
// the server uses single-use token rotation).
let _refreshPromise = null;
function refreshOnce() {
    if (!_refreshPromise) {
        _refreshPromise = _refreshToken().finally(() => {
            _refreshPromise = null;
        });
    }
    return _refreshPromise;
}
export function registerAuthHelpers(getToken, refreshFn) {
    _getToken = getToken;
    _refreshToken = refreshFn;
}
export async function authFetch(input, init = {}) {
    const token = _getToken?.() ?? null;
    const headers = new Headers(init.headers);
    if (token)
        headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(input, { ...init, headers, credentials: 'include' });
    if (res.status === 401 && _refreshToken) {
        const refreshed = await refreshOnce();
        if (refreshed) {
            const newToken = _getToken?.() ?? null;
            if (newToken)
                headers.set('Authorization', `Bearer ${newToken}`);
            return fetch(input, { ...init, headers, credentials: 'include' });
        }
    }
    return res;
}
// ---------------------------------------------------------------------------
// Auth API calls — FIR-155 (OAuth), FIR-35 (admin login), FIR-156 (OTP)
// ---------------------------------------------------------------------------
// ── Student email/password auth ──────────────────────────────────────────
export async function registerStudent(data) {
    const res = await fetch(`${AUTH_BASE}/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok)
        throw new Error(json.message ?? 'Registration failed');
    return json;
}
export async function loginStudent(email, password) {
    const res = await fetch(`${AUTH_BASE}/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok)
        throw new Error(json.message ?? 'Login failed');
    return json;
}
// ── OAuth ────────────────────────────────────────────────────────────────
export async function loginWithGoogle(idToken) {
    const res = await fetch(`${AUTH_BASE}/oauth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
    });
    if (!res.ok)
        throw new Error('Google login failed');
    return res.json();
}
export async function loginWithApple(idToken, userData) {
    const res = await fetch(`${AUTH_BASE}/oauth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken, user: userData }),
    });
    if (!res.ok)
        throw new Error('Apple login failed');
    return res.json();
}
export async function adminLogin(email, password) {
    const res = await fetch(`${AUTH_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Invalid email or password');
    }
    return res.json();
}
export async function adminVerifyOtp(preAuthToken, code) {
    const res = await fetch(`${AUTH_BASE}/admin/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preAuthToken, code }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Invalid or expired code');
    }
    return res.json();
}
export async function adminResendOtp(preAuthToken) {
    const res = await fetch(`${AUTH_BASE}/admin/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preAuthToken }),
    });
    if (!res.ok)
        throw new Error('Failed to resend code');
}
export async function adminForgotPassword(email) {
    const res = await fetch(`${AUTH_BASE}/admin/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    if (!res.ok)
        throw new Error('Failed to send reset email');
}
export async function adminResetPassword(token, password, confirmPassword) {
    const res = await fetch(`${AUTH_BASE}/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to reset password');
    }
}
export async function logoutUser() {
    await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
    });
}
export async function getCurrentUser() {
    const res = await authFetch(`${AUTH_BASE}/me`);
    if (!res.ok)
        throw new Error('Not authenticated');
    return res.json();
}
export async function fetchCohorts() {
    const res = await fetch(`${BASE}/storefront/cohorts`);
    if (!res.ok)
        throw new Error('Failed to fetch cohorts');
    return res.json();
}
export async function fetchCohortBySlug(slug) {
    const res = await fetch(`${BASE}/storefront/cohorts/${slug}`);
    if (res.status === 404)
        return null;
    if (!res.ok)
        throw new Error('Failed to fetch cohort');
    return res.json();
}
export async function fetchPreviewLessons(slug) {
    const res = await fetch(`${BASE}/storefront/cohorts/${slug}/preview-lessons`);
    if (!res.ok)
        return [];
    return res.json();
}
export async function createOneTimeCheckout(cohortId, paymentPlanId) {
    const res = await authFetch(`${BASE}/student/checkout/one-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId, paymentPlanId }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to create checkout session');
    }
    return res.json();
}
export async function createInstallmentCheckout(cohortId, paymentPlanId) {
    const res = await authFetch(`${BASE}/student/checkout/installment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId, paymentPlanId }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to create installment checkout');
    }
    return res.json();
}
export async function submitManualPayment(formData) {
    const res = await authFetch(`${BASE}/student/manual-payment`, {
        method: 'POST',
        body: formData,
        // No Content-Type header — browser must set multipart boundary automatically
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to submit payment receipt');
    }
    return res.json();
}
// FIR-46 — Student: submit manual payment request with receipt upload
export async function submitManualPaymentRequest(formData) {
    const res = await authFetch(`${BASE}/student/manual-payment/request`, {
        method: 'POST',
        body: formData,
        // No Content-Type — browser sets multipart boundary automatically
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to submit payment receipt');
    }
    return res.json();
}
// FIR-47 — Admin: list manual payment requests with optional status filter + pagination
export async function fetchManualPayments(status, page = 1) {
    const params = new URLSearchParams();
    if (status)
        params.set('status', status);
    params.set('page', String(page));
    const res = await authFetch(`${BASE}/admin/manual-payments?${params.toString()}`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch manual payments');
    }
    return res.json();
}
// FIR-48 — Admin: approve a manual payment request
export async function approveManualPayment(id, note) {
    const res = await authFetch(`${BASE}/admin/manual-payments/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to approve payment');
    }
    return res.json();
}
// FIR-49 — Admin: reject a manual payment request
export async function rejectManualPayment(id, reason) {
    const res = await authFetch(`${BASE}/admin/manual-payments/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to reject payment');
    }
    return res.json();
}
// FIR-51 — Fetch student dashboard data
export async function fetchStudentDashboard() {
    const res = await authFetch(`${BASE}/student/dashboard`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch dashboard');
    }
    return res.json();
}
// FIR-52 — Fetch curriculum for a cohort slug
export async function fetchCurriculum(slug) {
    const res = await authFetch(`${BASE}/student/cohorts/${slug}/curriculum`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch curriculum');
    }
    return res.json();
}
// FIR-53 — Fetch a single lesson
export async function fetchLesson(slug, lessonId) {
    const res = await authFetch(`${BASE}/student/cohorts/${slug}/lessons/${lessonId}`);
    if (res.status === 403)
        throw new Error('LESSON_LOCKED');
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch lesson');
    }
    return res.json();
}
// FIR-53 — Mark a lesson as complete
export async function markLessonComplete(lessonId) {
    const res = await authFetch(`${BASE}/student/lessons/${lessonId}/complete`, {
        method: 'POST',
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to mark lesson complete');
    }
    return res.json();
}
// FIR-57 — Fetch live sessions for a cohort
export async function fetchLiveSessions(slug) {
    const res = await authFetch(`${BASE}/student/cohorts/${slug}/live-sessions`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch live sessions');
    }
    return res.json();
}
// FIR-58 — Fetch student certificates
export async function fetchStudentCertificates() {
    const res = await authFetch(`${BASE}/student/certificates`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch certificates');
    }
    return res.json();
}
// FIR-165 — Fetch admin course list
export async function fetchAdminCourses(q, page = 1) {
    const params = new URLSearchParams();
    if (q)
        params.set('q', q);
    params.set('page', String(page));
    const res = await authFetch(`${BASE}/admin/courses?${params.toString()}`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch courses');
    }
    return res.json();
}
// Fetch the modules for a cohort (via the admin course detail endpoint).
// The detail payload includes lesson counts, which we surface as lessonCount
// so the UI can render the "N lessons" pill without fetching every module's
// lessons up-front.
export async function fetchAdminCourseModules(cohortId) {
    const res = await authFetch(`${BASE}/admin/courses/${cohortId}`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch course modules');
    }
    const json = (await res.json());
    const modules = json.modules ?? [];
    return modules
        .map((m) => ({
        id: m.id,
        title: m.title,
        order: m.order,
        lessonCount: m.lessonCount ?? (Array.isArray(m.lessons) ? m.lessons.length : 0),
    }))
        .sort((a, b) => a.order - b.order);
}
export async function fetchAdminModuleLessons(cohortId, moduleId) {
    const res = await authFetch(`${BASE}/admin/courses/${cohortId}/modules/${moduleId}/lessons`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch lessons');
    }
    const json = (await res.json());
    const lessons = json.lessons ?? [];
    return [...lessons].sort((a, b) => a.order - b.order);
}
export async function reorderModules(cohortId, items) {
    const res = await authFetch(`${BASE}/admin/courses/${cohortId}/modules/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Endpoint accepts a bare array per Wave 3 Story P contract.
        body: JSON.stringify(items),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to reorder modules');
    }
    return res.json();
}
export async function reorderLessons(cohortId, moduleId, items) {
    const res = await authFetch(`${BASE}/admin/courses/${cohortId}/modules/${moduleId}/lessons/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to reorder lessons');
    }
    return res.json();
}
// FIR-165 — Fetch screenshot submission queue
export async function fetchScreenshotSubmissions(status, page = 1) {
    const params = new URLSearchParams();
    if (status)
        params.set('status', status);
    params.set('page', String(page));
    const res = await authFetch(`/api/admin/submissions?${params.toString()}`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch submissions');
    }
    return res.json();
}
// FIR-165 — Approve a screenshot submission
export async function approveSubmission(id) {
    const res = await authFetch(`/api/admin/submissions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to approve submission');
    }
    return res.json();
}
// FIR-165 — Reject a screenshot submission with reason
export async function rejectSubmission(id, reason) {
    const res = await authFetch(`/api/admin/submissions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to reject submission');
    }
    return res.json();
}
// FIR-165 — Escalate a submission to human review
export async function escalateSubmission(id) {
    const res = await authFetch(`/api/admin/submissions/${id}/human-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to escalate submission');
    }
    return res.json();
}
// FIR-166 — Fetch paginated admin enrollment/student list
export async function fetchAdminStudents(params) {
    const qs = new URLSearchParams();
    if (params?.q)
        qs.set('q', params.q);
    if (params?.status)
        qs.set('status', params.status);
    qs.set('page', String(params?.page ?? 1));
    qs.set('limit', String(params?.limit ?? 20));
    const res = await authFetch(`${BASE}/admin/enrollments?${qs.toString()}`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch students');
    }
    return res.json();
}
// FIR-166 — Update enrollment status (suspend / revoke / reinstate)
export async function updateEnrollmentStatus(id, status, reason) {
    const res = await authFetch(`${BASE}/admin/enrollments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to update enrollment status');
    }
    return res.json();
}
// FIR-173 — Fetch sub-admin list
export async function fetchSubAdmins() {
    const res = await authFetch(`/api/admin/sub-admins`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch sub-admins');
    }
    return res.json();
}
// FIR-173 — Invite a new sub-admin
export async function inviteSubAdmin(data) {
    const res = await authFetch(`/api/admin/sub-admins/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to invite sub-admin');
    }
    return res.json();
}
// FIR-173 — Update sub-admin permissions
export async function updateSubAdminPermissions(id, permissions) {
    const res = await authFetch(`/api/admin/sub-admins/${id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to update permissions');
    }
    return res.json();
}
// FIR-173 — Deactivate a sub-admin
export async function deactivateSubAdmin(id) {
    const res = await authFetch(`/api/admin/sub-admins/${id}/deactivate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to deactivate sub-admin');
    }
    return res.json();
}
// FIR-169 — Fetch student notifications
export async function fetchNotifications() {
    const res = await authFetch(`${BASE}/student/notifications`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch notifications');
    }
    return res.json();
}
// FIR-169 — Mark a single notification as read
export async function markNotificationRead(id) {
    const res = await authFetch(`${BASE}/student/notifications/${id}/read`, {
        method: 'POST',
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to mark notification read');
    }
    return res.json();
}
// FIR-169 — Mark all notifications as read
export async function markAllNotificationsRead() {
    const res = await authFetch(`${BASE}/student/notifications/read-all`, {
        method: 'POST',
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to mark all notifications read');
    }
    return res.json();
}
// FIR-171 — Fetch student notification preferences
export async function fetchNotificationPreferences() {
    const res = await authFetch(`${BASE}/student/settings/notifications`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch notification preferences');
    }
    return res.json();
}
// FIR-171 — Update student notification preferences
export async function updateNotificationPreferences(notifications) {
    const res = await authFetch(`${BASE}/student/settings/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to update notification preferences');
    }
    return res.json();
}
// Fetch student profile (name, email, avatar, etc.)
export async function fetchStudentProfile() {
    const res = await authFetch('/api/student/profile');
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch profile');
    }
    return res.json();
}
// Update student name
export async function updateStudentProfile(data) {
    const res = await authFetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to update profile');
    }
    return res.json();
}
// Change password
export async function changeStudentPassword(data) {
    const res = await authFetch('/api/student/profile/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to change password');
    }
}
// Fetch all badges with earned status for the logged-in student
export async function fetchStudentBadges() {
    const res = await authFetch('/api/student/badges');
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch badges');
    }
    return res.json();
}
// FIR-167 — Fetch admin cohorts for audience selector
export async function fetchAdminCohortsList() {
    const res = await authFetch(`${BASE}/admin/cohorts/list`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch cohorts');
    }
    return res.json();
}
// FIR-167 — Send broadcast email
export async function sendBroadcastEmail(data) {
    const res = await authFetch(`${BASE}/admin/broadcast-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to send broadcast email');
    }
    return res.json();
}
// FIR-167 — Fetch email logs
export async function fetchEmailLogs(page = 1) {
    const res = await authFetch(`${BASE}/admin/email-logs?page=${page}`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch email logs');
    }
    return res.json();
}
// FIR-76 — Revenue analytics
export async function fetchRevenueAnalytics(params) {
    const qs = new URLSearchParams();
    if (params?.from)
        qs.set('from', params.from);
    if (params?.to)
        qs.set('to', params.to);
    const res = await authFetch(`${BASE}/admin/analytics/revenue?${qs.toString()}`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch revenue analytics');
    }
    return res.json();
}
// FIR-77 — Enrollment analytics
export async function fetchEnrollmentAnalytics(cohortId) {
    const qs = new URLSearchParams();
    if (cohortId)
        qs.set('cohortId', cohortId);
    const res = await authFetch(`${BASE}/admin/analytics/enrollments?${qs.toString()}`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch enrollment analytics');
    }
    return res.json();
}
// FIR-78 — Payments analytics (paginated + filterable)
export async function fetchPaymentsAnalytics(params) {
    const qs = new URLSearchParams();
    if (params?.from)
        qs.set('from', params.from);
    if (params?.to)
        qs.set('to', params.to);
    if (params?.cohortId)
        qs.set('cohortId', params.cohortId);
    if (params?.method)
        qs.set('method', params.method);
    qs.set('page', String(params?.page ?? 1));
    const res = await authFetch(`${BASE}/admin/analytics/payments?${qs.toString()}`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch payments analytics');
    }
    return res.json();
}
// FIR-79 — Cohort performance analytics
export async function fetchCohortPerformance() {
    const res = await authFetch(`${BASE}/admin/analytics/cohort-performance`);
    if (!res.ok) {
        const body = (await res.json().catch(() => ({})));
        throw new Error(body.message ?? 'Failed to fetch cohort performance');
    }
    return res.json();
}
