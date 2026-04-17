import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-155 — Student OAuth login page (Google + Apple)
import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { loginWithGoogle, loginWithApple, loginStudent } from '../lib/api';
// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function GoogleIcon() {
    return (_jsxs("svg", { width: "18", height: "18", viewBox: "0 0 48 48", "aria-hidden": "true", children: [_jsx("path", { fill: "#EA4335", d: "M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.1-6.1C34.39 3.13 29.45 1 24 1 14.82 1 6.96 6.43 3.18 14.3l7.08 5.5C12.04 13.58 17.56 9.5 24 9.5z" }), _jsx("path", { fill: "#4285F4", d: "M46.64 24.52c0-1.64-.15-3.22-.43-4.74H24v9h12.74c-.55 2.98-2.2 5.5-4.7 7.2l7.18 5.58C43.26 37.74 46.64 31.62 46.64 24.52z" }), _jsx("path", { fill: "#FBBC05", d: "M10.26 28.2a14.53 14.53 0 0 1 0-8.4L3.18 14.3A23.94 23.94 0 0 0 0 24c0 3.86.93 7.5 2.58 10.7l7.68-5.97-.01-.53z" }), _jsx("path", { fill: "#34A853", d: "M24 47c5.45 0 10.03-1.8 13.37-4.9l-7.18-5.58C28.4 38.36 26.3 39 24 39c-6.44 0-11.96-4.08-13.74-9.8l-7.68 5.97C6.96 41.57 14.82 47 24 47z" }), _jsx("path", { fill: "none", d: "M0 0h48v48H0z" })] }));
}
function AppleIcon() {
    return (_jsx("svg", { width: "15", height: "19", viewBox: "0 0 814 1000", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.8-162.5-116.8C181.3 742 118 637.5 118 537c0-175.9 114.4-269.3 228.7-269.3 60.3 0 110.6 39.5 148.4 39.5 36 0 92.7-41.8 160.8-41.8 28.2 0 130.6 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" }) }));
}
// ---------------------------------------------------------------------------
// Avatar stack — social proof
// ---------------------------------------------------------------------------
const AVATARS = [
    { initials: 'AK', bg: '#4a9ad4' },
    { initials: 'SR', bg: '#ff8c5a' },
    { initials: 'MJ', bg: '#7bb8e0' },
    { initials: 'PL', bg: '#2d5a8e' },
    { initials: 'TW', bg: '#4a9ad4' },
];
// ---------------------------------------------------------------------------
// Left-panel perks
// ---------------------------------------------------------------------------
const PERKS = [
    { text: 'Project-first curriculum — ship something real' },
    { text: 'AI-validated tool setup at every step' },
    { text: 'Live instructor Q&A and code reviews' },
    { text: 'Verified certificate on completion' },
];
// ---------------------------------------------------------------------------
// StudentLoginPage
// ---------------------------------------------------------------------------
export default function StudentLoginPage() {
    const { isAuthenticated, isLoading, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname ??
        '/student/dashboard';
    const [oauthError, setOauthError] = useState(null);
    const [isPending, setIsPending] = useState(false);
    const [googleHov, setGoogleHov] = useState(false);
    const [appleHov, setAppleHov] = useState(false);
    const [submitHov, setSubmitHov] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    useEffect(() => {
        if (!isLoading && isAuthenticated)
            navigate(from, { replace: true });
    }, [isAuthenticated, isLoading, navigate, from]);
    async function handleGoogleLogin() {
        if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
            setOauthError('Google login is not configured yet — set VITE_GOOGLE_CLIENT_ID in .env');
            return;
        }
        setOauthError(null);
        setIsPending(true);
        try {
            const result = await loginWithGoogle('STUB_ID_TOKEN');
            login(result.accessToken, result.user);
            navigate(from, { replace: true });
        }
        catch (err) {
            setOauthError(err instanceof Error ? err.message : 'Google login failed');
        }
        finally {
            setIsPending(false);
        }
    }
    async function handleAppleLogin() {
        if (!import.meta.env.VITE_APPLE_CLIENT_ID) {
            setOauthError('Apple login is not configured yet — set VITE_APPLE_CLIENT_ID in .env');
            return;
        }
        setOauthError(null);
        setIsPending(true);
        try {
            const result = await loginWithApple('STUB_ID_TOKEN');
            login(result.accessToken, result.user);
            navigate(from, { replace: true });
        }
        catch (err) {
            setOauthError(err instanceof Error ? err.message : 'Apple login failed');
        }
        finally {
            setIsPending(false);
        }
    }
    async function handleEmailLogin(e) {
        e.preventDefault();
        if (!email || !password) {
            setOauthError('Please enter your email and password.');
            return;
        }
        setOauthError(null);
        setIsPending(true);
        try {
            const result = await loginStudent(email, password);
            login(result.accessToken, result.user);
            navigate(from, { replace: true });
        }
        catch (err) {
            setOauthError(err instanceof Error ? err.message : 'Login failed');
        }
        finally {
            setIsPending(false);
        }
    }
    if (isLoading)
        return null;
    return (_jsxs("div", { style: {
            display: 'flex',
            minHeight: '100vh',
            fontFamily: "'Inter', -apple-system, sans-serif",
        }, children: [_jsx("style", { children: `
        @keyframes pulse-glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes float-slow { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        .login-left-perk { transition: background 0.2s; }
        .login-left-perk:hover { background: rgba(255,255,255,0.07) !important; }
        .login-input:focus { border-color: #4a9ad4 !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(74,154,212,0.12) !important; }
        @media (max-width: 768px) {
          .login-left-panel { display: none !important; }
          .login-right-panel { min-width: 0 !important; width: 100% !important; }
          .login-right-inner { padding: 32px 20px !important; }
          .login-topbar { padding: 16px 20px !important; }
        }
      ` }), _jsxs("div", { className: "login-left-panel", style: {
                    width: '50%',
                    minWidth: 520,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '48px 56px 52px',
                    minHeight: '100vh',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#040e24',
                }, children: [_jsx("div", { "aria-hidden": "true", style: {
                            position: 'absolute',
                            inset: 0,
                            background: 'radial-gradient(ellipse 100% 80% at -10% 50%, rgba(74,154,212,0.25) 0%, transparent 60%),' +
                                'radial-gradient(ellipse 70% 60% at 110% 80%, rgba(255,140,90,0.12) 0%, transparent 55%)',
                            pointerEvents: 'none',
                        } }), _jsx("div", { "aria-hidden": "true", style: {
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                            backgroundSize: '48px 48px',
                            pointerEvents: 'none',
                        } }), _jsxs("div", { style: { position: 'relative', zIndex: 2 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64 }, children: [_jsx("div", { style: {
                                            width: 40,
                                            height: 40,
                                            borderRadius: 12,
                                            background: 'linear-gradient(135deg, #4a9ad4, #1a2744)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 4px 16px rgba(74,154,212,0.4)',
                                        }, children: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M4 15 L10 5 L16 15", stroke: "#fff", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("path", { d: "M7 11 L13 11", stroke: "#fff", strokeWidth: "2.2", strokeLinecap: "round" })] }) }), _jsx("span", { style: { fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }, children: "Product Builder Academy" })] }), _jsx("h1", { style: {
                                    fontSize: 'clamp(42px, 4vw, 56px)',
                                    fontWeight: 900,
                                    color: '#fff',
                                    lineHeight: 1.0,
                                    letterSpacing: -2,
                                    marginBottom: 0,
                                    marginTop: 64,
                                }, children: "Welcome back," }), _jsx("h1", { style: {
                                    fontSize: 'clamp(42px, 4vw, 56px)',
                                    fontWeight: 900,
                                    lineHeight: 1.0,
                                    letterSpacing: -2,
                                    marginBottom: 16,
                                    background: 'linear-gradient(90deg, #4a9ad4, #7bb8e0)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }, children: "builder." }), _jsx("p", { style: {
                                    fontSize: 15,
                                    color: 'rgba(255,255,255,0.5)',
                                    lineHeight: 1.65,
                                    maxWidth: 340,
                                    marginBottom: 40,
                                }, children: "Sign in to continue your learning journey and pick up right where you left off." }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: PERKS.map((p) => (_jsxs("div", { className: "login-left-perk", style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '10px 14px',
                                        borderRadius: 12,
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.07)',
                                    }, children: [_jsx("div", { style: {
                                                width: 26,
                                                height: 26,
                                                borderRadius: '50%',
                                                background: 'rgba(74,154,212,0.2)',
                                                border: '1px solid rgba(74,154,212,0.4)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }, children: _jsx("svg", { width: "11", height: "9", viewBox: "0 0 11 9", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M1 4.5L4 7.5L10 1.5", stroke: "#4a9ad4", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) }) }), _jsx("span", { style: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, fontWeight: 500 }, children: p.text })] }, p.text))) })] }), _jsx("div", { style: { position: 'relative', zIndex: 2 }, children: _jsxs("div", { style: {
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 16,
                                padding: '20px 22px',
                                marginBottom: 0,
                            }, children: [_jsx("div", { style: { display: 'flex', gap: 3, marginBottom: 12 }, children: [1, 2, 3, 4, 5].map((i) => (_jsx("svg", { width: "13", height: "13", viewBox: "0 0 12 12", fill: "#FFB800", "aria-hidden": "true", children: _jsx("path", { d: "M6 0l1.5 4.5H12L8.25 7.25l1.5 4.5L6 9.25l-3.75 2.5 1.5-4.5L0 4.5h4.5z" }) }, i))) }), _jsx("p", { style: {
                                        fontSize: 13,
                                        color: 'rgba(255,255,255,0.72)',
                                        lineHeight: 1.6,
                                        fontStyle: 'italic',
                                        marginBottom: 16,
                                    }, children: "\"Within 3 weeks I shipped a working AI tool and landed a $120k offer. This cohort changed my career trajectory.\"" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }, children: [_jsx("div", { style: {
                                                width: 30,
                                                height: 30,
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #ff8c5a, #cc4a00)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: '#fff',
                                                flexShrink: 0,
                                            }, children: "SR" }), _jsxs("div", { children: [_jsx("p", { style: { fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1 }, children: "Sarah R." }), _jsx("p", { style: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }, children: "Software Engineer \u00B7 cohort graduate" })] })] }), _jsxs("div", { style: { borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("div", { style: { display: 'flex' }, children: AVATARS.map((a, i) => (_jsx("div", { style: {
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: '50%',
                                                    background: a.bg,
                                                    border: '2px solid rgba(4,14,36,0.8)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 9,
                                                    fontWeight: 700,
                                                    color: '#fff',
                                                    marginLeft: i === 0 ? 0 : -10,
                                                    zIndex: AVATARS.length - i,
                                                    position: 'relative',
                                                }, children: a.initials }, a.initials))) }), _jsxs("div", { children: [_jsx("p", { style: { fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1 }, children: "500+ builders enrolled" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }, children: [Array.from({ length: 5 }).map((_, i) => (_jsx("svg", { width: "10", height: "10", viewBox: "0 0 12 12", fill: "#FFB800", "aria-hidden": "true", children: _jsx("path", { d: "M6 0l1.5 4.5H12L8.25 7.25l1.5 4.5L6 9.25l-3.75 2.5 1.5-4.5L0 4.5h4.5z" }) }, i))), _jsx("span", { style: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 3 }, children: "4.9/5" })] })] })] })] }) })] }), _jsxs("div", { className: "login-right-panel", style: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#fff',
                    position: 'relative',
                }, children: [_jsxs("div", { className: "login-topbar", style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '20px 40px',
                            borderBottom: '1px solid rgba(26,39,68,0.07)',
                        }, children: [_jsx("span", { style: { fontSize: 13, color: '#717182' }, children: "New here?" }), _jsx(Link, { to: "/signup", style: {
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: '#1a2744',
                                    textDecoration: 'none',
                                    padding: '8px 18px',
                                    borderRadius: 10,
                                    border: '1.5px solid rgba(26,39,68,0.12)',
                                    background: '#fff',
                                    boxShadow: '0 1px 3px rgba(26,39,68,0.06)',
                                }, children: "Create account" })] }), _jsx("div", { className: "login-right-inner", style: {
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '48px',
                        }, children: _jsxs("div", { style: { width: '100%', maxWidth: 400 }, children: [_jsx("h2", { style: {
                                        fontSize: 34,
                                        fontWeight: 900,
                                        color: '#1a2744',
                                        letterSpacing: -1.5,
                                        lineHeight: 1.1,
                                        marginBottom: 6,
                                    }, children: "Sign in" }), _jsx("p", { style: { fontSize: 14, color: '#717182', marginBottom: 28, lineHeight: 1.5 }, children: "Continue your learning journey where you left off." }), oauthError && (_jsxs("div", { role: "alert", style: {
                                        marginBottom: 20,
                                        background: '#fff5f5',
                                        border: '1px solid #fca5a5',
                                        borderRadius: 12,
                                        padding: '12px 16px',
                                    }, children: [_jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'flex-start' }, children: [_jsx("span", { style: { fontSize: 14, flexShrink: 0 }, children: "\u26A0\uFE0F" }), _jsx("p", { style: { fontSize: 13, color: '#dc2626', lineHeight: 1.4 }, children: oauthError })] }), oauthError.toLowerCase().includes('google') && (_jsx("div", { style: { marginTop: 10, paddingTop: 10, borderTop: '1px solid #fecaca' }, children: _jsxs("button", { type: "button", onClick: handleGoogleLogin, style: {
                                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                                    fontSize: 13, fontWeight: 700, color: '#111827',
                                                    background: '#fff', border: '1.5px solid #d1d5db',
                                                    padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                                                    fontFamily: "'Inter', sans-serif",
                                                }, children: [_jsx(GoogleIcon, {}), " Sign in with Google instead"] }) })), oauthError.toLowerCase().includes('no account') && (_jsx("div", { style: { marginTop: 10, paddingTop: 10, borderTop: '1px solid #fecaca' }, children: _jsx(Link, { to: "/signup", style: {
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    fontSize: 13, fontWeight: 700, color: '#fff',
                                                    background: '#1a2744', padding: '7px 16px', borderRadius: 8,
                                                    textDecoration: 'none',
                                                }, children: "Create a free account" }) }))] })), _jsxs("button", { type: "button", onClick: handleGoogleLogin, disabled: isPending, onMouseEnter: () => setGoogleHov(true), onMouseLeave: () => setGoogleHov(false), style: {
                                        width: '100%',
                                        height: 50,
                                        borderRadius: 12,
                                        border: `1.5px solid ${googleHov ? '#c8d4e0' : 'rgba(26,39,68,0.1)'}`,
                                        background: googleHov ? '#f9fafb' : '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 10,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: '#1a2744',
                                        cursor: isPending ? 'not-allowed' : 'pointer',
                                        opacity: isPending ? 0.5 : 1,
                                        transition: 'all 0.15s',
                                        fontFamily: "'Inter', sans-serif",
                                        boxShadow: '0 1px 3px rgba(26,39,68,0.06)',
                                    }, children: [_jsx(GoogleIcon, {}), "Continue with Google"] }), _jsxs("button", { type: "button", onClick: handleAppleLogin, disabled: isPending, onMouseEnter: () => setAppleHov(true), onMouseLeave: () => setAppleHov(false), style: {
                                        width: '100%',
                                        height: 50,
                                        borderRadius: 12,
                                        border: 'none',
                                        background: appleHov ? '#1f2937' : '#111827',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 10,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: '#fff',
                                        cursor: isPending ? 'not-allowed' : 'pointer',
                                        opacity: isPending ? 0.5 : 1,
                                        transition: 'background 0.15s',
                                        fontFamily: "'Inter', sans-serif",
                                        marginTop: 10,
                                    }, children: [_jsx(AppleIcon, {}), "Continue with Apple"] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 20 }, children: [_jsx("div", { style: { flex: 1, height: 1, background: 'rgba(26,39,68,0.08)' } }), _jsx("span", { style: { fontSize: 12, color: '#a3a3b8', fontWeight: 500, letterSpacing: 0.8, textTransform: 'uppercase' }, children: "or continue with email" }), _jsx("div", { style: { flex: 1, height: 1, background: 'rgba(26,39,68,0.08)' } })] }), _jsxs("form", { onSubmit: handleEmailLogin, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8 }, children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "student-email", style: { display: 'block', fontSize: 12, fontWeight: 600, color: '#1a2744', marginBottom: 6, letterSpacing: '-0.1px' }, children: "Email address" }), _jsx("input", { id: "student-email", type: "email", autoComplete: "email", placeholder: "you@example.com", value: email, onChange: (e) => setEmail(e.target.value), className: "login-input", style: {
                                                                width: '100%',
                                                                height: 48,
                                                                borderRadius: 12,
                                                                border: '1.5px solid rgba(26,39,68,0.1)',
                                                                background: '#f9fafb',
                                                                padding: '0 14px',
                                                                fontSize: 14,
                                                                color: '#1a2744',
                                                                fontFamily: "'Inter', sans-serif",
                                                                outline: 'none',
                                                                boxSizing: 'border-box',
                                                                transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                                                            }, onFocus: (e) => {
                                                                e.currentTarget.style.borderColor = '#4a9ad4';
                                                                e.currentTarget.style.background = '#fff';
                                                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,154,212,0.12)';
                                                            }, onBlur: (e) => {
                                                                e.currentTarget.style.borderColor = 'rgba(26,39,68,0.1)';
                                                                e.currentTarget.style.background = '#f9fafb';
                                                                e.currentTarget.style.boxShadow = 'none';
                                                            } })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "student-password", style: { display: 'block', fontSize: 12, fontWeight: 600, color: '#1a2744', marginBottom: 6, letterSpacing: '-0.1px' }, children: "Password" }), _jsx("input", { id: "student-password", type: "password", autoComplete: "current-password", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value), className: "login-input", style: {
                                                                width: '100%',
                                                                height: 48,
                                                                borderRadius: 12,
                                                                border: '1.5px solid rgba(26,39,68,0.1)',
                                                                background: '#f9fafb',
                                                                padding: '0 14px',
                                                                fontSize: 14,
                                                                color: '#1a2744',
                                                                fontFamily: "'Inter', sans-serif",
                                                                outline: 'none',
                                                                boxSizing: 'border-box',
                                                                transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                                                            }, onFocus: (e) => {
                                                                e.currentTarget.style.borderColor = '#4a9ad4';
                                                                e.currentTarget.style.background = '#fff';
                                                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,154,212,0.12)';
                                                            }, onBlur: (e) => {
                                                                e.currentTarget.style.borderColor = 'rgba(26,39,68,0.1)';
                                                                e.currentTarget.style.background = '#f9fafb';
                                                                e.currentTarget.style.boxShadow = 'none';
                                                            } })] })] }), _jsx("div", { style: { textAlign: 'right', marginTop: 6 }, children: _jsx("a", { href: "#", style: { fontSize: 12, fontWeight: 500, color: '#4a9ad4', textDecoration: 'none' }, children: "Forgot password?" }) }), _jsx("button", { type: "submit", disabled: isPending, onMouseEnter: () => setSubmitHov(true), onMouseLeave: () => setSubmitHov(false), style: {
                                                width: '100%',
                                                height: 52,
                                                borderRadius: 12,
                                                background: submitHov ? '#e87040' : '#ff8c5a',
                                                color: '#fff',
                                                fontSize: 15,
                                                fontWeight: 700,
                                                border: 'none',
                                                cursor: isPending ? 'not-allowed' : 'pointer',
                                                opacity: isPending ? 0.7 : 1,
                                                fontFamily: "'Inter', sans-serif",
                                                transition: 'all 0.2s ease',
                                                boxShadow: '0 4px 16px rgba(255,140,90,0.3)',
                                                marginTop: 24,
                                            }, children: isPending ? 'Signing in…' : 'Sign In' })] }), _jsxs("p", { style: { marginTop: 20, textAlign: 'center', fontSize: 13, color: '#717182' }, children: ["Don't have an account?", ' ', _jsx(Link, { to: "/signup", style: { color: '#4a9ad4', fontWeight: 600, textDecoration: 'none' }, children: "Create one free" })] }), _jsxs("p", { style: { marginTop: 12, textAlign: 'center', fontSize: 12, color: '#a3a3b8' }, children: ["Admin?", ' ', _jsx(Link, { to: "/admin/login", style: { color: '#717182', fontWeight: 600, textDecoration: 'none' }, children: "Sign in to admin portal" })] })] }) })] })] }));
}
