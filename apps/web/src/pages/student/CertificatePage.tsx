// FIR-58 — Certificate page: display, share, download for completed courses
// Sprint 3 Story 15 — Wise theme migration.
//
// Design notes:
//   * Cert card radius now rides on var(--radius-xl) (40px) — the largest
//     Wise radius is the right fit for an "official" surface.
//   * Award lucide icon replaces the trophy emoji; seal uses CircleCheck.
//   * Student name is Inter 900 (class font-black) on Wise text tokens.
//   * A Wise Green accent line divides the name from the course metadata.
//   * Print styles are centralised in a single <style> block on the page,
//     not appended to document.head; the audit flagged the old DOM-mutation
//     approach as leak-prone when users revisit the page.
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Award,
  CircleCheck,
  Download,
  Share2,
  Link2,
  Linkedin,
  Twitter,
  Clipboard,
  ArrowLeft,
} from 'lucide-react'
import { fetchStudentCertificates, type StudentCertificate } from '../../lib/api'
import { TopNav } from '../../components/TopNav'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatIssuedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// The @media print block lives alongside the rest of the page as a single
// <style> node so we don't mutate document.head on mount / unmount.
const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden !important; }
    #certificate-print-root,
    #certificate-print-root * { visibility: visible !important; }
    #certificate-print-root {
      position: fixed !important;
      inset: 0 !important;
      padding: 32px !important;
    }
    nav, header, footer, .no-print { display: none !important; }
  }
`

// ---------------------------------------------------------------------------
// Certificate card (the printable visual)
// ---------------------------------------------------------------------------

interface CertificateCardProps {
  cert: StudentCertificate
  studentName: string
}

function CertificateCard({ cert, studentName }: CertificateCardProps) {
  return (
    <div
      id="certificate-print-root"
      className={cn(
        'bg-[var(--color-wise-surface)] rounded-[var(--radius-xl)] overflow-hidden mb-8',
        'shadow-[var(--shadow-card)]',
      )}
    >
      {/* Top band — Wise canvas with subtle Wise-Green accent line */}
      <div className="px-14 py-10 relative overflow-hidden bg-[var(--color-wise-canvas)]">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-semibold text-[var(--color-wise-text-muted)] tracking-[2px] uppercase mb-1">
              nextaibuilder
            </p>
            <p className="text-[13px] text-[var(--color-wise-text-muted)]">
              Certificate of Completion
            </p>
          </div>
          <div
            className={cn(
              'w-14 h-14 rounded-[var(--radius-sm)] flex items-center justify-center',
              'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
            )}
            aria-hidden="true"
          >
            <Award className="h-7 w-7" />
          </div>
        </div>
        {/* Wise-Green accent line */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-wise-primary)]"
        />
      </div>

      {/* Certificate body — floating card */}
      <div
        className={cn(
          'mx-8 rounded-[var(--radius-lg)] bg-[var(--color-wise-surface)] text-center px-14 py-14 relative -mt-5',
          'shadow-[var(--shadow-ring)]',
        )}
      >
        {/* Seal — mint with dark-green check */}
        <div
          className={cn(
            'w-[72px] h-[72px] rounded-full flex items-center justify-center mx-auto mb-7',
            'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
            'shadow-[var(--shadow-ring)]',
          )}
          aria-hidden="true"
        >
          <CircleCheck className="h-10 w-10" />
        </div>

        <p className="text-[18px] font-medium text-[var(--color-wise-text-muted)] mb-3 tracking-[0.5px]">
          This is to certify that
        </p>
        {/* Student name — Inter 900 (font-black) */}
        <h2 className="text-[48px] font-black text-[var(--color-wise-text)] tracking-[-1.5px] mb-2">
          {studentName}
        </h2>

        {/* Wise Green accent divider */}
        <div
          aria-hidden="true"
          className="mx-auto mb-6 w-[240px] h-[2px] bg-[var(--color-wise-primary)]"
        />

        <p className="text-[16px] text-[var(--color-wise-text-muted)] mb-2">
          has successfully completed
        </p>
        <h3 className="text-[32px] font-black text-[var(--color-wise-text)] tracking-[-0.8px] mb-2">
          {cert.cohortTitle}
        </h3>
        <p className="text-[15px] text-[var(--color-wise-primary-text)] font-semibold mb-8">
          A nextaibuilder {cert.cohortType} course
        </p>

        {/* Stats row */}
        <div className="flex justify-center gap-12 mb-10 flex-wrap">
          <div className="text-center">
            <p className="text-[13px] text-[var(--color-wise-text-muted)] mb-1">Completed</p>
            <p className="text-[16px] font-bold text-[var(--color-wise-text)]">
              {formatIssuedAt(cert.issuedAt)}
            </p>
          </div>
          <div className="w-px bg-[var(--color-wise-ring)]" />
          <div className="text-center">
            <p className="text-[13px] text-[var(--color-wise-text-muted)] mb-1">Lessons</p>
            <p className="text-[16px] font-bold text-[var(--color-wise-text)]">
              {cert.lessonsCompleted} of {cert.totalLessons}
            </p>
          </div>
          <div className="w-px bg-[var(--color-wise-ring)]" />
          <div className="text-center">
            <p className="text-[13px] text-[var(--color-wise-text-muted)] mb-1">Credential ID</p>
            <p className="text-[16px] font-bold text-[var(--color-wise-text)] font-mono">
              {cert.credentialId}
            </p>
          </div>
        </div>

        {/* Signature */}
        <div className="flex justify-center pt-7 border-t border-[var(--color-wise-ring)]">
          <div className="text-center">
            <p className="text-[24px] font-black text-[var(--color-wise-text)] italic tracking-[-0.5px] mb-1.5">
              {cert.instructorName}
            </p>
            <div className="w-40 h-px bg-[var(--color-wise-ring-strong)] mx-auto mb-1.5" />
            <p className="text-[12px] text-[var(--color-wise-text-muted)]">Course Instructor</p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className={cn(
          'px-14 py-5 flex items-center justify-between flex-wrap gap-2',
          'border-t border-[var(--color-wise-ring)] bg-[var(--color-wise-canvas)]',
        )}
      >
        <p className="text-[12px] text-[var(--color-wise-text-muted)]">
          Verify at nextaibuilder.com/verify/{cert.credentialId}
        </p>
        <p className="text-[12px] text-[var(--color-wise-text-muted)]">
          © {new Date().getFullYear()} nextaibuilder
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Share section
// ---------------------------------------------------------------------------

interface ShareSectionProps {
  cert: StudentCertificate
  onCopyToast: () => void
  onPrint: () => void
}

function ShareSection({ cert, onCopyToast, onPrint }: ShareSectionProps) {
  const verifyUrl = `${window.location.origin}/certificate/${cert.credentialId}`

  const shareOnLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const shareOnTwitter = () => {
    const text = `I just completed "${cert.cohortTitle}" on @nextaibuilder! Check out my certificate:`
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(verifyUrl)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(verifyUrl)
    onCopyToast()
  }

  return (
    <div className="bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-ring)] p-7">
      <p className="text-[16px] font-bold text-[var(--color-wise-text)] mb-4">
        Share your achievement
      </p>
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" size="md" leftIcon={<Linkedin className="h-4 w-4" />} onClick={shareOnLinkedIn}>
          LinkedIn
        </Button>
        <Button variant="outline" size="md" leftIcon={<Twitter className="h-4 w-4" />} onClick={shareOnTwitter}>
          Twitter / X
        </Button>
        <Button variant="outline" size="md" leftIcon={<Clipboard className="h-4 w-4" />} onClick={() => void copyLink()}>
          Copy Link
        </Button>
        <Button variant="outline" size="md" leftIcon={<Download className="h-4 w-4" />} onClick={onPrint}>
          Download PDF
        </Button>
      </div>

      {/* Verify link row */}
      <div
        className={cn(
          'mt-4 bg-[var(--color-wise-surface-soft)] rounded-[var(--radius-sm)]',
          'px-3.5 py-2.5 flex items-center gap-2',
        )}
      >
        <Link2 className="h-4 w-4 text-[var(--color-wise-text-muted)] shrink-0" aria-hidden="true" />
        <span className="text-[12px] text-[var(--color-wise-text-muted)] flex-1 truncate font-mono">
          {verifyUrl}
        </span>
        <button
          type="button"
          onClick={() => void copyLink()}
          className={cn(
            'text-[12px] font-semibold text-[var(--color-wise-primary-text)]',
            'bg-transparent border-none cursor-pointer ml-auto',
            'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2',
          )}
        >
          Copy
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Certificate selector tabs (if multiple certificates)
// ---------------------------------------------------------------------------

interface CertTabsProps {
  certs: StudentCertificate[]
  activeIndex: number
  onChange: (i: number) => void
}

function CertTabs({ certs, activeIndex, onChange }: CertTabsProps) {
  if (certs.length <= 1) return null
  return (
    <div className="flex gap-2 mb-6 flex-wrap" role="tablist" aria-label="Certificates">
      {certs.map((c, i) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={activeIndex === i}
          onClick={() => onChange(i)}
          className={cn(
            'px-4 py-2 rounded-[var(--radius-pill)] text-[14px] font-semibold border cursor-pointer transition-colors',
            'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary)] focus-visible:outline-offset-2',
            activeIndex === i
              ? 'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] border-[var(--color-wise-primary)]'
              : 'bg-[var(--color-wise-surface)] text-[var(--color-wise-text-muted)] border-[var(--color-wise-ring)] hover:border-[var(--color-wise-ring-strong)] hover:text-[var(--color-wise-text)]',
          )}
        >
          {c.cohortTitle}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CertificatePage() {
  const [certs, setCerts] = useState<StudentCertificate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [copyToast, setCopyToast] = useState(false)

  const { user } = useAuth()

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await fetchStudentCertificates()
        if (!cancelled) setCerts(data.certificates)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load certificates')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  function handlePrint() {
    window.print()
  }

  function handleCopyToast() {
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 2500)
  }

  const activeCert = certs[activeIndex]
  const studentName = user?.name ?? 'Student'

  return (
    <div className="min-h-screen bg-[var(--color-wise-canvas)]">
      {/* Single <style> block, no document.head injection. */}
      <style>{PRINT_STYLES}</style>
      <TopNav />

      <main className="px-4 sm:px-10 lg:px-20 py-12">
        <div className="max-w-[900px] mx-auto">

          {/* Back link */}
          <Link
            to="/student/dashboard"
            className={cn(
              'inline-flex items-center gap-1.5 text-[14px] font-semibold',
              'text-[var(--color-wise-text-muted)] hover:text-[var(--color-wise-text)]',
              'no-underline mb-2 transition-colors',
            )}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            My Courses
          </Link>

          {/* Page header */}
          <div className="flex items-start justify-between mb-9 flex-wrap gap-4">
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-wise-primary-text)] tracking-[1px] uppercase mb-2">
                Certificate of Completion
              </p>
              {activeCert ? (
                <>
                  <h1 className="text-[36px] font-black text-[var(--color-wise-text)] tracking-[-1px] mb-1.5">
                    {activeCert.cohortTitle}
                  </h1>
                  <p className="text-[16px] text-[var(--color-wise-text-muted)]">
                    Completed {formatIssuedAt(activeCert.issuedAt)} · {activeCert.lessonsCompleted} of {activeCert.totalLessons} lessons
                  </p>
                </>
              ) : (
                <h1 className="text-[36px] font-black text-[var(--color-wise-text)] tracking-[-1px]">
                  Your Certificates
                </h1>
              )}
            </div>
            {activeCert && (
              <div className="flex gap-2.5 flex-shrink-0 no-print flex-wrap">
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<Download className="h-4 w-4" />}
                  onClick={handlePrint}
                >
                  Download PDF
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Share2 className="h-4 w-4" />}
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `${window.location.origin}/certificate/${activeCert.credentialId}`,
                    )
                    handleCopyToast()
                  }}
                >
                  Share
                </Button>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-[var(--color-wise-danger-soft)] rounded-[var(--radius-sm)] p-4 mb-6 text-[var(--color-wise-danger)] text-[14px] font-semibold">
              {error}
            </div>
          )}

          {isLoading ? (
            <LoadingSkeleton
              variant="rect"
              height={384}
              className="rounded-[var(--radius-xl)]"
            />
          ) : certs.length === 0 ? (
            <div className="bg-[var(--color-wise-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-ring)]">
              <EmptyState
                icon={Award}
                title="No certificates yet"
                description="Complete a course to earn your certificate of completion."
                action={{ label: 'Go to My Courses', href: '/student/dashboard' }}
              />
            </div>
          ) : (
            <>
              <CertTabs certs={certs} activeIndex={activeIndex} onChange={setActiveIndex} />

              {activeCert && (
                <>
                  <CertificateCard cert={activeCert} studentName={studentName} />
                  <div className="no-print">
                    <ShareSection
                      cert={activeCert}
                      onCopyToast={handleCopyToast}
                      onPrint={handlePrint}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Copy toast */}
      {copyToast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
            'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
            'text-[14px] font-semibold px-5 py-3 rounded-[var(--radius-pill)] shadow-lg',
          )}
          role="status"
          aria-live="polite"
        >
          Link copied to clipboard!
        </div>
      )}
    </div>
  )
}
