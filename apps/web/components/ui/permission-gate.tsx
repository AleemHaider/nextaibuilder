'use client'

// PBA-235 — PermissionGate: render children only when the user has the given permission.
// Renders nothing while auth is still loading to prevent permission flashes.
import * as React from 'react'
import { usePermissions } from '@/hooks/use-permissions'

interface PermissionGateProps {
  /** The permission checkpoint required to render children */
  permission: string
  /** Rendered when the user lacks the permission. Defaults to null (render nothing). */
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * Conditionally renders `children` based on whether the authenticated user
 * holds the specified `permission` checkpoint.
 *
 * - While auth is loading → renders nothing (no flash)
 * - SUPER_ADMIN → always renders children
 * - ADMIN with matching permission → renders children
 * - Otherwise → renders `fallback` (default: null)
 */
function PermissionGate({ permission, fallback = null, children }: PermissionGateProps) {
  const { hasPermission, isLoading } = usePermissions()

  // While session is being restored, render nothing to avoid a flash of
  // unauthorized content or a premature redirect.
  if (isLoading) return null

  if (hasPermission(permission)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}

export { PermissionGate }
export type { PermissionGateProps }
