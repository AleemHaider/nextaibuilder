// FIR-30 — Cohort detail / course landing page
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import { usePageMeta } from '../hooks/usePageMeta'
import { fetchCohortBySlug, fetchPreviewLessons } from '../lib/api'
import type { CohortDetail, CohortLesson, PreviewLesson } from '../lib/api'

// ─── helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  live:     { label: '🔴 Live Cohort', color: '#cc4a00', bg: '#fff0e8' },
  combined: { label: '⚡ Combined',    color: '#1a2744', bg: '#e8ecf4' },
  recorded: { label: '📹 Recorded',   color: '#054d28', bg: '#e6f4ec' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// ─── Preview player modal ──────────────────────────────────────────────────────

function PreviewPlayer({ lesson, onClose }: { lesson: PreviewLesson; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,15,36,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 880, background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f0f2f5' }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#4a9ad4', background: '#deeefb', padding: '3px 9px', borderRadius: 6, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Free Preview
            </span>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1a2744', marginTop: 5 }}>{lesson.title}</p>
            {lesson.moduleTitle && <p style={{ fontSize: 12, color: '#9499a8', marginTop: 2 }}>{lesson.moduleTitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#f3f4f6', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 }}>✕</button>
        </div>

        {/* content */}
        {lesson.type === 'VIDEO' && lesson.loomUrl ? (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe src={lesson.loomUrl.replace('share/', 'embed/')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen title={lesson.title} />
          </div>
        ) : lesson.type === 'TEXT' && lesson.content ? (
          <div style={{ padding: '24px 28px', maxHeight: 480, overflowY: 'auto', fontSize: 15, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{lesson.content}</div>
        ) : (
          <div style={{ padding: 48, textAlign: 'center', color: '#9499a8', fontSize: 14 }}>No preview available.</div>
        )}

        {/* footer cta */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f2f5', background: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#717182' }}>Enjoying this? Enroll to unlock all lessons.</p>
          <button onClick={onClose} style={{ padding: '9px 22px', borderRadius: 9999, background: '#1a2744', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            Enroll now →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Curriculum module accordion ──────────────────────────────────────────────

function LessonTypeIcon({ type }: { type: CohortLesson['type'] }) {
  if (type === 'VIDEO')      return <span style={{ fontSize: 13 }}>▶</span>
  if (type === 'TEXT')       return <span style={{ fontSize: 13 }}>📄</span>
  return                            <span style={{ fontSize: 13 }}>🔧</span>
}

interface ModuleRowProps {
  title: string
  lessonCount: number
  freePreviewCount: number
  lessons: CohortLesson[]
  previewLessonMap: Map<string, PreviewLesson>
  onPreviewClick: (l: PreviewLesson) => void
  defaultOpen?: boolean
}

function ModuleRow({ title, lessonCount, freePreviewCount, lessons, previewLessonMap, onPreviewClick, defaultOpen = false }: ModuleRowProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ border: '1px solid rgba(26,39,68,0.09)', borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '15px 18px', background: open ? '#f0f6fc' : '#f8f9fb', cursor: 'pointer', border: 'none', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, color: open ? '#4a9ad4' : '#a3a3a3', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a2744' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {freePreviewCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#4a9ad4', background: '#deeefb', padding: '2px 9px', borderRadius: 9999, letterSpacing: 0.4 }}>
              {freePreviewCount} free
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, color: '#717182', background: '#e8ecf4', padding: '2px 9px', borderRadius: 9999 }}>
            {lessonCount} lessons
          </span>
        </div>
      </button>

      {open && (
        <div style={{ background: '#fff' }}>
          {lessons.length > 0 ? lessons.map((lesson, i) => {
            const preview = previewLessonMap.get(lesson.id)
            return (
              <div
                key={lesson.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: i === 0 ? '1px solid rgba(26,39,68,0.06)' : '1px solid rgba(26,39,68,0.04)', gap: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ color: '#a3a3a3', flexShrink: 0 }}><LessonTypeIcon type={lesson.type} /></span>
                  <span style={{ fontSize: 13, color: lesson.freePreview ? '#1a2744' : '#717182', fontWeight: lesson.freePreview ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lesson.title}
                  </span>
                  {lesson.freePreview && (
                    <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color: '#4a9ad4', background: '#deeefb', padding: '2px 6px', borderRadius: 4, letterSpacing: 0.6 }}>FREE</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {lesson.estimatedMinutes > 0 && (
                    <span style={{ fontSize: 11, color: '#b0b5c3' }}>{lesson.estimatedMinutes}m</span>
                  )}
                  {lesson.freePreview && preview ? (
                    <button
                      onClick={() => onPreviewClick(preview)}
                      style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#4a9ad4', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}
                    >
                      Watch free →
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: '#c8ccd6' }}>🔒</span>
                  )}
                </div>
              </div>
            )
          }) : (
            <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(26,39,68,0.06)' }}>
              <p style={{ fontSize: 13, color: '#a3a3a3' }}>{lessonCount} lesson{lessonCount !== 1 ? 's' : ''} — enroll to access</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{label}</span>
    </div>
  )
}

// ─── Pricing card ──────────────────────────────────────────────────────────────

function PricingCard({ cohort }: { cohort: CohortDetail }) {
  const navigate = useNavigate()

  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 32px rgba(26,39,68,0.14), rgba(26,39,68,0.08) 0 0 0 1px', position: 'sticky', top: 88 }}>

      {/* Price */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 42, fontWeight: 900, color: '#1a2744', letterSpacing: -1.5, lineHeight: 1 }}>
          {cohort.price === 0 ? 'Free' : fmt(cohort.price)}
        </div>
        {cohort.installmentPrice != null && (
          <p style={{ fontSize: 14, color: '#ff8c5a', fontWeight: 700, marginTop: 6 }}>
            or {cohort.installmentCount ?? 3}× {fmt(cohort.installmentPrice)}/mo
          </p>
        )}
      </div>

      {/* Seats urgency */}
      {cohort.seatsRemaining != null && cohort.seatsRemaining <= 10 && (
        <div style={{ background: '#fff8e6', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#8a5a00' }}>Only {cohort.seatsRemaining} seats left!</span>
        </div>
      )}

      {/* Primary CTA */}
      <button
        onClick={() => navigate(`/checkout/${cohort.slug}`)}
        style={{ display: 'block', width: '100%', padding: '15px 0', borderRadius: 9999, background: 'linear-gradient(135deg,#4a9ad4,#1a6aaa)', color: '#fff', fontSize: 16, fontWeight: 800, border: 'none', cursor: 'pointer', marginBottom: 10, letterSpacing: 0.2 }}
      >
        Enroll Now {cohort.price > 0 ? `— ${fmt(cohort.price)}` : '— Free'}
      </button>

      {/* Installment CTA */}
      {cohort.installmentPrice != null && (
        <button
          onClick={() => navigate(`/checkout/${cohort.slug}?plan=installment`)}
          style={{ display: 'block', width: '100%', padding: '13px 0', borderRadius: 9999, background: 'transparent', border: '2px solid #ff8c5a', color: '#cc4a00', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}
        >
          Pay {cohort.installmentCount ?? 3} installments of {fmt(cohort.installmentPrice)}
        </button>
      )}

      {/* Manual payment link */}
      <Link
        to={`/manual-payment/${cohort.slug}`}
        style={{ display: 'block', textAlign: 'center', padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#717182', textDecoration: 'underline', marginBottom: 20 }}
      >
        Upload payment receipt
      </Link>

      <div style={{ height: 1, background: 'rgba(26,39,68,0.08)', marginBottom: 18 }} />

      {/* What's included */}
      <p style={{ fontSize: 11, fontWeight: 800, color: '#717182', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
        What's included
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {cohort.includes.map((item) => (
          <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#4a5568' }}>
            <span style={{ color: '#4a9ad4', fontWeight: 800, marginTop: 1, flexShrink: 0 }}>✓</span>
            {item}
          </li>
        ))}
      </ul>

      <div style={{ height: 1, background: 'rgba(26,39,68,0.08)', margin: '18px 0' }} />

      {/* Trust row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#717182', background: '#f3f4f6', padding: '4px 10px', borderRadius: 8 }}>🔒 Secure</span>
        <span style={{ fontSize: 11, color: '#a3a3a3' }}>Visa · Mastercard · Amex</span>
      </div>
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .sh { background: linear-gradient(90deg,#f0f2f5 25%,#e4e6ea 50%,#f0f2f5 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:8px; }
      `}</style>
      <div className="sh" style={{ height: 420 }} />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px', display: 'flex', gap: 32 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[140, 280, 200].map((h, i) => <div key={i} className="sh" style={{ height: h }} />)}
        </div>
        <div style={{ width: 340, flexShrink: 0 }}>
          <div className="sh" style={{ height: 380, borderRadius: 20 }} />
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CohortDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [activePreview, setActivePreview] = useState<PreviewLesson | null>(null)

  const { data: cohort, isPending, isError } = useQuery<CohortDetail | null>({
    queryKey: ['cohort', slug],
    queryFn: () => fetchCohortBySlug(slug ?? ''),
    enabled: !!slug,
  })

  const { data: previewLessons = [] } = useQuery<PreviewLesson[]>({
    queryKey: ['cohort-preview', slug],
    queryFn: () => fetchPreviewLessons(slug ?? ''),
    enabled: !!slug,
  })

  const previewLessonMap = new Map(previewLessons.map((l) => [l.id, l]))

  usePageMeta({ title: cohort?.title ?? 'Course', description: cohort?.tagline })

  if (isPending) return <div style={{ minHeight: '100vh' }}><TopNav /><Skeleton /></div>

  if (isError || cohort == null) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopNav />
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <p style={{ fontSize: 64, fontWeight: 900, color: '#1a2744', lineHeight: 1 }}>404</p>
          <p style={{ fontSize: 18, color: '#717182' }}>Course not found</p>
          <Link to="/courses" style={{ padding: '12px 32px', borderRadius: 9999, background: '#4a9ad4', color: '#0d1a3a', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>Browse Courses</Link>
        </div>
      </div>
    )
  }

  const typeMeta = TYPE_META[cohort.type] ?? TYPE_META.recorded

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      <style>{`
        @media (max-width: 768px) {
          .cohort-body { flex-direction: column !important; padding: 20px 16px 48px !important; }
          .cohort-sidebar { width: 100% !important; position: static !important; }
          .cohort-hero-inner { padding: 32px 16px 36px !important; }
          .cohort-title { font-size: clamp(28px, 7vw, 62px) !important; }
          .cohort-stats-pills { gap: 8px !important; }
          .mobile-cta-bottom { display: block !important; }
          .includes-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <TopNav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#080f24 0%,#0d1a3a 45%,#1a3060 100%)', position: 'relative', overflow: 'hidden' }}>

        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(74,154,212,0.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: '30%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(26,39,68,0.6) 0%,transparent 70%)', pointerEvents: 'none' }} />

        <div className="cohort-hero-inner" style={{ maxWidth: 1180, margin: '0 auto', padding: '52px 24px 56px' }}>

          {/* Breadcrumb */}
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
            <Link to="/" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>Home</Link>
            {' › '}
            <Link to="/courses" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>Courses</Link>
            {' › '}
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>{cohort.title}</span>
          </p>

          {/* Type badge */}
          <div style={{ marginBottom: 18 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: typeMeta.color, background: typeMeta.bg, padding: '5px 14px', borderRadius: 9999 }}>
              {typeMeta.label}
            </span>
          </div>

          {/* Title */}
          <h1 className="cohort-title" style={{ fontSize: 'clamp(36px, 6vw, 62px)', fontWeight: 900, color: '#fff', letterSpacing: -1.5, lineHeight: 1.05, marginBottom: 16, maxWidth: 780 }}>
            {cohort.title}
          </h1>

          {/* Tagline */}
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.72)', fontWeight: 400, marginBottom: 32, maxWidth: 620, lineHeight: 1.5 }}>
            {cohort.tagline}
          </p>

          {/* Stats pills */}
          <div className="cohort-stats-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {cohort.lessonCount > 0 && <StatPill icon="📹" label={`${cohort.lessonCount} lessons`} />}
            {cohort.hoursOfContent > 0 && <StatPill icon="⏱" label={`${cohort.hoursOfContent}h of content`} />}
            {cohort.startDate && <StatPill icon="📅" label={`Starts ${cohort.startDate}`} />}
            {cohort.enrolledCount != null && <StatPill icon="👥" label={`${cohort.enrolledCount} enrolled`} />}
            {cohort.seatsRemaining != null && <StatPill icon="💺" label={`${cohort.seatsRemaining} seats left`} />}
          </div>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="cohort-body" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 80px', display: 'flex', gap: 32, alignItems: 'flex-start' }}>

        {/* LEFT COLUMN */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* About */}
          <section style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#4a9ad4', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
              About this course
            </p>
            <div
              style={{ fontSize: 16, color: '#4a5568', lineHeight: 1.75 }}
              dangerouslySetInnerHTML={{ __html: cohort.description }}
            />
          </section>

          {/* What you'll learn — from includes */}
          {cohort.includes.length > 0 && (
            <section style={{ background: 'linear-gradient(135deg,#080f24,#1a2e5a)', borderRadius: 20, padding: 32, boxShadow: 'rgba(26,39,68,0.2) 0 4px 24px' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#7bb8e0', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
                What's included
              </p>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 20, letterSpacing: -0.5 }}>
                Everything you need to ship
              </h2>
              <div className="includes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {cohort.includes.map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ color: '#4a9ad4', fontWeight: 800, marginTop: 1, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Curriculum */}
          <section style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#4a9ad4', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
              Curriculum
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a2744', letterSpacing: -0.5 }}>
                {cohort.modules.length} modules · {cohort.lessonCount} lessons
              </h2>
              {previewLessons.length > 0 && (
                <span style={{ fontSize: 13, color: '#4a9ad4', fontWeight: 600 }}>
                  {previewLessons.length} free preview{previewLessons.length !== 1 ? 's' : ''} available
                </span>
              )}
            </div>

            {cohort.modules.map((mod, i) => (
              <ModuleRow
                key={mod.id}
                title={mod.title}
                lessonCount={mod.lessonCount}
                freePreviewCount={mod.freePreviewCount ?? 0}
                lessons={mod.lessons ?? []}
                previewLessonMap={previewLessonMap}
                onPreviewClick={setActivePreview}
                defaultOpen={i === 0}
              />
            ))}
          </section>

          {/* Instructor */}
          <section style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#4a9ad4', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 20 }}>
              Your instructor
            </p>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#4a9ad4,#1a2744)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                👨‍💻
              </div>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1a2744', marginBottom: 3 }}>{cohort.instructorName}</h3>
                <p style={{ fontSize: 14, color: '#4a9ad4', fontWeight: 600, marginBottom: 10 }}>{cohort.instructorTitle}</p>
                <p style={{ fontSize: 15, color: '#717182', lineHeight: 1.65 }}>{cohort.instructorBio}</p>
              </div>
            </div>
          </section>

          {/* Live sessions */}
          {cohort.liveSessions != null && cohort.liveSessions.length > 0 && (
            <section style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: 'rgba(26,39,68,0.08) 0 0 0 1px' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#4a9ad4', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
                Live Sessions
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a2744', marginBottom: 20, letterSpacing: -0.5 }}>Weekly office hours</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cohort.liveSessions.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f9fb', borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(26,39,68,0.06)' }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#1a2744', marginBottom: 2 }}>{s.title}</p>
                      <p style={{ fontSize: 13, color: '#717182' }}>{s.date}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 9999, background: s.status === 'upcoming' ? '#fff0e8' : '#e8ecf4', color: s.status === 'upcoming' ? '#cc4a00' : '#717182' }}>
                      {s.status === 'upcoming' ? '🔴 Upcoming' : 'Completed'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bottom mobile CTA (hidden on desktop) */}
          <div style={{ display: 'none' }} className="mobile-cta-bottom">
            <Link
              to={`/checkout/${cohort.slug}`}
              style={{ display: 'block', width: '100%', textAlign: 'center', padding: '16px 0', borderRadius: 9999, background: 'linear-gradient(135deg,#4a9ad4,#1a6aaa)', color: '#fff', fontSize: 16, fontWeight: 800, textDecoration: 'none' }}
            >
              Enroll Now {cohort.price > 0 ? `— ${fmt(cohort.price)}` : '— Free'}
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN — sticky pricing card */}
        <div className="cohort-sidebar" style={{ width: 340, flexShrink: 0 }}>
          <PricingCard cohort={cohort} />
        </div>
      </div>

      <Footer />

      {/* Preview player modal */}
      {activePreview && <PreviewPlayer lesson={activePreview} onClose={() => setActivePreview(null)} />}
    </div>
  )
}
