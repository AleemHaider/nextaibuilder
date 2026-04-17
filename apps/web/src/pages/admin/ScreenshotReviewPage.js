import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FIR-165 — Admin screenshot review queue (Claude Vision FIFO submissions)
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { fetchScreenshotSubmissions, approveSubmission, rejectSubmission, escalateSubmission, } from '../../lib/api';
import { cn } from '../../lib/utils';
const TABS = [
    { label: 'Pending', value: 'PENDING_REVIEW' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
];
const MIN_REJECTION_REASON_LEN = 10;
const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #4a9ad4, #1a2744)',
    'linear-gradient(135deg, #cc4a00, #ff8c5a)',
    'linear-gradient(135deg, #054d28, #16a34a)',
    'linear-gradient(135deg, #7c3aed, #4a9ad4)',
    'linear-gradient(135deg, #d97706, #f59e0b)',
];
function getAvatarGradient(name) {
    return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}
function formatRelativeTime(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60)
        return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
function Toast({ toast, onDismiss }) {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), 3500);
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);
    return (_jsxs("div", { role: "status", "aria-live": "polite", className: cn('flex items-center gap-3 px-5 py-3.5 rounded-[14px] shadow-[rgba(26,39,68,0.2)_0_4px_20px]', 'text-[14px] font-semibold', toast.variant === 'success'
            ? 'bg-[#e6f4ec] text-[#054d28] border border-[rgba(5,77,40,0.15)]'
            : 'bg-[#fdeaeb] text-[#d03238] border border-[rgba(208,50,56,0.15)]'), children: [_jsx("span", { "aria-hidden": "true", children: toast.variant === 'success' ? '✓' : '✗' }), toast.message] }));
}
function useToast() {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((message, variant) => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, message, variant }]);
    }, []);
    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);
    return { toasts, addToast, dismissToast };
}
// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------
function ConfidenceBadge({ score }) {
    const pct = Math.round(score * 100);
    const color = pct >= 80
        ? 'bg-[#e6f4ec] text-[#054d28]'
        : pct >= 60
            ? 'bg-[#fff8e6] text-[#8a5a00]'
            : 'bg-[#fdeaeb] text-[#d03238]';
    return (_jsxs("span", { className: cn('text-[11px] font-[700] px-[9px] py-[3px] rounded-full', color), children: ["AI ", pct, "% confident"] }));
}
// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function SkeletonCard() {
    return (_jsxs("div", { className: "bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden", "aria-hidden": "true", children: [_jsxs("div", { className: "flex items-start gap-4 p-5", children: [_jsx("div", { className: "w-24 h-24 rounded-[12px] bg-[#e8ecf4] animate-pulse flex-shrink-0" }), _jsxs("div", { className: "flex-1 space-y-2.5 pt-1", children: [_jsx("div", { className: "h-4 bg-[#e8ecf4] rounded animate-pulse w-1/3" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-1/4" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-2/5" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-1/5" })] })] }), _jsxs("div", { className: "border-t border-[rgba(26,39,68,0.06)] px-5 py-3.5 flex gap-3", children: [_jsx("div", { className: "h-9 w-28 bg-[#e8ecf4] rounded-full animate-pulse" }), _jsx("div", { className: "h-9 w-24 bg-[#e8ecf4] rounded-full animate-pulse" }), _jsx("div", { className: "h-9 w-32 bg-[#e8ecf4] rounded-full animate-pulse ml-auto" })] })] }));
}
// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------
function Lightbox({ src, alt, onClose }) {
    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape')
                onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-[rgba(13,26,58,0.8)] flex items-center justify-center p-6", role: "dialog", "aria-modal": "true", "aria-label": "Screenshot preview", onClick: onClose, children: _jsxs("div", { className: "relative max-w-[90vw] max-h-[90vh]", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { type: "button", onClick: onClose, "aria-label": "Close preview", className: "absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg hover:bg-[#f0f0f0] transition-colors", children: _jsx(X, { size: 16 }) }), _jsx("img", { src: src, alt: alt, className: "rounded-[16px] shadow-[rgba(26,39,68,0.3)_0_20px_60px] max-w-full max-h-[85vh] object-contain" })] }) }));
}
function RejectModal({ submission, onConfirm, onClose, isPending }) {
    const [reason, setReason] = useState('');
    const inputRef = useRef(null);
    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape')
                onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const isValid = reason.trim().length >= MIN_REJECTION_REASON_LEN;
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-[rgba(13,26,58,0.5)] flex items-center justify-center p-6", role: "dialog", "aria-modal": "true", "aria-label": "Reject submission", children: _jsxs("div", { className: "bg-white rounded-[20px] p-8 w-full max-w-[500px] shadow-[rgba(26,39,68,0.2)_0_20px_60px]", children: [_jsx("h2", { className: "text-[20px] font-[800] text-[#1a2744] mb-1", children: "Reject Screenshot" }), _jsxs("p", { className: "text-[14px] text-[#717182] mb-6", children: ["Provide a reason for", ' ', _jsx("span", { className: "font-semibold text-[#1a2744]", children: submission.student.name }), ". They will see this message."] }), _jsx("label", { htmlFor: "rejection-reason", className: "block text-[13px] font-[600] text-[#1a2744] mb-2", children: "Reason for rejection" }), _jsx("textarea", { id: "rejection-reason", ref: inputRef, value: reason, onChange: (e) => setReason(e.target.value), placeholder: "e.g. Screenshot does not clearly show the tool setup step. Please re-upload a full-screen capture.", rows: 4, className: cn('w-full rounded-[12px] border-[1.5px] p-4 text-[14px] text-[#1a2744] font-[400]', 'bg-[#f8f9fb] resize-none font-[inherit] outline-none transition-colors', 'focus:border-[#4a9ad4] focus:bg-white', reason.length > 0 && !isValid
                        ? 'border-[#d03238]'
                        : 'border-[rgba(26,39,68,0.15)]') }), reason.length > 0 && !isValid && (_jsxs("p", { className: "text-[12px] text-[#d03238] mt-1", role: "alert", children: ["Please provide at least ", MIN_REJECTION_REASON_LEN, " characters."] })), _jsxs("div", { className: "flex gap-3 justify-end mt-6", children: [_jsx("button", { type: "button", onClick: onClose, disabled: isPending, className: "px-5 py-2.5 rounded-full bg-[#f0f0f0] text-[#717182] text-[14px] font-[700] hover:bg-[#e8ecf4] transition-colors disabled:opacity-50", children: "Cancel" }), _jsx("button", { type: "button", onClick: () => onConfirm(reason.trim()), disabled: !isValid || isPending, className: cn('px-5 py-2.5 rounded-full text-[14px] font-[700] transition-colors', 'bg-[#fdeaeb] text-[#d03238] hover:bg-[#fad0d2]', 'disabled:opacity-50 disabled:cursor-not-allowed'), children: isPending ? 'Rejecting…' : 'Reject Submission' })] })] }) }));
}
function SubmissionCard({ submission, onApprove, onReject, onEscalate, onViewScreenshot, isRemoving, }) {
    const [reasonExpanded, setReasonExpanded] = useState(false);
    const isPending = submission.status === 'PENDING_REVIEW';
    return (_jsxs("div", { className: cn('bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden', 'transition-all duration-300', isRemoving && 'opacity-0 scale-95 pointer-events-none'), children: [_jsxs("div", { className: "flex items-start gap-4 p-5", children: [_jsx("button", { type: "button", onClick: () => onViewScreenshot(submission), "aria-label": `Preview screenshot from ${submission.student.name}`, className: cn('w-24 h-24 rounded-[12px] bg-[#e8ecf4] flex-shrink-0 overflow-hidden', 'border-none cursor-pointer hover:opacity-85 transition-opacity', 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4a9ad4]/40'), children: _jsx("img", { src: submission.screenshotUrl, alt: `Screenshot by ${submission.student.name}`, className: "w-full h-full object-cover", onError: (e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                            } }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [submission.student.avatarUrl ? (_jsx("img", { src: submission.student.avatarUrl, alt: "", className: "w-7 h-7 rounded-full flex-shrink-0" })) : (_jsx("div", { className: "w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[12px] font-[700]", style: { background: getAvatarGradient(submission.student.name) }, "aria-hidden": "true", children: submission.student.name.charAt(0).toUpperCase() })), _jsx("span", { className: "text-[15px] font-[700] text-[#1a2744]", children: submission.student.name }), _jsx(ConfidenceBadge, { score: submission.claudeConfidence })] }), _jsx("div", { className: "text-[12px] text-[#717182] mb-1", children: submission.student.email }), _jsxs("div", { className: "flex items-center gap-2 text-[13px] mb-2", children: [_jsx("span", { className: "font-[600] text-[#4a9ad4]", children: submission.step }), _jsx("span", { className: "text-[#a3a3a3]", children: "\u00B7" }), _jsx("span", { className: "text-[#717182]", children: submission.cohort })] }), _jsx("div", { className: "text-[12px] text-[#a3a3a3] mb-2", children: formatRelativeTime(submission.createdAt) }), _jsxs("div", { className: "mt-2", children: [_jsxs("button", { type: "button", onClick: () => setReasonExpanded((v) => !v), className: "flex items-center gap-1 text-[12px] font-[600] text-[#717182] hover:text-[#1a2744] transition-colors", "aria-expanded": reasonExpanded, children: [reasonExpanded ? _jsx(ChevronUp, { size: 14 }) : _jsx(ChevronDown, { size: 14 }), reasonExpanded ? 'Hide' : 'Show', " Claude reasoning"] }), reasonExpanded && (_jsx("pre", { className: "mt-2 p-3 bg-[#f8f9fb] rounded-[10px] text-[12px] text-[#717182] font-mono whitespace-pre-wrap break-words max-h-36 overflow-y-auto", children: submission.claudeReasoning }))] })] })] }), isPending && (_jsxs("div", { className: "border-t border-[rgba(26,39,68,0.06)] px-5 py-3.5 flex items-center gap-3 flex-wrap", children: [_jsx("button", { type: "button", onClick: () => onApprove(submission), className: cn('px-4 py-2 rounded-full text-[13px] font-[700] transition-colors', 'bg-[#e6f4ec] text-[#054d28] hover:bg-[#c8ecda]', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]'), children: "Approve" }), _jsx("button", { type: "button", onClick: () => onReject(submission), className: cn('px-4 py-2 rounded-full text-[13px] font-[700] transition-colors border', 'border-[rgba(208,50,56,0.3)] text-[#d03238] hover:bg-[#fdeaeb]', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d03238]'), children: "Reject" }), _jsx("button", { type: "button", onClick: () => onEscalate(submission), className: cn('ml-auto px-4 py-2 rounded-full text-[13px] font-[700] transition-colors', 'bg-[#fff8e6] text-[#8a5a00] hover:bg-[#fff0cc]', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]'), children: "Flag for Human Review" })] })), submission.status === 'REJECTED' && submission.rejectionReason && (_jsxs("div", { className: "border-t border-[rgba(26,39,68,0.06)] px-5 py-3.5 bg-[#fdeaeb]", children: [_jsx("span", { className: "text-[12px] font-[600] text-[#d03238]", children: "Rejection reason: " }), _jsx("span", { className: "text-[12px] text-[#d03238]", children: submission.rejectionReason })] }))] }));
}
// ---------------------------------------------------------------------------
// ScreenshotReviewPage
// ---------------------------------------------------------------------------
export default function ScreenshotReviewPage() {
    const [activeTab, setActiveTab] = useState('PENDING_REVIEW');
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [lightboxAlt, setLightboxAlt] = useState('');
    const [rejectTarget, setRejectTarget] = useState(null);
    const [removingIds, setRemovingIds] = useState(new Set());
    const { toasts, addToast, dismissToast } = useToast();
    const queryClient = useQueryClient();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['screenshot-submissions', activeTab],
        queryFn: () => fetchScreenshotSubmissions(activeTab),
        staleTime: 30_000,
    });
    function scheduleRemove(id) {
        setRemovingIds((prev) => new Set(prev).add(id));
        setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['screenshot-submissions'] });
            setRemovingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }, 350);
    }
    const approveMutation = useMutation({
        mutationFn: (id) => approveSubmission(id),
        onSuccess: (_, id) => {
            scheduleRemove(id);
            addToast('Submission approved', 'success');
        },
        onError: (err) => {
            addToast(err instanceof Error ? err.message : 'Failed to approve', 'error');
        },
    });
    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }) => rejectSubmission(id, reason),
        onSuccess: (_, { id }) => {
            setRejectTarget(null);
            scheduleRemove(id);
            addToast('Submission rejected', 'success');
        },
        onError: (err) => {
            addToast(err instanceof Error ? err.message : 'Failed to reject', 'error');
        },
    });
    const escalateMutation = useMutation({
        mutationFn: (id) => escalateSubmission(id),
        onSuccess: (_, id) => {
            scheduleRemove(id);
            addToast('Flagged for human review', 'success');
        },
        onError: (err) => {
            addToast(err instanceof Error ? err.message : 'Failed to escalate', 'error');
        },
    });
    const submissions = data?.submissions ?? [];
    return (_jsxs(AdminShell, { title: "Screenshot Review", children: [_jsx("div", { "aria-live": "polite", "aria-atomic": "false", className: "fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none", children: toasts.map((t) => (_jsx("div", { className: "pointer-events-auto", children: _jsx(Toast, { toast: t, onDismiss: dismissToast }) }, t.id))) }), lightboxSrc && (_jsx(Lightbox, { src: lightboxSrc, alt: lightboxAlt, onClose: () => setLightboxSrc(null) })), rejectTarget && (_jsx(RejectModal, { submission: rejectTarget, onClose: () => setRejectTarget(null), onConfirm: (reason) => rejectMutation.mutate({ id: rejectTarget.id, reason }), isPending: rejectMutation.isPending })), _jsxs("div", { className: "p-8", children: [_jsx("div", { className: "flex gap-0 border-b border-[rgba(26,39,68,0.08)] mb-8", role: "tablist", "aria-label": "Submission status filter", children: TABS.map((tab) => (_jsx("button", { type: "button", role: "tab", "aria-selected": activeTab === tab.value, onClick: () => setActiveTab(tab.value), className: cn('px-5 py-3.5 text-[14px] font-[600] border-b-2 transition-colors -mb-px', activeTab === tab.value
                                ? 'text-[#4a9ad4] border-[#4a9ad4]'
                                : 'text-[#717182] border-transparent hover:text-[#1a2744]'), children: tab.label }, tab.value))) }), isLoading && (_jsx("div", { className: "grid gap-4 max-w-3xl", "aria-busy": "true", "aria-label": "Loading submissions", children: [1, 2, 3].map((n) => (_jsx(SkeletonCard, {}, n))) })), isError && !isLoading && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx("div", { className: "text-[40px] mb-4", "aria-hidden": "true", children: "\u26A0\uFE0F" }), _jsx("p", { className: "text-[16px] font-[600] text-[#1a2744]", children: "Failed to load submissions" }), _jsx("p", { className: "text-[14px] text-[#717182] mt-1", children: "Check your connection and try again." })] })), !isLoading && !isError && submissions.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx("div", { className: "text-[48px] mb-4", "aria-hidden": "true", children: activeTab === 'PENDING_REVIEW' ? '🎉' : '📭' }), _jsx("p", { className: "text-[16px] font-[600] text-[#1a2744]", children: activeTab === 'PENDING_REVIEW'
                                    ? 'Queue is clear!'
                                    : `No ${activeTab.toLowerCase().replace('_', ' ')} submissions` }), _jsx("p", { className: "text-[14px] text-[#717182] mt-1", children: activeTab === 'PENDING_REVIEW'
                                    ? 'All submissions have been reviewed.'
                                    : 'Nothing here yet.' })] })), !isLoading && !isError && submissions.length > 0 && (_jsx("div", { className: "grid gap-4 max-w-3xl", role: "list", "aria-label": `${activeTab} submissions`, children: submissions.map((submission) => (_jsx("div", { role: "listitem", children: _jsx(SubmissionCard, { submission: submission, isRemoving: removingIds.has(submission.id), onApprove: (s) => approveMutation.mutate(s.id), onReject: (s) => setRejectTarget(s), onEscalate: (s) => escalateMutation.mutate(s.id), onViewScreenshot: (s) => {
                                    setLightboxSrc(s.screenshotUrl);
                                    setLightboxAlt(`Screenshot by ${s.student.name} for ${s.step}`);
                                } }) }, submission.id))) }))] })] }));
}
