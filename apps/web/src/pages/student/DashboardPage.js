import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-51 — Student dashboard: enrolled courses grid with progress + installment schedule
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { fetchStudentDashboard, fetchCohorts, } from '../../lib/api';
import { TopNav } from '../../components/TopNav';
import { cn } from '../../lib/utils';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getFirstName(fullName) {
    return fullName.trim().split(/\s+/)[0];
}
function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1)
        return 'Last visited today';
    if (hours < 24)
        return `Last visited ${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1)
        return 'Last visited yesterday';
    if (days < 7)
        return `Last visited ${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1)
        return 'Last visited 1 week ago';
    return `Last visited ${weeks} weeks ago`;
}
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12)
        return 'Good morning';
    if (hour < 17)
        return 'Good afternoon';
    return 'Good evening';
}
const GRADIENT_MAP = {
    live: 'linear-gradient(135deg,#1a2744,#4a9ad4)',
    combined: 'linear-gradient(135deg,#0d1a3a,#2d4a8a)',
    recorded: 'linear-gradient(135deg,#054d28,#16a34a)',
};
const TYPE_LABEL = {
    live: '🔴 Live Cohort',
    combined: '⚡ Combined',
    recorded: '📹 Recorded',
};
// ---------------------------------------------------------------------------
// Installment timeline (FIR-160)
// ---------------------------------------------------------------------------
function InstallmentTimeline({ installments }) {
    const statusColor = {
        PAID: 'bg-[#e6f4ec] text-[#054d28]',
        DUE: 'bg-[#fff8e6] text-[#8a5a00]',
        OVERDUE: 'bg-[#fdeaeb] text-[#d03238]',
    };
    return (_jsxs("div", { className: "mt-3 pt-3 border-t border-[rgba(26,39,68,0.06)]", children: [_jsx("p", { className: "text-[11px] font-700 text-[#717182] uppercase tracking-[0.6px] mb-2", children: "Payment Schedule" }), _jsx("div", { className: "flex flex-col gap-1.5", children: installments.map((inst, i) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-[12px] text-[#717182]", children: ["Month ", i + 1, " \u00B7 ", formatDate(inst.dueDate)] }), _jsx("span", { className: cn('text-[11px] font-600 px-2.5 py-0.5 rounded-full', statusColor[inst.status]), children: inst.status })] }, inst.id))) })] }));
}
// ---------------------------------------------------------------------------
// Course card skeleton
// ---------------------------------------------------------------------------
function CardSkeleton() {
    return (_jsxs("div", { style: {
            background: '#fff',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
            border: '1px solid rgba(26,39,68,0.07)',
        }, className: "animate-pulse", children: [_jsx("div", { style: { height: 80, background: 'linear-gradient(135deg,#e8ecf4,#dde3ee)' } }), _jsxs("div", { style: { padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx("div", { style: { height: 13, background: '#e8ecf4', borderRadius: 6, width: '75%' } }), _jsx("div", { style: { height: 8, background: '#e8ecf4', borderRadius: 9999, width: '100%' } }), _jsx("div", { style: { height: 11, background: '#e8ecf4', borderRadius: 6, width: '50%' } }), _jsx("div", { style: { height: 44, background: '#e8ecf4', borderRadius: 12, marginTop: 4 } })] })] }));
}
function EnrollmentCard({ enrollment }) {
    const navigate = useNavigate();
    const { cohort, completionPercentage, lessonsCompleted, totalLessons, paymentStatus, status, installments, lastActivityAt, nextLessonTitle, nextLiveSession } = enrollment;
    const isCompleted = status === 'COMPLETED';
    const isPending = paymentStatus === 'PENDING';
    const isPartial = paymentStatus === 'PARTIAL';
    const hasFailed = paymentStatus === 'FAILED';
    function handleContinue() {
        navigate(`/student/course/${cohort.slug}`);
    }
    function handleViewCertificate() {
        navigate('/student/certificate');
    }
    const nextDueInstallment = installments?.find((i) => i.status === 'DUE' || i.status === 'OVERDUE');
    const coverGradient = GRADIENT_MAP[cohort.type] ?? GRADIENT_MAP.recorded;
    return (_jsxs("article", { style: {
            background: '#fff',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
            border: '1px solid rgba(26,39,68,0.07)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }, "aria-label": `Course: ${cohort.title}`, onMouseEnter: (e) => {
            ;
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(26,39,68,0.12), 0 0 0 1px rgba(26,39,68,0.08)';
        }, onMouseLeave: (e) => {
            ;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)';
        }, children: [_jsxs("div", { style: {
                    height: 80,
                    background: coverGradient,
                    position: 'relative',
                    opacity: isPending ? 0.7 : 1,
                    flexShrink: 0,
                    overflow: 'hidden',
                }, children: [_jsx("div", { "aria-hidden": "true", style: {
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)',
                            backgroundSize: '16px 16px',
                        } }), _jsx("div", { style: { position: 'absolute', bottom: 10, left: 14 }, children: _jsx("span", { style: {
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: 9999,
                                background: 'rgba(255,255,255,0.15)',
                                color: '#fff',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.22)',
                                letterSpacing: '0.3px',
                            }, children: TYPE_LABEL[cohort.type] }) }), isCompleted && (_jsx("div", { style: { position: 'absolute', top: 10, right: 12 }, children: _jsx("span", { style: {
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: 9999,
                                background: 'rgba(22,163,74,0.9)',
                                color: '#fff',
                                backdropFilter: 'blur(8px)',
                            }, children: "Completed" }) }))] }), _jsxs("div", { style: { padding: '20px 20px 22px', display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx("h3", { style: {
                            fontSize: 16,
                            fontWeight: 800,
                            color: '#1a2744',
                            marginBottom: 14,
                            lineHeight: 1.3,
                            letterSpacing: -0.3,
                        }, children: cohort.title }), isPartial && nextDueInstallment && (_jsxs("div", { style: {
                            background: '#fffbeb',
                            borderRadius: 10,
                            padding: '10px 12px',
                            marginBottom: 12,
                            fontSize: 12,
                            color: '#92400e',
                            fontWeight: 500,
                            border: '1px solid rgba(245,158,11,0.2)',
                        }, children: ["\uD83D\uDD50 Next installment due ", formatDate(nextDueInstallment.dueDate)] })), hasFailed && (_jsx("div", { style: {
                            background: '#fef2f2',
                            borderRadius: 10,
                            padding: '10px 12px',
                            marginBottom: 12,
                            fontSize: 12,
                            color: '#dc2626',
                            fontWeight: 500,
                            border: '1px solid rgba(220,38,38,0.2)',
                        }, children: "\u26A0\uFE0F Payment failed \u2014 update your payment method" })), isPending ? (_jsx("div", { style: {
                            background: '#fffbeb',
                            borderRadius: 10,
                            padding: '10px 12px',
                            marginBottom: 12,
                            fontSize: 12,
                            color: '#92400e',
                            fontWeight: 500,
                            border: '1px solid rgba(245,158,11,0.2)',
                        }, children: "\uD83D\uDD50 Payment receipt under review. Access unlocks upon approval." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("div", { style: { height: 8, background: 'rgba(26,39,68,0.06)', borderRadius: 9999, overflow: 'hidden' }, children: _jsx("div", { style: {
                                                height: '100%',
                                                width: `${completionPercentage}%`,
                                                background: isCompleted
                                                    ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                                                    : 'linear-gradient(90deg,#4a9ad4,#7bb8e0)',
                                                borderRadius: 9999,
                                                transition: 'width 0.4s ease',
                                            } }) }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }, children: [_jsxs("span", { style: { fontSize: 12, fontWeight: 700, color: '#4a9ad4' }, children: [completionPercentage, "% complete"] }), _jsxs("span", { style: { fontSize: 12, color: '#717182' }, children: [lessonsCompleted, "/", totalLessons, " lessons"] })] })] }), isCompleted ? (_jsxs("p", { style: { fontSize: 12, color: '#717182', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }, children: ["\uD83C\uDF89 ", _jsxs("span", { style: { fontWeight: 600, color: '#1a2744' }, children: ["Completed on ", lastActivityAt ? formatDate(lastActivityAt) : '—'] })] })) : nextLessonTitle ? (_jsxs("p", { style: { fontSize: 12, color: '#717182', marginBottom: 8 }, children: [_jsx("span", { style: { fontWeight: 600, color: '#1a2744' }, children: "Next:" }), " ", nextLessonTitle] })) : null, nextLiveSession && !isCompleted && (_jsxs("p", { style: {
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#cc4a00',
                                    marginBottom: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }, children: ["\uD83D\uDCC5 Next live: ", nextLiveSession] }))] })), _jsx("div", { style: { marginTop: 'auto', paddingTop: 10 }, children: isPending ? (_jsx("button", { type: "button", style: {
                                width: '100%',
                                padding: '11px 20px',
                                borderRadius: 12,
                                background: '#f4f6f9',
                                color: '#1a2744',
                                fontSize: 13,
                                fontWeight: 700,
                                border: '1px solid rgba(26,39,68,0.12)',
                                cursor: 'pointer',
                                fontFamily: "'Inter', sans-serif",
                                transition: 'all 0.2s ease',
                            }, onClick: () => navigate(`/manual-payment/${cohort.slug}`), children: "View Payment Status" })) : isCompleted ? (_jsx("button", { type: "button", style: {
                                width: '100%',
                                padding: '11px 20px',
                                borderRadius: 12,
                                background: '#1a2744',
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                fontFamily: "'Inter', sans-serif",
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 12px rgba(26,39,68,0.2)',
                            }, onClick: handleViewCertificate, children: "View Certificate" })) : (_jsx("button", { type: "button", style: {
                                width: '100%',
                                padding: '11px 20px',
                                borderRadius: 12,
                                background: '#4a9ad4',
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                fontFamily: "'Inter', sans-serif",
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 12px rgba(74,154,212,0.3)',
                            }, onClick: handleContinue, onMouseEnter: (e) => { e.currentTarget.style.background = '#3a8ac4'; }, onMouseLeave: (e) => { e.currentTarget.style.background = '#4a9ad4'; }, children: "Continue Learning \u2192" })) }), _jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: 12,
                            marginTop: 12,
                            borderTop: '1px solid rgba(26,39,68,0.06)',
                        }, children: [_jsx("span", { style: { fontSize: 11, color: '#a3a3b8' }, children: lastActivityAt ? relativeTime(lastActivityAt) : 'Enrolled' }), _jsx("span", { style: {
                                    fontSize: 10,
                                    fontWeight: 600,
                                    padding: '3px 10px',
                                    borderRadius: 9999,
                                    background: isCompleted
                                        ? '#e8ecf4'
                                        : isPending
                                            ? '#fffbeb'
                                            : '#e6f4ec',
                                    color: isCompleted
                                        ? '#1a2744'
                                        : isPending
                                            ? '#92400e'
                                            : '#15803d',
                                }, children: isCompleted ? 'Completed' : isPending ? 'Pending' : 'Active' })] }), installments && installments.length > 0 && (_jsx(InstallmentTimeline, { installments: installments }))] })] }));
}
// ---------------------------------------------------------------------------
// Discover cohort card (empty state)
// ---------------------------------------------------------------------------
const DISCOVER_GRADIENTS = {
    live: ['#0d1b42', '#1e4080', '#4a9ad4'],
    combined: ['#100d30', '#2a1f6e', '#6b5ce7'],
    recorded: ['#0a2a1a', '#0f5132', '#16a34a'],
};
const DISCOVER_ACCENT = {
    live: '#4a9ad4',
    combined: '#6b5ce7',
    recorded: '#16a34a',
};
const DISCOVER_TYPE_LABEL = {
    live: { label: 'Live Cohort', icon: '🔴' },
    combined: { label: 'Combined', icon: '⚡' },
    recorded: { label: 'Recorded', icon: '📹' },
};
function DiscoverCard({ cohort }) {
    const navigate = useNavigate();
    const stops = DISCOVER_GRADIENTS[cohort.type] ?? DISCOVER_GRADIENTS.recorded;
    const accent = DISCOVER_ACCENT[cohort.type] ?? '#4a9ad4';
    const meta = DISCOVER_TYPE_LABEL[cohort.type] ?? { label: cohort.type, icon: '📦' };
    const gradient = `linear-gradient(145deg, ${stops[0]} 0%, ${stops[1]} 55%, ${stops[2]} 100%)`;
    return (_jsxs("article", { onClick: () => navigate(`/courses/${cohort.slug}`), "aria-label": `View ${cohort.title}`, style: {
            background: '#fff',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
            border: '1px solid rgba(26,39,68,0.07)',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        }, onMouseEnter: (e) => {
            ;
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow =
                '0 12px 40px rgba(26,39,68,0.14), 0 0 0 1px rgba(26,39,68,0.08)';
        }, onMouseLeave: (e) => {
            ;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow =
                '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)';
        }, children: [_jsxs("div", { style: {
                    height: 160,
                    background: gradient,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '18px 20px',
                    overflow: 'hidden',
                }, children: [_jsx("div", { "aria-hidden": "true", style: {
                            position: 'absolute',
                            top: -30,
                            right: -30,
                            width: 130,
                            height: 130,
                            borderRadius: '50%',
                            background: `radial-gradient(circle, ${accent}30 0%, transparent 70%)`,
                            pointerEvents: 'none',
                        } }), _jsx("div", { "aria-hidden": "true", style: {
                            position: 'absolute',
                            bottom: -20,
                            left: '30%',
                            width: 90,
                            height: 90,
                            borderRadius: '50%',
                            background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
                            pointerEvents: 'none',
                        } }), _jsxs("span", { style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: 'rgba(255,255,255,0.12)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.22)',
                            borderRadius: 100,
                            padding: '4px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#fff',
                            letterSpacing: '0.3px',
                            alignSelf: 'flex-start',
                        }, children: [meta.icon, " ", meta.label] }), _jsx("p", { style: {
                            fontSize: 17,
                            fontWeight: 800,
                            color: '#fff',
                            lineHeight: 1.3,
                            margin: 0,
                            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        }, children: cohort.title })] }), _jsxs("div", { style: { padding: '18px 20px', display: 'flex', flexDirection: 'column', flex: 1, gap: 0 }, children: [cohort.tagline && (_jsx("p", { style: {
                            fontSize: 13,
                            color: '#717182',
                            lineHeight: 1.5,
                            marginBottom: 16,
                            flex: 1,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }, children: cohort.tagline })), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }, children: [_jsx("div", { children: _jsx("span", { style: { fontSize: 22, fontWeight: 800, color: '#1a2744', lineHeight: 1 }, children: cohort.price === 0 ? 'Free' : `$${cohort.price}` }) }), _jsx("button", { type: "button", onClick: (e) => { e.stopPropagation(); navigate(`/courses/${cohort.slug}`); }, style: {
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: accent,
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 100,
                                    padding: '9px 18px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    letterSpacing: '0.2px',
                                    transition: 'opacity 0.15s',
                                    boxShadow: `0 4px 14px ${accent}40`,
                                }, onMouseEnter: (e) => { e.currentTarget.style.opacity = '0.85'; }, onMouseLeave: (e) => { e.currentTarget.style.opacity = '1'; }, children: "View details" })] })] })] }));
}
function DiscoverCardSkeleton() {
    return (_jsxs("div", { style: {
            background: '#fff',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(26,39,68,0.06)',
            border: '1px solid rgba(26,39,68,0.07)',
        }, children: [_jsx("div", { style: { height: 160, background: 'linear-gradient(135deg,#e8ecf4,#dde3ee)' } }), _jsxs("div", { style: { padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsx("div", { style: { height: 14, width: '70%', background: '#e8ecf4', borderRadius: 8 } }), _jsx("div", { style: { height: 12, width: '90%', background: '#e8ecf4', borderRadius: 8 } }), _jsx("div", { style: { height: 12, width: '55%', background: '#e8ecf4', borderRadius: 8 } }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }, children: [_jsx("div", { style: { height: 22, width: 50, background: '#e8ecf4', borderRadius: 8 } }), _jsx("div", { style: { height: 36, width: 110, background: '#e8ecf4', borderRadius: 100 } })] })] })] }));
}
function PerkCard({ icon, title, desc, bg }) {
    return (_jsxs("div", { style: {
            background: '#fff',
            borderRadius: 18,
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
            border: '1px solid rgba(26,39,68,0.07)',
        }, children: [_jsx("div", { style: {
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    flexShrink: 0,
                }, children: icon }), _jsxs("div", { children: [_jsx("p", { style: { fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 4, lineHeight: 1.3 }, children: title }), _jsx("p", { style: { fontSize: 13, color: '#717182', lineHeight: 1.5, margin: 0 }, children: desc })] })] }));
}
// ---------------------------------------------------------------------------
// Empty + discover section
// ---------------------------------------------------------------------------
function EmptyState({ cohorts, cohortsLoading }) {
    const published = cohorts.filter((c) => c.published);
    return (_jsxs("div", { children: [_jsxs("div", { className: "dashboard-empty-hero", style: {
                    borderRadius: 24,
                    background: 'linear-gradient(135deg, #080f24 0%, #102040 45%, #1a3060 100%)',
                    padding: '48px 44px',
                    marginBottom: 28,
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 36,
                    flexWrap: 'wrap',
                }, children: [_jsx("div", { "aria-hidden": "true", style: {
                            position: 'absolute',
                            top: -80,
                            right: -60,
                            width: 340,
                            height: 340,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(74,154,212,0.18) 0%, transparent 70%)',
                            pointerEvents: 'none',
                        } }), _jsx("div", { "aria-hidden": "true", style: {
                            position: 'absolute',
                            bottom: -60,
                            left: '40%',
                            width: 220,
                            height: 220,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(74,154,212,0.10) 0%, transparent 70%)',
                            pointerEvents: 'none',
                        } }), _jsx("div", { className: "dashboard-empty-hero-icon", style: {
                            width: 88,
                            height: 88,
                            borderRadius: 22,
                            flexShrink: 0,
                            background: 'rgba(74,154,212,0.15)',
                            border: '1px solid rgba(74,154,212,0.30)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 40,
                            backdropFilter: 'blur(4px)',
                        }, children: "\uD83D\uDE80" }), _jsxs("div", { style: { flex: 1, minWidth: 240, position: 'relative', zIndex: 1 }, children: [_jsx("p", { style: {
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: '1.4px',
                                    color: 'rgba(74,154,212,0.85)',
                                    textTransform: 'uppercase',
                                    marginBottom: 10,
                                }, children: "Start your journey" }), _jsxs("h2", { style: {
                                    fontSize: 'clamp(22px, 3vw, 30px)',
                                    fontWeight: 800,
                                    color: '#fff',
                                    lineHeight: 1.25,
                                    marginBottom: 10,
                                }, children: ["Build real AI products.", _jsx("br", {}), _jsx("span", { style: { color: '#7bb8e0' }, children: "Not toy demos." })] }), _jsx("p", { style: { fontSize: 15, color: 'rgba(255,255,255,0.62)', lineHeight: 1.55, marginBottom: 24 }, children: "Join a cohort and ship production-grade AI apps alongside a community of founders and engineers." }), _jsxs("div", { style: { display: 'flex', gap: 12, flexWrap: 'wrap' }, children: [_jsx(Link, { to: "/courses", style: {
                                            display: 'inline-block',
                                            background: '#ff8c5a',
                                            color: '#fff',
                                            fontWeight: 700,
                                            fontSize: 14,
                                            padding: '11px 24px',
                                            borderRadius: 12,
                                            textDecoration: 'none',
                                            letterSpacing: '0.2px',
                                            boxShadow: '0 4px 16px rgba(255,140,90,0.4)',
                                        }, children: "Browse all cohorts" }), _jsx(Link, { to: "/courses?type=live", style: {
                                            display: 'inline-block',
                                            background: 'rgba(255,255,255,0.08)',
                                            border: '1px solid rgba(255,255,255,0.18)',
                                            color: '#fff',
                                            fontWeight: 600,
                                            fontSize: 14,
                                            padding: '11px 24px',
                                            borderRadius: 12,
                                            textDecoration: 'none',
                                            backdropFilter: 'blur(4px)',
                                        }, children: "Live cohorts \u2192" })] })] })] }), _jsxs("div", { className: "dashboard-perk-grid", style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 16,
                    marginBottom: 40,
                }, children: [_jsx(PerkCard, { icon: "\uD83C\uDFAF", title: "Project-based", desc: "Ship real products. Every cohort ends with something you can show off.", bg: "linear-gradient(135deg,#eef6fd,#c8e4f7)" }), _jsx(PerkCard, { icon: "\uD83D\uDC65", title: "Live community", desc: "Weekly live sessions and a private Slack with builders like you.", bg: "linear-gradient(135deg,#f3f0ff,#d6c9fc)" }), _jsx(PerkCard, { icon: "\uD83C\uDFC6", title: "Certificate", desc: "Earn a verified credential once you complete the full cohort.", bg: "linear-gradient(135deg,#ecfdf5,#a7f3d0)" })] }), (cohortsLoading || published.length > 0) && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }, children: [_jsx("p", { style: {
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: '#717182',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1.2px',
                                    margin: 0,
                                    whiteSpace: 'nowrap',
                                }, children: "Available cohorts" }), _jsx("div", { style: { flex: 1, height: 1, background: 'rgba(26,39,68,0.08)' } })] }), _jsx("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: 20,
                        }, children: cohortsLoading ? (_jsxs(_Fragment, { children: [_jsx(DiscoverCardSkeleton, {}), _jsx(DiscoverCardSkeleton, {}), _jsx(DiscoverCardSkeleton, {})] })) : (published.slice(0, 6).map((cohort) => (_jsx(DiscoverCard, { cohort: cohort }, cohort.id)))) })] }))] }));
}
function KpiCard({ label, value, sub, iconBg, icon }) {
    return (_jsxs("div", { style: {
            background: '#fff',
            borderRadius: 16,
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
            border: '1px solid rgba(26,39,68,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
        }, children: [_jsx("div", { style: {
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                }, children: icon }), _jsxs("div", { children: [_jsx("p", { style: { fontSize: 'clamp(24px,3vw,32px)', fontWeight: 900, color: '#1a2744', lineHeight: 1, letterSpacing: -0.5 }, children: value }), _jsx("p", { style: { fontSize: 12, fontWeight: 600, color: '#717182', marginTop: 3 }, children: label })] })] }));
}
// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
    const { user } = useAuth();
    const [enrollments, setEnrollments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cohorts, setCohorts] = useState([]);
    const [cohortsLoading, setCohortsLoading] = useState(false);
    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const data = await fetchStudentDashboard();
                if (!cancelled) {
                    setEnrollments(data.enrollments);
                    if (data.enrollments.length === 0) {
                        setCohortsLoading(true);
                        fetchCohorts()
                            .then((list) => { if (!cancelled)
                            setCohorts(list); })
                            .catch(() => { })
                            .finally(() => { if (!cancelled)
                            setCohortsLoading(false); });
                    }
                }
            }
            catch (err) {
                if (!cancelled)
                    setError(err instanceof Error ? err.message : 'Failed to load courses');
            }
            finally {
                if (!cancelled)
                    setIsLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, []);
    const firstName = user ? getFirstName(user.name) : '';
    const activeCount = enrollments.filter((e) => e.status === 'ACTIVE').length;
    const completedCount = enrollments.filter((e) => e.status === 'COMPLETED').length;
    const isEmpty = !isLoading && enrollments.length === 0;
    return (_jsxs("div", { style: { minHeight: '100vh', background: '#f7f8fc', fontFamily: "'Inter', sans-serif" }, children: [_jsx("style", { children: `
        @media (max-width: 768px) {
          .dashboard-greeting { padding: 20px 20px !important; flex-direction: column !important; align-items: flex-start !important; }
          .dashboard-kpi-grid { grid-template-columns: 1fr 1fr !important; }
          .dashboard-courses-grid { grid-template-columns: 1fr !important; }
          .dashboard-discover-grid { grid-template-columns: 1fr !important; }
          .dashboard-empty-hero { padding: 28px 20px !important; gap: 20px !important; }
          .dashboard-empty-hero-icon { display: none !important; }
          .dashboard-perk-grid { grid-template-columns: 1fr !important; }
        }
      ` }), _jsx(TopNav, {}), _jsxs("main", { style: { padding: 'clamp(24px,3vw,40px) clamp(16px,3vw,32px) 64px', maxWidth: 1200, margin: '0 auto' }, children: [_jsxs("div", { className: "dashboard-greeting", style: {
                            background: '#fff',
                            borderRadius: 20,
                            padding: '32px 40px',
                            marginBottom: 24,
                            boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.04)',
                            border: '1px solid rgba(26,39,68,0.07)',
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 20,
                        }, children: [_jsx("div", { "aria-hidden": "true", style: {
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    width: '50%',
                                    height: '100%',
                                    background: 'radial-gradient(ellipse 60% 100% at 100% 50%, rgba(74,154,212,0.06), transparent)',
                                    pointerEvents: 'none',
                                } }), _jsxs("div", { style: { position: 'relative', zIndex: 1 }, children: [_jsxs("h1", { style: {
                                            fontSize: 'clamp(28px, 3vw, 38px)',
                                            fontWeight: 900,
                                            color: '#1a2744',
                                            letterSpacing: -1,
                                            lineHeight: 1.15,
                                            marginBottom: 8,
                                        }, children: [getGreeting(), ", ", firstName, " \uD83D\uDC4B"] }), _jsx("p", { style: { fontSize: 15, color: '#717182', lineHeight: 1.5 }, children: isLoading
                                            ? 'Loading your courses…'
                                            : activeCount > 0
                                                ? `You have ${activeCount} course${activeCount !== 1 ? 's' : ''} in progress. Keep the momentum going!`
                                                : 'Your learning journey starts here. Browse a cohort and get building.' })] }), !isLoading && (_jsx(Link, { to: "/courses", style: {
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '12px 24px',
                                    borderRadius: 12,
                                    background: '#ff8c5a',
                                    color: '#fff',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    boxShadow: '0 4px 16px rgba(255,140,90,0.3)',
                                    transition: 'all 0.2s ease',
                                    whiteSpace: 'nowrap',
                                    position: 'relative',
                                    zIndex: 1,
                                }, children: "Browse Courses \u2192" }))] }), !isLoading && enrollments.length > 0 && (_jsxs("div", { className: "dashboard-kpi-grid", style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: 16,
                            marginBottom: 32,
                        }, children: [_jsx(KpiCard, { icon: "\uD83D\uDCDA", iconBg: "linear-gradient(135deg,#eef6fd,#c8e4f7)", label: "Courses Enrolled", value: enrollments.length, sub: "total programs" }), _jsx(KpiCard, { icon: "\u2705", iconBg: "linear-gradient(135deg,#ecfdf5,#a7f3d0)", label: "Completed", value: completedCount, sub: completedCount === 1 ? 'course finished' : 'courses finished' }), _jsx(KpiCard, { icon: "\uD83D\uDD25", iconBg: "linear-gradient(135deg,#fff7ed,#fed7aa)", label: "Active Courses", value: activeCount, sub: "in progress" }), _jsx(KpiCard, { icon: "\uD83C\uDFC6", iconBg: "linear-gradient(135deg,#fefce8,#fef08a)", label: "Certificates", value: completedCount, sub: "earned" })] })), error && (_jsxs("div", { style: {
                            marginBottom: 24,
                            background: '#fef2f2',
                            borderRadius: 14,
                            padding: '14px 18px',
                            color: '#dc2626',
                            fontSize: 14,
                            fontWeight: 600,
                            border: '1px solid rgba(220,38,38,0.2)',
                        }, children: ["\u26A0\uFE0F ", error] })), (isLoading || enrollments.length > 0) && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }, children: [_jsx("h2", { style: {
                                            fontSize: 22,
                                            fontWeight: 800,
                                            color: '#1a2744',
                                            letterSpacing: -0.5,
                                            margin: 0,
                                            whiteSpace: 'nowrap',
                                        }, children: "My Courses" }), !isLoading && (_jsxs("span", { style: {
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: '#4a9ad4',
                                            background: 'rgba(74,154,212,0.1)',
                                            border: '1px solid rgba(74,154,212,0.2)',
                                            borderRadius: 20,
                                            padding: '3px 12px',
                                            whiteSpace: 'nowrap',
                                        }, children: [enrollments.length, " enrolled"] })), _jsx("div", { style: { flex: 1, height: 1, background: 'rgba(26,39,68,0.08)' } })] }), _jsx("div", { className: "dashboard-courses-grid", style: {
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                    gap: 20,
                                    marginBottom: 40,
                                }, children: isLoading ? (_jsxs(_Fragment, { children: [_jsx(CardSkeleton, {}), _jsx(CardSkeleton, {}), _jsx(CardSkeleton, {})] })) : (enrollments.map((enrollment) => (_jsx(EnrollmentCard, { enrollment: enrollment }, enrollment.id)))) })] })), isEmpty && (_jsx(EmptyState, { cohorts: cohorts, cohortsLoading: cohortsLoading }))] })] }));
}
