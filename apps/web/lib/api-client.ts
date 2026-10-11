// PBA-149 — Typed API client for student routes
import { apiFetch } from '../store/auth'

export type StepStatus =
  | 'LOCKED'
  | 'UNLOCKED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'COMPLETE'
  | 'OVERRIDE_PASS'
  | 'OVERRIDE_FAIL'

export type DashboardState =
  | 'WELCOME'
  | 'IN_PROGRESS'
  | 'COMPLETE'
  | 'DEADLINE_MISSED'
  | 'NO_COHORT'

export interface StepSummary {
  id: string
  title: string
  order: number
  status: StepStatus | 'UNLOCKED'
  submissionId?: string
  estimatedMinutes?: number | null
}

export interface DashboardResponse {
  dashboardState: DashboardState
  student: { id: string; email: string }
  cohort: {
    id: string
    name: string
    startDate: string
    deadline: string
  } | null
  steps: StepSummary[]
  progressPercent: number
  completedSteps: number
  totalSteps: number
}

export interface SubmissionSummary {
  id: string
  status: string
  mlFeedback: string | null
  createdAt: string
}

export interface StepDetailResponse {
  step: {
    id: string
    title: string
    order: number
    description: string
    videoUrl: string | null
    screenshotCriteria: string
    status: StepStatus | 'UNLOCKED'
    latestSubmission: SubmissionSummary | null
    estimatedMinutes?: number | null
    checklist?: string[]
    whyItMatters?: string | null
    quickReferenceChecklist?: string[]
    keyLinks?: { label: string; url: string }[]
    videoTranscript?: string | null
  }
  prevStepId: string | null
  nextStepId: string | null
}

export interface LatestSubmissionResponse {
  submission: {
    id: string
    status: string
    mlFeedback: string | null
    mlScore: number | null
    screenshotUrl: string
    createdAt: string
    reviewedAt: string | null
  }
}

export const studentApi = {
  getDashboard: () =>
    apiFetch<DashboardResponse>('/api/student/dashboard'),

  getStep: (stepId: string) =>
    apiFetch<StepDetailResponse>(`/api/student/steps/${stepId}`),

  presignUpload: (stepId: string, contentType: string) =>
    apiFetch<{ presignedUrl: string; s3Key: string; contentType: string }>(
      `/api/student/steps/${stepId}/presign`,
      { method: 'POST', body: JSON.stringify({ contentType }) },
    ),

  createSubmission: (stepId: string, s3Key: string) =>
    apiFetch<{ submissionId: string; status: string }>(
      `/api/student/steps/${stepId}/submissions`,
      {
        method: 'POST',
        body: JSON.stringify({ s3Key }),
      },
    ),

  getLatestSubmission: (stepId: string) =>
    apiFetch<LatestSubmissionResponse>(`/api/student/steps/${stepId}/submission/latest`),
}

// ── PBA-316 — AI Troubleshooter API ────────────────────────────────────────────

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface TroubleshootHistoryResponse {
  conversationId: string
  messages: AiMessage[]
}

export const troubleshootApi = {
  /**
   * Returns conversation history for the given step, or null if no conversation exists.
   */
  getHistory: (stepId: string) =>
    apiFetch<TroubleshootHistoryResponse | null>(`/api/student/steps/${stepId}/troubleshoot/history`),

  /**
   * PBA-375 — Get a presigned S3 PUT URL for uploading a troubleshooter screenshot.
   */
  presignUpload: (stepId: string, contentType: 'image/png' | 'image/jpeg' | 'image/webp') =>
    apiFetch<{ uploadUrl: string; s3Key: string }>(
      `/api/student/steps/${stepId}/troubleshoot/presign`,
      { method: 'POST', body: JSON.stringify({ contentType }) },
    ),

  /**
   * Initiates a troubleshooter SSE stream. Returns the raw Response — do NOT parse as JSON.
   * The caller is responsible for reading the SSE stream via response.body.getReader().
   */
  startTroubleshoot: async (
    stepId: string,
    body: { message: string; submissionId?: string; screenshotS3Key?: string },
  ): Promise<Response> => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
    // Import authStore inline to get the current access token
    const { authStore } = await import('../store/auth')
    const { accessToken } = authStore.getState()
    return fetch(`${API_BASE}/api/student/steps/${stepId}/troubleshoot`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    })
  },
}

// ── PBA-315 — Student Profile API ──────────────────────────────────────────────

export interface NotificationPreferences {
  setupReminders: boolean
  progressUpdates: boolean
  deadlineAlerts: boolean
  tipsAndEncouragement: boolean
}

export interface ProfileResponse {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  oauthProvider: 'google' | 'apple' | null
  hasPassword: boolean
  notifications: NotificationPreferences
  cohort: { name: string; startDate: string } | null
}

export interface UpdateProfilePayload {
  firstName: string
  lastName: string
}

export interface UpdateProfileResponse {
  firstName: string
  lastName: string
  avatarUrl: string | null
}

export interface PresignAvatarResponse {
  presignedUrl: string
  s3Key: string
}

export interface UpdateAvatarResponse {
  avatarUrl: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface DeleteAccountPayload {
  password?: string
  confirmation?: string
}

export const profileApi = {
  getProfile: () =>
    apiFetch<ProfileResponse>('/api/student/profile'),

  updateProfile: (payload: UpdateProfilePayload) =>
    apiFetch<UpdateProfileResponse>('/api/student/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  presignAvatar: (contentType: 'image/jpeg' | 'image/png' | 'image/webp') =>
    apiFetch<PresignAvatarResponse>('/api/student/profile/avatar/presign', {
      method: 'POST',
      body: JSON.stringify({ contentType }),
    }),

  updateAvatarKey: (s3Key: string) =>
    apiFetch<UpdateAvatarResponse>('/api/student/profile/avatar', {
      method: 'PATCH',
      body: JSON.stringify({ s3Key }),
    }),

  updateNotifications: (prefs: Partial<NotificationPreferences>) =>
    apiFetch<void>('/api/student/profile/notifications', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    }),

  changePassword: (payload: ChangePasswordPayload) =>
    apiFetch<{ message: string }>('/api/student/profile/password', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteAccount: (payload: DeleteAccountPayload) =>
    apiFetch<{ message: string }>('/api/student/profile', {
      method: 'DELETE',
      body: JSON.stringify(payload),
    }),
}

// ── PBA-380/383 — Student Notifications API ─────────────────────────────────

export type NotificationType =
  | 'STEP_APPROVED'
  | 'STEP_REJECTED'
  | 'BADGE_EARNED'
  | 'BROADCAST'
  | 'DEADLINE_WARNING'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  linkPath: string | null
  createdAt: string
}

export interface NotificationsResponse {
  notifications: NotificationItem[]
  unreadCount: number
}

// ── Storefront + coupon enrollment ─────────────────────────────────────────

export interface StorefrontCohort {
  id: string
  slug: string
  title: string
  tagline: string
  type: 'recorded' | 'live' | 'combined'
  price: number
  meta: string
  soldOut: boolean
}

export interface CouponRedeemResponse {
  enrollmentId: string
  status: string
  paymentStatus: string
  cohortId: string
}

export interface FlashPromo {
  active: boolean
  percentOff: number
  windowHours: number
  startedAt: string | null
  expiresAt: string | null
}

export const storefrontApi = {
  getCohorts: () =>
    apiFetch<StorefrontCohort[]>('/api/v1/storefront/cohorts'),
  /** Starts (on first call) and returns the per-session flash-promo window. */
  getPromo: () =>
    apiFetch<FlashPromo>('/api/v1/storefront/promo'),
}

export interface PaddleTransactionResponse {
  transactionId: string
  status: string
  /** Amount to be charged in cents (promo applied). */
  amount: number
  listAmount: number
  promoPercent: number
  currency: string
  environment: 'sandbox' | 'production'
}

export const checkoutApi = {
  redeemCoupon: (cohortId: string, couponCode: string) =>
    apiFetch<CouponRedeemResponse>('/api/v1/student/checkout/coupon', {
      method: 'POST',
      body: JSON.stringify({ cohortId, couponCode }),
    }),
  /** Creates a server-side Paddle transaction for the cohort's one-time plan. */
  createPaddleTransaction: (cohortId: string, paymentPlanId?: string) =>
    apiFetch<PaddleTransactionResponse>('/api/v1/student/checkout/paddle', {
      method: 'POST',
      body: JSON.stringify({ cohortId, ...(paymentPlanId ? { paymentPlanId } : {}) }),
    }),
}

// ── FIR-51–58 — Student LMS (course execution) ─────────────────────────────

export interface LmsEnrollment {
  id: string
  cohort: {
    title: string
    slug: string
    type: 'live' | 'recorded' | 'combined'
    coverImageKey: string | null
  }
  completionPercentage: number
  lessonsCompleted: number
  totalLessons: number
  paymentStatus: string
  status: string
  nextLessonTitle: string | null
}

export type LmsLessonStatus = 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED'

export interface CurriculumLesson {
  _id: string
  title: string
  moduleId: string
  estimatedMinutes: number | null
  order: number
  type: string
  status: LmsLessonStatus
}

export interface CurriculumModule {
  id: string
  title: string
  description: string | null
  order: number
  lessons: CurriculumLesson[]
}

export interface CurriculumResponse {
  cohort: { title: string; slug: string }
  modules: CurriculumModule[]
}

export interface LmsLessonDetail {
  lesson: {
    id: string
    title: string
    type: string
    estimatedMinutes: number | null
    order: number
    content: string | null
    richContent: string | null
    contentFormat: string | null
    loomUrl: string | null
    embedUrl: string | null
    transcript: string | null
    status: LmsLessonStatus
  }
  prevLesson: { id: string; title: string } | null
  nextLesson: { id: string; title: string } | null
}

export interface LmsProgressResponse {
  overall: { percent: number; completed: number; total: number }
  modules: { moduleId: string; title: string; completed: number; total: number }[]
}

export interface LmsCertificate {
  id: string
  credentialId: string | null
  cohortTitle: string | null
  cohortSlug: string | null
  issuedAt: string
}

export const lmsApi = {
  getDashboard: () =>
    apiFetch<{ enrollments: LmsEnrollment[] }>('/api/v1/student/dashboard'),

  getCurriculum: (cohortSlug: string) =>
    apiFetch<CurriculumResponse>(`/api/v1/student/cohorts/${cohortSlug}/curriculum`),

  getLesson: (cohortSlug: string, lessonId: string) =>
    apiFetch<LmsLessonDetail>(`/api/v1/student/cohorts/${cohortSlug}/lessons/${lessonId}`),

  completeLesson: (lessonId: string) =>
    apiFetch<{ success: boolean; completionPercentage: number; lessonsCompleted: number }>(
      `/api/v1/student/lessons/${lessonId}/complete`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  getProgress: (cohortSlug: string) =>
    apiFetch<LmsProgressResponse>(`/api/v1/student/cohorts/${cohortSlug}/progress`),

  getCertificates: () =>
    apiFetch<{ certificates: LmsCertificate[] }>('/api/v1/student/certificates'),
}

export const notificationsApi = {
  getNotifications: () =>
    apiFetch<NotificationsResponse>('/api/student/notifications'),

  markRead: (id: string) =>
    apiFetch<{ id: string; read: boolean }>(`/api/student/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  markAllRead: () =>
    apiFetch<{ ok: boolean }>('/api/student/notifications/read-all', {
      method: 'PATCH',
    }),

  deleteNotification: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/student/notifications/${id}`, {
      method: 'DELETE',
    }),
}
