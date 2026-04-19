// FIR-157 — Stripe Elements checkout page
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
  createInstallmentCheckout,
  createOneTimeCheckout,
  fetchCohortBySlug,
  submitManualPayment,
  type CohortDetail,
  type InstallmentCheckoutResponse,
  type OneTimeCheckoutResponse,
} from '../lib/api'

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
// Spinner
// ---------------------------------------------------------------------------

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        border: `3px solid rgba(255,255,255,0.3)`,
        borderTopColor: '#fff',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function CheckoutNav({ backSlug }: { backSlug: string }) {
  return (
    <nav style={{
      height: 68,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      padding: '0 32px',
      borderBottom: '1px solid rgba(26,39,68,0.10)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <span style={{ fontSize: 20, fontWeight: 900, color: '#1a2744', letterSpacing: '-0.4px' }}>
        nextaibuilder
      </span>

      <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          background: '#e6f4ec', color: '#054d28',
          fontSize: 11, fontWeight: 700, padding: '3px 10px',
          borderRadius: 100, letterSpacing: '0.3px',
        }}>
          🔒 Secure checkout
        </span>
      </div>

      <Link
        to={`/courses/${backSlug}`}
        style={{
          marginLeft: 'auto',
          fontSize: 14, color: '#717182',
          textDecoration: 'none', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        ← Back to course
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

const TYPE_COVER: Record<string, string> = {
  live:     'linear-gradient(145deg,#0d1b42,#1e4080,#4a9ad4)',
  combined: 'linear-gradient(145deg,#100d30,#2a1f6e,#6b5ce7)',
  recorded: 'linear-gradient(145deg,#0a2a1a,#0f5132,#16a34a)',
}

const TYPE_BADGE: Record<string, string> = {
  live:     '🔴 Live Cohort',
  combined: '⚡ Combined',
  recorded: '📹 Recorded',
}

function OrderSummaryCard({ cohort, tab, installmentAmount }: OrderSummaryCardProps) {
  const schedule = getInstallmentSchedule()
  const cover = TYPE_COVER[cohort.type] ?? TYPE_COVER.recorded
  const instAmt = installmentAmount ?? Math.ceil(cohort.price / 3)

  return (
    <div style={{
      background: '#fff',
      borderRadius: 24,
      overflow: 'hidden',
      boxShadow: 'rgba(26,39,68,0.10) 0 4px 24px, rgba(26,39,68,0.08) 0 0 0 1px',
    }}>
      {/* Cover */}
      <div style={{
        height: 160, background: cohort.coverGradient ?? cover,
        position: 'relative', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '20px 24px',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 160, height: 160,
          borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.12) 0%,transparent 70%)',
          pointerEvents: 'none',
        }} />
        <span style={{
          display: 'inline-block', background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.28)',
          borderRadius: 100, padding: '4px 12px',
          fontSize: 11, fontWeight: 700, color: '#fff', alignSelf: 'flex-start',
        }}>
          {TYPE_BADGE[cohort.type] ?? cohort.type}
        </span>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.3, textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
          {cohort.title}
        </p>
      </div>

      {/* Pricing breakdown */}
      <div style={{ padding: '24px 24px 20px' }}>
        {tab === 'full' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14, color: '#717182' }}>
              <span>Subtotal</span><span>{formatMoney(cohort.price)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 14, color: '#717182' }}>
              <span>Processing fee</span><span>$0</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              borderTop: '1px solid rgba(26,39,68,0.08)', paddingTop: 16, marginBottom: 16,
              fontSize: 18, fontWeight: 800, color: '#1a2744',
            }}>
              <span>Total due today</span><span>{formatMoney(cohort.price)}</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: '#e6f4ec', borderRadius: 12, padding: '10px 14px',
              fontSize: 13, color: '#054d28', fontWeight: 600,
            }}>
              <span>✓</span>
              <span>Lifetime course access included with enrollment.</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14, color: '#717182' }}>
              <span>Course total</span><span>{formatMoney(cohort.price)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 14, color: '#717182' }}>
              <span>3 × monthly installments</span><span>{formatMoney(instAmt)}/mo</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              borderTop: '1px solid rgba(26,39,68,0.08)', paddingTop: 16, marginBottom: 16,
              fontSize: 18, fontWeight: 800, color: '#1a2744',
            }}>
              <span>Due today</span><span>{formatMoney(instAmt)}</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: '#fff7ed', borderRadius: 12, padding: '10px 14px',
              fontSize: 13, color: '#9a3412', fontWeight: 600,
            }}>
              <span>💳</span>
              <span>2nd payment {schedule[1]} · 3rd on {schedule[2]}</span>
            </div>
          </>
        )}
      </div>

      {/* Trust row */}
      <div style={{
        padding: '12px 24px 20px',
        display: 'flex', gap: 12, justifyContent: 'center',
      }}>
        {['🔒 SSL encrypted', '✓ Secure checkout', '💳 Stripe protected'].map((t) => (
          <span key={t} style={{ fontSize: 11, color: '#a3a3a3', fontWeight: 600 }}>{t}</span>
        ))}
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
  const fieldStyle: React.CSSProperties = {
    height: 48, borderRadius: 12,
    border: declined ? '1.5px solid #d03238' : '1.5px solid rgba(26,39,68,0.15)',
    background: declined ? '#fef2f2' : '#f8f9fb',
    display: 'flex', alignItems: 'center', padding: '0 16px',
    fontSize: 15, color: '#a3a3a3', marginBottom: 14,
  }

  return (
    <>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#1a2744', display: 'block', marginBottom: 6, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
        Card number
      </label>
      <div style={fieldStyle}>
        <span style={{ flex: 1 }}>•••• •••• •••• ••••</span>
        <span style={{ fontSize: 20 }}>💳</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#1a2744', display: 'block', marginBottom: 6, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
            Expiry
          </label>
          <div style={{ ...fieldStyle, marginBottom: 0 }}>
            <span style={{ fontSize: 14, color: '#a3a3a3' }}>MM / YY</span>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#1a2744', display: 'block', marginBottom: 6, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
            CVC
          </label>
          <div style={{ ...fieldStyle, marginBottom: 0 }}>
            <span style={{ fontSize: 14, color: '#a3a3a3' }}>•••</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: '#717182' }}>Powered by</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: '#635bff' }}>stripe</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#a3a3a3', fontWeight: 500 }}>Visa · Mastercard · Amex</span>
      </div>

      <button
        type="button"
        onClick={onPay}
        disabled={isProcessing}
        style={{
          width: '100%', height: 56, borderRadius: 100,
          background: declined
            ? 'linear-gradient(135deg,#d03238,#b02428)'
            : 'linear-gradient(135deg,#1a2744,#2d4a8a)',
          color: '#fff', border: 'none',
          fontSize: 16, fontWeight: 800, cursor: isProcessing ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          opacity: isProcessing ? 0.85 : 1,
          boxShadow: declined
            ? '0 4px 20px rgba(208,50,56,0.35)'
            : '0 4px 20px rgba(26,39,68,0.30)',
          transition: 'opacity 0.15s',
          letterSpacing: '0.2px',
        }}
      >
        {isProcessing ? (
          <>
            <Spinner />
            Processing payment...
          </>
        ) : (
          buttonLabel
        )}
      </button>
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
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {(['Payment', 'Date', 'Amount'] as const).map((h) => (
            <th key={h} style={{
              textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#717182',
              padding: '0 0 10px', borderBottom: '1px solid rgba(26,39,68,0.08)',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td style={{ fontSize: 14, color: '#1a2744', padding: '13px 0', borderBottom: '1px solid rgba(26,39,68,0.05)' }}>
              {row.label}
              {row.badge && (
                <span style={{
                  marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px',
                  borderRadius: 100, background: '#e6f4ec', color: '#054d28',
                }}>Today</span>
              )}
            </td>
            <td style={{ fontSize: 13, color: '#717182', padding: '13px 0', borderBottom: '1px solid rgba(26,39,68,0.05)' }}>{row.date}</td>
            <td style={{ fontSize: 15, fontWeight: 700, color: '#1a2744', padding: '13px 0', borderBottom: '1px solid rgba(26,39,68,0.05)' }}>
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

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 20,
    padding: '28px 28px',
    boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px, rgba(26,39,68,0.04) 0 4px 16px',
    marginBottom: 16,
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, color: '#1a2744', letterSpacing: '-0.6px', margin: '0 0 6px' }}>
        Complete your enrollment
      </h1>
      <p style={{ fontSize: 15, color: '#717182', margin: '0 0 28px' }}>
        Secure checkout powered by Stripe
      </p>

      {/* Tab toggle */}
      <div style={{
        display: 'inline-flex',
        background: '#f0f0f4', borderRadius: 100,
        padding: 4, marginBottom: 24, gap: 4,
      }}>
        {(['full', 'installments'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            style={{
              padding: '9px 20px', borderRadius: 100, border: 'none',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.18s',
              background: tab === t ? '#1a2744' : 'transparent',
              color: tab === t ? '#fff' : '#717182',
              boxShadow: tab === t ? '0 2px 8px rgba(26,39,68,0.20)' : 'none',
            }}
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
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: '#fdeaeb', border: '1px solid rgba(208,50,56,0.2)',
            borderRadius: 14, padding: '14px 16px', marginBottom: 16,
          }}
          role="alert"
        >
          <span aria-hidden="true">⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#d03238', margin: '0 0 2px' }}>
              {stripeError.kind === 'CARD_DECLINED'    ? 'Card declined'
                : stripeError.kind === 'NETWORK_TIMEOUT' ? 'Network error'
                : stripeError.kind === 'INVALID_PLAN'    ? 'Payment plan unavailable'
                : 'Payment failed'}
            </p>
            <p style={{ fontSize: 13, color: '#9a3412', margin: 0 }}>
              {stripeError.message}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: '#d03238', lineHeight: 1, padding: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Installment schedule */}
      {tab === 'installments' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1a2744', margin: '0 0 20px' }}>Payment schedule</h2>
          <InstallmentSchedule installmentAmount={installmentAmount} currency={currency} />
          <p style={{
            fontSize: 13, color: '#717182', lineHeight: 1.6,
            background: '#f8f9fb', borderRadius: 10, padding: '12px 14px',
            margin: '16px 0 0',
          }}>
            By starting this plan, you authorize nextaibuilder to charge{' '}
            {formatMoney(installmentAmount, currency)} today and the same amount on the following two dates.
          </p>
        </div>
      )}

      {/* Card details */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1a2744', margin: '0 0 22px' }}>
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
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button
          type="button"
          onClick={onSwitchToManual}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: '#4a9ad4', fontWeight: 600,
          }}
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
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '60px 24px' }}>
        <div style={{
          background: '#fff', borderRadius: 24,
          padding: '56px 40px',
          boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px, rgba(26,39,68,0.06) 0 8px 32px',
        }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>⏳</div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#fff8e6', color: '#8a5a00',
            fontSize: 13, fontWeight: 700, padding: '6px 16px',
            borderRadius: 100, marginBottom: 20,
          }}>🕐 Under Review</span>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: '#1a2744', marginBottom: 10 }}>Receipt submitted!</h2>
          <p style={{ fontSize: 15, color: '#717182', lineHeight: 1.6, marginBottom: 32, maxWidth: 360, margin: '0 auto 32px' }}>
            Your payment receipt is being reviewed. You'll receive an email within 24–48 hours once approved.
          </p>
          <button type="button" onClick={onBack} style={{
            padding: '12px 32px', borderRadius: 100, background: '#f8f9fb',
            color: '#1a2744', fontWeight: 700, fontSize: 15,
            border: '1px solid rgba(26,39,68,0.15)', cursor: 'pointer',
          }}>
            View Dashboard
          </button>
        </div>
      </div>
    )
  }

  const isSubmitting = uploadState === 'submitting'
  const isUploading = uploadState === 'uploading'

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 20,
    boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px, rgba(26,39,68,0.04) 0 4px 16px',
    marginBottom: 14,
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      {/* Course header */}
      <div style={{ ...cardStyle, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{
          width: 72, height: 56, borderRadius: 12, flexShrink: 0,
          background: cohort.coverGradient ?? TYPE_COVER[cohort.type] ?? TYPE_COVER.recorded,
        }} />
        <div>
          <p style={{ fontSize: 12, color: '#717182', margin: '0 0 4px' }}>Enrolling in</p>
          <p style={{ fontSize: 17, fontWeight: 800, color: '#1a2744', margin: '0 0 4px' }}>{cohort.title}</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#4a9ad4', margin: 0 }}>
            Pay in full · {formatMoney(cohort.price)}
          </p>
        </div>
      </div>

      {/* Bank transfer instructions */}
      <div style={{
        ...cardStyle,
        background: '#eef6fd', borderLeft: '4px solid #4a9ad4',
        borderRadius: '0 16px 16px 0', padding: '20px 22px',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1a2744', margin: '0 0 14px' }}>Bank Transfer Instructions</h2>
        {[
          { label: 'Bank name', value: 'HSBC Pakistan' },
          { label: 'Account name', value: 'NextAI Builder Ltd' },
          { label: 'Account number', value: 'PK36 SCBL 0000 0011 2345 6700' },
          { label: 'Amount', value: `${formatMoney(cohort.price)} USD equivalent` },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#717182' }}>{label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#1a2744', background: 'rgba(26,39,68,0.06)', padding: '3px 8px', borderRadius: 6 }}>{value}</span>
          </div>
        ))}
        <p style={{ fontSize: 13, color: '#717182', margin: '12px 0 0', lineHeight: 1.55 }}>
          Transfer the amount shown and upload your receipt below. Access activates within 24 hours of approval.
        </p>
      </div>

      {/* Error */}
      {errorMessage && (
        <div style={{
          background: '#fdeaeb', border: '1px solid rgba(208,50,56,0.2)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 14,
          display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, color: '#d03238',
        }}>
          <span>⚠️</span><p style={{ margin: 0 }}>{errorMessage}</p>
        </div>
      )}

      {/* Upload zone */}
      {uploadState === 'idle' && (
        <>
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
            style={{ display: 'none' }} onChange={handleInputChange} />
          <div
            role="button" tabIndex={0}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
            style={{
              border: `2px dashed ${isDragOver ? '#1a2744' : '#4a9ad4'}`,
              borderRadius: 20, padding: '48px 32px',
              textAlign: 'center', cursor: 'pointer', marginBottom: 14,
              background: isDragOver ? '#eef6fd' : '#f8fbff',
              transition: 'all 0.18s',
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 14 }}>📤</div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#1a2744', margin: '0 0 6px' }}>Upload your payment receipt</p>
            <p style={{ fontSize: 14, color: '#717182', margin: '0 0 6px' }}>Drag & drop, or <span style={{ color: '#4a9ad4', fontWeight: 700 }}>browse files</span></p>
            <p style={{ fontSize: 12, color: '#a3a3a3', margin: 0 }}>PDF, JPG, PNG · Max 10 MB</p>
          </div>
        </>
      )}

      {isUploading && (
        <div style={{
          border: '2px dashed #4a9ad4', borderRadius: 20,
          padding: '40px 32px', textAlign: 'center', marginBottom: 14,
          background: 'linear-gradient(135deg,#eef6fd,#f0f8ff)',
        }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⏳</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1a2744', margin: '0 0 14px' }}>Uploading receipt...</p>
          <div style={{ height: 6, background: '#c8dff4', borderRadius: 100, maxWidth: 240, margin: '0 auto 8px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#4a9ad4', borderRadius: 100, width: `${Math.min(uploadProgress, 100)}%`, transition: 'width 0.2s' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4a9ad4' }}>{Math.min(uploadProgress, 100)}%</span>
        </div>
      )}

      {uploadState === 'uploaded' && uploadedFile && (
        <div style={{
          border: '2px solid rgba(5,77,40,0.25)', borderRadius: 20,
          background: '#e6f4ec', padding: '18px 20px',
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
        }}>
          <div style={{
            width: 52, height: 52, background: '#fff', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0,
            boxShadow: 'rgba(26,39,68,0.10) 0 0 0 1px',
          }}>📄</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1a2744', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedFile.name}</p>
            <p style={{ fontSize: 13, color: '#717182', margin: 0 }}>{uploadedFile.sizeLabel}</p>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#054d28', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, flexShrink: 0 }}>✓</div>
          <button type="button" onClick={() => { setUploadedFile(null); setUploadState('idle'); setUploadProgress(0) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#d03238', fontWeight: 600, flexShrink: 0 }}>
            Remove
          </button>
        </div>
      )}

      {/* Note */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional: Add a note (e.g. transaction reference number)"
        rows={3} maxLength={500}
        style={{
          width: '100%', boxSizing: 'border-box',
          borderRadius: 14, border: '1.5px solid rgba(26,39,68,0.15)',
          background: '#fff', padding: '14px 16px',
          fontSize: 14, color: '#1a2744', resize: 'none', outline: 'none',
          fontFamily: 'inherit', marginBottom: 14,
        }}
      />

      {/* Submit */}
      <button
        type="button" onClick={handleSubmit}
        disabled={!uploadedFile || isUploading || isSubmitting}
        style={{
          width: '100%', height: 56, borderRadius: 100,
          background: 'linear-gradient(135deg,#1a2744,#2d4a8a)',
          color: '#fff', border: 'none', fontSize: 16, fontWeight: 800,
          cursor: !uploadedFile || isUploading || isSubmitting ? 'not-allowed' : 'pointer',
          opacity: !uploadedFile || isUploading || isSubmitting ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(26,39,68,0.25)',
        }}
      >
        {isSubmitting ? <><Spinner />Submitting...</> : 'Submit Receipt'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#717182', fontWeight: 500 }}>
          ← Pay by card instead
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
    <div style={{ maxWidth: 480, margin: '60px auto 0', textAlign: 'center' }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '56px 40px',
        boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px, rgba(26,39,68,0.06) 0 8px 32px',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', background: '#e6f4ec',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, margin: '0 auto 24px',
        }}>✓</div>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: '#1a2744', marginBottom: 10 }}>You're enrolled!</h2>
        <p style={{ fontSize: 15, color: '#717182', lineHeight: 1.65, marginBottom: 32 }}>
          Your payment was successful. Welcome to {cohortTitle}. Check your email for access details.
        </p>
        <button type="button" onClick={() => navigate('/student/dashboard')} style={{
          padding: '13px 32px', borderRadius: 100,
          background: 'linear-gradient(135deg,#4a9ad4,#2d7ab8)',
          color: '#fff', fontSize: 15, fontWeight: 800, border: 'none',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(74,154,212,0.35)',
        }}>
          Go to My Courses →
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LoadingState / ErrorState
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid rgba(26,39,68,0.10)', borderTopColor: '#4a9ad4',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <p style={{ fontSize: 18, fontWeight: 700, color: '#1a2744' }}>{message}</p>
      <button type="button" onClick={onRetry} style={{
        padding: '10px 24px', borderRadius: 100,
        background: '#4a9ad4', color: '#0d1a3a',
        fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
      }}>Try again</button>
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
      <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
        <CheckoutNav backSlug={slug} />
        <SuccessView cohortTitle={cohort.title} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      <CheckoutNav backSlug={slug} />

      {/* Add keyframe for spinner */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .checkout-layout { flex-direction: column !important; }
          .checkout-summary { width: 100% !important; position: static !important; }
          .checkout-nav-inner { padding: 0 16px !important; }
          .checkout-page-pad { padding: 20px 16px 48px !important; }
        }
      `}</style>

      <div className="checkout-page-pad" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>
        {view === 'manual' ? (
          <ManualReceiptView
            cohort={cohort}
            cohortId={cohort.id}
            paymentPlanId={paymentPlanId}
            onBack={() => setView('checkout')}
          />
        ) : (
          /* Two-column layout */
          <div className="checkout-layout" style={{
            display: 'flex',
            gap: 32,
            alignItems: 'flex-start',
          }}>
            {/* Left — form */}
            <div style={{ flex: 1, minWidth: 0 }}>
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
            <div className="checkout-summary" style={{ width: 360, flexShrink: 0, position: 'sticky', top: 88 }}>
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
