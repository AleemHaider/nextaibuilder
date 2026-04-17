import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-50 — Admin manual payment review queue
import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchManualPayments, approveManualPayment, rejectManualPayment, } from '../../lib/api';
import { cn } from '../../lib/utils';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ITEMS_PER_PAGE = 20;
const MIN_REJECTION_REASON_LEN = 10;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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
function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
function getAvatarInitial(name) {
    return name.charAt(0).toUpperCase();
}
const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #4a9ad4, #1a2744)',
    'linear-gradient(135deg, #cc4a00, #ff8c5a)',
    'linear-gradient(135deg, #054d28, #16a34a)',
    'linear-gradient(135deg, #7c3aed, #4a9ad4)',
    'linear-gradient(135deg, #d97706, #f59e0b)',
];
function getAvatarGradient(name) {
    const index = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
    return AVATAR_GRADIENTS[index];
}
function Toast({ toast, onDismiss }) {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), 3500);
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);
    return (_jsxs("div", { role: "status", "aria-live": "polite", className: cn('flex items-center gap-3 px-5 py-3.5 rounded-[14px]', 'shadow-[rgba(26,39,68,0.2)_0_4px_20px] text-[14px] font-semibold', 'animate-[slideUp_0.2s_ease-out]', toast.variant === 'success'
            ? 'bg-[#e6f4ec] text-[#054d28] border border-[rgba(5,77,40,0.15)]'
            : 'bg-[#fdeaeb] text-[#d03238] border border-[rgba(208,50,56,0.15)]'), children: [_jsx("span", { "aria-hidden": "true", children: toast.variant === 'success' ? '✓' : '✗' }), toast.message] }));
}
// ---------------------------------------------------------------------------
// SkeletonCard — loading state
// ---------------------------------------------------------------------------
function SkeletonCard() {
    return (_jsxs("div", { className: "bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden", "aria-hidden": "true", children: [_jsxs("div", { className: "flex items-start gap-4 p-5", children: [_jsx("div", { className: "w-20 h-20 rounded-[12px] bg-[#e8ecf4] animate-pulse flex-shrink-0" }), _jsxs("div", { className: "flex-1 space-y-2.5 pt-1", children: [_jsx("div", { className: "h-4 bg-[#e8ecf4] rounded animate-pulse w-1/3" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-1/4" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-2/5" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-1/5" })] })] }), _jsxs("div", { className: "border-t border-[rgba(26,39,68,0.06)] px-5 py-3.5 flex gap-3", children: [_jsx("div", { className: "h-9 w-28 bg-[#e8ecf4] rounded-full animate-pulse" }), _jsx("div", { className: "h-9 w-24 bg-[#e8ecf4] rounded-full animate-pulse" }), _jsx("div", { className: "h-9 w-32 bg-[#e8ecf4] rounded-full animate-pulse ml-auto" })] })] }));
}
function QueueCard({ request, onApprove, onReject, onViewReceipt, isRemoving }) {
    const { student, cohort, amount, createdAt, note, status } = request;
    return (_jsxs("div", { className: cn('bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden', 'transition-all duration-300', isRemoving && 'opacity-0 scale-95 pointer-events-none'), children: [_jsxs("div", { className: "flex items-start gap-4 p-5", children: [_jsx("button", { type: "button", onClick: () => onViewReceipt(request), "aria-label": `View receipt from ${student.name}`, className: cn('w-20 h-20 rounded-[12px] bg-[#e8ecf4] flex-shrink-0', 'flex items-center justify-center text-[28px] cursor-pointer', 'hover:opacity-80 transition-opacity border-none', 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4a9ad4]/40'), children: "\uD83D\uDCC4" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2.5 mb-0.5", children: [student.avatarUrl ? (_jsx("img", { src: student.avatarUrl, alt: "", className: "w-8 h-8 rounded-full flex-shrink-0" })) : (_jsx("div", { className: "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[13px] font-bold", style: { background: getAvatarGradient(student.name) }, "aria-hidden": "true", children: getAvatarInitial(student.name) })), _jsx("span", { className: "text-[16px] font-bold text-[#1a2744]", children: student.name })] }), _jsx("div", { className: "text-[13px] text-[#717182] mb-1", children: student.email }), _jsxs("div", { className: "text-[13px] font-semibold text-[#4a9ad4] mb-1", children: [cohort.name, amount != null && ` · ${formatMoney(amount)}`] }), _jsx("div", { className: "text-[12px] text-[#a3a3a3]", children: formatRelativeTime(createdAt) }), note && (_jsxs("div", { className: cn('mt-2 text-[13px] italic text-[#717182]', 'bg-[#f8f9fb] rounded-[8px] px-2.5 py-2'), children: ["\"", note, "\""] }))] }), status !== 'PENDING' && (_jsx("div", { className: cn('flex-shrink-0 text-[11px] font-bold px-3 py-1 rounded-full', status === 'APPROVED'
                            ? 'bg-[#e6f4ec] text-[#054d28]'
                            : 'bg-[#fdeaeb] text-[#d03238]'), children: status }))] }), _jsxs("div", { className: cn('border-t border-[rgba(26,39,68,0.06)] px-5 py-3.5', 'flex items-center gap-3'), children: [status === 'PENDING' && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: () => onApprove(request), className: cn('flex items-center gap-1.5 px-5 py-2.5 rounded-full', 'bg-[#4a9ad4] text-[#0d1a3a] text-[14px] font-bold border-none cursor-pointer', 'hover:opacity-90 transition-opacity', 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4a9ad4]/40'), children: "\u2713 Approve" }), _jsx("button", { type: "button", onClick: () => onReject(request), className: cn('px-5 py-2.5 rounded-full', 'bg-transparent border-2 border-[rgba(208,50,56,0.3)]', 'text-[#d03238] text-[14px] font-bold cursor-pointer', 'hover:bg-[#fdeaeb] transition-colors', 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300/40'), children: "\u2717 Reject" })] })), _jsx("button", { type: "button", onClick: () => onViewReceipt(request), className: cn('px-4.5 py-2.5 rounded-full', 'bg-[#f0f0f0] text-[#717182] text-[13px] font-semibold border-none cursor-pointer', 'hover:bg-[#e8ecf4] transition-colors ml-auto', 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(26,39,68,0.2)]'), children: "View Receipt \uD83D\uDD0D" })] })] }));
}
function ApproveModal({ request, onConfirm, onCancel, isLoading }) {
    const [approveNote, setApproveNote] = useState('');
    // Trap focus and close on Escape
    useEffect(() => {
        function onKeyDown(e) {
            if (e.key === 'Escape')
                onCancel();
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onCancel]);
    return (_jsx(ModalOverlay, { onClose: onCancel, children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "approve-modal-title", className: "bg-white rounded-[20px] w-full max-w-[440px] overflow-hidden shadow-[rgba(26,39,68,0.2)_0_8px_30px]", children: [_jsxs("div", { className: "bg-[#e6f4ec] px-7 py-5 flex items-center gap-3", children: [_jsx("span", { className: "text-[24px]", "aria-hidden": "true", children: "\u2705" }), _jsx("h2", { id: "approve-modal-title", className: "text-[17px] font-extrabold text-[#054d28]", children: "Approve Payment" })] }), _jsxs("div", { className: "px-7 py-5", children: [_jsxs("p", { className: "text-[14px] text-[#717182] leading-relaxed mb-4", children: ["Confirm approval for ", _jsx("strong", { className: "text-[#1a2744]", children: request.student.name }), "?", _jsx("br", {}), "Course: ", _jsx("strong", { className: "text-[#1a2744]", children: request.cohort.name }), request.amount != null && (_jsxs(_Fragment, { children: [_jsx("br", {}), "Amount: ", _jsx("strong", { className: "text-[#1a2744]", children: formatMoney(request.amount) })] })), _jsx("br", {}), _jsx("br", {}), "This will immediately activate their enrollment and send a confirmation email."] }), _jsx("textarea", { value: approveNote, onChange: (e) => setApproveNote(e.target.value), placeholder: "Optional: Add an internal note...", rows: 3, "aria-label": "Optional approval note", className: cn('w-full rounded-[10px] border-[1.5px] border-[rgba(26,39,68,0.15)]', 'px-3 py-2.5 text-[13px] text-[#1a2744] resize-none outline-none', 'focus:border-[#4a9ad4] transition-colors') })] }), _jsxs("div", { className: "px-7 pb-6 flex justify-end gap-2.5", children: [_jsx("button", { type: "button", onClick: onCancel, disabled: isLoading, className: cn('px-4.5 py-2.5 rounded-full bg-[#f0f0f0] text-[#717182]', 'text-[13px] font-bold border-none cursor-pointer hover:bg-[#e8ecf4] transition-colors'), children: "Cancel" }), _jsxs("button", { type: "button", onClick: () => onConfirm(approveNote), disabled: isLoading, className: cn('px-4.5 py-2.5 rounded-full bg-[#4a9ad4] text-[#0d1a3a]', 'text-[13px] font-bold border-none cursor-pointer hover:opacity-90 transition-opacity', 'flex items-center gap-2', isLoading && 'opacity-60 cursor-not-allowed'), children: [isLoading && (_jsx("div", { className: "w-3.5 h-3.5 rounded-full border-2 border-[rgba(13,26,58,0.3)] border-t-[#0d1a3a] animate-spin" })), "Confirm Approval"] })] })] }) }));
}
function RejectModal({ request, onConfirm, onCancel, isLoading }) {
    const [reason, setReason] = useState('');
    const isValid = reason.trim().length >= MIN_REJECTION_REASON_LEN;
    useEffect(() => {
        function onKeyDown(e) {
            if (e.key === 'Escape')
                onCancel();
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onCancel]);
    return (_jsx(ModalOverlay, { onClose: onCancel, children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "reject-modal-title", className: "bg-white rounded-[20px] w-full max-w-[440px] overflow-hidden shadow-[rgba(26,39,68,0.2)_0_8px_30px]", children: [_jsxs("div", { className: "bg-[#fdeaeb] px-7 py-5 flex items-center gap-3", children: [_jsx("span", { className: "text-[24px]", "aria-hidden": "true", children: "\u26A0\uFE0F" }), _jsx("h2", { id: "reject-modal-title", className: "text-[17px] font-extrabold text-[#d03238]", children: "Reject Receipt" })] }), _jsxs("div", { className: "px-7 py-5", children: [_jsxs("p", { className: "text-[14px] text-[#717182] leading-relaxed mb-3", children: ["Provide a reason for rejecting", ' ', _jsx("strong", { className: "text-[#1a2744]", children: request.student.name }), "'s receipt. This will be sent to them via email."] }), _jsx("textarea", { value: reason, onChange: (e) => setReason(e.target.value), placeholder: "e.g. Receipt shows wrong amount, or name doesn't match...", rows: 3, "aria-label": "Rejection reason (required)", "aria-required": "true", className: cn('w-full rounded-[10px] border-[1.5px] border-[rgba(26,39,68,0.15)]', 'px-3 py-2.5 text-[13px] text-[#1a2744] resize-none outline-none mb-2', 'focus:border-[#4a9ad4] transition-colors', !isValid && reason.length > 0 && 'border-[#d03238]') }), !isValid && reason.length > 0 && (_jsxs("p", { className: "text-[12px] text-[#d03238] mb-3", role: "alert", children: ["Reason must be at least ", MIN_REJECTION_REASON_LEN, " characters."] }))] }), _jsxs("div", { className: "px-7 pb-6 flex justify-end gap-2.5", children: [_jsx("button", { type: "button", onClick: onCancel, disabled: isLoading, className: cn('px-4.5 py-2.5 rounded-full bg-[#f0f0f0] text-[#717182]', 'text-[13px] font-bold border-none cursor-pointer hover:bg-[#e8ecf4] transition-colors'), children: "Cancel" }), _jsxs("button", { type: "button", onClick: () => isValid && onConfirm(reason.trim()), disabled: !isValid || isLoading, "aria-disabled": !isValid || isLoading, className: cn('px-4.5 py-2.5 rounded-full bg-[#d03238] text-white', 'text-[13px] font-bold border-none cursor-pointer hover:opacity-90 transition-opacity', 'flex items-center gap-2', (!isValid || isLoading) && 'opacity-50 cursor-not-allowed'), children: [isLoading && (_jsx("div", { className: "w-3.5 h-3.5 rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-white animate-spin" })), "Reject Receipt"] })] })] }) }));
}
function LightboxModal({ request, onClose, onApprove, onReject }) {
    const { receiptUrl, student, cohort, amount } = request;
    const isPdf = receiptUrl?.toLowerCase().endsWith('.pdf');
    useEffect(() => {
        function onKeyDown(e) {
            if (e.key === 'Escape')
                onClose();
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);
    return (_jsx(ModalOverlay, { onClose: onClose, children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-label": `Receipt from ${student.name}`, className: "bg-white rounded-[20px] w-full max-w-[640px] overflow-hidden shadow-[rgba(26,39,68,0.2)_0_8px_30px]", children: [_jsxs("div", { className: "px-6 py-4 border-b border-[rgba(26,39,68,0.08)] flex items-center gap-3", children: [_jsx("div", { className: "w-9 h-9 rounded-full flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0", style: { background: getAvatarGradient(student.name) }, "aria-hidden": "true", children: getAvatarInitial(student.name) }), _jsxs("div", { children: [_jsx("div", { className: "text-[15px] font-bold text-[#1a2744]", children: student.name }), _jsxs("div", { className: "text-[12px] text-[#717182]", children: [cohort.name, amount != null ? ` · ${formatMoney(amount)}` : ''] })] }), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close receipt lightbox", className: cn('ml-auto w-9 h-9 rounded-full bg-[#f0f0f0] flex items-center justify-center', 'text-[#717182] text-[16px] border-none cursor-pointer hover:bg-[#e8ecf4] transition-colors', 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(26,39,68,0.2)]'), children: "\u2715" })] }), _jsx("div", { className: "bg-[#1a2744] flex items-center justify-center min-h-[320px] relative", children: receiptUrl ? (isPdf ? (_jsx("iframe", { src: receiptUrl, title: "Payment receipt PDF", className: "w-full h-[480px] border-none" })) : (_jsx("img", { src: receiptUrl, alt: `Payment receipt from ${student.name}`, className: "max-w-full max-h-[480px] rounded-[8px] object-contain" }))) : (_jsxs("div", { className: "flex flex-col items-center gap-3 text-white opacity-50", children: [_jsx("span", { className: "text-[56px]", "aria-hidden": "true", children: "\uD83D\uDCC4" }), _jsx("span", { className: "text-[14px]", children: "Receipt preview not available" })] })) }), request.status === 'PENDING' && (_jsxs("div", { className: "px-6 py-4 border-t border-[rgba(26,39,68,0.08)] flex items-center gap-3", children: [_jsx("button", { type: "button", onClick: () => { onClose(); onApprove(request); }, className: cn('flex items-center gap-1.5 px-5 py-2.5 rounded-full', 'bg-[#4a9ad4] text-[#0d1a3a] text-[14px] font-bold border-none cursor-pointer', 'hover:opacity-90 transition-opacity'), children: "\u2713 Approve" }), _jsx("button", { type: "button", onClick: () => { onClose(); onReject(request); }, className: cn('px-5 py-2.5 rounded-full bg-transparent border-2', 'border-[rgba(208,50,56,0.3)] text-[#d03238]', 'text-[14px] font-bold cursor-pointer hover:bg-[#fdeaeb] transition-colors'), children: "\u2717 Reject" })] }))] }) }));
}
// ---------------------------------------------------------------------------
// ModalOverlay — shared backdrop
// ---------------------------------------------------------------------------
function ModalOverlay({ children, onClose, }) {
    return (_jsx("div", { className: cn('fixed inset-0 z-50 flex items-center justify-center p-4', 'bg-[rgba(26,39,68,0.5)] backdrop-blur-sm'), onClick: (e) => {
            if (e.target === e.currentTarget)
                onClose();
        }, "aria-modal": "true", children: children }));
}
function Pagination({ page, total, limit, onPageChange }) {
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1)
        return null;
    return (_jsxs("div", { className: "flex items-center justify-center gap-2 mt-6", children: [_jsx("button", { type: "button", onClick: () => onPageChange(page - 1), disabled: page <= 1, className: cn('px-4 py-2 rounded-full text-[13px] font-semibold border-none cursor-pointer', 'bg-white shadow-[rgba(26,39,68,0.12)_0_0_0_1px] text-[#1a2744]', 'hover:bg-[#eef6fd] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'), children: "\u2190 Previous" }), _jsxs("span", { className: "text-[13px] text-[#717182] px-2", children: ["Page ", page, " of ", totalPages] }), _jsx("button", { type: "button", onClick: () => onPageChange(page + 1), disabled: page >= totalPages, className: cn('px-4 py-2 rounded-full text-[13px] font-semibold border-none cursor-pointer', 'bg-white shadow-[rgba(26,39,68,0.12)_0_0_0_1px] text-[#1a2744]', 'hover:bg-[#eef6fd] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'), children: "Next \u2192" })] }));
}
// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ManualPaymentsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('PENDING');
    const [page, setPage] = useState(1);
    const [modal, setModal] = useState({ type: null, request: null });
    const [removingIds, setRemovingIds] = useState(new Set());
    const [toasts, setToasts] = useState([]);
    // Reset page when tab changes
    function handleTabChange(tab) {
        setActiveTab(tab);
        setPage(1);
    }
    // ---- Query ----
    const { data, isLoading, isError, error, } = useQuery({
        queryKey: ['admin', 'manual-payments', activeTab, page],
        queryFn: () => fetchManualPayments(activeTab, page),
        staleTime: 30_000,
    });
    // ---- Toast helpers ----
    const showToast = useCallback((message, variant) => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, message, variant }]);
    }, []);
    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);
    // ---- Approve mutation ----
    const approveMutation = useMutation({
        mutationFn: ({ id, note }) => approveManualPayment(id, note),
        onSuccess: (_, { id }) => {
            // Fade out the card before invalidating
            setRemovingIds((prev) => new Set(prev).add(id));
            setTimeout(() => {
                setRemovingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                void queryClient.invalidateQueries({ queryKey: ['admin', 'manual-payments'] });
            }, 350);
            showToast('Payment approved — enrollment activated.', 'success');
            setModal({ type: null, request: null });
        },
        onError: (err) => {
            showToast(err instanceof Error ? err.message : 'Failed to approve payment.', 'error');
        },
    });
    // ---- Reject mutation ----
    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }) => rejectManualPayment(id, reason),
        onSuccess: (_, { id }) => {
            setRemovingIds((prev) => new Set(prev).add(id));
            setTimeout(() => {
                setRemovingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                void queryClient.invalidateQueries({ queryKey: ['admin', 'manual-payments'] });
            }, 350);
            showToast('Receipt rejected — student has been notified.', 'success');
            setModal({ type: null, request: null });
        },
        onError: (err) => {
            showToast(err instanceof Error ? err.message : 'Failed to reject receipt.', 'error');
        },
    });
    // ---- Modal openers ----
    function openApproveModal(r) {
        setModal({ type: 'approve', request: r });
    }
    function openRejectModal(r) {
        setModal({ type: 'reject', request: r });
    }
    function openLightbox(r) {
        setModal({ type: 'lightbox', request: r });
    }
    function closeModal() {
        if (!approveMutation.isPending && !rejectMutation.isPending) {
            setModal({ type: null, request: null });
        }
    }
    // ---- Pending count badge ----
    const pendingCount = activeTab === 'PENDING' ? (data?.total ?? 0) : null;
    const tabs = [
        { label: 'Pending', value: 'PENDING' },
        { label: 'Approved', value: 'APPROVED' },
        { label: 'Rejected', value: 'REJECTED' },
    ];
    const emptyMessages = {
        PENDING: 'No pending receipts — all caught up!',
        APPROVED: 'No approved payments yet.',
        REJECTED: 'No rejected receipts.',
    };
    return (_jsxs("div", { className: "min-h-screen bg-[#f8f9fb]", children: [_jsxs("div", { className: cn('flex items-center justify-between px-8 py-6', 'bg-white border-b border-[rgba(26,39,68,0.08)]'), children: [_jsx("h1", { className: "text-[24px] font-extrabold text-[#1a2744]", children: "Manual Payments" }), pendingCount !== null && pendingCount > 0 && (_jsxs("span", { className: cn('bg-[#fff8e6] text-[#8a5a00] text-[13px] font-bold', 'px-3.5 py-1.5 rounded-full'), children: ["\u23F3 ", pendingCount, " pending review"] }))] }), _jsx("div", { className: "px-8 pt-5", children: _jsx("div", { className: "flex gap-1 bg-[#e8ecf4] rounded-[14px] p-1 w-fit", children: tabs.map((tab) => (_jsx("button", { type: "button", onClick: () => handleTabChange(tab.value), "aria-pressed": activeTab === tab.value, className: cn('px-5 py-2 rounded-[11px] text-[14px] font-semibold border-none cursor-pointer', 'transition-all duration-150', activeTab === tab.value
                            ? 'bg-white text-[#1a2744] shadow-[rgba(26,39,68,0.1)_0_1px_4px]'
                            : 'bg-transparent text-[#717182] hover:text-[#1a2744]'), children: tab.label }, tab.value))) }) }), _jsxs("div", { className: "px-8 py-5 flex flex-col gap-4", children: [isLoading && (_jsxs(_Fragment, { children: [_jsx(SkeletonCard, {}), _jsx(SkeletonCard, {}), _jsx(SkeletonCard, {})] })), isError && (_jsxs("div", { className: cn('bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px]', 'px-8 py-14 text-center'), children: [_jsx("div", { className: "text-[48px] mb-4", "aria-hidden": "true", children: "\u26A0\uFE0F" }), _jsx("div", { className: "text-[18px] font-bold text-[#1a2744] mb-2", children: "Failed to load" }), _jsx("div", { className: "text-[14px] text-[#717182]", children: error instanceof Error ? error.message : 'Something went wrong. Please refresh.' })] })), !isLoading && !isError && data?.requests.length === 0 && (_jsxs("div", { className: cn('bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px]', 'px-8 py-16 text-center'), children: [_jsx("div", { className: "text-[56px] mb-4", "aria-hidden": "true", children: activeTab === 'PENDING' ? '✅' : activeTab === 'APPROVED' ? '🎉' : '📋' }), _jsx("div", { className: "text-[22px] font-bold text-[#1a2744] mb-1.5", children: activeTab === 'PENDING' ? 'All caught up!' : 'Nothing here yet' }), _jsx("div", { className: "text-[15px] text-[#717182]", children: emptyMessages[activeTab] })] })), !isLoading &&
                        !isError &&
                        data?.requests.map((request) => (_jsx(QueueCard, { request: request, onApprove: openApproveModal, onReject: openRejectModal, onViewReceipt: openLightbox, isRemoving: removingIds.has(request.id) }, request.id))), !isLoading && !isError && data && (_jsx(Pagination, { page: page, total: data.total, limit: ITEMS_PER_PAGE, onPageChange: setPage }))] }), modal.type === 'approve' && modal.request && (_jsx(ApproveModal, { request: modal.request, isLoading: approveMutation.isPending, onConfirm: (note) => approveMutation.mutate({ id: modal.request.id, note: note || undefined }), onCancel: closeModal })), modal.type === 'reject' && modal.request && (_jsx(RejectModal, { request: modal.request, isLoading: rejectMutation.isPending, onConfirm: (reason) => rejectMutation.mutate({ id: modal.request.id, reason }), onCancel: closeModal })), modal.type === 'lightbox' && modal.request && (_jsx(LightboxModal, { request: modal.request, onClose: closeModal, onApprove: openApproveModal, onReject: openRejectModal })), _jsx("div", { "aria-live": "polite", "aria-atomic": "false", className: "fixed bottom-6 right-6 z-[60] flex flex-col gap-2", children: toasts.map((t) => (_jsx(Toast, { toast: t, onDismiss: dismissToast }, t.id))) })] }));
}
