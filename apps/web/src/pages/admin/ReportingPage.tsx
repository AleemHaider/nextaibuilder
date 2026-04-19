// FIR-76/77/78/79/174 — Admin reporting: Revenue, Enrollments, Payments, Cohort Performance
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, BarChart2 } from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import {
  fetchRevenueAnalytics,
  fetchEnrollmentAnalytics,
  fetchPaymentsAnalytics,
  fetchCohortPerformance,
  fetchAdminCohortsList,
  type PaymentRecord,
  type CohortPerformance,
} from '../../lib/api'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ReportingTab = 'revenue' | 'enrollments' | 'payments' | 'cohort-performance'

const TABS: Array<{ key: ReportingTab; label: string }> = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'enrollments', label: 'Enrollments' },
  { key: 'payments', label: 'Payments' },
  { key: 'cohort-performance', label: 'Cohort Performance' },
]

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(2)}`
}

function fmtNum(n: number) {
  return n.toLocaleString()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function downloadCsv(endpoint: string) {
  const url = `/api/v1/admin/analytics/${endpoint}/csv`
  const a = document.createElement('a')
  a.href = url
  a.download = `${endpoint}-export.csv`
  a.click()
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string
  value: string
  highlight?: boolean
}

function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <div className={cn(
      'bg-white rounded-[16px] p-5 shadow-[var(--color-wise-ring)_0_0_0_1px]',
      highlight && 'ring-2 ring-[var(--color-wise-primary-text)]/30',
    )}>
      <div className="text-[32px] font-[800] text-[var(--color-wise-text)] tracking-[-0.5px] leading-none mb-1">
        {value}
      </div>
      <div className="text-[13px] text-[var(--color-wise-text-muted)]">{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DateRangeFilter
// ---------------------------------------------------------------------------

interface DateRange { from: string; to: string }

interface DateRangeFilterProps {
  value: DateRange
  onChange: (v: DateRange) => void
}

function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-[13px] font-[600] text-[var(--color-wise-text-muted)]">
        From
        <input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="px-3 py-1.5 rounded-[8px] border border-[var(--color-wise-ring-strong)] bg-[var(--color-wise-canvas)] text-[var(--color-wise-text)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--color-wise-primary-text)]"
        />
      </label>
      <label className="flex items-center gap-2 text-[13px] font-[600] text-[var(--color-wise-text-muted)]">
        To
        <input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="px-3 py-1.5 rounded-[8px] border border-[var(--color-wise-ring-strong)] bg-[var(--color-wise-canvas)] text-[var(--color-wise-text)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--color-wise-primary-text)]"
        />
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Simple bar chart (no recharts dependency — pure CSS bars)
// ---------------------------------------------------------------------------

interface BarChartProps {
  data: Array<{ label: string; value: number }>
  valueFormatter?: (v: number) => string
}

function SimpleBarChart({ data, valueFormatter = (v) => String(v) }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="space-y-2 mt-4" role="img" aria-label="Revenue by cohort">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <div className="w-32 sm:w-40 flex-shrink-0 text-[13px] text-[var(--color-wise-text-muted)] truncate text-right">
            {item.label}
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-7 bg-[var(--color-wise-surface-soft)] rounded-[6px] overflow-hidden">
              <div
                className="h-full bg-[var(--color-wise-primary-text)] rounded-[6px] transition-all"
                style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
              />
            </div>
            <span className="text-[13px] font-[700] text-[var(--color-wise-text)] w-16 text-right flex-shrink-0">
              {valueFormatter(item.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Revenue Tab
// ---------------------------------------------------------------------------

function RevenueTab() {
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'analytics', 'revenue', dateRange],
    queryFn: () => fetchRevenueAnalytics({
      from: dateRange.from || undefined,
      to: dateRange.to || undefined,
    }),
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        <button
          type="button"
          onClick={() => downloadCsv('revenue')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-[700]',
            'border border-[var(--color-wise-ring-strong)] text-[var(--color-wise-text)] hover:bg-[var(--color-wise-surface-soft)]',
            'bg-transparent cursor-pointer transition-colors',
          )}
        >
          <Download size={14} aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-[var(--color-wise-surface-soft)] rounded-[16px]" />)}
        </div>
      ) : error ? (
        <div className="bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] rounded-[12px] p-4 text-[14px] font-[600]">
          Failed to load revenue data.
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Revenue" value={fmt(data.totalRevenue)} highlight />
            <StatCard label="MRR" value={fmt(data.mrr)} />
            <StatCard label="Active Cohorts" value={fmtNum(data.cohortCount)} />
          </div>

          {data.byCohort && data.byCohort.length > 0 && (
            <div className="bg-white rounded-[16px] shadow-[var(--color-wise-ring)_0_0_0_1px] p-6">
              <h3 className="text-[15px] font-[700] text-[var(--color-wise-text)] mb-2">Revenue by Cohort</h3>
              <SimpleBarChart
                data={data.byCohort.map((c) => ({ label: c.cohortTitle, value: c.revenue }))}
                valueFormatter={fmt}
              />
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Enrollments Tab
// ---------------------------------------------------------------------------

function EnrollmentsTab() {
  const [selectedCohort, setSelectedCohort] = useState('')

  const { data: cohortsData } = useQuery({
    queryKey: ['admin', 'cohorts-list'],
    queryFn: fetchAdminCohortsList,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'analytics', 'enrollments', selectedCohort],
    queryFn: () => fetchEnrollmentAnalytics(selectedCohort || undefined),
  })

  const cohorts = cohortsData?.cohorts ?? []

  return (
    <div>
      <div className="mb-6">
        <label className="flex items-center gap-2 text-[13px] font-[600] text-[var(--color-wise-text-muted)]">
          Filter by cohort
          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            className="px-3 py-1.5 rounded-[8px] border border-[var(--color-wise-ring-strong)] bg-[var(--color-wise-canvas)] text-[var(--color-wise-text)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--color-wise-primary-text)]"
          >
            <option value="">All cohorts</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="animate-pulse grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-[var(--color-wise-surface-soft)] rounded-[16px]" />)}
        </div>
      ) : error ? (
        <div className="bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] rounded-[12px] p-4 text-[14px] font-[600]">
          Failed to load enrollment data.
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total" value={fmtNum(data.total)} />
            <StatCard label="Active" value={fmtNum(data.active)} highlight />
            <StatCard label="Pending" value={fmtNum(data.pending)} />
            <StatCard label="Cancelled" value={fmtNum(data.cancelled)} />
          </div>

          {data.byCohort && data.byCohort.length > 0 && (
            <div className="bg-white rounded-[16px] shadow-[var(--color-wise-ring)_0_0_0_1px] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--color-wise-ring)]">
                <h3 className="text-[15px] font-[700] text-[var(--color-wise-text)]">By Cohort</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" aria-label="Enrollments by cohort">
                  <thead>
                    <tr>
                      {['Cohort', 'Active', 'Pending'].map((col) => (
                        <th key={col} scope="col" className="text-left text-[12px] font-[700] text-[var(--color-wise-text-muted)] uppercase tracking-[0.5px] px-5 py-2.5 border-b border-[var(--color-wise-ring)]">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCohort.map((row) => (
                      <tr key={row.cohortTitle} className="hover:[&>td]:bg-[var(--color-wise-canvas)]">
                        <td className="px-5 py-3 border-b border-[var(--color-wise-ring)] text-[14px] font-[600] text-[var(--color-wise-text)]">{row.cohortTitle}</td>
                        <td className="px-5 py-3 border-b border-[var(--color-wise-ring)] text-[14px] text-[var(--color-wise-text)]">{fmtNum(row.active)}</td>
                        <td className="px-5 py-3 border-b border-[var(--color-wise-ring)] text-[14px] text-[var(--color-wise-text)]">{fmtNum(row.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payments Tab
// ---------------------------------------------------------------------------

type PaymentMethod = 'all' | 'stripe' | 'manual'

interface PaymentsFilters {
  from: string
  to: string
  cohortId: string
  method: PaymentMethod
  page: number
}

const EMPTY_FILTERS: PaymentsFilters = { from: '', to: '', cohortId: '', method: 'all', page: 1 }

function PaymentMethodBadge({ method }: { method: PaymentRecord['method'] }) {
  return (
    <span className={cn(
      'text-[11px] font-[700] px-[9px] py-[3px] rounded-full',
      method === 'stripe' ? 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]' : 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)]',
    )}>
      {method === 'stripe' ? 'Stripe' : 'Manual'}
    </span>
  )
}

function PaymentStatusBadge({ status }: { status: PaymentRecord['status'] }) {
  const styles: Record<PaymentRecord['status'], string> = {
    PAID: 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
    PENDING: 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)]',
    FAILED: 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',
    REJECTED: 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',
  }
  return (
    <span className={cn('text-[11px] font-[700] px-[9px] py-[3px] rounded-full', styles[status])}>
      {status}
    </span>
  )
}

function PaymentsTab() {
  const [filters, setFilters] = useState<PaymentsFilters>(EMPTY_FILTERS)

  const { data: cohortsData } = useQuery({
    queryKey: ['admin', 'cohorts-list'],
    queryFn: fetchAdminCohortsList,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'analytics', 'payments', filters],
    queryFn: () => fetchPaymentsAnalytics({
      from: filters.from || undefined,
      to: filters.to || undefined,
      cohortId: filters.cohortId || undefined,
      method: filters.method !== 'all' ? filters.method : undefined,
      page: filters.page,
    }),
  })

  const cohorts = cohortsData?.cohorts ?? []
  const payments = data?.payments ?? []
  const total = data?.total ?? 0
  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function setPage(p: number) {
    setFilters((prev) => ({ ...prev, page: p }))
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <DateRangeFilter
          value={{ from: filters.from, to: filters.to }}
          onChange={({ from, to }) => setFilters((p) => ({ ...p, from, to, page: 1 }))}
        />

        <select
          value={filters.cohortId}
          onChange={(e) => setFilters((p) => ({ ...p, cohortId: e.target.value, page: 1 }))}
          className="px-3 py-1.5 rounded-[8px] border border-[var(--color-wise-ring-strong)] bg-[var(--color-wise-canvas)] text-[var(--color-wise-text)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--color-wise-primary-text)]"
          aria-label="Filter by cohort"
        >
          <option value="">All cohorts</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        <select
          value={filters.method}
          onChange={(e) => setFilters((p) => ({ ...p, method: e.target.value as PaymentMethod, page: 1 }))}
          className="px-3 py-1.5 rounded-[8px] border border-[var(--color-wise-ring-strong)] bg-[var(--color-wise-canvas)] text-[var(--color-wise-text)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--color-wise-primary-text)]"
          aria-label="Filter by method"
        >
          <option value="all">All methods</option>
          <option value="stripe">Stripe</option>
          <option value="manual">Manual</option>
        </select>

        <button
          type="button"
          onClick={() => downloadCsv('payments')}
          className={cn(
            'flex items-center gap-2 px-4 py-1.5 rounded-[8px] text-[13px] font-[700]',
            'border border-[var(--color-wise-ring-strong)] text-[var(--color-wise-text)] hover:bg-[var(--color-wise-surface-soft)]',
            'bg-transparent cursor-pointer transition-colors',
          )}
        >
          <Download size={13} aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse bg-[var(--color-wise-surface-soft)] rounded-[16px] h-64" />
      ) : error ? (
        <div className="bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] rounded-[12px] p-4 text-[14px] font-[600]">
          Failed to load payments data.
        </div>
      ) : (
        <div className="bg-white rounded-[16px] shadow-[var(--color-wise-ring)_0_0_0_1px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" aria-label="Payments">
              <thead>
                <tr>
                  {['Student', 'Cohort', 'Amount', 'Method', 'Status', 'Date'].map((col) => (
                    <th key={col} scope="col" className="text-left text-[12px] font-[700] text-[var(--color-wise-text-muted)] uppercase tracking-[0.5px] px-5 py-2.5 border-b border-[var(--color-wise-ring)]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[14px] text-[var(--color-wise-text-muted)]">
                      No payments found.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:[&>td]:bg-[var(--color-wise-canvas)]">
                      <td className="px-5 py-3 border-b border-[var(--color-wise-ring)]">
                        <div className="text-[14px] font-[600] text-[var(--color-wise-text)]">{p.studentName}</div>
                        <div className="text-[12px] text-[var(--color-wise-text-muted)]">{p.studentEmail}</div>
                      </td>
                      <td className="px-5 py-3 border-b border-[var(--color-wise-ring)] text-[14px] text-[var(--color-wise-text)]">{p.cohortTitle}</td>
                      <td className="px-5 py-3 border-b border-[var(--color-wise-ring)] text-[14px] font-[700] text-[var(--color-wise-text)]">{fmt(p.amount)}</td>
                      <td className="px-5 py-3 border-b border-[var(--color-wise-ring)]"><PaymentMethodBadge method={p.method} /></td>
                      <td className="px-5 py-3 border-b border-[var(--color-wise-ring)]"><PaymentStatusBadge status={p.status} /></td>
                      <td className="px-5 py-3 border-b border-[var(--color-wise-ring)] text-[13px] text-[var(--color-wise-text-muted)]">{fmtDate(p.date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--color-wise-ring)]">
              <p className="text-[13px] text-[var(--color-wise-text-muted)]">
                Page {filters.page} of {totalPages} · {fmtNum(total)} total
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(filters.page - 1)}
                  disabled={filters.page <= 1}
                  className="px-3 py-1.5 rounded-[8px] text-[13px] font-[600] border border-[var(--color-wise-ring-strong)] disabled:opacity-40 hover:bg-[var(--color-wise-surface-soft)] bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage(filters.page + 1)}
                  disabled={filters.page >= totalPages}
                  className="px-3 py-1.5 rounded-[8px] text-[13px] font-[600] border border-[var(--color-wise-ring-strong)] disabled:opacity-40 hover:bg-[var(--color-wise-surface-soft)] bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cohort Performance Tab
// ---------------------------------------------------------------------------

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-[var(--color-wise-surface-soft)] rounded-full overflow-hidden min-w-[80px]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct >= 80 ? 'var(--color-wise-primary-text)' : pct >= 40 ? 'var(--color-wise-primary-text)' : 'var(--color-wise-primary)',
          }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <span className="text-[13px] font-[700] text-[var(--color-wise-text)] w-10 text-right flex-shrink-0">
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function CohortPerformanceTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'analytics', 'cohort-performance'],
    queryFn: fetchCohortPerformance,
  })

  const rows: CohortPerformance[] = data?.cohorts ?? []

  return (
    <div>
      {isLoading ? (
        <div className="animate-pulse bg-[var(--color-wise-surface-soft)] rounded-[16px] h-64" />
      ) : error ? (
        <div className="bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] rounded-[12px] p-4 text-[14px] font-[600]">
          Failed to load cohort performance.
        </div>
      ) : (
        <div className="bg-white rounded-[16px] shadow-[var(--color-wise-ring)_0_0_0_1px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" aria-label="Cohort performance">
              <thead>
                <tr>
                  {['Cohort', 'Total Enrolled', 'Avg Completion', 'Completed'].map((col) => (
                    <th key={col} scope="col" className="text-left text-[12px] font-[700] text-[var(--color-wise-text-muted)] uppercase tracking-[0.5px] px-5 py-2.5 border-b border-[var(--color-wise-ring)]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-[14px] text-[var(--color-wise-text-muted)]">
                      No cohort data yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.cohortTitle} className="hover:[&>td]:bg-[var(--color-wise-canvas)]">
                      <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)] text-[14px] font-[700] text-[var(--color-wise-text)]">
                        {row.cohortTitle}
                      </td>
                      <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)] text-[14px] text-[var(--color-wise-text)]">
                        {fmtNum(row.totalEnrolled)}
                      </td>
                      <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)] min-w-[200px]">
                        <ProgressBar value={row.avgCompletionPct} />
                      </td>
                      <td className="px-5 py-3.5 border-b border-[var(--color-wise-ring)] text-[14px] font-[600] text-[var(--color-wise-primary-text)]">
                        {fmtNum(row.completedCount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReportingPage
// ---------------------------------------------------------------------------

export default function ReportingPage() {
  const [activeTab, setActiveTab] = useState<ReportingTab>('revenue')

  return (
    <AdminShell
      title="Reporting"
      actions={
        <div className="flex items-center gap-1.5 text-[var(--color-wise-text-muted)]">
          <BarChart2 size={16} aria-hidden="true" />
          <span className="text-[13px] font-[500]">Analytics</span>
        </div>
      }
    >
      <div className="p-6 lg:p-8">
        {/* Tab bar */}
        <div
          className="flex gap-1 bg-[var(--color-wise-surface-soft)] rounded-[12px] p-1 mb-7 w-fit overflow-x-auto"
          role="tablist"
          aria-label="Reporting sections"
        >
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'px-4 py-2 rounded-[9px] text-[13px] font-[600] transition-all border-none cursor-pointer whitespace-nowrap',
                activeTab === key
                  ? 'bg-white text-[var(--color-wise-text)] shadow-[0_1px_4px_var(--color-wise-ring)]'
                  : 'bg-transparent text-[var(--color-wise-text-muted)] hover:text-[var(--color-wise-text)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'revenue' && <RevenueTab />}
        {activeTab === 'enrollments' && <EnrollmentsTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'cohort-performance' && <CohortPerformanceTab />}
      </div>
    </AdminShell>
  )
}
