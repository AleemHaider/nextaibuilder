// FIR-50 — Admin manual payment review queue
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  Check,
  X,
  Search as SearchIcon,
  CircleCheck,
  AlertTriangle,
  Inbox,
  PartyPopper,
} from 'lucide-react'
import {
  fetchManualPayments,
  approveManualPayment,
  rejectManualPayment,
  type ManualPaymentRequest,
} from '../../lib/api'
import { STALE_TIME } from '../../lib/queryConfig'
import { cn } from '../../lib/utils'
import { EmptyState } from '../../components/ui/EmptyState'

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
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-text))',
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-primary))',
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-success))',
  'linear-gradient(135deg, var(--color-wise-primary-text), var(--color-wise-primary-text))',
  'linear-gradient(135deg, var(--color-wise-warning), var(--color-wise-warning))',
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
        'shadow-[var(--color-wise-ring-strong)_0_4px_20px] text-[14px] font-semibold',
        'animate-[slideUp_0.2s_ease-out]',
        toast.variant === 'success'
          ? 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)] border border-[rgba(5,77,40,0.15)]'
          : 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)] border border-[rgba(208,50,56,0.15)]',
      )}
    >
      <span aria-hidden="true" className="inline-flex items-center">
        {toast.variant === 'success' ? <Check size={16} /> : <X size={16} />}
      </span>
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
      className="bg-white rounded-[16px] shadow-[var(--color-wise-ring)_0_0_0_1px] overflow-hidden"
      aria-hidden="true"
    >
      <div className="flex items-start gap-4 p-5">
        <div className="w-20 h-20 rounded-[12px] bg-[var(--color-wise-surface-soft)] animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2.5 pt-1">
          <div className="h-4 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-1/3" />
          <div className="h-3 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-1/4" />
          <div className="h-3 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-2/5" />
          <div className="h-3 bg-[var(--color-wise-surface-soft)] rounded animate-pulse w-1/5" />
        </div>
      </div>
      <div className="border-t border-[var(--color-wise-ring)] px-5 py-3.5 flex gap-3">
        <div className="h-9 w-28 bg-[var(--color-wise-surface-soft)] rounded-full animate-pulse" />
        <div className="h-9 w-24 bg-[var(--color-wise-surface-soft)] rounded-full animate-pulse" />
        <div className="h-9 w-32 bg-[var(--color-wise-surface-soft)] rounded-full animate-pulse ml-auto" />
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
        'bg-white rounded-[16px] shadow-[var(--color-wise-ring)_0_0_0_1px] overflow-hidden',
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
            'w-20 h-20 rounded-[12px] bg-[var(--color-wise-surface-soft)] flex-shrink-0',
            'flex items-center justify-center cursor-pointer text-[var(--color-wise-text-warm)]',
            'hover:opacity-80 transition-opacity border-none',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-wise-primary-text)]/40',
          )}
        >
          <FileText size={28} aria-hidden="true" />
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
            <span className="text-[16px] font-bold text-[var(--color-wise-text)]">{student.name}</span>
          </div>
          <div className="text-[13px] text-[var(--color-wise-text-muted)] mb-1">{student.email}</div>

          {/* Cohort + amount */}
          <div className="text-[13px] font-semibold text-[var(--color-wise-primary-text)] mb-1">
            {cohort.name}
            {amount != null && ` · ${formatMoney(amount)}`}
          </div>

          <div className="text-[12px] text-[var(--color-wise-text-muted)]">{formatRelativeTime(createdAt)}</div>

          {/* Note */}
          {note && (
            <div
              className={cn(
                'mt-2 text-[13px] italic text-[var(--color-wise-text-muted)]',
                'bg-[var(--color-wise-canvas)] rounded-[8px] px-2.5 py-2',
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
                ? 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]'
                : 'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',
            )}
          >
            {status}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        className={cn(
          'border-t border-[var(--color-wise-ring)] px-5 py-3.5',
          'flex items-center gap-3',
        )}
      >
        {status === 'PENDING' && (
          <>
            <button
              type="button"
              onClick={() => onApprove(request)}
              className={cn(
                'inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full',
                'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] text-[14px] font-bold border-none cursor-pointer',
                'hover:bg-[var(--color-wise-primary-hover)] transition-colors',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-wise-primary-text)]/40',
              )}
            >
              <Check size={14} aria-hidden="true" /> Approve
            </button>
            <button
              type="button"
              onClick={() => onReject(request)}
              className={cn(
                'inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full',
                'bg-transparent border-2 border-[rgba(208,50,56,0.3)]',
                'text-[var(--color-wise-danger)] text-[14px] font-bold cursor-pointer',
                'hover:bg-[var(--color-wise-danger-soft)] transition-colors',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300/40',
              )}
            >
              <X size={14} aria-hidden="true" /> Reject
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onViewReceipt(request)}
          className={cn(
            'px-4.5 py-2.5 rounded-full',
            'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)] text-[13px] font-semibold border-none cursor-pointer',
            'hover:bg-[var(--color-wise-surface-soft)] transition-colors ml-auto',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-wise-ring-strong)]',
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            View Receipt
            <SearchIcon size={13} aria-hidden="true" />
          </span>
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
        className="bg-white rounded-[20px] w-full max-w-[440px] overflow-hidden shadow-[var(--color-wise-ring-strong)_0_8px_30px]"
      >
        {/* Header */}
        <div className="bg-[var(--color-wise-mint)] px-7 py-5 flex items-center gap-3">
          <CircleCheck size={24} className="text-[var(--color-wise-primary-text)]" aria-hidden="true" />
          <h2 id="approve-modal-title" className="text-[17px] font-extrabold text-[var(--color-wise-primary-text)]">
            Approve Payment
          </h2>
        </div>

        {/* Body */}
        <div className="px-7 py-5">
          <p className="text-[14px] text-[var(--color-wise-text-muted)] leading-relaxed mb-4">
            Confirm approval for <strong className="text-[var(--color-wise-text)]">{request.student.name}</strong>?
            <br />
            Course: <strong className="text-[var(--color-wise-text)]">{request.cohort.name}</strong>
            {request.amount != null && (
              <>
                <br />
                Amount: <strong className="text-[var(--color-wise-text)]">{formatMoney(request.amount)}</strong>
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
              'w-full rounded-[10px] border-[1.5px] border-[var(--color-wise-ring-strong)]',
              'px-3 py-2.5 text-[13px] text-[var(--color-wise-text)] resize-none outline-none',
              'focus:border-[var(--color-wise-primary-text)] transition-colors',
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
              'px-4.5 py-2.5 rounded-full bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]',
              'text-[13px] font-bold border-none cursor-pointer hover:bg-[var(--color-wise-surface-soft)] transition-colors',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(approveNote)}
            disabled={isLoading}
            className={cn(
              'px-4.5 py-2.5 rounded-full bg-[var(--color-wise-primary-text)] text-[var(--color-wise-dark)]',
              'text-[13px] font-bold border-none cursor-pointer hover:opacity-90 transition-opacity',
              'flex items-center gap-2',
              isLoading && 'opacity-60 cursor-not-allowed',
            )}
          >
            {isLoading && (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-[rgba(13,26,58,0.3)] border-t-[var(--color-wise-dark)] animate-spin" />
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
        className="bg-white rounded-[20px] w-full max-w-[440px] overflow-hidden shadow-[var(--color-wise-ring-strong)_0_8px_30px]"
      >
        {/* Header */}
        <div className="bg-[var(--color-wise-danger-soft)] px-7 py-5 flex items-center gap-3">
          <AlertTriangle size={24} className="text-[var(--color-wise-danger)]" aria-hidden="true" />
          <h2 id="reject-modal-title" className="text-[17px] font-extrabold text-[var(--color-wise-danger)]">
            Reject Receipt
          </h2>
        </div>

        {/* Body */}
        <div className="px-7 py-5">
          <p className="text-[14px] text-[var(--color-wise-text-muted)] leading-relaxed mb-3">
            Provide a reason for rejecting{' '}
            <strong className="text-[var(--color-wise-text)]">{request.student.name}</strong>'s receipt. This
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
              'w-full rounded-[10px] border-[1.5px] border-[var(--color-wise-ring-strong)]',
              'px-3 py-2.5 text-[13px] text-[var(--color-wise-text)] resize-none outline-none mb-2',
              'focus:border-[var(--color-wise-primary-text)] transition-colors',
              !isValid && reason.length > 0 && 'border-[var(--color-wise-danger)]',
            )}
          />
          {!isValid && reason.length > 0 && (
            <p className="text-[12px] text-[var(--color-wise-danger)] mb-3" role="alert">
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
              'px-4.5 py-2.5 rounded-full bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]',
              'text-[13px] font-bold border-none cursor-pointer hover:bg-[var(--color-wise-surface-soft)] transition-colors',
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
              'px-4.5 py-2.5 rounded-full bg-[var(--color-wise-danger)] text-white',
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
        className="bg-white rounded-[20px] w-full max-w-[640px] overflow-hidden shadow-[var(--color-wise-ring-strong)_0_8px_30px]"
      >
        {/* Student header */}
        <div className="px-6 py-4 border-b border-[var(--color-wise-ring)] flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0"
            style={{ background: getAvatarGradient(student.name) }}
            aria-hidden="true"
          >
            {getAvatarInitial(student.name)}
          </div>
          <div>
            <div className="text-[15px] font-bold text-[var(--color-wise-text)]">{student.name}</div>
            <div className="text-[12px] text-[var(--color-wise-text-muted)]">
              {cohort.name}{amount != null ? ` · ${formatMoney(amount)}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt lightbox"
            className={cn(
              'ml-auto w-9 h-9 rounded-full bg-[var(--color-wise-surface-soft)] flex items-center justify-center',
              'text-[var(--color-wise-text-muted)] border-none cursor-pointer hover:bg-[var(--color-wise-surface-soft)] transition-colors',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-wise-ring-strong)]',
            )}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Receipt display */}
        <div className="bg-[var(--color-wise-text)] flex items-center justify-center min-h-[320px] relative">
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
              <FileText size={56} aria-hidden="true" />
              <span className="text-[14px]">Receipt preview not available</span>
            </div>
          )}
        </div>

        {/* Actions — shortcut approve/reject from lightbox */}
        {request.status === 'PENDING' && (
          <div className="px-6 py-4 border-t border-[var(--color-wise-ring)] flex items-center gap-3">
            <button
              type="button"
              onClick={() => { onClose(); onApprove(request) }}
              className={cn(
                'inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full',
                'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] text-[14px] font-bold border-none cursor-pointer',
                'hover:bg-[var(--color-wise-primary-hover)] transition-colors',
              )}
            >
              <Check size={14} aria-hidden="true" /> Approve
            </button>
            <button
              type="button"
              onClick={() => { onClose(); onReject(request) }}
              className={cn(
                'inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-transparent border-2',
                'border-[rgba(208,50,56,0.3)] text-[var(--color-wise-danger)]',
                'text-[14px] font-bold cursor-pointer hover:bg-[var(--color-wise-danger-soft)] transition-colors',
              )}
            >
              <X size={14} aria-hidden="true" /> Reject
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
          'bg-white shadow-[var(--color-wise-ring)_0_0_0_1px] text-[var(--color-wise-text)]',
          'hover:bg-[var(--color-wise-mint)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        ← Previous
      </button>
      <span className="text-[13px] text-[var(--color-wise-text-muted)] px-2">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={cn(
          'px-4 py-2 rounded-full text-[13px] font-semibold border-none cursor-pointer',
          'bg-white shadow-[var(--color-wise-ring)_0_0_0_1px] text-[var(--color-wise-text)]',
          'hover:bg-[var(--color-wise-mint)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
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
    staleTime: STALE_TIME.medium,
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
    <div className="min-h-screen bg-[var(--color-wise-canvas)]">
      {/* Page header */}
      <div
        className={cn(
          'flex items-center justify-between px-8 py-6',
          'bg-white border-b border-[var(--color-wise-ring)]',
        )}
      >
        <h1 className="text-[24px] font-extrabold text-[var(--color-wise-text)]">Manual Payments</h1>
        {pendingCount !== null && pendingCount > 0 && (
          <span
            className={cn(
              'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text-warm)] text-[13px] font-bold',
              'px-3.5 py-1.5 rounded-full',
            )}
          >
            ⏳ {pendingCount} pending review
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="px-8 pt-5">
        <div className="flex gap-1 bg-[var(--color-wise-surface-soft)] rounded-[14px] p-1 w-fit">
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
                  ? 'bg-white text-[var(--color-wise-text)] shadow-[var(--color-wise-ring)_0_1px_4px]'
                  : 'bg-transparent text-[var(--color-wise-text-muted)] hover:text-[var(--color-wise-text)]',
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
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load"
            description={error instanceof Error ? error.message : 'Something went wrong. Please refresh.'}
          />
        )}

        {/* Empty state */}
        {!isLoading && !isError && data?.requests.length === 0 && (
          <EmptyState
            icon={
              activeTab === 'PENDING'
                ? CircleCheck
                : activeTab === 'APPROVED'
                  ? PartyPopper
                  : Inbox
            }
            title={activeTab === 'PENDING' ? 'All caught up' : 'Nothing here yet'}
            description={emptyMessages[activeTab]}
          />
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
