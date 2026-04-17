import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-166 — Admin student list with search, filters, sortable table, and slide-in detail drawer
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Search, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { fetchAdminStudents, updateEnrollmentStatus, authFetch, } from '../../lib/api';
import { cn } from '../../lib/utils';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ITEMS_PER_PAGE = 20;
const STATUS_FILTERS = [
    { label: 'All Statuses', value: '' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Suspended', value: 'SUSPENDED' },
    { label: 'Revoked', value: 'REVOKED' },
];
const PAYMENT_STATUS_FILTERS = [
    { label: 'All Payments', value: '' },
    { label: 'Paid', value: 'PAID' },
    { label: 'Partial', value: 'PARTIAL' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Failed', value: 'FAILED' },
];
const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #4a9ad4, #1a2744)',
    'linear-gradient(135deg, #cc4a00, #ff8c5a)',
    'linear-gradient(135deg, #054d28, #16a34a)',
    'linear-gradient(135deg, #4a105a, #6b37d1)',
    'linear-gradient(135deg, #0d1a3a, #2d4a8a)',
];
function getAvatarGradient(name) {
    return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}
function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
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
// Badge helpers
// ---------------------------------------------------------------------------
function EnrollmentStatusBadge({ status }) {
    const styles = {
        ACTIVE: 'bg-[#e6f4ec] text-[#054d28]',
        COMPLETED: 'bg-[#e8ecf4] text-[#1a2744]',
        SUSPENDED: 'bg-[#fff8e6] text-[#8a5a00]',
        REVOKED: 'bg-[#fdeaeb] text-[#d03238]',
    };
    const labels = {
        ACTIVE: 'Active',
        COMPLETED: 'Completed',
        SUSPENDED: 'Suspended',
        REVOKED: 'Revoked',
    };
    return (_jsx("span", { className: cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', styles[status]), children: labels[status] }));
}
function PaymentStatusBadge({ status }) {
    const styles = {
        PAID: 'bg-[#e6f4ec] text-[#054d28]',
        PARTIAL: 'bg-[#fff8e6] text-[#8a5a00]',
        PENDING: 'bg-[#fff8e6] text-[#8a5a00]',
        FAILED: 'bg-[#fdeaeb] text-[#d03238]',
    };
    const labels = {
        PAID: 'Paid',
        PARTIAL: 'Partial',
        PENDING: 'Pending',
        FAILED: 'Failed',
    };
    return (_jsx("span", { className: cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', styles[status]), children: labels[status] }));
}
function ConfirmActionModal({ enrollment, actionLabel, newStatus, onConfirm, onClose, isPending, }) {
    const [reason, setReason] = useState('');
    const inputRef = useRef(null);
    useEffect(() => {
        inputRef.current?.focus();
        function onKey(e) {
            if (e.key === 'Escape')
                onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const isDanger = newStatus === 'REVOKED';
    const isValid = reason.trim().length >= 5;
    return (_jsx("div", { className: "fixed inset-0 z-[60] bg-[rgba(13,26,58,0.5)] flex items-center justify-center p-6", role: "dialog", "aria-modal": "true", children: _jsxs("div", { className: "bg-white rounded-[20px] p-8 w-full max-w-[460px] shadow-[rgba(26,39,68,0.2)_0_20px_60px]", children: [_jsxs("h2", { className: "text-[20px] font-[800] text-[#1a2744] mb-1", children: [actionLabel, " Access"] }), _jsxs("p", { className: "text-[14px] text-[#717182] mb-6", children: ["This will", ' ', _jsx("span", { className: "font-semibold text-[#1a2744]", children: actionLabel.toLowerCase() }), ' ', _jsx("span", { className: "font-semibold text-[#1a2744]", children: enrollment.student.name }), "'s access to ", _jsx("span", { className: "font-semibold text-[#1a2744]", children: enrollment.cohort.title }), "."] }), _jsx("label", { htmlFor: "action-reason", className: "block text-[13px] font-[600] text-[#1a2744] mb-2", children: "Reason (required)" }), _jsx("textarea", { id: "action-reason", ref: inputRef, value: reason, onChange: (e) => setReason(e.target.value), placeholder: "Provide a brief reason\u2026", rows: 3, className: cn('w-full rounded-[12px] border-[1.5px] p-4 text-[14px] font-[inherit]', 'bg-[#f8f9fb] resize-none outline-none transition-colors', 'focus:border-[#4a9ad4] focus:bg-white border-[rgba(26,39,68,0.15)]') }), _jsxs("div", { className: "flex gap-3 justify-end mt-6", children: [_jsx("button", { type: "button", onClick: onClose, disabled: isPending, className: "px-5 py-2.5 rounded-full bg-[#f0f0f0] text-[#717182] text-[14px] font-[700] hover:bg-[#e8ecf4] transition-colors disabled:opacity-50", children: "Cancel" }), _jsx("button", { type: "button", onClick: () => onConfirm(reason.trim()), disabled: !isValid || isPending, className: cn('px-5 py-2.5 rounded-full text-[14px] font-[700] transition-colors', isDanger
                                ? 'bg-[#fdeaeb] text-[#d03238] hover:bg-[#fad0d2]'
                                : 'bg-[#fff8e6] text-[#8a5a00] hover:bg-[#fff0cc]', 'disabled:opacity-50 disabled:cursor-not-allowed'), children: isPending ? 'Processing…' : `Confirm ${actionLabel}` })] })] }) }));
}
function StudentDetailDrawer({ enrollment, onClose, onSuspend, onRevoke, onReinstate, }) {
    const { student, cohort, progress, paymentStatus, status, installments, enrolledAt } = enrollment;
    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape')
                onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (_jsxs("div", { className: "fixed inset-0 z-40 flex items-start justify-end", role: "dialog", "aria-modal": "true", "aria-label": `${student.name} details`, children: [_jsx("div", { className: "fixed inset-0 bg-[rgba(13,26,58,0.4)]", "aria-hidden": "true", onClick: onClose }), _jsxs("aside", { className: "relative z-50 w-full max-w-[520px] h-full bg-white shadow-[-8px_0_40px_rgba(26,39,68,0.15)] overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-6 border-b border-[rgba(26,39,68,0.08)]", children: [_jsx("h2", { className: "text-[18px] font-[800] text-[#1a2744]", children: "Student Details" }), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close details panel", className: "w-9 h-9 rounded-full bg-[#f0f0f0] flex items-center justify-center hover:bg-[#e8ecf4] transition-colors", children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: "px-6 py-6", children: [_jsxs("div", { className: "flex items-center gap-4 mb-6", children: [student.avatarUrl ? (_jsx("img", { src: student.avatarUrl, alt: "", className: "w-16 h-16 rounded-full flex-shrink-0" })) : (_jsx("div", { className: "w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[24px] font-[700]", style: { background: getAvatarGradient(student.name) }, "aria-hidden": "true", children: student.name.charAt(0).toUpperCase() })), _jsxs("div", { children: [_jsx("div", { className: "text-[20px] font-[800] text-[#1a2744]", children: student.name }), _jsx("div", { className: "text-[14px] text-[#717182] mt-0.5", children: student.email }), _jsxs("div", { className: "text-[13px] text-[#a3a3a3] mt-0.5", children: ["Joined ", formatDate(student.joinedAt)] })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-[12px] font-[700] text-[#717182] uppercase tracking-[0.8px] mb-3", children: "Enrollment" }), _jsxs("div", { className: "bg-[#f8f9fb] rounded-[12px] p-4", children: [_jsx("div", { className: "text-[14px] font-[700] text-[#1a2744] mb-3", children: cohort.title }), _jsxs("div", { className: "flex items-center gap-4 flex-wrap", children: [_jsxs("div", { className: "flex items-center gap-2 flex-1", children: [_jsx("div", { className: "flex-1 h-[5px] bg-[#e8ecf4] rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-[#4a9ad4] rounded-full", style: { width: `${progress}%` }, role: "progressbar", "aria-valuenow": progress, "aria-valuemin": 0, "aria-valuemax": 100 }) }), _jsxs("span", { className: "text-[12px] font-[600] text-[#717182] whitespace-nowrap", children: [progress, "%"] })] }), _jsx(PaymentStatusBadge, { status: paymentStatus }), _jsx(EnrollmentStatusBadge, { status: status })] }), _jsxs("div", { className: "text-[12px] text-[#a3a3a3] mt-2", children: ["Enrolled ", formatDate(enrolledAt)] })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-[12px] font-[700] text-[#717182] uppercase tracking-[0.8px] mb-3", children: "Details" }), [
                                        { label: 'Course', value: cohort.title },
                                        { label: 'Progress', value: `${progress}%` },
                                        { label: 'Payment Status', value: paymentStatus },
                                        { label: 'Access Status', value: status },
                                        { label: 'Enrolled', value: formatDate(enrolledAt) },
                                        ...(enrollment.lastActiveAt
                                            ? [{ label: 'Last Active', value: formatDate(enrollment.lastActiveAt) }]
                                            : []),
                                        ...(enrollment.paymentType
                                            ? [{ label: 'Payment Type', value: enrollment.paymentType }]
                                            : []),
                                    ].map(({ label, value }) => (_jsxs("div", { className: "flex justify-between items-center py-2.5 border-b border-[rgba(26,39,68,0.04)] last:border-b-0", children: [_jsx("span", { className: "text-[14px] text-[#717182]", children: label }), _jsx("span", { className: "text-[14px] font-[600] text-[#1a2744]", children: value })] }, label)))] }), installments && installments.length > 0 && (_jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-[12px] font-[700] text-[#717182] uppercase tracking-[0.8px] mb-3", children: "Payment Timeline" }), _jsx("div", { className: "flex flex-col gap-2", children: installments.map((inst, idx) => {
                                            const statusColor = inst.status === 'PAID'
                                                ? 'bg-[#e6f4ec] text-[#054d28]'
                                                : inst.status === 'OVERDUE'
                                                    ? 'bg-[#fdeaeb] text-[#d03238]'
                                                    : 'bg-[#fff8e6] text-[#8a5a00]';
                                            return (_jsxs("div", { className: "flex items-center justify-between py-2.5 border-b border-[rgba(26,39,68,0.04)] last:border-b-0", children: [_jsxs("div", { children: [_jsxs("div", { className: "text-[13px] font-[600] text-[#1a2744]", children: ["Payment ", idx + 1, " \u2014 ", formatMoney(inst.amount)] }), _jsxs("div", { className: "text-[12px] text-[#717182]", children: ["Due ", formatDate(inst.dueDate), inst.paidAt && ` · Paid ${formatDate(inst.paidAt)}`] })] }), _jsx("span", { className: cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', statusColor), children: inst.status })] }, inst.id));
                                        }) })] })), _jsxs("div", { className: "flex flex-wrap gap-2.5 mt-4", children: [status === 'ACTIVE' && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: () => onSuspend(enrollment), className: cn('flex-1 px-4 py-3 rounded-full text-[14px] font-[700] transition-colors', 'bg-[#fff8e6] text-[#8a5a00] hover:bg-[#fff0cc]', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]'), children: "Suspend Access" }), _jsx("button", { type: "button", onClick: () => onRevoke(enrollment), className: cn('flex-1 px-4 py-3 rounded-full text-[14px] font-[700] transition-colors', 'bg-[#fdeaeb] text-[#d03238] hover:bg-[#fad0d2]', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d03238]'), children: "Revoke Access" })] })), (status === 'SUSPENDED' || status === 'REVOKED') && (_jsx("button", { type: "button", onClick: () => onReinstate(enrollment), className: cn('flex-1 px-4 py-3 rounded-full text-[14px] font-[700] transition-colors', 'bg-[#e6f4ec] text-[#054d28] hover:bg-[#c8ecda]', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]'), children: "Reinstate Access" })), _jsx("button", { type: "button", onClick: () => window.open(`mailto:${student.email}`), className: cn('flex-1 px-4 py-3 rounded-full text-[14px] font-[700] transition-colors', 'bg-[#f0f0f0] text-[#1a2744] hover:bg-[#e8ecf4]', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a9ad4]'), children: "Send Email" })] })] })] })] }));
}
export default function StudentListPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('');
    const [page, setPage] = useState(1);
    const [selectedEnrollment, setSelectedEnrollment] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);
    const { toasts, addToast, dismissToast } = useToast();
    const queryClient = useQueryClient();
    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
            setPage(1);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    const { data, isLoading, isError } = useQuery({
        queryKey: ['admin-students', debouncedQuery, statusFilter, page],
        queryFn: () => fetchAdminStudents({
            q: debouncedQuery || undefined,
            status: statusFilter || undefined,
            page,
            limit: ITEMS_PER_PAGE,
        }),
        staleTime: 30_000,
        placeholderData: (prev) => prev,
    });
    const statusMutation = useMutation({
        mutationFn: ({ id, status, reason, }) => updateEnrollmentStatus(id, status, reason),
        onSuccess: (_, { status }) => {
            setConfirmAction(null);
            setSelectedEnrollment(null);
            queryClient.invalidateQueries({ queryKey: ['admin-students'] });
            const label = status === 'SUSPENDED'
                ? 'suspended'
                : status === 'REVOKED'
                    ? 'revoked'
                    : 'reinstated';
            addToast(`Access ${label} successfully`, 'success');
        },
        onError: (err) => {
            addToast(err instanceof Error ? err.message : 'Failed to update access', 'error');
        },
    });
    function handleReinstate(enrollment) {
        statusMutation.mutate({ id: enrollment.id, status: 'ACTIVE' });
    }
    const enrollments = data?.enrollments ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    async function handleExportCSV() {
        try {
            const res = await authFetch('/api/v1/admin/students/export');
            if (!res.ok)
                throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }
        catch {
            addToast('Export failed. Please try again.', 'error');
        }
    }
    return (_jsxs(AdminShell, { title: "Students", actions: _jsxs("button", { type: "button", onClick: handleExportCSV, className: "px-5 py-2 rounded-full border-[1.5px] border-[rgba(26,39,68,0.15)] text-[#717182] text-[14px] font-[600] hover:bg-[#f0f0f0] transition-colors inline-flex items-center gap-2", children: [_jsx(Download, { size: 14 }), "Export CSV"] }), children: [_jsx("div", { "aria-live": "polite", className: "fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none", children: toasts.map((t) => (_jsx("div", { className: "pointer-events-auto", children: _jsx(Toast, { toast: t, onDismiss: dismissToast }) }, t.id))) }), selectedEnrollment && (_jsx(StudentDetailDrawer, { enrollment: selectedEnrollment, onClose: () => setSelectedEnrollment(null), onSuspend: (e) => setConfirmAction({ enrollment: e, type: 'SUSPENDED' }), onRevoke: (e) => setConfirmAction({ enrollment: e, type: 'REVOKED' }), onReinstate: handleReinstate })), confirmAction && (_jsx(ConfirmActionModal, { enrollment: confirmAction.enrollment, actionLabel: confirmAction.type === 'SUSPENDED' ? 'Suspend' : 'Revoke', newStatus: confirmAction.type, onClose: () => setConfirmAction(null), onConfirm: (reason) => statusMutation.mutate({
                    id: confirmAction.enrollment.id,
                    status: confirmAction.type,
                    reason,
                }), isPending: statusMutation.isPending })), _jsx("div", { className: "flex border-b border-[rgba(26,39,68,0.08)] bg-white", children: [
                    { label: 'Total Students', value: String(total) },
                    { label: 'Active Enrollments', value: '—' },
                    { label: 'Pending Approval', value: '—' },
                    { label: 'Failed Payments', value: '—' },
                ].map((stat) => (_jsxs("div", { className: "flex-1 px-7 py-5 border-r border-[rgba(26,39,68,0.06)] last:border-r-0", children: [_jsx("div", { className: "text-[28px] font-[900] text-[#1a2744] tracking-[-0.5px]", children: stat.value }), _jsx("div", { className: "text-[13px] text-[#717182] mt-0.5", children: stat.label })] }, stat.label))) }), _jsxs("div", { className: "flex items-center gap-3 px-8 py-5 border-b border-[rgba(26,39,68,0.06)] bg-white flex-wrap", children: [_jsxs("div", { className: "flex-1 min-w-[200px] relative", children: [_jsx(Search, { size: 16, className: "absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]", "aria-hidden": "true" }), _jsx("input", { type: "search", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: "Search by name or email\u2026", "aria-label": "Search students", className: cn('w-full pl-9 pr-4 py-2.5 rounded-full text-[14px] text-[#1a2744] font-[inherit]', 'border-[1.5px] border-[rgba(26,39,68,0.12)] bg-[#f8f9fb] outline-none transition-colors', 'focus:border-[#4a9ad4] focus:bg-white') })] }), _jsx("select", { value: statusFilter, onChange: (e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }, "aria-label": "Filter by status", className: cn('px-4 py-2.5 rounded-full border-[1.5px] border-[rgba(26,39,68,0.12)]', 'text-[14px] text-[#717182] bg-white outline-none cursor-pointer font-[inherit]', 'focus:border-[#4a9ad4]'), children: STATUS_FILTERS.map((f) => (_jsx("option", { value: f.value, children: f.label }, f.value))) }), _jsx("select", { value: paymentFilter, onChange: (e) => {
                            setPaymentFilter(e.target.value);
                            setPage(1);
                        }, "aria-label": "Filter by payment", className: cn('px-4 py-2.5 rounded-full border-[1.5px] border-[rgba(26,39,68,0.12)]', 'text-[14px] text-[#717182] bg-white outline-none cursor-pointer font-[inherit]', 'focus:border-[#4a9ad4]'), children: PAYMENT_STATUS_FILTERS.map((f) => (_jsx("option", { value: f.value, children: f.label }, f.value))) })] }), _jsxs("div", { className: "px-8 py-6", children: [isLoading && (_jsx("div", { "aria-busy": "true", "aria-label": "Loading students", className: "bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden", children: [1, 2, 3, 4, 5].map((n) => (_jsxs("div", { className: "flex items-center gap-4 px-5 py-4 border-b border-[rgba(26,39,68,0.04)] last:border-b-0", "aria-hidden": "true", children: [_jsx("div", { className: "w-9 h-9 rounded-full bg-[#e8ecf4] animate-pulse flex-shrink-0" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx("div", { className: "h-3.5 bg-[#e8ecf4] rounded animate-pulse w-1/4" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-1/5" })] }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-24" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-16" }), _jsx("div", { className: "h-3 bg-[#e8ecf4] rounded animate-pulse w-16" })] }, n))) })), isError && !isLoading && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx("div", { className: "text-[40px] mb-4", "aria-hidden": "true", children: "\u26A0\uFE0F" }), _jsx("p", { className: "text-[16px] font-[600] text-[#1a2744]", children: "Failed to load students" })] })), !isLoading && !isError && enrollments.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx("div", { className: "text-[48px] mb-4", "aria-hidden": "true", children: "\uD83D\uDC65" }), _jsx("p", { className: "text-[16px] font-[600] text-[#1a2744]", children: "No students found" }), _jsx("p", { className: "text-[14px] text-[#717182] mt-1", children: debouncedQuery || statusFilter ? 'Try adjusting your filters.' : 'No enrollments yet.' })] })), !isLoading && !isError && enrollments.length > 0 && (_jsx("div", { className: "bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden", children: _jsxs("table", { className: "w-full border-collapse", "aria-label": "Student enrollments", children: [_jsx("thead", { children: _jsx("tr", { children: ['Student', 'Course', 'Progress', 'Status', 'Payment', 'Enrolled', 'Actions'].map((col) => (_jsx("th", { scope: "col", className: "text-left text-[12px] font-[600] text-[#717182] px-5 py-3 border-b border-[rgba(26,39,68,0.08)] uppercase tracking-[0.5px] bg-[#f8f9fb]", children: col }, col))) }) }), _jsx("tbody", { children: enrollments.map((enrollment) => (_jsxs("tr", { className: "cursor-pointer hover:[&>td]:bg-[#f8f9fb] transition-colors", onClick: () => navigate(`/admin/students/${enrollment.student.id}`), tabIndex: 0, onKeyDown: (e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                navigate(`/admin/students/${enrollment.student.id}`);
                                            }
                                        }, "aria-label": `View profile for ${enrollment.student.name}`, children: [_jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: _jsxs("div", { className: "flex items-center gap-3", children: [enrollment.student.avatarUrl ? (_jsx("img", { src: enrollment.student.avatarUrl, alt: "", className: "w-9 h-9 rounded-full flex-shrink-0" })) : (_jsx("div", { className: "w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[14px] font-[700]", style: { background: getAvatarGradient(enrollment.student.name) }, "aria-hidden": "true", children: enrollment.student.name.charAt(0).toUpperCase() })), _jsxs("div", { children: [_jsx("div", { className: "text-[14px] font-[600] text-[#1a2744]", children: enrollment.student.name }), _jsx("div", { className: "text-[12px] text-[#717182]", children: enrollment.student.email })] })] }) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[14px] text-[#1a2744]", children: enrollment.cohort.title }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-20 h-1 bg-[#e8ecf4] rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-[#4a9ad4] rounded-full", style: { width: `${enrollment.progress}%` }, role: "progressbar", "aria-valuenow": enrollment.progress, "aria-valuemin": 0, "aria-valuemax": 100 }) }), _jsxs("span", { className: "text-[12px] font-[600] text-[#717182]", children: [enrollment.progress, "%"] })] }) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: _jsx(EnrollmentStatusBadge, { status: enrollment.status }) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: _jsx(PaymentStatusBadge, { status: enrollment.paymentStatus }) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]", children: formatDate(enrollment.enrolledAt) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]", children: _jsxs("div", { className: "flex items-center gap-3", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { type: "button", onClick: (e) => {
                                                                e.stopPropagation();
                                                                navigate(`/admin/students/${enrollment.student.id}`);
                                                            }, className: "text-[13px] font-[600] text-[#4a9ad4] hover:underline", children: "View Profile" }), _jsx("button", { type: "button", onClick: (e) => {
                                                                e.stopPropagation();
                                                                window.open(`mailto:${enrollment.student.email}`);
                                                            }, className: "text-[13px] font-[600] text-[#717182] hover:underline", children: "Email" })] }) })] }, enrollment.id))) })] }) }))] }), !isLoading && totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-between px-8 py-4 border-t border-[rgba(26,39,68,0.06)] bg-white", children: [_jsxs("p", { className: "text-[13px] text-[#717182]", children: ["Showing ", (page - 1) * ITEMS_PER_PAGE + 1, "\u2013", Math.min(page * ITEMS_PER_PAGE, total), " of", ' ', total] }), _jsxs("div", { className: "flex gap-1", role: "navigation", "aria-label": "Pagination", children: [_jsx("button", { type: "button", onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, "aria-label": "Previous page", className: "w-[34px] h-[34px] rounded-full border-[1.5px] border-[rgba(26,39,68,0.12)] bg-white text-[#717182] flex items-center justify-center hover:bg-[#f0f0f0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { size: 14 }) }), Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                const pageNum = i + 1;
                                return (_jsx("button", { type: "button", onClick: () => setPage(pageNum), "aria-label": `Page ${pageNum}`, "aria-current": page === pageNum ? 'page' : undefined, className: cn('w-[34px] h-[34px] rounded-full border-[1.5px] text-[13px] font-[600] flex items-center justify-center transition-colors', page === pageNum
                                        ? 'bg-[#4a9ad4] text-white border-[#4a9ad4]'
                                        : 'border-[rgba(26,39,68,0.12)] bg-white text-[#717182] hover:bg-[#f0f0f0]'), children: pageNum }, pageNum));
                            }), _jsx("button", { type: "button", onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, "aria-label": "Next page", className: "w-[34px] h-[34px] rounded-full border-[1.5px] border-[rgba(26,39,68,0.12)] bg-white text-[#717182] flex items-center justify-center hover:bg-[#f0f0f0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { size: 14 }) })] })] }))] }));
}
