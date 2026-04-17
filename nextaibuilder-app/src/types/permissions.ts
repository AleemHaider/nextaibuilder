// PBA-234 — Permission checkpoint type union
// Keep in sync with apps/api/src/lib/permissions.ts

export const PERMISSIONS = [
  'cohorts:read',
  'cohorts:write',
  'cohorts:delete',
  'cohorts:manage-status',
  'cohorts:manage-steps',
  'students:read',
  'students:enroll',
  'students:remove',
  'students:override',
  'steps:read',
  'steps:write',
  'steps:delete',
  'submissions:read',
  'submissions:review',
  'messages:read',
  'messages:send',
  'reports:read',
  'reports:export',
  'settings:read-own-profile',
  'settings:manage-sub-admins',
] as const

export type Permission = (typeof PERMISSIONS)[number]
