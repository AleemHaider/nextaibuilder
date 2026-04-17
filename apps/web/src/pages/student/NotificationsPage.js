import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-169 — Full notifications page with mark-all-read and empty state
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { TopNav } from '../../components/TopNav';
import { cn } from '../../lib/utils';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)
        return 'Just now';
    if (mins < 60)
        return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1)
        return 'Yesterday';
    if (days < 7)
        return `${days} days ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function typeIcon(type) {
    switch (type) {
        case 'enrollment_confirmed': return '🎓';
        case 'payment_approved': return '✅';
        case 're_engagement': return '⚡';
        case 'broadcast': return '📢';
        default: return '🔔';
    }
}
function typeLabel(type) {
    switch (type) {
        case 'enrollment_confirmed': return 'Enrollment';
        case 'payment_approved': return 'Payment';
        case 're_engagement': return 'Re-engagement';
        case 'broadcast': return 'Announcement';
        default: return 'Notification';
    }
}
function NotificationRow({ notification, onRead }) {
    const { _id, title, body, isRead, createdAt, type, link } = notification;
    function handleClick() {
        if (!isRead)
            onRead(_id);
    }
    const inner = (_jsxs("div", { className: cn('flex items-start gap-4 p-5 rounded-[16px] border transition-all cursor-pointer', isRead
            ? 'bg-white border-[rgba(26,39,68,0.08)] hover:border-[rgba(26,39,68,0.15)]'
            : 'bg-[#f0f7ff] border-[#4a9ad4]/20 hover:border-[#4a9ad4]/40'), onClick: handleClick, role: "button", tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ')
            handleClick(); }, "aria-label": `${isRead ? '' : 'Unread: '}${title}`, children: [_jsx("div", { className: cn('w-11 h-11 rounded-[12px] flex items-center justify-center text-[22px] flex-shrink-0', isRead ? 'bg-[#f0f0f0]' : 'bg-[#eef6fd]'), "aria-hidden": "true", children: typeIcon(type) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-start justify-between gap-2 mb-1", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("p", { className: cn('text-[15px] text-[#1a2744] leading-snug', !isRead ? 'font-[700]' : 'font-[600]'), children: title }), _jsx("span", { className: cn('text-[11px] font-[600] px-[8px] py-[2px] rounded-full', isRead ? 'bg-[#f0f0f0] text-[#717182]' : 'bg-[#4a9ad4]/10 text-[#4a9ad4]'), children: typeLabel(type) })] }), !isRead && (_jsx("div", { className: "w-2.5 h-2.5 rounded-full bg-[#4a9ad4] flex-shrink-0 mt-1", "aria-label": "Unread" }))] }), _jsx("p", { className: "text-[14px] text-[#717182] leading-relaxed mb-2", children: body }), _jsx("p", { className: "text-[12px] text-[#a3a3a3]", children: relativeTime(createdAt) })] })] }));
    if (link) {
        return (_jsx(Link, { to: link, className: "block no-underline", onClick: handleClick, children: inner }));
    }
    return inner;
}
// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function NotificationSkeleton() {
    return (_jsxs("div", { className: "flex items-start gap-4 p-5 rounded-[16px] bg-white border border-[rgba(26,39,68,0.08)] animate-pulse", children: [_jsx("div", { className: "w-11 h-11 rounded-[12px] bg-[#e8ecf4] flex-shrink-0" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx("div", { className: "h-3.5 bg-[#e8ecf4] rounded-full w-3/5" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded-full w-full" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded-full w-2/3" }), _jsx("div", { className: "h-2.5 bg-[#e8ecf4] rounded-full w-1/4 mt-1" })] })] }));
}
// ---------------------------------------------------------------------------
// NotificationsPage
// ---------------------------------------------------------------------------
export default function NotificationsPage() {
    const { notifications, unreadCount, isLoading, error, markAllRead, markOneRead, isMarkingAll, } = useNotifications();
    return (_jsxs("div", { className: "min-h-screen bg-[#f8f9fb]", children: [_jsx(TopNav, {}), _jsxs("main", { className: "max-w-[720px] mx-auto px-4 sm:px-6 py-8 sm:py-10", children: [_jsxs("div", { className: "mb-6", children: [_jsxs(Link, { to: "/student/dashboard", className: "inline-flex items-center gap-1.5 text-[13px] font-[600] text-[#717182] hover:text-[#1a2744] no-underline mb-4 transition-colors", children: [_jsx(ArrowLeft, { size: 14, "aria-hidden": "true" }), "Back to Dashboard"] }), _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-[28px] sm:text-[32px] font-[800] text-[#1a2744] leading-tight", children: "Notifications" }), unreadCount > 0 && (_jsxs("p", { className: "text-[14px] text-[#717182] mt-1", children: [unreadCount, " unread notification", unreadCount !== 1 ? 's' : ''] }))] }), unreadCount > 0 && (_jsx("button", { type: "button", onClick: () => markAllRead(), disabled: isMarkingAll, className: cn('flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-[700]', 'bg-[#1a2744] text-white hover:opacity-90 transition-opacity', 'disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer'), children: isMarkingAll ? 'Marking…' : 'Mark all read' }))] })] }), error && (_jsx("div", { className: "mb-4 bg-[#fdeaeb] text-[#d03238] text-[14px] font-[600] rounded-[12px] px-4 py-3", children: "Failed to load notifications. Please try again." })), _jsx("div", { className: "flex flex-col gap-3", children: isLoading ? (_jsxs(_Fragment, { children: [_jsx(NotificationSkeleton, {}), _jsx(NotificationSkeleton, {}), _jsx(NotificationSkeleton, {}), _jsx(NotificationSkeleton, {})] })) : notifications.length === 0 ? (
                        // Empty state
                        _jsxs("div", { className: "bg-white rounded-[20px] border border-[rgba(26,39,68,0.08)] py-20 text-center", children: [_jsx("div", { className: "text-[56px] mb-4", children: "\uD83D\uDD14" }), _jsx("h2", { className: "text-[20px] font-[700] text-[#1a2744] mb-2", children: "You're all caught up!" }), _jsx("p", { className: "text-[15px] text-[#717182]", children: "No notifications right now. Check back later." })] })) : (notifications.map((n) => (_jsx(NotificationRow, { notification: n, onRead: markOneRead }, n._id)))) })] })] }));
}
