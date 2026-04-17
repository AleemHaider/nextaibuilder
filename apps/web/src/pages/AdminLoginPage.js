import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-35 — Admin login page (email + password, optional OTP redirect)
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { adminLogin } from '../lib/api';
import { Logo } from '../components/Logo';
// ---------------------------------------------------------------------------
// Left panel decorative circles (from 05-admin-auth.html)
// ---------------------------------------------------------------------------
function LeftDecoCircles() {
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                    position: 'absolute',
                    bottom: -40,
                    right: -40,
                    width: 240,
                    height: 240,
                    borderRadius: '50%',
                    background: 'rgba(74,154,212,0.08)',
                    border: '1px solid rgba(74,154,212,0.15)',
                }, "aria-hidden": "true" }), _jsx("div", { style: {
                    position: 'absolute',
                    bottom: -80,
                    right: -80,
                    width: 340,
                    height: 340,
                    borderRadius: '50%',
                    background: 'rgba(74,154,212,0.04)',
                    border: '1px solid rgba(74,154,212,0.08)',
                }, "aria-hidden": "true" })] }));
}
export function AdminLeftPanel({ tagline }) {
    return (_jsxs("div", { style: {
            width: 500,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: 80,
            minHeight: '100vh',
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #0d1a3a 0%, #1a2744 60%, #2d4a8a 100%)',
        }, children: [_jsxs("div", { style: { position: 'relative', zIndex: 1 }, children: [_jsx("div", { style: { marginBottom: 48 }, children: _jsx(Logo, { size: "md", variant: "dark" }) }), _jsxs("div", { style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            background: 'rgba(74,154,212,0.2)',
                            border: '1px solid rgba(74,154,212,0.3)',
                            color: '#4a9ad4',
                            fontSize: 13,
                            fontWeight: 600,
                            padding: '6px 14px',
                            borderRadius: 9999,
                            marginBottom: 24,
                        }, children: [_jsx("span", { "aria-hidden": "true", children: "\uD83D\uDD10" }), "Admin Portal"] }), _jsx("h1", { style: {
                            fontSize: 44,
                            fontWeight: 900,
                            color: '#fff',
                            lineHeight: 0.9,
                            letterSpacing: -1.5,
                            marginBottom: 20,
                        }, children: tagline }), _jsx("p", { style: {
                            fontSize: 17,
                            color: 'rgba(255,255,255,0.55)',
                            lineHeight: 1.6,
                        }, children: "Manage cohorts, enrollments, payments, and your team from one powerful dashboard." })] }), _jsx(LeftDecoCircles, {})] }));
}
// ---------------------------------------------------------------------------
// AdminLoginPage
// ---------------------------------------------------------------------------
export default function AdminLoginPage() {
    const { isAuthenticated, isLoading, user } = useAuth();
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
    const inputStyle = (errorState) => ({
        width: '100%',
        height: 48,
        borderRadius: 12,
        border: `1.5px solid ${errorState ? '#d03238' : 'rgba(26,39,68,0.15)'}`,
        background: errorState ? '#fef2f2' : '#f3f3f5',
        padding: '0 16px',
        fontSize: 15,
        color: '#1a2744',
        fontFamily: "'Inter', sans-serif",
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s, background 0.15s',
    });
    return (_jsxs("div", { style: { display: 'flex', minHeight: '100vh', width: '100%' }, children: [_jsx(AdminLeftPanel, { tagline: "Course administration made simple." }), _jsx("div", { style: {
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '60px',
                    background: '#f8f9fb',
                }, children: _jsxs("form", { onSubmit: handleSubmit, noValidate: true, style: { width: '100%', maxWidth: 420 }, "aria-label": "Admin sign in form", children: [_jsx("h1", { style: {
                                fontSize: 36,
                                fontWeight: 900,
                                color: '#1a2744',
                                letterSpacing: -1,
                                marginBottom: 6,
                            }, children: "Admin Sign In" }), _jsx("p", { style: { fontSize: 16, color: '#717182', marginBottom: 36 }, children: "Access the nextaibuilder admin portal" }), hasError && (_jsxs("div", { role: "alert", style: {
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                                marginBottom: 24,
                                background: '#fdeaeb',
                                border: '1px solid rgba(208,50,56,0.25)',
                                borderRadius: 12,
                                padding: '14px 16px',
                            }, children: [_jsx("span", { style: { fontSize: 16, flexShrink: 0 }, "aria-hidden": "true", children: "\u26A0\uFE0F" }), _jsx("p", { style: { fontSize: 14, color: '#d03238', fontWeight: 500, lineHeight: 1.4 }, children: error })] })), _jsxs("div", { style: { marginBottom: 18 }, children: [_jsx("label", { htmlFor: "admin-email", style: {
                                        display: 'block',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: '#1a2744',
                                        marginBottom: 6,
                                    }, children: "Email address" }), _jsx("input", { id: "admin-email", type: "email", autoComplete: "email", placeholder: "admin@nextaibuilder.com", value: email, onChange: (e) => setEmail(e.target.value), required: true, style: inputStyle(hasError) })] }), _jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("label", { htmlFor: "admin-password", style: {
                                        display: 'block',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: '#1a2744',
                                        marginBottom: 6,
                                    }, children: "Password" }), _jsx("input", { id: "admin-password", type: "password", autoComplete: "current-password", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value), required: true, style: inputStyle(hasError) })] }), _jsx(Link, { to: "/admin/forgot-password", style: {
                                display: 'block',
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#4a9ad4',
                                textDecoration: 'none',
                                textAlign: 'right',
                                marginBottom: 8,
                            }, children: "Forgot password?" }), _jsx("button", { type: "submit", disabled: isPending, style: {
                                width: '100%',
                                height: 52,
                                borderRadius: 9999,
                                background: '#4a9ad4',
                                color: '#0d1a3a',
                                fontSize: 16,
                                fontWeight: 700,
                                border: 'none',
                                cursor: isPending ? 'not-allowed' : 'pointer',
                                opacity: isPending ? 0.5 : 1,
                                marginTop: 8,
                                fontFamily: "'Inter', sans-serif",
                                transition: 'opacity 0.15s',
                            }, children: isPending ? 'Signing in…' : 'Sign In' })] }) })] }));
}
