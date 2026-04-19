import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-35 — Admin login page (email + password, optional OTP redirect)
// Reskinned to Wise theme per DESIGN.md (root workspace)
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminLogin } from '../lib/api';
import { Logo } from '../components/Logo';
import { cn } from '../lib/utils';
export function AdminLeftPanel({ tagline }) {
    return (_jsxs("div", { className: cn('relative flex w-[500px] shrink-0 flex-col items-start justify-center', 'overflow-hidden px-20 py-20 min-h-screen', 'bg-[#0e0f0c] text-white'), children: [_jsx("div", { "aria-hidden": "true", className: cn('pointer-events-none absolute -bottom-24 -right-24 h-[420px] w-[420px] rounded-full', 'bg-[#9fe870]/15 blur-3xl') }), _jsx("div", { "aria-hidden": "true", className: cn('pointer-events-none absolute -top-20 -left-20 h-[240px] w-[240px] rounded-full', 'bg-[#9fe870]/5 blur-2xl') }), _jsxs("div", { className: "relative z-10 max-w-[340px]", children: [_jsx("div", { className: "mb-12", children: _jsx(Logo, { size: "md", variant: "dark" }) }), _jsxs("div", { className: cn('mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5', 'bg-[#9fe870]/15 text-[#9fe870] text-[13px] font-semibold', 'ring-1 ring-[#9fe870]/25'), children: [_jsx(Lock, { className: "h-3.5 w-3.5", strokeWidth: 2.5 }), "Admin Portal"] }), _jsx("h1", { className: cn('text-[44px] leading-[0.9] tracking-[-1.5px] text-white mb-5', 'font-black'), style: { fontFeatureSettings: '"calt"' }, children: tagline }), _jsx("p", { className: "text-[17px] leading-[1.55] text-white/55", children: "Manage cohorts, enrollments, payments, and your team from one powerful dashboard." })] })] }));
}
// ---------------------------------------------------------------------------
// Shared input styles
// ---------------------------------------------------------------------------
const inputBase = cn('w-full h-12 rounded-xl px-4 text-[15px] font-medium', 'bg-white text-[#0e0f0c] placeholder:text-[#868685]', 'border outline-none transition-[border-color,box-shadow,background]', 'focus:bg-white focus:ring-4 focus:ring-[#9fe870]/25');
// ---------------------------------------------------------------------------
// AdminLoginPage
// ---------------------------------------------------------------------------
export default function AdminLoginPage() {
    const { isAuthenticated, isLoading, user, login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isPending, setIsPending] = useState(false);
    useEffect(() => {
        if (!isLoading && isAuthenticated && user) {
            if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                navigate('/admin/dashboard', { replace: true });
            }
        }
    }, [isAuthenticated, isLoading, user, navigate]);
    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setIsPending(true);
        try {
            const result = await adminLogin(email, password);
            if ('twoFactorRequired' in result && result.twoFactorRequired) {
                navigate('/admin/verify-otp', {
                    state: { preAuthToken: result.preAuthToken, email },
                });
            }
            else {
                const authResult = result;
                login(authResult.accessToken, authResult.user);
                navigate('/admin/dashboard', { replace: true });
            }
        }
        catch (err) {
            setError(err instanceof Error
                ? err.message
                : 'Invalid email or password. Please check your credentials and try again.');
        }
        finally {
            setIsPending(false);
        }
    }
    if (isLoading)
        return null;
    const hasError = error !== null;
    return (_jsxs("div", { className: "flex min-h-screen w-full bg-[#fafaf8]", children: [_jsx(AdminLeftPanel, { tagline: "Course administration made simple." }), _jsx("div", { className: "flex flex-1 items-center justify-center px-6 py-16", children: _jsxs("form", { onSubmit: handleSubmit, noValidate: true, className: cn('w-full max-w-[460px] rounded-[30px] bg-white p-10', 'shadow-[0_0_0_1px_rgba(14,15,12,0.08),0_24px_60px_-24px_rgba(14,15,12,0.18)]'), "aria-label": "Admin sign in form", children: [_jsx("h1", { className: "text-[36px] font-black text-[#0e0f0c] tracking-[-1px] mb-1.5", style: { fontFeatureSettings: '"calt"' }, children: "Admin Sign In" }), _jsx("p", { className: "text-[16px] text-[#868685] mb-9", children: "Access the nextaibuilder admin portal" }), hasError && (_jsxs("div", { role: "alert", className: cn('mb-6 flex items-start gap-2.5 rounded-2xl px-4 py-3.5', 'bg-[#fdeaeb] ring-1 ring-[#d03238]/25'), children: [_jsx(AlertTriangle, { className: "h-4 w-4 shrink-0 mt-0.5 text-[#d03238]", strokeWidth: 2.5 }), _jsx("p", { className: "text-[14px] font-semibold leading-snug text-[#d03238]", children: error })] })), _jsx("label", { htmlFor: "admin-email", className: "block mb-1.5 text-[14px] font-semibold text-[#0e0f0c]", children: "Email address" }), _jsxs("div", { className: "relative mb-5", children: [_jsx(Mail, { className: "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#868685]", strokeWidth: 2.25, "aria-hidden": "true" }), _jsx("input", { id: "admin-email", type: "email", autoComplete: "email", placeholder: "admin@nextaibuilder.com", value: email, onChange: (e) => setEmail(e.target.value), required: true, className: cn(inputBase, 'pl-11', hasError ? 'border-[#d03238] bg-[#fef2f2]' : 'border-[rgba(14,15,12,0.12)]') })] }), _jsx("label", { htmlFor: "admin-password", className: "block mb-1.5 text-[14px] font-semibold text-[#0e0f0c]", children: "Password" }), _jsxs("div", { className: "relative mb-2", children: [_jsx(Lock, { className: "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#868685]", strokeWidth: 2.25, "aria-hidden": "true" }), _jsx("input", { id: "admin-password", type: "password", autoComplete: "current-password", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value), required: true, className: cn(inputBase, 'pl-11', hasError ? 'border-[#d03238] bg-[#fef2f2]' : 'border-[rgba(14,15,12,0.12)]') })] }), _jsx("div", { className: "flex justify-end mb-6", children: _jsx(Link, { to: "/admin/forgot-password", className: "text-[13px] font-semibold text-[#163300] hover:underline", children: "Forgot password?" }) }), _jsx("button", { type: "submit", disabled: isPending, className: cn('w-full h-[52px] rounded-full', 'bg-[#9fe870] text-[#163300] text-[16px] font-bold', 'border-none cursor-pointer', 'transition-transform duration-150 ease-out', 'hover:enabled:scale-[1.02] active:enabled:scale-[0.98]', 'disabled:opacity-50 disabled:cursor-not-allowed', 'focus-visible:outline-2 focus-visible:outline-[#163300] focus-visible:outline-offset-2'), children: isPending ? 'Signing in…' : 'Sign In' })] }) })] }));
}
