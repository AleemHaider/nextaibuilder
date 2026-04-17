// FIR-158 — Student manual receipt upload page
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  fetchCohortBySlug,
  submitManualPaymentRequest,
  type CohortDetail,
} from '../lib/api'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_NOTE_CHARS = 500
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const ACCEPTED_ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,application/pdf'

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileTypeLabel(mime: string): string {
  if (mime === 'application/pdf') return 'PDF'
  if (mime === 'image/jpeg') return 'JPG'
  if (mime === 'image/png') return 'PNG'
  if (mime === 'image/webp') return 'WEBP'
  return 'FILE'
}

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

type PageState =
  | 'loading_cohort'
  | 'error_cohort'
  | 'idle'
  | 'uploading'
  | 'pending'
  | 'error_upload'

interface UploadedFile {
  file: File
  previewUrl: string | null // null for PDFs
  label: string
  sizeLabel: string
  typeLabel: string
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-5 h-5 rounded-full border-[3px]',
        'border-[rgba(13,26,58,0.3)] border-t-[#0d1a3a]',
        'animate-spin',
        className,
      )}
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
function ManualPaymentNav({ backSlug }: { backSlug: string }) {
  return (
    <nav
      className={cn(
        'h-[72px] bg-white flex items-center px-20',
        'shadow-[inset_0_-1px_0_rgba(26,39,68,0.12)]',
      )}
      aria-label="Manual payment navigation"
    >
      <span className="text-[22px] font-black text-[#1a2744]">nextaibuilder</span>
      <Link
        to={`/courses/${backSlug}`}
        className={cn(
          'ml-auto flex items-center gap-1.5 text-[14px] text-[#717182]',
          'hover:text-[#1a2744] transition-colors no-underline',
        )}
      >
        ← Back to course
      </Link>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// CohortHeaderCard
// ---------------------------------------------------------------------------
function CohortHeaderCard({ cohort }: { cohort: CohortDetail }) {
  const priceLabel = `Pay in full · ${formatMoney(cohort.price)}`

  return (
    <div
      className={cn(
        'bg-white rounded-[20px] p-7 mb-5',
        'shadow-[rgba(26,39,68,0.12)_0_0_0_1px]',
        'flex items-center gap-5',
      )}
    >
      <div
        className="w-20 h-16 rounded-[12px] flex-shrink-0"
        style={{
          background: cohort.coverGradient ?? 'linear-gradient(135deg, #cc4a00, #ff8c5a)',
        }}
        aria-hidden="true"
      />
      <div>
        <div className="text-[12px] text-[#717182] mb-1">Enrolling in</div>
        <div className="text-[18px] font-bold text-[#1a2744] mb-1">{cohort.title}</div>
        <div className="text-[14px] font-semibold text-[#ff8c5a]">{priceLabel}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BankInstructionsCard
// ---------------------------------------------------------------------------
function BankInstructionsCard({ amount }: { amount: number }) {
  return (
    <div
      className={cn(
        'bg-[#eef6fd] border-l-4 border-[#4a9ad4]',
        'rounded-r-[16px] p-5 mb-5',
      )}
    >
      <div className="text-[15px] font-bold text-[#1a2744] mb-3">Bank Transfer Instructions</div>

      {[
        { label: 'Bank name', value: 'HSBC Pakistan' },
        { label: 'Account name', value: 'NextAI Builder Ltd' },
        { label: 'Account number', value: 'PK36 SCBL 0000 0011 2345 6700' },
        { label: 'Amount', value: `${formatMoney(amount)} USD equivalent` },
      ].map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between mb-2">
          <span className="text-[13px] text-[#717182] font-medium">{label}</span>
          <span
            className={cn(
              'font-mono text-[14px] font-bold text-[#1a2744]',
              'bg-[rgba(26,39,68,0.05)] px-2.5 py-1 rounded-[6px]',
            )}
          >
            {value}
          </span>
        </div>
      ))}

      <p className="text-[13px] text-[#717182] mt-3 leading-relaxed">
        Transfer the amount shown above and upload your receipt below. Access will be activated
        within 24 hours of approval.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UploadZone — idle state
// ---------------------------------------------------------------------------
interface UploadZoneProps {
  onFileSelected: (file: File) => void
  dragActive: boolean
  onDragEnter: (e: DragEvent<HTMLDivElement>) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void
  onDrop: (e: DragEvent<HTMLDivElement>) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  error: string | null
}

function UploadZone({
  onFileSelected,
  dragActive,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  inputRef,
  error,
}: UploadZoneProps) {
  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
    // Reset input so re-selecting same file triggers onChange
    e.target.value = ''
  }

  return (
    <div className="mb-5">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload payment receipt — click or drag and drop"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'border-2 border-dashed rounded-[24px]',
          'bg-[#f8fbff] px-10 py-14 text-center cursor-pointer',
          'transition-all duration-150',
          dragActive
            ? 'border-[#1a2744] bg-[#eef6fd] scale-[1.01]'
            : error
              ? 'border-[#d03238] bg-[#fef2f2]'
              : 'border-[#4a9ad4] hover:bg-[#eef6fd] hover:border-[#1a2744]',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4a9ad4]/40',
        )}
      >
        <div className="text-[48px] mb-4" aria-hidden="true">
          📤
        </div>
        <div className="text-[18px] font-bold text-[#1a2744] mb-2">
          Upload your payment receipt
        </div>
        <div className="text-[15px] text-[#717182] mb-1.5">Drag & drop your receipt here, or</div>
        <span className="text-[15px] font-semibold text-[#4a9ad4]">Browse files</span>
        <div className="text-[12px] text-[#a3a3a3] mt-3">
          Accepted formats: PDF, JPG, PNG · Max size: 10MB
        </div>
      </div>
      {error && (
        <p className="text-[13px] text-[#d03238] font-medium mt-2 ml-1" role="alert">
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_ACCEPT_ATTR}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleInputChange}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// UploadingZone — progress state
// ---------------------------------------------------------------------------
function UploadingZone({ progress }: { progress: number }) {
  return (
    <div
      className={cn(
        'border-2 border-dashed border-[#4a9ad4] rounded-[24px] mb-5',
        'px-10 py-14 text-center',
        'bg-gradient-to-r from-[#eef6fd] via-[#f0f8ff] to-[#eef6fd]',
        'bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]',
      )}
      style={{
        backgroundSize: '200% 100%',
        animation: 'shimmer-upload 1.5s infinite',
      }}
      aria-live="polite"
      aria-label={`Uploading receipt, ${progress}% complete`}
    >
      <style>{`
        @keyframes shimmer-upload {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div className="text-[48px] mb-4" aria-hidden="true">
        ⏳
      </div>
      <div className="text-[18px] font-bold text-[#1a2744] mb-3">Uploading receipt...</div>
      <div className="h-1.5 bg-[#c8dff4] rounded-full mx-auto max-w-[200px] mb-2">
        <div
          className="h-full bg-[#4a9ad4] rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-[14px] font-semibold text-[#4a9ad4]">{progress}%</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UploadedFilePreview — file confirmed state
// ---------------------------------------------------------------------------
interface UploadedFilePreviewProps {
  uploadedFile: UploadedFile
  onRemove: () => void
}

function UploadedFilePreview({ uploadedFile, onRemove }: UploadedFilePreviewProps) {
  return (
    <div
      className={cn(
        'border-2 border-[rgba(5,77,40,0.3)] rounded-[24px]',
        'bg-[#e6f4ec] p-6 flex items-center gap-4 mb-5',
      )}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          'w-16 h-16 bg-white rounded-[12px] flex items-center justify-center',
          'shadow-[rgba(26,39,68,0.12)_0_0_0_1px] flex-shrink-0 overflow-hidden',
        )}
      >
        {uploadedFile.previewUrl ? (
          <img
            src={uploadedFile.previewUrl}
            alt="Receipt preview"
            className="w-full h-full object-cover rounded-[12px]"
          />
        ) : (
          <span className="text-[28px]" aria-hidden="true">
            📄
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[16px] font-bold text-[#1a2744] truncate mb-0.5">
          {uploadedFile.label}
        </div>
        <div className="text-[13px] text-[#717182]">
          {uploadedFile.sizeLabel} · {uploadedFile.typeLabel}
        </div>
      </div>

      {/* Check icon */}
      <div
        className={cn(
          'w-8 h-8 rounded-full bg-[#054d28] flex items-center justify-center',
          'text-white text-[16px] font-bold flex-shrink-0',
        )}
        aria-label="File selected successfully"
      >
        ✓
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className={cn(
          'text-[13px] font-semibold text-[#d03238] bg-none border-none cursor-pointer',
          'hover:opacity-70 transition-opacity ml-3 flex-shrink-0',
        )}
        aria-label={`Remove ${uploadedFile.label}`}
      >
        Remove
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PendingStatusCard — post-submit success state
// ---------------------------------------------------------------------------
interface PendingStatusCardProps {
  requestId: string
  onGoToCourses: () => void
}

function PendingStatusCard({ requestId, onGoToCourses }: PendingStatusCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-[24px] p-12 text-center',
        'shadow-[rgba(26,39,68,0.12)_0_0_0_1px]',
      )}
    >
      <div className="text-[64px] mb-5" aria-hidden="true">
        ⏳
      </div>
      <div
        className={cn(
          'inline-flex items-center gap-2 text-[15px] font-bold',
          'px-5 py-2.5 rounded-full bg-[#fff8e6] text-[#8a5a00] mb-6',
        )}
      >
        <span aria-hidden="true">🕐</span> Under Review
      </div>
      <div className="text-[28px] font-extrabold text-[#1a2744] mb-2">Receipt submitted!</div>
      <div className="text-[16px] text-[#717182] leading-relaxed mb-4 max-w-sm mx-auto">
        Your payment receipt is being reviewed by our team. You'll receive an email confirmation
        within 24 hours once approved.
      </div>
      <div className="text-[13px] text-[#a3a3a3] mb-8">
        Reference:{' '}
        <span className="font-mono font-bold text-[#1a2744]">{requestId}</span>
      </div>
      <button
        type="button"
        onClick={onGoToCourses}
        className={cn(
          'px-9 py-4 rounded-full font-bold text-[16px] cursor-pointer border-none',
          'bg-[#f8f9fb] text-[#1a2744] border-[1.5px] border-[rgba(26,39,68,0.15)]',
          'hover:bg-[#eef6fd] transition-colors',
        )}
      >
        Browse Courses
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ErrorStatusCard — upload error state
// ---------------------------------------------------------------------------
interface ErrorStatusCardProps {
  message: string
  onRetry: () => void
}

function ErrorStatusCard({ message, onRetry }: ErrorStatusCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-[24px] p-12 text-center',
        'shadow-[rgba(26,39,68,0.12)_0_0_0_1px]',
      )}
    >
      <div className="text-[64px] mb-5" aria-hidden="true">
        ⚠️
      </div>
      <div
        className={cn(
          'inline-flex items-center gap-2 text-[15px] font-bold',
          'px-5 py-2.5 rounded-full bg-[#fdeaeb] text-[#d03238] mb-6',
        )}
      >
        Submission Failed
      </div>
      <div className="text-[28px] font-extrabold text-[#1a2744] mb-2">Something went wrong</div>
      <div
        className={cn(
          'bg-[#fdeaeb] rounded-[14px] px-5 py-4 mb-8 text-left max-w-sm mx-auto',
        )}
      >
        <div className="text-[12px] font-bold text-[#d03238] uppercase tracking-wide mb-1.5">
          Error
        </div>
        <div className="text-[15px] text-[#d03238] leading-relaxed">{message}</div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'px-9 py-4 rounded-full font-bold text-[16px] cursor-pointer border-none',
          'bg-[#d03238] text-white hover:opacity-90 transition-opacity',
        )}
      >
        Try Again
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function ManualPaymentPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  // ---- Data ----
  const [cohort, setCohort] = useState<CohortDetail | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading_cohort')
  const [cohortError, setCohortError] = useState<string | null>(null)

  // ---- File upload ----
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---- Form fields ----
  const [note, setNote] = useState('')

  // ---- Result ----
  const [requestId, setRequestId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Cleanup object URLs on unmount to avoid memory leaks
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  // Fetch cohort on mount
  useEffect(() => {
    if (!slug) {
      setCohortError('No cohort slug provided.')
      setPageState('error_cohort')
      return
    }

    let cancelled = false

    async function load() {
      try {
        const data = await fetchCohortBySlug(slug as string)
        if (cancelled) return
        if (!data) {
          setCohortError('Course not found.')
          setPageState('error_cohort')
        } else {
          setCohort(data)
          setPageState('idle')
        }
      } catch {
        if (cancelled) return
        setCohortError('Failed to load course details. Please refresh and try again.')
        setPageState('error_cohort')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  // ---- File validation + selection ----
  const handleFileSelected = useCallback((file: File) => {
    setFileError(null)

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setFileError('Invalid file type. Please upload a PDF, JPG, or PNG.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError('File is too large. Maximum size is 10 MB.')
      return
    }

    // Revoke previous preview URL if any
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    let previewUrl: string | null = null
    if (file.type !== 'application/pdf') {
      previewUrl = URL.createObjectURL(file)
      previewUrlRef.current = previewUrl
    }

    setUploadedFile({
      file,
      previewUrl,
      label: file.name,
      sizeLabel: formatFileSize(file.size),
      typeLabel: getFileTypeLabel(file.type),
    })
  }, [])

  const handleRemoveFile = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setUploadedFile(null)
    setFileError(null)
  }, [])

  // ---- Drag handlers ----
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelected(file)
    },
    [handleFileSelected],
  )

  // ---- Submit ----
  async function handleSubmit() {
    if (!uploadedFile || !cohort) return

    setPageState('uploading')
    setUploadProgress(0)

    // Simulate progress while the real upload runs
    progressIntervalRef.current = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
          return 90
        }
        return prev + Math.floor(Math.random() * 12) + 5
      })
    }, 300)

    try {
      const formData = new FormData()
      formData.append('cohortId', cohort.id)
      formData.append('file', uploadedFile.file)
      if (note.trim()) formData.append('note', note.trim())

      const result = await submitManualPaymentRequest(formData)

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      setUploadProgress(100)

      // Brief pause so 100% is visible before transition
      await new Promise<void>((resolve) => setTimeout(resolve, 400))

      setRequestId(result.requestId)
      setPageState('pending')
    } catch (err) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      setUploadError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setPageState('error_upload')
    }
  }

  function handleRetry() {
    setUploadError(null)
    setUploadedFile(null)
    setNote('')
    setPageState('idle')
  }

  // ---- Loading skeleton ----
  if (pageState === 'loading_cohort') {
    return (
      <div className="min-h-screen bg-[#f8f9fb]">
        <nav className="h-[72px] bg-white shadow-[inset_0_-1px_0_rgba(26,39,68,0.12)] flex items-center px-20">
          <span className="text-[22px] font-black text-[#1a2744]">nextaibuilder</span>
        </nav>
        <div className="flex items-center justify-center min-h-[calc(100vh-72px)]">
          <Spinner className="w-10 h-10 border-4 border-[rgba(26,39,68,0.1)] border-t-[#4a9ad4]" />
        </div>
      </div>
    )
  }

  // ---- Cohort error ----
  if (pageState === 'error_cohort' || !cohort) {
    return (
      <div className="min-h-screen bg-[#f8f9fb]">
        <nav className="h-[72px] bg-white shadow-[inset_0_-1px_0_rgba(26,39,68,0.12)] flex items-center px-20">
          <span className="text-[22px] font-black text-[#1a2744]">nextaibuilder</span>
        </nav>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-72px)] gap-4 px-6 text-center">
          <div className="text-[48px]" aria-hidden="true">⚠️</div>
          <div className="text-[22px] font-bold text-[#1a2744]">{cohortError ?? 'Course not found'}</div>
          <Link
            to="/courses"
            className={cn(
              'px-7 py-3 rounded-full bg-[#4a9ad4] text-[#0d1a3a]',
              'text-[15px] font-bold hover:opacity-90 transition-opacity no-underline',
            )}
          >
            Browse Courses
          </Link>
        </div>
      </div>
    )
  }

  const canSubmit = uploadedFile !== null && pageState === 'idle'

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <ManualPaymentNav backSlug={slug ?? ''} />

      <main className="px-20 py-12">
        <div className="max-w-[640px] mx-auto">

          {/* --- Upload form states --- */}
          {(pageState === 'idle' || pageState === 'uploading') && (
            <>
              <CohortHeaderCard cohort={cohort} />
              <BankInstructionsCard amount={cohort.price} />

              {/* Upload zone or uploading progress */}
              {pageState === 'uploading' ? (
                <UploadingZone progress={uploadProgress} />
              ) : uploadedFile ? (
                <UploadedFilePreview
                  uploadedFile={uploadedFile}
                  onRemove={handleRemoveFile}
                />
              ) : (
                <UploadZone
                  onFileSelected={handleFileSelected}
                  dragActive={dragActive}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  inputRef={inputRef}
                  error={fileError}
                />
              )}

              {/* Note textarea */}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_CHARS))}
                placeholder="Optional: Add a note about your payment (e.g., transaction reference number)"
                maxLength={MAX_NOTE_CHARS}
                rows={4}
                disabled={pageState === 'uploading'}
                aria-label="Optional payment note"
                className={cn(
                  'w-full rounded-[16px] border-[1.5px] border-[rgba(26,39,68,0.15)]',
                  'bg-white px-4 py-4 text-[15px] text-[#1a2744]',
                  'font-sans resize-none outline-none mb-5',
                  'placeholder:text-[#a3a3a3]',
                  'focus:border-[#4a9ad4] transition-colors',
                  pageState === 'uploading' && 'opacity-50 cursor-not-allowed',
                )}
              />
              {note.length > 0 && (
                <div className="text-[12px] text-[#a3a3a3] text-right -mt-4 mb-4">
                  {note.length}/{MAX_NOTE_CHARS}
                </div>
              )}

              {/* Submit button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-disabled={!canSubmit}
                className={cn(
                  'w-full h-14 rounded-full font-bold text-[17px] border-none cursor-pointer',
                  'transition-opacity font-sans',
                  canSubmit
                    ? 'bg-[#4a9ad4] text-[#0d1a3a] hover:opacity-90'
                    : 'bg-[#4a9ad4] text-[#0d1a3a] opacity-50 cursor-not-allowed',
                  pageState === 'uploading' && 'opacity-50 cursor-not-allowed',
                )}
              >
                {pageState === 'uploading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner /> Uploading...
                  </span>
                ) : (
                  'Submit Receipt'
                )}
              </button>
            </>
          )}

          {/* --- Pending / success state --- */}
          {pageState === 'pending' && requestId && (
            <PendingStatusCard
              requestId={requestId}
              onGoToCourses={() => navigate('/courses')}
            />
          )}

          {/* --- Error state --- */}
          {pageState === 'error_upload' && uploadError && (
            <ErrorStatusCard message={uploadError} onRetry={handleRetry} />
          )}
        </div>
      </main>
    </div>
  )
}
