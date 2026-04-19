// FIR-158 / Sprint 2 Story 8 — Public manual payment receipt upload page.
//
// Flow:
//   - URL is /manual-payment/:slug (public, no auth wrapper on the route).
//   - Fetch cohort detail by slug to render course title + pricing context.
//   - Render form: Full name, Email (auto-filled when logged in), Payment
//     method (select), Transaction reference (optional), Receipt file
//     (jpg/png/pdf, ≤10 MB), Notes (optional).
//   - Submit: POST multipart to /api/v1/student/manual-payment/request. The
//     backend requires student auth, so if the visitor is not signed in we
//     bounce them to /login with a return-to.
//   - After a successful submit we show an <EmptyState icon={CircleCheck}>
//     confirmation and poll /api/v1/student/manual-payment/:requestId every
//     5 s (only while the tab is visible) for status transitions.
//
// Components: Button, Input, FormField, LoadingSpinner, EmptyState (Wave 6).
// Icons: lucide-react only. Colors: Wise token CSS custom properties.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  Clock3,
  FileText,
  Upload,
} from 'lucide-react'
import {
  fetchCohortBySlug,
  fetchManualPaymentStatus,
  submitManualPaymentRequest,
  type CohortDetail,
  type ManualPaymentStatusResponse,
} from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { FormField } from '../components/ui/FormField'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
] as const
const ACCEPTED_ACCEPT_ATTR = 'image/jpeg,image/jpg,image/png,application/pdf'
const POLL_INTERVAL_MS = 5000
const MAX_NOTE_CHARS = 500

type PaymentMethod = 'BANK_TRANSFER' | 'WIRE' | 'OTHER'

interface FormState {
  fullName: string
  email: string
  paymentMethod: PaymentMethod
  transactionRef: string
  notes: string
  file: File | null
}

interface FieldErrors {
  fullName?: string
  email?: string
  file?: string
  notes?: string
}

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

function isValidEmail(email: string): boolean {
  // Pragmatic email regex — good enough for inline client validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function validate(form: FormState): FieldErrors {
  const errs: FieldErrors = {}

  if (!form.fullName.trim()) {
    errs.fullName = 'Please enter your full name.'
  }

  if (!form.email.trim()) {
    errs.email = 'Please enter your email.'
  } else if (!isValidEmail(form.email)) {
    errs.email = 'Please enter a valid email address.'
  }

  if (!form.file) {
    errs.file = 'Please upload a receipt (JPG, PNG, or PDF).'
  } else {
    if (!ACCEPTED_MIME_TYPES.includes(form.file.type as typeof ACCEPTED_MIME_TYPES[number])) {
      errs.file = 'Receipt must be a JPG, PNG, or PDF file.'
    } else if (form.file.size > MAX_FILE_BYTES) {
      errs.file = 'Receipt must be 10 MB or smaller.'
    }
  }

  if (form.notes.length > MAX_NOTE_CHARS) {
    errs.notes = `Notes must be ${MAX_NOTE_CHARS} characters or fewer.`
  }

  return errs
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ManualPaymentStatusResponse['status'] }) {
  const map = {
    PENDING: {
      icon: Clock3,
      label: 'Pending review',
      // Wise warning token; fall back to muted surface if absent.
      className:
        'bg-[var(--color-wise-warning-soft,#fff4d6)] text-[var(--color-wise-warning-text,#7a5a00)]',
    },
    APPROVED: {
      icon: CircleCheck,
      label: 'Approved',
      className:
        'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
    },
    REJECTED: {
      icon: CircleX,
      label: 'Rejected',
      className:
        'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',
    },
  } as const

  const entry = map[status]
  const Icon = entry.icon

  return (
    <span
      data-testid="manual-payment-status-badge"
      data-status={status}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-1.5',
        'text-[13px] font-semibold',
        entry.className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {entry.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Polling hook
// ---------------------------------------------------------------------------

/**
 * Poll the manual payment status every `intervalMs` while:
 *   - `requestId` is provided
 *   - status is still PENDING
 *   - document.visibilityState === 'visible'
 *
 * Stops on APPROVED / REJECTED or when the component unmounts.
 */
export function useManualPaymentStatus(
  requestId: string | null,
  intervalMs: number = POLL_INTERVAL_MS,
) {
  const [status, setStatus] = useState<ManualPaymentStatusResponse | null>(null)

  useEffect(() => {
    if (!requestId) return
    let cancelled = false
    let timerId: ReturnType<typeof setInterval> | null = null

    async function tick() {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return
      }
      try {
        const data = await fetchManualPaymentStatus(requestId as string)
        if (cancelled) return
        setStatus(data)
        if (data.status !== 'PENDING' && timerId !== null) {
          clearInterval(timerId)
          timerId = null
        }
      } catch {
        // Swallow — polling is best-effort; the user can refresh.
      }
    }

    // Fire immediately, then on interval.
    void tick()
    timerId = setInterval(() => { void tick() }, intervalMs)

    return () => {
      cancelled = true
      if (timerId !== null) clearInterval(timerId)
    }
  }, [requestId, intervalMs])

  return status
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PageHeader({ slug }: { slug: string }) {
  return (
    <nav
      aria-label="Manual payment navigation"
      className={cn(
        'h-[72px] bg-[var(--color-wise-surface)] flex items-center',
        'px-4 sm:px-10 md:px-20',
        'shadow-[inset_0_-1px_0_var(--color-wise-ring)]',
      )}
    >
      <span className="text-[20px] sm:text-[22px] font-black text-[var(--color-wise-text)]">
        nextaibuilder
      </span>
      <Link
        to={`/courses/${slug}`}
        className={cn(
          'ml-auto inline-flex items-center gap-1.5 text-[14px]',
          'text-[var(--color-wise-text-muted)] hover:text-[var(--color-wise-text)]',
          'transition-colors no-underline',
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to course
      </Link>
    </nav>
  )
}

function CohortHeaderCard({ cohort }: { cohort: CohortDetail }) {
  return (
    <div
      data-testid="cohort-header-card"
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-2xl p-5 sm:p-7 mb-5',
        'shadow-[inset_0_0_0_1px_var(--color-wise-ring)]',
        'flex items-center gap-4 sm:gap-5',
      )}
    >
      <div
        className="w-16 h-14 sm:w-20 sm:h-16 rounded-xl flex-shrink-0"
        style={{
          background: cohort.coverGradient ?? 'linear-gradient(135deg,#1a2744,#4a9ad4)',
        }}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div className="text-[12px] text-[var(--color-wise-text-muted)] mb-1">
          Enrolling in
        </div>
        <div
          className="text-[16px] sm:text-[18px] font-bold text-[var(--color-wise-text)] mb-1 truncate"
          data-testid="cohort-title"
        >
          {cohort.title}
        </div>
        <div className="text-[14px] font-semibold text-[var(--color-wise-primary-text)]">
          Pay in full · {formatMoney(cohort.price)}
        </div>
      </div>
    </div>
  )
}

interface ReceiptFileInputProps {
  file: File | null
  error?: string
  onChange: (file: File | null) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

function ReceiptFileInput({ file, error, onChange, inputRef }: ReceiptFileInputProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null
    onChange(next)
    // Reset so re-selecting the same file fires onChange again
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="receipt-file"
        className="text-[14px] font-semibold text-[var(--color-wise-text)]"
      >
        Payment receipt
        <span aria-hidden="true" className="ml-0.5 text-[var(--color-wise-danger)]">*</span>
      </label>

      <div
        className={cn(
          'rounded-xl border-2 border-dashed p-4 flex items-center gap-3',
          'bg-[var(--color-wise-surface-soft)]',
          error
            ? 'border-[var(--color-wise-danger)]'
            : 'border-[var(--color-wise-ring-strong)]',
        )}
      >
        <div
          className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
            'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
          )}
          aria-hidden="true"
        >
          {file ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
        </div>

        <div className="flex-1 min-w-0">
          {file ? (
            <>
              <div className="text-[14px] font-semibold text-[var(--color-wise-text)] truncate">
                {file.name}
              </div>
              <div className="text-[12px] text-[var(--color-wise-text-muted)]">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </>
          ) : (
            <>
              <div className="text-[14px] font-semibold text-[var(--color-wise-text)]">
                Upload a receipt
              </div>
              <div className="text-[12px] text-[var(--color-wise-text-muted)]">
                JPG, PNG, or PDF · Max 10 MB
              </div>
            </>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          {file ? 'Change' : 'Choose file'}
        </Button>

        <input
          ref={inputRef}
          id="receipt-file"
          type="file"
          accept={ACCEPTED_ACCEPT_ATTR}
          className="sr-only"
          onChange={handleChange}
          aria-describedby={error ? 'receipt-file-error' : undefined}
          aria-invalid={error ? true : undefined}
        />
      </div>

      {error ? (
        <p
          id="receipt-file-error"
          role="alert"
          className="text-[12px] font-semibold text-[var(--color-wise-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ManualPaymentPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuth()

  // ── Cohort state ────────────────────────────────────────────────────────
  const [cohort, setCohort] = useState<CohortDetail | null>(null)
  const [loadingCohort, setLoadingCohort] = useState(true)
  const [cohortError, setCohortError] = useState<string | null>(null)

  // ── Form state ──────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({
    fullName: user?.name ?? '',
    email: user?.email ?? '',
    paymentMethod: 'BANK_TRANSFER',
    transactionRef: '',
    notes: '',
    file: null,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Result state ────────────────────────────────────────────────────────
  const [requestId, setRequestId] = useState<string | null>(null)

  // Auto-fill email/name once auth hydrates.
  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || user.name || '',
        email: prev.email || user.email || '',
      }))
    }
  }, [user])

  // Fetch cohort on mount.
  useEffect(() => {
    if (!slug) {
      setCohortError('No cohort slug provided.')
      setLoadingCohort(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchCohortBySlug(slug)
        if (cancelled) return
        if (!data) {
          setCohortError('Course not found.')
        } else {
          setCohort(data)
        }
      } catch {
        if (cancelled) return
        setCohortError('Failed to load course. Please refresh and try again.')
      } finally {
        if (!cancelled) setLoadingCohort(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  // Status polling (only after a successful submit).
  const polledStatus = useManualPaymentStatus(requestId)
  const currentStatus: ManualPaymentStatusResponse['status'] =
    polledStatus?.status ?? 'PENDING'

  // ── Handlers ────────────────────────────────────────────────────────────

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    // Clear the inline error for that field as the user edits.
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitError(null)

    const validation = validate(form)
    setErrors(validation)
    if (Object.keys(validation).length > 0) return

    if (!cohort) return

    // The backend POST requires student auth. If the visitor is not signed
    // in, bounce them to /login with a return path back here.
    if (!isAuthenticated) {
      navigate(
        `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
      )
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('cohortId', cohort.id)
      fd.append('file', form.file as File)
      fd.append('fullName', form.fullName.trim())
      fd.append('email', form.email.trim())
      fd.append('paymentMethod', form.paymentMethod)
      if (form.transactionRef.trim()) {
        fd.append('transactionRef', form.transactionRef.trim())
      }
      const combinedNote = [
        form.transactionRef.trim() ? `Ref: ${form.transactionRef.trim()}` : '',
        form.notes.trim(),
      ]
        .filter(Boolean)
        .join(' — ')
      if (combinedNote) fd.append('note', combinedNote)

      const result = await submitManualPaymentRequest(fd)
      setRequestId(result.requestId)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const submitDisabled = submitting || loadingCohort || cohort == null

  // Merged status when available — the polled feed is the source of truth.
  const confirmationDescription = useMemo(() => {
    if (currentStatus === 'APPROVED') {
      return 'Your payment was approved — you now have access to the course. Check your email for confirmation.'
    }
    if (currentStatus === 'REJECTED') {
      return (
        polledStatus?.rejectionReason ??
        'Your submission was rejected. Please contact support with your reference ID.'
      )
    }
    return (
      'Our team will review your payment within 24–48 hours. ' +
      "You'll receive an email once approved."
    )
  }, [currentStatus, polledStatus?.rejectionReason])

  const confirmationIcon =
    currentStatus === 'APPROVED'
      ? CircleCheck
      : currentStatus === 'REJECTED'
        ? CircleX
        : CircleCheck

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loadingCohort) {
    return (
      <div className="min-h-screen bg-[var(--color-wise-surface-soft)]">
        <PageHeader slug={slug ?? ''} />
        <main className="px-4 sm:px-10 md:px-20 py-12">
          <div className="max-w-[640px] mx-auto">
            <LoadingSpinner centered label="Loading course details" size="lg" />
          </div>
        </main>
      </div>
    )
  }

  // ── Cohort error ────────────────────────────────────────────────────────
  if (cohortError || !cohort) {
    return (
      <div className="min-h-screen bg-[var(--color-wise-surface-soft)]">
        <PageHeader slug={slug ?? ''} />
        <main className="px-4 sm:px-10 md:px-20 py-12">
          <div className="max-w-[640px] mx-auto">
            <EmptyState
              icon={CircleX}
              title="Course not found"
              description={cohortError ?? 'We could not load the cohort.'}
              action={{ label: 'Browse courses', href: '/courses' }}
            />
          </div>
        </main>
      </div>
    )
  }

  // ── Confirmation state ──────────────────────────────────────────────────
  if (requestId) {
    return (
      <div className="min-h-screen bg-[var(--color-wise-surface-soft)]">
        <PageHeader slug={slug} />
        <main className="px-4 sm:px-10 md:px-20 py-12">
          <div className="max-w-[640px] mx-auto">
            <div
              className={cn(
                'bg-[var(--color-wise-surface)] rounded-2xl p-6 sm:p-10',
                'shadow-[inset_0_0_0_1px_var(--color-wise-ring)]',
              )}
            >
              <EmptyState
                icon={confirmationIcon}
                title="Receipt submitted"
                description={confirmationDescription}
              >
                <div className="flex flex-col items-center gap-3 mt-2">
                  <StatusBadge status={currentStatus} />
                  <p className="text-[12px] text-[var(--color-wise-text-muted)]">
                    Reference ID:{' '}
                    <span
                      data-testid="manual-payment-request-id"
                      className="font-mono font-semibold text-[var(--color-wise-text)]"
                    >
                      {requestId}
                    </span>
                  </p>
                  <div className="flex gap-3 mt-2">
                    <Link
                      to={`/manual-payment/${slug}/status/${requestId}`}
                      data-testid="manual-payment-status-link"
                      className={cn(
                        'text-[14px] font-semibold underline',
                        'text-[var(--color-wise-text-muted)] hover:text-[var(--color-wise-text)]',
                      )}
                    >
                      View request status
                    </Link>
                    <Link
                      to="/courses"
                      className={cn(
                        'text-[14px] font-semibold underline',
                        'text-[var(--color-wise-text-muted)] hover:text-[var(--color-wise-text)]',
                      )}
                    >
                      Browse more courses
                    </Link>
                  </div>
                </div>
              </EmptyState>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Uploading overlay ───────────────────────────────────────────────────
  if (submitting) {
    return (
      <div className="min-h-screen bg-[var(--color-wise-surface-soft)]">
        <PageHeader slug={slug} />
        <main className="px-4 sm:px-10 md:px-20 py-12">
          <div className="max-w-[640px] mx-auto">
            <div
              className={cn(
                'bg-[var(--color-wise-surface)] rounded-2xl p-10',
                'shadow-[inset_0_0_0_1px_var(--color-wise-ring)]',
                'flex flex-col items-center gap-4',
              )}
            >
              <LoadingSpinner centered size="xl" label="Uploading receipt" />
              <p className="text-[15px] font-medium text-[var(--color-wise-text)]">
                Uploading receipt…
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Main form ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-wise-surface-soft)]">
      <PageHeader slug={slug} />
      <main className="px-4 sm:px-10 md:px-20 py-8 sm:py-12">
        <div className="max-w-[640px] mx-auto">
          <CohortHeaderCard cohort={cohort} />

          <form
            data-testid="manual-payment-form"
            onSubmit={handleSubmit}
            noValidate
            className={cn(
              'bg-[var(--color-wise-surface)] rounded-2xl p-5 sm:p-7',
              'shadow-[inset_0_0_0_1px_var(--color-wise-ring)]',
              'flex flex-col gap-5',
            )}
          >
            <div>
              <h1 className="text-[20px] sm:text-[22px] font-black text-[var(--color-wise-text)] tracking-[-0.3px]">
                Upload your payment receipt
              </h1>
              <p className="text-[14px] text-[var(--color-wise-text-muted)] mt-1">
                Submit proof of your bank transfer or wire. Our team will review it
                within 24–48 hours.
              </p>
            </div>

            <FormField
              id="full-name"
              label="Full name"
              required
              errorText={errors.fullName}
            >
              <Input
                name="fullName"
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => setField('fullName', e.target.value)}
                placeholder="Jane Doe"
              />
            </FormField>

            <FormField
              id="email"
              label="Email address"
              required
              helperText={
                isAuthenticated
                  ? 'Pre-filled from your account.'
                  : 'We will use this email to contact you about your payment.'
              }
              errorText={errors.email}
            >
              <Input
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="you@example.com"
              />
            </FormField>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="payment-method"
                className="text-[14px] font-semibold text-[var(--color-wise-text)]"
              >
                Payment method
              </label>
              <select
                id="payment-method"
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={(e) => setField('paymentMethod', e.target.value as PaymentMethod)}
                className={cn(
                  'h-11 px-4 rounded-xl border bg-white text-[15px] font-medium',
                  'text-[var(--color-wise-text)]',
                  'border-[var(--color-wise-ring)] hover:border-[var(--color-wise-ring-strong)]',
                  'focus:border-[var(--color-wise-text)] focus:ring-4 focus:ring-[var(--color-wise-primary)]/25',
                  'outline-none transition-[border-color,box-shadow]',
                )}
              >
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="WIRE">Wire</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <FormField
              id="transaction-ref"
              label="Transaction reference"
              helperText="Optional — the reference number from your bank."
            >
              <Input
                name="transactionRef"
                value={form.transactionRef}
                onChange={(e) => setField('transactionRef', e.target.value)}
                placeholder="e.g. TXN-48293"
              />
            </FormField>

            <ReceiptFileInput
              file={form.file}
              error={errors.file}
              onChange={(f) => setField('file', f)}
              inputRef={fileInputRef}
            />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="notes"
                className="text-[14px] font-semibold text-[var(--color-wise-text)]"
              >
                Notes
                <span className="text-[var(--color-wise-text-muted)] font-medium ml-1">
                  (optional)
                </span>
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                maxLength={MAX_NOTE_CHARS}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Anything our team should know about this payment?"
                aria-invalid={errors.notes ? true : undefined}
                className={cn(
                  'rounded-xl border px-4 py-3 text-[15px] font-medium resize-y',
                  'bg-white text-[var(--color-wise-text)]',
                  'placeholder:text-[var(--color-wise-text-muted)]',
                  errors.notes
                    ? 'border-[var(--color-wise-danger)]'
                    : 'border-[var(--color-wise-ring)] hover:border-[var(--color-wise-ring-strong)] focus:border-[var(--color-wise-text)]',
                  'focus:ring-4 focus:ring-[var(--color-wise-primary)]/25 outline-none',
                  'transition-[border-color,box-shadow]',
                )}
              />
              {errors.notes ? (
                <p
                  role="alert"
                  className="text-[12px] font-semibold text-[var(--color-wise-danger)]"
                >
                  {errors.notes}
                </p>
              ) : (
                <p className="text-[12px] text-[var(--color-wise-text-muted)] text-right">
                  {form.notes.length}/{MAX_NOTE_CHARS}
                </p>
              )}
            </div>

            {submitError ? (
              <p
                role="alert"
                data-testid="manual-payment-submit-error"
                className={cn(
                  'rounded-xl px-4 py-3 text-[13px] font-semibold',
                  'bg-[var(--color-wise-danger-soft)] text-[var(--color-wise-danger)]',
                )}
              >
                {submitError}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={submitDisabled}
              isLoading={submitting}
              className="w-full"
            >
              Submit receipt
            </Button>

            {!isAuthenticated ? (
              <p className="text-[12px] text-[var(--color-wise-text-muted)] text-center">
                You will be asked to sign in before the receipt is submitted.
              </p>
            ) : null}
          </form>
        </div>
      </main>
    </div>
  )
}
