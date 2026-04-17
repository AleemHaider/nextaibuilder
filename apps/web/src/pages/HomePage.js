import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-28 — Public homepage (original design)
import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { Footer } from '../components/Footer';
import { usePageMeta } from '../hooks/usePageMeta';
// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------
const FEATURED_COURSES = [
    {
        title: 'Claude API Mastery',
        tagline: "Build production AI apps with Anthropic's API",
        coverClass: 'blue',
        badgeLabel: 'Recorded',
        badgeType: 'blue',
        price: '$499',
        installment: '3×$166/mo',
        meta: 'Self-paced · 24 lessons',
        slug: 'claude-api-mastery',
    },
    {
        title: 'AI Product Bootcamp',
        tagline: 'Ship your first AI product in 8 weeks',
        coverClass: 'orange',
        badgeLabel: 'Live Cohort',
        badgeType: 'orange',
        price: '$999',
        installment: '3×$333/mo',
        meta: 'Starts Jan 20 · 12 seats',
        slug: 'ai-product-bootcamp',
    },
    {
        title: 'Full-Stack AI Dev',
        tagline: 'End-to-end AI engineering from prompt to prod',
        coverClass: 'deep',
        badgeLabel: 'Combined',
        badgeType: 'navy',
        price: '$1,499',
        installment: '3×$499/mo',
        meta: 'Starts Feb 3 · 8 seats left',
        slug: 'full-stack-ai-dev',
    },
];
const FAQ_ITEMS = [
    {
        q: 'What is the difference between recorded and live cohorts?',
        a: 'Recorded cohorts are self-paced with video lessons you can watch anytime. Live cohorts have scheduled sessions with real-time instructor interaction and peer collaboration.',
    },
    {
        q: 'Can I pay in installments?',
        a: 'Yes! All courses offer a 3-installment payment plan. Your first payment is processed today, with the remaining two billed 30 and 60 days later.',
    },
    {
        q: 'Do I get lifetime access to course materials?',
        a: 'Yes, once enrolled you get lifetime access to all course materials, including future updates and new lessons added to the curriculum.',
    },
    {
        q: 'What if I miss a live session?',
        a: 'All live sessions are recorded and available within 24 hours. You will never miss content — recordings are stored in your student dashboard indefinitely.',
    },
    {
        q: 'What tools do I need to get started?',
        a: 'Just a computer and internet connection. Our AI-validated tool setup guides you through installing everything you need step by step.',
    },
    {
        q: 'Is there a refund policy?',
        a: 'Yes, we offer a full refund within 7 days of purchase if you are not satisfied for any reason. No questions asked.',
    },
];
// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function FaqItem({ q, a }) {
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { style: { borderBottom: '1px solid rgba(26,39,68,0.1)', padding: '24px 0' }, children: [_jsxs("button", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    gap: 16,
                }, onClick: () => setOpen((v) => !v), "aria-expanded": open, children: [_jsx("span", { style: { fontSize: 18, fontWeight: 600, color: '#1a2744', lineHeight: 1.4 }, children: q }), _jsx("div", { style: {
                            width: 24,
                            height: 24,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#717182',
                            fontSize: 18,
                        }, children: open ? _jsx(ChevronDown, { size: 20, "aria-hidden": "true" }) : _jsx(ChevronRight, { size: 20, "aria-hidden": "true" }) })] }), open && a && (_jsx("p", { style: { fontSize: 16, color: '#717182', lineHeight: 1.7, marginTop: 16, marginBottom: 0 }, children: a }))] }));
}
// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function HomePage() {
    usePageMeta({
        title: 'Build AI Products. Ship Real Projects.',
        description: 'Learn to build, deploy, and scale AI-powered products through hands-on cohorts and recorded courses.',
    });
    return (_jsxs("div", { style: { minHeight: '100vh', fontFamily: "'Inter', sans-serif", background: '#f8f9fb', color: '#1a2744' }, children: [_jsx("style", { children: `
        @media (max-width: 768px) {
          .hero-section { flex-direction: column !important; padding: 40px 20px !important; min-height: unset !important; }
          .hero-right { display: none !important; }
          .hero-title { font-size: clamp(40px, 10vw, 88px) !important; letter-spacing: -1px !important; }
          .hero-buttons { flex-direction: column !important; }
          .section-pad { padding: 64px 20px !important; }
          .props-grid { grid-template-columns: 1fr !important; }
          .course-types-grid { grid-template-columns: 1fr !important; }
          .featured-grid { grid-template-columns: 1fr !important; }
          .how-it-works-row { flex-direction: column !important; align-items: center !important; gap: 32px !important; }
          .hiw-connector { display: none !important; }
          .stats-row { flex-direction: column !important; gap: 32px !important; align-items: center !important; }
          .stats-number { font-size: 56px !important; }
          .pricing-callout { flex-direction: column !important; padding: 32px 20px !important; gap: 28px !important; }
          .pricing-boxes { grid-template-columns: 1fr !important; }
          .section-h2 { font-size: clamp(32px, 8vw, 48px) !important; }
          .footer-cta-h2 { font-size: clamp(32px, 8vw, 64px) !important; }
          .footer-cta-section { padding: 64px 20px !important; }
        }
      ` }), _jsx(TopNav, {}), _jsxs("section", { className: "hero-section", style: {
                    background: '#fff',
                    padding: '96px 80px',
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 600,
                    gap: 60,
                }, children: [_jsxs("div", { style: { flex: '0 0 55%' }, children: [_jsxs("div", { style: {
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: '#e8f4fd',
                                    color: '#1a2744',
                                    padding: '6px 14px',
                                    borderRadius: 9999,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 28,
                                }, children: [_jsx("span", { style: { width: 8, height: 8, background: '#4a9ad4', borderRadius: '50%', display: 'inline-block' } }), "AI Education Platform"] }), _jsxs("h1", { className: "hero-title", style: {
                                    fontSize: 88,
                                    fontWeight: 900,
                                    lineHeight: 0.88,
                                    color: '#1a2744',
                                    letterSpacing: -3,
                                    marginBottom: 28,
                                    margin: '0 0 28px 0',
                                }, children: ["Build AI", _jsx("br", {}), "Products.", _jsx("br", {}), _jsx("span", { style: { color: '#4a9ad4' }, children: "Ship Real" }), _jsx("br", {}), "Projects."] }), _jsx("p", { style: {
                                    fontSize: 20,
                                    fontWeight: 400,
                                    color: '#717182',
                                    lineHeight: 1.55,
                                    marginBottom: 40,
                                    maxWidth: 480,
                                }, children: "Learn to build, deploy, and scale AI-powered products through hands-on cohorts and recorded courses." }), _jsxs("div", { className: "hero-buttons", style: { display: 'flex', gap: 14, alignItems: 'center' }, children: [_jsx(Link, { to: "/courses", style: {
                                            padding: '16px 32px',
                                            borderRadius: 9999,
                                            fontSize: 17,
                                            fontWeight: 700,
                                            background: '#4a9ad4',
                                            color: '#0d1a3a',
                                            textDecoration: 'none',
                                            display: 'inline-block',
                                        }, children: "Browse Courses" }), _jsx(Link, { to: "#how-it-works", style: {
                                            padding: '16px 32px',
                                            borderRadius: 9999,
                                            fontSize: 17,
                                            fontWeight: 700,
                                            background: 'transparent',
                                            border: '2px solid #4a9ad4',
                                            color: '#4a9ad4',
                                            textDecoration: 'none',
                                            display: 'inline-block',
                                        }, children: "See How It Works" })] })] }), _jsx("div", { className: "hero-right", style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsxs("div", { style: {
                                width: '100%',
                                height: 460,
                                background: 'linear-gradient(135deg, #1a2744 0%, #2d4a8a 40%, #4a9ad4 100%)',
                                borderRadius: 40,
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
                            }, children: [_jsxs("div", { style: {
                                        position: 'absolute',
                                        top: 40,
                                        left: 30,
                                        width: 200,
                                        background: '#fff',
                                        borderRadius: 16,
                                        padding: '16px 20px',
                                        boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
                                    }, children: [_jsx("div", { style: {
                                                fontSize: 11,
                                                fontWeight: 600,
                                                padding: '3px 10px',
                                                borderRadius: 9999,
                                                display: 'inline-block',
                                                marginBottom: 8,
                                                background: '#e8f4fd',
                                                color: '#1a2744',
                                            }, children: "Recorded" }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 4 }, children: "Claude API Mastery" }), _jsx("div", { style: { fontSize: 11, color: '#717182' }, children: "24 lessons \u00B7 Self-paced" }), _jsx("div", { style: { height: 4, background: '#e8ecf4', borderRadius: 2, marginTop: 8 }, children: _jsx("div", { style: { height: '100%', width: '68%', borderRadius: 2, background: '#4a9ad4' } }) })] }), _jsxs("div", { style: {
                                        position: 'absolute',
                                        top: 120,
                                        right: 20,
                                        width: 180,
                                        background: '#fff',
                                        borderRadius: 16,
                                        padding: '16px 20px',
                                        boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
                                    }, children: [_jsx("div", { style: {
                                                fontSize: 11,
                                                fontWeight: 600,
                                                padding: '3px 10px',
                                                borderRadius: 9999,
                                                display: 'inline-block',
                                                marginBottom: 8,
                                                background: '#fff0e8',
                                                color: '#cc4a00',
                                            }, children: "Live Cohort" }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 4 }, children: "AI Product Bootcamp" }), _jsx("div", { style: { fontSize: 11, color: '#717182' }, children: "Starts Jan 20 \u00B7 12 seats" })] }), _jsxs("div", { style: {
                                        position: 'absolute',
                                        bottom: 60,
                                        left: 50,
                                        width: 220,
                                        background: '#fff',
                                        borderRadius: 16,
                                        padding: '16px 20px',
                                        boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
                                    }, children: [_jsx("div", { style: {
                                                fontSize: 11,
                                                fontWeight: 600,
                                                padding: '3px 10px',
                                                borderRadius: 9999,
                                                display: 'inline-block',
                                                marginBottom: 8,
                                                background: '#e8ecf4',
                                                color: '#1a2744',
                                            }, children: "Combined" }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 4 }, children: "Full-Stack AI Dev" }), _jsx("div", { style: { fontSize: 11, color: '#717182' }, children: "48 lessons + 8 live sessions" }), _jsx("div", { style: { height: 4, background: '#e8ecf4', borderRadius: 2, marginTop: 8 }, children: _jsx("div", { style: { height: '100%', width: '35%', borderRadius: 2, background: '#4a9ad4' } }) })] }), _jsxs("div", { style: {
                                        position: 'absolute',
                                        bottom: 30,
                                        right: 20,
                                        background: '#1a2744',
                                        color: '#fff',
                                        borderRadius: 12,
                                        padding: '10px 16px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                    }, children: [_jsx("span", { style: { color: '#4a9ad4', fontSize: 20, fontWeight: 900, display: 'block' }, children: "500+" }), "Students Enrolled"] })] }) })] }), _jsxs("section", { className: "section-pad", style: { background: '#f8f9fb', padding: '96px 80px' }, children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, color: '#4a9ad4', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12, margin: '0 0 12px' }, children: "Why nextaibuilder" }), _jsxs("h2", { className: "section-h2", style: { fontSize: 48, fontWeight: 900, color: '#1a2744', lineHeight: 0.9, letterSpacing: -1.5, marginBottom: 60, margin: '0 0 60px' }, children: ["Everything you need", _jsx("br", {}), "to ship AI products"] }), _jsx("div", { className: "props-grid", style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }, children: [
                            { icon: '🎯', title: 'Project-First Learning', desc: 'Every lesson is tied to a real deliverable. You leave each cohort with shipped code, not just notes.' },
                            { icon: '🤖', title: 'AI-Validated Tools', desc: 'Our AI verifies your tool setup at each step, so you never get stuck on configuration issues.' },
                            { icon: '💬', title: 'Live Expert Sessions', desc: 'Join live cohorts with direct instructor access, Q&A sessions, and real-time code reviews.' },
                        ].map((p) => (_jsxs("div", { style: {
                                background: '#fff',
                                borderRadius: 24,
                                padding: 36,
                                boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
                            }, children: [_jsx("div", { style: {
                                        width: 56,
                                        height: 56,
                                        background: '#e8f4fd',
                                        borderRadius: 14,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 20,
                                        fontSize: 24,
                                    }, children: p.icon }), _jsx("div", { style: { fontSize: 22, fontWeight: 700, color: '#1a2744', marginBottom: 10 }, children: p.title }), _jsx("div", { style: { fontSize: 16, fontWeight: 400, color: '#717182', lineHeight: 1.6 }, children: p.desc })] }, p.title))) })] }), _jsxs("section", { className: "section-pad", style: { background: '#fff', padding: '96px 80px' }, children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, color: '#4a9ad4', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }, children: "Learning Formats" }), _jsxs("h2", { className: "section-h2", style: { fontSize: 48, fontWeight: 900, color: '#1a2744', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 60px' }, children: ["Three ways to learn,", _jsx("br", {}), "one destination"] }), _jsx("div", { className: "course-types-grid", style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }, children: [
                            { icon: '📹', iconBg: '#e8f4fd', badge: 'Recorded', badgeBg: '#e8f4fd', badgeColor: '#1a2744', name: 'Self-Paced Courses', desc: 'Watch at your own pace. Rewind, rewatch, and revisit any lesson whenever you need it.' },
                            { icon: '🔴', iconBg: '#fff0e8', badge: 'Live Cohort', badgeBg: '#fff0e8', badgeColor: '#cc4a00', name: 'Live Cohorts', desc: 'Scheduled sessions with live instruction, peer collaboration, and real-time feedback.' },
                            { icon: '⚡', iconBg: '#e8ecf4', badge: 'Combined', badgeBg: '#e8ecf4', badgeColor: '#1a2744', name: 'Combined Cohorts', desc: 'Best of both — recorded content with live sessions layered in at key milestones.' },
                        ].map((t) => (_jsxs("div", { style: {
                                background: '#f8f9fb',
                                borderRadius: 30,
                                padding: 40,
                                boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
                            }, children: [_jsx("div", { style: {
                                        width: 64,
                                        height: 64,
                                        background: t.iconBg,
                                        borderRadius: 18,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 20,
                                        fontSize: 28,
                                    }, children: t.icon }), _jsx("div", { style: {
                                        fontSize: 12,
                                        fontWeight: 600,
                                        padding: '3px 10px',
                                        borderRadius: 9999,
                                        display: 'inline-block',
                                        marginBottom: 12,
                                        background: t.badgeBg,
                                        color: t.badgeColor,
                                    }, children: t.badge }), _jsx("div", { style: { fontSize: 24, fontWeight: 800, color: '#1a2744', marginBottom: 12 }, children: t.name }), _jsx("div", { style: { fontSize: 16, color: '#717182', lineHeight: 1.6, marginBottom: 20 }, children: t.desc }), _jsx(Link, { to: "/courses", style: { fontSize: 15, fontWeight: 600, color: '#4a9ad4', textDecoration: 'none' }, children: "Learn more \u2192" })] }, t.name))) })] }), _jsxs("section", { className: "section-pad", style: { background: '#f8f9fb', padding: '96px 80px' }, children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, color: '#4a9ad4', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }, children: "Featured Cohorts" }), _jsx("h2", { className: "section-h2", style: { fontSize: 48, fontWeight: 900, color: '#1a2744', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 60px' }, children: "Start learning today" }), _jsx("div", { className: "featured-grid", style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }, children: FEATURED_COURSES.map((c) => {
                            const coverGradient = c.coverClass === 'orange'
                                ? 'linear-gradient(135deg, #cc4a00, #ff8c5a)'
                                : c.coverClass === 'deep'
                                    ? 'linear-gradient(135deg, #0d1a3a, #2d4a8a)'
                                    : 'linear-gradient(135deg, #1a2744, #4a9ad4)';
                            const badgeBg = c.badgeType === 'orange' ? '#fff0e8' : c.badgeType === 'navy' ? '#e8ecf4' : '#e8f4fd';
                            const badgeColor = c.badgeType === 'orange' ? '#cc4a00' : '#1a2744';
                            return (_jsxs("div", { style: {
                                    background: '#fff',
                                    borderRadius: 30,
                                    overflow: 'hidden',
                                    boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
                                }, children: [_jsx("div", { style: {
                                            height: 200,
                                            background: coverGradient,
                                            position: 'relative',
                                        }, children: _jsx("div", { style: { position: 'absolute', top: 16, left: 16 }, children: _jsx("span", { style: {
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    padding: '4px 12px',
                                                    borderRadius: 9999,
                                                    background: badgeBg,
                                                    color: badgeColor,
                                                }, children: c.badgeLabel }) }) }), _jsxs("div", { style: { padding: 24 }, children: [_jsx("div", { style: { fontSize: 20, fontWeight: 700, color: '#1a2744', marginBottom: 8, lineHeight: 1.3 }, children: c.title }), _jsx("div", { style: { fontSize: 14, color: '#717182', marginBottom: 16 }, children: c.tagline }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, children: [_jsx("span", { style: { fontSize: 22, fontWeight: 800, color: '#1a2744' }, children: c.price }), _jsx("span", { style: { fontSize: 13, fontWeight: 600, color: '#ff8c5a' }, children: c.installment })] }), _jsxs("div", { style: { fontSize: 13, color: '#717182', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }, children: ["\uD83D\uDCC5 ", c.meta] }), _jsx(Link, { to: `/courses/${c.slug}`, style: {
                                                    display: 'block',
                                                    width: '100%',
                                                    padding: 12,
                                                    borderRadius: 9999,
                                                    background: '#4a9ad4',
                                                    color: '#0d1a3a',
                                                    fontSize: 15,
                                                    fontWeight: 700,
                                                    textAlign: 'center',
                                                    textDecoration: 'none',
                                                    boxSizing: 'border-box',
                                                }, children: "Enroll Now" })] })] }, c.title));
                        }) })] }), _jsxs("section", { id: "how-it-works", className: "section-pad", style: { background: '#fff', padding: '96px 80px' }, children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, color: '#4a9ad4', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }, children: "Process" }), _jsxs("h2", { className: "section-h2", style: { fontSize: 48, fontWeight: 900, color: '#1a2744', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 60px' }, children: ["Three steps to", _jsx("br", {}), "your first AI product"] }), _jsx("div", { className: "how-it-works-row", style: { display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative' }, children: [
                            { num: 1, title: 'Browse Courses', desc: 'Explore our catalog of recorded courses and live cohorts. Filter by format, topic, or level.' },
                            { num: 2, title: 'Enroll & Pay', desc: 'Secure checkout with Stripe or pay in 3 installments. Manual payment options also available.' },
                            { num: 3, title: 'Learn & Ship', desc: 'Follow the curriculum, set up your AI tools, and ship real projects with instructor support.' },
                        ].map((step, i) => (_jsxs("div", { style: { flex: 1, textAlign: 'center', position: 'relative', padding: '0 20px' }, children: [i < 2 && (_jsx("div", { className: "hiw-connector", style: {
                                        position: 'absolute',
                                        top: 32,
                                        left: '50%',
                                        right: '-50%',
                                        height: 2,
                                        background: 'repeating-linear-gradient(90deg, #4a9ad4 0, #4a9ad4 8px, transparent 8px, transparent 16px)',
                                        zIndex: 0,
                                    } })), _jsx("div", { style: {
                                        width: 64,
                                        height: 64,
                                        borderRadius: 9999,
                                        background: '#4a9ad4',
                                        color: '#fff',
                                        fontSize: 24,
                                        fontWeight: 900,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 20px',
                                        position: 'relative',
                                        zIndex: 1,
                                    }, children: step.num }), _jsx("div", { style: { fontSize: 22, fontWeight: 700, color: '#1a2744', marginBottom: 10 }, children: step.title }), _jsx("div", { style: { fontSize: 16, color: '#717182', lineHeight: 1.6 }, children: step.desc })] }, step.num))) })] }), _jsxs("section", { className: "section-pad", style: { background: '#1a2744', padding: '96px 80px', textAlign: 'center' }, children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }, children: "By the numbers" }), _jsxs("h2", { className: "section-h2", style: { fontSize: 48, fontWeight: 900, color: '#fff', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 40px' }, children: ["Trusted by builders", _jsx("br", {}), "around the world"] }), _jsx("div", { className: "stats-row", style: { display: 'flex', justifyContent: 'center', gap: 80, marginTop: 40 }, children: [
                            { number: '500+', label: 'Students Enrolled' },
                            { number: '12', label: 'Active Cohorts' },
                            { number: '95%', label: 'Completion Rate' },
                        ].map((s) => (_jsxs("div", { children: [_jsx("div", { className: "stats-number", style: { fontSize: 80, fontWeight: 900, color: '#4a9ad4', lineHeight: 1, letterSpacing: -2 }, children: s.number }), _jsx("div", { style: { fontSize: 18, fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginTop: 8 }, children: s.label })] }, s.label))) })] }), _jsx("section", { className: "section-pad", style: { background: '#f8f9fb', padding: '96px 80px' }, children: _jsxs("div", { className: "pricing-callout", style: {
                        background: 'linear-gradient(135deg, #1a2744 0%, #2d4a8a 100%)',
                        borderRadius: 40,
                        padding: 64,
                        display: 'flex',
                        gap: 60,
                        alignItems: 'center',
                    }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }, children: "Flexible Pricing" }), _jsxs("h2", { style: { fontSize: 48, fontWeight: 900, color: '#fff', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 16px' }, children: ["Pay your", _jsx("br", {}), "way"] }), _jsx("p", { style: { fontSize: 18, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: 0 }, children: "Choose full payment or spread the cost across 3 installments. Manual payment option also available." })] }), _jsxs("div", { className: "pricing-boxes", style: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }, children: [_jsxs("div", { style: {
                                        background: 'rgba(255,255,255,0.08)',
                                        borderRadius: 20,
                                        padding: 28,
                                        border: '1px solid rgba(255,255,255,0.12)',
                                    }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }, children: "Pay in Full" }), _jsx("div", { style: { fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: -1 }, children: "$999" }), _jsx("div", { style: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6 }, children: "One-time payment" })] }), _jsxs("div", { style: {
                                        background: 'rgba(74,154,212,0.2)',
                                        borderRadius: 20,
                                        padding: 28,
                                        border: '1px solid #4a9ad4',
                                    }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }, children: "Installment Plan" }), _jsxs("div", { style: { fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: -1 }, children: ["$333", _jsx("span", { style: { fontSize: 16, fontWeight: 500 }, children: "/mo" })] }), _jsx("div", { style: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6 }, children: "\u00D73 monthly payments" }), _jsx("div", { style: { fontSize: 14, fontWeight: 600, color: '#ff8c5a', marginTop: 8 }, children: "Most popular option" })] })] })] }) }), _jsxs("section", { className: "section-pad", style: { background: '#fff', padding: '96px 80px' }, children: [_jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, color: '#4a9ad4', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }, children: "FAQ" }), _jsxs("h2", { className: "section-h2", style: { fontSize: 48, fontWeight: 900, color: '#1a2744', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 60px' }, children: ["Frequently asked", _jsx("br", {}), "questions"] })] }), _jsx("div", { style: { maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }, children: FAQ_ITEMS.map((item) => (_jsx(FaqItem, { q: item.q, a: item.a }, item.q))) })] }), _jsxs("section", { className: "footer-cta-section", style: { background: '#1a2744', padding: '96px 80px', textAlign: 'center' }, children: [_jsxs("h2", { className: "footer-cta-h2", style: { fontSize: 64, fontWeight: 900, color: '#fff', lineHeight: 0.9, letterSpacing: -2, marginBottom: 32, margin: '0 0 32px' }, children: ["Ready to build", _jsx("br", {}), "your first AI product?"] }), _jsx(Link, { to: "/courses", style: {
                            display: 'inline-block',
                            padding: '18px 40px',
                            borderRadius: 9999,
                            fontSize: 18,
                            fontWeight: 700,
                            background: '#4a9ad4',
                            color: '#0d1a3a',
                            textDecoration: 'none',
                        }, children: "Get Started Today" }), _jsxs("div", { style: { marginTop: 24, display: 'flex', gap: 24, justifyContent: 'center' }, children: [_jsx(Link, { to: "/privacy", style: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }, children: "Privacy Policy" }), _jsx(Link, { to: "/terms", style: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }, children: "Terms of Service" })] })] }), _jsx(Footer, {})] }));
}
const __BUILD_MARKER__ = "newdesign-v2";
