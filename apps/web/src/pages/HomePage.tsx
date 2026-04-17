// FIR-28 — Public homepage (original design)
import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import { usePageMeta } from '../hooks/usePageMeta'

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const FEATURED_COURSES = [
  {
    title: 'Claude API Mastery',
    tagline: "Build production AI apps with Anthropic's API",
    coverClass: 'blue',
    badgeLabel: 'Recorded',
    badgeType: 'blue',
    price: '$499',
    installment: '3×$166/mo',
    meta: 'Self-paced · 24 lessons',
    slug: 'claude-api-mastery',
  },
  {
    title: 'AI Product Bootcamp',
    tagline: 'Ship your first AI product in 8 weeks',
    coverClass: 'orange',
    badgeLabel: 'Live Cohort',
    badgeType: 'orange',
    price: '$999',
    installment: '3×$333/mo',
    meta: 'Starts Jan 20 · 12 seats',
    slug: 'ai-product-bootcamp',
  },
  {
    title: 'Full-Stack AI Dev',
    tagline: 'End-to-end AI engineering from prompt to prod',
    coverClass: 'deep',
    badgeLabel: 'Combined',
    badgeType: 'navy',
    price: '$1,499',
    installment: '3×$499/mo',
    meta: 'Starts Feb 3 · 8 seats left',
    slug: 'full-stack-ai-dev',
  },
]

const FAQ_ITEMS = [
  {
    q: 'What is the difference between recorded and live cohorts?',
    a: 'Recorded cohorts are self-paced with video lessons you can watch anytime. Live cohorts have scheduled sessions with real-time instructor interaction and peer collaboration.',
  },
  {
    q: 'Can I pay in installments?',
    a: 'Yes! All courses offer a 3-installment payment plan. Your first payment is processed today, with the remaining two billed 30 and 60 days later.',
  },
  {
    q: 'Do I get lifetime access to course materials?',
    a: 'Yes, once enrolled you get lifetime access to all course materials, including future updates and new lessons added to the curriculum.',
  },
  {
    q: 'What if I miss a live session?',
    a: 'All live sessions are recorded and available within 24 hours. You will never miss content — recordings are stored in your student dashboard indefinitely.',
  },
  {
    q: 'What tools do I need to get started?',
    a: 'Just a computer and internet connection. Our AI-validated tool setup guides you through installing everything you need step by step.',
  },
  {
    q: 'Is there a refund policy?',
    a: 'Yes, we offer a full refund within 7 days of purchase if you are not satisfied for any reason. No questions asked.',
  },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FaqItem({ q, a }: { q: string; a: string | null }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderBottom: '1px solid rgba(26,39,68,0.1)', padding: '24px 0' }}>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
          padding: 0,
          gap: 16,
        }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span style={{ fontSize: 18, fontWeight: 600, color: '#1a2744', lineHeight: 1.4 }}>{q}</span>
        <div style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#717182',
          fontSize: 18,
        }}>
          {open ? <ChevronDown size={20} aria-hidden="true" /> : <ChevronRight size={20} aria-hidden="true" />}
        </div>
      </button>
      {open && a && (
        <p style={{ fontSize: 16, color: '#717182', lineHeight: 1.7, marginTop: 16, marginBottom: 0 }}>{a}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  usePageMeta({
    title: 'Build AI Products. Ship Real Projects.',
    description: 'Learn to build, deploy, and scale AI-powered products through hands-on cohorts and recorded courses.',
  })

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', sans-serif", background: '#f8f9fb', color: '#1a2744' }}>
      <style>{`
        @media (max-width: 768px) {
          .hero-section { flex-direction: column !important; padding: 40px 20px !important; min-height: unset !important; }
          .hero-right { display: none !important; }
          .hero-title { font-size: clamp(40px, 10vw, 88px) !important; letter-spacing: -1px !important; }
          .hero-buttons { flex-direction: column !important; }
          .section-pad { padding: 64px 20px !important; }
          .props-grid { grid-template-columns: 1fr !important; }
          .course-types-grid { grid-template-columns: 1fr !important; }
          .featured-grid { grid-template-columns: 1fr !important; }
          .how-it-works-row { flex-direction: column !important; align-items: center !important; gap: 32px !important; }
          .hiw-connector { display: none !important; }
          .stats-row { flex-direction: column !important; gap: 32px !important; align-items: center !important; }
          .stats-number { font-size: 56px !important; }
          .pricing-callout { flex-direction: column !important; padding: 32px 20px !important; gap: 28px !important; }
          .pricing-boxes { grid-template-columns: 1fr !important; }
          .section-h2 { font-size: clamp(32px, 8vw, 48px) !important; }
          .footer-cta-h2 { font-size: clamp(32px, 8vw, 64px) !important; }
          .footer-cta-section { padding: 64px 20px !important; }
        }
      `}</style>

      <TopNav />

      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="hero-section" style={{
        background: '#fff',
        padding: '96px 80px',
        display: 'flex',
        alignItems: 'center',
        minHeight: 600,
        gap: 60,
      }}>
        {/* Left — copy */}
        <div style={{ flex: '0 0 55%' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#e8f4fd',
            color: '#1a2744',
            padding: '6px 14px',
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 28,
          }}>
            <span style={{ width: 8, height: 8, background: '#4a9ad4', borderRadius: '50%', display: 'inline-block' }} />
            AI Education Platform
          </div>

          <h1 className="hero-title" style={{
            fontSize: 88,
            fontWeight: 900,
            lineHeight: 0.88,
            color: '#1a2744',
            letterSpacing: -3,
            marginBottom: 28,
            margin: '0 0 28px 0',
          }}>
            Build AI<br />
            Products.<br />
            <span style={{ color: '#4a9ad4' }}>Ship Real</span><br />
            Projects.
          </h1>

          <p style={{
            fontSize: 20,
            fontWeight: 400,
            color: '#717182',
            lineHeight: 1.55,
            marginBottom: 40,
            maxWidth: 480,
          }}>
            Learn to build, deploy, and scale AI-powered products through hands-on cohorts and recorded courses.
          </p>

          <div className="hero-buttons" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Link
              to="/courses"
              style={{
                padding: '16px 32px',
                borderRadius: 9999,
                fontSize: 17,
                fontWeight: 700,
                background: '#4a9ad4',
                color: '#0d1a3a',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Browse Courses
            </Link>
            <Link
              to="#how-it-works"
              style={{
                padding: '16px 32px',
                borderRadius: 9999,
                fontSize: 17,
                fontWeight: 700,
                background: 'transparent',
                border: '2px solid #4a9ad4',
                color: '#4a9ad4',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              See How It Works
            </Link>
          </div>
        </div>

        {/* Right — illustration */}
        <div className="hero-right" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: '100%',
            height: 460,
            background: 'linear-gradient(135deg, #1a2744 0%, #2d4a8a 40%, #4a9ad4 100%)',
            borderRadius: 40,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
          }}>
            {/* Card 1 — top left */}
            <div style={{
              position: 'absolute',
              top: 40,
              left: 30,
              width: 200,
              background: '#fff',
              borderRadius: 16,
              padding: '16px 20px',
              boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 9999,
                display: 'inline-block',
                marginBottom: 8,
                background: '#e8f4fd',
                color: '#1a2744',
              }}>
                Recorded
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 4 }}>Claude API Mastery</div>
              <div style={{ fontSize: 11, color: '#717182' }}>24 lessons · Self-paced</div>
              <div style={{ height: 4, background: '#e8ecf4', borderRadius: 2, marginTop: 8 }}>
                <div style={{ height: '100%', width: '68%', borderRadius: 2, background: '#4a9ad4' }} />
              </div>
            </div>

            {/* Card 2 — top right */}
            <div style={{
              position: 'absolute',
              top: 120,
              right: 20,
              width: 180,
              background: '#fff',
              borderRadius: 16,
              padding: '16px 20px',
              boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 9999,
                display: 'inline-block',
                marginBottom: 8,
                background: '#fff0e8',
                color: '#cc4a00',
              }}>
                Live Cohort
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 4 }}>AI Product Bootcamp</div>
              <div style={{ fontSize: 11, color: '#717182' }}>Starts Jan 20 · 12 seats</div>
            </div>

            {/* Card 3 — bottom left */}
            <div style={{
              position: 'absolute',
              bottom: 60,
              left: 50,
              width: 220,
              background: '#fff',
              borderRadius: 16,
              padding: '16px 20px',
              boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 9999,
                display: 'inline-block',
                marginBottom: 8,
                background: '#e8ecf4',
                color: '#1a2744',
              }}>
                Combined
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 4 }}>Full-Stack AI Dev</div>
              <div style={{ fontSize: 11, color: '#717182' }}>48 lessons + 8 live sessions</div>
              <div style={{ height: 4, background: '#e8ecf4', borderRadius: 2, marginTop: 8 }}>
                <div style={{ height: '100%', width: '35%', borderRadius: 2, background: '#4a9ad4' }} />
              </div>
            </div>

            {/* Floating stat */}
            <div style={{
              position: 'absolute',
              bottom: 30,
              right: 20,
              background: '#1a2744',
              color: '#fff',
              borderRadius: 12,
              padding: '10px 16px',
              fontSize: 12,
              fontWeight: 700,
            }}>
              <span style={{ color: '#4a9ad4', fontSize: 20, fontWeight: 900, display: 'block' }}>500+</span>
              Students Enrolled
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* VALUE PROPS                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="section-pad" style={{ background: '#f8f9fb', padding: '96px 80px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#4a9ad4', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12, margin: '0 0 12px' }}>
          Why nextaibuilder
        </p>
        <h2 className="section-h2" style={{ fontSize: 48, fontWeight: 900, color: '#1a2744', lineHeight: 0.9, letterSpacing: -1.5, marginBottom: 60, margin: '0 0 60px' }}>
          Everything you need<br />to ship AI products
        </h2>
        <div className="props-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
          {[
            { icon: '🎯', title: 'Project-First Learning', desc: 'Every lesson is tied to a real deliverable. You leave each cohort with shipped code, not just notes.' },
            { icon: '🤖', title: 'AI-Validated Tools', desc: 'Our AI verifies your tool setup at each step, so you never get stuck on configuration issues.' },
            { icon: '💬', title: 'Live Expert Sessions', desc: 'Join live cohorts with direct instructor access, Q&A sessions, and real-time code reviews.' },
          ].map((p) => (
            <div key={p.title} style={{
              background: '#fff',
              borderRadius: 24,
              padding: 36,
              boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
            }}>
              <div style={{
                width: 56,
                height: 56,
                background: '#e8f4fd',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                fontSize: 24,
              }}>
                {p.icon}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2744', marginBottom: 10 }}>{p.title}</div>
              <div style={{ fontSize: 16, fontWeight: 400, color: '#717182', lineHeight: 1.6 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* COURSE TYPES                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="section-pad" style={{ background: '#fff', padding: '96px 80px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#4a9ad4', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }}>
          Learning Formats
        </p>
        <h2 className="section-h2" style={{ fontSize: 48, fontWeight: 900, color: '#1a2744', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 60px' }}>
          Three ways to learn,<br />one destination
        </h2>
        <div className="course-types-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { icon: '📹', iconBg: '#e8f4fd', badge: 'Recorded', badgeBg: '#e8f4fd', badgeColor: '#1a2744', name: 'Self-Paced Courses', desc: 'Watch at your own pace. Rewind, rewatch, and revisit any lesson whenever you need it.' },
            { icon: '🔴', iconBg: '#fff0e8', badge: 'Live Cohort', badgeBg: '#fff0e8', badgeColor: '#cc4a00', name: 'Live Cohorts', desc: 'Scheduled sessions with live instruction, peer collaboration, and real-time feedback.' },
            { icon: '⚡', iconBg: '#e8ecf4', badge: 'Combined', badgeBg: '#e8ecf4', badgeColor: '#1a2744', name: 'Combined Cohorts', desc: 'Best of both — recorded content with live sessions layered in at key milestones.' },
          ].map((t) => (
            <div key={t.name} style={{
              background: '#f8f9fb',
              borderRadius: 30,
              padding: 40,
              boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
            }}>
              <div style={{
                width: 64,
                height: 64,
                background: t.iconBg,
                borderRadius: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                fontSize: 28,
              }}>
                {t.icon}
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 9999,
                display: 'inline-block',
                marginBottom: 12,
                background: t.badgeBg,
                color: t.badgeColor,
              }}>
                {t.badge}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a2744', marginBottom: 12 }}>{t.name}</div>
              <div style={{ fontSize: 16, color: '#717182', lineHeight: 1.6, marginBottom: 20 }}>{t.desc}</div>
              <Link to="/courses" style={{ fontSize: 15, fontWeight: 600, color: '#4a9ad4', textDecoration: 'none' }}>
                Learn more →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FEATURED COURSES                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="section-pad" style={{ background: '#f8f9fb', padding: '96px 80px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#4a9ad4', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }}>
          Featured Cohorts
        </p>
        <h2 className="section-h2" style={{ fontSize: 48, fontWeight: 900, color: '#1a2744', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 60px' }}>
          Start learning today
        </h2>
        <div className="featured-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {FEATURED_COURSES.map((c) => {
            const coverGradient = c.coverClass === 'orange'
              ? 'linear-gradient(135deg, #cc4a00, #ff8c5a)'
              : c.coverClass === 'deep'
              ? 'linear-gradient(135deg, #0d1a3a, #2d4a8a)'
              : 'linear-gradient(135deg, #1a2744, #4a9ad4)'
            const badgeBg = c.badgeType === 'orange' ? '#fff0e8' : c.badgeType === 'navy' ? '#e8ecf4' : '#e8f4fd'
            const badgeColor = c.badgeType === 'orange' ? '#cc4a00' : '#1a2744'
            return (
              <div key={c.title} style={{
                background: '#fff',
                borderRadius: 30,
                overflow: 'hidden',
                boxShadow: 'rgba(26,39,68,0.12) 0 0 0 1px',
              }}>
                <div style={{
                  height: 200,
                  background: coverGradient,
                  position: 'relative',
                }}>
                  <div style={{ position: 'absolute', top: 16, left: 16 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: 9999,
                      background: badgeBg,
                      color: badgeColor,
                    }}>
                      {c.badgeLabel}
                    </span>
                  </div>
                </div>
                <div style={{ padding: 24 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1a2744', marginBottom: 8, lineHeight: 1.3 }}>{c.title}</div>
                  <div style={{ fontSize: 14, color: '#717182', marginBottom: 16 }}>{c.tagline}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#1a2744' }}>{c.price}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#ff8c5a' }}>{c.installment}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#717182', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                    📅 {c.meta}
                  </div>
                  <Link to={`/courses/${c.slug}`} style={{
                    display: 'block',
                    width: '100%',
                    padding: 12,
                    borderRadius: 9999,
                    background: '#4a9ad4',
                    color: '#0d1a3a',
                    fontSize: 15,
                    fontWeight: 700,
                    textAlign: 'center',
                    textDecoration: 'none',
                    boxSizing: 'border-box',
                  }}>
                    Enroll Now
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* HOW IT WORKS                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section id="how-it-works" className="section-pad" style={{ background: '#fff', padding: '96px 80px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#4a9ad4', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }}>
          Process
        </p>
        <h2 className="section-h2" style={{ fontSize: 48, fontWeight: 900, color: '#1a2744', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 60px' }}>
          Three steps to<br />your first AI product
        </h2>
        <div className="how-it-works-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative' }}>
          {[
            { num: 1, title: 'Browse Courses', desc: 'Explore our catalog of recorded courses and live cohorts. Filter by format, topic, or level.' },
            { num: 2, title: 'Enroll & Pay', desc: 'Secure checkout with Stripe or pay in 3 installments. Manual payment options also available.' },
            { num: 3, title: 'Learn & Ship', desc: 'Follow the curriculum, set up your AI tools, and ship real projects with instructor support.' },
          ].map((step, i) => (
            <div key={step.num} style={{ flex: 1, textAlign: 'center', position: 'relative', padding: '0 20px' }}>
              {/* Dashed connector */}
              {i < 2 && (
                <div className="hiw-connector" style={{
                  position: 'absolute',
                  top: 32,
                  left: '50%',
                  right: '-50%',
                  height: 2,
                  background: 'repeating-linear-gradient(90deg, #4a9ad4 0, #4a9ad4 8px, transparent 8px, transparent 16px)',
                  zIndex: 0,
                }} />
              )}
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 9999,
                background: '#4a9ad4',
                color: '#fff',
                fontSize: 24,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                position: 'relative',
                zIndex: 1,
              }}>
                {step.num}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2744', marginBottom: 10 }}>{step.title}</div>
              <div style={{ fontSize: 16, color: '#717182', lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* STATS                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="section-pad" style={{ background: '#1a2744', padding: '96px 80px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }}>
          By the numbers
        </p>
        <h2 className="section-h2" style={{ fontSize: 48, fontWeight: 900, color: '#fff', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 40px' }}>
          Trusted by builders<br />around the world
        </h2>
        <div className="stats-row" style={{ display: 'flex', justifyContent: 'center', gap: 80, marginTop: 40 }}>
          {[
            { number: '500+', label: 'Students Enrolled' },
            { number: '12',   label: 'Active Cohorts' },
            { number: '95%',  label: 'Completion Rate' },
          ].map((s) => (
            <div key={s.label}>
              <div className="stats-number" style={{ fontSize: 80, fontWeight: 900, color: '#4a9ad4', lineHeight: 1, letterSpacing: -2 }}>{s.number}</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* PRICING CALLOUT                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="section-pad" style={{ background: '#f8f9fb', padding: '96px 80px' }}>
        <div className="pricing-callout" style={{
          background: 'linear-gradient(135deg, #1a2744 0%, #2d4a8a 100%)',
          borderRadius: 40,
          padding: 64,
          display: 'flex',
          gap: 60,
          alignItems: 'center',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }}>
              Flexible Pricing
            </p>
            <h2 style={{ fontSize: 48, fontWeight: 900, color: '#fff', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 16px' }}>
              Pay your<br />way
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: 0 }}>
              Choose full payment or spread the cost across 3 installments. Manual payment option also available.
            </p>
          </div>
          <div className="pricing-boxes" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 20,
              padding: 28,
              border: '1px solid rgba(255,255,255,0.12)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Pay in Full</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>$999</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>One-time payment</div>
            </div>
            <div style={{
              background: 'rgba(74,154,212,0.2)',
              borderRadius: 20,
              padding: 28,
              border: '1px solid #4a9ad4',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Installment Plan</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>
                $333<span style={{ fontSize: 16, fontWeight: 500 }}>/mo</span>
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>×3 monthly payments</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ff8c5a', marginTop: 8 }}>Most popular option</div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FAQ                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="section-pad" style={{ background: '#fff', padding: '96px 80px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#4a9ad4', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }}>FAQ</p>
          <h2 className="section-h2" style={{ fontSize: 48, fontWeight: 900, color: '#1a2744', lineHeight: 0.9, letterSpacing: -1.5, margin: '0 0 60px' }}>
            Frequently asked<br />questions
          </h2>
        </div>
        <div style={{ maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }}>
          {FAQ_ITEMS.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER CTA                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="footer-cta-section" style={{ background: '#1a2744', padding: '96px 80px', textAlign: 'center' }}>
        <h2 className="footer-cta-h2" style={{ fontSize: 64, fontWeight: 900, color: '#fff', lineHeight: 0.9, letterSpacing: -2, marginBottom: 32, margin: '0 0 32px' }}>
          Ready to build<br />your first AI product?
        </h2>
        <Link to="/courses" style={{
          display: 'inline-block',
          padding: '18px 40px',
          borderRadius: 9999,
          fontSize: 18,
          fontWeight: 700,
          background: '#4a9ad4',
          color: '#0d1a3a',
          textDecoration: 'none',
        }}>
          Get Started Today
        </Link>
        <div style={{ marginTop: 24, display: 'flex', gap: 24, justifyContent: 'center' }}>
          <Link to="/privacy" style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Terms of Service</Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
const __BUILD_MARKER__ = "newdesign-v2";
// build-1776111635
