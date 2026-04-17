import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-216/217/218 — Unified payment ledger with refund and CSV export
import { useState, useEffect, useRef } from 'react';
import { Download, Search, X } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { authFetch } from '../../lib/api';
// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const MOCK_PAYMENTS = [
    { id: '1', type: 'stripe', studentName: 'Sara Ahmed', studentEmail: 'sara@example.com', course: 'AI Product Bootcamp', amount: 999, currency: 'usd', status: 'SUCCEEDED', date: '2025-01-08' },
    { id: '2', type: 'manual', studentName: 'Jordan Lee', studentEmail: 'jordan@gmail.com', course: 'Claude API Mastery', amount: 499, currency: 'usd', status: 'PENDING', date: '2025-01-05' },
    { id: '3', type: 'stripe', studentName: 'Priya Sharma', studentEmail: 'priya@outlook.com', course: 'Prompt Engineering Pro', amount: 299, currency: 'usd', status: 'REFUNDED', date: '2024-10-03' },
    { id: '4', type: 'manual', studentName: 'Marcus Webb', studentEmail: 'marcus@dev.io', course: 'Full-Stack AI Dev', amount: 799, currency: 'usd', status: 'SUCCEEDED', date: '2025-01-12' },
    { id: '5', type: 'stripe', studentName: 'Aleem Haider', studentEmail: 'aleem@nextai.com', course: 'AI Product Bootcamp', amount: 999, currency: 'usd', status: 'SUCCEEDED', date: '2024-12-10' },
];
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------
const CARD_CONFIGS = [
    { key: 'totalRevenue', label: 'Total Revenue', accent: '#4a9ad4', softBg: 'rgba(74,154,212,0.09)' },
    { key: 'stripeRevenue', label: 'Stripe Revenue', accent: '#7c3aed', softBg: 'rgba(124,58,237,0.09)' },
    { key: 'manualRevenue', label: 'Manual Revenue', accent: '#059669', softBg: 'rgba(5,150,105,0.09)' },
    { key: 'pendingAmount', label: 'Pending Amount', accent: '#f59e0b', softBg: 'rgba(245,158,11,0.09)' },
];
function SummaryCard({ label, value, accent, softBg, }) {
    return (_jsxs("div", { style: {
            background: '#ffffff',
            borderRadius: 18,
            padding: '22px 22px 18px',
            border: '1px solid rgba(26,39,68,0.07)',
            boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.03)',
            position: 'relative',
            overflow: 'hidden',
            flex: 1,
        }, children: [_jsx("div", { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '18px 18px 0 0' } }), _jsx("div", { style: { position: 'absolute', bottom: -20, right: -20, width: 100, height: 100, background: softBg, borderRadius: '50%', pointerEvents: 'none' } }), _jsx("div", { style: { width: 40, height: 40, borderRadius: 12, background: softBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, children: _jsx("div", { style: { width: 16, height: 16, borderRadius: 4, background: accent, opacity: 0.85 } }) }), _jsx("div", { style: { fontSize: 28, fontWeight: 900, color: '#1a2744', letterSpacing: '-1px', lineHeight: 1, marginBottom: 4 }, children: value }), _jsx("div", { style: { fontSize: 12, color: '#717182', fontWeight: 500 }, children: label })] }));
}
// ---------------------------------------------------------------------------
// Type badge
// ---------------------------------------------------------------------------
function TypeBadge({ type }) {
    const isStripe = type === 'stripe';
    return (_jsx("span", { style: {
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 20,
            background: isStripe ? 'rgba(74,154,212,0.12)' : 'rgba(245,158,11,0.12)',
            color: isStripe ? '#1e40af' : '#92400e',
        }, children: isStripe ? 'Stripe' : 'Manual' }));
}
// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------
function StatusPill({ status }) {
    const cfg = {
        SUCCEEDED: { bg: 'rgba(5,150,105,0.1)', color: '#065f46', label: 'Succeeded' },
        PAID: { bg: 'rgba(5,150,105,0.1)', color: '#065f46', label: 'Paid' },
        PENDING: { bg: 'rgba(245,158,11,0.1)', color: '#92400e', label: 'Pending' },
        REFUNDED: { bg: 'rgba(239,68,68,0.1)', color: '#991b1b', label: 'Refunded' },
        FAILED: { bg: 'rgba(239,68,68,0.1)', color: '#991b1b', label: 'Failed' },
    };
    const { bg, color, label } = cfg[status];
    return (_jsxs("span", { style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 20,
            background: bg,
            color,
        }, children: [_jsx("span", { style: { width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 } }), label] }));
}
function RefundModal({ payment, onClose, onConfirm }) {
    const [amount, setAmount] = useState(String(payment.amount));
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
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
    async function handleSubmit(e) {
        e.preventDefault();
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0 || parsed > payment.amount) {
            setError(`Amount must be between $1 and ${formatMoney(payment.amount)}`);
            return;
        }
        if (!reason.trim()) {
            setError('Reason is required');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await onConfirm(parsed, reason.trim());
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Refund failed');
            setLoading(false);
        }
    }
    return (_jsx("div", { style: { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,26,58,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }, role: "dialog", "aria-modal": "true", "aria-label": "Refund payment", children: _jsxs("div", { style: { background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(26,39,68,0.2)' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }, children: [_jsx("h2", { style: { fontSize: 20, fontWeight: 800, color: '#1a2744', margin: 0 }, children: "Issue Refund" }), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close", style: { width: 34, height: 34, borderRadius: '50%', background: '#f0f0f0', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#717182' }, children: _jsx(X, { size: 16 }) })] }), _jsxs("p", { style: { fontSize: 13, color: '#717182', marginBottom: 24 }, children: ["Refunding payment from ", _jsx("strong", { style: { color: '#1a2744' }, children: payment.studentName }), " for ", _jsx("strong", { style: { color: '#1a2744' }, children: payment.course }), "."] }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("label", { htmlFor: "refund-amount", style: { display: 'block', fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 6 }, children: ["Refund Amount (max ", formatMoney(payment.amount), ")"] }), _jsx("input", { id: "refund-amount", ref: inputRef, type: "number", value: amount, onChange: (e) => setAmount(e.target.value), min: 1, max: payment.amount, step: 0.01, style: {
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: 12,
                                border: '1.5px solid rgba(26,39,68,0.15)',
                                fontSize: 14,
                                background: '#f8f9fb',
                                color: '#1a2744',
                                outline: 'none',
                                marginBottom: 16,
                                boxSizing: 'border-box',
                                fontFamily: 'inherit',
                            } }), _jsx("label", { htmlFor: "refund-reason", style: { display: 'block', fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 6 }, children: "Reason" }), _jsx("textarea", { id: "refund-reason", value: reason, onChange: (e) => setReason(e.target.value), placeholder: "Provide a reason for this refund\u2026", rows: 3, style: {
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: 12,
                                border: '1.5px solid rgba(26,39,68,0.15)',
                                fontSize: 14,
                                background: '#f8f9fb',
                                color: '#1a2744',
                                outline: 'none',
                                resize: 'none',
                                marginBottom: error ? 8 : 24,
                                boxSizing: 'border-box',
                                fontFamily: 'inherit',
                            } }), error && (_jsx("p", { style: { fontSize: 12, color: '#ef4444', marginBottom: 16, fontWeight: 600 }, children: error })), _jsxs("div", { style: { display: 'flex', gap: 12, justifyContent: 'flex-end' }, children: [_jsx("button", { type: "button", onClick: onClose, disabled: loading, style: {
                                        padding: '10px 20px',
                                        borderRadius: 30,
                                        background: '#f0f0f0',
                                        color: '#717182',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        border: 'none',
                                        cursor: 'pointer',
                                        opacity: loading ? 0.5 : 1,
                                    }, children: "Cancel" }), _jsx("button", { type: "submit", disabled: loading, style: {
                                        padding: '10px 20px',
                                        borderRadius: 30,
                                        background: loading ? '#e8ecf4' : '#ef4444',
                                        color: loading ? '#a3a3b8' : '#fff',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        border: 'none',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        transition: 'background 0.15s',
                                    }, children: loading ? 'Processing…' : 'Confirm Refund' })] })] })] }) }));
}
// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------
function SkeletonRows() {
    return (_jsx(_Fragment, { children: [1, 2, 3, 4, 5].map((n) => (_jsx("tr", { "aria-hidden": "true", children: [140, 90, 160, 140, 80, 90, 80].map((w, i) => (_jsx("td", { style: { padding: '14px 20px', borderBottom: '1px solid rgba(26,39,68,0.04)' }, children: _jsx("div", { style: { height: 13, borderRadius: 6, background: '#e8ecf4', width: w, animation: 'pulse 1.5s ease-in-out infinite' } }) }, i))) }, n))) }));
}
// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const ITEMS_PER_PAGE = 20;
const METHOD_OPTIONS = [
    { label: 'All Methods', value: '' },
    { label: 'Stripe', value: 'stripe' },
    { label: 'Manual', value: 'manual' },
];
const STATUS_OPTIONS = [
    { label: 'All Statuses', value: '' },
    { label: 'Succeeded', value: 'SUCCEEDED' },
    { label: 'Paid', value: 'PAID' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Refunded', value: 'REFUNDED' },
    { label: 'Failed', value: 'FAILED' },
];
const inputStyle = {
    padding: '9px 14px',
    borderRadius: 30,
    border: '1.5px solid rgba(26,39,68,0.12)',
    fontSize: 13,
    color: '#1a2744',
    background: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
};
export default function TransactionLedgerPage() {
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState({ totalRevenue: 0, stripeRevenue: 0, manualRevenue: 0, pendingAmount: 0 });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [refundTarget, setRefundTarget] = useState(null);
    const [toast, setToast] = useState(null);
    const [filters, setFilters] = useState({ method: '', status: '', search: '', dateFrom: '', dateTo: '' });
    const [appliedFilters, setAppliedFilters] = useState({ method: '', status: '', search: '', dateFrom: '', dateTo: '' });
    // Toast auto-dismiss
    useEffect(() => {
        if (!toast)
            return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);
    // Fetch payments
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        async function load() {
            try {
                const params = new URLSearchParams();
                params.set('page', String(page));
                params.set('limit', String(ITEMS_PER_PAGE));
                if (appliedFilters.method)
                    params.set('method', appliedFilters.method);
                if (appliedFilters.status)
                    params.set('status', appliedFilters.status);
                if (appliedFilters.search)
                    params.set('q', appliedFilters.search);
                if (appliedFilters.dateFrom)
                    params.set('dateFrom', appliedFilters.dateFrom);
                if (appliedFilters.dateTo)
                    params.set('dateTo', appliedFilters.dateTo);
                const res = await authFetch(`/api/v1/admin/payments?${params}`);
                if (!res.ok)
                    throw new Error('API error');
                const json = await res.json();
                if (cancelled)
                    return;
                setPayments(json.payments ?? []);
                setTotal(json.total ?? 0);
                setSummary(json.summary ?? { totalRevenue: 0, stripeRevenue: 0, manualRevenue: 0, pendingAmount: 0 });
            }
            catch {
                if (cancelled)
                    return;
                // Fall back to mock data
                let filtered = MOCK_PAYMENTS;
                if (appliedFilters.method)
                    filtered = filtered.filter((p) => p.type === appliedFilters.method);
                if (appliedFilters.status)
                    filtered = filtered.filter((p) => p.status === appliedFilters.status);
                if (appliedFilters.search) {
                    const q = appliedFilters.search.toLowerCase();
                    filtered = filtered.filter((p) => p.studentName.toLowerCase().includes(q) ||
                        p.studentEmail.toLowerCase().includes(q) ||
                        p.course.toLowerCase().includes(q));
                }
                const start = (page - 1) * ITEMS_PER_PAGE;
                setPayments(filtered.slice(start, start + ITEMS_PER_PAGE));
                setTotal(filtered.length);
                const succeeded = filtered.filter((p) => p.status === 'SUCCEEDED' || p.status === 'PAID');
                setSummary({
                    totalRevenue: succeeded.reduce((s, p) => s + p.amount, 0),
                    stripeRevenue: succeeded.filter((p) => p.type === 'stripe').reduce((s, p) => s + p.amount, 0),
                    manualRevenue: succeeded.filter((p) => p.type === 'manual').reduce((s, p) => s + p.amount, 0),
                    pendingAmount: filtered.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0),
                });
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [page, appliedFilters]);
    function applyFilters() {
        setPage(1);
        setAppliedFilters({ ...filters });
    }
    function resetFilters() {
        const empty = { method: '', status: '', search: '', dateFrom: '', dateTo: '' };
        setFilters(empty);
        setAppliedFilters(empty);
        setPage(1);
    }
    async function handleExportCSV() {
        try {
            const params = new URLSearchParams();
            if (appliedFilters.method)
                params.set('method', appliedFilters.method);
            if (appliedFilters.status)
                params.set('status', appliedFilters.status);
            if (appliedFilters.search)
                params.set('q', appliedFilters.search);
            if (appliedFilters.dateFrom)
                params.set('dateFrom', appliedFilters.dateFrom);
            if (appliedFilters.dateTo)
                params.set('dateTo', appliedFilters.dateTo);
            const res = await authFetch(`/api/v1/admin/payments/export?${params}`);
            if (!res.ok)
                throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }
        catch {
            // Fallback: generate CSV from current mock data
            const headers = 'Date,Type,Student,Email,Course,Amount,Status';
            const rows = payments.map((p) => [p.date, p.type, p.studentName, p.studentEmail, `"${p.course}"`, p.amount, p.status].join(','));
            const csv = [headers, ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            setToast({ msg: 'CSV exported (demo data)', ok: true });
        }
    }
    async function handleRefund(payment, amount, reason) {
        const res = await authFetch(`/api/v1/admin/payments/${payment.id}/refund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, reason }),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.message || 'Refund failed');
        }
        setRefundTarget(null);
        setToast({ msg: `Refund of ${formatMoney(amount)} issued for ${payment.studentName}`, ok: true });
        // Re-apply filters to refresh the list
        setAppliedFilters((prev) => ({ ...prev }));
    }
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const hasActiveFilters = appliedFilters.method || appliedFilters.status || appliedFilters.search || appliedFilters.dateFrom || appliedFilters.dateTo;
    const summaryValues = {
        totalRevenue: formatMoney(summary.totalRevenue),
        stripeRevenue: formatMoney(summary.stripeRevenue),
        manualRevenue: formatMoney(summary.manualRevenue),
        pendingAmount: formatMoney(summary.pendingAmount),
    };
    return (_jsxs(AdminShell, { title: "Payments", actions: _jsxs("button", { type: "button", onClick: handleExportCSV, style: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 18px',
                borderRadius: 30,
                background: '#1a2744',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(26,39,68,0.28)',
            }, children: [_jsx(Download, { size: 14, strokeWidth: 2.5 }), "Export CSV"] }), children: [refundTarget && (_jsx(RefundModal, { payment: refundTarget, onClose: () => setRefundTarget(null), onConfirm: (amount, reason) => handleRefund(refundTarget, amount, reason) })), toast && (_jsxs("div", { role: "status", "aria-live": "polite", style: {
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    zIndex: 50,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 20px',
                    borderRadius: 14,
                    background: toast.ok ? '#e6f4ec' : '#fdeaeb',
                    color: toast.ok ? '#054d28' : '#d03238',
                    border: `1px solid ${toast.ok ? 'rgba(5,77,40,0.15)' : 'rgba(208,50,56,0.15)'}`,
                    fontSize: 14,
                    fontWeight: 600,
                    boxShadow: '0 4px 20px rgba(26,39,68,0.15)',
                }, children: [_jsx("span", { "aria-hidden": "true", children: toast.ok ? '✓' : '✗' }), toast.msg] })), _jsxs("div", { style: { padding: '28px 32px', background: '#f8f9fb', minHeight: '100%' }, children: [_jsx("div", { style: { display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }, children: CARD_CONFIGS.map((cfg) => (_jsx(SummaryCard, { label: cfg.label, value: summaryValues[cfg.key], accent: cfg.accent, softBg: cfg.softBg }, cfg.key))) }), _jsxs("div", { style: {
                            background: '#fff',
                            borderRadius: 16,
                            border: '1px solid rgba(26,39,68,0.07)',
                            boxShadow: '0 1px 3px rgba(26,39,68,0.06)',
                            padding: '16px 20px',
                            marginBottom: 20,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 10,
                            alignItems: 'center',
                        }, children: [_jsx("select", { value: filters.method, onChange: (e) => setFilters((f) => ({ ...f, method: e.target.value })), "aria-label": "Filter by method", style: inputStyle, children: METHOD_OPTIONS.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value)) }), _jsx("select", { value: filters.status, onChange: (e) => setFilters((f) => ({ ...f, status: e.target.value })), "aria-label": "Filter by status", style: inputStyle, children: STATUS_OPTIONS.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value)) }), _jsxs("div", { style: { position: 'relative', flex: '1 1 200px', minWidth: 180 }, children: [_jsx(Search, { size: 14, style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#a3a3a3', pointerEvents: 'none' }, "aria-hidden": "true" }), _jsx("input", { type: "search", value: filters.search, onChange: (e) => setFilters((f) => ({ ...f, search: e.target.value })), placeholder: "Student, email, or course\u2026", "aria-label": "Search", style: { ...inputStyle, paddingLeft: 34, width: '100%', boxSizing: 'border-box', borderRadius: 30 } })] }), _jsx("input", { type: "date", value: filters.dateFrom, onChange: (e) => setFilters((f) => ({ ...f, dateFrom: e.target.value })), "aria-label": "From date", style: inputStyle }), _jsx("input", { type: "date", value: filters.dateTo, onChange: (e) => setFilters((f) => ({ ...f, dateTo: e.target.value })), "aria-label": "To date", style: inputStyle }), _jsx("button", { type: "button", onClick: applyFilters, style: {
                                    padding: '9px 20px',
                                    borderRadius: 30,
                                    background: '#1a2744',
                                    color: '#fff',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    border: 'none',
                                    cursor: 'pointer',
                                }, children: "Apply" }), hasActiveFilters && (_jsx("button", { type: "button", onClick: resetFilters, style: {
                                    padding: '9px 16px',
                                    borderRadius: 30,
                                    background: 'transparent',
                                    color: '#717182',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    border: '1.5px solid rgba(26,39,68,0.12)',
                                    cursor: 'pointer',
                                }, children: "Reset" }))] }), _jsxs("div", { style: {
                            background: '#fff',
                            borderRadius: 18,
                            border: '1px solid rgba(26,39,68,0.07)',
                            boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.03)',
                            overflow: 'hidden',
                        }, children: [_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, "aria-label": "Payment transactions", children: [_jsx("thead", { children: _jsx("tr", { style: { background: '#f8f9fb' }, children: ['Date', 'Type', 'Student', 'Course', 'Amount', 'Status', 'Actions'].map((col) => (_jsx("th", { scope: "col", style: {
                                                        textAlign: 'left',
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: '#a3a3b8',
                                                        padding: '11px 20px',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.8px',
                                                        borderBottom: '1px solid rgba(26,39,68,0.06)',
                                                        whiteSpace: 'nowrap',
                                                    }, children: col }, col))) }) }), _jsxs("tbody", { children: [loading && _jsx(SkeletonRows, {}), !loading && payments.length === 0 && (_jsx("tr", { children: _jsxs("td", { colSpan: 7, style: { padding: '60px 24px', textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 40, marginBottom: 12 }, "aria-hidden": "true", children: "\uD83D\uDCB3" }), _jsx("p", { style: { fontSize: 15, fontWeight: 600, color: '#1a2744', margin: 0 }, children: "No transactions found" }), _jsx("p", { style: { fontSize: 13, color: '#a3a3b8', marginTop: 4 }, children: hasActiveFilters ? 'Try adjusting your filters.' : 'No payment records yet.' })] }) })), !loading && payments.map((payment, i) => {
                                                    const canRefund = payment.status === 'SUCCEEDED' || payment.status === 'PAID';
                                                    return (_jsxs("tr", { style: { borderBottom: i < payments.length - 1 ? '1px solid rgba(26,39,68,0.04)' : 'none' }, onMouseEnter: (e) => (e.currentTarget.style.background = '#f8f9fb'), onMouseLeave: (e) => (e.currentTarget.style.background = 'transparent'), children: [_jsx("td", { style: { padding: '14px 20px', fontSize: 12, color: '#717182', fontWeight: 500, whiteSpace: 'nowrap' }, children: formatDate(payment.date) }), _jsx("td", { style: { padding: '14px 20px' }, children: _jsx(TypeBadge, { type: payment.type }) }), _jsxs("td", { style: { padding: '14px 20px' }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#1a2744', whiteSpace: 'nowrap' }, children: payment.studentName }), _jsx("div", { style: { fontSize: 11, color: '#a3a3b8', marginTop: 1 }, children: payment.studentEmail })] }), _jsx("td", { style: { padding: '14px 20px', fontSize: 12, fontWeight: 600, color: '#1a2744', maxWidth: 200 }, children: payment.course }), _jsx("td", { style: { padding: '14px 20px', fontSize: 14, fontWeight: 800, color: '#1a2744', whiteSpace: 'nowrap' }, children: formatMoney(payment.amount) }), _jsx("td", { style: { padding: '14px 20px' }, children: _jsx(StatusPill, { status: payment.status }) }), _jsx("td", { style: { padding: '14px 20px' }, children: canRefund ? (_jsx("button", { type: "button", onClick: () => setRefundTarget(payment), style: {
                                                                        padding: '6px 14px',
                                                                        borderRadius: 20,
                                                                        background: 'rgba(239,68,68,0.08)',
                                                                        color: '#991b1b',
                                                                        fontSize: 12,
                                                                        fontWeight: 700,
                                                                        border: '1px solid rgba(239,68,68,0.2)',
                                                                        cursor: 'pointer',
                                                                        whiteSpace: 'nowrap',
                                                                        transition: 'background 0.15s',
                                                                    }, onMouseEnter: (e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)'), onMouseLeave: (e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)'), children: "Refund" })) : (_jsx("span", { style: { fontSize: 11, color: 'rgba(26,39,68,0.15)', fontWeight: 500 }, children: "\u2014" })) })] }, payment.id));
                                                })] })] }) }), !loading && total > 0 && (_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px 24px',
                                    borderTop: '1px solid rgba(26,39,68,0.05)',
                                    background: '#fafbfc',
                                }, children: [_jsxs("span", { style: { fontSize: 12, color: '#a3a3b8' }, children: ["Showing ", Math.min((page - 1) * ITEMS_PER_PAGE + 1, total), "\u2013", Math.min(page * ITEMS_PER_PAGE, total), " of ", total, " transactions"] }), totalPages > 1 && (_jsxs("div", { style: { display: 'flex', gap: 4 }, role: "navigation", "aria-label": "Pagination", children: [_jsx("button", { type: "button", onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, "aria-label": "Previous page", style: {
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    border: '1.5px solid rgba(26,39,68,0.12)',
                                                    background: '#fff', color: '#717182', cursor: page === 1 ? 'not-allowed' : 'pointer',
                                                    opacity: page === 1 ? 0.4 : 1,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 14,
                                                }, children: "\u2039" }), Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                                const p = i + 1;
                                                return (_jsx("button", { type: "button", onClick: () => setPage(p), "aria-label": `Page ${p}`, "aria-current": page === p ? 'page' : undefined, style: {
                                                        width: 32, height: 32, borderRadius: '50%',
                                                        border: page === p ? '1.5px solid #4a9ad4' : '1.5px solid rgba(26,39,68,0.12)',
                                                        background: page === p ? '#4a9ad4' : '#fff',
                                                        color: page === p ? '#fff' : '#717182',
                                                        cursor: 'pointer',
                                                        fontSize: 13, fontWeight: 600,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }, children: p }, p));
                                            }), _jsx("button", { type: "button", onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, "aria-label": "Next page", style: {
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    border: '1.5px solid rgba(26,39,68,0.12)',
                                                    background: '#fff', color: '#717182', cursor: page === totalPages ? 'not-allowed' : 'pointer',
                                                    opacity: page === totalPages ? 0.4 : 1,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 14,
                                                }, children: "\u203A" })] }))] }))] })] }), _jsx("style", { children: `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      ` })] }));
}
