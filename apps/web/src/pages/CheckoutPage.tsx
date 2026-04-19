// FIR-157 — Stripe Elements checkout page
// Sprint 3 Story 13 — Wise theme migration.
//
// The Sprint 2 error classifier from Story 10 (GAP-025) is preserved
// exactly. `data-testid` hooks and the data-error-kind attribute on the
// banner remain untouched so the existing vitest suite keeps passing.
// Everything purely visual (navy gradients, inline <style> blocks, emoji
// trust icons) is replaced with Wise tokens + lucide-react icons.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CreditCard,
  FileText,
  Hourglass,
  Lock,
  Radio,
  Upload,
  Video,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import {
  createInstallmentCheckout,
  createOneTimeCheckout,
  fetchCohortBySlug,
  submitManualPayment,
  type CohortDetail,
  type InstallmentCheckoutResponse,
  type OneTimeCheckoutResponse,
} from '../lib/api'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getInstallmentSchedule(baseDate: Date = new Date()): string[] {
  return [0, 1, 2].map((offset) => {
    const d = new Date(baseDate)
    d.setMonth(d.getMonth() + offset)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  })
}

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

type PaymentTab = 'full' | 'installments'
type CheckoutView = 'checkout' | 'manual'
type CheckoutStatus =
  | 'idle'
  | 'loading_cohort'
  | 'ready'
  | 'creating_session'
  | 'stripe_stub'
  | 'processing'
  | 'success'
  | 'declined'
  | 'manual_uploading'
  | 'manual_pending'

// Sprint 2 Story 10 (GAP-025) — explicit Stripe error categorisation.
// Previously the page only surfaced a terse "declined" banner; everything
// else (network timeout, invalid plan, generic Stripe 500) fell back to
// "Payment setup failed" with no path to recovery. We now discriminate on
// the error message so the banner can tell the user what actually broke.
export type StripeErrorKind =
  | 'CARD_DECLINED'
  | 'NETWORK_TIMEOUT'
  | 'INVALID_PLAN'
  | 'SESSION_FAILED'
  | 'UNKNOWN'

export interface StripeErrorState {
  kind: StripeErrorKind
  message: string
}

export function classifyStripeError(raw: unknown): StripeErrorState {
  const msg = raw instanceof Error ? raw.message : String(raw ?? '')
  const lower = msg.toLowerCase()

  if (lower.includes('declined') || lower.includes('card_declined')) {
    return {
      kind:    'CARD_DECLINED',
      message: 'Your card was declined. Please try a different card or payment method.',
    }
  }
  if (lower.includes('timeout') || lower.includes('network') || lower.includes('fetch failed')) {
    return {
      kind:    'NETWORK_TIMEOUT',
      message: 'We couldn\u2019t reach our payment provider. Please check your connection and try again.',
    }
  }
  if (lower.includes('plan') && (lower.includes('not found') || lower.includes('invalid'))) {
    return {
      kind:    'INVALID_PLAN',
      message: 'This payment plan is no longer available. Please refresh the page or contact support.',
    }
  }
  if (lower.includes('already enrolled')) {
    return {
      kind:    'INVALID_PLAN',
      message: 'You\u2019re already enrolled in this cohort.',
    }
  }
  if (msg) {
    return { kind: 'SESSION_FAILED', message: msg }
  }
  return {
    kind:    'UNKNOWN',
    message: 'Something went wrong setting up your payment. Please try again.',
  }
}

interface UploadedFile {
  file: File
  name: string
  sizeLabel: string
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function CheckoutNav({ backSlug }: { backSlug: string }) {
  return (
    <nav
      className={cn(
        'sticky top-0 z-[100] h-[68px]',
        'flex items-center px-6 sm:px-8',
        'bg-[var(--color-wise-surface)] border-b border-[var(--color-wise-ring)]',
      )}
    >
      <span className="text-xl font-black tracking-[-0.4px] text-[var(--color-wise-text)]">
        nextaibuilder
      </span>

      <div className="ml-4 flex items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1',
            'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
            'text-[11px] font-bold tracking-[0.3px]',
          )}
        >
          <Lock size={12} aria-hidden="true" />
          Secure checkout
        </span>
      </div>

      <Link
        to={`/courses/${backSlug}`}
        className={cn(
          'ml-auto flex items-center gap-1',
          'text-sm font-medium text-[var(--color-wise-text-muted)]',
          'hover:text-[var(--color-wise-text)]',
          'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2 rounded',
        )}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to course
      </Link>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// OrderSummaryCard — right sticky column
// ---------------------------------------------------------------------------

interface OrderSummaryCardProps {
  cohort: CohortDetail
  tab: PaymentTab
  installmentAmount?: number
}

const TYPE_COVER_FALLBACK: Record<string, string> = {
  live:     'linear-gradient(145deg, var(--color-wise-primary), var(--color-wise-primary-hover), var(--color-wise-mint))',
  combined: 'linear-gradient(145deg, var(--color-wise-dark), var(--color-wise-text-warm), var(--color-wise-text-muted))',
  recorded: 'linear-gradient(145deg, var(--color-wise-mint), var(--color-wise-primary), var(--color-wise-primary-hover))',
}

const TYPE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  live:     { label: 'Live Cohort', Icon: Radio },
  combined: { label: 'Combined',    Icon: Zap },
  recorded: { label: 'Recorded',    Icon: Video },
}

function OrderSummaryCard({ cohort, tab, installmentAmount }: OrderSummaryCardProps) {
  const schedule = getInstallmentSchedule()
  const coverBg = cohort.coverGradient ?? TYPE_COVER_FALLBACK[cohort.type] ?? TYPE_COVER_FALLBACK.recorded
  const instAmt = installmentAmount ?? Math.ceil(cohort.price / 3)
  const meta = TYPE_META[cohort.type] ?? { label: cohort.type, Icon: Video }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-lg)]',
        'bg-[var(--color-wise-surface)] shadow-[var(--shadow-card)]',
      )}
    >
      {/* Cover */}
      <div
        className="relative flex h-40 flex-col justify-between px-6 py-5"
        style={{ background: coverBg }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)',
          }}
        />
        <span
          className={cn(
            'self-start inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-3 py-1',
            'text-[11px] font-bold text-white',
            'bg-white/20 backdrop-blur ring-1 ring-white/30',
          )}
        >
          <meta.Icon size={12} aria-hidden="true" />
          {meta.label}
        </span>
        <p
          className="m-0 text-lg font-extrabold leading-snug text-white"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.35)' }}
        >
          {cohort.title}
        </p>
      </div>

      {/* Pricing breakdown */}
      <div className="px-6 pt-6 pb-5">
        {tab === 'full' ? (
          <>
            <div className="mb-2.5 flex justify-between text-sm text-[var(--color-wise-text-muted)]">
              <span>Subtotal</span>
              <span>{formatMoney(cohort.price)}</span>
            </div>
            <div className="mb-4 flex justify-between text-sm text-[var(--color-wise-text-muted)]">
              <span>Processing fee</span>
              <span>$0</span>
            </div>
            <div
              className={cn(
                'mb-4 flex justify-between border-t border-[var(--color-wise-ring)] pt-4',
                'text-lg font-extrabold text-[var(--color-wise-text)]',
              )}
            >
              <span>Total due today</span>
              <span>{formatMoney(cohort.price)}</span>
            </div>
            <div
              className={cn(
                'flex items-start gap-2 rounded-xl px-3.5 py-2.5',
                'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                'text-[13px] font-semibold',
              )}
            >
              <Check size={14} strokeWidth={3} aria-hidden="true" className="mt-0.5" />
              <span>Lifetime course access included with enrollment.</span>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2.5 flex justify-between text-sm text-[var(--color-wise-text-muted)]">
              <span>Course total</span>
              <span>{formatMoney(cohort.price)}</span>
            </div>
            <div className="mb-4 flex justify-between text-sm text-[var(--color-wise-text-muted)]">
              <span>3 × monthly installments</span>
              <span>{formatMoney(instAmt)}/mo</span>
            </div>
            <div
              className={cn(
                'mb-4 flex justify-between border-t border-[var(--color-wise-ring)] pt-4',
                'text-lg font-extrabold text-[var(--color-wise-text)]',
              )}
            >
              <span>Due today</span>
              <span>{formatMoney(instAmt)}</span>
            </div>
            <div
              className={cn(
                'flex items-start gap-2 rounded-xl px-3.5 py-2.5',
                'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text)]',
                'text-[13px] font-semibold',
              )}
            >
              <CreditCard size={14} aria-hidden="true" className="mt-0.5" />
              <span>
                2nd payment {schedule[1]} · 3rd on {schedule[2]}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Trust row */}
      <div className="flex justify-center gap-3 px-6 pt-3 pb-5">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-wise-text-muted)]">
          <Lock size={12} aria-hidden="true" />
          SSL encrypted
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-wise-text-muted)]">
          <Check size={12} strokeWidth={3} aria-hidden="true" />
          Secure checkout
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-wise-text-muted)]">
          <CreditCard size={12} aria-hidden="true" />
          Stripe protected
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StripeFieldsStub
// ---------------------------------------------------------------------------

interface StripeFieldsStubProps {
  onPay: () => void
  isProcessing: boolean
  buttonLabel: string
  declined?: boolean
}

function StripeFieldsStub({ onPay, isProcessing, buttonLabel, declined }: StripeFieldsStubProps) {
  const fieldClass = cn(
    'flex items-center px-4 h-12 rounded-[var(--radius-sm)] border text-[15px] mb-3.5',
    declined
      ? 'border-[var(--color-wise-danger)] bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-text-muted)]'
      : 'border-[var(--color-wise-ring)] bg-[var(--color-wise-canvas)] text-[var(--color-wise-text-muted)]',
  )

  const labelClass =
    'mb-1.5 block text-xs font-bold uppercase tracking-[0.3px] text-[var(--color-wise-text)]'

  return (
    <>
      <label className={labelClass}>Card number</label>
      <div className={fieldClass}>
        <span className="flex-1">•••• •••• •••• ••••</span>
        <CreditCard size={20} aria-hidden="true" className="text-[var(--color-wise-text-muted)]" />
      </div>

      <div className="mb-1 grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Expiry</label>
          <div className={cn(fieldClass, 'mb-0')}>
            <span className="text-sm text-[var(--color-wise-text-muted)]">MM / YY</span>
          </div>
        </div>
        <div>
          <label className={labelClass}>CVC</label>
          <div className={cn(fieldClass, 'mb-0')}>
            <span className="text-sm text-[var(--color-wise-text-muted)]">•••</span>
          </div>
        </div>
      </div>

      <div className="mt-4 mb-5 flex items-center gap-1.5">
        <span className="text-[13px] text-[var(--color-wise-text-muted)]">Powered by</span>
        <span className="text-[13px] font-black text-[#635bff]">stripe</span>
        <span className="ml-auto text-xs font-medium text-[var(--color-wise-text-muted)]">
          Visa · Mastercard · Amex
        </span>
      </div>

      <Button
        type="button"
        onClick={onPay}
        isLoading={isProcessing}
        variant={declined ? 'danger' : 'primary'}
        size="lg"
        className="w-full"
      >
        {isProcessing ? 'Processing payment...' : buttonLabel}
      </Button>
    </>
  )
}

// ---------------------------------------------------------------------------
// InstallmentSchedule
// ---------------------------------------------------------------------------

function InstallmentSchedule({ installmentAmount, currency }: { installmentAmount: number; currency: string }) {
  const schedule = getInstallmentSchedule()
  const rows = [
    { label: 'First payment',  badge: true,  date: schedule[0] },
    { label: 'Second payment', badge: false, date: schedule[1] },
    { label: 'Third payment',  badge: false, date: schedule[2] },
  ]

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {(['Payment', 'Date', 'Amount'] as const).map((h) => (
            <th
              key={h}
              className={cn(
                'text-left pb-2.5 border-b border-[var(--color-wise-ring)]',
                'text-xs font-bold uppercase tracking-[0.5px]',
                'text-[var(--color-wise-text-muted)]',
              )}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td className="border-b border-[var(--color-wise-ring)]/60 py-3 text-sm text-[var(--color-wise-text)]">
              {row.label}
              {row.badge && (
                <span
                  className={cn(
                    'ml-2 inline-block rounded-[var(--radius-pill)] px-2 py-0.5',
                    'text-[10px] font-bold',
                    'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                  )}
                >
                  Today
                </span>
              )}
            </td>
            <td className="border-b border-[var(--color-wise-ring)]/60 py-3 text-[13px] text-[var(--color-wise-text-muted)]">
              {row.date}
            </td>
            <td className="border-b border-[var(--color-wise-ring)]/60 py-3 text-[15px] font-bold text-[var(--color-wise-text)]">
              {formatMoney(installmentAmount, currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---------------------------------------------------------------------------
// CheckoutForm — left column
// ---------------------------------------------------------------------------

interface CheckoutFormProps {
  cohort: CohortDetail
  tab: PaymentTab
  onTabChange: (tab: PaymentTab) => void
  onSwitchToManual: () => void
  status: CheckoutStatus
  declined: boolean
  /** Sprint 2 Story 10 (GAP-025) — categorized Stripe error surface. */
  stripeError: StripeErrorState | null
  sessionData: OneTimeCheckoutResponse | InstallmentCheckoutResponse | null
  onInitiatePayment: () => void
  onConfirmStubPayment: () => void
  onDismissError: () => void
}

function CheckoutForm({
  cohort, tab, onTabChange, onSwitchToManual,
  status, declined, stripeError, sessionData,
  onInitiatePayment, onConfirmStubPayment,
  onDismissError,
}: CheckoutFormProps) {
  const isInstallment = (d: typeof sessionData): d is InstallmentCheckoutResponse =>
    d !== null && 'installmentAmount' in (d ?? {})

  const installmentAmount = isInstallment(sessionData)
    ? sessionData.installmentAmount
    : Math.ceil(cohort.price / 3)

  const currency = sessionData?.currency ?? 'USD'
  const isProcessing = status === 'creating_session' || status === 'processing'
  const showStripeStub = ['stripe_stub', 'creating_session', 'processing', 'ready'].includes(status)

  const payButtonLabel = tab === 'full'
    ? `Pay ${formatMoney(cohort.price, currency)} Now`
    : `Start Plan — Pay ${formatMoney(installmentAmount, currency)} Today`

  const cardClass = cn(
    'mb-4 rounded-[var(--radius-md)] bg-[var(--color-wise-surface)]',
    'px-7 py-7 shadow-[var(--shadow-ring)]',
  )

  return (
    <div className="flex-1 min-w-0">
      <h1 className="mb-1.5 text-3xl font-black tracking-[-0.6px] text-[var(--color-wise-text)]">
        Complete your enrollment
      </h1>
      <p className="mb-7 text-[15px] text-[var(--color-wise-text-muted)]">
        Secure checkout powered by Stripe
      </p>

      {/* Tab toggle */}
      <div
        className={cn(
          'mb-6 inline-flex gap-1 rounded-[var(--radius-pill)] p-1',
          'bg-[var(--color-wise-surface-soft)]',
        )}
      >
        {(['full', 'installments'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            aria-pressed={tab === t}
            className={cn(
              'rounded-[var(--radius-pill)] px-5 py-2 text-sm font-bold',
              'transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
              tab === t
                ? 'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] shadow-sm'
                : 'bg-transparent text-[var(--color-wise-text-muted)] hover:text-[var(--color-wise-text)]',
            )}
          >
            {t === 'full' ? 'Pay in Full' : 'Pay in 3 Installments'}
          </button>
        ))}
      </div>

      {/* Sprint 2 Story 10 (GAP-025) — categorized Stripe error banner.
          Shows for any Stripe failure — declined card, network timeout,
          invalid plan, or a generic session-setup failure. Each category
          gets a distinct headline so the student knows what action to take. */}
      {stripeError && (
        <div
          data-testid="stripe-error-banner"
          data-error-kind={stripeError.kind}
          role="alert"
          className={cn(
            'mb-4 flex items-start gap-2.5 rounded-[var(--radius-sm)] px-4 py-3.5',
            'bg-[var(--color-wise-danger-soft)] ring-1 ring-[var(--color-wise-danger)]/30',
          )}
        >
          <AlertTriangle
            size={18}
            aria-hidden="true"
            className="mt-0.5 flex-shrink-0 text-[var(--color-wise-danger)]"
          />
          <div className="flex-1">
            <p className="m-0 mb-0.5 text-sm font-bold text-[var(--color-wise-danger)]">
              {stripeError.kind === 'CARD_DECLINED'    ? 'Card declined'
                : stripeError.kind === 'NETWORK_TIMEOUT' ? 'Network error'
                : stripeError.kind === 'INVALID_PLAN'    ? 'Payment plan unavailable'
                : 'Payment failed'}
            </p>
            <p className="m-0 text-[13px] text-[var(--color-wise-text-warm)]">
              {stripeError.message}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error"
            className={cn(
              'flex-shrink-0 rounded p-0.5',
              'bg-transparent border-0 cursor-pointer',
              'text-[var(--color-wise-danger)] hover:bg-[var(--color-wise-danger)]/10',
              'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-danger)] focus-visible:outline-offset-2',
            )}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Installment schedule */}
      {tab === 'installments' && (
        <div className={cardClass}>
          <h2 className="mb-5 text-[15px] font-extrabold text-[var(--color-wise-text)]">
            Payment schedule
          </h2>
          <InstallmentSchedule installmentAmount={installmentAmount} currency={currency} />
          <p
            className={cn(
              'mt-4 rounded-xl px-3.5 py-3',
              'bg-[var(--color-wise-canvas)] text-[var(--color-wise-text-muted)]',
              'text-[13px] leading-[1.6]',
            )}
          >
            By starting this plan, you authorize nextaibuilder to charge{' '}
            {formatMoney(installmentAmount, currency)} today and the same amount on the following two dates.
          </p>
        </div>
      )}

      {/* Card details */}
      <div className={cardClass}>
        <h2 className="mb-5 text-[15px] font-extrabold text-[var(--color-wise-text)]">
          Card details
        </h2>
        {showStripeStub && (
          <StripeFieldsStub
            onPay={status === 'stripe_stub' ? onConfirmStubPayment : onInitiatePayment}
            isProcessing={isProcessing}
            buttonLabel={payButtonLabel}
            declined={declined}
          />
        )}
      </div>

      {/* Bank transfer link */}
      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={onSwitchToManual}
          className={cn(
            'text-sm font-semibold text-[var(--color-wise-primary-text)]',
            'bg-transparent border-0 cursor-pointer',
            'hover:underline',
            'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2 rounded',
          )}
        >
          Pay by bank transfer instead →
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ManualReceiptView
// ---------------------------------------------------------------------------

interface ManualReceiptViewProps {
  cohort: CohortDetail
  cohortId: string
  paymentPlanId: string
  onBack: () => void
}

type ManualUploadState = 'idle' | 'uploading' | 'uploaded' | 'submitting' | 'pending' | 'error'

function ManualReceiptView({ cohort, cohortId, paymentPlanId, onBack }: ManualReceiptViewProps) {
  const [uploadState, setUploadState] = useState<ManualUploadState>('idle')
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [note, setNote] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) return 'Only PDF, JPG, and PNG files are accepted.'
    if (file.size > MAX_FILE_BYTES) return 'File size must be 10 MB or less.'
    return null
  }

  const handleFile = useCallback((file: File) => {
    const err = validateFile(file)
    if (err) { setErrorMessage(err); return }
    setErrorMessage(null)
    setUploadState('uploading')
    setUploadProgress(0)
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setUploadedFile({ file, name: file.name, sizeLabel: formatFileSize(file.size) })
          setUploadState('uploaded')
          return 100
        }
        return prev + Math.floor(Math.random() * 20) + 5
      })
    }, 100)
  }, [])

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleSubmit = async () => {
    if (!uploadedFile) return
    setUploadState('submitting'); setErrorMessage(null)
    const formData = new FormData()
    formData.append('file', uploadedFile.file)
    formData.append('cohortId', cohortId)
    if (paymentPlanId) formData.append('paymentPlanId', paymentPlanId)
    if (note.trim()) formData.append('note', note.trim())
    try {
      await submitManualPayment(formData)
      setUploadState('pending')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit receipt')
      setUploadState('uploaded')
    }
  }

  if (uploadState === 'pending') {
    return (
      <div className="mx-auto max-w-[520px] px-6 py-14 text-center">
        <div
          className={cn(
            'rounded-[var(--radius-lg)] bg-[var(--color-wise-surface)]',
            'px-10 py-14 shadow-[var(--shadow-card)]',
          )}
        >
          <div
            className={cn(
              'mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full',
              'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-warning)]',
            )}
          >
            <Hourglass size={32} aria-hidden="true" />
          </div>
          <span
            className={cn(
              'mb-5 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-1.5',
              'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text)]',
              'text-[13px] font-bold',
            )}
          >
            <Hourglass size={12} aria-hidden="true" />
            Under Review
          </span>
          <h2 className="mb-2.5 text-[26px] font-black text-[var(--color-wise-text)]">
            Receipt submitted!
          </h2>
          <p className="mx-auto mb-8 max-w-[360px] text-[15px] leading-[1.6] text-[var(--color-wise-text-muted)]">
            Your payment receipt is being reviewed. You'll receive an email within 24–48 hours once approved.
          </p>
          <Button variant="outline" size="md" onClick={onBack}>
            View Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const isSubmitting = uploadState === 'submitting'
  const isUploading = uploadState === 'uploading'

  const cardClass = cn(
    'mb-3.5 rounded-[var(--radius-md)] bg-[var(--color-wise-surface)]',
    'shadow-[var(--shadow-ring)]',
  )

  return (
    <div className="mx-auto max-w-[620px]">
      {/* Course header */}
      <div className={cn(cardClass, 'flex items-center gap-4 px-6 py-5')}>
        <div
          className="h-14 w-[72px] flex-shrink-0 rounded-xl"
          style={{
            background:
              cohort.coverGradient ??
              TYPE_COVER_FALLBACK[cohort.type] ??
              TYPE_COVER_FALLBACK.recorded,
          }}
          aria-hidden="true"
        />
        <div>
          <p className="mb-1 text-xs text-[var(--color-wise-text-muted)]">Enrolling in</p>
          <p className="mb-1 text-[17px] font-extrabold text-[var(--color-wise-text)]">
            {cohort.title}
          </p>
          <p className="m-0 text-[13px] font-bold text-[var(--color-wise-primary-text)]">
            Pay in full · {formatMoney(cohort.price)}
          </p>
        </div>
      </div>

      {/* Bank transfer instructions */}
      <div
        className={cn(
          'mb-3.5 rounded-r-[var(--radius-md)] px-5 py-5',
          'bg-[var(--color-wise-mint)] border-l-4 border-[var(--color-wise-primary-text)]',
        )}
      >
        <h2 className="mb-3.5 text-sm font-extrabold text-[var(--color-wise-primary-text)]">
          Bank Transfer Instructions
        </h2>
        {[
          { label: 'Bank name', value: 'HSBC Pakistan' },
          { label: 'Account name', value: 'NextAI Builder Ltd' },
          { label: 'Account number', value: 'PK36 SCBL 0000 0011 2345 6700' },
          { label: 'Amount', value: `${formatMoney(cohort.price)} USD equivalent` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="mb-2 flex items-center justify-between"
          >
            <span className="text-[13px] text-[var(--color-wise-text-muted)]">{label}</span>
            <span
              className={cn(
                'rounded px-2 py-0.5 font-mono text-[13px] font-bold',
                'bg-white/60 text-[var(--color-wise-primary-text)]',
              )}
            >
              {value}
            </span>
          </div>
        ))}
        <p className="mt-3 text-[13px] leading-[1.55] text-[var(--color-wise-text-warm)]">
          Transfer the amount shown and upload your receipt below. Access activates within 24 hours of approval.
        </p>
      </div>

      {/* Error */}
      {errorMessage && (
        <div
          className={cn(
            'mb-3.5 flex items-start gap-2 rounded-xl px-4 py-3',
            'bg-[var(--color-wise-danger-soft)] ring-1 ring-[var(--color-wise-danger)]/30',
            'text-sm text-[var(--color-wise-danger)]',
          )}
          role="alert"
        >
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
          <p className="m-0">{errorMessage}</p>
        </div>
      )}

      {/* Upload zone */}
      {uploadState === 'idle' && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleInputChange}
            aria-label="Upload payment receipt"
          />
          <div
            role="button"
            tabIndex={0}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
            }}
            className={cn(
              'mb-3.5 rounded-[var(--radius-md)] border-2 border-dashed px-8 py-12',
              'text-center cursor-pointer transition-colors',
              'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
              isDragOver
                ? 'border-[var(--color-wise-primary-text)] bg-[var(--color-wise-mint)]'
                : 'border-[var(--color-wise-primary-text)] bg-[var(--color-wise-canvas)]',
            )}
          >
            <Upload
              size={40}
              aria-hidden="true"
              className="mx-auto mb-3.5 text-[var(--color-wise-primary-text)]"
            />
            <p className="mb-1.5 text-[17px] font-extrabold text-[var(--color-wise-text)]">
              Upload your payment receipt
            </p>
            <p className="mb-1.5 text-sm text-[var(--color-wise-text-muted)]">
              Drag &amp; drop, or{' '}
              <span className="font-bold text-[var(--color-wise-primary-text)]">
                browse files
              </span>
            </p>
            <p className="m-0 text-xs text-[var(--color-wise-text-muted)]">
              PDF, JPG, PNG · Max 10 MB
            </p>
          </div>
        </>
      )}

      {isUploading && (
        <div
          className={cn(
            'mb-3.5 rounded-[var(--radius-md)] border-2 border-dashed px-8 py-10',
            'text-center',
            'border-[var(--color-wise-primary-text)] bg-[var(--color-wise-mint)]',
          )}
        >
          <Hourglass
            size={40}
            aria-hidden="true"
            className="mx-auto mb-3 text-[var(--color-wise-primary-text)]"
          />
          <p className="mb-3.5 text-base font-bold text-[var(--color-wise-text)]">
            Uploading receipt...
          </p>
          <div className="mx-auto mb-2 h-1.5 max-w-[240px] overflow-hidden rounded-[var(--radius-pill)] bg-white/60">
            <div
              className="h-full rounded-[var(--radius-pill)] bg-[var(--color-wise-primary-text)] transition-[width] duration-200"
              style={{ width: `${Math.min(uploadProgress, 100)}%` }}
            />
          </div>
          <span className="text-[13px] font-bold text-[var(--color-wise-primary-text)]">
            {Math.min(uploadProgress, 100)}%
          </span>
        </div>
      )}

      {uploadState === 'uploaded' && uploadedFile && (
        <div
          className={cn(
            'mb-3.5 flex items-center gap-3.5 rounded-[var(--radius-md)] px-5 py-4',
            'bg-[var(--color-wise-mint)] ring-2 ring-[var(--color-wise-primary-text)]/25',
          )}
        >
          <div
            className={cn(
              'flex h-13 w-13 flex-shrink-0 items-center justify-center rounded-xl',
              'h-[52px] w-[52px]',
              'bg-white shadow-[var(--shadow-ring)]',
            )}
          >
            <FileText
              size={24}
              aria-hidden="true"
              className="text-[var(--color-wise-primary-text)]"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-bold text-[var(--color-wise-text)]">
              {uploadedFile.name}
            </p>
            <p className="m-0 text-[13px] text-[var(--color-wise-text-muted)]">
              {uploadedFile.sizeLabel}
            </p>
          </div>
          <div
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
              'bg-[var(--color-wise-primary-text)] text-white',
            )}
            aria-hidden="true"
          >
            <Check size={16} strokeWidth={3} />
          </div>
          <button
            type="button"
            onClick={() => {
              setUploadedFile(null)
              setUploadState('idle')
              setUploadProgress(0)
            }}
            className={cn(
              'flex-shrink-0 bg-transparent border-0 cursor-pointer',
              'text-[13px] font-semibold text-[var(--color-wise-danger)]',
              'hover:underline',
              'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-danger)] focus-visible:outline-offset-2 rounded',
            )}
          >
            Remove
          </button>
        </div>
      )}

      {/* Note */}
      <label htmlFor="manual-payment-note" className="sr-only">
        Optional note
      </label>
      <textarea
        id="manual-payment-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional: Add a note (e.g. transaction reference number)"
        rows={3}
        maxLength={500}
        className={cn(
          'mb-3.5 w-full box-border resize-none outline-none',
          'rounded-[var(--radius-sm)] border border-[var(--color-wise-ring)]',
          'bg-white px-4 py-3.5 text-sm text-[var(--color-wise-text)]',
          'font-sans',
          'focus-visible:border-[var(--color-wise-text)] focus-visible:ring-4 focus-visible:ring-[var(--color-wise-primary)]/30',
        )}
      />

      {/* Submit */}
      <Button
        type="button"
        onClick={handleSubmit}
        isLoading={isSubmitting}
        disabled={!uploadedFile || isUploading || isSubmitting}
        variant="primary"
        size="lg"
        className="w-full"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Receipt'}
      </Button>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer',
            'text-sm font-medium text-[var(--color-wise-text-muted)]',
            'hover:text-[var(--color-wise-text)]',
            'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2 rounded',
          )}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Pay by card instead
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SuccessView
// ---------------------------------------------------------------------------

function SuccessView({ cohortTitle }: { cohortTitle: string }) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto mt-14 max-w-[480px] text-center">
      <div
        className={cn(
          'rounded-[var(--radius-lg)] bg-[var(--color-wise-surface)]',
          'px-10 py-14 shadow-[var(--shadow-card)]',
        )}
      >
        <div
          className={cn(
            'mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full',
            'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
          )}
        >
          <Check size={36} strokeWidth={3} aria-hidden="true" />
        </div>
        <h2 className="mb-2.5 text-[28px] font-black text-[var(--color-wise-text)]">
          You're enrolled!
        </h2>
        <p className="mb-8 text-[15px] leading-[1.65] text-[var(--color-wise-text-muted)]">
          Your payment was successful. Welcome to {cohortTitle}. Check your email for access details.
        </p>
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate('/student/dashboard')}
        >
          Go to My Courses
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LoadingState / ErrorState
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-wise-canvas)]">
      <LoadingSpinner size="lg" label="Loading checkout" centered />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[var(--color-wise-canvas)] flex flex-col items-center justify-center gap-4 px-6">
      <p className="text-lg font-bold text-[var(--color-wise-text)]">{message}</p>
      <Button variant="primary" size="md" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CheckoutPage — root
// ---------------------------------------------------------------------------

export default function CheckoutPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const paymentPlanId = searchParams.get('plan') ?? 'default'

  const [cohort, setCohort] = useState<CohortDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<CheckoutStatus>('loading_cohort')
  const [tab, setTab] = useState<PaymentTab>('full')
  const [view, setView] = useState<CheckoutView>('checkout')
  const [declined, setDeclined] = useState(false)
  // Sprint 2 Story 10 (GAP-025) — categorized Stripe error surface.
  const [stripeError, setStripeError] = useState<StripeErrorState | null>(null)
  const [sessionData, setSessionData] = useState<OneTimeCheckoutResponse | InstallmentCheckoutResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setStatus('loading_cohort'); setLoadError(null)
      try {
        const data = await fetchCohortBySlug(slug)
        if (cancelled) return
        if (!data) { setLoadError('Course not found.'); return }
        setCohort(data); setStatus('ready')
      } catch {
        if (!cancelled) setLoadError('Failed to load course. Please try again.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  const handleTabChange = (nextTab: PaymentTab) => {
    setTab(nextTab); setSessionData(null); setDeclined(false); setStripeError(null); setStatus('ready')
  }

  const handleInitiatePayment = async () => {
    if (!cohort) return
    setStatus('creating_session'); setDeclined(false); setStripeError(null)
    try {
      const data = tab === 'full'
        ? await createOneTimeCheckout(cohort.id, paymentPlanId)
        : await createInstallmentCheckout(cohort.id, paymentPlanId)
      setSessionData(data); setStatus('stripe_stub')
    } catch (err) {
      // GAP-025 — funnel every Stripe failure through the classifier so the
      // banner can render an actionable headline + message.
      const classified = classifyStripeError(err)
      if (classified.kind === 'CARD_DECLINED') setDeclined(true)
      setStripeError(classified)
      setStatus('ready')
    }
  }

  const handleConfirmStubPayment = () => {
    window.alert(
      'Stripe Elements requires npm install of @stripe/react-stripe-js.\n\n' +
      'In production, replace this stub with stripe.confirmCardPayment(clientSecret).',
    )
    setStatus('success')
  }

  if (status === 'loading_cohort') return <LoadingState />

  if (loadError || !cohort) {
    return (
      <ErrorState
        message={loadError ?? 'Course not found.'}
        onRetry={() => { setLoadError(null); setStatus('loading_cohort'); setCohort(null) }}
      />
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[var(--color-wise-canvas)]">
        <CheckoutNav backSlug={slug} />
        <SuccessView cohortTitle={cohort.title} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-wise-canvas)]">
      <CheckoutNav backSlug={slug} />

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-10 pb-20">
        {view === 'manual' ? (
          <ManualReceiptView
            cohort={cohort}
            cohortId={cohort.id}
            paymentPlanId={paymentPlanId}
            onBack={() => setView('checkout')}
          />
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
            {/* Left — form */}
            <div className="flex-1 min-w-0">
              <CheckoutForm
                cohort={cohort}
                tab={tab}
                onTabChange={handleTabChange}
                onSwitchToManual={() => setView('manual')}
                status={status}
                declined={declined}
                stripeError={stripeError}
                sessionData={sessionData}
                onInitiatePayment={handleInitiatePayment}
                onConfirmStubPayment={handleConfirmStubPayment}
                onDismissError={() => { setStripeError(null); setDeclined(false) }}
              />
            </div>

            {/* Right — order summary */}
            <div className="w-full lg:w-[360px] flex-shrink-0 lg:sticky lg:top-[88px]">
              <OrderSummaryCard
                cohort={cohort}
                tab={tab}
                installmentAmount={
                  sessionData && 'installmentAmount' in sessionData
                    ? sessionData.installmentAmount
                    : undefined
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
