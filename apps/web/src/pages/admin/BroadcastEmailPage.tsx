// FIR-167 — Admin broadcast email compose UI with send history log
import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Mail, Send, Eye, EyeOff } from 'lucide-react'
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
        state.type === 'success' ? 'bg-[#1a2744] text-white' : 'bg-[#fdeaeb] text-[#d03238]',
      )}
    >
      {state.type === 'success' ? '✓ ' : '✕ '}
      {state.message}
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
      <div className="text-center py-10 text-[14px] text-[#717182]">
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
                className="text-left text-[12px] font-[700] text-[#717182] uppercase tracking-[0.5px] px-5 py-2.5 border-b border-[rgba(26,39,68,0.08)]"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="hover:[&>td]:bg-[#f8f9fb]">
              <td className="px-5 py-3 border-b border-[rgba(26,39,68,0.04)] text-[13px]">
                <span className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-[700]',
                  log.target === 'all'
                    ? 'bg-[#eef6fd] text-[#4a9ad4]'
                    : 'bg-[#fff8e6] text-[#8a5a00]',
                )}>
                  {log.target === 'all' ? 'All Students' : log.target}
                </span>
              </td>
              <td className="px-5 py-3 border-b border-[rgba(26,39,68,0.04)] text-[14px] text-[#1a2744] font-[500] max-w-[240px] truncate">
                {log.subject}
              </td>
              <td className="px-5 py-3 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]">
                {formatDate(log.sentAt)}
              </td>
              <td className="px-5 py-3 border-b border-[rgba(26,39,68,0.04)] text-[14px] font-[700] text-[#1a2744]">
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
        <Mail size={16} className="text-[#717182]" aria-hidden="true" />
        <span className="text-[13px] text-[#717182] font-[500]">
          {(logsData?.total ?? 0).toLocaleString()} emails sent
        </span>
      </div>
    }>
      <div className="p-6 lg:p-8 max-w-[900px]">
        {/* Compose form */}
        <div className="bg-white rounded-[20px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] mb-8 overflow-hidden">
          <div className="px-6 py-5 border-b border-[rgba(26,39,68,0.08)]">
            <h2 className="text-[16px] font-[700] text-[#1a2744]">Compose Email</h2>
            <p className="text-[13px] text-[#717182] mt-0.5">
              Send a broadcast email to all students or a specific cohort.
            </p>
          </div>

          <form onSubmit={handleSend} className="p-6 space-y-5">
            {/* Target audience */}
            <div>
              <label className="block text-[13px] font-[700] text-[#1a2744] mb-2">
                Target Audience
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-[12px] border cursor-pointer transition-colors flex-1',
                  form.target === 'all'
                    ? 'border-[#4a9ad4] bg-[#eef6fd]'
                    : 'border-[rgba(26,39,68,0.12)] hover:bg-[#f8f9fb]',
                )}>
                  <input
                    type="radio"
                    name="target"
                    value="all"
                    checked={form.target === 'all'}
                    onChange={() => handleField('target', 'all')}
                    className="accent-[#4a9ad4]"
                  />
                  <span className="text-[14px] font-[600] text-[#1a2744]">All Students</span>
                </label>
                <label className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-[12px] border cursor-pointer transition-colors flex-1',
                  form.target !== 'all'
                    ? 'border-[#4a9ad4] bg-[#eef6fd]'
                    : 'border-[rgba(26,39,68,0.12)] hover:bg-[#f8f9fb]',
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
                    className="accent-[#4a9ad4]"
                  />
                  <span className="text-[14px] font-[600] text-[#1a2744]">Specific Cohort</span>
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
                      'border border-[rgba(26,39,68,0.15)] bg-[#f8f9fb] text-[#1a2744]',
                      'focus:outline-none focus:ring-2 focus:ring-[#4a9ad4]',
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
                className="block text-[13px] font-[700] text-[#1a2744] mb-2"
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
                  'border border-[rgba(26,39,68,0.15)] bg-[#f8f9fb] text-[#1a2744]',
                  'placeholder:text-[#a3a3a3]',
                  'focus:outline-none focus:ring-2 focus:ring-[#4a9ad4] focus:border-[#4a9ad4]',
                )}
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="email-body"
                  className="text-[13px] font-[700] text-[#1a2744]"
                >
                  Email Body (HTML supported)
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview((p) => !p)}
                  className={cn(
                    'flex items-center gap-1.5 text-[12px] font-[600] text-[#4a9ad4]',
                    'hover:text-[#1a2744] transition-colors bg-transparent border-none cursor-pointer',
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
                    'border border-[rgba(26,39,68,0.15)] bg-[#f8f9fb] text-[#1a2744]',
                    'placeholder:text-[#a3a3a3] placeholder:font-sans',
                    'focus:outline-none focus:ring-2 focus:ring-[#4a9ad4] focus:border-[#4a9ad4]',
                  )}
                />

                {showPreview && (
                  <div
                    className={cn(
                      'rounded-[10px] border border-[rgba(26,39,68,0.15)] bg-white p-5',
                      'text-[14px] text-[#1a2744] leading-relaxed overflow-auto max-h-[300px]',
                      'prose prose-sm max-w-none',
                    )}
                    aria-label="Email preview"
                    dangerouslySetInnerHTML={{ __html: form.body || '<em style="color:#a3a3a3">Preview will appear here…</em>' }}
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
                  'bg-[#1a2744] text-white text-[14px] font-[700]',
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
                    'border border-[rgba(26,39,68,0.15)] text-[#1a2744]',
                    'hover:bg-[#f0f0f0] transition-colors bg-transparent cursor-pointer',
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
        <div className="bg-white rounded-[20px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden">
          <div className="px-6 py-5 border-b border-[rgba(26,39,68,0.08)]">
            <h2 className="text-[16px] font-[700] text-[#1a2744]">Send History</h2>
          </div>
          {logsLoading ? (
            <div className="py-10 text-center text-[14px] text-[#717182] animate-pulse">
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
