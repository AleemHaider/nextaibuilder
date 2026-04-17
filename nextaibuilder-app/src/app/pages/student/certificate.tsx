// PBA-128 — Certificate page
import { useEffect } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Download,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { studentApi } from '../../../lib/api-client'
import { useStudentCertificate } from '../../../hooks/use-achievements'
import { useAuth } from '../../../hooks/use-auth'
import { Button } from '../../components/ui/button'
import { StepProgressBar } from '../../components/progress'

// ── PDF download ───────────────────────────────────────────────────────────────

function downloadCertificatePDF(studentName: string, cohortName: string, issuedAt: string) {
  const formattedDate = format(new Date(issuedAt), 'MMMM d, yyyy')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Certificate of Completion — ${studentName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4 landscape; margin: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #ffffff;
      width: 297mm; height: 210mm;
      display: flex; align-items: center; justify-content: center;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .cert {
      width: 260mm; height: 180mm;
      border: 2px solid rgba(74,154,212,0.35);
      border-radius: 12px;
      background: #ffffff;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 32px 48px;
      position: relative;
      text-align: center;
      gap: 0;
    }
    /* gradient top stripe */
    .cert::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 5px;
      border-radius: 10px 10px 0 0;
      background: linear-gradient(90deg, #1a2744, #4a9ad4, #7bb8e0);
    }
    /* corner ornaments */
    .corner { position: absolute; width: 32px; height: 32px; }
    .tl { top: 12px; left: 12px; border-top: 2px solid rgba(74,154,212,0.4); border-left: 2px solid rgba(74,154,212,0.4); border-radius: 6px 0 0 0; }
    .tr { top: 12px; right: 12px; border-top: 2px solid rgba(74,154,212,0.4); border-right: 2px solid rgba(74,154,212,0.4); border-radius: 0 6px 0 0; }
    .bl { bottom: 12px; left: 12px; border-bottom: 2px solid rgba(74,154,212,0.4); border-left: 2px solid rgba(74,154,212,0.4); border-radius: 0 0 0 6px; }
    .br { bottom: 12px; right: 12px; border-bottom: 2px solid rgba(74,154,212,0.4); border-right: 2px solid rgba(74,154,212,0.4); border-radius: 0 0 6px 0; }
    .eyebrow { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #717182; margin-bottom: 12px; }
    .this-certifies { font-size: 14px; font-weight: 400; color: #717182; margin-bottom: 4px; }
    .student-name { font-size: 32px; font-weight: 600; color: #1a2744; margin-bottom: 12px; }
    .completed-text { font-size: 13px; color: #717182; margin-bottom: 4px; }
    .cohort-name { font-size: 18px; font-weight: 500; color: #1a2744; margin-bottom: 2px; }
    .academy-name { font-size: 14px; font-weight: 500; color: #4a9ad4; margin-bottom: 20px; }
    .divider { width: 80px; height: 1px; background: rgba(0,0,0,0.1); margin: 0 auto 20px; }
    .issued-on { font-size: 12px; color: #717182; }
    .issued-on strong { color: #1a2744; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="cert">
    <div class="corner tl"></div>
    <div class="corner tr"></div>
    <div class="corner bl"></div>
    <div class="corner br"></div>
    <div style="display:flex; align-items:center; justify-content:center; margin-bottom:20px;">
      <svg width="48" height="53" viewBox="0 0 64 70" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path opacity="0.9" d="M9.60001 41.6C9.60001 41.6 16 35.2 25.6 37.12C35.2 39.04 41.6 44.8 48 41.6C51.2 39.68 52.48 37.12 52.48 35.2V48C52.48 48 51.2 50.56 48 52.48C41.6 55.68 35.2 49.92 25.6 48C16 46.08 9.60001 52.48 9.60001 52.48V41.6Z" fill="url(#pdfLogo_g1)"/>
        <path opacity="0.95" d="M12.8 28.8C12.8 28.8 19.2 22.4 28.8 25.6C38.4 28.8 44.8 33.28 51.2 30.72C54.4 29.44 56.32 26.88 56.32 24.32V37.12C56.32 37.12 54.4 39.68 51.2 41.6C44.8 44.8 38.4 39.68 28.8 36.48C19.2 33.28 12.8 38.4 12.8 38.4V28.8Z" fill="url(#pdfLogo_g2)"/>
        <path d="M16 17.92C16 17.92 22.4 11.52 32 14.08C41.6 16.64 48 22.4 54.4 19.2C56.32 17.92 57.6 16 57.6 14.08V26.88C57.6 26.88 56.32 29.44 54.4 30.72C48 33.92 41.6 28.8 32 25.6C22.4 22.4 16 28.16 16 28.16V17.92Z" fill="url(#pdfLogo_g3)"/>
        <path d="M44.8 7.68C44.8 7.68 49.92 5.12 54.4 7.68C56.32 8.96 57.6 11.52 57.6 14.08V19.2C57.6 19.2 56.32 16.64 54.4 15.36C49.92 12.8 44.8 15.36 44.8 15.36V7.68Z" fill="url(#pdfLogo_g4)"/>
        <path opacity="0.8" d="M52.48 14.72C53.8938 14.72 55.04 13.2873 55.04 11.52C55.04 9.75269 53.8938 8.32 52.48 8.32C51.0661 8.32 49.92 9.75269 49.92 11.52C49.92 13.2873 51.0661 14.72 52.48 14.72Z" fill="url(#pdfLogo_g5)"/>
        <defs>
          <linearGradient id="pdfLogo_g1" x1="9.60001" y1="35.2" x2="52.48" y2="52.48" gradientUnits="userSpaceOnUse">
            <stop stop-color="#1A2744"/><stop offset="1" stop-color="#4A90C4"/>
          </linearGradient>
          <linearGradient id="pdfLogo_g2" x1="12.8" y1="24.32" x2="56.32" y2="44.8" gradientUnits="userSpaceOnUse">
            <stop stop-color="#7BB8E0"/><stop offset="1" stop-color="#4A9AD4"/>
          </linearGradient>
          <linearGradient id="pdfLogo_g3" x1="16" y1="11.52" x2="57.6" y2="30.72" gradientUnits="userSpaceOnUse">
            <stop stop-color="#A8D4F0"/><stop offset="1" stop-color="#D4E8F7"/>
          </linearGradient>
          <linearGradient id="pdfLogo_g4" x1="44.8" y1="5.12" x2="57.6" y2="19.2" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FF8C5A"/><stop offset="0.5" stop-color="#FF6347"/><stop offset="1" stop-color="#D73027"/>
          </linearGradient>
          <linearGradient id="pdfLogo_g5" x1="49.92" y1="8.32" x2="55.04" y2="14.72" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FF8C5A"/><stop offset="0.5" stop-color="#FF6347"/><stop offset="1" stop-color="#D73027"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <div class="eyebrow">Certificate of Completion</div>
    <div class="this-certifies">This certifies that</div>
    <div class="student-name">${studentName}</div>
    <div class="completed-text">has successfully completed all setup requirements for</div>
    <div class="cohort-name">${cohortName}</div>
    <div class="academy-name">Product Builder Academy</div>
    <div class="divider"></div>
    <div class="issued-on">Issued on <strong>${formattedDate}</strong></div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1000,height=720')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

// ── PBA brand logo icon for certificate card ───────────────────────────────────

function CertLogoIcon() {
  return (
    <svg width="36" height="39" viewBox="0 0 64 70" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.9" d="M9.60001 41.6C9.60001 41.6 16 35.2 25.6 37.12C35.2 39.04 41.6 44.8 48 41.6C51.2 39.68 52.48 37.12 52.48 35.2V48C52.48 48 51.2 50.56 48 52.48C41.6 55.68 35.2 49.92 25.6 48C16 46.08 9.60001 52.48 9.60001 52.48V41.6Z" fill="url(#certLogo_g1)"/>
      <path opacity="0.95" d="M12.8 28.8C12.8 28.8 19.2 22.4 28.8 25.6C38.4 28.8 44.8 33.28 51.2 30.72C54.4 29.44 56.32 26.88 56.32 24.32V37.12C56.32 37.12 54.4 39.68 51.2 41.6C44.8 44.8 38.4 39.68 28.8 36.48C19.2 33.28 12.8 38.4 12.8 38.4V28.8Z" fill="url(#certLogo_g2)"/>
      <path d="M16 17.92C16 17.92 22.4 11.52 32 14.08C41.6 16.64 48 22.4 54.4 19.2C56.32 17.92 57.6 16 57.6 14.08V26.88C57.6 26.88 56.32 29.44 54.4 30.72C48 33.92 41.6 28.8 32 25.6C22.4 22.4 16 28.16 16 28.16V17.92Z" fill="url(#certLogo_g3)"/>
      <path d="M44.8 7.68C44.8 7.68 49.92 5.12 54.4 7.68C56.32 8.96 57.6 11.52 57.6 14.08V19.2C57.6 19.2 56.32 16.64 54.4 15.36C49.92 12.8 44.8 15.36 44.8 15.36V7.68Z" fill="url(#certLogo_g4)"/>
      <path opacity="0.8" d="M52.48 14.72C53.8938 14.72 55.04 13.2873 55.04 11.52C55.04 9.75269 53.8938 8.32 52.48 8.32C51.0661 8.32 49.92 9.75269 49.92 11.52C49.92 13.2873 51.0661 14.72 52.48 14.72Z" fill="url(#certLogo_g5)"/>
      <defs>
        <linearGradient id="certLogo_g1" x1="9.60001" y1="35.2" x2="52.48" y2="52.48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A2744"/><stop offset="1" stopColor="#4A90C4"/>
        </linearGradient>
        <linearGradient id="certLogo_g2" x1="12.8" y1="24.32" x2="56.32" y2="44.8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7BB8E0"/><stop offset="1" stopColor="#4A9AD4"/>
        </linearGradient>
        <linearGradient id="certLogo_g3" x1="16" y1="11.52" x2="57.6" y2="30.72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A8D4F0"/><stop offset="1" stopColor="#D4E8F7"/>
        </linearGradient>
        <linearGradient id="certLogo_g4" x1="44.8" y1="5.12" x2="57.6" y2="19.2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8C5A"/><stop offset="0.5" stopColor="#FF6347"/><stop offset="1" stopColor="#D73027"/>
        </linearGradient>
        <linearGradient id="certLogo_g5" x1="49.92" y1="8.32" x2="55.04" y2="14.72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8C5A"/><stop offset="0.5" stopColor="#FF6347"/><stop offset="1" stopColor="#D73027"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── PBA-311: Corner flourish ornaments ─────────────────────────────────────────

function CornerFlourish({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ position: 'absolute', width: 80, height: 80, opacity: 0.12, ...style }} viewBox="0 0 80 80" fill="none">
      <path d="M4 4 L4 36 Q4 4 36 4 Z" stroke="#1a2744" strokeWidth="1.5" fill="none"/>
      <path d="M10 4 L10 28 Q10 10 28 10 L4 10" stroke="#4a9ad4" strokeWidth="1" fill="none"/>
      <circle cx="6" cy="6" r="3" fill="#4a9ad4"/>
    </svg>
  )
}

// ── PBA-310: Earned certificate card (full inline-style rebuild) ───────────────

interface EarnedCertificateProps {
  studentName: string
  cohortName: string
  issuedAt: string
  certId?: string
}

function EarnedCertificate({ studentName, cohortName, issuedAt, certId }: EarnedCertificateProps) {
  const formattedDate = format(new Date(issuedAt), 'MMMM d, yyyy')
  const NAVY = '#1a2744', BLUE = '#4a9ad4', SKY = '#7bb8e0', MUTED = '#717182'

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a2744 0%, #4a9ad4 40%, #7bb8e0 70%, #a8d4f0 100%)',
      borderRadius: 16, padding: 2,
      boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      width: '100%', maxWidth: 800,
    }}>
      <div style={{
        background: 'white', borderRadius: 14, padding: 64,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* PBA-311: Corner flourishes */}
        <CornerFlourish style={{ top: 12, left: 12 }} />
        <CornerFlourish style={{ top: 12, right: 12, transform: 'scaleX(-1)' }} />
        <CornerFlourish style={{ bottom: 12, left: 12, transform: 'scaleY(-1)' }} />
        <CornerFlourish style={{ bottom: 12, right: 12, transform: 'scale(-1,-1)' }} />

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <CertLogoIcon />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, lineHeight: 1, letterSpacing: '-0.01em' }}>Product Builder</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.15em', lineHeight: 1.4 }}>Academy</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: 30, fontWeight: 500, color: NAVY, textAlign: 'center', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          Certificate of Completion
        </div>

        {/* Title underline */}
        <div style={{ width: 200, height: 3, background: `linear-gradient(90deg, ${NAVY}, ${BLUE}, ${SKY})`, borderRadius: 2, marginBottom: 40 }} />

        {/* Preamble */}
        <div style={{ fontSize: 15, color: MUTED, marginBottom: 16, fontStyle: 'italic' }}>This certifies that</div>

        {/* Student name */}
        <div style={{ fontSize: 40, fontWeight: 600, color: NAVY, textAlign: 'center', marginBottom: 16, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {studentName}
        </div>

        {/* Program preamble */}
        <div style={{ fontSize: 15, color: MUTED, marginBottom: 8, fontStyle: 'italic' }}>has successfully completed the</div>

        {/* Program name — always hard-coded */}
        <div style={{ fontSize: 22, fontWeight: 500, color: BLUE, textAlign: 'center', marginBottom: 8, lineHeight: 1.2 }}>
          Product Builder Academy Setup
        </div>

        {/* Cohort name */}
        <div style={{ fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: 4 }}>
          {cohortName}
        </div>

        {/* Date */}
        <div style={{ fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: 40 }}>
          {formattedDate}
        </div>

        {/* Gradient divider */}
        <div style={{ width: '60%', height: 1.5, background: `linear-gradient(90deg, transparent, ${BLUE} 30%, ${SKY} 70%, transparent)`, marginBottom: 36 }} />

        {/* Signature area */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 36 }}>
          <div style={{ fontSize: 24, fontStyle: 'italic', color: NAVY, fontFamily: 'Georgia, serif', marginBottom: 4, lineHeight: 1 }}>
            Jordan Miles
          </div>
          <div style={{ width: 180, height: 1, background: 'rgba(0,0,0,0.2)', marginBottom: 4 }} />
          <div style={{ fontSize: 13, color: NAVY, fontWeight: 500 }}>Jordan Miles</div>
          <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Program Director, Product Builder Academy</div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <svg width="20" height="22" viewBox="0 0 64 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path opacity="0.9" d="M9.60001 41.6C9.60001 41.6 16 35.2 25.6 37.12C35.2 39.04 41.6 44.8 48 41.6C51.2 39.68 52.48 37.12 52.48 35.2V48C52.48 48 51.2 50.56 48 52.48C41.6 55.68 35.2 49.92 25.6 48C16 46.08 9.60001 52.48 9.60001 52.48V41.6Z" fill="url(#certFooter_g1)"/>
            <path opacity="0.95" d="M12.8 28.8C12.8 28.8 19.2 22.4 28.8 25.6C38.4 28.8 44.8 33.28 51.2 30.72C54.4 29.44 56.32 26.88 56.32 24.32V37.12C56.32 37.12 54.4 39.68 51.2 41.6C44.8 44.8 38.4 39.68 28.8 36.48C19.2 33.28 12.8 38.4 12.8 38.4V28.8Z" fill="url(#certFooter_g2)"/>
            <path d="M16 17.92C16 17.92 22.4 11.52 32 14.08C41.6 16.64 48 22.4 54.4 19.2C56.32 17.92 57.6 16 57.6 14.08V26.88C57.6 26.88 56.32 29.44 54.4 30.72C48 33.92 41.6 28.8 32 25.6C22.4 22.4 16 28.16 16 28.16V17.92Z" fill="url(#certFooter_g3)"/>
            <path d="M44.8 7.68C44.8 7.68 49.92 5.12 54.4 7.68C56.32 8.96 57.6 11.52 57.6 14.08V19.2C57.6 19.2 56.32 16.64 54.4 15.36C49.92 12.8 44.8 15.36 44.8 15.36V7.68Z" fill="url(#certFooter_g4)"/>
            <path opacity="0.8" d="M52.48 14.72C53.8938 14.72 55.04 13.2873 55.04 11.52C55.04 9.75269 53.8938 8.32 52.48 8.32C51.0661 8.32 49.92 9.75269 49.92 11.52C49.92 13.2873 51.0661 14.72 52.48 14.72Z" fill="url(#certFooter_g5)"/>
            <defs>
              <linearGradient id="certFooter_g1" x1="9.60001" y1="35.2" x2="52.48" y2="52.48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1A2744"/><stop offset="1" stopColor="#4A90C4"/>
              </linearGradient>
              <linearGradient id="certFooter_g2" x1="12.8" y1="24.32" x2="56.32" y2="44.8" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7BB8E0"/><stop offset="1" stopColor="#4A9AD4"/>
              </linearGradient>
              <linearGradient id="certFooter_g3" x1="16" y1="11.52" x2="57.6" y2="30.72" gradientUnits="userSpaceOnUse">
                <stop stopColor="#A8D4F0"/><stop offset="1" stopColor="#D4E8F7"/>
              </linearGradient>
              <linearGradient id="certFooter_g4" x1="44.8" y1="5.12" x2="57.6" y2="19.2" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF8C5A"/><stop offset="0.5" stopColor="#FF6347"/><stop offset="1" stopColor="#D73027"/>
              </linearGradient>
              <linearGradient id="certFooter_g5" x1="49.92" y1="8.32" x2="55.04" y2="14.72" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF8C5A"/><stop offset="0.5" stopColor="#FF6347"/><stop offset="1" stopColor="#D73027"/>
              </linearGradient>
            </defs>
          </svg>
          <span style={{ fontSize: 11, color: MUTED, letterSpacing: '0.02em' }}>productbuilderacademy.com</span>
        </div>

        {/* Verify ID */}
        {certId && (
          <div style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.05em', fontFamily: 'Courier New, monospace', marginTop: 16 }}>
            {certId}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Locked certificate preview ─────────────────────────────────────────────────

function LockedCertificate({
  completedSteps,
  totalSteps,
}: {
  completedSteps: number
  totalSteps: number
}) {
  return (
    <div
      data-slot="certificate-locked"
      className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/20 p-8 text-center"
    >
      {/* Blurred preview layer */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-15 blur-sm"
        aria-hidden="true"
      >
        <div className="h-16 w-16 rounded-full border-4 border-double border-primary/40 bg-primary/5" />
        <div className="h-3 w-40 rounded-full bg-foreground/30" />
        <div className="h-5 w-56 rounded-full bg-foreground/50" />
        <div className="h-3 w-48 rounded-full bg-foreground/30" />
        <div className="h-3 w-32 rounded-full bg-foreground/30" />
      </div>

      {/* Overlay */}
      <div className="relative z-10 flex flex-col items-center gap-4 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted ring-2 ring-border">
          <Lock className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="space-y-1">
          <h2 className="text-base font-medium text-foreground">
            Certificate Locked
          </h2>
          <p className="text-sm text-muted-foreground">
            Complete all steps to earn your certificate.
          </p>
        </div>

        <div className="w-full max-w-xs">
          <StepProgressBar
            totalSteps={totalSteps}
            completedSteps={completedSteps}
            showLabel
            showPercentage
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {totalSteps - completedSteps} step{totalSteps - completedSteps !== 1 ? 's' : ''} remaining
        </p>

        <Link to="/dashboard">
          <Button variant="outline" size="sm" className="gap-2">
            Continue Setup
          </Button>
        </Link>
      </div>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function CertificateSkeleton() {
  return (
    <div data-slot="certificate-skeleton" className="space-y-6 p-6">
      <div className="h-6 w-44 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-72 w-full animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function CertificatePage() {
  const { user } = useAuth()

  const { data: certData, isLoading: certLoading } = useStudentCertificate()

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data, error } = await studentApi.getDashboard()
      if (error) throw new Error(error.message ?? 'Failed to load dashboard')
      return data!
    },
  })

  useEffect(() => {
    document.title = 'Certificate — Product Builder Academy'
  }, [])

  const isLoading = certLoading || dashLoading

  if (isLoading) return <CertificateSkeleton />

  const certificate = certData?.certificate ?? null
  const completedSteps = dashData?.completedSteps ?? 0
  const totalSteps = dashData?.totalSteps ?? 0
  const studentName = certificate?.studentName ??
    (user ? `${user.firstName} ${user.lastName}`.trim() : 'Student')
  const cohortName = certificate?.cohortName ?? ''
  const issuedAt = certificate?.issuedAt ?? ''

  const appOrigin = import.meta.env.VITE_APP_URL ?? window.location.origin
  const certUrl = certificate?.publicToken
    ? appOrigin + '/verify/' + certificate.publicToken
    : window.location.href

  const certId = certificate?.publicToken
    ? 'CERT-PBA-' + certificate.publicToken.slice(0, 8).toUpperCase()
    : undefined

  return (
    // PBA-312: root div updated — full height, scrollable, light blue bg
    <div data-slot="certificate-page" className="h-full overflow-y-auto bg-[#f4f7fb]">

      {/* PBA-309: Top actions bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px', background: 'white', borderBottom: '1px solid rgba(0,0,0,0.1)',
      }}>
        {/* Left: Back link */}
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: '#717182', textDecoration: 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="#717182" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </Link>

        {/* Right: Action buttons */}
        {certificate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Download PDF */}
            <button
              onClick={() => downloadCertificatePDF(studentName, cohortName, issuedAt)}
              style={{
                background: '#ff8c5a', color: 'white', height: 36, padding: '0 18px',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
              }}
            >
              <Download style={{ width: 14, height: 14 }} />
              Download PDF
            </button>

            {/* Copy Link */}
            <button
              onClick={() => {
                void navigator.clipboard.writeText(certUrl).then(
                  () => toast.success('Link copied!'),
                  () => toast.error('Could not copy link. Please copy the URL manually.'),
                )
              }}
              style={{
                background: 'transparent', color: '#1a2744', height: 36, padding: '0 18px',
                border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              Copy Link
            </button>

            {/* Share on LinkedIn */}
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'transparent', color: '#1a2744', height: 36, padding: '0 18px',
                border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
                textDecoration: 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                <rect width="4" height="12" x="2" y="9"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
              Share on LinkedIn
            </a>
          </div>
        )}
      </div>

      {/* Certificate card area */}
      <div style={{ background: '#f4f7fb', padding: '48px 32px 64px', display: 'flex', justifyContent: 'center' }}>
        {certificate ? (
          <EarnedCertificate
            studentName={studentName}
            cohortName={cohortName}
            issuedAt={issuedAt}
            certId={certId}
          />
        ) : (
          <div style={{ width: '100%', maxWidth: 480 }}>
            <LockedCertificate
              completedSteps={completedSteps}
              totalSteps={totalSteps}
            />
          </div>
        )}
      </div>
    </div>
  )
}
