import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-164 — Badges page: earned badges grid + locked badges
import { useQuery } from '@tanstack/react-query';
import { TopNav } from '../../components/TopNav';
import { fetchStudentBadges } from '../../lib/api';
import { cn } from '../../lib/utils';
// ---------------------------------------------------------------------------
// Badge card
// ---------------------------------------------------------------------------
function BadgeCard({ badge }) {
    return (_jsxs("div", { className: cn('bg-white rounded-[20px] p-6 text-center flex flex-col items-center gap-3', 'shadow-[rgba(26,39,68,0.12)_0_0_0_1px] transition-transform hover:scale-[1.02]', !badge.earned && 'opacity-50'), "aria-label": badge.earned ? `${badge.name} badge — earned` : `${badge.name} badge — locked`, children: [_jsx("div", { className: cn('w-20 h-20 rounded-full flex items-center justify-center text-[40px]', badge.earned
                    ? 'shadow-[rgba(26,39,68,0.15)_0_4px_20px]'
                    : 'bg-[#f0f0f0]'), style: badge.earned ? { background: 'linear-gradient(135deg,#eef6fd,#c8e4f7)' } : undefined, children: badge.earned ? (badge.iconUrl ?? '🏅') : '🔒' }), _jsxs("div", { children: [_jsx("p", { className: cn('text-[16px] font-700 mb-1', badge.earned ? 'text-[#1a2744]' : 'text-[#a3a3a3]'), children: badge.name }), _jsx("p", { className: "text-[13px] text-[#717182] leading-snug max-w-[160px]", children: badge.description })] }), badge.earned ? (_jsx("span", { className: "text-[11px] font-700 bg-[#e6f4ec] text-[#054d28] px-3 py-1 rounded-full", children: "Earned" })) : (_jsx("span", { className: "text-[11px] font-600 bg-[#f0f0f0] text-[#a3a3a3] px-3 py-1 rounded-full", children: "Locked" }))] }));
}
// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function BadgeSkeleton() {
    return (_jsxs("div", { className: "bg-white rounded-[20px] p-6 flex flex-col items-center gap-3 shadow-[rgba(26,39,68,0.12)_0_0_0_1px] animate-pulse", children: [_jsx("div", { className: "w-20 h-20 rounded-full bg-[#e8ecf4]" }), _jsx("div", { className: "h-3.5 w-24 bg-[#e8ecf4] rounded-full" }), _jsx("div", { className: "h-3 w-32 bg-[#e8ecf4] rounded-full" }), _jsx("div", { className: "h-6 w-16 bg-[#e8ecf4] rounded-full" })] }));
}
// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function BadgesPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['student', 'badges'],
        queryFn: fetchStudentBadges,
    });
    const badges = data?.badges ?? [];
    const earnedCount = badges.filter((b) => b.earned).length;
    return (_jsxs("div", { className: "min-h-screen bg-[#f8f9fb]", children: [_jsx(TopNav, {}), _jsxs("main", { className: "p-4 sm:p-10", children: [_jsx("h1", { className: "text-[32px] font-700 text-[#1a2744] mb-2", children: "My Badges" }), _jsx("p", { className: "text-[16px] text-[#717182] mb-8", children: isLoading
                            ? 'Loading your badges…'
                            : `${earnedCount} of ${badges.length} badges earned. Keep learning to unlock more!` }), error && (_jsx("div", { className: "mb-6 bg-[#fdeaeb] text-[#d03238] text-[14px] font-[600] rounded-[12px] px-4 py-3", children: "Failed to load badges. Please refresh." })), _jsx("p", { className: "text-[13px] font-700 text-[#717182] uppercase tracking-[0.8px] mb-5", children: "All Badges" }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 max-w-[900px]", children: isLoading ? (_jsxs(_Fragment, { children: [_jsx(BadgeSkeleton, {}), _jsx(BadgeSkeleton, {}), _jsx(BadgeSkeleton, {}), _jsx(BadgeSkeleton, {})] })) : badges.length === 0 ? (_jsxs("div", { className: "col-span-full bg-white rounded-[20px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] py-16 px-10 text-center", children: [_jsx("div", { className: "text-[56px] mb-4", children: "\uD83C\uDFC5" }), _jsx("h2", { className: "text-[20px] font-700 text-[#1a2744] mb-2", children: "No badges yet" }), _jsx("p", { className: "text-[15px] text-[#717182]", children: "Complete lessons to start earning badges." })] })) : (badges.map((badge) => (_jsx(BadgeCard, { badge: badge }, badge.id)))) })] })] }));
}
