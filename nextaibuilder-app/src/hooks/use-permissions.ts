// PBA-234 — usePermissions hook and hasPermission utility
import { useAuth } from '@/hooks/use-auth'
import type { AuthUser } from '@/store/auth'

/**
 * Standalone utility — safe to call outside React components (e.g. route guards,
 * non-hook utilities). Returns true if the user has the given permission checkpoint.
 *
 * Rules:
 *   - null user → false
 *   - SUPER_ADMIN → always true (bypasses the permissions table)
 *   - ADMIN → checks permissions array
 *   - STUDENT (or any other role) → false
 */
export function hasPermission(user: AuthUser | null, checkpoint: string): boolean {
  if (!user) return false
  if (user.role === 'SUPER_ADMIN') return true
  if (user.role === 'ADMIN') return user.permissions.includes(checkpoint)
  return false
}

/**
 * React hook — subscribes to the auth store and exposes permission helpers.
 *
 * Usage:
 *   const { hasPermission } = usePermissions()
 *   if (hasPermission('cohorts:write')) { ... }
 */
export function usePermissions() {
  const { user, isLoading } = useAuth()

  return {
    /** Check a single permission checkpoint */
    hasPermission: (checkpoint: string) => hasPermission(user, checkpoint),
    /** Raw permissions array from the auth store */
    permissions: user?.permissions ?? [],
    /** True while the initial session restore is in flight (avoids permission flash) */
    isLoading,
    /** True if the user is a SUPER_ADMIN (has unrestricted access) */
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
  }
}
