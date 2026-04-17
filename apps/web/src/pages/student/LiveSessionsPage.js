import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-57 — Live sessions page: LIVE NOW, upcoming, past recordings
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { fetchLiveSessions } from '../../lib/api';
import { cn } from '../../lib/utils';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatScheduledAt(iso) {
    const d = new Date(iso);
    return {
        month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        day: String(d.getDate()),
        full: d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }),
        time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
    };
}
function daysFromNow(iso) {
    const diff = new Date(iso).getTime() - Date.now();
    const days = Math.ceil(diff / 86_400_000);
    if (days <= 0)
        return 'Today';
    if (days === 1)
        return 'Tomorrow';
    return `In ${days} days`;
}
// Generate a .ics file and trigger download (FIR-57 — Add to Calendar)
function downloadIcs(session) {
    const start = new Date(session.scheduledAt);
    const end = new Date(start.getTime() + session.durationMinutes * 60_000);
    function toIcsDate(d) {
        return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//nextaibuilder//EN',
        'BEGIN:VEVENT',
        `UID:${session.id}@nextaibuilder`,
        `DTSTAMP:${toIcsDate(new Date())}`,
        `DTSTART:${toIcsDate(start)}`,
        `DTEND:${toIcsDate(end)}`,
        `SUMMARY:${session.title}`,
    ];
    if (session.zoomUrl)
        lines.push(`LOCATION:${session.zoomUrl}`);
    if (session.description)
        lines.push(`DESCRIPTION:${session.description}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title.replace(/\s+/g, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
}
// ---------------------------------------------------------------------------
// Minimal inline toast — no external lib
// ---------------------------------------------------------------------------
function useToast() {
    const [toast, setToast] = useState(null);
    const showToast = useCallback((msg) => {
        setToast(msg);
        const id = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(id);
    }, []);
    return { toast, showToast };
}
// ---------------------------------------------------------------------------
// Live NOW card
// ---------------------------------------------------------------------------
function LiveCard({ session }) {
    const dt = formatScheduledAt(session.scheduledAt);
    return (_jsxs("article", { className: cn('bg-white rounded-[20px] p-6 flex items-start gap-5 mb-3', 'shadow-[rgba(74,154,212,0.3)_0_0_0_2px,rgba(26,39,68,0.08)_0_4px_16px]'), "aria-label": `Live now: ${session.title}`, children: [_jsxs("div", { className: "w-16 h-16 rounded-[16px] bg-[#4a9ad4] flex flex-col items-center justify-center flex-shrink-0", children: [_jsx("span", { className: "text-[11px] font-700 text-[rgba(255,255,255,0.8)] uppercase tracking-[0.5px]", children: dt.month }), _jsx("span", { className: "text-[28px] font-900 text-white leading-none", children: dt.day })] }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2.5 mb-1.5 flex-wrap", children: [_jsx("h3", { className: "text-[17px] font-700 text-[#1a2744]", children: session.title }), _jsx("span", { className: "text-[11px] font-700 bg-[#d03238] text-white px-[10px] py-[3px] rounded-full animate-pulse", children: "\uD83D\uDD34 LIVE NOW" })] }), _jsxs("div", { className: "flex gap-5 mb-3 flex-wrap", children: [_jsxs("span", { className: "text-[13px] text-[#717182] flex items-center gap-1.5", children: ["\uD83D\uDCC5 ", _jsxs("strong", { className: "text-[#1a2744] font-600", children: ["Today \u00B7 ", dt.full] })] }), _jsxs("span", { className: "text-[13px] text-[#717182] flex items-center gap-1.5", children: ["\u23F0 ", _jsx("strong", { className: "text-[#1a2744] font-600", children: dt.time }), " \u00B7 ", session.durationMinutes, " min"] })] }), session.description && (_jsx("p", { className: "text-[14px] text-[#717182] leading-relaxed mb-4 max-w-[600px]", children: session.description })), _jsxs("div", { className: "flex gap-2.5 items-center flex-wrap", children: [session.zoomUrl ? (_jsx("a", { href: session.zoomUrl, target: "_blank", rel: "noopener noreferrer", className: cn('px-[22px] py-[10px] rounded-full bg-[#4a9ad4] text-[#0d1a3a]', 'text-[14px] font-700 no-underline flex items-center gap-1.5', 'hover:opacity-90 transition-opacity'), children: "\uD83C\uDFA5 Join on Zoom" })) : null, session.zoomUrl && (_jsx("button", { type: "button", onClick: () => { void navigator.clipboard.writeText(session.zoomUrl ?? ''); }, className: "text-[13px] font-600 text-[#4a9ad4] bg-transparent border-none cursor-pointer flex items-center gap-1 font-sans", children: "\uD83D\uDCCE Copy Zoom link" }))] })] })] }));
}
function UpcomingCard({ session, onToast }) {
    const dt = formatScheduledAt(session.scheduledAt);
    const [reminderSet, setReminderSet] = useState(false);
    return (_jsxs("article", { className: "bg-white rounded-[20px] p-6 flex items-start gap-5 mb-3 shadow-[rgba(26,39,68,0.12)_0_0_0_1px]", "aria-label": `Upcoming: ${session.title}`, children: [_jsxs("div", { className: "w-16 h-16 rounded-[16px] bg-[#eef6fd] flex flex-col items-center justify-center flex-shrink-0", children: [_jsx("span", { className: "text-[11px] font-700 text-[#4a9ad4] uppercase tracking-[0.5px]", children: dt.month }), _jsx("span", { className: "text-[28px] font-900 text-[#1a2744] leading-none", children: dt.day })] }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2.5 mb-1.5 flex-wrap", children: [_jsx("h3", { className: "text-[17px] font-700 text-[#1a2744]", children: session.title }), _jsx("span", { className: "text-[11px] font-600 bg-[#e8f4fd] text-[#1a2744] px-[10px] py-[3px] rounded-full", children: daysFromNow(session.scheduledAt) })] }), _jsxs("div", { className: "flex gap-5 mb-3 flex-wrap", children: [_jsxs("span", { className: "text-[13px] text-[#717182] flex items-center gap-1.5", children: ["\uD83D\uDCC5 ", _jsx("strong", { className: "text-[#1a2744] font-600", children: dt.full })] }), _jsxs("span", { className: "text-[13px] text-[#717182] flex items-center gap-1.5", children: ["\u23F0 ", _jsx("strong", { className: "text-[#1a2744] font-600", children: dt.time }), " \u00B7 ", session.durationMinutes, " min"] })] }), session.description && (_jsx("p", { className: "text-[14px] text-[#717182] leading-relaxed mb-4 max-w-[600px]", children: session.description })), _jsxs("div", { className: "flex gap-2.5 items-center flex-wrap", children: [_jsx("button", { type: "button", disabled: true, className: "px-[22px] py-[10px] rounded-full bg-[#e8ecf4] text-[#a3a3a3] text-[14px] font-700 border-none cursor-default font-sans flex items-center gap-1.5", children: "\uD83C\uDFA5 Join on Zoom" }), _jsx("button", { type: "button", onClick: () => {
                                    setReminderSet(true);
                                    onToast("Reminder set! We'll notify you before the session.");
                                }, className: cn('px-[18px] py-[10px] rounded-full border border-[rgba(26,39,68,0.15)]', 'text-[14px] font-600 cursor-pointer font-sans flex items-center gap-1.5', 'bg-transparent transition-colors', reminderSet
                                    ? 'border-[#4a9ad4] text-[#4a9ad4]'
                                    : 'text-[#717182] hover:border-[#4a9ad4] hover:text-[#4a9ad4]'), children: reminderSet ? '🔔 Reminder set ✓' : '🔔 Set Reminder' }), _jsx("button", { type: "button", onClick: () => downloadIcs(session), className: "text-[13px] font-600 text-[#4a9ad4] bg-transparent border-none cursor-pointer flex items-center gap-1 font-sans hover:underline", children: "+ Add to Calendar" })] })] })] }));
}
// ---------------------------------------------------------------------------
// Past session card
// ---------------------------------------------------------------------------
function PastCard({ session }) {
    const dt = formatScheduledAt(session.scheduledAt);
    return (_jsxs("div", { className: "bg-white rounded-[16px] p-[20px_24px] flex items-center gap-4 mb-2 shadow-[rgba(26,39,68,0.08)_0_0_0_1px] opacity-85", children: [_jsx("div", { className: "w-12 h-12 rounded-[12px] bg-[#f0f0f0] flex items-center justify-center text-[22px] flex-shrink-0", children: session.recordingUrl ? '📹' : '📷' }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-[15px] font-700 text-[#1a2744] mb-1", children: session.title }), _jsxs("p", { className: "text-[13px] text-[#717182]", children: [dt.full, " \u00B7 ", session.durationMinutes, " min"] })] }), session.recordingUrl ? (_jsx("a", { href: session.recordingUrl, target: "_blank", rel: "noopener noreferrer", className: cn('px-[18px] py-[9px] rounded-full bg-[#e8ecf4] text-[#1a2744]', 'text-[13px] font-600 no-underline flex items-center gap-1.5', 'hover:bg-[#d4e0f0] transition-colors'), children: "\u25B6 Watch Recording" })) : (_jsx("span", { className: "px-[18px] py-[9px] rounded-full bg-[#f0f0f0] text-[#a3a3a3] text-[13px] font-600", children: "No Recording" }))] }));
}
// ---------------------------------------------------------------------------
// Empty section placeholder
// ---------------------------------------------------------------------------
function EmptySection({ message }) {
    return (_jsxs("div", { className: "bg-white rounded-[20px] shadow-[rgba(26,39,68,0.08)_0_0_0_1px] py-14 px-10 text-center", children: [_jsx("div", { className: "text-[48px] mb-4", children: "\uD83D\uDCC5" }), _jsx("p", { className: "text-[20px] font-700 text-[#1a2744] mb-1.5", children: "No sessions" }), _jsx("p", { className: "text-[15px] text-[#717182]", children: message })] }));
}
// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LiveSessionsPage() {
    // Works both as CoursePage Outlet child (slug from parent route) and standalone
    const { slug = '' } = useParams();
    const { toast, showToast } = useToast();
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const load = useCallback(async () => {
        if (!slug)
            return;
        try {
            const data = await fetchLiveSessions(slug);
            setSessions(data.sessions);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load sessions');
        }
        finally {
            setIsLoading(false);
        }
    }, [slug]);
    useEffect(() => { void load(); }, [load]);
    const liveSessions = sessions.filter((s) => s.status === 'LIVE');
    const upcomingSessions = sessions
        .filter((s) => s.status === 'UPCOMING')
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    const pastSessions = sessions
        .filter((s) => s.status === 'PAST')
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
    return (_jsxs("div", { className: "px-12 py-10 relative", children: [toast && (_jsx("div", { className: cn('fixed bottom-6 left-1/2 -translate-x-1/2 z-50', 'bg-[#1a2744] text-white text-[14px] font-600 px-5 py-3 rounded-full shadow-lg'), role: "status", "aria-live": "polite", children: toast })), _jsx("h1", { className: "text-[32px] font-800 text-[#1a2744] tracking-[-0.8px] mb-1", children: "Live Sessions" }), _jsx("p", { className: "text-[16px] text-[#717182] mb-8", children: "Upcoming and past live sessions for this course." }), error && (_jsxs("div", { className: "bg-[#fdeaeb] rounded-xl p-4 mb-6 text-[#d03238] text-[14px] font-600", children: ["\u26A0\uFE0F ", error] })), isLoading ? (_jsx("div", { className: "animate-pulse flex flex-col gap-4", children: [1, 2, 3].map((i) => (_jsx("div", { className: "h-28 bg-[#e8ecf4] rounded-[20px]" }, i))) })) : (_jsxs(_Fragment, { children: [liveSessions.length > 0 && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-[13px] font-700 text-[#717182] uppercase tracking-[0.8px] mb-4", children: "Live Now" }), liveSessions.map((s) => _jsx(LiveCard, { session: s }, s.id))] })), _jsx("p", { className: "text-[13px] font-700 text-[#717182] uppercase tracking-[0.8px] mb-4 mt-2", children: "Upcoming Sessions" }), upcomingSessions.length === 0 ? (_jsx(EmptySection, { message: "No upcoming sessions scheduled yet." })) : (upcomingSessions.map((s) => (_jsx(UpcomingCard, { session: s, onToast: showToast }, s.id)))), pastSessions.length > 0 && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-[13px] font-700 text-[#717182] uppercase tracking-[0.8px] mb-4 mt-10", children: "Past Sessions & Recordings" }), pastSessions.map((s) => _jsx(PastCard, { session: s }, s.id))] }))] }))] }));
}
