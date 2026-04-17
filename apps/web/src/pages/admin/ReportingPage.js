import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-76/77/78/79/174 — Admin reporting: Revenue, Enrollments, Payments, Cohort Performance
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, BarChart2 } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { fetchRevenueAnalytics, fetchEnrollmentAnalytics, fetchPaymentsAnalytics, fetchCohortPerformance, fetchAdminCohortsList, } from '../../lib/api';
import { cn } from '../../lib/utils';
const TABS = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'enrollments', label: 'Enrollments' },
    { key: 'payments', label: 'Payments' },
    { key: 'cohort-performance', label: 'Cohort Performance' },
];
function fmt(n) {
    if (n >= 1_000_000)
        return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `$${(n / 1_000).toFixed(1)}k`;
    return `$${n.toFixed(2)}`;
}
function fmtNum(n) {
    return n.toLocaleString();
}
function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}
function downloadCsv(endpoint) {
    const url = `/api/v1/admin/analytics/${endpoint}/csv`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${endpoint}-export.csv`;
    a.click();
}
function StatCard({ label, value, highlight }) {
    return (_jsxs("div", { className: cn('bg-white rounded-[16px] p-5 shadow-[rgba(26,39,68,0.12)_0_0_0_1px]', highlight && 'ring-2 ring-[#4a9ad4]/30'), children: [_jsx("div", { className: "text-[32px] font-[800] text-[#1a2744] tracking-[-0.5px] leading-none mb-1", children: value }), _jsx("div", { className: "text-[13px] text-[#717182]", children: label })] }));
}
function DateRangeFilter({ value, onChange }) {
    return (_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("label", { className: "flex items-center gap-2 text-[13px] font-[600] text-[#717182]", children: ["From", _jsx("input", { type: "date", value: value.from, onChange: (e) => onChange({ ...value, from: e.target.value }), className: "px-3 py-1.5 rounded-[8px] border border-[rgba(26,39,68,0.15)] bg-[#f8f9fb] text-[#1a2744] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#4a9ad4]" })] }), _jsxs("label", { className: "flex items-center gap-2 text-[13px] font-[600] text-[#717182]", children: ["To", _jsx("input", { type: "date", value: value.to, onChange: (e) => onChange({ ...value, to: e.target.value }), className: "px-3 py-1.5 rounded-[8px] border border-[rgba(26,39,68,0.15)] bg-[#f8f9fb] text-[#1a2744] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#4a9ad4]" })] })] }));
}
function SimpleBarChart({ data, valueFormatter = (v) => String(v) }) {
    const max = Math.max(...data.map((d) => d.value), 1);
    return (_jsx("div", { className: "space-y-2 mt-4", role: "img", "aria-label": "Revenue by cohort", children: data.map((item) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-32 sm:w-40 flex-shrink-0 text-[13px] text-[#717182] truncate text-right", children: item.label }), _jsxs("div", { className: "flex-1 flex items-center gap-2", children: [_jsx("div", { className: "flex-1 h-7 bg-[#e8ecf4] rounded-[6px] overflow-hidden", children: _jsx("div", { className: "h-full bg-[#4a9ad4] rounded-[6px] transition-all", style: { width: `${Math.max((item.value / max) * 100, 2)}%` } }) }), _jsx("span", { className: "text-[13px] font-[700] text-[#1a2744] w-16 text-right flex-shrink-0", children: valueFormatter(item.value) })] })] }, item.label))) }));
}
// ---------------------------------------------------------------------------
// Revenue Tab
// ---------------------------------------------------------------------------
function RevenueTab() {
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const { data, isLoading, error } = useQuery({
        queryKey: ['admin', 'analytics', 'revenue', dateRange],
        queryFn: () => fetchRevenueAnalytics({
            from: dateRange.from || undefined,
            to: dateRange.to || undefined,
        }),
    });
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6", children: [_jsx(DateRangeFilter, { value: dateRange, onChange: setDateRange }), _jsxs("button", { type: "button", onClick: () => downloadCsv('revenue'), className: cn('flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-[700]', 'border border-[rgba(26,39,68,0.15)] text-[#1a2744] hover:bg-[#f0f0f0]', 'bg-transparent cursor-pointer transition-colors'), children: [_jsx(Download, { size: 14, "aria-hidden": "true" }), "Export CSV"] })] }), isLoading ? (_jsx("div", { className: "animate-pulse grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6", children: [1, 2, 3].map(i => _jsx("div", { className: "h-24 bg-[#e8ecf4] rounded-[16px]" }, i)) })) : error ? (_jsx("div", { className: "bg-[#fdeaeb] text-[#d03238] rounded-[12px] p-4 text-[14px] font-[600]", children: "Failed to load revenue data." })) : data ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6", children: [_jsx(StatCard, { label: "Total Revenue", value: fmt(data.totalRevenue), highlight: true }), _jsx(StatCard, { label: "MRR", value: fmt(data.mrr) }), _jsx(StatCard, { label: "Active Cohorts", value: fmtNum(data.cohortCount) })] }), data.byCohort && data.byCohort.length > 0 && (_jsxs("div", { className: "bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] p-6", children: [_jsx("h3", { className: "text-[15px] font-[700] text-[#1a2744] mb-2", children: "Revenue by Cohort" }), _jsx(SimpleBarChart, { data: data.byCohort.map((c) => ({ label: c.cohortTitle, value: c.revenue })), valueFormatter: fmt })] }))] })) : null] }));
}
// ---------------------------------------------------------------------------
// Enrollments Tab
// ---------------------------------------------------------------------------
function EnrollmentsTab() {
    const [selectedCohort, setSelectedCohort] = useState('');
    const { data: cohortsData } = useQuery({
        queryKey: ['admin', 'cohorts-list'],
        queryFn: fetchAdminCohortsList,
    });
    const { data, isLoading, error } = useQuery({
        queryKey: ['admin', 'analytics', 'enrollments', selectedCohort],
        queryFn: () => fetchEnrollmentAnalytics(selectedCohort || undefined),
    });
    const cohorts = cohortsData?.cohorts ?? [];
    return (_jsxs("div", { children: [_jsx("div", { className: "mb-6", children: _jsxs("label", { className: "flex items-center gap-2 text-[13px] font-[600] text-[#717182]", children: ["Filter by cohort", _jsxs("select", { value: selectedCohort, onChange: (e) => setSelectedCohort(e.target.value), className: "px-3 py-1.5 rounded-[8px] border border-[rgba(26,39,68,0.15)] bg-[#f8f9fb] text-[#1a2744] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#4a9ad4]", children: [_jsx("option", { value: "", children: "All cohorts" }), cohorts.map((c) => (_jsx("option", { value: c.id, children: c.title }, c.id)))] })] }) }), isLoading ? (_jsx("div", { className: "animate-pulse grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6", children: [1, 2, 3, 4].map(i => _jsx("div", { className: "h-24 bg-[#e8ecf4] rounded-[16px]" }, i)) })) : error ? (_jsx("div", { className: "bg-[#fdeaeb] text-[#d03238] rounded-[12px] p-4 text-[14px] font-[600]", children: "Failed to load enrollment data." })) : data ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6", children: [_jsx(StatCard, { label: "Total", value: fmtNum(data.total) }), _jsx(StatCard, { label: "Active", value: fmtNum(data.active), highlight: true }), _jsx(StatCard, { label: "Pending", value: fmtNum(data.pending) }), _jsx(StatCard, { label: "Cancelled", value: fmtNum(data.cancelled) })] }), data.byCohort && data.byCohort.length > 0 && (_jsxs("div", { className: "bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden", children: [_jsx("div", { className: "px-6 py-4 border-b border-[rgba(26,39,68,0.08)]", children: _jsx("h3", { className: "text-[15px] font-[700] text-[#1a2744]", children: "By Cohort" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full border-collapse", "aria-label": "Enrollments by cohort", children: [_jsx("thead", { children: _jsx("tr", { children: ['Cohort', 'Active', 'Pending'].map((col) => (_jsx("th", { scope: "col", className: "text-left text-[12px] font-[700] text-[#717182] uppercase tracking-[0.5px] px-5 py-2.5 border-b border-[rgba(26,39,68,0.08)]", children: col }, col))) }) }), _jsx("tbody", { children: data.byCohort.map((row) => (_jsxs("tr", { className: "hover:[&>td]:bg-[#f8f9fb]", children: [_jsx("td", { className: "px-5 py-3 border-b border-[rgba(26,39,68,0.04)] text-[14px] font-[600] text-[#1a2744]", children: row.cohortTitle }), _jsx("td", { className: "px-5 py-3 border-b border-[rgba(26,39,68,0.04)] text-[14px] text-[#1a2744]", children: fmtNum(row.active) }), _jsx("td", { className: "px-5 py-3 border-b border-[rgba(26,39,68,0.04)] text-[14px] text-[#1a2744]", children: fmtNum(row.pending) })] }, row.cohortTitle))) })] }) })] }))] })) : null] }));
}
const EMPTY_FILTERS = { from: '', to: '', cohortId: '', method: 'all', page: 1 };
function PaymentMethodBadge({ method }) {
    return (_jsx("span", { className: cn('text-[11px] font-[700] px-[9px] py-[3px] rounded-full', method === 'stripe' ? 'bg-[#eef6fd] text-[#4a9ad4]' : 'bg-[#fff8e6] text-[#8a5a00]'), children: method === 'stripe' ? 'Stripe' : 'Manual' }));
}
function PaymentStatusBadge({ status }) {
    const styles = {
        PAID: 'bg-[#e6f4ec] text-[#054d28]',
        PENDING: 'bg-[#fff8e6] text-[#8a5a00]',
        FAILED: 'bg-[#fdeaeb] text-[#d03238]',
        REJECTED: 'bg-[#fdeaeb] text-[#d03238]',
    };
    return (_jsx("span", { className: cn('text-[11px] font-[700] px-[9px] py-[3px] rounded-full', styles[status]), children: status }));
}
function PaymentsTab() {
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const { data: cohortsData } = useQuery({
        queryKey: ['admin', 'cohorts-list'],
        queryFn: fetchAdminCohortsList,
    });
    const { data, isLoading, error } = useQuery({
        queryKey: ['admin', 'analytics', 'payments', filters],
        queryFn: () => fetchPaymentsAnalytics({
            from: filters.from || undefined,
            to: filters.to || undefined,
            cohortId: filters.cohortId || undefined,
            method: filters.method !== 'all' ? filters.method : undefined,
            page: filters.page,
        }),
    });
    const cohorts = cohortsData?.cohorts ?? [];
    const payments = data?.payments ?? [];
    const total = data?.total ?? 0;
    const PAGE_SIZE = 20;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    function setPage(p) {
        setFilters((prev) => ({ ...prev, page: p }));
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex flex-wrap gap-3 mb-6", children: [_jsx(DateRangeFilter, { value: { from: filters.from, to: filters.to }, onChange: ({ from, to }) => setFilters((p) => ({ ...p, from, to, page: 1 })) }), _jsxs("select", { value: filters.cohortId, onChange: (e) => setFilters((p) => ({ ...p, cohortId: e.target.value, page: 1 })), className: "px-3 py-1.5 rounded-[8px] border border-[rgba(26,39,68,0.15)] bg-[#f8f9fb] text-[#1a2744] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#4a9ad4]", "aria-label": "Filter by cohort", children: [_jsx("option", { value: "", children: "All cohorts" }), cohorts.map((c) => (_jsx("option", { value: c.id, children: c.title }, c.id)))] }), _jsxs("select", { value: filters.method, onChange: (e) => setFilters((p) => ({ ...p, method: e.target.value, page: 1 })), className: "px-3 py-1.5 rounded-[8px] border border-[rgba(26,39,68,0.15)] bg-[#f8f9fb] text-[#1a2744] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#4a9ad4]", "aria-label": "Filter by method", children: [_jsx("option", { value: "all", children: "All methods" }), _jsx("option", { value: "stripe", children: "Stripe" }), _jsx("option", { value: "manual", children: "Manual" })] }), _jsxs("button", { type: "button", onClick: () => downloadCsv('payments'), className: cn('flex items-center gap-2 px-4 py-1.5 rounded-[8px] text-[13px] font-[700]', 'border border-[rgba(26,39,68,0.15)] text-[#1a2744] hover:bg-[#f0f0f0]', 'bg-transparent cursor-pointer transition-colors'), children: [_jsx(Download, { size: 13, "aria-hidden": "true" }), "Export CSV"] })] }), isLoading ? (_jsx("div", { className: "animate-pulse bg-[#e8ecf4] rounded-[16px] h-64" })) : error ? (_jsx("div", { className: "bg-[#fdeaeb] text-[#d03238] rounded-[12px] p-4 text-[14px] font-[600]", children: "Failed to load payments data." })) : (_jsxs("div", { className: "bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full border-collapse", "aria-label": "Payments", children: [_jsx("thead", { children: _jsx("tr", { children: ['Student', 'Cohort', 'Amount', 'Method', 'Status', 'Date'].map((col) => (_jsx("th", { scope: "col", className: "text-left text-[12px] font-[700] text-[#717182] uppercase tracking-[0.5px] px-5 py-2.5 border-b border-[rgba(26,39,68,0.08)]", children: col }, col))) }) }), _jsx("tbody", { children: payments.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "py-10 text-center text-[14px] text-[#717182]", children: "No payments found." }) })) : (payments.map((p) => (_jsxs("tr", { className: "hover:[&>td]:bg-[#f8f9fb]", children: [_jsxs("td", { className: "px-5 py-3 border-b border-[rgba(26,39,68,0.04)]", children: [_jsx("div", { className: "text-[14px] font-[600] text-[#1a2744]", children: p.studentName }), _jsx("div", { className: "text-[12px] text-[#a3a3a3]", children: p.studentEmail })] }), _jsx("td", { className: "px-5 py-3 border-b border-[rgba(26,39,68,0.04)] text-[14px] text-[#1a2744]", children: p.cohortTitle }), _jsx("td", { className: "px-5 py-3 border-b border-[rgba(26,39,68,0.04)] text-[14px] font-[700] text-[#1a2744]", children: fmt(p.amount) }), _jsx("td", { className: "px-5 py-3 border-b border-[rgba(26,39,68,0.04)]", children: _jsx(PaymentMethodBadge, { method: p.method }) }), _jsx("td", { className: "px-5 py-3 border-b border-[rgba(26,39,68,0.04)]", children: _jsx(PaymentStatusBadge, { status: p.status }) }), _jsx("td", { className: "px-5 py-3 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]", children: fmtDate(p.date) })] }, p.id)))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-t border-[rgba(26,39,68,0.08)]", children: [_jsxs("p", { className: "text-[13px] text-[#717182]", children: ["Page ", filters.page, " of ", totalPages, " \u00B7 ", fmtNum(total), " total"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: () => setPage(filters.page - 1), disabled: filters.page <= 1, className: "px-3 py-1.5 rounded-[8px] text-[13px] font-[600] border border-[rgba(26,39,68,0.15)] disabled:opacity-40 hover:bg-[#f0f0f0] bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors", children: "\u2190 Prev" }), _jsx("button", { type: "button", onClick: () => setPage(filters.page + 1), disabled: filters.page >= totalPages, className: "px-3 py-1.5 rounded-[8px] text-[13px] font-[600] border border-[rgba(26,39,68,0.15)] disabled:opacity-40 hover:bg-[#f0f0f0] bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors", children: "Next \u2192" })] })] }))] }))] }));
}
// ---------------------------------------------------------------------------
// Cohort Performance Tab
// ---------------------------------------------------------------------------
function ProgressBar({ value }) {
    const pct = Math.min(100, Math.max(0, value));
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 h-2 bg-[#e8ecf4] rounded-full overflow-hidden min-w-[80px]", children: _jsx("div", { className: "h-full rounded-full transition-all", style: {
                        width: `${pct}%`,
                        background: pct >= 80 ? '#054d28' : pct >= 40 ? '#4a9ad4' : '#ff8c5a',
                    }, role: "progressbar", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100 }) }), _jsxs("span", { className: "text-[13px] font-[700] text-[#1a2744] w-10 text-right flex-shrink-0", children: [pct.toFixed(0), "%"] })] }));
}
function CohortPerformanceTab() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['admin', 'analytics', 'cohort-performance'],
        queryFn: fetchCohortPerformance,
    });
    const rows = data?.cohorts ?? [];
    return (_jsx("div", { children: isLoading ? (_jsx("div", { className: "animate-pulse bg-[#e8ecf4] rounded-[16px] h-64" })) : error ? (_jsx("div", { className: "bg-[#fdeaeb] text-[#d03238] rounded-[12px] p-4 text-[14px] font-[600]", children: "Failed to load cohort performance." })) : (_jsx("div", { className: "bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full border-collapse", "aria-label": "Cohort performance", children: [_jsx("thead", { children: _jsx("tr", { children: ['Cohort', 'Total Enrolled', 'Avg Completion', 'Completed'].map((col) => (_jsx("th", { scope: "col", className: "text-left text-[12px] font-[700] text-[#717182] uppercase tracking-[0.5px] px-5 py-2.5 border-b border-[rgba(26,39,68,0.08)]", children: col }, col))) }) }), _jsx("tbody", { children: rows.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "py-10 text-center text-[14px] text-[#717182]", children: "No cohort data yet." }) })) : (rows.map((row) => (_jsxs("tr", { className: "hover:[&>td]:bg-[#f8f9fb]", children: [_jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[14px] font-[700] text-[#1a2744]", children: row.cohortTitle }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[14px] text-[#1a2744]", children: fmtNum(row.totalEnrolled) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] min-w-[200px]", children: _jsx(ProgressBar, { value: row.avgCompletionPct }) }), _jsx("td", { className: "px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[14px] font-[600] text-[#054d28]", children: fmtNum(row.completedCount) })] }, row.cohortTitle)))) })] }) }) })) }));
}
// ---------------------------------------------------------------------------
// ReportingPage
// ---------------------------------------------------------------------------
export default function ReportingPage() {
    const [activeTab, setActiveTab] = useState('revenue');
    return (_jsx(AdminShell, { title: "Reporting", actions: _jsxs("div", { className: "flex items-center gap-1.5 text-[#717182]", children: [_jsx(BarChart2, { size: 16, "aria-hidden": "true" }), _jsx("span", { className: "text-[13px] font-[500]", children: "Analytics" })] }), children: _jsxs("div", { className: "p-6 lg:p-8", children: [_jsx("div", { className: "flex gap-1 bg-[#e8ecf4] rounded-[12px] p-1 mb-7 w-fit overflow-x-auto", role: "tablist", "aria-label": "Reporting sections", children: TABS.map(({ key, label }) => (_jsx("button", { type: "button", role: "tab", "aria-selected": activeTab === key, onClick: () => setActiveTab(key), className: cn('px-4 py-2 rounded-[9px] text-[13px] font-[600] transition-all border-none cursor-pointer whitespace-nowrap', activeTab === key
                            ? 'bg-white text-[#1a2744] shadow-[0_1px_4px_rgba(26,39,68,0.12)]'
                            : 'bg-transparent text-[#717182] hover:text-[#1a2744]'), children: label }, key))) }), activeTab === 'revenue' && _jsx(RevenueTab, {}), activeTab === 'enrollments' && _jsx(EnrollmentsTab, {}), activeTab === 'payments' && _jsx(PaymentsTab, {}), activeTab === 'cohort-performance' && _jsx(CohortPerformanceTab, {})] }) }));
}
