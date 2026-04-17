// PBA-314 — Public certificate verification page
// Route: /verify/:token — no auth required, accessible to anyone with the link
import { useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

// ── API call ─────────────────────────────────────────────────────────────────

interface VerifiedCertificate {
  id: string
  publicToken: string
  issuedAt: string
  studentName: string
  cohortName: string
}

async function fetchCertificate(token: string): Promise<VerifiedCertificate> {
  const res = await fetch(`${API_BASE}/api/certificate/verify/${encodeURIComponent(token)}`)
  if (res.status === 404) throw new Error('CERTIFICATE_NOT_FOUND')
  if (!res.ok) throw new Error('FETCH_FAILED')
  const body = (await res.json()) as { certificate: VerifiedCertificate }
  return body.certificate
}

// ── Brand logo icon ───────────────────────────────────────────────────────────

function CertLogoIcon({ size = 40 }: { size?: number }) {
  const h = Math.round(size * (70 / 64))
  return (
    <svg width={size} height={h} viewBox="0 0 64 70" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.9" d="M9.60001 41.6C9.60001 41.6 16 35.2 25.6 37.12C35.2 39.04 41.6 44.8 48 41.6C51.2 39.68 52.48 37.12 52.48 35.2V48C52.48 48 51.2 50.56 48 52.48C41.6 55.68 35.2 49.92 25.6 48C16 46.08 9.60001 52.48 9.60001 52.48V41.6Z" fill="url(#verLogo_g1)"/>
      <path opacity="0.95" d="M12.8 28.8C12.8 28.8 19.2 22.4 28.8 25.6C38.4 28.8 44.8 33.28 51.2 30.72C54.4 29.44 56.32 26.88 56.32 24.32V37.12C56.32 37.12 54.4 39.68 51.2 41.6C44.8 44.8 38.4 39.68 28.8 36.48C19.2 33.28 12.8 38.4 12.8 38.4V28.8Z" fill="url(#verLogo_g2)"/>
      <path d="M16 17.92C16 17.92 22.4 11.52 32 14.08C41.6 16.64 48 22.4 54.4 19.2C56.32 17.92 57.6 16 57.6 14.08V26.88C57.6 26.88 56.32 29.44 54.4 30.72C48 33.92 41.6 28.8 32 25.6C22.4 22.4 16 28.16 16 28.16V17.92Z" fill="url(#verLogo_g3)"/>
      <path d="M44.8 7.68C44.8 7.68 49.92 5.12 54.4 7.68C56.32 8.96 57.6 11.52 57.6 14.08V19.2C57.6 19.2 56.32 16.64 54.4 15.36C49.92 12.8 44.8 15.36 44.8 15.36V7.68Z" fill="url(#verLogo_g4)"/>
      <path opacity="0.8" d="M52.48 14.72C53.8938 14.72 55.04 13.2873 55.04 11.52C55.04 9.75269 53.8938 8.32 52.48 8.32C51.0661 8.32 49.92 9.75269 49.92 11.52C49.92 13.2873 51.0661 14.72 52.48 14.72Z" fill="url(#verLogo_g5)"/>
      <defs>
        <linearGradient id="verLogo_g1" x1="9.60001" y1="35.2" x2="52.48" y2="52.48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A2744"/><stop offset="1" stopColor="#4A90C4"/>
        </linearGradient>
        <linearGradient id="verLogo_g2" x1="12.8" y1="24.32" x2="56.32" y2="44.8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7BB8E0"/><stop offset="1" stopColor="#4A9AD4"/>
        </linearGradient>
        <linearGradient id="verLogo_g3" x1="16" y1="11.52" x2="57.6" y2="30.72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A8D4F0"/><stop offset="1" stopColor="#D4E8F7"/>
        </linearGradient>
        <linearGradient id="verLogo_g4" x1="44.8" y1="5.12" x2="57.6" y2="19.2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8C5A"/><stop offset="0.5" stopColor="#FF6347"/><stop offset="1" stopColor="#D73027"/>
        </linearGradient>
        <linearGradient id="verLogo_g5" x1="49.92" y1="8.32" x2="55.04" y2="14.72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8C5A"/><stop offset="0.5" stopColor="#FF6347"/><stop offset="1" stopColor="#D73027"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Corner flourish ───────────────────────────────────────────────────────────

function CornerFlourish({ className }: { className?: string }) {
  return (
    <svg
      className={cn('absolute w-16 h-16 opacity-10', className)}
      viewBox="0 0 80 80"
      fill="none"
    >
      <path d="M4 4 L4 36 Q4 4 36 4 Z" stroke="#1a2744" strokeWidth="1.5" fill="none"/>
      <path d="M10 4 L10 28 Q10 10 28 10 L4 10" stroke="#4a9ad4" strokeWidth="1" fill="none"/>
      <circle cx="6" cy="6" r="3" fill="#4a9ad4"/>
    </svg>
  )
}

// ── Certificate card ──────────────────────────────────────────────────────────

function VerifiedCertificateCard({ cert }: { cert: VerifiedCertificate }) {
  const formattedDate = format(new Date(cert.issuedAt), 'MMMM d, yyyy')
  const certId = 'CERT-PBA-' + cert.publicToken.slice(0, 8).toUpperCase()

  return (
    <div
      className="relative w-full max-w-2xl rounded-2xl p-0.5"
      style={{
        background: 'linear-gradient(135deg, #1a2744, #4a9ad4, #7bb8e0, #a8d4f0)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div className="relative overflow-hidden rounded-2xl bg-white px-16 py-12 flex flex-col items-center text-center">
        {/* Corner flourishes */}
        <CornerFlourish className="top-3 left-3" />
        <CornerFlourish className="top-3 right-3 scale-x-[-1]" />
        <CornerFlourish className="bottom-3 left-3 scale-y-[-1]" />
        <CornerFlourish className="bottom-3 right-3 scale-[-1]" />

        {/* Logo row */}
        <div className="flex items-center gap-2.5 mb-8">
          <CertLogoIcon size={36} />
          <div className="flex flex-col text-left">
            <span className="text-[13px] font-bold leading-none tracking-tight" style={{ color: '#1a2744' }}>Product Builder</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] leading-tight" style={{ color: '#4a9ad4' }}>Academy</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-medium leading-tight mb-2" style={{ color: '#1a2744', letterSpacing: '-0.02em' }}>
          Certificate of Completion
        </h1>

        {/* Title underline */}
        <div className="w-40 h-0.5 rounded-full mb-8" style={{ background: 'linear-gradient(90deg, #1a2744, #4a9ad4, #7bb8e0)' }} />

        <p className="text-sm italic mb-4" style={{ color: '#717182' }}>This certifies that</p>

        <h2 className="text-4xl font-semibold leading-none mb-4" style={{ color: '#1a2744', letterSpacing: '-0.02em' }}>
          {cert.studentName}
        </h2>

        <p className="text-sm italic mb-2" style={{ color: '#717182' }}>has successfully completed the</p>

        <p className="text-xl font-medium mb-1" style={{ color: '#4a9ad4' }}>
          Product Builder Academy Setup
        </p>

        <p className="text-sm mb-1" style={{ color: '#717182' }}>{cert.cohortName}</p>
        <p className="text-sm mb-8" style={{ color: '#717182' }}>{formattedDate}</p>

        {/* Divider */}
        <div
          className="w-3/5 mb-8"
          style={{ height: '1.5px', background: 'linear-gradient(90deg, transparent, #4a9ad4 30%, #7bb8e0 70%, transparent)' }}
        />

        {/* Signature */}
        <div className="flex flex-col items-center gap-1.5 mb-8">
          <span className="text-2xl italic leading-none mb-1" style={{ color: '#1a2744', fontFamily: 'Georgia, serif' }}>Jordan Miles</span>
          <div className="w-44 h-px mb-1" style={{ background: 'rgba(0,0,0,0.2)' }} />
          <span className="text-[13px] font-medium" style={{ color: '#1a2744' }}>Jordan Miles</span>
          <span className="text-[11px] uppercase tracking-wide" style={{ color: '#717182', letterSpacing: '0.08em' }}>Program Director, Product Builder Academy</span>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2">
          <CertLogoIcon size={18} />
          <span className="text-[11px]" style={{ color: '#717182', letterSpacing: '0.02em' }}>productbuilderacademy.com</span>
        </div>

        {/* Cert ID */}
        <div className="mt-3 font-mono text-[10px]" style={{ color: '#aaa', letterSpacing: '0.05em' }}>
          {certId}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CertificateVerifyPage() {
  const { token } = useParams<{ token: string }>()

  const { data: cert, isLoading, isError, error } = useQuery({
    queryKey: ['certificate-verify', token],
    queryFn: () => fetchCertificate(token!),
    enabled: Boolean(token),
    retry: false,
  })

  const isNotFound = isError && (error as Error).message === 'CERTIFICATE_NOT_FOUND'

  useEffect(() => {
    if (cert) {
      const title = `${cert.studentName} — Certificate of Completion | Product Builder Academy`
      const description = `${cert.studentName} has successfully completed the Product Builder Academy Setup program. View and verify this certificate.`
      const appOrigin = import.meta.env.VITE_APP_URL ?? window.location.origin
      const certUrl = `${appOrigin}/verify/${cert.publicToken}`

      document.title = title

      const setMeta = (property: string, content: string) => {
        let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
        if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el) }
        el.setAttribute('content', content)
      }
      const setNameMeta = (name: string, content: string) => {
        let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
        if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el) }
        el.setAttribute('content', content)
      }

      setMeta('og:type', 'website')
      setMeta('og:title', title)
      setMeta('og:description', description)
      setMeta('og:url', certUrl)
      setMeta('og:site_name', 'Product Builder Academy')
      setNameMeta('description', description)
      setNameMeta('twitter:card', 'summary')
      setNameMeta('twitter:title', title)
      setNameMeta('twitter:description', description)
    } else if (isNotFound) {
      document.title = 'Certificate Not Found | Product Builder Academy'
    } else {
      document.title = 'Verifying Certificate | Product Builder Academy'
    }
  }, [cert, isNotFound])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f4f7fb' }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-8 py-4 bg-white border-b"
        style={{ borderColor: 'rgba(0,0,0,0.1)' }}
      >
        <CertLogoIcon size={28} />
        <div className="flex flex-col">
          <span className="text-[13px] font-bold leading-none tracking-tight" style={{ color: '#1a2744' }}>Product Builder</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] leading-tight" style={{ color: '#4a9ad4' }}>Academy</span>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {isLoading && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#4a9ad4' }} />
            <p className="text-sm" style={{ color: '#717182' }}>Verifying certificate…</p>
          </div>
        )}

        {isNotFound && (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'rgba(212, 24, 61, 0.08)' }}
            >
              <XCircle className="h-8 w-8" style={{ color: '#d4183d' }} />
            </div>
            <h1 className="text-xl font-medium" style={{ color: '#1a2744' }}>Certificate Not Found</h1>
            <p className="text-sm leading-relaxed" style={{ color: '#717182' }}>
              This link may be invalid or the certificate may have been removed. If you believe this is an error, please contact the certificate holder.
            </p>
            <Link
              to="/"
              className="text-sm font-medium"
              style={{ color: '#4a9ad4' }}
            >
              Go to Product Builder Academy
            </Link>
          </div>
        )}

        {isError && !isNotFound && (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'rgba(212, 24, 61, 0.08)' }}
            >
              <XCircle className="h-8 w-8" style={{ color: '#d4183d' }} />
            </div>
            <h1 className="text-xl font-medium" style={{ color: '#1a2744' }}>Something went wrong</h1>
            <p className="text-sm leading-relaxed" style={{ color: '#717182' }}>
              We could not load this certificate right now. Please try again later.
            </p>
          </div>
        )}

        {cert && (
          <div className="flex flex-col items-center gap-6 w-full">
            {/* Verification badge */}
            <div
              className="flex items-center gap-2 rounded-full px-4 py-2"
              style={{
                background: 'rgba(22, 163, 74, 0.08)',
                border: '1px solid rgba(22, 163, 74, 0.2)',
              }}
            >
              <CheckCircle2 className="h-4 w-4" style={{ color: '#16a34a' }} />
              <span className="text-[13px] font-medium" style={{ color: '#16a34a' }}>
                Verified Certificate
              </span>
            </div>

            <VerifiedCertificateCard cert={cert} />

            <p className="text-xs text-center max-w-md" style={{ color: '#717182' }}>
              This is an official certificate issued by Product Builder Academy. The details above have been independently verified.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex justify-center pb-8">
        <p className="text-xs" style={{ color: '#717182' }}>
          &copy; {new Date().getFullYear()} Product Builder Academy
        </p>
      </footer>
    </div>
  )
}
