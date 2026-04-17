// PBA-224 — Single source of truth for all permission checkpoint strings
// Used by SubAdminPermission model, requirePermission middleware, and route decorators.
// FIR-25: expanded to 22 permissions covering courses, enrollments, payments, students,
//         submissions, messages, reports, and settings namespaces.

export const PERMISSIONS = [
  'courses:read',
  'courses:write',
  'courses:delete',
  'courses:publish',
  'courses:manage-sessions',
  'courses:manage-steps',
  'enrollments:read',
  'enrollments:create',
  'enrollments:manage',
  'payments:read',
  'payments:manual-review',
  'students:read',
  'students:invite',
  'students:override',
  'submissions:read',
  'submissions:review',
  'messages:read',
  'messages:send',
  'reports:read',
  'reports:export',
  'settings:read-own-profile',
  'settings:manage-sub-admins',
  'analytics:read',
] as const

export type Permission = (typeof PERMISSIONS)[number]
