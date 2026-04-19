import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-156 — Admin 2FA OTP verification page
// Reskinned to Wise theme per DESIGN.md (root workspace)
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AlertTriangle, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminVerifyOtp, adminResendOtp } from '../lib/api';
import { AdminLeftPanel } from './AdminLoginPage';
import { cn } from '../lib/utils';
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 3;
function OtpBox({ index, value, isFocused, hasError, inputRef, onChange, onKeyDown, onFocus, onPaste, }) {
    return (_jsx("input", { ref: inputRef, id: `otp-${index}`, type: "text", inputMode: "numeric", pattern: "[0-9]", maxLength: 1, value: value, "aria-label": `OTP digit ${index + 1}`, onChange: (e) => {
            const raw = e.target.value.replace(/\D/g, '');
            onChange(index, raw.slice(-1));
        }, onKeyDown: (e) => onKeyDown(index, e), onFocus: () => onFocus(index), onPaste: onPaste, className: cn('w-[62px] h-[72px] rounded-2xl text-center bg-white', 'text-[28px] font-black text-[#0e0f0c]', 'border outline-none caret-transparent', 'transition-[border-color,background,box-shadow] duration-150', hasError
            ? 'border-[#d03238] bg-[#fef2f2]'
            : value
                ? 'border-[#163300] shadow-[0_0_0_3px_rgba(159,232,112,0.35)]'
                : isFocused
                    ? 'border-[#0e0f0c] shadow-[0_0_0_3px_rgba(159,232,112,0.35)]'
                    : 'border-[rgba(14,15,12,0.12)]'), style: { fontFeatureSettings: '"calt"' } }));
}
export default function AdminOtpPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const state = location.state;
    const preAuthToken = state?.preAuthToken ?? null;
    const email = state?.email ?? 'your email';
    // Guard: no preAuthToken → back to login
    useEffect(() => {
        if (!preAuthToken) {
            navigate('/admin/login', { replace: true });
        }
    }, [preAuthToken, navigate]);
    const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [error, setError] = useState(null);
    const [isPending, setIsPending] = useState(false);
    const [attemptCount, setAttemptCount] = useState(0);
    const [isLockedOut, setIsLockedOut] = useState(false);
    // Resend cooldown
    const [cooldown, setCooldown] = useState(0);
    const cooldownRef = useRef(null);
    function startCooldown() {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        cooldownRef.current = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(cooldownRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    useEffect(() => () => { if (cooldownRef.current)
        clearInterval(cooldownRef.current); }, []);
    const inputRefs = useRef([]);
    function focusBox(index) {
        inputRefs.current[index]?.focus();
    }
    function handleChange(index, value) {
        setError(null);
        const next = [...digits];
        next[index] = value;
        setDigits(next);
        if (value && index < OTP_LENGTH - 1) {
            focusBox(index + 1);
        }
    }
    function handleKeyDown(index, e) {
        if (e.key === 'Backspace') {
            if (digits[index]) {
                const next = [...digits];
                next[index] = '';
                setDigits(next);
            }
            else if (index > 0) {
                focusBox(index - 1);
            }
        }
        else if (e.key === 'ArrowLeft' && index > 0) {
            focusBox(index - 1);
        }
        else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
            focusBox(index + 1);
        }
    }
    function handlePaste(e) {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!pasted)
            return;
        const next = [...digits];
        for (let i = 0; i < pasted.length; i++) {
            next[i] = pasted[i];
        }
        setDigits(next);
        const nextFocus = Math.min(pasted.length, OTP_LENGTH - 1);
        focusBox(nextFocus);
    }
    async function handleVerify(e) {
        e.preventDefault();
        if (!preAuthToken)
            return;
        const code = digits.join('');
        if (code.length < OTP_LENGTH) {
            setError('Please enter all 6 digits.');
            return;
        }
        setError(null);
        setIsPending(true);
        try {
            const result = await adminVerifyOtp(preAuthToken, code);
            login(result.accessToken, result.user);
            navigate('/admin/dashboard', { replace: true });
        }
        catch (err) {
            const newCount = attemptCount + 1;
            setAttemptCount(newCount);
            if (newCount >= MAX_ATTEMPTS) {
                setIsLockedOut(true);
                setError('Too many incorrect attempts. Please go back and sign in again.');
            }
            else {
                setError(err instanceof Error
                    ? err.message
                    : `Invalid code. ${MAX_ATTEMPTS - newCount} attempt${MAX_ATTEMPTS - newCount === 1 ? '' : 's'} remaining.`);
            }
            setDigits(Array(OTP_LENGTH).fill(''));
            focusBox(0);
        }
        finally {
            setIsPending(false);
        }
    }
    async function handleResend() {
        if (!preAuthToken || cooldown > 0 || isLockedOut)
            return;
        try {
            await adminResendOtp(preAuthToken);
            startCooldown();
            setDigits(Array(OTP_LENGTH).fill(''));
            setError(null);
            setAttemptCount(0);
            focusBox(0);
        }
        catch {
            setError('Failed to resend code. Please try again.');
        }
    }
    const allFilled = digits.every((d) => d !== '');
    if (!preAuthToken)
        return null;
    return (_jsxs("div", { className: "flex min-h-screen w-full bg-[#fafaf8]", children: [_jsx(AdminLeftPanel, { tagline: "Two-factor authentication keeps your admin account secure." }), _jsx("div", { className: "flex flex-1 items-center justify-center px-6 py-16", children: _jsxs("form", { onSubmit: handleVerify, noValidate: true, className: cn('w-full max-w-[460px] rounded-[30px] bg-white p-10', 'shadow-[0_0_0_1px_rgba(14,15,12,0.08),0_24px_60px_-24px_rgba(14,15,12,0.18)]'), "aria-label": "OTP verification form", children: [_jsx("div", { className: cn('mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl', 'bg-[#e2f6d5] text-[#163300]'), "aria-hidden": "true", children: _jsx(Mail, { className: "h-6 w-6", strokeWidth: 2.25 }) }), _jsx("h1", { className: "text-[36px] font-black text-[#0e0f0c] tracking-[-1px] mb-2", style: { fontFeatureSettings: '"calt"' }, children: "Check your email" }), _jsx("p", { className: "text-[16px] text-[#868685] mb-1", children: "We sent a 6-digit code to" }), _jsx("p", { className: "text-[16px] font-bold text-[#0e0f0c] mb-8", children: email }), _jsx("div", { className: "flex gap-2.5 mb-6", role: "group", "aria-label": "One-time password input", children: digits.map((digit, i) => (_jsx(OtpBox, { index: i, value: digit, isFocused: focusedIndex === i, hasError: error !== null, inputRef: (el) => { inputRefs.current[i] = el; }, onChange: handleChange, onKeyDown: handleKeyDown, onFocus: setFocusedIndex, onPaste: handlePaste }, i))) }), error && (_jsxs("div", { role: "alert", className: cn('mb-5 flex items-start gap-2.5 rounded-2xl px-4 py-3.5', 'bg-[#fdeaeb] ring-1 ring-[#d03238]/25'), children: [_jsx(AlertTriangle, { className: "h-4 w-4 shrink-0 mt-0.5 text-[#d03238]", strokeWidth: 2.5 }), _jsx("p", { className: "text-[14px] font-semibold leading-snug text-[#d03238]", children: error })] })), _jsx("button", { type: "submit", disabled: isPending || isLockedOut || !allFilled, className: cn('w-full h-[52px] rounded-full mb-5', 'bg-[#9fe870] text-[#163300] text-[16px] font-bold', 'border-none cursor-pointer', 'transition-transform duration-150 ease-out', 'hover:enabled:scale-[1.02] active:enabled:scale-[0.98]', 'disabled:opacity-50 disabled:cursor-not-allowed', 'focus-visible:outline-2 focus-visible:outline-[#163300] focus-visible:outline-offset-2'), children: isPending ? 'Verifying…' : 'Verify Code' }), _jsx("div", { className: "text-center", children: _jsxs("span", { className: "text-[14px] text-[#868685]", children: ["Didn't receive it?", ' ', cooldown > 0 ? (_jsxs("span", { className: "text-[#a3a3a3] font-semibold", children: ["Resend code (", Math.floor(cooldown / 60), ":", String(cooldown % 60).padStart(2, '0'), ")"] })) : (_jsx("button", { type: "button", onClick: handleResend, disabled: isLockedOut, className: cn('text-[#163300] font-semibold bg-transparent border-none', 'cursor-pointer p-0 hover:underline', 'disabled:opacity-50 disabled:cursor-not-allowed'), children: "Resend code" }))] }) }), _jsxs("p", { className: "text-[12px] text-[#a3a3a3] text-center mt-3", children: ["Code expires in 10 minutes \u00B7", ' ', _jsx("button", { type: "button", onClick: () => navigate('/admin/login', { replace: true }), className: "text-[#163300] bg-transparent border-none cursor-pointer p-0 text-[12px] hover:underline", children: "Sign out" })] })] }) })] }));
}
