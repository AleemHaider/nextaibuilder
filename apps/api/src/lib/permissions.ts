// PBA-224 — Single source of truth for all permission checkpoint strings
// Used by SubAdminPermission model, requirePermission middleware, and route decorators.
// FIR-25: expanded to 22 permissions covering courses, enrollments, payments, students,
//         submissions, messages, reports, and settings namespaces.

export const PERMISSIONS = [
  // Courses
  'courses:read',
  'courses:write',
  'courses:delete',
  'courses:publish',
  'courses:manage-sessions',
  'courses:manage-steps',
  // Enrollments
  'enrollments:read',
  'enrollments:create',
  'enrollments:manage',
  // Payments
  'payments:read',
  'payments:manual-review',
  // Student management
  'students:read',
  'students:invite',
  'students:override',
  'students:enroll',
  'students:remove',
  // Submissions
  'submissions:read',
  'submissions:review',
  // Messages
  'messages:read',
  'messages:send',
  // Reports
  'reports:read',
  'reports:export',
  // Settings
  'settings:read-own-profile',
  'settings:manage-sub-admins',
  // Analytics
  'analytics:read',
  // Cohort management
  'cohorts:read',
  'cohorts:write',
  'cohorts:manage-status',
  'cohorts:manage-steps',
  // Step curation
  'steps:read',
  'steps:write',
  'steps:delete',
] as const

export type Permission = (typeof PERMISSIONS)[number]
