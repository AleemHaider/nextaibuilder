import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-165 — Admin Course Builder: list + edit with tabs (Overview, Curriculum, Live Sessions, Pricing)
import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, GripVertical, ChevronDown, ChevronUp, Video, FileText, Wrench } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { fetchAdminCourses } from '../../lib/api';
import { cn } from '../../lib/utils';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TABS = ['Overview', 'Curriculum', 'Live Sessions', 'Pricing', 'Enrollments'];
const COURSE_TYPES = [
    { value: 'recorded', label: 'Recorded', desc: 'Self-paced video', icon: '📹', color: 'blue' },
    { value: 'live', label: 'Live Cohort', desc: 'Scheduled sessions', icon: '🔴', color: 'orange' },
    { value: 'combined', label: 'Combined', desc: 'Both formats', icon: '⚡', color: 'navy' },
];
const TYPE_ICON_COLORS = {
    recorded: 'bg-[#e8f4fd]',
    live: 'bg-[#fff0e8]',
    combined: 'bg-[#e8ecf4]',
};
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function newCourse() {
    return {
        id: null,
        title: 'Untitled Course',
        slug: '',
        tagline: '',
        description: '',
        type: 'recorded',
        status: 'DRAFT',
        startDate: '',
        endDate: '',
        maxSeats: '',
        coverImageKey: null,
        modules: [],
    };
}
function newModule(order) {
    return {
        id: crypto.randomUUID(),
        title: 'New Module',
        order,
        expanded: true,
        lessons: [],
    };
}
function newLesson() {
    return {
        id: crypto.randomUUID(),
        title: 'New Lesson',
        type: 'VIDEO',
        estimatedMinutes: 10,
        published: false,
    };
}
const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #1a2744, #4a9ad4)',
    'linear-gradient(135deg, #cc4a00, #ff8c5a)',
    'linear-gradient(135deg, #0d1a3a, #2d4a8a)',
];
function lessonTypeIcon(type) {
    if (type === 'VIDEO')
        return _jsx(Video, { size: 12 });
    if (type === 'TEXT')
        return _jsx(FileText, { size: 12 });
    return _jsx(Wrench, { size: 12 });
}
function Toast({ toast, onDismiss }) {
    useEffect(() => {
        const t = setTimeout(() => onDismiss(toast.id), 3500);
        return () => clearTimeout(t);
    }, [toast.id, onDismiss]);
    return (_jsxs("div", { role: "status", "aria-live": "polite", className: cn('flex items-center gap-3 px-5 py-3.5 rounded-[14px] shadow-[rgba(26,39,68,0.2)_0_4px_20px] text-[14px] font-semibold', toast.variant === 'success'
            ? 'bg-[#e6f4ec] text-[#054d28] border border-[rgba(5,77,40,0.15)]'
            : 'bg-[#fdeaeb] text-[#d03238] border border-[rgba(208,50,56,0.15)]'), children: [_jsx("span", { "aria-hidden": "true", children: toast.variant === 'success' ? '✓' : '✗' }), toast.message] }));
}
function useToast() {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((message, variant) => {
        setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, variant }]);
    }, []);
    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);
    return { toasts, addToast, dismissToast };
}
function CourseListSidebar({ courses, isLoading, selectedId, onSelect, searchQuery, onSearchChange, }) {
    const statusColors = {
        PUBLISHED: 'text-[#054d28]',
        DRAFT: 'text-[#8a5a00]',
        ARCHIVED: 'text-[#717182]',
    };
    return (_jsxs("aside", { className: "w-72 bg-white border-r border-[rgba(26,39,68,0.08)] flex flex-col h-full", children: [_jsxs("div", { className: "p-4 border-b border-[rgba(26,39,68,0.06)]", children: [_jsxs("div", { className: "relative mb-3", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]", "aria-hidden": "true" }), _jsx("input", { type: "search", value: searchQuery, onChange: (e) => onSearchChange(e.target.value), placeholder: "Search courses\u2026", "aria-label": "Search courses", className: cn('w-full pl-8 pr-3 py-2 rounded-[9999px] text-[13px] font-[inherit]', 'border-[1.5px] border-[rgba(26,39,68,0.12)] bg-[#f8f9fb] text-[#1a2744] outline-none', 'focus:border-[#4a9ad4] focus:bg-white transition-colors') })] }), _jsxs("button", { type: "button", onClick: () => onSelect(null), className: cn('w-full flex items-center gap-2 px-3 py-2 rounded-[10px]', 'text-[13px] font-[700] transition-colors', selectedId === null
                            ? 'bg-[#4a9ad4] text-white'
                            : 'bg-[#f0f0f0] text-[#1a2744] hover:bg-[#e8ecf4]'), children: [_jsx(Plus, { size: 14, "aria-hidden": "true" }), "New Course"] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto", role: "list", "aria-label": "Course list", children: [isLoading && (_jsx("div", { className: "p-4 space-y-2", "aria-busy": "true", "aria-label": "Loading courses", children: [1, 2, 3, 4].map((n) => (_jsx("div", { className: "h-14 bg-[#e8ecf4] rounded-[10px] animate-pulse", "aria-hidden": "true" }, n))) })), !isLoading &&
                        courses.map((course, idx) => (_jsxs("button", { type: "button", role: "listitem", onClick: () => onSelect(course), className: cn('w-full flex items-start gap-3 px-4 py-3.5 border-b border-[rgba(26,39,68,0.04)]', 'text-left transition-colors hover:bg-[#f8fbff]', selectedId === course.id && 'bg-[#eef6fd]'), "aria-current": selectedId === course.id ? 'true' : undefined, children: [_jsx("div", { className: "w-10 h-8 rounded-[8px] flex-shrink-0", style: { background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length] }, "aria-hidden": "true" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-[13px] font-[700] text-[#1a2744] truncate", children: course.title }), _jsxs("div", { className: cn('text-[11px] font-[600] mt-0.5', statusColors[course.status]), children: [course.status.charAt(0) + course.status.slice(1).toLowerCase(), " \u00B7", ' ', course.enrollmentCount, " enrolled"] })] })] }, course.id))), !isLoading && courses.length === 0 && (_jsx("div", { className: "p-6 text-center text-[13px] text-[#717182]", children: "No courses found" }))] })] }));
}
// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------
function OverviewTab({ draft, onChange, }) {
    return (_jsx("div", { className: "p-8", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [_jsxs("div", { className: "flex flex-col gap-5", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "course-title", className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Course title" }), _jsx("input", { id: "course-title", type: "text", value: draft.title, onChange: (e) => onChange({ title: e.target.value }), className: cn('w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white', 'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none', 'focus:border-[#4a9ad4] transition-colors') })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Course type" }), _jsx("div", { className: "grid grid-cols-3 gap-3", children: COURSE_TYPES.map((ct) => (_jsxs("button", { type: "button", onClick: () => onChange({ type: ct.value }), className: cn('border-2 rounded-[14px] p-4 flex items-start gap-3 text-left transition-colors', draft.type === ct.value
                                            ? 'border-[#4a9ad4] bg-[#eef6fd]'
                                            : 'border-[rgba(26,39,68,0.12)] hover:border-[#4a9ad4]'), "aria-pressed": draft.type === ct.value, children: [_jsx("div", { className: cn('w-9 h-9 rounded-[10px] flex items-center justify-center text-[18px] flex-shrink-0', TYPE_ICON_COLORS[ct.value]), children: ct.icon }), _jsxs("div", { children: [_jsx("div", { className: "text-[14px] font-[700] text-[#1a2744]", children: ct.label }), _jsx("div", { className: "text-[12px] text-[#717182]", children: ct.desc })] })] }, ct.value))) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "course-tagline", className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Tagline" }), _jsx("input", { id: "course-tagline", type: "text", value: draft.tagline, onChange: (e) => onChange({ tagline: e.target.value }), placeholder: "Short compelling summary\u2026", className: cn('w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white', 'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none', 'focus:border-[#4a9ad4] transition-colors') })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "course-desc", className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Description" }), _jsx("textarea", { id: "course-desc", value: draft.description, onChange: (e) => onChange({ description: e.target.value }), rows: 4, placeholder: "Describe what students will learn\u2026", className: cn('w-full rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white', 'px-4 py-3 text-[15px] text-[#1a2744] font-[inherit] outline-none resize-none', 'focus:border-[#4a9ad4] transition-colors') })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "course-start", className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Start date" }), _jsx("input", { id: "course-start", type: "date", value: draft.startDate, onChange: (e) => onChange({ startDate: e.target.value }), className: cn('w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white', 'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none', 'focus:border-[#4a9ad4] transition-colors') })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "course-end", className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "End date" }), _jsx("input", { id: "course-end", type: "date", value: draft.endDate, onChange: (e) => onChange({ endDate: e.target.value }), className: cn('w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white', 'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none', 'focus:border-[#4a9ad4] transition-colors') })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "course-seats", className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Maximum seats" }), _jsx("input", { id: "course-seats", type: "number", value: draft.maxSeats, onChange: (e) => onChange({ maxSeats: e.target.value }), min: "0", placeholder: "0 = unlimited", className: cn('w-full h-12 rounded-[12px] border-[1.5px] border-[rgba(26,39,68,0.15)] bg-white', 'px-4 text-[15px] text-[#1a2744] font-[inherit] outline-none', 'focus:border-[#4a9ad4] transition-colors') })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[13px] font-[600] text-[#1a2744] mb-1.5", children: "Cover image" }), _jsxs("div", { className: "border-2 border-dashed border-[rgba(26,39,68,0.2)] rounded-[16px] p-8 text-center bg-[#f8f9fb] cursor-pointer hover:border-[#4a9ad4] hover:bg-[#eef6fd] transition-colors", children: [_jsx("div", { className: "text-[32px] mb-2", "aria-hidden": "true", children: "\uD83D\uDDBC" }), _jsxs("div", { className: "text-[14px] text-[#717182]", children: ["Drag & drop or", ' ', _jsx("span", { className: "text-[14px] font-[600] text-[#4a9ad4]", children: "browse files" })] }), _jsx("div", { className: "text-[12px] text-[#a3a3a3] mt-1", children: "PNG, JPG \u00B7 Max 5MB \u00B7 1920\u00D71080px recommended" })] })] })] }) }));
}
// ---------------------------------------------------------------------------
// Curriculum Tab
// ---------------------------------------------------------------------------
function CurriculumTab({ modules, onChange, }) {
    function addModule() {
        onChange([...modules, newModule(modules.length)]);
    }
    function toggleModule(id) {
        onChange(modules.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : m)));
    }
    function updateModuleTitle(id, title) {
        onChange(modules.map((m) => (m.id === id ? { ...m, title } : m)));
    }
    function addLesson(moduleId) {
        onChange(modules.map((m) => m.id === moduleId ? { ...m, lessons: [...m.lessons, newLesson()] } : m));
    }
    function toggleLesson(moduleId, lessonId) {
        onChange(modules.map((m) => m.id === moduleId
            ? {
                ...m,
                lessons: m.lessons.map((l) => l.id === lessonId ? { ...l, published: !l.published } : l),
            }
            : m));
    }
    return (_jsxs("div", { className: "px-8 pt-6 pb-8", children: [modules.map((module) => (_jsxs("div", { className: "bg-white rounded-[14px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] mb-3 overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[#f8f9fb] transition-colors", children: [_jsx(GripVertical, { size: 16, className: "text-[#d4d4d4] flex-shrink-0", "aria-hidden": "true" }), _jsx("input", { type: "text", value: module.title, onChange: (e) => updateModuleTitle(module.id, e.target.value), onClick: (e) => e.stopPropagation(), "aria-label": `Module title: ${module.title}`, className: "flex-1 text-[15px] font-[700] text-[#1a2744] bg-transparent border-none outline-none" }), _jsxs("span", { className: "text-[12px] text-[#717182] bg-[#f0f0f0] px-[10px] py-[2px] rounded-full", children: [module.lessons.length, " lessons"] }), _jsx("button", { type: "button", onClick: () => toggleModule(module.id), "aria-expanded": module.expanded, "aria-label": `${module.expanded ? 'Collapse' : 'Expand'} ${module.title}`, className: "p-1 text-[#a3a3a3] hover:text-[#1a2744] transition-colors", children: module.expanded ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 }) })] }), module.expanded && (_jsxs(_Fragment, { children: [module.lessons.map((lesson) => (_jsxs("div", { className: "flex items-center gap-3 px-4 py-2.5 pl-11 border-t border-[rgba(26,39,68,0.05)]", children: [_jsx("div", { className: "w-6 h-6 rounded-[6px] bg-[#e8f4fd] flex items-center justify-center text-[#4a9ad4] flex-shrink-0", "aria-hidden": "true", children: lessonTypeIcon(lesson.type) }), _jsx("span", { className: "flex-1 text-[13px] font-[500] text-[#1a2744]", children: lesson.title }), _jsxs("span", { className: "text-[12px] text-[#717182]", children: [lesson.estimatedMinutes, "m"] }), _jsx("button", { type: "button", onClick: () => toggleLesson(module.id, lesson.id), role: "switch", "aria-checked": lesson.published, "aria-label": `${lesson.published ? 'Unpublish' : 'Publish'} ${lesson.title}`, className: cn('relative w-9 h-5 rounded-full transition-colors flex-shrink-0', lesson.published ? 'bg-[#4a9ad4]' : 'bg-[#e8ecf4]'), children: _jsx("span", { className: cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all', lesson.published ? 'right-0.5' : 'left-0.5') }) })] }, lesson.id))), _jsx("div", { className: "border-t border-[rgba(26,39,68,0.05)] px-4 py-2.5 pl-11", children: _jsxs("button", { type: "button", onClick: () => addLesson(module.id), className: "text-[13px] font-[600] text-[#4a9ad4] hover:underline flex items-center gap-1", children: [_jsx(Plus, { size: 13, "aria-hidden": "true" }), "Add Lesson"] }) })] }))] }, module.id))), _jsx("button", { type: "button", onClick: addModule, className: cn('w-full py-3.5 border-2 border-dashed border-[rgba(26,39,68,0.2)] rounded-[14px]', 'text-[14px] font-[600] text-[#717182] hover:border-[#4a9ad4] hover:text-[#4a9ad4]', 'transition-colors bg-transparent font-[inherit]'), children: "+ Add Module" })] }));
}
// ---------------------------------------------------------------------------
// Live Sessions Tab (placeholder table matching 20-admin-live-sessions design)
// ---------------------------------------------------------------------------
const DEMO_SESSIONS = [
    {
        id: '1',
        title: 'Week 1: AI Fundamentals',
        scheduledAt: '2025-01-20T18:00:00Z',
        durationMinutes: 90,
        zoomUrl: 'https://zoom.us/j/12345678',
        status: 'UPCOMING',
    },
    {
        id: '2',
        title: 'Week 2: Building with Claude API',
        scheduledAt: '2025-01-27T18:00:00Z',
        durationMinutes: 90,
        zoomUrl: 'https://zoom.us/j/87654321',
        status: 'PAST',
    },
];
function LiveSessionsTab() {
    const statusStyles = {
        LIVE: 'bg-[#fdeaeb] text-[#d03238]',
        UPCOMING: 'bg-[#e8f4fd] text-[#1a2744]',
        PAST: 'bg-[#e6f4ec] text-[#054d28]',
        CANCELLED: 'bg-[#f0f0f0] text-[#717182]',
    };
    return (_jsxs("div", { className: "px-8 py-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-[15px] font-[700] text-[#1a2744]", children: "Live Sessions" }), _jsx("button", { type: "button", className: "px-4 py-2 rounded-full bg-[#4a9ad4] text-[#0d1a3a] text-[13px] font-[700] hover:opacity-90 transition-opacity", children: "+ Schedule Session" })] }), _jsx("div", { className: "bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden", children: _jsxs("table", { className: "w-full border-collapse", "aria-label": "Live sessions", children: [_jsx("thead", { children: _jsx("tr", { children: ['Title', 'Date & Time', 'Duration', 'Zoom Link', 'Status', 'Actions'].map((col) => (_jsx("th", { scope: "col", className: "text-left text-[12px] font-[600] text-[#717182] px-5 py-3 border-b border-[rgba(26,39,68,0.08)] uppercase tracking-[0.5px] bg-[#f8f9fb]", children: col }, col))) }) }), _jsx("tbody", { children: DEMO_SESSIONS.map((session) => (_jsxs("tr", { className: "hover:[&>td]:bg-[#f8f9fb] transition-colors", children: [_jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[14px] font-[600] text-[#1a2744]", children: session.title }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]", children: new Date(session.scheduledAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        }) }), _jsxs("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]", children: [session.durationMinutes, "m"] }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: _jsx("span", { className: "text-[13px] text-[#717182] font-mono truncate max-w-[180px] block overflow-hidden text-ellipsis whitespace-nowrap", children: session.zoomUrl }) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: _jsx("span", { className: cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', statusStyles[session.status]), children: session.status.charAt(0) + session.status.slice(1).toLowerCase() }) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { type: "button", className: "text-[13px] font-[600] text-[#4a9ad4] hover:underline", children: "Edit" }), _jsx("button", { type: "button", className: "text-[13px] font-[600] text-[#d03238] hover:underline", children: "Cancel" })] }) })] }, session.id))) })] }) })] }));
}
// ---------------------------------------------------------------------------
// Pricing / Enrollments placeholder tabs
// ---------------------------------------------------------------------------
function PlaceholderTabContent({ label }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center px-8", children: [_jsx("div", { className: "text-[48px] mb-4", "aria-hidden": "true", children: "\uD83D\uDEA7" }), _jsx("p", { className: "text-[16px] font-[600] text-[#1a2744]", children: label }), _jsx("p", { className: "text-[14px] text-[#717182] mt-1", children: "This tab is managed in a future epic." })] }));
}
function CourseEditor({ draft, onChange, onSave, onTogglePublish, isSaving }) {
    const [activeTab, setActiveTab] = useState('Overview');
    return (_jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "bg-white border-b border-[rgba(26,39,68,0.08)] px-8 py-4 flex items-center gap-4", children: [_jsx("input", { type: "text", value: draft.title, onChange: (e) => onChange({ title: e.target.value }), "aria-label": "Course title", className: "flex-1 text-[20px] font-[700] text-[#1a2744] bg-transparent border-none outline-none" }), _jsx("span", { className: cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', draft.status === 'PUBLISHED' ? 'bg-[#e6f4ec] text-[#054d28]' : 'bg-[#fff8e6] text-[#8a5a00]'), children: draft.status.charAt(0) + draft.status.slice(1).toLowerCase() }), _jsxs("div", { className: "flex gap-2.5 ml-auto", children: [_jsx("button", { type: "button", onClick: onSave, disabled: isSaving, className: "px-5 py-2 rounded-full bg-[#f0f0f0] text-[#1a2744] text-[14px] font-[700] hover:bg-[#e8ecf4] disabled:opacity-50 transition-colors", children: isSaving ? 'Saving…' : 'Save' }), _jsx("button", { type: "button", onClick: onTogglePublish, className: "px-5 py-2 rounded-full bg-[#4a9ad4] text-[#0d1a3a] text-[14px] font-[700] hover:opacity-90 transition-opacity", children: draft.status === 'PUBLISHED' ? 'Unpublish' : 'Publish' })] })] }), _jsx("div", { className: "flex gap-0 bg-white border-b-2 border-[rgba(26,39,68,0.08)] px-8", role: "tablist", "aria-label": "Course editor sections", children: TABS.map((tab) => (_jsx("button", { type: "button", role: "tab", "aria-selected": activeTab === tab, onClick: () => setActiveTab(tab), className: cn('px-5 py-3.5 text-[14px] font-[600] border-b-2 transition-colors -mb-[2px]', activeTab === tab
                        ? 'text-[#4a9ad4] border-[#4a9ad4]'
                        : 'text-[#717182] border-transparent hover:text-[#1a2744]'), children: tab }, tab))) }), _jsxs("div", { className: "flex-1 overflow-y-auto bg-[#f8f9fb]", children: [activeTab === 'Overview' && (_jsx(OverviewTab, { draft: draft, onChange: onChange })), activeTab === 'Curriculum' && (_jsx(CurriculumTab, { modules: draft.modules, onChange: (modules) => onChange({ modules }) })), activeTab === 'Live Sessions' && _jsx(LiveSessionsTab, {}), activeTab === 'Pricing' && _jsx(PlaceholderTabContent, { label: "Pricing Plans" }), activeTab === 'Enrollments' && _jsx(PlaceholderTabContent, { label: "Course Enrollments" })] })] }));
}
// ---------------------------------------------------------------------------
// CourseBuilderPage
// ---------------------------------------------------------------------------
export default function CourseBuilderPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(undefined);
    const [draft, setDraft] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const { toasts, addToast, dismissToast } = useToast();
    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    const { data, isLoading } = useQuery({
        queryKey: ['admin-courses', debouncedQuery],
        queryFn: () => fetchAdminCourses(debouncedQuery || undefined),
        staleTime: 60_000,
    });
    const courses = data?.courses ?? [];
    function handleSelectCourse(course) {
        setSelectedCourse(course);
        if (course === null) {
            setDraft(newCourse());
        }
        else {
            setDraft({
                id: course.id,
                title: course.title,
                slug: course.slug,
                tagline: course.tagline ?? '',
                description: '',
                type: course.type,
                status: course.status,
                startDate: course.startDate ?? '',
                endDate: course.endDate ?? '',
                maxSeats: course.maxSeats != null ? String(course.maxSeats) : '',
                coverImageKey: course.coverImageKey ?? null,
                modules: [],
            });
        }
    }
    function handleDraftChange(updated) {
        setDraft((prev) => (prev ? { ...prev, ...updated } : prev));
    }
    async function handleSave() {
        if (!draft)
            return;
        setIsSaving(true);
        // Stub: in a real implementation this calls createAdminCourse / updateAdminCourse
        await new Promise((resolve) => setTimeout(resolve, 600));
        setIsSaving(false);
        addToast('Course saved', 'success');
    }
    function handleTogglePublish() {
        if (!draft)
            return;
        const nextStatus = draft.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
        setDraft((prev) => (prev ? { ...prev, status: nextStatus } : prev));
        addToast(nextStatus === 'PUBLISHED' ? 'Course published' : 'Course unpublished', 'success');
    }
    return (_jsxs(AdminShell, { title: "Courses", children: [_jsx("div", { "aria-live": "polite", className: "fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none", children: toasts.map((t) => (_jsx("div", { className: "pointer-events-auto", children: _jsx(Toast, { toast: t, onDismiss: dismissToast }) }, t.id))) }), _jsxs("div", { className: "flex h-full overflow-hidden", children: [_jsx(CourseListSidebar, { courses: courses, isLoading: isLoading, selectedId: selectedCourse?.id ?? (selectedCourse === null ? null : undefined) ?? null, onSelect: handleSelectCourse, searchQuery: searchQuery, onSearchChange: setSearchQuery }), draft ? (_jsx(CourseEditor, { draft: draft, onChange: handleDraftChange, onSave: handleSave, onTogglePublish: handleTogglePublish, isSaving: isSaving })) : (_jsxs("div", { className: "flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#f8f9fb]", children: [_jsx("div", { className: "text-[56px] mb-5", "aria-hidden": "true", children: "\uD83D\uDCDA" }), _jsx("p", { className: "text-[18px] font-[700] text-[#1a2744]", children: "Select a course to edit" }), _jsx("p", { className: "text-[14px] text-[#717182] mt-1 max-w-xs", children: "Choose a course from the left panel, or create a new one." })] }))] })] }));
}
