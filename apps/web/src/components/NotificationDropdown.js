import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-169 — Notification dropdown panel (max 5 items, mark all read, view all link)
import { useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { cn } from '../lib/utils';
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
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
function NotificationItem({ notification, onRead }) {
    const { _id, title, body, isRead, createdAt, type, link } = notification;
    function handleClick() {
        if (!isRead)
            onRead(_id);
    }
    const content = (_jsxs("div", { className: cn('flex items-start gap-3 px-4 py-3 border-b border-[rgba(26,39,68,0.06)]', 'transition-colors hover:bg-[#f8f9fb] cursor-pointer', !isRead && 'bg-[#f0f7ff]'), onClick: handleClick, role: "button", tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ')
            handleClick(); }, children: [_jsx("div", { className: "flex-shrink-0 mt-1.5", children: !isRead ? (_jsx("div", { className: "w-2 h-2 rounded-full bg-[#4a9ad4]", "aria-label": "Unread" })) : (_jsx("div", { className: "w-2 h-2 rounded-full bg-transparent", "aria-hidden": "true" })) }), _jsx("div", { className: "text-[18px] flex-shrink-0 leading-none mt-0.5", children: typeIcon(type) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: cn('text-[13px] text-[#1a2744] leading-snug mb-0.5', !isRead ? 'font-[700]' : 'font-[500]'), children: title }), _jsx("p", { className: "text-[12px] text-[#717182] leading-snug line-clamp-2", children: body }), _jsx("p", { className: "text-[11px] text-[#a3a3a3] mt-1", children: relativeTime(createdAt) })] })] }));
    if (link) {
        return (_jsx(Link, { to: link, className: "block no-underline", onClick: handleClick, children: content }));
    }
    return content;
}
export function NotificationDropdown({ notifications, isMarkingAll, onMarkAllRead, onMarkOneRead, onClose, }) {
    const panelRef = useRef(null);
    // Close on outside click
    useEffect(() => {
        function handleOutside(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [onClose]);
    // Close on Escape
    useEffect(() => {
        function handleKey(e) {
            if (e.key === 'Escape')
                onClose();
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);
    const preview = notifications.slice(0, 5);
    const hasUnread = notifications.some((n) => !n.isRead);
    return (_jsxs("div", { ref: panelRef, role: "dialog", "aria-label": "Notifications", className: cn('absolute right-0 top-[calc(100%+8px)] w-[360px]', 'bg-white rounded-[20px] overflow-hidden z-50', 'shadow-[0_8px_40px_rgba(26,39,68,0.18),0_0_0_1px_rgba(26,39,68,0.08)]'), children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3.5 border-b border-[rgba(26,39,68,0.08)]", children: [_jsx("h2", { className: "text-[15px] font-[800] text-[#1a2744]", children: "Notifications" }), hasUnread && (_jsx("button", { type: "button", onClick: onMarkAllRead, disabled: isMarkingAll, className: cn('text-[12px] font-[700] text-[#4a9ad4] hover:text-[#1a2744] transition-colors', 'disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer'), children: isMarkingAll ? 'Marking…' : 'Mark all read' }))] }), _jsx("div", { className: "max-h-[380px] overflow-y-auto", children: preview.length === 0 ? (_jsxs("div", { className: "py-10 text-center text-[14px] text-[#717182]", children: [_jsx("div", { className: "text-[32px] mb-2", children: "\uD83D\uDD14" }), "You're all caught up!"] })) : (preview.map((n) => (_jsx(NotificationItem, { notification: n, onRead: onMarkOneRead }, n._id)))) }), notifications.length > 0 && (_jsx("div", { className: "px-4 py-3 border-t border-[rgba(26,39,68,0.08)] text-center", children: _jsx(Link, { to: "/student/notifications", onClick: onClose, className: cn('text-[13px] font-[700] text-[#4a9ad4]', 'hover:text-[#1a2744] transition-colors no-underline'), children: "View all notifications \u2192" }) }))] }));
}
