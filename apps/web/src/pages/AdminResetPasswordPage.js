import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-36 — Admin reset password page (reads token from URL query param)
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { adminResetPassword } from '../lib/api';
import { AdminLeftPanel } from './AdminLoginPage';
import { cn } from '../lib/utils';
const MIN_PASSWORD_LENGTH = 8;
export default function AdminResetPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(null);
    const [isPending, setIsPending] = useState(false);
    // Client-side validation before hitting the API
    function validate() {
        if (!token)
            return 'Invalid or missing reset token. Please request a new link.';
        if (password.length < MIN_PASSWORD_LENGTH)
            return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
        if (password !== confirmPassword)
            return 'Passwords do not match.';
        return null;
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }
        setIsPending(true);
        try {
            await adminResetPassword(token, password, confirmPassword);
            // Navigate to login with a success indicator in state
            navigate('/admin/login', {
                replace: true,
                state: { successMessage: 'Password reset successfully. Please sign in.' },
            });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.');
        }
        finally {
            setIsPending(false);
        }
    }
    const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
    return (_jsxs("div", { className: "flex min-h-screen w-full", children: [_jsx(AdminLeftPanel, { tagline: "Course administration made simple." }), _jsx("div", { className: cn('flex-1 flex items-center justify-center', 'px-6 py-16 bg-[#f8f9fb]'), children: _jsxs("form", { onSubmit: handleSubmit, noValidate: true, className: "w-full max-w-[420px]", "aria-label": "Reset password form", children: [_jsx("h1", { className: cn('text-[36px] font-black text-[#1a2744]', 'tracking-[-1px] mb-1.5'), children: "New password" }), _jsx("p", { className: "text-[16px] text-[#717182] mb-9", children: "Choose a strong password for your account" }), error && (_jsxs("div", { role: "alert", className: cn('flex items-start gap-2.5 mb-6', 'bg-[#fdeaeb] border border-[rgba(208,50,56,0.25)]', 'rounded-xl px-4 py-3.5'), children: [_jsx("span", { className: "text-base flex-shrink-0 mt-0.5", "aria-hidden": "true", children: "\u26A0\uFE0F" }), _jsx("p", { className: "text-[14px] text-[#d03238] font-medium leading-snug", children: error })] })), _jsxs("div", { className: "mb-[18px]", children: [_jsx("label", { htmlFor: "new-password", className: "block text-[14px] font-semibold text-[#1a2744] mb-1.5", children: "New password" }), _jsx("input", { id: "new-password", type: "password", autoComplete: "new-password", placeholder: "Min. 8 characters", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: MIN_PASSWORD_LENGTH, className: cn('w-full h-12 rounded-xl px-4', 'text-[15px] text-[#1a2744]', 'border-[1.5px] bg-[#f3f3f5] outline-none', 'transition-[border-color,background,box-shadow]', 'border-[rgba(26,39,68,0.15)]', 'focus:border-[#4a9ad4] focus:bg-white focus:shadow-[0_0_0_3px_rgba(74,154,212,0.12)]') })] }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { htmlFor: "confirm-password", className: "block text-[14px] font-semibold text-[#1a2744] mb-1.5", children: "Confirm new password" }), _jsx("input", { id: "confirm-password", type: "password", autoComplete: "new-password", placeholder: "Repeat your password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), required: true, "aria-invalid": passwordMismatch, "aria-describedby": passwordMismatch ? 'confirm-password-error' : undefined, className: cn('w-full h-12 rounded-xl px-4', 'text-[15px] text-[#1a2744]', 'border-[1.5px] bg-[#f3f3f5] outline-none', 'transition-[border-color,background,box-shadow]', passwordMismatch
                                        ? 'border-[#d03238] bg-[#fef2f2]'
                                        : 'border-[rgba(26,39,68,0.15)]', 'focus:border-[#4a9ad4] focus:bg-white focus:shadow-[0_0_0_3px_rgba(74,154,212,0.12)]') }), passwordMismatch && (_jsx("p", { id: "confirm-password-error", role: "alert", className: "text-[13px] text-[#d03238] mt-1.5", children: "Passwords do not match." }))] }), _jsx("button", { type: "submit", disabled: isPending || !token, className: cn('w-full h-[52px] rounded-full', 'bg-[#4a9ad4] text-[#0d1a3a] text-[16px] font-bold', 'border-none cursor-pointer', 'hover:opacity-90 transition-opacity', 'disabled:opacity-50 disabled:cursor-not-allowed', 'focus-visible:outline-2 focus-visible:outline-[#4a9ad4] focus-visible:outline-offset-2'), children: isPending ? 'Saving…' : 'Set New Password' }), _jsxs("p", { className: "text-[14px] text-[#717182] mt-5", children: ["\u2190", ' ', _jsx(Link, { to: "/admin/login", className: "text-[#4a9ad4] font-semibold hover:underline", children: "Back to Sign In" })] })] }) })] }));
}
