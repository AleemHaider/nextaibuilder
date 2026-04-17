import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-53 — Lesson player: VIDEO (Loom embed), TEXT (prose markdown), TOOL_SETUP
// FIR-161 — Markdown text lesson rendering via .prose class
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { fetchLesson, markLessonComplete, } from '../../lib/api';
import { useCourse } from './CoursePage';
import { cn } from '../../lib/utils';
// ---------------------------------------------------------------------------
// Video embed — Loom iframe at 16:9
// ---------------------------------------------------------------------------
function VideoPlayer({ lesson }) {
    // If embedUrl present use it; fall back to showing a placeholder
    if (lesson.embedUrl) {
        return (_jsx("div", { className: "w-full rounded-[20px] overflow-hidden mb-8", style: { aspectRatio: '16 / 9' }, children: _jsx("iframe", { src: lesson.embedUrl, title: lesson.title, width: "100%", height: "100%", frameBorder: "0", allowFullScreen: true, allow: "autoplay; fullscreen", style: { display: 'block' } }) }));
    }
    // Placeholder if no embed URL yet
    return (_jsxs("div", { className: "w-full rounded-[20px] overflow-hidden mb-8 relative flex items-center justify-center", style: {
            aspectRatio: '16 / 9',
            background: 'linear-gradient(135deg,#0d1a3a 0%,#1a2744 60%,#2d4a8a 100%)',
        }, children: [_jsx("div", { className: "absolute inset-0 opacity-30" }), _jsx("div", { className: cn('w-[72px] h-[72px] rounded-full border-2 border-[rgba(255,255,255,0.4)]', 'bg-[rgba(255,255,255,0.15)] backdrop-blur-sm', 'flex items-center justify-center text-white text-[28px]', 'relative z-10'), children: "\u25B6" }), _jsxs("p", { className: "absolute bottom-5 left-5 text-white text-[14px] font-700 z-10", children: ["Lesson \u00B7 ", lesson.estimatedMinutes, " min"] }), _jsxs("p", { className: "absolute bottom-5 right-5 text-[rgba(255,255,255,0.6)] text-[12px] font-600 z-10 flex items-center gap-1.5", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-[#4a9ad4] inline-block" }), "Watch on Loom"] })] }));
}
// ---------------------------------------------------------------------------
// Text lesson — prose markdown (FIR-161)
// The .prose class lives in index.css; we render raw HTML from the API.
// ---------------------------------------------------------------------------
function TextLesson({ content }) {
    return (
    // eslint-disable-next-line react/no-danger
    _jsx("div", { className: "prose mb-8", dangerouslySetInnerHTML: { __html: content } }));
}
function ToolSetupLesson({ lesson }) {
    const [uploadedFile, setUploadedFile] = useState(null);
    const [validationStatus, setValidationStatus] = useState('IDLE');
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef(null);
    function handleFile(file) {
        setUploadedFile(file);
        setValidationStatus('VALIDATING');
        // Simulate AI validation feedback — real implementation calls API
        setTimeout(() => {
            setValidationStatus('APPROVED');
        }, 2000);
    }
    function handleDrop(e) {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file)
            handleFile(file);
    }
    return (_jsxs("div", { children: [lesson.content && (_jsxs("div", { className: "bg-[#f8f9fb] rounded-[16px] p-6 mb-6", children: [_jsx("p", { className: "text-[14px] font-700 text-[#1a2744] mb-3", children: "Instructions" }), _jsx("div", { className: "text-[14px] text-[#717182] leading-relaxed", 
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML: { __html: lesson.content } })] })), lesson.embedUrl && (_jsxs("div", { className: "bg-white rounded-[16px] p-4 shadow-[rgba(26,39,68,0.12)_0_0_0_1px] mb-6", children: [_jsx("p", { className: "text-[12px] font-600 text-[#717182] uppercase tracking-[0.8px] mb-2.5", children: "Video walkthrough" }), _jsx("div", { className: "bg-[#0d1a3a] rounded-xl h-[160px] flex items-center justify-center relative", style: { aspectRatio: '16/9' }, children: _jsx("iframe", { src: lesson.embedUrl, title: "Tutorial", width: "100%", height: "100%", frameBorder: "0", allowFullScreen: true, style: { borderRadius: 12, display: 'block' } }) })] })), validationStatus === 'VALIDATING' && (_jsxs("div", { className: "bg-[#fff8e6] border border-[rgba(255,192,145,0.4)] rounded-xl p-[14px_18px] flex items-start gap-3 mb-4", children: [_jsx("span", { className: "text-[20px]", children: "\u23F3" }), _jsxs("div", { children: [_jsx("p", { className: "text-[14px] font-700 text-[#8a5a00] mb-0.5", children: "Validating with AI..." }), _jsx("p", { className: "text-[13px] text-[#717182]", children: "Analyzing your screenshot. This usually takes a few seconds." })] })] })), validationStatus === 'APPROVED' && (_jsxs("div", { className: "bg-[#e6f4ec] border border-[rgba(5,77,40,0.2)] rounded-xl p-[14px_18px] flex items-start gap-3 mb-4", children: [_jsx("span", { className: "text-[20px]", children: "\u2705" }), _jsxs("div", { children: [_jsx("p", { className: "text-[14px] font-700 text-[#054d28] mb-0.5", children: "Validated! Step complete." }), _jsx("p", { className: "text-[13px] text-[#717182]", children: "Great work \u2014 your screenshot was accepted." })] })] })), validationStatus === 'REJECTED' && (_jsxs("div", { className: "bg-[#fdeaeb] border border-[rgba(208,50,56,0.2)] rounded-xl p-[14px_18px] flex items-start gap-3 mb-4", children: [_jsx("span", { className: "text-[20px]", children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsx("p", { className: "text-[14px] font-700 text-[#d03238] mb-0.5", children: "Screenshot not recognized" }), _jsx("p", { className: "text-[13px] text-[#717182] mb-2", children: "Your screenshot doesn't clearly show the required output. Please try again." }), _jsx("button", { type: "button", className: "bg-[#d03238] text-white px-3.5 py-1.5 rounded-full text-[12px] font-700 border-none cursor-pointer font-sans", onClick: () => { setValidationStatus('IDLE'); setUploadedFile(null); }, children: "Upload Again" })] })] })), validationStatus === 'UNDER_REVIEW' && (_jsxs("div", { className: "bg-[#fff8e6] border border-[rgba(255,192,145,0.4)] rounded-xl p-[14px_18px] flex items-start gap-3 mb-4", children: [_jsx("span", { className: "text-[20px]", children: "\uD83D\uDD50" }), _jsxs("div", { children: [_jsx("p", { className: "text-[14px] font-700 text-[#8a5a00] mb-0.5", children: "Under manual review" }), _jsx("p", { className: "text-[13px] text-[#717182]", children: "Our team is reviewing your setup. We'll notify you via email within 2 hours." })] })] })), (validationStatus === 'IDLE' || validationStatus === 'REJECTED') && (_jsxs("div", { role: "button", tabIndex: 0, "aria-label": "Upload screenshot", className: cn('border-2 border-dashed border-[#4a9ad4] rounded-[16px] bg-[#f8fbff]', 'p-10 text-center cursor-pointer mb-6 transition-colors', dragOver && 'bg-[#eef6fd]'), onClick: () => fileRef.current?.click(), onKeyDown: (e) => e.key === 'Enter' && fileRef.current?.click(), onDragOver: (e) => { e.preventDefault(); setDragOver(true); }, onDragLeave: () => setDragOver(false), onDrop: handleDrop, children: [_jsx("div", { className: "text-[32px] mb-3", children: "\uD83D\uDCF8" }), _jsx("p", { className: "text-[16px] font-700 text-[#1a2744] mb-1.5", children: uploadedFile ? uploadedFile.name : 'Upload your screenshot' }), _jsx("p", { className: "text-[13px] text-[#717182] mb-2", children: "Drag & drop or click to browse" }), _jsx("span", { className: "text-[14px] font-600 text-[#4a9ad4]", children: "Browse files" }), _jsx("input", { ref: fileRef, type: "file", accept: "image/*", className: "hidden", onChange: (e) => {
                            const file = e.target.files?.[0];
                            if (file)
                                handleFile(file);
                        } })] }))] }));
}
// ---------------------------------------------------------------------------
// Locked lesson state
// ---------------------------------------------------------------------------
function LockedLesson() {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center py-24 text-center", children: [_jsx("div", { className: "text-[64px] mb-5", children: "\uD83D\uDD12" }), _jsx("h2", { className: "text-[24px] font-700 text-[#1a2744] mb-2", children: "Lesson Locked" }), _jsx("p", { className: "text-[16px] text-[#717182] max-w-sm", children: "Complete the previous lessons to unlock this one." })] }));
}
// ---------------------------------------------------------------------------
// LessonPage
// ---------------------------------------------------------------------------
export default function LessonPage() {
    const { slug = '', lessonId = '' } = useParams();
    const navigate = useNavigate();
    const { cohortTitle, modules, refreshCurriculum } = useCourse();
    const [lessonData, setLessonData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const [error, setError] = useState(null);
    const [isMarkingComplete, setIsMarkingComplete] = useState(false);
    const [justCompleted, setJustCompleted] = useState(false);
    const loadLesson = useCallback(async () => {
        setIsLoading(true);
        setIsLocked(false);
        setError(null);
        try {
            const data = await fetchLesson(slug, lessonId);
            setLessonData(data);
        }
        catch (err) {
            if (err instanceof Error && err.message === 'LESSON_LOCKED') {
                setIsLocked(true);
            }
            else {
                setError(err instanceof Error ? err.message : 'Failed to load lesson');
            }
        }
        finally {
            setIsLoading(false);
        }
    }, [slug, lessonId]);
    useEffect(() => {
        void loadLesson();
        setJustCompleted(false);
    }, [loadLesson]);
    async function handleMarkComplete() {
        if (isMarkingComplete || justCompleted)
            return;
        setIsMarkingComplete(true);
        try {
            await markLessonComplete(lessonId);
            setJustCompleted(true);
            await refreshCurriculum();
        }
        catch {
            // Non-fatal — UI still transitions
        }
        finally {
            setIsMarkingComplete(false);
        }
    }
    // Derive module + lesson index for breadcrumb
    const currentModule = modules.find((m) => m.lessons.some((l) => l.id === lessonId));
    const lessonIndexInModule = currentModule?.lessons.findIndex((l) => l.id === lessonId) ?? -1;
    if (isLoading) {
        return (_jsxs("div", { className: "p-10 animate-pulse flex flex-col gap-4", children: [_jsx("div", { className: "h-3 bg-[#e8ecf4] rounded-full w-1/3" }), _jsx("div", { className: "h-8 bg-[#e8ecf4] rounded-full w-2/3" }), _jsx("div", { className: "rounded-[20px] bg-[#e8ecf4]", style: { aspectRatio: '16/9' } })] }));
    }
    if (isLocked)
        return _jsx(LockedLesson, {});
    if (error) {
        return (_jsx("div", { className: "p-10", children: _jsxs("div", { className: "bg-[#fdeaeb] rounded-xl p-5 text-[#d03238] text-[14px] font-600", children: ["\u26A0\uFE0F ", error] }) }));
    }
    if (!lessonData)
        return null;
    const { lesson, prevLesson, nextLesson } = lessonData;
    const isCurrentLessonComplete = modules
        .flatMap((m) => m.lessons)
        .find((l) => l.id === lessonId)?.status === 'COMPLETED';
    const showCompleteBtn = !isCurrentLessonComplete && !justCompleted && lesson.type !== 'TOOL_SETUP';
    return (_jsxs("div", { className: "px-12 py-10 lesson-container", children: [_jsx("style", { children: `
        @media (max-width: 768px) {
          .lesson-container { padding: 20px 16px 32px !important; }
          .lesson-nav-row { flex-direction: column !important; gap: 12px !important; }
          .lesson-nav-row button { width: 100% !important; justify-content: center !important; }
        }
      ` }), _jsxs("p", { className: "text-[13px] text-[#a3a3a3] mb-3", children: [_jsx("span", { className: "text-[#717182]", children: currentModule?.title ?? 'Module' }), ' ', " \u203A Lesson ", lessonIndexInModule >= 0 ? lessonIndexInModule + 1 : ''] }), _jsx("h1", { className: "text-[32px] font-800 text-[#1a2744] tracking-[-0.8px] mb-7", children: lesson.title }), lesson.type === 'VIDEO' && _jsx(VideoPlayer, { lesson: lesson }), lesson.type === 'TEXT' && lesson.content && _jsx(TextLesson, { content: lesson.content }), lesson.type === 'TOOL_SETUP' && _jsx(ToolSetupLesson, { lesson: lesson }), showCompleteBtn && (_jsx("div", { className: "flex justify-end mb-12", children: _jsx("button", { type: "button", disabled: isMarkingComplete, onClick: () => void handleMarkComplete(), className: cn('px-7 py-3.5 rounded-full bg-[#e6f4ec] text-[#054d28]', 'text-[15px] font-700 border-none cursor-pointer font-sans', 'flex items-center gap-2 transition-opacity', isMarkingComplete && 'opacity-60 cursor-not-allowed'), children: isMarkingComplete ? '…' : '✓ Mark as Complete' }) })), (justCompleted || isCurrentLessonComplete) && (_jsx("div", { className: "flex justify-end mb-12", children: _jsx("span", { className: "px-7 py-3.5 rounded-full bg-[#e6f4ec] text-[#054d28] text-[15px] font-700 flex items-center gap-2", children: "\u2713 Completed" }) })), _jsxs("div", { className: "lesson-nav-row flex items-center justify-between pt-6 border-t border-[rgba(26,39,68,0.1)]", children: [prevLesson ? (_jsxs("button", { type: "button", onClick: () => navigate(`/student/course/${slug}/lesson/${prevLesson.id}`), className: cn('px-[22px] py-3 rounded-full', 'bg-transparent border border-[rgba(26,39,68,0.15)]', 'text-[#717182] text-[14px] font-600 cursor-pointer font-sans', 'hover:border-[#4a9ad4] hover:text-[#4a9ad4] transition-colors'), children: ["\u2190 Previous: ", prevLesson.title] })) : (_jsx("div", {})), nextLesson && (_jsxs("button", { type: "button", onClick: () => navigate(`/student/course/${slug}/lesson/${nextLesson.id}`), className: cn('px-7 py-3 rounded-full bg-[#4a9ad4] text-[#0d1a3a]', 'text-[14px] font-700 border-none cursor-pointer font-sans', 'hover:opacity-90 transition-opacity flex items-center gap-2'), children: ["Next: ", nextLesson.title, " \u2192"] }))] })] }));
}
