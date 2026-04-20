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
  // NAB-P0-2 — surfaced on the list endpoint so card previews can render
  // "What you'll learn" bullets without fetching the full detail payload.
  learningOutcomes?: string[]
  requirements?: string[]
  targetAudience?: string[]
  // NAB-P0-3 — optional populated instructor summaries. Present on detail
  // responses that return the full instructor list; list-card endpoints omit.
  instructors?: InstructorSummary[]
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
  // NAB-P0-5 — Multi-provider video fields.
  videoProvider?: 'LOOM' | 'YOUTUBE' | 'VIMEO' | null
  videoUrl?: string | null
  /** @deprecated Use videoUrl + videoProvider instead. */
  loomUrl?: string | null
  content?: string | null
  // NAB-P0-4 — rich-text body; prefer this over `content` when present.
  richContent?: string | null
  contentFormat?: 'MARKDOWN' | 'RICH_HTML' | null
}

// NAB-P0-3 — Instructor profile types. The storefront consumes the rich
// instructor block; the admin builder works with a lighter summary.
export type InstructorSocialPlatform =
  | 'TWITTER'
  | 'LINKEDIN'
  | 'GITHUB'
  | 'YOUTUBE'
  | 'WEBSITE'
  | 'X'

export interface InstructorSocialLink {
  platform: InstructorSocialPlatform
  url: string
}

export interface InstructorProfile {
  id: string
  userId: string
  name: string
  title: string
  bio: string
  avatarKey: string | null
  socialLinks: InstructorSocialLink[]
  createdAt?: string
  updatedAt?: string
}

export interface InstructorSummary {
  id: string
  name: string
  title: string
  avatarKey?: string | null
  avatarUrl?: string | null
}

export interface StorefrontInstructor {
  id: string
  name: string
  title: string
  bio: string
  avatarUrl: string | null
  socialLinks: InstructorSocialLink[]
}

export interface CohortDetail extends CohortSummary {
  description: string
  lessonCount: number
  hoursOfContent: number
  startDate?: string
  seatsRemaining?: number
  enrolledCount?: number
  modules: CohortModule[]
  // NAB-P0-2 — `includes` is the legacy alias for `learningOutcomes`.
  // New code should consume `learningOutcomes` directly; `includes` is kept
  // for back-compat with surfaces that read it today.
  includes: string[]
  learningOutcomes: string[]
  requirements: string[]
  targetAudience: string[]
  // NAB-P0-3 — primary instructor populated from InstructorProfile.
  // `null` means no instructor is assigned; the storefront hides the card.
  instructor: StorefrontInstructor | null
  // Legacy flat fields — kept for callers that haven't migrated. New code
  // should read `instructor` above.
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

// Sprint 2 Story 10 (GAP-030) — Trusted cohort lookup by Mongo id.
// Returned payload is a narrow subset — EnrollmentSuccessPage renders the
// server-returned title rather than trusting a URL query param.
export interface CohortSummaryById {
  id: string
  title: string
  slug: string
}

export async function fetchCohortById(id: string): Promise<CohortSummaryById | null> {
  const res = await fetch(`${BASE}/storefront/cohorts/by-id/${encodeURIComponent(id)}`)
  if (res.status === 404 || res.status === 400) return null
  if (!res.ok) throw new Error('Failed to fetch cohort')
  return res.json() as Promise<CohortSummaryById>
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

// FIR-158 — Student: poll manual payment request status
export interface ManualPaymentStatusResponse {
  requestId: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string
  createdAt?: string
  reviewedAt?: string
}

export async function fetchManualPaymentStatus(
  requestId: string,
): Promise<ManualPaymentStatusResponse> {
  const res = await authFetch(`${BASE}/student/manual-payment/${requestId}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch payment status')
  }
  return res.json() as Promise<ManualPaymentStatusResponse>
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
  // NAB-P0-4 — rich HTML body; preferred over `content` when present.
  richContent?: string | null
  contentFormat?: 'MARKDOWN' | 'RICH_HTML' | null
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

// ---------------------------------------------------------------------------
// Sprint 2 Story 12 — Tool-setup screenshot validation (LMS adapter)
// Backend: apps/api/src/routes/student/lms.ts
// Worker:  apps/api/src/workers/screenshotValidationWorker.ts (Claude Vision)
// ---------------------------------------------------------------------------

export type ToolSetupValidationStatus =
  | 'VALIDATING'
  | 'APPROVED'
  | 'REJECTED'
  | 'UNDER_REVIEW'

export interface ToolSetupPresignResponse {
  presignedUrl: string
  s3Key: string
  contentType: string
}

export interface ToolSetupSubmitResponse {
  submissionId: string
  status: 'VALIDATING'
}

export interface ToolSetupLatestSubmission {
  id: string
  status: ToolSetupValidationStatus
  rawStatus: string
  mlFeedback: string | null
  mlScore: number | null
  screenshotUrl: string | null
  createdAt: string
  reviewedAt: string | null
}

export interface ToolSetupLatestResponse {
  submission: ToolSetupLatestSubmission | null
}

/**
 * Ask the API for a presigned PUT URL so the browser can upload the
 * screenshot binary directly to S3 (or to the local dev upload endpoint).
 */
export async function presignToolSetupUpload(
  lessonId: string,
  contentType: string,
): Promise<ToolSetupPresignResponse> {
  const res = await authFetch(
    `${BASE}/student/lessons/${lessonId}/tool-setup-submission/presign`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ contentType }),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to prepare upload')
  }
  return res.json() as Promise<ToolSetupPresignResponse>
}

/**
 * PUT the file bytes to the presigned URL. Presigned URLs are
 * self-authenticating, so no Bearer token is attached here.
 */
export async function uploadToolSetupScreenshot(
  presignedUrl: string,
  file: File,
): Promise<void> {
  const res = await fetch(presignedUrl, {
    method:  'PUT',
    headers: { 'Content-Type': file.type || 'image/png' },
    body:    file,
  })
  if (!res.ok) {
    throw new Error('Failed to upload screenshot')
  }
}

/**
 * Confirm the upload and enqueue the Claude Vision validation job. The
 * client then polls `fetchLatestToolSetupSubmission` until a terminal
 * status (APPROVED / REJECTED / UNDER_REVIEW) is reached.
 */
export async function submitToolSetupScreenshot(
  lessonId: string,
  s3Key: string,
): Promise<ToolSetupSubmitResponse> {
  const res = await authFetch(
    `${BASE}/student/lessons/${lessonId}/tool-setup-submission`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ s3Key }),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to submit screenshot')
  }
  return res.json() as Promise<ToolSetupSubmitResponse>
}

/**
 * Poll endpoint — returns the most recent submission for the given lesson,
 * or `{ submission: null }` when the student has never submitted.
 */
export async function fetchLatestToolSetupSubmission(
  lessonId: string,
): Promise<ToolSetupLatestResponse> {
  const res = await authFetch(
    `${BASE}/student/lessons/${lessonId}/tool-setup-submission/latest`,
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to load submission status')
  }
  return res.json() as Promise<ToolSetupLatestResponse>
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

// Sprint 4 Story 21 — Enrollment status (used by LiveSessionsPage to gate
// Zoom links behind the PAID paymentStatus). Kept intentionally narrow: a
// full enrollment fetch would drag in installments + progress enrichment.
export interface StudentEnrollmentStatus {
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' | 'FAILED'
  status: 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'REVOKED'
}

export async function fetchStudentEnrollmentStatus(
  slug: string,
): Promise<StudentEnrollmentStatus> {
  const res = await authFetch(`${BASE}/student/enrollments/${slug}/status`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch enrollment status')
  }
  return res.json() as Promise<StudentEnrollmentStatus>
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
  // NAB-P0-5 — Multi-provider video support.
  videoProvider?: 'LOOM' | 'YOUTUBE' | 'VIMEO' | null
  videoUrl?: string | null
  /** @deprecated Use videoUrl + videoProvider. Retained for back-compat. */
  loomUrl?: string | null
  // NAB-P0-4 — rich-text lesson body.
  content?: string | null
  richContent?: string | null
  contentFormat?: 'MARKDOWN' | 'RICH_HTML' | null
}

export interface ReorderResponse {
  updated: number
}

// NAB-P0-2 — Full admin course detail, used by the builder's Overview tab to
// hydrate description + marketing bullet arrays after a course is selected.
export interface AdminCourseDetail {
  id: string
  title: string
  slug: string
  type: 'RECORDED' | 'LIVE' | 'COMBINED' | null
  tagline: string | null
  description: string | null
  coverImageKey: string | null
  maxSeats: number | null
  isPublished: boolean
  status?: string
  liveStartDate?: string | null
  liveEndDate?: string | null
  learningOutcomes: string[]
  requirements: string[]
  targetAudience: string[]
  // NAB-P0-3 — assigned instructors, ordered (first = primary).
  instructorIds: string[]
  instructors: InstructorSummary[]
}

export async function fetchAdminCourseDetail(
  cohortId: string,
): Promise<AdminCourseDetail> {
  const res = await authFetch(`${BASE}/admin/courses/${cohortId}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch course detail')
  }
  const json = (await res.json()) as { cohort: Record<string, unknown> }
  const c = json.cohort
  return {
    id:               (c.id ?? c._id) as string,
    title:            (c.title ?? c.name) as string,
    slug:             (c.slug as string) ?? '',
    type:             (c.type as AdminCourseDetail['type']) ?? null,
    tagline:          (c.tagline as string | null) ?? null,
    description:      (c.description as string | null) ?? null,
    coverImageKey:    (c.coverImageKey as string | null) ?? null,
    maxSeats:         (c.maxSeats as number | null) ?? null,
    isPublished:      Boolean(c.isPublished),
    status:           c.status as string | undefined,
    liveStartDate:    (c.liveStartDate as string | null) ?? null,
    liveEndDate:      (c.liveEndDate as string | null) ?? null,
    learningOutcomes: (c.learningOutcomes as string[] | undefined) ?? [],
    requirements:     (c.requirements     as string[] | undefined) ?? [],
    targetAudience:   (c.targetAudience   as string[] | undefined) ?? [],
    // NAB-P0-3 — instructor assignments + populated summaries. The server
    // returns avatarKey; we also derive a browser-usable avatarUrl so the
    // builder chip can render an <img> without round-tripping the helper.
    instructorIds:    (c.instructorIds as string[] | undefined) ?? [],
    instructors:      ((c.instructors as Array<Record<string, unknown>> | undefined) ?? []).map((i) => ({
      id:        (i.id as string),
      name:      (i.name as string),
      title:     (i.title as string | null | undefined) ?? '',
      avatarKey: (i.avatarKey as string | null | undefined) ?? null,
      avatarUrl: instructorAvatarUrl((i.avatarKey as string | null | undefined) ?? null),
    })),
  }
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

// ---- Sprint 2 Story 12 — Admin module + lesson CRUD ----
//
// Complements the Wave 5 Story Y list/reorder helpers above. Backend routes
// live in apps/api/src/routes/admin/courses.ts and all require the
// `courses:write` permission; the JWT middleware handles that upstream.

export interface CreateModulePayload {
  title: string
  description?: string
  order?: number
}

export interface UpdateModulePayload {
  title?: string
  description?: string
  order?: number
  isPublished?: boolean
}

function normaliseModule(raw: Record<string, unknown>): AdminModule {
  const lessons = raw.lessons
  return {
    id: (raw.id ?? raw._id) as string,
    title: raw.title as string,
    order: (raw.order as number) ?? 0,
    lessonCount:
      (raw.lessonCount as number | undefined) ??
      (Array.isArray(lessons) ? lessons.length : 0),
  }
}

export async function createAdminModule(
  cohortId: string,
  payload: CreateModulePayload,
): Promise<AdminModule> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/modules`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to create module')
  }
  const json = (await res.json()) as { module: Record<string, unknown> }
  return normaliseModule(json.module)
}

export async function updateAdminModule(
  cohortId: string,
  moduleId: string,
  payload: UpdateModulePayload,
): Promise<AdminModule> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/modules/${moduleId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to update module')
  }
  const json = (await res.json()) as { module: Record<string, unknown> }
  return normaliseModule(json.module)
}

export async function deleteAdminModule(
  cohortId: string,
  moduleId: string,
): Promise<void> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/modules/${moduleId}`,
    { method: 'DELETE' },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to delete module')
  }
}

export type AdminLessonType = 'VIDEO' | 'TEXT' | 'TOOL_SETUP'
export type AdminLessonContentFormat = 'MARKDOWN' | 'RICH_HTML'

export interface CreateLessonPayload {
  title: string
  type: AdminLessonType
  // NAB-P0-5 — new multi-provider fields.
  videoUrl?: string
  videoProvider?: 'LOOM' | 'YOUTUBE' | 'VIMEO'
  /** @deprecated Use videoUrl + videoProvider. Retained for back-compat. */
  loomUrl?: string
  content?: string
  // NAB-P0-4 — rich-text (TipTap) HTML body + format discriminator.
  richContent?: string
  contentFormat?: AdminLessonContentFormat
  estimatedMinutes?: number
  order?: number
}

export interface UpdateLessonPayload {
  title?: string
  type?: AdminLessonType
  // NAB-P0-5
  videoUrl?: string
  videoProvider?: 'LOOM' | 'YOUTUBE' | 'VIMEO'
  /** @deprecated Use videoUrl + videoProvider. Retained for back-compat. */
  loomUrl?: string
  content?: string
  // NAB-P0-4
  richContent?: string
  contentFormat?: AdminLessonContentFormat
  estimatedMinutes?: number
  order?: number
}

function normaliseLesson(raw: Record<string, unknown>): AdminLesson {
  const videoProviderRaw = raw.videoProvider as AdminLesson['videoProvider']
  const videoUrlRaw      = (raw.videoUrl as string | null | undefined) ?? null
  const loomUrlRaw       = (raw.loomUrl  as string | null | undefined) ?? null
  return {
    id: (raw.id ?? raw._id) as string,
    title: raw.title as string,
    order: (raw.order as number) ?? 0,
    type: (raw.type as AdminLessonType) ?? 'VIDEO',
    estimatedMinutes: (raw.estimatedMinutes as number) ?? 0,
    published: Boolean(raw.published ?? raw.isPublished),
    // NAB-P0-5 — Back-compat: fall back to loomUrl if the server hasn't been
    // migrated yet.
    videoProvider: videoProviderRaw ?? (loomUrlRaw ? 'LOOM' : null),
    videoUrl: videoUrlRaw ?? loomUrlRaw,
    loomUrl: loomUrlRaw,
    // NAB-P0-4 — rich-text fields. The editor prefers `richContent`, falling
    // back to wrapping plain `content` in <p>…</p>.
    content:       (raw.content       as string | null | undefined) ?? null,
    richContent:   (raw.richContent   as string | null | undefined) ?? null,
    contentFormat: (raw.contentFormat as AdminLesson['contentFormat']) ?? null,
  }
}

export async function createAdminLesson(
  cohortId: string,
  moduleId: string,
  payload: CreateLessonPayload,
): Promise<AdminLesson> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/modules/${moduleId}/lessons`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to create lesson')
  }
  const json = (await res.json()) as { lesson: Record<string, unknown> }
  return normaliseLesson(json.lesson)
}

export async function updateAdminLesson(
  cohortId: string,
  moduleId: string,
  lessonId: string,
  payload: UpdateLessonPayload,
): Promise<AdminLesson> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/modules/${moduleId}/lessons/${lessonId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to update lesson')
  }
  const json = (await res.json()) as { lesson: Record<string, unknown> }
  return normaliseLesson(json.lesson)
}

export async function toggleAdminLessonPublish(
  cohortId: string,
  moduleId: string,
  lessonId: string,
  isPublished: boolean,
): Promise<{ isPublished: boolean }> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/modules/${moduleId}/lessons/${lessonId}/publish`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished }),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to toggle lesson publish state')
  }
  return res.json() as Promise<{ isPublished: boolean }>
}

export async function deleteAdminLesson(
  cohortId: string,
  moduleId: string,
  lessonId: string,
): Promise<void> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/modules/${moduleId}/lessons/${lessonId}`,
    { method: 'DELETE' },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to delete lesson')
  }
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

// Sprint 4 Story 20 — Delete a single notification. The backend route lives
// under /api/student (not /api/v1/student) to match every other student
// notification helper above. Ownership is enforced server-side in the Mongo
// query, so a 404 from the server means either the id doesn't exist OR it
// belongs to somebody else — both cases are indistinguishable to the client,
// which is intentional (no enumeration side-channel).
export async function deleteNotification(id: string): Promise<{ ok: true }> {
  const res = await authFetch(`/api/student/notifications/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to delete notification')
  }
  return res.json() as Promise<{ ok: true }>
}

// Sprint 4 Story 20 — Bulk delete. When `status` is omitted the server nukes
// every notification the caller owns. When "read" is passed only previously
// read rows are removed — this backs the "Delete all read" CTA in the
// NotificationsPage header.
export async function deleteAllNotifications(
  status?: 'read' | 'unread',
): Promise<{ ok: true; deletedCount: number }> {
  const qs = status ? `?status=${status}` : ''
  const res = await authFetch(`/api/student/notifications${qs}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to delete notifications')
  }
  return res.json() as Promise<{ ok: true; deletedCount: number }>
}

// Sprint 4 Story 20 — Student danger-zone account-delete. POST (not DELETE)
// because the payload carries the confirmation string, and some CDN / proxy
// layers still strip bodies from DELETE requests. On success the caller
// should clear auth state and redirect to `/`.
export async function deleteStudentAccount(
  confirmation: string,
): Promise<{ deleted: true }> {
  const res = await authFetch('/api/student/profile/delete', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ confirmation }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to delete account')
  }
  return res.json() as Promise<{ deleted: true }>
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

// FIR-167 — Fetch admin cohorts for audience selector.
// Normalises the `/api/admin/cohorts` response (`{ cohorts: [{id, name, ...}] }`)
// into the `{ id, title }` shape the UI consumes. The legacy `/cohorts/list`
// endpoint never existed — every caller previously hit a 404 and fell through
// to hardcoded fallbacks.
export async function fetchAdminCohortsList(): Promise<AdminCohortsListResponse> {
  const res = await authFetch(`/api/admin/cohorts`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch cohorts')
  }
  const json = (await res.json()) as {
    cohorts?: Array<{ id?: string; _id?: string; name?: string; title?: string; code?: string }>
  }
  const cohorts = (json.cohorts ?? []).map((c) => ({
    id:    (c.id ?? c._id ?? '') as string,
    title: (c.name ?? c.title ?? c.code ?? '') as string,
  }))
  return { cohorts }
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

// ---------------------------------------------------------------------------
// Sprint 2 Story 11 — Admin Course Builder write surface
//
// These helpers back the CourseBuilderPage handleSave / pricing / live-session
// CRUD wiring. Request shapes mirror the Zod schemas in
// apps/api/src/routes/admin/courses.ts so the contract is exact.
// ---------------------------------------------------------------------------

// ---- Cohort create / update / publish ----

export type AdminCourseType = 'RECORDED' | 'LIVE' | 'COMBINED'

export interface CreateCoursePayload {
  title: string
  type?: AdminCourseType
  tagline?: string
  description?: string
  maxSeats?: number
  liveStartDate?: string
  liveEndDate?: string
  // NAB-P0-2 — marketing bullet arrays. Backend enforces the same caps on
  // write (outcomes ≤12, requirements ≤10, audience ≤8, each entry ≤140 chars).
  learningOutcomes?: string[]
  requirements?: string[]
  targetAudience?: string[]
  // NAB-P0-3 — ordered list of InstructorProfile ids. First id is the
  // "primary" instructor rendered on the storefront hero card.
  instructorIds?: string[]
}

export type UpdateCoursePayload = Partial<CreateCoursePayload>

export interface AdminCohortDetail {
  id: string
  title: string
  slug: string
  type?: AdminCourseType | null
  tagline?: string | null
  isPublished: boolean
  status?: string
}

function normaliseCohort(c: Record<string, unknown>): AdminCohortDetail {
  return {
    id: (c._id ?? c.id) as string,
    title: (c.name ?? c.title) as string,
    slug: c.slug as string,
    type: (c.type as AdminCourseType | null) ?? null,
    tagline: (c.tagline as string | null) ?? null,
    isPublished: Boolean(c.isPublished),
    status: c.status as string | undefined,
  }
}

export async function createAdminCourse(
  payload: CreateCoursePayload,
): Promise<AdminCohortDetail> {
  const res = await authFetch(`${BASE}/admin/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to create course')
  }
  const json = (await res.json()) as { cohort: Record<string, unknown> }
  return normaliseCohort(json.cohort)
}

export async function updateAdminCourse(
  cohortId: string,
  payload: UpdateCoursePayload,
): Promise<AdminCohortDetail> {
  const res = await authFetch(`${BASE}/admin/courses/${cohortId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to update course')
  }
  const json = (await res.json()) as { cohort: Record<string, unknown> }
  return normaliseCohort(json.cohort)
}

export async function publishAdminCourse(
  cohortId: string,
  isPublished: boolean,
): Promise<{ isPublished: boolean }> {
  const res = await authFetch(`${BASE}/admin/courses/${cohortId}/publish`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPublished }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to toggle publish')
  }
  return res.json() as Promise<{ isPublished: boolean }>
}

/**
 * Upload a cohort cover image via multipart to
 * POST /api/v1/admin/courses/:id/cover — matches the backend at
 * apps/api/src/routes/admin/courses.ts. Backend accepts jpeg/png/webp up to
 * 5 MB and stores under `cohort-covers/{id}/{ts}.{ext}` in S3 (or locally
 * under /uploads in dev). Returns the stored `coverImageKey`.
 */
export async function uploadAdminCourseCover(
  cohortId: string,
  file: File,
): Promise<{ coverImageKey: string }> {
  const form = new FormData()
  form.append('file', file, file.name)

  // Note: do NOT set Content-Type — the browser generates the multipart
  // boundary automatically. authFetch passes through any RequestInit so
  // this works.
  const res = await authFetch(`${BASE}/admin/courses/${cohortId}/cover`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to upload cover image')
  }
  return res.json() as Promise<{ coverImageKey: string }>
}

/**
 * Derive a browser-usable URL for a stored cover image. In dev (S3 not
 * configured) the backend writes files to `apps/api/uploads/` and serves
 * them via `/api/uploads/*`. In prod the backend will eventually sign
 * presigned GET URLs, but for now we return the same path since the dev
 * route is also mounted in prod; production can swap this for a presign
 * helper without touching callers.
 */
export function cohortCoverImageUrl(coverImageKey: string | null): string | null {
  if (!coverImageKey) return null
  return `/api/uploads/${coverImageKey}`
}

/**
 * NAB-P0-4 — Upload an inline image for the TipTap rich-text lesson editor
 * via multipart to POST /api/v1/admin/courses/:cohortId/lesson-images.
 *
 * Backend accepts jpeg/png/webp up to 5 MB and stores under
 * `lesson-images/<cohortId>/<uuid>.<ext>` in S3 (or the local `uploads/`
 * tree in dev). Returns `{ url, key }` so the editor can insert the
 * image immediately and stamp `data-key` for later reconciliation.
 */
export async function uploadAdminLessonImage(
  cohortId: string,
  file: File,
): Promise<{ url: string; key: string }> {
  const form = new FormData()
  form.append('file', file, file.name)

  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/lesson-images`,
    {
      method: 'POST',
      body: form,
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to upload image')
  }
  return res.json() as Promise<{ url: string; key: string }>
}

// ---- Payment plans ----

export type AdminPaymentPlanType = 'ONE_TIME' | 'INSTALLMENT'

export interface AdminPaymentPlan {
  id: string
  name: string
  type: AdminPaymentPlanType
  totalAmount: number
  currency: string
  intervalDays?: number
  isActive: boolean
  installments?: Array<{
    number: number
    amount: number
    dueDate: string
    status: string
  }>
}

export interface CreatePaymentPlanPayload {
  name: string
  type: AdminPaymentPlanType
  totalAmount: number
  currency?: string
  intervalDays?: number
}

export interface UpdatePaymentPlanPayload {
  name?: string
  totalAmount?: number
  currency?: string
  intervalDays?: number
}

function normalisePlan(raw: Record<string, unknown>): AdminPaymentPlan {
  return {
    id: (raw.id ?? raw._id) as string,
    name: raw.name as string,
    type: raw.type as AdminPaymentPlanType,
    totalAmount: raw.totalAmount as number,
    currency: (raw.currency as string) ?? 'usd',
    intervalDays: raw.intervalDays as number | undefined,
    isActive: Boolean(raw.isActive),
    installments: raw.installments as AdminPaymentPlan['installments'],
  }
}

export async function fetchAdminPaymentPlans(
  cohortId: string,
): Promise<AdminPaymentPlan[]> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/payment-plans`,
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch payment plans')
  }
  const json = (await res.json()) as { plans?: Array<Record<string, unknown>> }
  return (json.plans ?? []).map(normalisePlan)
}

export async function createAdminPaymentPlan(
  cohortId: string,
  payload: CreatePaymentPlanPayload,
): Promise<AdminPaymentPlan> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/payment-plans`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to create payment plan')
  }
  const json = (await res.json()) as { plan: Record<string, unknown> }
  return normalisePlan(json.plan)
}

export async function updateAdminPaymentPlan(
  cohortId: string,
  planId: string,
  payload: UpdatePaymentPlanPayload,
): Promise<AdminPaymentPlan> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/payment-plans/${planId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to update payment plan')
  }
  const json = (await res.json()) as { plan: Record<string, unknown> }
  return normalisePlan(json.plan)
}

// The backend does not expose a DELETE for payment plans — the existing model
// supports deactivation via the `/toggle` endpoint instead (this preserves
// historic plans already sold to existing enrolments). The CourseBuilder
// surfaces the "delete" affordance against this toggle so the admin UI stays
// intuitive while respecting the existing data contract.
export async function toggleAdminPaymentPlan(
  cohortId: string,
  planId: string,
): Promise<{ isActive: boolean }> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/payment-plans/${planId}/toggle`,
    { method: 'PATCH' },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to toggle payment plan')
  }
  return res.json() as Promise<{ isActive: boolean }>
}

// ---- Live sessions (admin) ----
//
// Back-end path is `/courses/:cohortId/sessions` (see routes/admin/courses.ts
// FIR-63). The student-facing `fetchLiveSessions` helper above uses the
// public cohort path; these admin helpers are kept separate to keep the two
// contracts from drifting.

export interface AdminLiveSession {
  id: string
  title: string
  description?: string
  scheduledAt: string
  durationMinutes: number
  zoomUrl: string
  zoomMeetingId?: string
  recordingUrl?: string
  order?: number
  isPublished?: boolean
}

export interface CreateLiveSessionPayload {
  title: string
  description?: string
  scheduledAt: string
  durationMinutes?: number
  zoomUrl: string
  zoomMeetingId?: string
  order?: number
}

export type UpdateLiveSessionPayload = Partial<CreateLiveSessionPayload>

function normaliseSession(raw: Record<string, unknown>): AdminLiveSession {
  return {
    id: (raw.id ?? raw._id) as string,
    title: raw.title as string,
    description: raw.description as string | undefined,
    scheduledAt:
      typeof raw.scheduledAt === 'string'
        ? raw.scheduledAt
        : new Date(raw.scheduledAt as string | number | Date).toISOString(),
    durationMinutes: (raw.durationMinutes as number) ?? 90,
    zoomUrl: (raw.zoomUrl as string) ?? '',
    zoomMeetingId: raw.zoomMeetingId as string | undefined,
    recordingUrl: raw.recordingUrl as string | undefined,
    order: raw.order as number | undefined,
    isPublished: raw.isPublished as boolean | undefined,
  }
}

export async function fetchAdminLiveSessions(
  cohortId: string,
): Promise<AdminLiveSession[]> {
  const res = await authFetch(`${BASE}/admin/courses/${cohortId}/sessions`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch live sessions')
  }
  const json = (await res.json()) as { sessions?: Array<Record<string, unknown>> }
  return (json.sessions ?? []).map(normaliseSession)
}

export async function createAdminLiveSession(
  cohortId: string,
  payload: CreateLiveSessionPayload,
): Promise<AdminLiveSession> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/sessions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to create live session')
  }
  const json = (await res.json()) as { session: Record<string, unknown> }
  return normaliseSession(json.session)
}

export async function updateAdminLiveSession(
  cohortId: string,
  sessionId: string,
  payload: UpdateLiveSessionPayload,
): Promise<AdminLiveSession> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/sessions/${sessionId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to update live session')
  }
  const json = (await res.json()) as { session: Record<string, unknown> }
  return normaliseSession(json.session)
}

export async function deleteAdminLiveSession(
  cohortId: string,
  sessionId: string,
): Promise<void> {
  const res = await authFetch(
    `${BASE}/admin/courses/${cohortId}/sessions/${sessionId}`,
    { method: 'DELETE' },
  )
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to delete live session')
  }
}

// ---------------------------------------------------------------------------
// Admin Dashboard / Enrollment / Payment helpers
//
// Sprint X — replaces the hardcoded MOCK_* constants that the three admin
// surfaces (AdminDashboardPage, EnrollmentManagementPage, TransactionLedgerPage)
// were falling through to when the API layer didn't yet have first-class
// typed helpers. Each helper wraps an endpoint that already exists on the
// Fastify side — the backend is intentionally not changed here.
// ---------------------------------------------------------------------------

// ── Dashboard stats ──────────────────────────────────────────────────────

export interface AdminDashboardStats {
  activeStudents:   number
  activeCohorts:    number
  pendingReviews:   number
  completionRate:   number
}

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const res = await authFetch(`/api/admin/stats`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch dashboard stats')
  }
  return res.json() as Promise<AdminDashboardStats>
}

// ── Admin Enrollments (FIR-213) ──────────────────────────────────────────

export type AdminEnrollmentStatus = 'ACTIVE' | 'SUSPENDED' | 'COMPLETED' | 'REVOKED' | 'PENDING'

export interface AdminEnrollmentRow {
  id:             string
  studentName:    string
  studentEmail:   string
  course:         string
  cohortId:       string
  cohortTitle:    string
  status:         AdminEnrollmentStatus
  paymentStatus:  'PAID' | 'PENDING' | 'FAILED' | 'FREE' | 'PARTIAL' | 'WAIVED'
  paymentMethod:  'STRIPE' | 'MANUAL' | 'FREE'
  progress:       number
  enrolledAt:     string
}

export interface AdminEnrollmentsListResponse {
  enrollments: AdminEnrollmentRow[]
  total:       number
  page:        number
  totalPages:  number
}

export interface FetchAdminEnrollmentsParams {
  page?:          number
  limit?:         number
  status?:        string
  cohortId?:      string
  paymentStatus?: string
  search?:        string
}

interface RawAdminEnrollment {
  _id?:           string
  id?:            string
  status?:        string
  paymentStatus?: string
  paymentMethod?: string
  completionPercentage?: number
  createdAt?:     string
  accessGrantedAt?: string
  student?: {
    _id?:       string
    firstName?: string
    lastName?:  string
    email?:     string
  }
  cohort?: {
    _id?:  string
    name?: string
    code?: string
  }
}

function normaliseAdminEnrollment(r: RawAdminEnrollment): AdminEnrollmentRow {
  const student = r.student ?? {}
  const cohort  = r.cohort ?? {}
  const first   = (student.firstName ?? '').trim()
  const last    = (student.lastName ?? '').trim()
  // Map the backend "SUSPENDED" status to the UI's "PENDING" bucket — the
  // ledger doesn't have a separate pending concept, and SUSPENDED is how
  // unapproved manual payments surface.
  const rawStatus = (r.status ?? 'ACTIVE').toUpperCase()
  const uiStatus: AdminEnrollmentStatus =
    rawStatus === 'SUSPENDED' ? 'PENDING' : (rawStatus as AdminEnrollmentStatus)
  return {
    id:            (r._id ?? r.id ?? '') as string,
    studentName:   `${first} ${last}`.trim() || (student.email ?? 'Unknown'),
    studentEmail:  student.email ?? '',
    course:        cohort.name ?? cohort.code ?? 'Unknown course',
    cohortId:      (cohort._id ?? '') as string,
    cohortTitle:   cohort.name ?? cohort.code ?? 'Unknown cohort',
    status:        uiStatus,
    paymentStatus: (r.paymentStatus ?? 'PENDING') as AdminEnrollmentRow['paymentStatus'],
    paymentMethod: (r.paymentMethod ?? 'MANUAL') as AdminEnrollmentRow['paymentMethod'],
    progress:      Math.round(r.completionPercentage ?? 0),
    enrolledAt:    (r.accessGrantedAt ?? r.createdAt ?? new Date().toISOString()),
  }
}

export async function fetchAdminEnrollments(
  params: FetchAdminEnrollmentsParams = {},
): Promise<AdminEnrollmentsListResponse> {
  const qs = new URLSearchParams()
  if (params.page)          qs.set('page',          String(params.page))
  if (params.limit)         qs.set('limit',         String(params.limit))
  // UI uses "PENDING" to mean SUSPENDED (see normalisation above) — translate.
  if (params.status && params.status !== 'ALL') {
    const mapped = params.status === 'PENDING' ? 'SUSPENDED' : params.status
    qs.set('status', mapped)
  }
  if (params.cohortId)      qs.set('cohortId',      params.cohortId)
  if (params.paymentStatus) qs.set('paymentStatus', params.paymentStatus)
  if (params.search)        qs.set('search',        params.search)

  const res = await authFetch(`${BASE}/admin/enrollments-v2?${qs.toString()}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch enrollments')
  }
  const json = (await res.json()) as {
    enrollments?: RawAdminEnrollment[]
    total?:       number
    page?:        number
    totalPages?:  number
  }
  return {
    enrollments: (json.enrollments ?? []).map(normaliseAdminEnrollment),
    total:       json.total      ?? 0,
    page:        json.page       ?? 1,
    totalPages:  json.totalPages ?? 1,
  }
}

export async function cancelAdminEnrollment(id: string): Promise<void> {
  const res = await authFetch(`${BASE}/admin/enrollments-v2/${id}/cancel`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to cancel enrollment')
  }
}

export async function transferAdminEnrollment(
  enrollmentId: string,
  targetCohortId: string,
): Promise<void> {
  const res = await authFetch(`${BASE}/admin/enrollments-v2/${enrollmentId}/transfer`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ targetCohortId }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to transfer enrollment')
  }
}

// ── Admin Payments (FIR-216) ─────────────────────────────────────────────

export interface AdminPaymentRow {
  id:           string
  type:         'stripe' | 'manual'
  studentName:  string
  studentEmail: string
  course:       string
  amount:       number
  currency:     string
  status:       'SUCCEEDED' | 'PAID' | 'PENDING' | 'REFUNDED' | 'FAILED' | 'APPROVED' | 'REJECTED'
  date:         string
}

export interface AdminPaymentsSummary {
  totalRevenue:  number
  stripeRevenue: number
  manualRevenue: number
  pendingAmount: number
}

export interface AdminPaymentsResponse {
  payments:   AdminPaymentRow[]
  total:      number
  page:       number
  totalPages: number
  summary:    AdminPaymentsSummary
}

export interface FetchAdminPaymentsParams {
  page?:     number
  limit?:    number
  method?:   string
  status?:   string
  search?:   string
  dateFrom?: string
  dateTo?:   string
}

interface RawAdminPayment {
  id?:            string
  _id?:           string
  type?:          'stripe' | 'manual'
  method?:        string
  studentName?:   string
  studentEmail?:  string
  cohortTitle?:   string
  course?:        string
  amount?:        number
  currency?:      string
  status?:        string
  date?:          string
}

function normaliseAdminPayment(r: RawAdminPayment): AdminPaymentRow {
  const type: AdminPaymentRow['type'] =
    r.type === 'manual' || r.method === 'MANUAL' ? 'manual' : 'stripe'
  return {
    id:           (r.id ?? r._id ?? '') as string,
    type,
    studentName:  r.studentName  ?? 'Unknown',
    studentEmail: r.studentEmail ?? '',
    course:       r.cohortTitle  ?? r.course ?? 'Unknown',
    amount:       r.amount ?? 0,
    currency:     (r.currency ?? 'usd'),
    status:       (r.status ?? 'PENDING') as AdminPaymentRow['status'],
    date:         r.date ?? new Date().toISOString(),
  }
}

export async function fetchAdminPayments(
  params: FetchAdminPaymentsParams = {},
): Promise<AdminPaymentsResponse> {
  const qs = new URLSearchParams()
  qs.set('page',  String(params.page  ?? 1))
  qs.set('limit', String(params.limit ?? 20))
  if (params.method)   qs.set('method', params.method.toUpperCase())
  if (params.status)   qs.set('status', params.status)
  if (params.dateFrom) qs.set('from',   new Date(params.dateFrom).toISOString())
  if (params.dateTo)   qs.set('to',     new Date(params.dateTo).toISOString())

  const res = await authFetch(`${BASE}/admin/payments?${qs.toString()}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch payments')
  }
  const json = (await res.json()) as {
    payments?:   RawAdminPayment[]
    total?:      number
    page?:       number
    totalPages?: number
    summary?: {
      totalRevenue?:   number
      stripeRevenue?:  number
      manualRevenue?:  number
      pendingAmount?:  number
    }
  }
  const payments = (json.payments ?? []).map(normaliseAdminPayment)

  // Client-side search (the fir-payments endpoint doesn't take a `q` param).
  const filtered = params.search
    ? payments.filter((p) => {
        const q = params.search!.toLowerCase()
        return (
          p.studentName.toLowerCase().includes(q) ||
          p.studentEmail.toLowerCase().includes(q) ||
          p.course.toLowerCase().includes(q)
        )
      })
    : payments

  // The backend `summary` doesn't split stripe/manual — derive those splits
  // from the returned page for the ledger cards.
  const serverSummary = json.summary ?? {}
  const stripeRevenue = serverSummary.stripeRevenue ?? payments
    .filter((p) => p.type === 'stripe' && (p.status === 'SUCCEEDED' || p.status === 'PAID'))
    .reduce((s, p) => s + p.amount, 0)
  const manualRevenue = serverSummary.manualRevenue ?? payments
    .filter((p) => p.type === 'manual' && (p.status === 'APPROVED' || p.status === 'PAID'))
    .reduce((s, p) => s + p.amount, 0)

  return {
    payments:   filtered,
    total:      json.total      ?? filtered.length,
    page:       json.page       ?? 1,
    totalPages: json.totalPages ?? 1,
    summary: {
      totalRevenue:  serverSummary.totalRevenue  ?? (stripeRevenue + manualRevenue),
      stripeRevenue,
      manualRevenue,
      pendingAmount: serverSummary.pendingAmount ?? 0,
    },
  }
}

export async function refundAdminPayment(
  paymentId: string,
  type: 'stripe' | 'manual',
  amount: number,
  reason: string,
): Promise<void> {
  const res = await authFetch(`${BASE}/admin/payments/${paymentId}/refund`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ type, amount, reason }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Refund failed')
  }
}

// ---------------------------------------------------------------------------
// NAB-P0-3 — Admin InstructorProfile API
//
// The builder Overview tab reads profiles via the typeahead + detail helpers
// below, and creates new profiles through the inline modal. Avatar uploads
// reuse the same multipart pattern as cover uploads.
// ---------------------------------------------------------------------------

export interface AdminInstructorProfilesListResponse {
  profiles: InstructorProfile[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CreateInstructorProfilePayload {
  userId: string
  name: string
  title?: string
  bio?: string
  socialLinks?: InstructorSocialLink[]
}

export type UpdateInstructorProfilePayload = Partial<
  Omit<CreateInstructorProfilePayload, 'userId'>
>

export async function fetchAdminInstructorProfiles(
  q?: string,
): Promise<AdminInstructorProfilesListResponse> {
  const params = new URLSearchParams()
  if (q && q.trim()) params.set('q', q.trim())
  const qs = params.toString()
  const res = await authFetch(
    `${BASE}/admin/instructor-profiles${qs ? `?${qs}` : ''}`,
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch instructor profiles')
  }
  return res.json() as Promise<AdminInstructorProfilesListResponse>
}

export async function fetchAdminInstructorProfile(
  id: string,
): Promise<InstructorProfile> {
  const res = await authFetch(`${BASE}/admin/instructor-profiles/${id}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to fetch instructor profile')
  }
  const json = (await res.json()) as { profile: InstructorProfile }
  return json.profile
}

export async function createAdminInstructorProfile(
  payload: CreateInstructorProfilePayload,
): Promise<InstructorProfile> {
  const res = await authFetch(`${BASE}/admin/instructor-profiles`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to create instructor profile')
  }
  const json = (await res.json()) as { profile: InstructorProfile }
  return json.profile
}

export async function updateAdminInstructorProfile(
  id: string,
  payload: UpdateInstructorProfilePayload,
): Promise<InstructorProfile> {
  const res = await authFetch(`${BASE}/admin/instructor-profiles/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to update instructor profile')
  }
  const json = (await res.json()) as { profile: InstructorProfile }
  return json.profile
}

export async function deleteAdminInstructorProfile(id: string): Promise<void> {
  const res = await authFetch(`${BASE}/admin/instructor-profiles/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to delete instructor profile')
  }
}

export async function uploadAdminInstructorAvatar(
  id: string,
  file: File,
): Promise<{ avatarKey: string }> {
  const form = new FormData()
  form.append('file', file, file.name)
  const res = await authFetch(`${BASE}/admin/instructor-profiles/${id}/avatar`, {
    method: 'POST',
    body:   form,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Failed to upload instructor avatar')
  }
  return res.json() as Promise<{ avatarKey: string }>
}

/**
 * Derive a browser-usable URL for a stored instructor avatar. Mirrors the
 * `cohortCoverImageUrl` pattern — in dev the backend writes files to
 * `apps/api/uploads/` and serves them via `/api/uploads/*`. Returns `null`
 * when no avatar is set so callers can fall back to a placeholder.
 */
export function instructorAvatarUrl(avatarKey: string | null | undefined): string | null {
  if (!avatarKey) return null
  return `/api/uploads/${avatarKey}`
}
