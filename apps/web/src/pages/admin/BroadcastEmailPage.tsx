// FIR-167 — Admin broadcast email compose UI with send history log
import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Mail, Send, Eye, EyeOff, Check, X } from 'lucide-react'
import AdminShell from '../../components/admin/AdminShell'
import {
  sendBroadcastEmail,
  fetchEmailLogs,
  fetchAdminCohortsList,
  type EmailLog,
} from '../../lib/api'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastState = { message: string; type: 'success' | 'error' } | null

interface FormState {
  target: 'all' | string
  subject: string
  body: string
}

const EMPTY_FORM: FormState = { target: 'all', subject: '', body: '' }

// ---------------------------------------------------------------------------
// Inline toast
// ---------------------------------------------------------------------------

function Toast({ state, onDismiss }: { state: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!state) return
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [state, onDismiss])

  if (!state) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-[14px] shadow-xl',
        'text-[14px] font-[600] max-w-[340px]',
        state.type === 'success' ? 'bg-[var(--color-wise-text)] text-white' : 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        {state.type === 'success' ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
        {state.message}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Email log table
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function EmailLogTable({ logs }: { logs: EmailLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-10 text-[14px] text-[var(--color-wise-text-muted)]">
        No emails sent yet.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" aria-label="Sent email log">
        <thead>
          <tr>
            {['Target', 'Subject', 'Sent At', 'Recipients'].map((col) => (
              <th
                key={col}
                scope="col"
                className="text-left text-[12px] font-[700] text-[var(--color-wise-text-muted)] uppercase tracking-[0.5px] px-5 py-2.5 border-b border-[var(--color-wise-ring)]"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="hover:[&>td]:bg-[var(--color-wise-canvas)]">
              <td className="px-5 py-3 border-b border-[var(--color-wise-ring)] text-[13px]">
                <span className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-[700]',
                  log.target === 'all'
                    ? 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]'
                    : 'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)]',
                )}>
                  {log.target === 'all' ? 'All Students' : log.target}
                </span>
              </td>
              <td className="px-5 py-3 border-b border-[var(--color-wise-ring)] text-[14px] text-[var(--color-wise-text)] font-[500] max-w-[240px] truncate">
                {log.subject}
              </td>
              <td className="px-5 py-3 border-b border-[var(--color-wise-ring)] text-[13px] text-[var(--color-wise-text-muted)]">
                {formatDate(log.sentAt)}
              </td>
              <td className="px-5 py-3 border-b border-[var(--color-wise-ring)] text-[14px] font-[700] text-[var(--color-wise-text)]">
                {log.recipientCount.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BroadcastEmailPage
// ---------------------------------------------------------------------------

export default function BroadcastEmailPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showPreview, setShowPreview] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const [logPage] = useState(1)

  // Cohorts for audience selector
  const { data: cohortsData } = useQuery({
    queryKey: ['admin', 'cohorts-list'],
    queryFn: fetchAdminCohortsList,
  })

  // Email logs
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['admin', 'email-logs', logPage],
    queryFn: () => fetchEmailLogs(logPage),
  })

  const sendMutation = useMutation({
    mutationFn: sendBroadcastEmail,
    onSuccess: (data) => {
      setToast({
        message: `Email sent to ${data.recipientCount} recipient${data.recipientCount !== 1 ? 's' : ''}.`,
        type: 'success',
      })
      setForm(EMPTY_FORM)
      setShowPreview(false)
      void refetchLogs()
    },
    onError: (err: Error) => {
      setToast({ message: err.message || 'Failed to send email.', type: 'error' })
    },
  })

  const handleField = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subject.trim() || !form.body.trim()) return
    sendMutation.mutate({
      target: form.target,
      subject: form.subject,
      body: form.body,
    })
  }

  const cohorts = cohortsData?.cohorts ?? []
  const logs = logsData?.logs ?? []
  const isSending = sendMutation.isPending

  return (
    <AdminShell title="Broadcast Email" actions={
      <div className="flex items-center gap-2">
        <Mail size={16} className="text-[var(--color-wise-text-muted)]" aria-hidden="true" />
        <span className="text-[13px] text-[var(--color-wise-text-muted)] font-[500]">
          {(logsData?.total ?? 0).toLocaleString()} emails sent
        </span>
      </div>
    }>
      <div className="p-6 lg:p-8 max-w-[900px]">
        {/* Compose form */}
        <div className="bg-white rounded-[20px] shadow-[var(--color-wise-ring)_0_0_0_1px] mb-8 overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--color-wise-ring)]">
            <h2 className="text-[16px] font-[700] text-[var(--color-wise-text)]">Compose Email</h2>
            <p className="text-[13px] text-[var(--color-wise-text-muted)] mt-0.5">
              Send a broadcast email to all students or a specific cohort.
            </p>
          </div>

          <form onSubmit={handleSend} className="p-6 space-y-5">
            {/* Target audience */}
            <div>
              <label className="block text-[13px] font-[700] text-[var(--color-wise-text)] mb-2">
                Target Audience
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-[12px] border cursor-pointer transition-colors flex-1',
                  form.target === 'all'
                    ? 'border-[var(--color-wise-primary-text)] bg-[var(--color-wise-mint)]'
                    : 'border-[var(--color-wise-ring)] hover:bg-[var(--color-wise-canvas)]',
                )}>
                  <input
                    type="radio"
                    name="target"
                    value="all"
                    checked={form.target === 'all'}
                    onChange={() => handleField('target', 'all')}
                    className="accent-[var(--color-wise-primary-text)]"
                  />
                  <span className="text-[14px] font-[600] text-[var(--color-wise-text)]">All Students</span>
                </label>
                <label className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-[12px] border cursor-pointer transition-colors flex-1',
                  form.target !== 'all'
                    ? 'border-[var(--color-wise-primary-text)] bg-[var(--color-wise-mint)]'
                    : 'border-[var(--color-wise-ring)] hover:bg-[var(--color-wise-canvas)]',
                )}>
                  <input
                    type="radio"
                    name="target"
                    value="specific"
                    checked={form.target !== 'all'}
                    onChange={() => {
                      const first = cohorts[0]?.id ?? ''
                      handleField('target', first)
                    }}
                    className="accent-[var(--color-wise-primary-text)]"
                  />
                  <span className="text-[14px] font-[600] text-[var(--color-wise-text)]">Specific Cohort</span>
                </label>
              </div>

              {/* Cohort dropdown */}
              {form.target !== 'all' && (
                <div className="mt-3">
                  <select
                    value={form.target}
                    onChange={(e) => handleField('target', e.target.value)}
                    className={cn(
                      'w-full sm:w-auto px-4 py-2.5 rounded-[10px] text-[14px] font-[500]',
                      'border border-[var(--color-wise-ring-strong)] bg-[var(--color-wise-canvas)] text-[var(--color-wise-text)]',
                      'focus:outline-none focus:ring-2 focus:ring-[var(--color-wise-primary-text)]',
                    )}
                    aria-label="Select cohort"
                  >
                    {cohorts.length === 0 && (
                      <option value="">Loading cohorts…</option>
                    )}
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Subject */}
            <div>
              <label
                htmlFor="email-subject"
                className="block text-[13px] font-[700] text-[var(--color-wise-text)] mb-2"
              >
                Subject Line
              </label>
              <input
                id="email-subject"
                type="text"
                value={form.subject}
                onChange={(e) => handleField('subject', e.target.value)}
                placeholder="e.g. Important update about your course"
                required
                className={cn(
                  'w-full px-4 py-2.5 rounded-[10px] text-[14px]',
                  'border border-[var(--color-wise-ring-strong)] bg-[var(--color-wise-canvas)] text-[var(--color-wise-text)]',
                  'placeholder:text-[var(--color-wise-text-muted)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-wise-primary-text)] focus:border-[var(--color-wise-primary-text)]',
                )}
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="email-body"
                  className="text-[13px] font-[700] text-[var(--color-wise-text)]"
                >
                  Email Body (HTML supported)
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview((p) => !p)}
                  className={cn(
                    'flex items-center gap-1.5 text-[12px] font-[600] text-[var(--color-wise-primary-text)]',
                    'hover:text-[var(--color-wise-text)] transition-colors bg-transparent border-none cursor-pointer',
                  )}
                >
                  {showPreview
                    ? <><EyeOff size={13} aria-hidden="true" /> Hide Preview</>
                    : <><Eye size={13} aria-hidden="true" /> Preview</>
                  }
                </button>
              </div>

              <div className={cn('grid gap-4', showPreview && 'grid-cols-1 lg:grid-cols-2')}>
                <textarea
                  id="email-body"
                  value={form.body}
                  onChange={(e) => handleField('body', e.target.value)}
                  placeholder="Write your email content here. HTML tags are supported."
                  required
                  rows={10}
                  className={cn(
                    'w-full px-4 py-3 rounded-[10px] text-[14px] resize-y font-mono',
                    'border border-[var(--color-wise-ring-strong)] bg-[var(--color-wise-canvas)] text-[var(--color-wise-text)]',
                    'placeholder:text-[var(--color-wise-text-muted)] placeholder:font-sans',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--color-wise-primary-text)] focus:border-[var(--color-wise-primary-text)]',
                  )}
                />

                {showPreview && (
                  <div
                    className={cn(
                      'rounded-[10px] border border-[var(--color-wise-ring-strong)] bg-white p-5',
                      'text-[14px] text-[var(--color-wise-text)] leading-relaxed overflow-auto max-h-[300px]',
                      'prose prose-sm max-w-none',
                    )}
                    aria-label="Email preview"
                    dangerouslySetInnerHTML={{ __html: form.body || '<em style="color:var(--color-wise-text-muted)">Preview will appear here…</em>' }}
                  />
                )}
              </div>
            </div>

            {/* Send button */}
            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={isSending || !form.subject.trim() || !form.body.trim()}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-full',
                  'bg-[var(--color-wise-text)] text-white text-[14px] font-[700]',
                  'hover:opacity-90 transition-opacity border-none cursor-pointer',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <Send size={15} aria-hidden="true" />
                {isSending ? 'Sending…' : 'Send Email'}
              </button>

              {!showPreview && form.body && (
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className={cn(
                    'flex items-center gap-1.5 px-5 py-3 rounded-full text-[14px] font-[600]',
                    'border border-[var(--color-wise-ring-strong)] text-[var(--color-wise-text)]',
                    'hover:bg-[var(--color-wise-surface-soft)] transition-colors bg-transparent cursor-pointer',
                  )}
                >
                  <Eye size={14} aria-hidden="true" />
                  Preview
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Email log */}
        <div className="bg-white rounded-[20px] shadow-[var(--color-wise-ring)_0_0_0_1px] overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--color-wise-ring)]">
            <h2 className="text-[16px] font-[700] text-[var(--color-wise-text)]">Send History</h2>
          </div>
          {logsLoading ? (
            <div className="py-10 text-center text-[14px] text-[var(--color-wise-text-muted)] animate-pulse">
              Loading logs…
            </div>
          ) : (
            <EmailLogTable logs={logs} />
          )}
        </div>
      </div>

      <Toast state={toast} onDismiss={() => setToast(null)} />
    </AdminShell>
  )
}
