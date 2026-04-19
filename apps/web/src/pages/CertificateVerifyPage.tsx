// Sprint 2 Story 7 — Public /verify-certificate/:token page.
//
// BRD-mandatory surface: a recruiter/employer pastes a shared credential
// URL (e.g. https://nextaibuilder.com/verify-certificate/NAB-2024-000042)
// to confirm the certificate was genuinely issued. The page is unauth'd.
//
// Behaviour
// ─────────
//   • No :token in the URL → render a centered search form that navigates
//     to /verify-certificate/:input on submit.
//   • :token present → fetch /api/v1/certificate/verify/:token and branch
//     on the { valid, credential } envelope:
//        - credential === null  → "Certificate not found" (EmptyState)
//        - status === 'REVOKED' → "Certificate revoked"   (EmptyState)
//        - status === 'VALID'   → green Wise card with student/cohort data
//
// The endpoint returns HTTP 200 even for not-found so we don't need a 404
// branch — see apps/api/src/routes/certificate.ts for the rationale.
//
// Styling leans entirely on the Wise tokens from styles/index.css — no
// hardcoded hex. Icons are lucide-only per the project convention.
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Ban,
  CircleCheck,
  Copy,
  Printer,
  Search,
  ShieldX,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { cn } from '../lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface CertificateCredential {
  credentialId: string
  studentName: string
  cohortTitle: string
  completedAt: string | null
  issuedAt: string
  status: 'VALID' | 'REVOKED'
}

interface VerifyResponse {
  valid: boolean
  credential: CertificateCredential | null
}

type VerifyState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'valid'; credential: CertificateCredential }
  | { kind: 'revoked'; credential: CertificateCredential }
  | { kind: 'not_found' }
  | { kind: 'error' }

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function CertificateVerifyPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [state, setState] = useState<VerifyState>({ kind: 'idle' })
  const [searchValue, setSearchValue] = useState('')
  const [copied, setCopied] = useState(false)

  // Fetch whenever the token in the URL changes. Abort any in-flight request
  // when the component unmounts or the token is replaced mid-flight.
  useEffect(() => {
    if (!token || !token.trim()) {
      setState({ kind: 'idle' })
      return
    }

    const controller = new AbortController()
    setState({ kind: 'loading' })

    fetch(`/api/v1/certificate/verify/${encodeURIComponent(token)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          setState({ kind: 'error' })
          return
        }
        const body = (await res.json()) as VerifyResponse
        if (!body.credential) {
          setState({ kind: 'not_found' })
          return
        }
        if (body.credential.status === 'REVOKED') {
          setState({ kind: 'revoked', credential: body.credential })
          return
        }
        setState({ kind: 'valid', credential: body.credential })
      })
      .catch((err: unknown) => {
        // Aborts are expected during fast route flips; don't surface them.
        if (err instanceof DOMException && err.name === 'AbortError') return
        setState({ kind: 'error' })
      })

    return () => controller.abort()
  }, [token])

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = searchValue.trim()
    if (!next) return
    navigate(`/verify-certificate/${encodeURIComponent(next)}`)
  }

  function handlePrint() {
    if (typeof window !== 'undefined') window.print()
  }

  async function handleCopyLink() {
    if (typeof window === 'undefined') return
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can fail in insecure contexts; fail silently.
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'min-h-screen w-full',
        'bg-[var(--color-wise-canvas)] text-[var(--color-wise-text)]',
      )}
    >
      <div className="max-w-[640px] mx-auto py-16 px-6">
        <header className="mb-10 text-center">
          <p
            className={cn(
              'text-[12px] font-semibold tracking-[0.18em] uppercase',
              'text-[var(--color-wise-text-muted)] mb-3',
            )}
          >
            Certificate verification
          </p>
          <h1
            className={cn(
              'text-[32px] md:text-[36px] font-black tracking-[-0.5px]',
              'text-[var(--color-wise-text)]',
            )}
          >
            Verify a nextaibuilder credential
          </h1>
          <p
            className={cn(
              'mt-3 text-[15px] max-w-md mx-auto',
              'text-[var(--color-wise-text-muted)]',
            )}
          >
            Confirm the authenticity of a nextaibuilder certificate. This page
            is public and requires no sign-in.
          </p>
        </header>

        {/* Body — branches by state */}
        {state.kind === 'idle' ? (
          <SearchForm
            value={searchValue}
            onChange={setSearchValue}
            onSubmit={handleSearchSubmit}
          />
        ) : null}

        {state.kind === 'loading' ? (
          <div
            data-testid="verify-loading"
            className={cn(
              'rounded-2xl border p-10',
              'bg-[var(--color-wise-surface)]',
              'border-[var(--color-wise-surface-soft)]',
            )}
          >
            <LoadingSpinner centered size="lg" label="Verifying credential" />
          </div>
        ) : null}

        {state.kind === 'valid' ? (
          <ValidCard
            credential={state.credential}
            copied={copied}
            onPrint={handlePrint}
            onCopy={handleCopyLink}
          />
        ) : null}

        {state.kind === 'revoked' ? (
          <div
            className={cn(
              'rounded-2xl border',
              'bg-[var(--color-wise-surface)]',
              'border-[var(--color-wise-surface-soft)]',
            )}
          >
            <EmptyState
              icon={Ban}
              title="Certificate revoked"
              description={`Credential ID ${state.credential.credentialId} was revoked by the issuer and is no longer valid.`}
            />
          </div>
        ) : null}

        {state.kind === 'not_found' ? (
          <div
            className={cn(
              'rounded-2xl border',
              'bg-[var(--color-wise-surface)]',
              'border-[var(--color-wise-surface-soft)]',
            )}
          >
            <EmptyState
              icon={ShieldX}
              title="Certificate not found"
              description="The credential ID you entered doesn't match any issued certificate."
              action={{
                label: 'Try another ID',
                onClick: () => navigate('/verify-certificate'),
              }}
            />
          </div>
        ) : null}

        {state.kind === 'error' ? (
          <div
            className={cn(
              'rounded-2xl border',
              'bg-[var(--color-wise-surface)]',
              'border-[var(--color-wise-surface-soft)]',
            )}
          >
            <EmptyState
              icon={ShieldX}
              title="Something went wrong"
              description="We couldn't reach the verification service. Please try again."
              action={{
                label: 'Retry',
                onClick: () => {
                  if (token) navigate(0)
                },
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────

interface SearchFormProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

function SearchForm({ value, onChange, onSubmit }: SearchFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      aria-label="Verify certificate"
      className={cn(
        'rounded-2xl border p-6 md:p-8 flex flex-col gap-4',
        'bg-[var(--color-wise-surface)]',
        'border-[var(--color-wise-surface-soft)]',
      )}
    >
      <label
        htmlFor="credential-id-input"
        className={cn(
          'text-[14px] font-semibold',
          'text-[var(--color-wise-text)]',
        )}
      >
        Enter a credential ID to verify
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2',
              'h-4 w-4 text-[var(--color-wise-text-muted)]',
            )}
          />
          <input
            id="credential-id-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. NAB-2024-000042"
            autoComplete="off"
            spellCheck={false}
            className={cn(
              'w-full h-11 rounded-full pl-10 pr-4 text-[15px]',
              'bg-[var(--color-wise-canvas)]',
              'border border-[var(--color-wise-surface-soft)]',
              'text-[var(--color-wise-text)]',
              'placeholder:text-[var(--color-wise-text-muted)]',
              'focus:outline-none focus:border-[var(--color-wise-primary)]',
            )}
          />
        </div>
        <Button type="submit" variant="primary" size="md">
          Verify
        </Button>
      </div>
      <p
        className={cn(
          'text-[13px]',
          'text-[var(--color-wise-text-muted)]',
        )}
      >
        Credential IDs appear on every nextaibuilder certificate.
      </p>
    </form>
  )
}

interface ValidCardProps {
  credential: CertificateCredential
  copied: boolean
  onPrint: () => void
  onCopy: () => void
}

function ValidCard({ credential, copied, onPrint, onCopy }: ValidCardProps) {
  const fields: Array<{ label: string; value: string }> = [
    { label: 'Student', value: credential.studentName || '—' },
    { label: 'Cohort', value: credential.cohortTitle || '—' },
    { label: 'Completed', value: formatDate(credential.completedAt) },
    { label: 'Issued', value: formatDate(credential.issuedAt) },
    { label: 'Status', value: credential.status },
    { label: 'Issuer', value: 'nextaibuilder' },
  ]

  return (
    <article
      data-testid="verify-valid-card"
      className={cn(
        'rounded-2xl border p-6 md:p-10',
        'bg-[var(--color-wise-surface)]',
        'border-[var(--color-wise-surface-soft)]',
      )}
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div
          data-testid="verify-valid-icon"
          className={cn(
            'h-14 w-14 rounded-2xl flex items-center justify-center',
            'bg-[var(--color-wise-primary)]',
            'text-[var(--color-wise-primary-text)]',
          )}
        >
          <CircleCheck className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2
          className={cn(
            'text-[24px] md:text-[28px] font-black tracking-[-0.4px]',
            'text-[var(--color-wise-text)]',
          )}
        >
          Certificate Verified
        </h2>
        <p
          className={cn(
            'text-[14px] font-mono',
            'text-[var(--color-wise-text-muted)]',
          )}
        >
          {credential.credentialId}
        </p>
      </div>

      <dl
        className={cn(
          'mt-8 border-t',
          'border-[var(--color-wise-surface-soft)]',
        )}
      >
        {fields.map((f) => (
          <div
            key={f.label}
            className={cn(
              'flex flex-col sm:flex-row sm:items-center sm:justify-between',
              'py-3 border-b',
              'border-[var(--color-wise-surface-soft)]',
            )}
          >
            <dt
              className={cn(
                'text-[13px] font-semibold uppercase tracking-[0.08em]',
                'text-[var(--color-wise-text-muted)]',
              )}
            >
              {f.label}
            </dt>
            <dd
              className={cn(
                'text-[15px] font-medium mt-1 sm:mt-0',
                'text-[var(--color-wise-text)]',
              )}
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          size="md"
          leftIcon={<Printer className="h-4 w-4" aria-hidden="true" />}
          onClick={onPrint}
        >
          Print
        </Button>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Copy className="h-4 w-4" aria-hidden="true" />}
          onClick={onCopy}
        >
          {copied ? 'Link copied' : 'Copy shareable link'}
        </Button>
      </div>
    </article>
  )
}
