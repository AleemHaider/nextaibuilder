// FIR-216/217/218 — Unified payment ledger with refund and CSV export
import { useState, useEffect, useRef } from 'react'
import { Download, Search, X } from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import { authFetch } from '../../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Payment {
  id: string
  type: 'stripe' | 'manual'
  studentName: string
  studentEmail: string
  course: string
  amount: number
  currency: string
  status: 'SUCCEEDED' | 'PAID' | 'PENDING' | 'REFUNDED' | 'FAILED'
  date: string
}

interface LedgerSummary {
  totalRevenue: number
  stripeRevenue: number
  manualRevenue: number
  pendingAmount: number
}

interface Filters {
  method: string
  status: string
  search: string
  dateFrom: string
  dateTo: string
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PAYMENTS: Payment[] = [
  { id: '1', type: 'stripe', studentName: 'Sara Ahmed', studentEmail: 'sara@example.com', course: 'AI Product Bootcamp', amount: 999, currency: 'usd', status: 'SUCCEEDED', date: '2025-01-08' },
  { id: '2', type: 'manual', studentName: 'Jordan Lee', studentEmail: 'jordan@gmail.com', course: 'Claude API Mastery', amount: 499, currency: 'usd', status: 'PENDING', date: '2025-01-05' },
  { id: '3', type: 'stripe', studentName: 'Priya Sharma', studentEmail: 'priya@outlook.com', course: 'Prompt Engineering Pro', amount: 299, currency: 'usd', status: 'REFUNDED', date: '2024-10-03' },
  { id: '4', type: 'manual', studentName: 'Marcus Webb', studentEmail: 'marcus@dev.io', course: 'Full-Stack AI Dev', amount: 799, currency: 'usd', status: 'SUCCEEDED', date: '2025-01-12' },
  { id: '5', type: 'stripe', studentName: 'Aleem Haider', studentEmail: 'aleem@nextai.com', course: 'AI Product Bootcamp', amount: 999, currency: 'usd', status: 'SUCCEEDED', date: '2024-12-10' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

const CARD_CONFIGS = [
  { key: 'totalRevenue' as const,   label: 'Total Revenue',   accent: '#4a9ad4', softBg: 'rgba(74,154,212,0.09)'   },
  { key: 'stripeRevenue' as const,  label: 'Stripe Revenue',  accent: '#7c3aed', softBg: 'rgba(124,58,237,0.09)'   },
  { key: 'manualRevenue' as const,  label: 'Manual Revenue',  accent: '#059669', softBg: 'rgba(5,150,105,0.09)'    },
  { key: 'pendingAmount' as const,  label: 'Pending Amount',  accent: '#f59e0b', softBg: 'rgba(245,158,11,0.09)'   },
]

function SummaryCard({
  label,
  value,
  accent,
  softBg,
}: {
  label: string
  value: string
  accent: string
  softBg: string
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 18,
        padding: '22px 22px 18px',
        border: '1px solid rgba(26,39,68,0.07)',
        boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.03)',
        position: 'relative',
        overflow: 'hidden',
        flex: 1,
      }}
    >
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '18px 18px 0 0' }} />
      {/* Corner tint */}
      <div style={{ position: 'absolute', bottom: -20, right: -20, width: 100, height: 100, background: softBg, borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ width: 40, height: 40, borderRadius: 12, background: softBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <div style={{ width: 16, height: 16, borderRadius: 4, background: accent, opacity: 0.85 }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#1a2744', letterSpacing: '-1px', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#717182', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Type badge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: Payment['type'] }) {
  const isStripe = type === 'stripe'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 10px',
      borderRadius: 20,
      background: isStripe ? 'rgba(74,154,212,0.12)' : 'rgba(245,158,11,0.12)',
      color: isStripe ? '#1e40af' : '#92400e',
    }}>
      {isStripe ? 'Stripe' : 'Manual'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: Payment['status'] }) {
  const cfg: Record<Payment['status'], { bg: string; color: string; label: string }> = {
    SUCCEEDED: { bg: 'rgba(5,150,105,0.1)',  color: '#065f46', label: 'Succeeded' },
    PAID:      { bg: 'rgba(5,150,105,0.1)',  color: '#065f46', label: 'Paid'      },
    PENDING:   { bg: 'rgba(245,158,11,0.1)', color: '#92400e', label: 'Pending'   },
    REFUNDED:  { bg: 'rgba(239,68,68,0.1)',  color: '#991b1b', label: 'Refunded'  },
    FAILED:    { bg: 'rgba(239,68,68,0.1)',  color: '#991b1b', label: 'Failed'    },
  }
  const { bg, color, label } = cfg[status]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
      fontWeight: 700,
      padding: '4px 10px',
      borderRadius: 20,
      background: bg,
      color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Refund Modal
// ---------------------------------------------------------------------------

interface RefundModalProps {
  payment: Payment
  onClose: () => void
  onConfirm: (amount: number, reason: string) => Promise<void>
}

function RefundModal({ payment, onClose, onConfirm }: RefundModalProps) {
  const [amount, setAmount] = useState(String(payment.amount))
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0 || parsed > payment.amount) {
      setError(`Amount must be between $1 and ${formatMoney(payment.amount)}`)
      return
    }
    if (!reason.trim()) {
      setError('Reason is required')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onConfirm(parsed, reason.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed')
      setLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,26,58,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      role="dialog"
      aria-modal="true"
      aria-label="Refund payment"
    >
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(26,39,68,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a2744', margin: 0 }}>Issue Refund</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 34, height: 34, borderRadius: '50%', background: '#f0f0f0', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#717182' }}
          >
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#717182', marginBottom: 24 }}>
          Refunding payment from <strong style={{ color: '#1a2744' }}>{payment.studentName}</strong> for <strong style={{ color: '#1a2744' }}>{payment.course}</strong>.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="refund-amount" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 6 }}>
            Refund Amount (max {formatMoney(payment.amount)})
          </label>
          <input
            id="refund-amount"
            ref={inputRef}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={1}
            max={payment.amount}
            step={0.01}
            style={{
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
            }}
          />

          <label htmlFor="refund-reason" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 6 }}>
            Reason
          </label>
          <textarea
            id="refund-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Provide a reason for this refund…"
            rows={3}
            style={{
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
            }}
          />

          {error && (
            <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 16, fontWeight: 600 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: 30,
                background: '#f0f0f0',
                color: '#717182',
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: 30,
                background: loading ? '#e8ecf4' : '#ef4444',
                color: loading ? '#a3a3b8' : '#fff',
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Processing…' : 'Confirm Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((n) => (
        <tr key={n} aria-hidden="true">
          {[140, 90, 160, 140, 80, 90, 80].map((w, i) => (
            <td key={i} style={{ padding: '14px 20px', borderBottom: '1px solid rgba(26,39,68,0.04)' }}>
              <div style={{ height: 13, borderRadius: 6, background: '#e8ecf4', width: w, animation: 'pulse 1.5s ease-in-out infinite' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const ITEMS_PER_PAGE = 20

const METHOD_OPTIONS = [
  { label: 'All Methods', value: '' },
  { label: 'Stripe', value: 'stripe' },
  { label: 'Manual', value: 'manual' },
]

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: '' },
  { label: 'Succeeded', value: 'SUCCEEDED' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Refunded', value: 'REFUNDED' },
  { label: 'Failed', value: 'FAILED' },
]

const inputStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 30,
  border: '1.5px solid rgba(26,39,68,0.12)',
  fontSize: 13,
  color: '#1a2744',
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  cursor: 'pointer',
}

export default function TransactionLedgerPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [summary, setSummary] = useState<LedgerSummary>({ totalRevenue: 0, stripeRevenue: 0, manualRevenue: 0, pendingAmount: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const [filters, setFilters] = useState<Filters>({ method: '', status: '', search: '', dateFrom: '', dateTo: '' })
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ method: '', status: '', search: '', dateFrom: '', dateTo: '' })

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // Fetch payments
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(ITEMS_PER_PAGE))
        if (appliedFilters.method) params.set('method', appliedFilters.method)
        if (appliedFilters.status) params.set('status', appliedFilters.status)
        if (appliedFilters.search) params.set('q', appliedFilters.search)
        if (appliedFilters.dateFrom) params.set('dateFrom', appliedFilters.dateFrom)
        if (appliedFilters.dateTo) params.set('dateTo', appliedFilters.dateTo)

        const res = await authFetch(`/api/v1/admin/payments?${params}`)
        if (!res.ok) throw new Error('API error')
        const json = await res.json()
        if (cancelled) return
        setPayments(json.payments ?? [])
        setTotal(json.total ?? 0)
        setSummary(json.summary ?? { totalRevenue: 0, stripeRevenue: 0, manualRevenue: 0, pendingAmount: 0 })
      } catch {
        if (cancelled) return
        // Fall back to mock data
        let filtered = MOCK_PAYMENTS
        if (appliedFilters.method) filtered = filtered.filter((p) => p.type === appliedFilters.method)
        if (appliedFilters.status) filtered = filtered.filter((p) => p.status === appliedFilters.status)
        if (appliedFilters.search) {
          const q = appliedFilters.search.toLowerCase()
          filtered = filtered.filter((p) =>
            p.studentName.toLowerCase().includes(q) ||
            p.studentEmail.toLowerCase().includes(q) ||
            p.course.toLowerCase().includes(q),
          )
        }
        const start = (page - 1) * ITEMS_PER_PAGE
        setPayments(filtered.slice(start, start + ITEMS_PER_PAGE))
        setTotal(filtered.length)
        const succeeded = filtered.filter((p) => p.status === 'SUCCEEDED' || p.status === 'PAID')
        setSummary({
          totalRevenue: succeeded.reduce((s, p) => s + p.amount, 0),
          stripeRevenue: succeeded.filter((p) => p.type === 'stripe').reduce((s, p) => s + p.amount, 0),
          manualRevenue: succeeded.filter((p) => p.type === 'manual').reduce((s, p) => s + p.amount, 0),
          pendingAmount: filtered.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0),
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [page, appliedFilters])

  function applyFilters() {
    setPage(1)
    setAppliedFilters({ ...filters })
  }

  function resetFilters() {
    const empty: Filters = { method: '', status: '', search: '', dateFrom: '', dateTo: '' }
    setFilters(empty)
    setAppliedFilters(empty)
    setPage(1)
  }

  async function handleExportCSV() {
    try {
      const params = new URLSearchParams()
      if (appliedFilters.method) params.set('method', appliedFilters.method)
      if (appliedFilters.status) params.set('status', appliedFilters.status)
      if (appliedFilters.search) params.set('q', appliedFilters.search)
      if (appliedFilters.dateFrom) params.set('dateFrom', appliedFilters.dateFrom)
      if (appliedFilters.dateTo) params.set('dateTo', appliedFilters.dateTo)

      const res = await authFetch(`/api/v1/admin/payments/export?${params}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Fallback: generate CSV from current mock data
      const headers = 'Date,Type,Student,Email,Course,Amount,Status'
      const rows = payments.map((p) =>
        [p.date, p.type, p.studentName, p.studentEmail, `"${p.course}"`, p.amount, p.status].join(','),
      )
      const csv = [headers, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setToast({ msg: 'CSV exported (demo data)', ok: true })
    }
  }

  async function handleRefund(payment: Payment, amount: number, reason: string) {
    const res = await authFetch(`/api/v1/admin/payments/${payment.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.message || 'Refund failed')
    }
    setRefundTarget(null)
    setToast({ msg: `Refund of ${formatMoney(amount)} issued for ${payment.studentName}`, ok: true })
    // Re-apply filters to refresh the list
    setAppliedFilters((prev) => ({ ...prev }))
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)
  const hasActiveFilters = appliedFilters.method || appliedFilters.status || appliedFilters.search || appliedFilters.dateFrom || appliedFilters.dateTo

  const summaryValues: Record<keyof LedgerSummary, string> = {
    totalRevenue: formatMoney(summary.totalRevenue),
    stripeRevenue: formatMoney(summary.stripeRevenue),
    manualRevenue: formatMoney(summary.manualRevenue),
    pendingAmount: formatMoney(summary.pendingAmount),
  }

  return (
    <AdminShell
      title="Payments"
      actions={
        <button
          type="button"
          onClick={handleExportCSV}
          style={{
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
          }}
        >
          <Download size={14} strokeWidth={2.5} />
          Export CSV
        </button>
      }
    >
      {/* Refund modal */}
      {refundTarget && (
        <RefundModal
          payment={refundTarget}
          onClose={() => setRefundTarget(null)}
          onConfirm={(amount, reason) => handleRefund(refundTarget, amount, reason)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
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
          }}
        >
          <span aria-hidden="true">{toast.ok ? '✓' : '✗'}</span>
          {toast.msg}
        </div>
      )}

      <div style={{ padding: '28px 32px', background: '#f8f9fb', minHeight: '100%' }}>

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {CARD_CONFIGS.map((cfg) => (
            <SummaryCard
              key={cfg.key}
              label={cfg.label}
              value={summaryValues[cfg.key]}
              accent={cfg.accent}
              softBg={cfg.softBg}
            />
          ))}
        </div>

        {/* Filter bar */}
        <div style={{
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
        }}>
          {/* Method */}
          <select
            value={filters.method}
            onChange={(e) => setFilters((f) => ({ ...f, method: e.target.value }))}
            aria-label="Filter by method"
            style={inputStyle}
          >
            {METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Status */}
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            aria-label="Filter by status"
            style={inputStyle}
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#a3a3a3', pointerEvents: 'none' }} aria-hidden="true" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Student, email, or course…"
              aria-label="Search"
              style={{ ...inputStyle, paddingLeft: 34, width: '100%', boxSizing: 'border-box', borderRadius: 30 }}
            />
          </div>

          {/* Date from */}
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            aria-label="From date"
            style={inputStyle}
          />

          {/* Date to */}
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            aria-label="To date"
            style={inputStyle}
          />

          {/* Apply */}
          <button
            type="button"
            onClick={applyFilters}
            style={{
              padding: '9px 20px',
              borderRadius: 30,
              background: '#1a2744',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Apply
          </button>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                padding: '9px 16px',
                borderRadius: 30,
                background: 'transparent',
                color: '#717182',
                fontSize: 13,
                fontWeight: 600,
                border: '1.5px solid rgba(26,39,68,0.12)',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Table card */}
        <div style={{
          background: '#fff',
          borderRadius: 18,
          border: '1px solid rgba(26,39,68,0.07)',
          boxShadow: '0 1px 3px rgba(26,39,68,0.06), 0 4px 16px rgba(26,39,68,0.03)',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Payment transactions">
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['Date', 'Type', 'Student', 'Course', 'Amount', 'Status', 'Actions'].map((col) => (
                    <th
                      key={col}
                      scope="col"
                      style={{
                        textAlign: 'left',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#a3a3b8',
                        padding: '11px 20px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '1px solid rgba(26,39,68,0.06)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonRows />}

                {!loading && payments.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">💳</div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#1a2744', margin: 0 }}>No transactions found</p>
                      <p style={{ fontSize: 13, color: '#a3a3b8', marginTop: 4 }}>
                        {hasActiveFilters ? 'Try adjusting your filters.' : 'No payment records yet.'}
                      </p>
                    </td>
                  </tr>
                )}

                {!loading && payments.map((payment, i) => {
                  const canRefund = payment.status === 'SUCCEEDED' || payment.status === 'PAID'
                  return (
                    <tr
                      key={payment.id}
                      style={{ borderBottom: i < payments.length - 1 ? '1px solid rgba(26,39,68,0.04)' : 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f9fb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Date */}
                      <td style={{ padding: '14px 20px', fontSize: 12, color: '#717182', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {formatDate(payment.date)}
                      </td>

                      {/* Type */}
                      <td style={{ padding: '14px 20px' }}>
                        <TypeBadge type={payment.type} />
                      </td>

                      {/* Student */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744', whiteSpace: 'nowrap' }}>{payment.studentName}</div>
                        <div style={{ fontSize: 11, color: '#a3a3b8', marginTop: 1 }}>{payment.studentEmail}</div>
                      </td>

                      {/* Course */}
                      <td style={{ padding: '14px 20px', fontSize: 12, fontWeight: 600, color: '#1a2744', maxWidth: 200 }}>
                        {payment.course}
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 800, color: '#1a2744', whiteSpace: 'nowrap' }}>
                        {formatMoney(payment.amount)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <StatusPill status={payment.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px' }}>
                        {canRefund ? (
                          <button
                            type="button"
                            onClick={() => setRefundTarget(payment)}
                            style={{
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
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                          >
                            Refund
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'rgba(26,39,68,0.15)', fontWeight: 500 }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {!loading && total > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 24px',
              borderTop: '1px solid rgba(26,39,68,0.05)',
              background: '#fafbfc',
            }}>
              <span style={{ fontSize: 12, color: '#a3a3b8' }}>
                Showing {Math.min((page - 1) * ITEMS_PER_PAGE + 1, total)}–{Math.min(page * ITEMS_PER_PAGE, total)} of {total} transactions
              </span>
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 4 }} role="navigation" aria-label="Pagination">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      border: '1.5px solid rgba(26,39,68,0.12)',
                      background: '#fff', color: '#717182', cursor: page === 1 ? 'not-allowed' : 'pointer',
                      opacity: page === 1 ? 0.4 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}
                  >
                    ‹
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = i + 1
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        aria-label={`Page ${p}`}
                        aria-current={page === p ? 'page' : undefined}
                        style={{
                          width: 32, height: 32, borderRadius: '50%',
                          border: page === p ? '1.5px solid #4a9ad4' : '1.5px solid rgba(26,39,68,0.12)',
                          background: page === p ? '#4a9ad4' : '#fff',
                          color: page === p ? '#fff' : '#717182',
                          cursor: 'pointer',
                          fontSize: 13, fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {p}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    aria-label="Next page"
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      border: '1.5px solid rgba(26,39,68,0.12)',
                      background: '#fff', color: '#717182', cursor: page === totalPages ? 'not-allowed' : 'pointer',
                      opacity: page === totalPages ? 0.4 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Skeleton pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </AdminShell>
  )
}
