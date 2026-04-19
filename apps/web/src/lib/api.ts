// API client for nextaibuilder storefront
// FIR-34 / FIR-35 / FIR-36 / FIR-155 / FIR-156 — Auth API calls added

const BASE = '/api/v1'
const AUTH_BASE = '/api/auth'

// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN'
  avatarUrl?: string
}

export interface AuthResponse {
  accessToken: string
  user: AuthUser
}

export interface AdminLoginResponse {
  twoFactorRequired: true
  preAuthToken: string
}

// ---------------------------------------------------------------------------
// authFetch — attaches Bearer token, retries once on 401 via refreshToken
// ---------------------------------------------------------------------------

// This is set by the AuthProvider after boot; avoids a circular import.
let _getToken: (() => string | null) | null = null
let _refreshToken: (() => Promise<boolean>) | null = null

// Singleton refresh promise — prevents concurrent 401s from firing multiple
// refresh requests and racing each other (the second attempt would fail if
// the server uses single-use token rotation).
let _refreshPromise: Promise<boolean> | null = null

function refreshOnce(): Promise<boolean> {
  if (!_refreshPromise) {
    _refreshPromise = _refreshToken!().finally(() => {
      _refreshPromise = null
    })
  }
  return _refreshPromise
}

export function registerAuthHelpers(
  getToken: () => string | null,
  refreshFn: () => Promise<boolean>,
) {
  _getToken = getToken
  _refreshToken = refreshFn
}

export async function authFetch(
  input: RequestInfo,
  init: RequestInit = {},
): Promise<Response> {
  const token = _getToken?.() ?? null

  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(input, { ...init, headers, credentials: 'include' })

  if (res.status === 401 && _refreshToken) {
    const refreshed = await refreshOnce()
    if (refreshed) {
      const newToken = _getToken?.() ?? null
      if (newToken) headers.set('Authorization', `Bearer ${newToken}`)
      return fetch(input, { ...init, headers, credentials: 'include' })
    }
  }

  return res
}

// ---------------------------------------------------------------------------
// Auth API calls — FIR-155 (OAuth), FIR-35 (admin login), FIR-156 (OTP)
// ---------------------------------------------------------------------------

// ── Student email/password auth ──────────────────────────────────────────

export async function registerStudent(data: {
  email: string
  password: string
  firstName: string
  lastName: string
}): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_BASE}/student/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message ?? 'Registration failed')
  return json as AuthResponse
}

export async function loginStudent(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_BASE}/student/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message ?? 'Login failed')
  return json as AuthResponse
}

// ── OAuth ────────────────────────────────────────────────────────────────

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_BASE}/oauth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  })
  if (!res.ok) throw new Error('Google login failed')
  return res.json() as Promise<AuthResponse>
}

export async function loginWithApple(
  idToken: string,
  userData?: { name?: { firstName?: string; lastName?: string } },
): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_BASE}/oauth/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken, user: userData }),
  })
  if (!res.ok) throw new Error('Apple login failed')
  return res.json() as Promise<AuthResponse>
}

export async function adminLogin(
  email: string,
  password: string,
): Promise<AuthResponse | AdminLoginResponse> {
  const res = await fetch(`${AUTH_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Invalid email or password')
  }
  return res.json() as Promise<AuthResponse | AdminLoginResponse>
}

export async function adminVerifyOtp(
  preAuthToken: string,
  code: string,
): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_BASE}/admin/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ preAuthToken, code }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Invalid or expired code')
  }
  return res.json() as Promise<AuthResponse>
}

export async function adminResendOtp(preAuthToken: string): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/admin/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ preAuthToken }),
  })
  if (!res.ok) throw new Error('Failed to resend code')
}

export async function adminForgotPassword(email: string): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/admin/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error('Failed to send reset email')
}

export async function adminResetPassword(
  token: string,
  password: string,
  confirmPassword: string,
): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/admin/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password, confirmPassword }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to reset password')
  }
}

export async function logoutUser(): Promise<void> {
  await fetch(`${AUTH_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await authFetch(`${AUTH_BASE}/me`)
  if (!res.ok) throw new Error('Not authenticated')
  return res.json() as Promise<AuthUser>
}

export interface CohortSummary {
  id: string
  slug: string
  title: string
  tagline: string
  type: 'recorded' | 'live' | 'combined'
  price: number
  installmentPrice?: number
  installmentCount?: number
  coverGradient?: string
  meta: string
  soldOut?: boolean
  published: boolean
}

export interface CohortLesson {
  id: string
  title: string
  type: 'VIDEO' | 'TEXT' | 'TOOL_SETUP'
  order: number
  estimatedMinutes: number
  freePreview: boolean
}

export interface CohortModule {
  id: string
  title: string
  lessonCount: number
  freePreviewCount: number
  lessons: CohortLesson[]
}

export interface PreviewLesson {
  id: string
  moduleId: string
  moduleTitle: string
  title: string
  type: 'VIDEO' | 'TEXT' | 'TOOL_SETUP'
  order: number
  estimatedMinutes: number
  loomUrl?: string | null
  content?: string | null
}

export interface CohortDetail extends CohortSummary {
  description: string
  lessonCount: number
  hoursOfContent: number
  startDate?: string
  seatsRemaining?: number
  enrolledCount?: number
  modules: CohortModule[]
  includes: string[]
  instructorName: string
  instructorTitle: string
  instructorBio: string
  liveSessions?: Array<{
    id: string
    title: string
    date: string
    status: 'upcoming' | 'completed'
  }>
}

export async function fetchCohorts(): Promise<CohortSummary[]> {
  const res = await fetch(`${BASE}/storefront/cohorts`)
  if (!res.ok) throw new Error('Failed to fetch cohorts')
  return res.json()
}

export async function fetchCohortBySlug(slug: string): Promise<CohortDetail | null> {
  const res = await fetch(`${BASE}/storefront/cohorts/${slug}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch cohort')
  return res.json()
}

export async function fetchPreviewLessons(slug: string): Promise<PreviewLesson[]> {
  const res = await fetch(`${BASE}/storefront/cohorts/${slug}/preview-lessons`)
  if (!res.ok) return []
  return res.json()
}

// ---------------------------------------------------------------------------
// Checkout API — FIR-157
// ---------------------------------------------------------------------------

export interface OneTimeCheckoutResponse {
  clientSecret: string
  paymentIntentId: string
  amount: number
  currency: string
}

export interface InstallmentCheckoutResponse {
  clientSecret: string
  subscriptionId: string
  installmentAmount: number
  totalAmount: number
  currency: string
}

export interface ManualPaymentResponse {
  requestId: string
  status: 'PENDING'
}

export async function createOneTimeCheckout(
  cohortId: string,
  paymentPlanId: string,
): Promise<OneTimeCheckoutResponse> {
  const res = await authFetch(`${BASE}/student/checkout/one-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cohortId, paymentPlanId }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to create checkout session')
  }
  return res.json() as Promise<OneTimeCheckoutResponse>
}

export async function createInstallmentCheckout(
  cohortId: string,
  paymentPlanId: string,
): Promise<InstallmentCheckoutResponse> {
  const res = await authFetch(`${BASE}/student/checkout/installment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cohortId, paymentPlanId }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to create installment checkout')
  }
  return res.json() as Promise<InstallmentCheckoutResponse>
}

export async function submitManualPayment(
  formData: FormData,
): Promise<ManualPaymentResponse> {
  const res = await authFetch(`${BASE}/student/manual-payment`, {
    method: 'POST',
    body: formData,
    // No Content-Type header — browser must set multipart boundary automatically
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to submit payment receipt')
  }
  return res.json() as Promise<ManualPaymentResponse>
}

// ---------------------------------------------------------------------------
// Manual Payment API — FIR-46 (student), FIR-47/48/49 (admin)
// ---------------------------------------------------------------------------

export interface ManualPaymentRequestResponse {
  requestId: string
  status: 'PENDING'
  message: string
}

export interface ManualPaymentRequest {
  id: string
  student: {
    name: string
    email: string
    avatarUrl?: string
  }
  cohort: {
    name: string
    slug: string
  }
  receiptUrl: string
  note?: string
  amount?: number
  createdAt: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string
}

export interface ManualPaymentsListResponse {
  requests: ManualPaymentRequest[]
  total: number
  page: number
  limit: number
}

// FIR-46 — Student: submit manual payment request with receipt upload
export async function submitManualPaymentRequest(
  formData: FormData,
): Promise<ManualPaymentRequestResponse> {
  const res = await authFetch(`${BASE}/student/manual-payment/request`, {
    method: 'POST',
    body: formData,
    // No Content-Type — browser sets multipart boundary automatically
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to submit payment receipt')
  }
  return res.json() as Promise<ManualPaymentRequestResponse>
}

// FIR-47 — Admin: list manual payment requests with optional status filter + pagination
export async function fetchManualPayments(
  status?: string,
  page = 1,
): Promise<ManualPaymentsListResponse> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  params.set('page', String(page))
  const res = await authFetch(`${BASE}/admin/manual-payments?${params.toString()}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch manual payments')
  }
  return res.json() as Promise<ManualPaymentsListResponse>
}

// FIR-48 — Admin: approve a manual payment request
export async function approveManualPayment(
  id: string,
  note?: string,
): Promise<{ success: true; enrollmentId: string }> {
  const res = await authFetch(`${BASE}/admin/manual-payments/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to approve payment')
  }
  return res.json() as Promise<{ success: true; enrollmentId: string }>
}

// FIR-49 — Admin: reject a manual payment request
export async function rejectManualPayment(
  id: string,
  reason: string,
): Promise<{ success: true }> {
  const res = await authFetch(`${BASE}/admin/manual-payments/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to reject payment')
  }
  return res.json() as Promise<{ success: true }>
}

// ---------------------------------------------------------------------------
// Student LMS API — Epic 6 (FIR-51/52/53/57/58/160/161/164)
// ---------------------------------------------------------------------------

export interface Installment {
  id: string
  dueDate: string
  amount: number
  status: 'PAID' | 'DUE' | 'OVERDUE'
  paidAt?: string
}

export interface EnrollmentSummary {
  id: string
  cohort: {
    title: string
    slug: string
    type: 'recorded' | 'live' | 'combined'
    coverImageKey?: string
  }
  completionPercentage: number
  lessonsCompleted: number
  totalLessons: number
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' | 'FAILED'
  status: 'ACTIVE' | 'COMPLETED' | 'SUSPENDED'
  installments?: Installment[]
  lastActivityAt?: string
  nextLessonTitle?: string
  nextLiveSession?: string
}

export interface StudentDashboardResponse {
  enrollments: EnrollmentSummary[]
}

export interface LessonSummary {
  id: string
  title: string
  type: 'VIDEO' | 'TEXT' | 'TOOL_SETUP'
  estimatedMinutes: number
  status: 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED'
}

export interface CurriculumModule {
  id: string
  title: string
  order: number
  lessons: LessonSummary[]
}

export interface CurriculumResponse {
  cohort: { title: string; slug: string }
  completionPercentage: number
  lessonsCompleted: number
  totalLessons: number
  modules: CurriculumModule[]
}

export interface LessonDetail {
  id: string
  title: string
  type: 'VIDEO' | 'TEXT' | 'TOOL_SETUP'
  loomUrl?: string
  embedUrl?: string
  content?: string
  estimatedMinutes: number
}

export interface LessonResponse {
  lesson: LessonDetail
  prevLesson?: { id: string; title: string }
  nextLesson?: { id: string; title: string }
  moduleTitle?: string
}

export interface MarkCompleteResponse {
  success: true
  completionPercentage: number
  lessonsCompleted: number
}

export interface LiveSession {
  id: string
  title: string
  description?: string
  scheduledAt: string
  durationMinutes: number
  zoomUrl?: string
  recordingUrl?: string
  status: 'LIVE' | 'UPCOMING' | 'PAST'
}

export interface LiveSessionsResponse {
  sessions: LiveSession[]
}

export interface StudentCertificate {
  id: string
  credentialId: string
  cohortTitle: string
  cohortType: string
  issuedAt: string
  lessonsCompleted: number
  totalLessons: number
  instructorName: string
}

export interface CertificatesResponse {
  certificates: StudentCertificate[]
}

// FIR-51 — Fetch student dashboard data
export async function fetchStudentDashboard(): Promise<StudentDashboardResponse> {
  const res = await authFetch(`${BASE}/student/dashboard`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch dashboard')
  }
  return res.json() as Promise<StudentDashboardResponse>
}

// FIR-52 — Fetch curriculum for a cohort slug
export async function fetchCurriculum(slug: string): Promise<CurriculumResponse> {
  const res = await authFetch(`${BASE}/student/cohorts/${slug}/curriculum`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch curriculum')
  }
  return res.json() as Promise<CurriculumResponse>
}

// FIR-53 — Fetch a single lesson
export async function fetchLesson(slug: string, lessonId: string): Promise<LessonResponse> {
  const res = await authFetch(`${BASE}/student/cohorts/${slug}/lessons/${lessonId}`)
  if (res.status === 403) throw new Error('LESSON_LOCKED')
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch lesson')
  }
  return res.json() as Promise<LessonResponse>
}

// FIR-53 — Mark a lesson as complete
export async function markLessonComplete(lessonId: string): Promise<MarkCompleteResponse> {
  const res = await authFetch(`${BASE}/student/lessons/${lessonId}/complete`, {
    method: 'POST',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to mark lesson complete')
  }
  return res.json() as Promise<MarkCompleteResponse>
}

// FIR-57 — Fetch live sessions for a cohort
export async function fetchLiveSessions(slug: string): Promise<LiveSessionsResponse> {
  const res = await authFetch(`${BASE}/student/cohorts/${slug}/live-sessions`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch live sessions')
  }
  return res.json() as Promise<LiveSessionsResponse>
}

// FIR-58 — Fetch student certificates
export async function fetchStudentCertificates(): Promise<CertificatesResponse> {
  const res = await authFetch(`${BASE}/student/certificates`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch certificates')
  }
  return res.json() as Promise<CertificatesResponse>
}

// ---------------------------------------------------------------------------
// Admin CMS API — Epic 7 (FIR-165 / FIR-166 / FIR-173)
// ---------------------------------------------------------------------------

// ---- Courses ----

export interface AdminCourse {
  id: string
  title: string
  slug: string
  tagline?: string
  description?: string
  type: 'recorded' | 'live' | 'combined'
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  enrollmentCount: number
  lessonCount: number
  startDate?: string
  endDate?: string
  maxSeats?: number
  coverImageKey?: string
  createdAt: string
}

export interface AdminCoursesResponse {
  courses: AdminCourse[]
  total: number
  page: number
  limit: number
}

export interface AdminCourseModule {
  id: string
  title: string
  order: number
  lessons: Array<{
    id: string
    title: string
    type: 'VIDEO' | 'TEXT' | 'TOOL_SETUP'
    estimatedMinutes: number
    published: boolean
  }>
}

// FIR-165 — Fetch admin course list
export async function fetchAdminCourses(
  q?: string,
  page = 1,
): Promise<AdminCoursesResponse> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  params.set('page', String(page))
  const res = await authFetch(`${BASE}/admin/courses?${params.toString()}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch courses')
  }
  return res.json() as Promise<AdminCoursesResponse>
}

// ---- Wave 5 Story Y — Admin curriculum reorder (modules + lessons) ----

export interface AdminModule {
  id: string
  title: string
  order: number
  lessonCount?: number
}

export interface AdminLesson {
  id: string
  title: string
  order: number
  type: 'VIDEO' | 'TEXT' | 'TOOL_SETUP'
  estimatedMinutes: number
  published: boolean
}

export interface ReorderResponse {
  updated: number
}

// Fetch the modules for a cohort (via the admin course detail endpoint).
// The detail payload includes lesson counts, which we surface as lessonCount
// so the UI can render the "N lessons" pill without fetching every module's
// lessons up-front.
export async function fetchAdminCourseModules(
  cohortId: string,
): Promise<AdminModule[]> {
  const res = await authFetch(`${BASE}/admin/courses/${cohortId}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch course modules')
  }
  const json = (await res.json()) as {
    modules?: Array<{
      id: string
      title: string
      order: number
      lessonCount?: number
      lessons?: unknown[]
    }>
  }
  const modules = json.modules ?? []
  return modules
    .map((m) => ({
      id: m.id,
      title: m.title,
      order: m.order,
      lessonCount: m.lessonCount ?? (Array.isArray(m.lessons) ? m.lessons.length : 0),
    }))
    .sort((a, b) => a.order - b.order)
}

export async function fetchAdminModuleLessons(
  cohortId: string,
  moduleId: string,
): Promise<AdminLesson[]> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/modules/${moduleId}/lessons`,
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch lessons')
  }
  const json = (await res.json()) as { lessons?: AdminLesson[] }
  const lessons = json.lessons ?? []
  return [...lessons].sort((a, b) => a.order - b.order)
}

export async function reorderModules(
  cohortId: string,
  items: Array<{ id: string; order: number }>,
): Promise<ReorderResponse> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/modules/reorder`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // Endpoint accepts a bare array per Wave 3 Story P contract.
      body: JSON.stringify(items),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to reorder modules')
  }
  return res.json() as Promise<ReorderResponse>
}

export async function reorderLessons(
  cohortId: string,
  moduleId: string,
  items: Array<{ id: string; order: number }>,
): Promise<ReorderResponse> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/modules/${moduleId}/lessons/reorder`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to reorder lessons')
  }
  return res.json() as Promise<ReorderResponse>
}

// ---- Screenshot submissions ----

export interface ScreenshotSubmission {
  id: string
  student: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
  step: string
  cohort: string
  screenshotUrl: string
  claudeConfidence: number
  claudeReasoning: string
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'HUMAN_REVIEW'
  createdAt: string
  rejectionReason?: string
}

export interface ScreenshotSubmissionsResponse {
  submissions: ScreenshotSubmission[]
  total: number
}

// FIR-165 — Fetch screenshot submission queue
export async function fetchScreenshotSubmissions(
  status?: string,
  page = 1,
): Promise<ScreenshotSubmissionsResponse> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  params.set('page', String(page))
  const res = await authFetch(`/api/admin/submissions?${params.toString()}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch submissions')
  }
  return res.json() as Promise<ScreenshotSubmissionsResponse>
}

// FIR-165 — Approve a screenshot submission
export async function approveSubmission(id: string): Promise<{ success: true }> {
  const res = await authFetch(`/api/admin/submissions/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to approve submission')
  }
  return res.json() as Promise<{ success: true }>
}

// FIR-165 — Reject a screenshot submission with reason
export async function rejectSubmission(
  id: string,
  reason: string,
): Promise<{ success: true }> {
  const res = await authFetch(`/api/admin/submissions/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to reject submission')
  }
  return res.json() as Promise<{ success: true }>
}

// FIR-165 — Escalate a submission to human review
export async function escalateSubmission(id: string): Promise<{ success: true }> {
  const res = await authFetch(`/api/admin/submissions/${id}/human-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to escalate submission')
  }
  return res.json() as Promise<{ success: true }>
}

// ---- Student list ----

export interface AdminEnrollment {
  id: string
  student: {
    id: string
    name: string
    email: string
    avatarUrl?: string
    joinedAt: string
  }
  cohort: {
    id: string
    title: string
    slug: string
  }
  progress: number
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' | 'FAILED'
  status: 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'REVOKED'
  paymentType?: string
  enrolledAt: string
  lastActiveAt?: string
  installments?: Array<{
    id: string
    dueDate: string
    amount: number
    status: 'PAID' | 'DUE' | 'OVERDUE'
    paidAt?: string
  }>
}

export interface AdminEnrollmentsResponse {
  enrollments: AdminEnrollment[]
  total: number
  page: number
  limit: number
}

// FIR-166 — Fetch paginated admin enrollment/student list
export async function fetchAdminStudents(params?: {
  q?: string
  status?: string
  page?: number
  limit?: number
}): Promise<AdminEnrollmentsResponse> {
  const qs = new URLSearchParams()
  if (params?.q) qs.set('q', params.q)
  if (params?.status) qs.set('status', params.status)
  qs.set('page', String(params?.page ?? 1))
  qs.set('limit', String(params?.limit ?? 20))
  const res = await authFetch(`${BASE}/admin/enrollments?${qs.toString()}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch students')
  }
  return res.json() as Promise<AdminEnrollmentsResponse>
}

// FIR-166 — Update enrollment status (suspend / revoke / reinstate)
export async function updateEnrollmentStatus(
  id: string,
  status: string,
  reason?: string,
): Promise<{ success: true }> {
  const res = await authFetch(`${BASE}/admin/enrollments/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reason }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to update enrollment status')
  }
  return res.json() as Promise<{ success: true }>
}

// ---- Sub-admin management ----

export type SubAdminPermission =
  | 'courses:read'
  | 'courses:write'
  | 'enrollments:read'
  | 'enrollments:write'
  | 'payments:read'
  | 'payments:write'
  | 'students:read'
  | 'students:write'
  | 'submissions:read'
  | 'submissions:write'
  | 'messages:read'
  | 'messages:write'
  | 'reports:read'
  | 'settings:read'
  | 'settings:write'

export interface SubAdmin {
  id: string
  name: string
  email: string
  avatarUrl?: string
  permissions: SubAdminPermission[]
  status: 'ACTIVE' | 'INVITED' | 'INACTIVE'
  lastActiveAt?: string
  createdAt: string
}

export interface SubAdminsResponse {
  subAdmins: SubAdmin[]
}

// FIR-173 — Fetch sub-admin list
export async function fetchSubAdmins(): Promise<SubAdminsResponse> {
  const res = await authFetch(`/api/admin/sub-admins`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch sub-admins')
  }
  return res.json() as Promise<SubAdminsResponse>
}

// FIR-173 — Invite a new sub-admin
export async function inviteSubAdmin(data: {
  email: string
  name: string
  permissions: SubAdminPermission[]
}): Promise<{ success: true; id: string }> {
  const res = await authFetch(`/api/admin/sub-admins/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to invite sub-admin')
  }
  return res.json() as Promise<{ success: true; id: string }>
}

// FIR-173 — Update sub-admin permissions
export async function updateSubAdminPermissions(
  id: string,
  permissions: SubAdminPermission[],
): Promise<{ success: true }> {
  const res = await authFetch(`/api/admin/sub-admins/${id}/permissions`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to update permissions')
  }
  return res.json() as Promise<{ success: true }>
}

// FIR-173 — Deactivate a sub-admin
export async function deactivateSubAdmin(id: string): Promise<{ success: true }> {
  const res = await authFetch(`/api/admin/sub-admins/${id}/deactivate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to deactivate sub-admin')
  }
  return res.json() as Promise<{ success: true }>
}

// ---------------------------------------------------------------------------
// Notifications API — FIR-169
// ---------------------------------------------------------------------------

export interface Notification {
  _id: string
  type: 'enrollment_confirmed' | 'payment_approved' | 're_engagement' | 'broadcast' | string
  title: string
  body: string
  isRead: boolean
  createdAt: string
  link?: string
}

export interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
}

// FIR-169 — Fetch student notifications
export async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await authFetch(`${BASE}/student/notifications`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch notifications')
  }
  return res.json() as Promise<NotificationsResponse>
}

// FIR-169 — Mark a single notification as read
export async function markNotificationRead(id: string): Promise<{ success: true }> {
  const res = await authFetch(`${BASE}/student/notifications/${id}/read`, {
    method: 'POST',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to mark notification read')
  }
  return res.json() as Promise<{ success: true }>
}

// FIR-169 — Mark all notifications as read
export async function markAllNotificationsRead(): Promise<{ success: true }> {
  const res = await authFetch(`${BASE}/student/notifications/read-all`, {
    method: 'POST',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to mark all notifications read')
  }
  return res.json() as Promise<{ success: true }>
}

// ---------------------------------------------------------------------------
// Student Settings API — FIR-171
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  emailEnrollment: boolean
  emailPayments: boolean
  emailReminders: boolean
  emailBroadcast: boolean
}

export interface NotificationPreferencesResponse {
  notifications: NotificationPreferences
}

// FIR-171 — Fetch student notification preferences
export async function fetchNotificationPreferences(): Promise<NotificationPreferencesResponse> {
  const res = await authFetch(`${BASE}/student/settings/notifications`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch notification preferences')
  }
  return res.json() as Promise<NotificationPreferencesResponse>
}

// FIR-171 — Update student notification preferences
export async function updateNotificationPreferences(
  notifications: NotificationPreferences,
): Promise<{ success: true }> {
  const res = await authFetch(`${BASE}/student/settings/notifications`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notifications }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to update notification preferences')
  }
  return res.json() as Promise<{ success: true }>
}

// ---------------------------------------------------------------------------
// Student Profile API — FIR-171
// ---------------------------------------------------------------------------

export interface StudentProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string | null
  hasPassword: boolean
  oauthProvider?: string | null
}

// Fetch student profile (name, email, avatar, etc.)
export async function fetchStudentProfile(): Promise<StudentProfile> {
  const res = await authFetch('/api/student/profile')
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch profile')
  }
  return res.json() as Promise<StudentProfile>
}

// Update student name
export async function updateStudentProfile(data: {
  firstName: string
  lastName: string
}): Promise<{ firstName: string; lastName: string; avatarUrl?: string | null }> {
  const res = await authFetch('/api/student/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to update profile')
  }
  return res.json() as Promise<{ firstName: string; lastName: string; avatarUrl?: string | null }>
}

// Change password
export async function changeStudentPassword(data: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}): Promise<void> {
  const res = await authFetch('/api/student/profile/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to change password')
  }
}

// ---------------------------------------------------------------------------
// Student Badges API
// ---------------------------------------------------------------------------

export interface StudentBadge {
  id: string
  name: string
  description: string
  iconUrl?: string | null
  earned: boolean
  earnedAt?: string | null
}

export interface BadgesResponse {
  badges: StudentBadge[]
}

// Fetch all badges with earned status for the logged-in student
export async function fetchStudentBadges(): Promise<BadgesResponse> {
  const res = await authFetch('/api/student/badges')
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch badges')
  }
  return res.json() as Promise<BadgesResponse>
}

// ---------------------------------------------------------------------------
// Admin Broadcast Email API — FIR-167
// ---------------------------------------------------------------------------

export interface EmailLog {
  id: string
  target: string
  subject: string
  sentAt: string
  recipientCount: number
}

export interface EmailLogsResponse {
  logs: EmailLog[]
  total: number
}

export interface AdminCohortsListResponse {
  cohorts: Array<{ id: string; title: string }>
}

// FIR-167 — Fetch admin cohorts for audience selector
export async function fetchAdminCohortsList(): Promise<AdminCohortsListResponse> {
  const res = await authFetch(`${BASE}/admin/cohorts/list`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch cohorts')
  }
  return res.json() as Promise<AdminCohortsListResponse>
}

// FIR-167 — Send broadcast email
export async function sendBroadcastEmail(data: {
  target: 'all' | string
  subject: string
  body: string
}): Promise<{ success: true; recipientCount: number }> {
  const res = await authFetch(`${BASE}/admin/broadcast-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to send broadcast email')
  }
  return res.json() as Promise<{ success: true; recipientCount: number }>
}

// FIR-167 — Fetch email logs
export async function fetchEmailLogs(page = 1): Promise<EmailLogsResponse> {
  const res = await authFetch(`${BASE}/admin/email-logs?page=${page}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch email logs')
  }
  return res.json() as Promise<EmailLogsResponse>
}

// ---------------------------------------------------------------------------
// Admin Analytics API — FIR-76/77/78/79/174
// ---------------------------------------------------------------------------

export interface RevenueAnalytics {
  totalRevenue: number
  mrr: number
  cohortCount: number
  byCohort: Array<{ cohortTitle: string; revenue: number }>
}

export interface EnrollmentAnalytics {
  total: number
  active: number
  pending: number
  cancelled: number
  byCohort: Array<{ cohortTitle: string; active: number; pending: number }>
}

export interface PaymentRecord {
  id: string
  studentName: string
  studentEmail: string
  cohortTitle: string
  amount: number
  method: 'stripe' | 'manual'
  status: 'PAID' | 'PENDING' | 'FAILED' | 'REJECTED'
  date: string
}

export interface PaymentsAnalyticsResponse {
  payments: PaymentRecord[]
  total: number
  page: number
}

export interface CohortPerformance {
  cohortTitle: string
  totalEnrolled: number
  avgCompletionPct: number
  completedCount: number
}

export interface CohortPerformanceResponse {
  cohorts: CohortPerformance[]
}

// FIR-76 — Revenue analytics
export async function fetchRevenueAnalytics(params?: {
  from?: string
  to?: string
}): Promise<RevenueAnalytics> {
  const qs = new URLSearchParams()
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  const res = await authFetch(`${BASE}/admin/analytics/revenue?${qs.toString()}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch revenue analytics')
  }
  return res.json() as Promise<RevenueAnalytics>
}

// FIR-77 — Enrollment analytics
export async function fetchEnrollmentAnalytics(cohortId?: string): Promise<EnrollmentAnalytics> {
  const qs = new URLSearchParams()
  if (cohortId) qs.set('cohortId', cohortId)
  const res = await authFetch(`${BASE}/admin/analytics/enrollments?${qs.toString()}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch enrollment analytics')
  }
  return res.json() as Promise<EnrollmentAnalytics>
}

// FIR-78 — Payments analytics (paginated + filterable)
export async function fetchPaymentsAnalytics(params?: {
  from?: string
  to?: string
  cohortId?: string
  method?: string
  page?: number
}): Promise<PaymentsAnalyticsResponse> {
  const qs = new URLSearchParams()
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  if (params?.cohortId) qs.set('cohortId', params.cohortId)
  if (params?.method) qs.set('method', params.method)
  qs.set('page', String(params?.page ?? 1))
  const res = await authFetch(`${BASE}/admin/analytics/payments?${qs.toString()}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch payments analytics')
  }
  return res.json() as Promise<PaymentsAnalyticsResponse>
}

// FIR-79 — Cohort performance analytics
export async function fetchCohortPerformance(): Promise<CohortPerformanceResponse> {
  const res = await authFetch(`${BASE}/admin/analytics/cohort-performance`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch cohort performance')
  }
  return res.json() as Promise<CohortPerformanceResponse>
}
