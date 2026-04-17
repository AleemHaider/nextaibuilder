import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-52 — Curriculum browser: two-column LMS shell with sidebar accordion + content area
// FIR-73 — Mobile responsive: sidebar collapses to a toggle drawer on small screens
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router';
import { Menu, X } from 'lucide-react';
import { fetchCurriculum } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
// ---------------------------------------------------------------------------
// Lesson status icon
// ---------------------------------------------------------------------------
function LessonIcon({ status }) {
    if (status === 'COMPLETED') {
        return (_jsx("div", { className: "w-6 h-6 rounded-full bg-[#e8f4fd] text-[#4a9ad4] text-[11px] font-700 flex items-center justify-center flex-shrink-0", children: "\u2713" }));
    }
    if (status === 'IN_PROGRESS') {
        return (_jsx("div", { className: "w-6 h-6 rounded-full bg-[#4a9ad4] text-white text-[11px] font-700 flex items-center justify-center flex-shrink-0", children: "\u25B6" }));
    }
    return (_jsx("div", { className: "w-6 h-6 rounded-full bg-[#f0f0f0] text-[#d4d4d4] text-[10px] flex items-center justify-center flex-shrink-0", children: "\uD83D\uDD12" }));
}
function ModuleRow({ module, currentLessonId, slug, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    const navigate = useNavigate();
    // Auto-open if this module contains the current lesson
    useEffect(() => {
        if (module.lessons.some((l) => l.id === currentLessonId)) {
            setOpen(true);
        }
    }, [currentLessonId, module.lessons]);
    return (_jsxs("div", { className: "border-b border-[rgba(26,39,68,0.06)]", children: [_jsxs("button", { type: "button", onClick: () => setOpen((o) => !o), className: cn('w-full flex items-center justify-between px-4 py-[14px]', 'cursor-pointer hover:bg-[#f8f9fb] transition-colors', 'bg-transparent border-none text-left font-sans'), "aria-expanded": open, children: [_jsx("span", { className: "text-[14px] font-700 text-[#1a2744]", children: module.title }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[11px] font-600 bg-[#e8ecf4] text-[#717182] px-2 py-0.5 rounded-full", children: module.lessons.length }), _jsx("span", { className: "text-[14px] text-[#a3a3a3]", children: open ? '↑' : '›' })] })] }), open && (_jsx("div", { className: "bg-[#f8f9fb]", children: module.lessons.map((lesson) => {
                    const isCurrent = lesson.id === currentLessonId;
                    const isLocked = lesson.status === 'LOCKED';
                    return (_jsxs("button", { type: "button", disabled: isLocked, onClick: () => {
                            if (!isLocked)
                                navigate(`/student/course/${slug}/lesson/${lesson.id}`);
                        }, className: cn('w-full flex items-center gap-2.5 py-[10px] pr-4 font-sans text-left', 'cursor-pointer border-none bg-transparent', 'border-b border-[rgba(26,39,68,0.04)] transition-colors', isCurrent
                            ? 'bg-[#eef6fd] border-l-[3px] border-l-[#4a9ad4] pl-[25px]'
                            : 'pl-7 hover:bg-[#f0f4f8]', isLocked && 'cursor-not-allowed'), "aria-current": isCurrent ? 'true' : undefined, children: [_jsx(LessonIcon, { status: lesson.status }), _jsx("span", { className: cn('text-[13px] font-500 flex-1 leading-snug', isCurrent && 'text-[#4a9ad4] font-600', isLocked && 'text-[#a3a3a3]', !isCurrent && !isLocked && 'text-[#1a2744]'), children: lesson.title }), _jsxs("span", { className: "text-[11px] text-[#a3a3a3] flex-shrink-0", children: [lesson.estimatedMinutes, "m"] })] }, lesson.id));
                }) }))] }));
}
export const CourseContext = createContext(null);
export function useCourse() {
    const ctx = useContext(CourseContext);
    if (!ctx)
        throw new Error('useCourse must be used inside CoursePage');
    return ctx;
}
// ---------------------------------------------------------------------------
// Sidebar skeleton
// ---------------------------------------------------------------------------
function SidebarSkeleton() {
    return (_jsxs("div", { className: "p-4 flex flex-col gap-3 animate-pulse", children: [_jsx("div", { className: "h-3 bg-[#e8ecf4] rounded-full w-4/5" }), _jsx("div", { className: "h-2 bg-[#e8ecf4] rounded-full w-full" }), _jsx("div", { className: "h-2 bg-[#e8ecf4] rounded-full w-1/2" })] }));
}
// ---------------------------------------------------------------------------
// User dropdown (Sign Out, Dashboard, Settings)
// ---------------------------------------------------------------------------
function UserDropdown({ initials }) {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    // Close on outside click
    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target))
                setOpen(false);
        }
        if (open)
            document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);
    function handleSignOut() {
        logout();
        navigate('/');
    }
    return (_jsxs("div", { className: "relative flex-shrink-0", ref: ref, children: [_jsx("button", { type: "button", onClick: () => setOpen((o) => !o), "aria-label": "User menu", "aria-expanded": open, className: "w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-700 border-none cursor-pointer", style: { background: 'linear-gradient(135deg,#4a9ad4,#1a2744)' }, children: initials }), open && (_jsxs("div", { className: cn('absolute right-0 top-[calc(100%+8px)] z-50 w-[180px]', 'bg-white rounded-[14px] shadow-[0_8px_32px_rgba(13,26,58,0.18)]', 'border border-[rgba(26,39,68,0.08)] overflow-hidden py-1'), role: "menu", children: [_jsxs("button", { type: "button", role: "menuitem", onClick: () => { setOpen(false); navigate('/student/dashboard'); }, className: "w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-[600] text-[#1a2744] hover:bg-[#f0f7ff] text-left bg-transparent border-none cursor-pointer", children: [_jsx("span", { children: "\uD83D\uDCDA" }), " My Courses"] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => { setOpen(false); navigate('/student/notifications'); }, className: "w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-[600] text-[#1a2744] hover:bg-[#f0f7ff] text-left bg-transparent border-none cursor-pointer", children: [_jsx("span", { children: "\uD83D\uDD14" }), " Notifications"] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => { setOpen(false); navigate('/student/settings'); }, className: "w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-[600] text-[#1a2744] hover:bg-[#f0f7ff] text-left bg-transparent border-none cursor-pointer", children: [_jsx("span", { children: "\u2699\uFE0F" }), " Settings"] }), _jsx("div", { className: "h-px bg-[rgba(26,39,68,0.08)] mx-3 my-1" }), _jsxs("button", { type: "button", role: "menuitem", onClick: handleSignOut, className: "w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-[600] text-[#d03238] hover:bg-[#fdeaeb] text-left bg-transparent border-none cursor-pointer", children: [_jsx("span", { children: "\u21A9" }), " Sign out"] })] }))] }));
}
// ---------------------------------------------------------------------------
// CoursePage — LMS shell
// ---------------------------------------------------------------------------
export default function CoursePage() {
    const { slug = '', lessonId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [cohortTitle, setCohortTitle] = useState('');
    const [completionPercentage, setCompletionPercentage] = useState(0);
    const [lessonsCompleted, setLessonsCompleted] = useState(0);
    const [totalLessons, setTotalLessons] = useState(0);
    const [modules, setModules] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadCurriculum = useCallback(async () => {
        try {
            setError(null);
            const data = await fetchCurriculum(slug);
            setCohortTitle(data.cohort.title);
            setCompletionPercentage(data.completionPercentage);
            setLessonsCompleted(data.lessonsCompleted);
            setTotalLessons(data.totalLessons);
            setModules(data.modules);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load curriculum');
        }
        finally {
            setIsLoading(false);
        }
    }, [slug]);
    useEffect(() => {
        void loadCurriculum();
    }, [loadCurriculum]);
    // Navigate to first in-progress or first lesson if no lessonId yet
    useEffect(() => {
        if (isLoading || lessonId || modules.length === 0)
            return;
        const firstInProgress = modules.flatMap((m) => m.lessons).find((l) => l.status === 'IN_PROGRESS');
        const firstLesson = modules[0]?.lessons[0];
        const target = firstInProgress ?? firstLesson;
        if (target) {
            navigate(`/student/course/${slug}/lesson/${target.id}`, { replace: true });
        }
    }, [isLoading, lessonId, modules, slug, navigate]);
    const initials = user?.name
        ? user.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
        : 'S';
    const contextValue = {
        slug,
        cohortTitle,
        completionPercentage,
        lessonsCompleted,
        totalLessons,
        modules,
        currentLessonId: lessonId,
        refreshCurriculum: loadCurriculum,
    };
    const allLessons = modules.flatMap((m) => m.lessons);
    const currentIndex = lessonId ? allLessons.findIndex((l) => l.id === lessonId) : -1;
    const lessonFraction = currentIndex >= 0
        ? `${currentIndex + 1} / ${allLessons.length} lessons`
        : `${allLessons.length} lessons`;
    return (_jsx(CourseContext.Provider, { value: contextValue, children: _jsxs("div", { className: "min-h-screen bg-[#f8f9fb] flex flex-col", children: [_jsxs("header", { className: cn('h-14 bg-white flex items-center px-4 sm:px-5 gap-3 sm:gap-4 flex-shrink-0', '[box-shadow:inset_0_-1px_0_rgba(26,39,68,0.1)]'), children: [_jsx("button", { type: "button", onClick: () => setSidebarOpen(true), "aria-label": "Open course curriculum", className: "lg:hidden p-2 rounded-lg text-[#717182] hover:bg-[#f0f0f0] transition-colors flex-shrink-0 bg-transparent border-none cursor-pointer", children: _jsx(Menu, { size: 18, "aria-hidden": "true" }) }), _jsxs(Link, { to: "/student/dashboard", className: "hidden sm:flex items-center gap-1.5 text-[14px] font-600 text-[#717182] no-underline hover:text-[#1a2744] transition-colors flex-shrink-0", children: [_jsx("span", { className: "text-[18px]", children: "\u2190" }), " Dashboard"] }), _jsx("div", { className: "hidden sm:block w-px h-6 bg-[rgba(26,39,68,0.12)]" }), _jsx("p", { className: "text-[14px] sm:text-[15px] font-600 text-[#1a2744] flex-1 text-center truncate", children: isLoading ? '…' : cohortTitle }), _jsx("span", { className: "hidden sm:inline text-[13px] font-600 text-[#717182] bg-[#f0f0f0] px-3 py-1 rounded-full flex-shrink-0", children: lessonFraction }), _jsx(UserDropdown, { initials: initials })] }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [sidebarOpen && (_jsxs("div", { className: "lg:hidden fixed inset-0 z-40 flex", role: "dialog", "aria-modal": "true", "aria-label": "Course curriculum", children: [_jsx("div", { className: "fixed inset-0 bg-[rgba(13,26,58,0.4)]", "aria-hidden": "true", onClick: () => setSidebarOpen(false) }), _jsxs("aside", { className: "relative z-50 w-[280px] bg-white h-full overflow-y-auto shadow-xl flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-[rgba(26,39,68,0.08)]", children: [_jsx("span", { className: "text-[14px] font-[700] text-[#1a2744]", children: "Curriculum" }), _jsx("button", { type: "button", onClick: () => setSidebarOpen(false), "aria-label": "Close curriculum", className: "p-1 rounded-lg text-[#717182] hover:bg-[#f0f0f0] transition-colors bg-transparent border-none cursor-pointer", children: _jsx(X, { size: 18 }) })] }), isLoading ? (_jsx(SidebarSkeleton, {})) : error ? (_jsx("p", { className: "p-4 text-[13px] text-[#d03238]", children: "Failed to load curriculum" })) : (modules.map((mod, i) => (_jsx(ModuleRow, { module: mod, currentLessonId: lessonId, slug: slug, defaultOpen: i === 0 }, mod.id))))] })] })), _jsxs("aside", { className: "hidden lg:flex w-[280px] bg-white border-r border-[rgba(26,39,68,0.1)] flex-col flex-shrink-0 overflow-y-auto", "aria-label": "Course curriculum", children: [_jsxs("div", { className: "p-5 border-b border-[rgba(26,39,68,0.08)]", children: [_jsx("p", { className: "text-[15px] font-700 text-[#1a2744] mb-1 truncate", children: cohortTitle }), _jsxs("div", { className: "flex justify-between mb-1.5", children: [_jsxs("span", { className: "text-[13px] font-700 text-[#1a2744]", children: [completionPercentage, "% complete"] }), _jsxs("span", { className: "text-[12px] text-[#717182]", children: [lessonsCompleted, " / ", totalLessons] })] }), _jsx("div", { className: "h-1 bg-[#e8ecf4] rounded-full", children: _jsx("div", { className: "h-full bg-[#4a9ad4] rounded-full transition-all", style: { width: `${completionPercentage}%` } }) })] }), isLoading ? (_jsx(SidebarSkeleton, {})) : error ? (_jsx("p", { className: "p-4 text-[13px] text-[#d03238]", children: "Failed to load curriculum" })) : (modules.map((mod, i) => (_jsx(ModuleRow, { module: mod, currentLessonId: lessonId, slug: slug, defaultOpen: i === 0 }, mod.id)))), _jsx("div", { className: "mt-auto p-4 border-t border-[rgba(26,39,68,0.08)]", children: _jsxs(Link, { to: `/student/course/${slug}/sessions`, className: "flex items-center gap-2 text-[13px] font-600 text-[#717182] px-3 py-2 rounded-lg hover:bg-[#f0f0f0] hover:text-[#1a2744] transition-colors no-underline", children: [_jsx("span", { className: "text-[16px]", children: "\uD83D\uDCC5" }), " Live Sessions"] }) })] }), _jsx("main", { className: "flex-1 overflow-y-auto", children: _jsx(Outlet, {}) })] })] }) }));
}
