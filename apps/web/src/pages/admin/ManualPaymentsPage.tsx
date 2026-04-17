// FIR-50 — Admin manual payment review queue
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchManualPayments,
  approveManualPayment,
  rejectManualPayment,
  type ManualPaymentRequest,
} from '../../lib/api'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ITEMS_PER_PAGE = 20
const MIN_REJECTION_REASON_LEN = 10

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getAvatarInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #4a9ad4, #1a2744)',
  'linear-gradient(135deg, #cc4a00, #ff8c5a)',
  'linear-gradient(135deg, #054d28, #16a34a)',
  'linear-gradient(135deg, #7c3aed, #4a9ad4)',
  'linear-gradient(135deg, #d97706, #f59e0b)',
]

function getAvatarGradient(name: string): string {
  const index = name.charCodeAt(0) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[index]
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusTab = 'PENDING' | 'APPROVED' | 'REJECTED'

interface ModalState {
  type: 'approve' | 'reject' | 'lightbox' | null
  request: ManualPaymentRequest | null
}

// ---------------------------------------------------------------------------
// Toast — lightweight inline toast, no external dep needed
// ---------------------------------------------------------------------------
interface ToastMessage {
  id: string
  message: string
  variant: 'success' | 'error'
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 rounded-[14px]',
        'shadow-[rgba(26,39,68,0.2)_0_4px_20px] text-[14px] font-semibold',
        'animate-[slideUp_0.2s_ease-out]',
        toast.variant === 'success'
          ? 'bg-[#e6f4ec] text-[#054d28] border border-[rgba(5,77,40,0.15)]'
          : 'bg-[#fdeaeb] text-[#d03238] border border-[rgba(208,50,56,0.15)]',
      )}
    >
      <span aria-hidden="true">{toast.variant === 'success' ? '✓' : '✗'}</span>
      {toast.message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SkeletonCard — loading state
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div
      className="bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden"
      aria-hidden="true"
    >
      <div className="flex items-start gap-4 p-5">
        <div className="w-20 h-20 rounded-[12px] bg-[#e8ecf4] animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2.5 pt-1">
          <div className="h-4 bg-[#e8ecf4] rounded animate-pulse w-1/3" />
          <div className="h-3 bg-[#e8ecf4] rounded animate-pulse w-1/4" />
          <div className="h-3 bg-[#e8ecf4] rounded animate-pulse w-2/5" />
          <div className="h-3 bg-[#e8ecf4] rounded animate-pulse w-1/5" />
        </div>
      </div>
      <div className="border-t border-[rgba(26,39,68,0.06)] px-5 py-3.5 flex gap-3">
        <div className="h-9 w-28 bg-[#e8ecf4] rounded-full animate-pulse" />
        <div className="h-9 w-24 bg-[#e8ecf4] rounded-full animate-pulse" />
        <div className="h-9 w-32 bg-[#e8ecf4] rounded-full animate-pulse ml-auto" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QueueCard — individual manual payment request card
// ---------------------------------------------------------------------------
interface QueueCardProps {
  request: ManualPaymentRequest
  onApprove: (r: ManualPaymentRequest) => void
  onReject: (r: ManualPaymentRequest) => void
  onViewReceipt: (r: ManualPaymentRequest) => void
  isRemoving: boolean
}

function QueueCard({ request, onApprove, onReject, onViewReceipt, isRemoving }: QueueCardProps) {
  const { student, cohort, amount, createdAt, note, status } = request

  return (
    <div
      className={cn(
        'bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px] overflow-hidden',
        'transition-all duration-300',
        isRemoving && 'opacity-0 scale-95 pointer-events-none',
      )}
    >
      <div className="flex items-start gap-4 p-5">
        {/* Receipt thumbnail */}
        <button
          type="button"
          onClick={() => onViewReceipt(request)}
          aria-label={`View receipt from ${student.name}`}
          className={cn(
            'w-20 h-20 rounded-[12px] bg-[#e8ecf4] flex-shrink-0',
            'flex items-center justify-center text-[28px] cursor-pointer',
            'hover:opacity-80 transition-opacity border-none',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4a9ad4]/40',
          )}
        >
          📄
        </button>

        <div className="flex-1 min-w-0">
          {/* Student */}
          <div className="flex items-center gap-2.5 mb-0.5">
            {student.avatarUrl ? (
              <img
                src={student.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[13px] font-bold"
                style={{ background: getAvatarGradient(student.name) }}
                aria-hidden="true"
              >
                {getAvatarInitial(student.name)}
              </div>
            )}
            <span className="text-[16px] font-bold text-[#1a2744]">{student.name}</span>
          </div>
          <div className="text-[13px] text-[#717182] mb-1">{student.email}</div>

          {/* Cohort + amount */}
          <div className="text-[13px] font-semibold text-[#4a9ad4] mb-1">
            {cohort.name}
            {amount != null && ` · ${formatMoney(amount)}`}
          </div>

          <div className="text-[12px] text-[#a3a3a3]">{formatRelativeTime(createdAt)}</div>

          {/* Note */}
          {note && (
            <div
              className={cn(
                'mt-2 text-[13px] italic text-[#717182]',
                'bg-[#f8f9fb] rounded-[8px] px-2.5 py-2',
              )}
            >
              "{note}"
            </div>
          )}
        </div>

        {/* Status badge for non-PENDING items */}
        {status !== 'PENDING' && (
          <div
            className={cn(
              'flex-shrink-0 text-[11px] font-bold px-3 py-1 rounded-full',
              status === 'APPROVED'
                ? 'bg-[#e6f4ec] text-[#054d28]'
                : 'bg-[#fdeaeb] text-[#d03238]',
            )}
          >
            {status}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        className={cn(
          'border-t border-[rgba(26,39,68,0.06)] px-5 py-3.5',
          'flex items-center gap-3',
        )}
      >
        {status === 'PENDING' && (
          <>
            <button
              type="button"
              onClick={() => onApprove(request)}
              className={cn(
                'flex items-center gap-1.5 px-5 py-2.5 rounded-full',
                'bg-[#4a9ad4] text-[#0d1a3a] text-[14px] font-bold border-none cursor-pointer',
                'hover:opacity-90 transition-opacity',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4a9ad4]/40',
              )}
            >
              ✓ Approve
            </button>
            <button
              type="button"
              onClick={() => onReject(request)}
              className={cn(
                'px-5 py-2.5 rounded-full',
                'bg-transparent border-2 border-[rgba(208,50,56,0.3)]',
                'text-[#d03238] text-[14px] font-bold cursor-pointer',
                'hover:bg-[#fdeaeb] transition-colors',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300/40',
              )}
            >
              ✗ Reject
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onViewReceipt(request)}
          className={cn(
            'px-4.5 py-2.5 rounded-full',
            'bg-[#f0f0f0] text-[#717182] text-[13px] font-semibold border-none cursor-pointer',
            'hover:bg-[#e8ecf4] transition-colors ml-auto',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(26,39,68,0.2)]',
          )}
        >
          View Receipt 🔍
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ApproveModal
// ---------------------------------------------------------------------------
interface ApproveModalProps {
  request: ManualPaymentRequest
  onConfirm: (note: string) => void
  onCancel: () => void
  isLoading: boolean
}

function ApproveModal({ request, onConfirm, onCancel, isLoading }: ApproveModalProps) {
  const [approveNote, setApproveNote] = useState('')

  // Trap focus and close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <ModalOverlay onClose={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-modal-title"
        className="bg-white rounded-[20px] w-full max-w-[440px] overflow-hidden shadow-[rgba(26,39,68,0.2)_0_8px_30px]"
      >
        {/* Header */}
        <div className="bg-[#e6f4ec] px-7 py-5 flex items-center gap-3">
          <span className="text-[24px]" aria-hidden="true">✅</span>
          <h2 id="approve-modal-title" className="text-[17px] font-extrabold text-[#054d28]">
            Approve Payment
          </h2>
        </div>

        {/* Body */}
        <div className="px-7 py-5">
          <p className="text-[14px] text-[#717182] leading-relaxed mb-4">
            Confirm approval for <strong className="text-[#1a2744]">{request.student.name}</strong>?
            <br />
            Course: <strong className="text-[#1a2744]">{request.cohort.name}</strong>
            {request.amount != null && (
              <>
                <br />
                Amount: <strong className="text-[#1a2744]">{formatMoney(request.amount)}</strong>
              </>
            )}
            <br />
            <br />
            This will immediately activate their enrollment and send a confirmation email.
          </p>

          <textarea
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            placeholder="Optional: Add an internal note..."
            rows={3}
            aria-label="Optional approval note"
            className={cn(
              'w-full rounded-[10px] border-[1.5px] border-[rgba(26,39,68,0.15)]',
              'px-3 py-2.5 text-[13px] text-[#1a2744] resize-none outline-none',
              'focus:border-[#4a9ad4] transition-colors',
            )}
          />
        </div>

        {/* Actions */}
        <div className="px-7 pb-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className={cn(
              'px-4.5 py-2.5 rounded-full bg-[#f0f0f0] text-[#717182]',
              'text-[13px] font-bold border-none cursor-pointer hover:bg-[#e8ecf4] transition-colors',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(approveNote)}
            disabled={isLoading}
            className={cn(
              'px-4.5 py-2.5 rounded-full bg-[#4a9ad4] text-[#0d1a3a]',
              'text-[13px] font-bold border-none cursor-pointer hover:opacity-90 transition-opacity',
              'flex items-center gap-2',
              isLoading && 'opacity-60 cursor-not-allowed',
            )}
          >
            {isLoading && (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-[rgba(13,26,58,0.3)] border-t-[#0d1a3a] animate-spin" />
            )}
            Confirm Approval
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ---------------------------------------------------------------------------
// RejectModal
// ---------------------------------------------------------------------------
interface RejectModalProps {
  request: ManualPaymentRequest
  onConfirm: (reason: string) => void
  onCancel: () => void
  isLoading: boolean
}

function RejectModal({ request, onConfirm, onCancel, isLoading }: RejectModalProps) {
  const [reason, setReason] = useState('')
  const isValid = reason.trim().length >= MIN_REJECTION_REASON_LEN

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <ModalOverlay onClose={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-modal-title"
        className="bg-white rounded-[20px] w-full max-w-[440px] overflow-hidden shadow-[rgba(26,39,68,0.2)_0_8px_30px]"
      >
        {/* Header */}
        <div className="bg-[#fdeaeb] px-7 py-5 flex items-center gap-3">
          <span className="text-[24px]" aria-hidden="true">⚠️</span>
          <h2 id="reject-modal-title" className="text-[17px] font-extrabold text-[#d03238]">
            Reject Receipt
          </h2>
        </div>

        {/* Body */}
        <div className="px-7 py-5">
          <p className="text-[14px] text-[#717182] leading-relaxed mb-3">
            Provide a reason for rejecting{' '}
            <strong className="text-[#1a2744]">{request.student.name}</strong>'s receipt. This
            will be sent to them via email.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Receipt shows wrong amount, or name doesn't match..."
            rows={3}
            aria-label="Rejection reason (required)"
            aria-required="true"
            className={cn(
              'w-full rounded-[10px] border-[1.5px] border-[rgba(26,39,68,0.15)]',
              'px-3 py-2.5 text-[13px] text-[#1a2744] resize-none outline-none mb-2',
              'focus:border-[#4a9ad4] transition-colors',
              !isValid && reason.length > 0 && 'border-[#d03238]',
            )}
          />
          {!isValid && reason.length > 0 && (
            <p className="text-[12px] text-[#d03238] mb-3" role="alert">
              Reason must be at least {MIN_REJECTION_REASON_LEN} characters.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-7 pb-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className={cn(
              'px-4.5 py-2.5 rounded-full bg-[#f0f0f0] text-[#717182]',
              'text-[13px] font-bold border-none cursor-pointer hover:bg-[#e8ecf4] transition-colors',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => isValid && onConfirm(reason.trim())}
            disabled={!isValid || isLoading}
            aria-disabled={!isValid || isLoading}
            className={cn(
              'px-4.5 py-2.5 rounded-full bg-[#d03238] text-white',
              'text-[13px] font-bold border-none cursor-pointer hover:opacity-90 transition-opacity',
              'flex items-center gap-2',
              (!isValid || isLoading) && 'opacity-50 cursor-not-allowed',
            )}
          >
            {isLoading && (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-white animate-spin" />
            )}
            Reject Receipt
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ---------------------------------------------------------------------------
// LightboxModal — full-size receipt preview
// ---------------------------------------------------------------------------
interface LightboxModalProps {
  request: ManualPaymentRequest
  onClose: () => void
  onApprove: (r: ManualPaymentRequest) => void
  onReject: (r: ManualPaymentRequest) => void
}

function LightboxModal({ request, onClose, onApprove, onReject }: LightboxModalProps) {
  const { receiptUrl, student, cohort, amount } = request
  const isPdf = receiptUrl?.toLowerCase().endsWith('.pdf')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <ModalOverlay onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt from ${student.name}`}
        className="bg-white rounded-[20px] w-full max-w-[640px] overflow-hidden shadow-[rgba(26,39,68,0.2)_0_8px_30px]"
      >
        {/* Student header */}
        <div className="px-6 py-4 border-b border-[rgba(26,39,68,0.08)] flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0"
            style={{ background: getAvatarGradient(student.name) }}
            aria-hidden="true"
          >
            {getAvatarInitial(student.name)}
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#1a2744]">{student.name}</div>
            <div className="text-[12px] text-[#717182]">
              {cohort.name}{amount != null ? ` · ${formatMoney(amount)}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt lightbox"
            className={cn(
              'ml-auto w-9 h-9 rounded-full bg-[#f0f0f0] flex items-center justify-center',
              'text-[#717182] text-[16px] border-none cursor-pointer hover:bg-[#e8ecf4] transition-colors',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(26,39,68,0.2)]',
            )}
          >
            ✕
          </button>
        </div>

        {/* Receipt display */}
        <div className="bg-[#1a2744] flex items-center justify-center min-h-[320px] relative">
          {receiptUrl ? (
            isPdf ? (
              <iframe
                src={receiptUrl}
                title="Payment receipt PDF"
                className="w-full h-[480px] border-none"
              />
            ) : (
              <img
                src={receiptUrl}
                alt={`Payment receipt from ${student.name}`}
                className="max-w-full max-h-[480px] rounded-[8px] object-contain"
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-3 text-white opacity-50">
              <span className="text-[56px]" aria-hidden="true">📄</span>
              <span className="text-[14px]">Receipt preview not available</span>
            </div>
          )}
        </div>

        {/* Actions — shortcut approve/reject from lightbox */}
        {request.status === 'PENDING' && (
          <div className="px-6 py-4 border-t border-[rgba(26,39,68,0.08)] flex items-center gap-3">
            <button
              type="button"
              onClick={() => { onClose(); onApprove(request) }}
              className={cn(
                'flex items-center gap-1.5 px-5 py-2.5 rounded-full',
                'bg-[#4a9ad4] text-[#0d1a3a] text-[14px] font-bold border-none cursor-pointer',
                'hover:opacity-90 transition-opacity',
              )}
            >
              ✓ Approve
            </button>
            <button
              type="button"
              onClick={() => { onClose(); onReject(request) }}
              className={cn(
                'px-5 py-2.5 rounded-full bg-transparent border-2',
                'border-[rgba(208,50,56,0.3)] text-[#d03238]',
                'text-[14px] font-bold cursor-pointer hover:bg-[#fdeaeb] transition-colors',
              )}
            >
              ✗ Reject
            </button>
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}

// ---------------------------------------------------------------------------
// ModalOverlay — shared backdrop
// ---------------------------------------------------------------------------
function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-[rgba(26,39,68,0.5)] backdrop-blur-sm',
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-modal="true"
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
interface PaginationProps {
  page: number
  total: number
  limit: number
  onPageChange: (p: number) => void
}

function Pagination({ page, total, limit, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={cn(
          'px-4 py-2 rounded-full text-[13px] font-semibold border-none cursor-pointer',
          'bg-white shadow-[rgba(26,39,68,0.12)_0_0_0_1px] text-[#1a2744]',
          'hover:bg-[#eef6fd] transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        ← Previous
      </button>
      <span className="text-[13px] text-[#717182] px-2">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={cn(
          'px-4 py-2 rounded-full text-[13px] font-semibold border-none cursor-pointer',
          'bg-white shadow-[rgba(26,39,68,0.12)_0_0_0_1px] text-[#1a2744]',
          'hover:bg-[#eef6fd] transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        Next →
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ManualPaymentsPage() {
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<StatusTab>('PENDING')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<ModalState>({ type: null, request: null })
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Reset page when tab changes
  function handleTabChange(tab: StatusTab) {
    setActiveTab(tab)
    setPage(1)
  }

  // ---- Query ----
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['admin', 'manual-payments', activeTab, page],
    queryFn: () => fetchManualPayments(activeTab, page),
    staleTime: 30_000,
  })

  // ---- Toast helpers ----
  const showToast = useCallback((message: string, variant: 'success' | 'error') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // ---- Approve mutation ----
  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      approveManualPayment(id, note),
    onSuccess: (_, { id }) => {
      // Fade out the card before invalidating
      setRemovingIds((prev) => new Set(prev).add(id))
      setTimeout(() => {
        setRemovingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        void queryClient.invalidateQueries({ queryKey: ['admin', 'manual-payments'] })
      }, 350)
      showToast('Payment approved — enrollment activated.', 'success')
      setModal({ type: null, request: null })
    },
    onError: (err) => {
      showToast(
        err instanceof Error ? err.message : 'Failed to approve payment.',
        'error',
      )
    },
  })

  // ---- Reject mutation ----
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectManualPayment(id, reason),
    onSuccess: (_, { id }) => {
      setRemovingIds((prev) => new Set(prev).add(id))
      setTimeout(() => {
        setRemovingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        void queryClient.invalidateQueries({ queryKey: ['admin', 'manual-payments'] })
      }, 350)
      showToast('Receipt rejected — student has been notified.', 'success')
      setModal({ type: null, request: null })
    },
    onError: (err) => {
      showToast(
        err instanceof Error ? err.message : 'Failed to reject receipt.',
        'error',
      )
    },
  })

  // ---- Modal openers ----
  function openApproveModal(r: ManualPaymentRequest) {
    setModal({ type: 'approve', request: r })
  }
  function openRejectModal(r: ManualPaymentRequest) {
    setModal({ type: 'reject', request: r })
  }
  function openLightbox(r: ManualPaymentRequest) {
    setModal({ type: 'lightbox', request: r })
  }
  function closeModal() {
    if (!approveMutation.isPending && !rejectMutation.isPending) {
      setModal({ type: null, request: null })
    }
  }

  // ---- Pending count badge ----
  const pendingCount = activeTab === 'PENDING' ? (data?.total ?? 0) : null

  const tabs: Array<{ label: string; value: StatusTab }> = [
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
  ]

  const emptyMessages: Record<StatusTab, string> = {
    PENDING: 'No pending receipts — all caught up!',
    APPROVED: 'No approved payments yet.',
    REJECTED: 'No rejected receipts.',
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Page header */}
      <div
        className={cn(
          'flex items-center justify-between px-8 py-6',
          'bg-white border-b border-[rgba(26,39,68,0.08)]',
        )}
      >
        <h1 className="text-[24px] font-extrabold text-[#1a2744]">Manual Payments</h1>
        {pendingCount !== null && pendingCount > 0 && (
          <span
            className={cn(
              'bg-[#fff8e6] text-[#8a5a00] text-[13px] font-bold',
              'px-3.5 py-1.5 rounded-full',
            )}
          >
            ⏳ {pendingCount} pending review
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="px-8 pt-5">
        <div className="flex gap-1 bg-[#e8ecf4] rounded-[14px] p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              aria-pressed={activeTab === tab.value}
              className={cn(
                'px-5 py-2 rounded-[11px] text-[14px] font-semibold border-none cursor-pointer',
                'transition-all duration-150',
                activeTab === tab.value
                  ? 'bg-white text-[#1a2744] shadow-[rgba(26,39,68,0.1)_0_1px_4px]'
                  : 'bg-transparent text-[#717182] hover:text-[#1a2744]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-5 flex flex-col gap-4">
        {/* Loading skeletons */}
        {isLoading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {/* Error state */}
        {isError && (
          <div
            className={cn(
              'bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px]',
              'px-8 py-14 text-center',
            )}
          >
            <div className="text-[48px] mb-4" aria-hidden="true">⚠️</div>
            <div className="text-[18px] font-bold text-[#1a2744] mb-2">Failed to load</div>
            <div className="text-[14px] text-[#717182]">
              {error instanceof Error ? error.message : 'Something went wrong. Please refresh.'}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && data?.requests.length === 0 && (
          <div
            className={cn(
              'bg-white rounded-[16px] shadow-[rgba(26,39,68,0.12)_0_0_0_1px]',
              'px-8 py-16 text-center',
            )}
          >
            <div className="text-[56px] mb-4" aria-hidden="true">
              {activeTab === 'PENDING' ? '✅' : activeTab === 'APPROVED' ? '🎉' : '📋'}
            </div>
            <div className="text-[22px] font-bold text-[#1a2744] mb-1.5">
              {activeTab === 'PENDING' ? 'All caught up!' : 'Nothing here yet'}
            </div>
            <div className="text-[15px] text-[#717182]">{emptyMessages[activeTab]}</div>
          </div>
        )}

        {/* Queue cards */}
        {!isLoading &&
          !isError &&
          data?.requests.map((request) => (
            <QueueCard
              key={request.id}
              request={request}
              onApprove={openApproveModal}
              onReject={openRejectModal}
              onViewReceipt={openLightbox}
              isRemoving={removingIds.has(request.id)}
            />
          ))}

        {/* Pagination */}
        {!isLoading && !isError && data && (
          <Pagination
            page={page}
            total={data.total}
            limit={ITEMS_PER_PAGE}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Modals */}
      {modal.type === 'approve' && modal.request && (
        <ApproveModal
          request={modal.request}
          isLoading={approveMutation.isPending}
          onConfirm={(note) =>
            approveMutation.mutate({ id: modal.request!.id, note: note || undefined })
          }
          onCancel={closeModal}
        />
      )}

      {modal.type === 'reject' && modal.request && (
        <RejectModal
          request={modal.request}
          isLoading={rejectMutation.isPending}
          onConfirm={(reason) =>
            rejectMutation.mutate({ id: modal.request!.id, reason })
          }
          onCancel={closeModal}
        />
      )}

      {modal.type === 'lightbox' && modal.request && (
        <LightboxModal
          request={modal.request}
          onClose={closeModal}
          onApprove={openApproveModal}
          onReject={openRejectModal}
        />
      )}

      {/* Toast stack */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>
    </div>
  )
}
