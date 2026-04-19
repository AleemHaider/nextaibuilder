// FIR-34 — Route guards for authenticated and role-based access
// Sprint 3 Story 14 — Wise theme migration: swap hand-rolled spinner for
// the Wave 6 <LoadingSpinner> primitive so every route guard shares the
// same aria contract and Wise palette.
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from './ui/LoadingSpinner'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// GuardSpinner — Wise-themed full-page loading state
// ---------------------------------------------------------------------------
function GuardSpinner() {
  return (
    <div
      className={cn(
        'min-h-screen flex items-center justify-center',
        'bg-[var(--color-wise-canvas)]',
      )}
    >
      <LoadingSpinner centered size="lg" label="Checking your session…" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProtectedRoute — any authenticated user (student or admin)
// ---------------------------------------------------------------------------
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <GuardSpinner />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

// ---------------------------------------------------------------------------
// StudentRoute — only STUDENT role
// ---------------------------------------------------------------------------
export function StudentRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <GuardSpinner />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user.role !== 'STUDENT') {
    // Admins that accidentally hit a student route go to admin dashboard
    return <Navigate to="/admin/dashboard" replace />
  }

  return <Outlet />
}

// ---------------------------------------------------------------------------
// AdminRoute — only ADMIN or SUPER_ADMIN role
// ---------------------------------------------------------------------------
export function AdminRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <GuardSpinner />

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
