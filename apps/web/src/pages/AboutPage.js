import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// About page — nextaibuilder platform
import { Link } from 'react-router';
import { TopNav } from '../components/TopNav';
const TEAM = [
    {
        name: 'Aleem Haider',
        role: 'Founder & Lead Instructor',
        bio: 'Builder, educator, and AI product enthusiast. Helping founders ship real AI products.',
        initials: 'AH',
        accent: '#4a9ad4',
    },
];
const VALUES = [
    {
        icon: '🎯',
        title: 'Build, don\'t just learn',
        desc: 'Every cohort ends with a deployed, production-grade project — not a certificate you forget about.',
        bg: 'linear-gradient(135deg,#eef6fd,#c8e4f7)',
    },
    {
        icon: '👥',
        title: 'Community first',
        desc: 'You learn faster alongside people who share your goals. Our cohorts keep groups intentionally small.',
        bg: 'linear-gradient(135deg,#f3f0ff,#d6c9fc)',
    },
    {
        icon: '🚀',
        title: 'AI-native curriculum',
        desc: 'We update every cohort as the tools evolve. No stale content — just what\'s relevant right now.',
        bg: 'linear-gradient(135deg,#fff7ed,#fed7aa)',
    },
    {
        icon: '🔓',
        title: 'Transparent pricing',
        desc: 'Instalment plans, manual payment options, and no hidden fees. Education should be accessible.',
        bg: 'linear-gradient(135deg,#ecfdf5,#a7f3d0)',
    },
];
export default function AboutPage() {
    return (_jsxs("div", { style: { minHeight: '100vh', background: '#f8f9fb' }, children: [_jsx(TopNav, {}), _jsxs("main", { style: { maxWidth: 1100, margin: '0 auto', padding: '48px 24px 80px' }, children: [_jsxs("div", { style: {
                            borderRadius: 24,
                            background: 'linear-gradient(135deg, #080f24 0%, #102040 45%, #1a3060 100%)',
                            padding: 'clamp(36px,6vw,64px) clamp(28px,6vw,64px)',
                            marginBottom: 56,
                            position: 'relative',
                            overflow: 'hidden',
                        }, children: [_jsx("div", { style: {
                                    position: 'absolute', top: -80, right: -60, width: 320, height: 320,
                                    borderRadius: '50%',
                                    background: 'radial-gradient(circle,rgba(74,154,212,0.18) 0%,transparent 70%)',
                                    pointerEvents: 'none',
                                } }), _jsx("div", { style: {
                                    position: 'absolute', bottom: -60, left: '35%', width: 200, height: 200,
                                    borderRadius: '50%',
                                    background: 'radial-gradient(circle,rgba(74,154,212,0.10) 0%,transparent 70%)',
                                    pointerEvents: 'none',
                                } }), _jsx("p", { style: {
                                    fontSize: 11, fontWeight: 700, letterSpacing: '1.4px',
                                    color: 'rgba(74,154,212,0.85)', textTransform: 'uppercase',
                                    marginBottom: 14, position: 'relative',
                                }, children: "About nextaibuilder" }), _jsxs("h1", { style: {
                                    fontSize: 'clamp(26px,4vw,44px)', fontWeight: 800, color: '#fff',
                                    lineHeight: 1.2, marginBottom: 18, position: 'relative',
                                    maxWidth: 640,
                                }, children: ["We help builders ship", _jsx("br", {}), _jsx("span", { style: { color: '#7bb8e0' }, children: "real AI products." })] }), _jsx("p", { style: {
                                    fontSize: 17, color: 'rgba(255,255,255,0.62)', lineHeight: 1.65,
                                    maxWidth: 560, marginBottom: 32, position: 'relative',
                                }, children: "nextaibuilder is a cohort-based learning platform where founders, developers, and product thinkers learn to build and ship AI products \u2014 with live sessions, real projects, and a community that actually shows up." }), _jsx(Link, { to: "/courses", style: {
                                    display: 'inline-block',
                                    background: 'linear-gradient(135deg,#4a9ad4,#2d7ab8)',
                                    color: '#fff', fontWeight: 700, fontSize: 15,
                                    padding: '12px 28px', borderRadius: 100,
                                    textDecoration: 'none',
                                    boxShadow: '0 4px 20px rgba(74,154,212,0.40)',
                                    position: 'relative',
                                }, children: "Browse cohorts \u2192" })] }), _jsx("p", { style: {
                            fontSize: 11, fontWeight: 800, color: '#717182',
                            textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 20,
                        }, children: "What we stand for" }), _jsx("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                            gap: 18,
                            marginBottom: 60,
                        }, children: VALUES.map((v) => (_jsxs("div", { style: {
                                background: '#fff',
                                borderRadius: 20,
                                padding: '26px 22px',
                                boxShadow: 'rgba(26,39,68,0.07) 0 0 0 1px, rgba(26,39,68,0.04) 0 4px 16px',
                                display: 'flex', flexDirection: 'column', gap: 14,
                            }, children: [_jsx("div", { style: {
                                        width: 52, height: 52, borderRadius: 14,
                                        background: v.bg,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 26, flexShrink: 0,
                                    }, children: v.icon }), _jsxs("div", { children: [_jsx("p", { style: { fontSize: 15, fontWeight: 700, color: '#1a2744', marginBottom: 6, lineHeight: 1.3 }, children: v.title }), _jsx("p", { style: { fontSize: 13, color: '#717182', lineHeight: 1.55, margin: 0 }, children: v.desc })] })] }, v.title))) }), _jsx("p", { style: {
                            fontSize: 11, fontWeight: 800, color: '#717182',
                            textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 20,
                        }, children: "The team" }), _jsx("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                            gap: 18,
                            marginBottom: 60,
                        }, children: TEAM.map((member) => (_jsxs("div", { style: {
                                background: '#fff',
                                borderRadius: 20,
                                padding: '28px 24px',
                                boxShadow: 'rgba(26,39,68,0.07) 0 0 0 1px, rgba(26,39,68,0.04) 0 4px 16px',
                                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14,
                            }, children: [_jsx("div", { style: {
                                        width: 60, height: 60, borderRadius: '50%',
                                        background: `linear-gradient(135deg,${member.accent}30,${member.accent}60)`,
                                        border: `2px solid ${member.accent}40`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 20, fontWeight: 800, color: member.accent,
                                    }, children: member.initials }), _jsxs("div", { children: [_jsx("p", { style: { fontSize: 16, fontWeight: 700, color: '#1a2744', marginBottom: 3 }, children: member.name }), _jsx("p", { style: { fontSize: 12, fontWeight: 700, color: member.accent, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }, children: member.role }), _jsx("p", { style: { fontSize: 13, color: '#717182', lineHeight: 1.55, margin: 0 }, children: member.bio })] })] }, member.name))) }), _jsxs("div", { style: {
                            background: '#fff',
                            borderRadius: 24,
                            padding: '40px 36px',
                            boxShadow: 'rgba(26,39,68,0.07) 0 0 0 1px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 24, flexWrap: 'wrap',
                        }, children: [_jsxs("div", { children: [_jsx("h2", { style: { fontSize: 22, fontWeight: 800, color: '#1a2744', marginBottom: 6 }, children: "Ready to build?" }), _jsx("p", { style: { fontSize: 15, color: '#717182', margin: 0 }, children: "Pick a cohort and start shipping in days, not months." })] }), _jsxs("div", { style: { display: 'flex', gap: 12, flexWrap: 'wrap' }, children: [_jsx(Link, { to: "/courses", style: {
                                            display: 'inline-block',
                                            background: '#1a2744', color: '#fff',
                                            fontWeight: 700, fontSize: 14, padding: '11px 24px',
                                            borderRadius: 100, textDecoration: 'none',
                                        }, children: "See all cohorts" }), _jsx(Link, { to: "/signup", style: {
                                            display: 'inline-block',
                                            background: 'transparent',
                                            border: '1.5px solid rgba(26,39,68,0.2)',
                                            color: '#1a2744', fontWeight: 600, fontSize: 14,
                                            padding: '11px 24px', borderRadius: 100, textDecoration: 'none',
                                        }, children: "Create free account" })] })] })] })] }));
}
