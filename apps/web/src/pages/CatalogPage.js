import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FIR-29 — Course catalog page
import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { TopNav } from '../components/TopNav';
import { Footer } from '../components/Footer';
import { CohortCard } from '../components/CohortCard';
import { usePageMeta } from '../hooks/usePageMeta';
import { fetchCohorts } from '../lib/api';
const FILTERS = [
    { key: 'all', label: 'All Courses' },
    { key: 'recorded', label: 'Recorded' },
    { key: 'live', label: 'Live Cohort' },
    { key: 'combined', label: 'Combined' },
];
// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------
function SkeletonCard() {
    return (_jsxs("div", { style: {
            background: '#fff',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(26,39,68,0.08), 0 0 0 1px rgba(26,39,68,0.1)',
        }, children: [_jsx("div", { style: {
                    height: 192,
                    background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                } }), _jsxs("div", { style: { padding: '20px 22px 22px' }, children: [_jsx("div", { style: {
                            height: 18,
                            width: '65%',
                            borderRadius: 6,
                            marginBottom: 10,
                            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                        } }), _jsx("div", { style: {
                            height: 13,
                            width: '90%',
                            borderRadius: 4,
                            marginBottom: 6,
                            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                        } }), _jsx("div", { style: {
                            height: 13,
                            width: '70%',
                            borderRadius: 4,
                            marginBottom: 20,
                            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                        } }), _jsx("div", { style: {
                            height: 28,
                            width: '40%',
                            borderRadius: 6,
                            marginBottom: 16,
                            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                        } }), _jsx("div", { style: {
                            height: 44,
                            borderRadius: 12,
                            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                        } })] })] }));
}
// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onClear }) {
    return (_jsxs("div", { style: {
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '80px 40px',
            background: '#fff',
            borderRadius: 24,
            boxShadow: '0 1px 3px rgba(26,39,68,0.08), 0 0 0 1px rgba(26,39,68,0.1)',
        }, children: [_jsx("div", { style: { fontSize: 56, marginBottom: 16, lineHeight: 1 }, children: "\uD83D\uDD0D" }), _jsx("h3", { style: { fontSize: 22, fontWeight: 700, color: '#1a2744', marginBottom: 8 }, children: "No courses match your filters" }), _jsx("p", { style: { fontSize: 15, color: '#717182', marginBottom: 24 }, children: "Try adjusting your filters to find what you're looking for." }), _jsx("button", { onClick: onClear, style: {
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#4a9ad4',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    textDecoration: 'underline',
                }, children: "Clear filters" })] }));
}
// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CatalogPage() {
    usePageMeta({
        title: 'All Courses',
        description: 'Explore our full catalog of AI education cohorts and recorded courses.',
    });
    const [activeFilter, setActiveFilter] = useState('all');
    const [sort, setSort] = useState('featured');
    const [filterHovered, setFilterHovered] = useState(null);
    const { data: cohorts, isPending, isError } = useQuery({
        queryKey: ['cohorts'],
        queryFn: fetchCohorts,
    });
    let filtered = (cohorts ?? []).filter((c) => activeFilter === 'all' ? true : c.type === activeFilter);
    if (sort === 'price-asc') {
        filtered = [...filtered].sort((a, b) => a.price - b.price);
    }
    else if (sort === 'price-desc') {
        filtered = [...filtered].sort((a, b) => b.price - a.price);
    }
    const countFor = (key) => key === 'all'
        ? (cohorts ?? []).length
        : (cohorts ?? []).filter((c) => c.type === key).length;
    return (_jsxs("div", { style: { minHeight: '100vh', background: '#f6f7fb' }, children: [_jsx(TopNav, {}), _jsx("style", { children: `
        @media (max-width: 768px) {
          .catalog-header { padding: 28px 20px 20px !important; }
          .catalog-title-row { flex-direction: column !important; align-items: flex-start !important; }
          .catalog-h1 { font-size: clamp(28px, 7vw, 48px) !important; }
          .catalog-main { padding: 24px 16px 48px !important; }
          .catalog-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
        }
      ` }), _jsxs("header", { className: "catalog-header", style: {
                    background: '#fff',
                    borderBottom: '1px solid rgba(26,39,68,0.08)',
                    padding: '48px 80px 36px',
                }, children: [_jsxs("p", { style: { fontSize: 13, color: '#9499a8', marginBottom: 20 }, children: [_jsx(Link, { to: "/", style: { color: '#4a9ad4', textDecoration: 'none', fontWeight: 500 }, children: "Home" }), ' ', "\u203A", ' ', "All Courses"] }), _jsxs("div", { className: "catalog-title-row", style: {
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'space-between',
                            gap: 24,
                            marginBottom: 28,
                            flexWrap: 'wrap',
                        }, children: [_jsxs("div", { children: [_jsx("h1", { className: "catalog-h1", style: {
                                            fontSize: 48,
                                            fontWeight: 900,
                                            color: '#1a2744',
                                            letterSpacing: -1.5,
                                            lineHeight: 1.05,
                                            marginBottom: 8,
                                        }, children: "All Courses" }), _jsx("p", { style: { fontSize: 16, color: '#717182' }, children: "Explore our full catalog of AI education cohorts and recorded courses" })] }), _jsxs("select", { value: sort, onChange: (e) => setSort(e.target.value), style: {
                                    padding: '10px 18px',
                                    borderRadius: 10,
                                    border: '1.5px solid rgba(26,39,68,0.15)',
                                    background: '#fff',
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: '#1a2744',
                                    cursor: 'pointer',
                                    fontFamily: "'Inter', sans-serif",
                                    outline: 'none',
                                    flexShrink: 0,
                                }, "aria-label": "Sort courses", children: [_jsx("option", { value: "featured", children: "Sort: Featured" }), _jsx("option", { value: "price-asc", children: "Price: Low to High" }), _jsx("option", { value: "price-desc", children: "Price: High to Low" })] })] }), _jsx("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, role: "group", "aria-label": "Filter by type", children: FILTERS.map(({ key, label }) => {
                            const isActive = activeFilter === key;
                            const isHov = filterHovered === key;
                            const count = countFor(key);
                            return (_jsxs("button", { onClick: () => setActiveFilter(key), onMouseEnter: () => setFilterHovered(key), onMouseLeave: () => setFilterHovered(null), "aria-pressed": isActive, style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '9px 20px',
                                    borderRadius: 9999,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontFamily: "'Inter', sans-serif",
                                    background: isActive ? '#1a2744' : isHov ? '#f0f1f4' : '#fff',
                                    color: isActive ? '#fff' : '#1a2744',
                                    border: isActive ? '2px solid #1a2744' : '2px solid rgba(26,39,68,0.15)',
                                    transition: 'all 0.15s',
                                }, children: [label, cohorts != null && (_jsx("span", { style: {
                                            fontSize: 11,
                                            fontWeight: 700,
                                            background: isActive ? 'rgba(255,255,255,0.2)' : '#e8f4fd',
                                            color: isActive ? '#fff' : '#4a9ad4',
                                            borderRadius: 9999,
                                            padding: '1px 7px',
                                            minWidth: 20,
                                            textAlign: 'center',
                                        }, children: count }))] }, key));
                        }) })] }), _jsxs("main", { className: "catalog-main", style: { maxWidth: 1280, margin: '0 auto', padding: '40px 80px 80px' }, children: [!isPending && !isError && (_jsxs("p", { style: {
                            fontSize: 14,
                            color: '#9499a8',
                            marginBottom: 24,
                            fontWeight: 500,
                        }, children: ["Showing", ' ', _jsxs("strong", { style: { color: '#1a2744', fontWeight: 700 }, children: [filtered.length, " course", filtered.length !== 1 ? 's' : ''] }), activeFilter !== 'all' && (_jsxs(_Fragment, { children: [' ', "in", ' ', _jsx("span", { style: { color: '#4a9ad4' }, children: FILTERS.find((f) => f.key === activeFilter)?.label })] }))] })), isError && (_jsx("div", { style: {
                            textAlign: 'center',
                            padding: '80px 40px',
                            background: '#fff',
                            borderRadius: 20,
                            boxShadow: '0 1px 3px rgba(26,39,68,0.08)',
                        }, children: _jsx("p", { style: { fontSize: 16, color: '#717182' }, children: "Failed to load courses. Please try again." }) })), _jsx("div", { className: "catalog-grid", style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 28,
                        }, children: isPending ? (Array.from({ length: 6 }).map((_, i) => _jsx(SkeletonCard, {}, i))) : filtered.length === 0 ? (_jsx(EmptyState, { onClear: () => setActiveFilter('all') })) : (filtered.map((cohort) => _jsx(CohortCard, { cohort: cohort }, cohort.id))) })] }), _jsx(Footer, {}), _jsx("style", { children: `
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      ` })] }));
}
