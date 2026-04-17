import { jsx as _jsx } from "react/jsx-runtime";
// FIR-34 — Route guards for authenticated and role-based access
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
// ---------------------------------------------------------------------------
// LoadingSpinner — shown while auth state is being restored from cookie
// ---------------------------------------------------------------------------
function LoadingSpinner() {
    return (_jsx("div", { className: cn('min-h-screen flex items-center justify-center', 'bg-[#f8f9fb]'), role: "status", "aria-label": "Loading", children: _jsx("div", { className: cn('w-10 h-10 rounded-full border-4', 'border-[rgba(26,39,68,0.1)] border-t-[#4a9ad4]', 'animate-spin') }) }));
}
// ---------------------------------------------------------------------------
// ProtectedRoute — any authenticated user (student or admin)
// ---------------------------------------------------------------------------
export function ProtectedRoute() {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();
    if (isLoading)
        return _jsx(LoadingSpinner, {});
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/login", state: { from: location }, replace: true });
    }
    return _jsx(Outlet, {});
}
// ---------------------------------------------------------------------------
// StudentRoute — only STUDENT role
// ---------------------------------------------------------------------------
export function StudentRoute() {
    const { user, isLoading } = useAuth();
    const location = useLocation();
    if (isLoading)
        return _jsx(LoadingSpinner, {});
    if (!user) {
        return _jsx(Navigate, { to: "/login", state: { from: location }, replace: true });
    }
    if (user.role !== 'STUDENT') {
        // Admins that accidentally hit a student route go to admin dashboard
        return _jsx(Navigate, { to: "/admin/dashboard", replace: true });
    }
    return _jsx(Outlet, {});
}
// ---------------------------------------------------------------------------
// AdminRoute — only ADMIN or SUPER_ADMIN role
// ---------------------------------------------------------------------------
export function AdminRoute() {
    const { user, isLoading } = useAuth();
    const location = useLocation();
    if (isLoading)
        return _jsx(LoadingSpinner, {});
    if (!user) {
        return _jsx(Navigate, { to: "/admin/login", state: { from: location }, replace: true });
    }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(Outlet, {});
}
