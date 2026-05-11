// Live Sessions tab — Sprint 2 Story 11.
//
// API-backed. When no cohortId is set (draft course) we render an empty
// state with guidance, matching the Pricing tab's behaviour. CRUD is done
// via a shared Schedule modal that also handles edit (prefilled), plus a
// ConfirmDialog for the destructive Cancel action.

import { useState } from 'react'
import { Plus, Calendar } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdminLiveSessions,
  createAdminLiveSession,
  updateAdminLiveSession,
  deleteAdminLiveSession,
  type AdminLiveSession,
  type CreateLiveSessionPayload,
} from '../../../lib/api'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { FormField } from '../../../components/ui/FormField'
import { Modal } from '../../../components/ui/Modal'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { EmptyState } from '../../../components/ui/EmptyState'
import { STALE_TIME } from '../../../lib/queryConfig'
import { cn } from '../../../lib/utils'

// Derive a display status from scheduledAt + durationMinutes since the
// back-end stores absolute dates only. LIVE = within the session window.
function deriveSessionStatus(
  scheduledAt: string,
  durationMinutes: number,
  now: Date = new Date(),
): 'LIVE' | 'UPCOMING' | 'PAST' {
  const start = new Date(scheduledAt).getTime()
  const end = start + durationMinutes * 60_000
  const t = now.getTime()
  if (t < start) return 'UPCOMING'
  if (t <= end) return 'LIVE'
  return 'PAST'
}

interface LiveSessionFormState {
  title: string
  scheduledAt: string
  durationMinutes: string
  zoomUrl: string
}

function blankSessionForm(): LiveSessionFormState {
  return { title: '', scheduledAt: '', durationMinutes: '90', zoomUrl: '' }
}

function sessionToForm(s: AdminLiveSession): LiveSessionFormState {
  // HTML `datetime-local` expects `YYYY-MM-DDTHH:mm` in local time. Convert
  // the stored ISO by trimming seconds/ms and Z suffix after shifting to the
  // browser's local zone (matches the datetime-local control's contract).
  const d = new Date(s.scheduledAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const localValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  return {
    title: s.title,
    scheduledAt: localValue,
    durationMinutes: String(s.durationMinutes),
    zoomUrl: s.zoomUrl,
  }
}

export function LiveSessionsTab({
  cohortId,
  isAdmin,
  addToast,
}: {
  cohortId: string | null
  isAdmin: boolean
  addToast: (message: string, variant: 'success' | 'error') => void
}) {
  const queryClient = useQueryClient()
  const sessionsKey = ['admin', 'courses', cohortId ?? '__draft__', 'sessions'] as const

  const [modalOpen, setModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<AdminLiveSession | null>(null)
  const [form, setForm] = useState<LiveSessionFormState>(blankSessionForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingSession, setDeletingSession] = useState<AdminLiveSession | null>(null)

  const {
    data: sessions = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: sessionsKey,
    queryFn: () => fetchAdminLiveSessions(cohortId as string),
    enabled: Boolean(cohortId),
    staleTime: STALE_TIME.medium,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateLiveSessionPayload) =>
      createAdminLiveSession(cohortId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKey })
      addToast('Session scheduled', 'success')
      setModalOpen(false)
      setForm(blankSessionForm())
    },
    onError: (err: Error) => {
      setFormError(err.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (args: { sessionId: string; payload: CreateLiveSessionPayload }) =>
      updateAdminLiveSession(cohortId as string, args.sessionId, args.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKey })
      addToast('Session updated', 'success')
      setModalOpen(false)
      setEditingSession(null)
      setForm(blankSessionForm())
    },
    onError: (err: Error) => {
      setFormError(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteAdminLiveSession(cohortId as string, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKey })
      addToast('Session cancelled', 'success')
      setDeletingSession(null)
    },
    onError: (err: Error) => {
      addToast(err.message, 'error')
    },
  })

  function openScheduleModal() {
    setEditingSession(null)
    setForm(blankSessionForm())
    setFormError(null)
    setModalOpen(true)
  }

  function openEditModal(s: AdminLiveSession) {
    setEditingSession(s)
    setForm(sessionToForm(s))
    setFormError(null)
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.title.trim()) {
      setFormError('Title is required')
      return
    }
    if (!form.scheduledAt) {
      setFormError('Scheduled date/time is required')
      return
    }
    if (!form.zoomUrl.trim()) {
      setFormError('Zoom URL is required')
      return
    }
    const duration = Number(form.durationMinutes)
    if (!Number.isFinite(duration) || duration < 1) {
      setFormError('Duration must be at least 1 minute')
      return
    }
    const payload: CreateLiveSessionPayload = {
      title: form.title.trim(),
      // `datetime-local` values are local; convert to ISO via Date.
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      durationMinutes: duration,
      zoomUrl: form.zoomUrl.trim(),
    }
    if (editingSession) {
      updateMutation.mutate({ sessionId: editingSession.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const statusStyles: Record<string, string> = {
    LIVE: 'bg-[#fdeaeb] text-[#d03238]',
    UPCOMING: 'bg-[#e8f4fd] text-[#1a2744]',
    PAST: 'bg-[#e6f4ec] text-[#054d28]',
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  // Draft mode (no saved cohort yet)
  if (!cohortId) {
    return (
      <div className="px-8 py-6">
        <EmptyState
          icon={Calendar}
          title="Save the course first"
          description="Live sessions are attached to a saved course. Save the draft on the Overview tab to start scheduling sessions."
        />
      </div>
    )
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-[700] text-[#1a2744]">Live Sessions</h3>
        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} aria-hidden="true" />}
            onClick={openScheduleModal}
          >
            Schedule Session
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="py-10">
          <LoadingSpinner centered label="Loading live sessions" />
        </div>
      )}

      {isError && (
        <div className="p-6 text-center text-[13px] text-[#d03238]">
          Failed to load live sessions. Try refreshing.
        </div>
      )}

      {!isLoading && !isError && sessions.length === 0 && (
        <EmptyState
          icon={Calendar}
          title="No live sessions yet"
          description="Schedule the first session for this cohort."
          action={
            isAdmin
              ? { label: 'Schedule Session', onClick: openScheduleModal }
              : undefined
          }
        />
      )}

      {!isLoading && !isError && sessions.length > 0 && (
        <div className="bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden">
          <table className="w-full border-collapse" aria-label="Live sessions">
            <thead>
              <tr>
                {['Title', 'Date & Time', 'Duration', 'Zoom Link', 'Status', 'Actions'].map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="text-left text-[12px] font-[600] text-[#717182] px-5 py-3 border-b border-[rgba(26,39,68,0.08)] uppercase tracking-[0.5px] bg-[#f8f9fb]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const status = deriveSessionStatus(
                  session.scheduledAt,
                  session.durationMinutes,
                )
                return (
                  <tr key={session.id} className="hover:[&>td]:bg-[#f8f9fb] transition-colors">
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[14px] font-[600] text-[#1a2744]">
                      {session.title}
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]">
                      {new Date(session.scheduledAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)] text-[13px] text-[#717182]">
                      {session.durationMinutes}m
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                      <span className="text-[13px] text-[#717182] font-mono truncate max-w-[180px] block overflow-hidden text-ellipsis whitespace-nowrap">
                        {session.zoomUrl}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                      <span className={cn('text-[11px] font-[600] px-[9px] py-[3px] rounded-full', statusStyles[status])}>
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 border-b border-[rgba(26,39,68,0.04)]">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="text-[13px] font-[600] text-[#4a9ad4] hover:underline"
                          onClick={() => openEditModal(session)}
                          disabled={!isAdmin}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-[13px] font-[600] text-[#d03238] hover:underline"
                          onClick={() => setDeletingSession(session)}
                          disabled={!isAdmin}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule / Edit session modal */}
      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setModalOpen(false)
            setEditingSession(null)
            setFormError(null)
          }
        }}
        title={editingSession ? 'Edit Session' : 'Schedule Session'}
        description="Add the session details. Students enrolled in this cohort will see the session in their live sessions list."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false)
                setEditingSession(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="live-session-form"
              isLoading={isSaving}
            >
              {editingSession ? 'Save Changes' : 'Schedule Session'}
            </Button>
          </>
        }
      >
        <form
          id="live-session-form"
          onSubmit={handleSubmit}
          className={cn('flex flex-col gap-4')}
        >
          <FormField id="session-title" label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Week 1: Kickoff"
            />
          </FormField>
          <FormField id="session-scheduled" label="Scheduled at" required>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </FormField>
          <FormField
            id="session-duration"
            label="Duration (minutes)"
            required
          >
            <Input
              type="number"
              min={1}
              value={form.durationMinutes}
              onChange={(e) =>
                setForm({ ...form, durationMinutes: e.target.value })
              }
            />
          </FormField>
          <FormField id="session-zoom" label="Zoom URL" required>
            <Input
              type="url"
              value={form.zoomUrl}
              onChange={(e) => setForm({ ...form, zoomUrl: e.target.value })}
              placeholder="https://zoom.us/j/…"
            />
          </FormField>
          {formError && (
            <p
              role="alert"
              className="text-[12px] font-semibold text-[var(--color-wise-danger)]"
            >
              {formError}
            </p>
          )}
        </form>
      </Modal>

      {/* Cancel-session confirm dialog */}
      <ConfirmDialog
        open={Boolean(deletingSession)}
        onOpenChange={(open) => {
          if (!open) setDeletingSession(null)
        }}
        title="Cancel this session?"
        description={
          deletingSession
            ? `This will remove "${deletingSession.title}" from the cohort's live sessions list. Students enrolled will no longer see it.`
            : ''
        }
        confirmLabel="Cancel session"
        cancelLabel="Keep"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (deletingSession) {
            await deleteMutation.mutateAsync(deletingSession.id)
          }
        }}
      />
    </div>
  )
}
