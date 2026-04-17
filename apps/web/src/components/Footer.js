import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Shared footer — used on all public pages
import { useState } from 'react';
import { Link } from 'react-router';
import { Logo } from './Logo';
// ─── Social icon SVGs ────────────────────────────────────────────────────────
function TwitterIcon() {
    return (_jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" }) }));
}
function LinkedInIcon() {
    return (_jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" }) }));
}
function GitHubIcon() {
    return (_jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" }) }));
}
function YouTubeIcon() {
    return (_jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" }) }));
}
// ─── Footer links data ────────────────────────────────────────────────────────
const LEARN_LINKS = [
    { label: 'Browse Courses', to: '/courses' },
    { label: 'Live Cohorts', to: '/courses' },
    { label: 'Course Catalog', to: '/courses' },
    { label: 'Student Login', to: '/login' },
    { label: 'Verify Certificate', to: '/courses' },
];
const COMPANY_LINKS = [
    { label: 'About', to: '/' },
    { label: 'Blog', to: '/' },
    { label: 'Careers', to: '/' },
    { label: 'Affiliates', to: '/' },
    { label: 'Contact Us', to: '/' },
];
const SUPPORT_LINKS = [
    { label: 'Help Center', to: '/' },
    { label: 'FAQ', to: '/' },
    { label: 'Refund Policy', to: '/' },
    { label: 'Community', to: '/' },
    { label: 'Status', to: '/' },
];
const SOCIAL_LINKS = [
    { label: 'Twitter / X', href: '#', icon: _jsx(TwitterIcon, {}) },
    { label: 'LinkedIn', href: '#', icon: _jsx(LinkedInIcon, {}) },
    { label: 'GitHub', href: '#', icon: _jsx(GitHubIcon, {}) },
    { label: 'YouTube', href: '#', icon: _jsx(YouTubeIcon, {}) },
];
function FooterCol({ heading, links }) {
    return (_jsxs("div", { children: [_jsx("p", { style: {
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.35)',
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    marginBottom: 20,
                }, children: heading }), _jsx("nav", { children: _jsx("ul", { style: { listStyle: 'none', padding: 0, margin: 0 }, children: links.map((l) => (_jsx("li", { style: { marginBottom: 11 }, children: _jsx(Link, { to: l.to, style: {
                                fontSize: 14,
                                color: 'rgba(255,255,255,0.5)',
                                textDecoration: 'none',
                                transition: 'color 0.15s',
                            }, onMouseEnter: (e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)'), onMouseLeave: (e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)'), children: l.label }) }, l.label))) }) })] }));
}
// ─── Newsletter form ──────────────────────────────────────────────────────────
function NewsletterForm() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [focused, setFocused] = useState(false);
    function handleSubmit(e) {
        e.preventDefault();
        if (!email.trim())
            return;
        setSubmitted(true);
    }
    if (submitted) {
        return (_jsxs("div", { style: {
                background: 'rgba(74,154,212,0.12)',
                border: '1px solid rgba(74,154,212,0.3)',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
            }, children: [_jsx("span", { style: { fontSize: 18 }, children: "\u2713" }), _jsxs("div", { children: [_jsx("p", { style: { fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }, children: "You're on the list!" }), _jsx("p", { style: { fontSize: 12, color: 'rgba(255,255,255,0.5)' }, children: "We'll notify you when new cohorts open." })] })] }));
    }
    return (_jsxs("form", { onSubmit: handleSubmit, noValidate: true, children: [_jsxs("div", { style: {
                    display: 'flex',
                    gap: 8,
                    marginBottom: 10,
                }, children: [_jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), onFocus: () => setFocused(true), onBlur: () => setFocused(false), placeholder: "your@email.com", required: true, style: {
                            flex: 1,
                            padding: '11px 16px',
                            borderRadius: 10,
                            border: focused
                                ? '1.5px solid rgba(74,154,212,0.6)'
                                : '1.5px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.06)',
                            color: '#fff',
                            fontSize: 14,
                            outline: 'none',
                            fontFamily: "'Inter', sans-serif",
                            transition: 'border-color 0.15s',
                        } }), _jsx("button", { type: "submit", style: {
                            padding: '11px 20px',
                            borderRadius: 10,
                            background: '#4a9ad4',
                            color: '#0d1a3a',
                            fontSize: 14,
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif",
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                        }, onMouseEnter: (e) => (e.currentTarget.style.background = '#5aaee0'), onMouseLeave: (e) => (e.currentTarget.style.background = '#4a9ad4'), children: "Notify Me" })] }), _jsx("p", { style: { fontSize: 12, color: 'rgba(255,255,255,0.3)' }, children: "No spam. Unsubscribe any time." })] }));
}
// ─── Main Footer ──────────────────────────────────────────────────────────────
export function Footer() {
    return (_jsxs("footer", { style: { background: '#0d1a3a' }, children: [_jsx("style", { children: `
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
            padding: 48px 20px 36px !important;
            gap: 32px !important;
          }
          .footer-bottom {
            padding: 16px 20px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 8px !important;
          }
          .footer-legal { gap: 12px !important; flex-wrap: wrap !important; }
        }
      ` }), _jsxs("div", { className: "footer-grid", style: {
                    padding: '72px 80px 56px',
                    display: 'grid',
                    gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1.8fr',
                    gap: 40,
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                }, children: [_jsxs("div", { children: [_jsx(Link, { to: "/", style: { display: 'inline-block', textDecoration: 'none', marginBottom: 14 }, children: _jsx(Logo, { size: "md", variant: "dark" }) }), _jsx("p", { style: {
                                    fontSize: 14,
                                    color: 'rgba(255,255,255,0.45)',
                                    lineHeight: 1.7,
                                    marginBottom: 28,
                                    maxWidth: 240,
                                }, children: "The AI education platform built for builders. Learn by shipping real projects, not watching lectures." }), _jsx("div", { style: { display: 'flex', gap: 8, marginBottom: 28 }, children: SOCIAL_LINKS.map((s) => (_jsx("a", { href: s.href, "aria-label": s.label, style: {
                                        width: 36,
                                        height: 36,
                                        borderRadius: 9,
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        background: 'rgba(255,255,255,0.04)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'rgba(255,255,255,0.45)',
                                        textDecoration: 'none',
                                        transition: 'all 0.15s',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.background = 'rgba(74,154,212,0.15)';
                                        e.currentTarget.style.borderColor = 'rgba(74,154,212,0.4)';
                                        e.currentTarget.style.color = '#4a9ad4';
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
                                    }, children: s.icon }, s.label))) }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [
                                    { icon: '🔒', text: 'Stripe-secured payments' },
                                    { icon: '✅', text: '30-day money-back guarantee' },
                                ].map((b) => (_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        fontSize: 12,
                                        color: 'rgba(255,255,255,0.35)',
                                    }, children: [_jsx("span", { style: { fontSize: 13 }, children: b.icon }), b.text] }, b.text))) })] }), _jsx(FooterCol, { heading: "Learn", links: LEARN_LINKS }), _jsx(FooterCol, { heading: "Company", links: COMPANY_LINKS }), _jsx(FooterCol, { heading: "Support", links: SUPPORT_LINKS }), _jsxs("div", { children: [_jsx("p", { style: {
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: 'rgba(255,255,255,0.35)',
                                    letterSpacing: 1.2,
                                    textTransform: 'uppercase',
                                    marginBottom: 20,
                                }, children: "Stay in the loop" }), _jsx("p", { style: {
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: '#fff',
                                    lineHeight: 1.4,
                                    marginBottom: 8,
                                }, children: "Get early access to new cohorts" }), _jsx("p", { style: {
                                    fontSize: 13,
                                    color: 'rgba(255,255,255,0.45)',
                                    lineHeight: 1.6,
                                    marginBottom: 20,
                                }, children: "New AI cohorts sell out fast. Be first to know when spots open." }), _jsx(NewsletterForm, {}), _jsxs("div", { style: { marginTop: 28 }, children: [_jsx("p", { style: {
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: 'rgba(255,255,255,0.25)',
                                            letterSpacing: 1,
                                            textTransform: 'uppercase',
                                            marginBottom: 12,
                                        }, children: "We offer" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [
                                            { dot: '#4a9ad4', label: 'Recorded courses', sub: 'Self-paced, lifetime access' },
                                            { dot: '#ff8c5a', label: 'Live cohorts', sub: 'Scheduled with instructor' },
                                            { dot: '#a8d4f0', label: 'Combined cohorts', sub: 'Recorded + live sessions' },
                                        ].map((t) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx("div", { style: {
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        background: t.dot,
                                                        flexShrink: 0,
                                                    } }), _jsxs("div", { children: [_jsx("span", { style: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }, children: t.label }), _jsx("span", { style: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginLeft: 6 }, children: t.sub })] })] }, t.label))) })] })] })] }), _jsxs("div", { className: "footer-bottom", style: {
                    padding: '20px 80px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                }, children: [_jsxs("p", { style: { fontSize: 13, color: 'rgba(255,255,255,0.25)' }, children: ["\u00A9 ", new Date().getFullYear(), " nextaibuilder. All rights reserved."] }), _jsx("nav", { className: "footer-legal", style: { display: 'flex', gap: 20 }, "aria-label": "Legal", children: ['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((l) => (_jsx("a", { href: "#", style: {
                                fontSize: 13,
                                color: 'rgba(255,255,255,0.25)',
                                textDecoration: 'none',
                                transition: 'color 0.15s',
                            }, onMouseEnter: (e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)'), onMouseLeave: (e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)'), children: l }, l))) })] })] }));
}
