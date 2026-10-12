'use client'
// PBA-132 — Admin Communications / Broadcast Messages page
// PBA-237 — PermissionGate applied to send action
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Send, Clock, ChevronLeft, ChevronRight, Users, Mail, Search, X, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import {
  useBroadcastMessage,
  useMessageHistory,
  type BroadcastMessagePayload,
  type MessageStatus,
} from '@/hooks/use-admin-messages'
import { useAdminCohorts } from '@/hooks/use-admin-cohorts'
import { useAdminStudents, type AdminStudent } from '@/hooks/use-admin-students'
import { PermissionGate } from '@/components/ui/permission-gate'

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MessageStatus }) {
  const map: Record<MessageStatus, { variant: 'success' | 'destructive' | 'warning'; label: string }> = {
    SENT: { variant: 'success', label: 'Sent' },
    FAILED: { variant: 'destructive', label: 'Failed' },
    PENDING: { variant: 'warning', label: 'Pending' },
  }
  const cfg = map[status] ?? { variant: 'outline' as const, label: status }
  return <Badge variant={cfg.variant as Parameters<typeof Badge>[0]['variant']}>{cfg.label}</Badge>
}

// ── Recipient type toggle ─────────────────────────────────────────────────────

interface RecipientToggleProps {
  value: 'COHORT' | 'INDIVIDUAL'
  onChange: (v: 'COHORT' | 'INDIVIDUAL') => void
}

function RecipientToggle({ value, onChange }: RecipientToggleProps) {
  return (
    <div
      role="group"
      aria-label="Recipient type"
      className="inline-flex rounded-lg border border-border bg-muted p-1 gap-1"
    >
      {(['COHORT', 'INDIVIDUAL'] as const).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === type
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-pressed={value === type}
        >
          {type === 'COHORT' ? (
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {type === 'COHORT' ? 'Cohort' : 'Individual Student'}
        </button>
      ))}
    </div>
  )
}

// ── Student search combobox ───────────────────────────────────────────────────

interface StudentSearchComboboxProps {
  value: string         // the email stored in the form field
  onSelect: (student: AdminStudent) => void
  onClear: () => void
  error?: boolean
}

function StudentSearchCombobox({ value, onSelect, onClear, error }: StudentSearchComboboxProps) {
  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const { data, isFetching } = useAdminStudents(
    debouncedQuery.length >= 1 ? { q: debouncedQuery, limit: 8 } : {},
  )
  const students = data?.students ?? []

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // If a student is already selected (value set), show their email in a chip
  if (value) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 h-9 rounded-md border bg-input-background px-3 text-sm',
          error ? 'border-destructive' : 'border-border',
        )}
      >
        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-foreground">{value}</span>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Clear selected student"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="text"
          placeholder="Search by name or email…"
          value={query}
          aria-invalid={error}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="pl-8"
        />
      </div>

      {open && (query.length >= 1 || students.length > 0) && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          {isFetching && students.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Searching…</div>
          ) : students.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">No students found</div>
          ) : (
            <ul role="listbox" className="max-h-60 overflow-y-auto divide-y divide-border">
              {students.map((s) => (
                <li key={s.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault() // prevent input blur before click registers
                      onSelect(s)
                      setQuery('')
                      setOpen(false)
                    }}
                  >
                    {s.avatarUrl ? (
                      <img src={s.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {s.firstName[0]}{s.lastName[0]}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.firstName} {s.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    </div>
                    {s.cohort && (
                      <span className="text-xs text-muted-foreground shrink-0">{s.cohort.name}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Form types ────────────────────────────────────────────────────────────────

interface MessageFormValues {
  recipientType: 'COHORT' | 'INDIVIDUAL'
  cohortId: string
  recipientEmail: string
  subject: string
  body: string
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const [historyPage, setHistoryPage] = React.useState(1)
  const HISTORY_LIMIT = 10

  const { mutateAsync: broadcastMessage, isPending: sending } = useBroadcastMessage()
  const { data: cohortsData, isLoading: cohortsLoading } = useAdminCohorts()
  const { data: historyData, isLoading: historyLoading } = useMessageHistory(historyPage, HISTORY_LIMIT)

  const cohorts = cohortsData ?? []

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<MessageFormValues>({
    defaultValues: {
      recipientType: 'COHORT',
      cohortId: '',
      recipientEmail: '',
      subject: '',
      body: '',
    },
  })

  const recipientType = watch('recipientType')
  const selectedCohortId = watch('cohortId')

  const onSubmit = async (values: MessageFormValues) => {
    try {
      const payload: BroadcastMessagePayload = {
        recipientType: values.recipientType,
        subject: values.subject,
        body: values.body,
        ...(values.recipientType === 'COHORT'
          ? { cohortId: values.cohortId }
          : { recipientEmail: values.recipientEmail }),
      }
      await broadcastMessage(payload)
      toast.success('Message sent successfully')
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message')
    }
  }

  const totalPages = historyData?.totalPages ?? 1

  return (
    <div data-slot="admin-messages-page" className="space-y-6">

      {/* Page heading */}
      <div>
        <h2 className="text-xl font-medium text-foreground">Communications</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Send messages to cohorts or individual students.
        </p>
      </div>

      {/* Broadcast form — only visible to users with messages:send permission */}
      <PermissionGate permission="messages:send">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" aria-hidden="true" />
            Broadcast Message
          </CardTitle>
          <CardDescription>
            Compose and send a message to a cohort or a single student.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

            {/* Recipient type toggle */}
            <div className="space-y-1.5">
              <Label>Send to</Label>
              <div>
                <RecipientToggle
                  value={recipientType}
                  onChange={(v) => {
                    setValue('recipientType', v)
                    setValue('cohortId', '')
                    setValue('recipientEmail', '')
                  }}
                />
              </div>
            </div>

            {/* Recipient selector */}
            {recipientType === 'COHORT' ? (
              <div className="space-y-1.5">
                <Label htmlFor="cohortId">Cohort</Label>
                <Select
                  value={selectedCohortId}
                  onValueChange={(v) => setValue('cohortId', v)}
                  disabled={cohortsLoading}
                >
                  <SelectTrigger id="cohortId" aria-invalid={Boolean(errors.cohortId)}>
                    <SelectValue placeholder={cohortsLoading ? 'Loading cohorts…' : 'Select a cohort'} />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* hidden input for RHF validation */}
                <input
                  type="hidden"
                  {...register('cohortId', {
                    validate: (v) =>
                      recipientType !== 'COHORT' || Boolean(v) || 'Please select a cohort',
                  })}
                />
                {errors.cohortId && (
                  <p className="text-xs text-destructive mt-1">{errors.cohortId.message}</p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Student</Label>
                {/* hidden input keeps RHF validation working */}
                <input
                  type="hidden"
                  {...register('recipientEmail', {
                    validate: (v) =>
                      recipientType !== 'INDIVIDUAL' || Boolean(v.trim()) || 'Please select a student',
                  })}
                />
                <StudentSearchCombobox
                  value={watch('recipientEmail')}
                  onSelect={(student) => setValue('recipientEmail', student.email)}
                  onClear={() => setValue('recipientEmail', '')}
                  error={Boolean(errors.recipientEmail)}
                />
                {errors.recipientEmail && (
                  <p className="text-xs text-destructive mt-1">{errors.recipientEmail.message}</p>
                )}
              </div>
            )}

            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="e.g. Week 3 reminder"
                aria-invalid={Boolean(errors.subject)}
                {...register('subject', { required: 'Subject is required' })}
              />
              {errors.subject && (
                <p className="text-xs text-destructive mt-1">{errors.subject.message}</p>
              )}
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Write your message here…"
                className="min-h-[140px]"
                aria-invalid={Boolean(errors.body)}
                {...register('body', { required: 'Message body is required' })}
              />
              {errors.body && (
                <p className="text-xs text-destructive mt-1">{errors.body.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </PermissionGate>

      {/* Message history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Message History
              </CardTitle>
              <CardDescription className="mt-1">
                Previously sent messages and their delivery status.
              </CardDescription>
            </div>
            {!historyLoading && historyData && (
              <span className="text-xs text-muted-foreground shrink-0">
                {historyData.total} message{historyData.total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-0 pt-0 pb-0">
          {historyLoading ? (
            <div className="px-6 pb-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-56 flex-1" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : !historyData || historyData.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[160px] text-center px-6 pb-6">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
                <Clock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground">No messages sent yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sent messages will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Message history">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2.5 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground">Recipient</th>
                      <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Subject</th>
                      <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-muted-foreground">Sent At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.messages.map((msg) => (
                      <tr
                        key={msg.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 pl-6 pr-3">
                          <div className="flex items-center gap-2">
                            {msg.recipientType === 'COHORT' ? (
                              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                            ) : (
                              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                            )}
                            <span className="text-sm text-foreground truncate max-w-[200px]">
                              {msg.recipientLabel}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm text-foreground truncate max-w-[260px] block">
                            {msg.subject}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={msg.status} />
                        </td>
                        <td className="py-3 pl-3 pr-6 text-right text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(msg.sentAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Page {historyPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage <= 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                      disabled={historyPage >= totalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
