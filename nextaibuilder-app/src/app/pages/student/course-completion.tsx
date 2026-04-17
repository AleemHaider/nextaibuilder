// PBA-128 / PBA-30 — Course Completion page
// Layout: StudentShell already provides the left step panel (steps shown as ✓ Verified).
// This component fills the right panel — matches Figma story17 desktop design exactly.
import { useEffect } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CheckCircle2, Clock, Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { studentApi } from '../../../lib/api-client'
import { useStudentBadges, useStudentCertificate, type Badge } from '../../../hooks/use-achievements'
import { useAuth } from '../../../hooks/use-auth'

// ── Design tokens (brand colours) ─────────────────────────────────────────────
const NAVY    = '#1a2744'
const BLUE    = '#4a9ad4'
const SKY     = '#7bb8e0'
const PALE    = '#a8d4f0'
const ORANGE  = '#ff8c5a'
const REDORG  = '#ff6347'
const SUCCESS = '#16a34a'
const MUTED   = '#717182'
const BORDER  = 'rgba(0,0,0,0.1)'

// ── Badge gradient / icon lookup ───────────────────────────────────────────────

function getTrophySvg(size = 28) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
    </svg>
  )
}

function badgeGradient(name: string, index: number) {
  const lc = name.toLowerCase()
  if (lc.includes('first') || lc.includes('start'))
    return { g: `linear-gradient(135deg,${ORANGE},${REDORG})`,
      icon: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg> }
  if (lc.includes('halfway') || lc.includes('half'))
    return { g: `linear-gradient(135deg,${BLUE},${SKY})`,
      icon: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3l4 8 5-5 5 15H2L8 3z"/></svg> }
  if (lc.includes('speed') || lc.includes('demon'))
    return { g: `linear-gradient(135deg,${SKY},${PALE})`,
      icon: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> }
  if (lc.includes('complete') || lc.includes('setup') || lc.includes('finish'))
    return { g: `linear-gradient(135deg,${NAVY},${BLUE})`, icon: getTrophySvg(34) }
  if (lc.includes('trouble') || lc.includes('fix'))
    return { g: `linear-gradient(135deg,${ORANGE},${BLUE})`,
      icon: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> }
  const gs = [
    `linear-gradient(135deg,${ORANGE},${REDORG})`,
    `linear-gradient(135deg,${BLUE},${SKY})`,
    `linear-gradient(135deg,${SKY},${PALE})`,
    `linear-gradient(135deg,${ORANGE},${BLUE})`,
    `linear-gradient(135deg,${NAVY},${BLUE})`,
  ]
  return { g: gs[index % gs.length],
    icon: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> }
}

// ── Confetti hero (trophy circle + scattered confetti) ─────────────────────────

function ConfettiHero() {
  return (
    <div style={{ position: 'relative', width: '120px', height: '80px', flexShrink: 0, marginBottom: '4px' }}>
      <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg,rgba(74,154,212,0.15),rgba(123,184,224,0.08))' }} />
      {/* confetti pieces */}
      <div style={{ position: 'absolute', top: 0, left: '30%', width: '8px', height: '8px', background: ORANGE, borderRadius: '2px', transform: 'rotate(20deg)' }} />
      <div style={{ position: 'absolute', top: '5px', left: '62%', width: '6px', height: '10px', background: BLUE, borderRadius: '1px', transform: 'rotate(-15deg)' }} />
      <div style={{ position: 'absolute', top: '12px', left: '14%', width: '10px', height: '4px', background: SKY, borderRadius: '2px', transform: 'rotate(35deg)' }} />
      <div style={{ position: 'absolute', top: '2px', left: '76%', width: '7px', height: '7px', background: '#d4e8f7', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', top: '20px', left: '7%', width: '6px', height: '6px', background: REDORG, borderRadius: '1px', transform: 'rotate(50deg)' }} />
      <div style={{ position: 'absolute', top: '15px', left: '83%', width: '8px', height: '4px', background: PALE, borderRadius: '2px', transform: 'rotate(-30deg)' }} />
      {/* trophy circle */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '48px', height: '48px', borderRadius: '50%', background: `linear-gradient(135deg,${NAVY},${BLUE})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(74,154,212,0.4)' }}>
        {getTrophySvg(22)}
      </div>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, iconBg, icon }: { label: string; value: string | number; iconBg: string; icon: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: '120px', background: 'white', border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <span style={{ fontSize: '12px', color: MUTED, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 600, color: NAVY, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

// ── Mini certificate preview ───────────────────────────────────────────────────
// PBA-307: 180×120px with gradient border (wrapper div technique for CSS-in-JS)

function CertPreview({ name }: { name: string }) {
  return (
    <div style={{
      width: '184px', height: '124px',
      background: 'linear-gradient(135deg, #1a2744, #4a9ad4, #7bb8e0)',
      borderRadius: '12px', padding: '2px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', flexShrink: 0,
    }}>
      <div style={{
        width: '100%', height: '100%',
        background: 'white', borderRadius: '10px',
        overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '12px', gap: '4px',
      }}>
        {/* top gradient stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg,${NAVY},${BLUE},${SKY})` }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
          <div style={{ width: '10px', height: '10px', background: `linear-gradient(135deg,${BLUE},${SKY})`, borderRadius: '2px' }} />
          <span style={{ fontSize: '6px', fontWeight: 700, color: NAVY, letterSpacing: '0.02em' }}>Product Builder ACADEMY</span>
        </div>
        <div style={{ fontSize: '7px', fontWeight: 600, color: NAVY, textAlign: 'center', lineHeight: 1.3 }}>Certificate of<br />Completion</div>
        <div style={{ width: '70%', height: '1px', background: `linear-gradient(90deg,transparent,${BLUE},transparent)`, margin: '3px 0' }} />
        <div style={{ fontSize: '9px', fontWeight: 600, color: NAVY, textAlign: 'center' }}>{name}</div>
        <div style={{ fontSize: '6px', color: BLUE, fontWeight: 500 }}>Product Builder Academy Setup</div>
      </div>
    </div>
  )
}

// ── Featured badge card ────────────────────────────────────────────────────────

function FeatBadge({ badge, index }: { badge: Badge; index: number }) {
  const { g, icon } = badgeGradient(badge.name, index)
  return (
    <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 16px', gap: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: '130px', flex: '1 1 130px', maxWidth: '160px' }}>
      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: g, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ fontSize: '12px', fontWeight: 500, color: NAVY, textAlign: 'center', lineHeight: 1.3 }}>{badge.name}</div>
      <div style={{ fontSize: '10px', color: MUTED }}>{badge.earnedAt ? format(new Date(badge.earnedAt), 'MMM d, yyyy') : ''}</div>
    </div>
  )
}

function LockedBadge({ badge }: { badge: Badge }) {
  return (
    <div style={{ background: '#fafbfc', border: `1px solid ${BORDER}`, borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 16px', gap: '10px', opacity: 0.5, minWidth: '130px', flex: '1 1 130px', maxWidth: '160px' }}>
      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <div style={{ fontSize: '12px', fontWeight: 500, color: MUTED, textAlign: 'center', lineHeight: 1.3 }}>{badge.name}</div>
      <div style={{ fontSize: '10px', color: MUTED }}>Locked</div>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="h-full overflow-y-auto p-12 space-y-6">
      <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-muted" />
      <div className="mx-auto h-7 w-52 animate-pulse rounded bg-muted" />
      <div className="flex gap-4">
        {[1,2,3].map(i => <div key={i} className="flex-1 h-24 animate-pulse rounded-xl bg-muted" />)}
      </div>
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
      <div className="flex gap-4">
        {[1,2,3].map(i => <div key={i} className="h-44 w-36 animate-pulse rounded-xl bg-muted" />)}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function CourseCompletionPage() {
  const { user } = useAuth()

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data, error } = await studentApi.getDashboard()
      if (error) throw new Error(error.message ?? 'Failed to load')
      return data!
    },
  })

  const { data: badgeData, isLoading: badgeLoading } = useStudentBadges()
  const { data: certData } = useStudentCertificate()

  useEffect(() => { document.title = 'Setup Complete! — Product Builder Academy' }, [])

  if (dashLoading || badgeLoading) return <Skeleton />

  const totalSteps  = dash?.totalSteps ?? 0
  const cohortName  = dash?.cohort?.name ?? 'Product Builder Academy'
  const cohortStart = dash?.cohort?.startDate ?? null
  const firstName   = user?.firstName ?? 'there'
  const fullName    = user ? `${user.firstName} ${user.lastName}`.trim() : 'Student'

  const badges       = badgeData?.badges ?? []
  const earned       = badges.filter(b => b.earned)
  const locked       = badges.filter(b => !b.earned)
  const certificate  = certData?.certificate ?? null
  const certName     = certificate?.studentName ?? fullName

  // Copy-to-clipboard helper — await clipboard and show feedback toast
  async function copyLink() {
    const url = certificate?.publicToken
      ? `${window.location.origin}/verify/${certificate.publicToken}`
      : window.location.href
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied!')
    } catch {
      toast.error('Could not copy link. Please copy the URL manually.')
    }
  }

  return (
    // KEY FIX: use h-full overflow-y-auto (same pattern as dashboard/step pages)
    <div className="h-full overflow-y-auto bg-white">
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 40px 80px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
          <ConfettiHero />
          <h1 style={{ fontSize: '28px', fontWeight: 500, color: NAVY, lineHeight: 1.2, margin: 0 }}>
            Congratulations, {firstName}!
          </h1>
          <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.6, maxWidth: '480px', margin: 0 }}>
            You've successfully completed your setup. You're all set for{' '}
            <strong style={{ color: NAVY }}>{cohortName}</strong> — we can't wait to see what you build.
          </p>
          {/* All complete chip */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '20px', padding: '5px 14px' }}>
            <CheckCircle2 size={14} color={SUCCESS} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: SUCCESS }}>All steps complete — 100%</span>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <StatCard
            label="Steps Completed"
            value={`${totalSteps}/${totalSteps}`}
            iconBg="rgba(22,163,74,0.10)"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={SUCCESS} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
          />
          <StatCard
            label="Cohort Starts"
            value={cohortStart ? format(new Date(cohortStart), 'MMM d, yyyy') : cohortName}
            iconBg={`rgba(74,154,212,0.10)`}
            icon={<Clock size={16} color={BLUE} />}
          />
          <StatCard
            label="Badges Earned"
            value={`${earned.length}/${badges.length || '—'}`}
            iconBg="rgba(255,140,90,0.10)"
            icon={getTrophySvg(16)}
          />
        </div>

        {/* ── Certificate section ───────────────────────────────────────── */}
        <div style={{ background: '#fafbfc', border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '24px', display: 'flex', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
          <CertPreview name={certName} />

          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '15px', fontWeight: 500, color: NAVY }}>
              {certificate ? 'Your completion certificate is ready!' : 'Certificate being generated…'}
            </div>
            <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.5 }}>
              Download as PDF, share on LinkedIn, or copy a permanent link to share with anyone.
            </div>

            {/* Action buttons — match Figma exactly */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
              {/* Primary: Download */}
              <Link
                to="/student/certificate"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '36px', padding: '0 18px', background: ORANGE, color: 'white', fontSize: '13px', fontWeight: 500, borderRadius: '8px', textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                <Download size={13} />
                Download Certificate (PDF)
              </Link>

              {/* Secondary: Copy link — only shown when certificate is available */}
              {certificate && (
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '36px', padding: '0 16px', background: 'transparent', border: `1.5px solid ${BORDER}`, color: NAVY, fontSize: '13px', fontWeight: 500, borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <Copy size={13} />
                  Copy Shareable Link
                </button>
              )}

              {/* Tertiary: LinkedIn — only shown when certificate is available */}
              {certificate && (
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/verify/${certificate.publicToken}`
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank')
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '36px', padding: '0 16px', background: 'transparent', border: `1.5px solid ${BORDER}`, color: NAVY, fontSize: '13px', fontWeight: 500, borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                  Share on LinkedIn
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Your Achievements ─────────────────────────────────────────── */}
        {badges.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 500, color: NAVY, margin: 0 }}>Your Achievements</h2>
              <span style={{ fontSize: '12px', color: MUTED }}>{earned.length} badge{earned.length !== 1 ? 's' : ''} earned</span>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {earned.map((b, i) => <FeatBadge key={b.id} badge={b} index={i} />)}
              {locked.map((b) => <LockedBadge key={b.id} badge={b} />)}
            </div>

            <div style={{ marginTop: '14px' }}>
              <Link to="/student/badges" style={{ fontSize: '13px', color: BLUE, textDecoration: 'none' }}>
                View all badges →
              </Link>
            </div>
          </div>
        )}

        {/* ── What happens next? ────────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg,#eff6ff 0%,#f0f7ff 100%)', border: `1px solid rgba(74,154,212,0.2)`, borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(74,154,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color={BLUE} />
            </div>
            <span style={{ fontSize: '16px', fontWeight: 500, color: NAVY }}>What happens next?</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              cohortStart
                ? <span>Your cohort starts on <strong>{format(new Date(cohortStart), 'MMMM d, yyyy')}</strong> — mark your calendar!</span>
                : <span>Your cohort start date will be communicated via email.</span>,
              <span>You'll receive a welcome email with your session link 24 hours before kickoff.</span>,
              <span>Share your <strong>certificate</strong> on LinkedIn to showcase your achievement!</span>,
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: NAVY, lineHeight: 1.5 }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(22,163,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={SUCCESS} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* ── Back link ─────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center' }}>
          <Link to="/dashboard" style={{ fontSize: '13px', color: MUTED, textDecoration: 'none' }}>
            ← Back to dashboard
          </Link>
        </div>

      </div>
    </div>
  )
}
