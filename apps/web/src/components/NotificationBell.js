import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-169 — Bell icon with unread badge and dropdown panel
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationDropdown } from './NotificationDropdown';
import { cn } from '../lib/utils';
// ---------------------------------------------------------------------------
// NotificationBell
// ---------------------------------------------------------------------------
export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const { notifications, unreadCount, markOneRead, markAllRead, isMarkingAll } = useNotifications();
    // Badge label: show "9+" if count exceeds 9
    const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);
    return (_jsxs("div", { className: "relative", children: [_jsxs("button", { type: "button", "aria-label": `Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`, "aria-haspopup": "dialog", "aria-expanded": open, onClick: () => setOpen((o) => !o), className: cn('relative w-9 h-9 rounded-full flex items-center justify-center', 'bg-[#f0f0f0] text-[#717182] hover:bg-[#e8ecf4] transition-colors', open && 'bg-[#e8ecf4] text-[#1a2744]'), children: [_jsx(Bell, { size: 16, "aria-hidden": "true" }), unreadCount > 0 && (_jsx("span", { "aria-hidden": "true", className: cn('absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-[4px]', 'bg-[#d03238] text-white text-[10px] font-[800]', 'rounded-full flex items-center justify-center leading-none'), children: badgeLabel }))] }), open && (_jsx(NotificationDropdown, { notifications: notifications, isMarkingAll: isMarkingAll, onMarkAllRead: markAllRead, onMarkOneRead: markOneRead, onClose: () => setOpen(false) }))] }));
}
