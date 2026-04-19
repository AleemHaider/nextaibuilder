// Shared footer — used on all public pages
// Sprint 3 Story 14 — Wise theme migration: warm-black panel with white/80
// body, lime accents, lucide social icons, and the Wave 6 <Button> CTA.
import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Github, Linkedin, Lock, Twitter, Youtube } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import { Logo } from './Logo'
import { Button } from './ui/Button'

// ─── Footer links data ────────────────────────────────────────────────────────

const LEARN_LINKS = [
  { label: 'Browse Courses', to: '/courses' },
  { label: 'Live Cohorts', to: '/courses' },
  { label: 'Course Catalog', to: '/courses' },
  { label: 'Student Login', to: '/login' },
  { label: 'Verify Certificate', to: '/verify-certificate' },
]

const COMPANY_LINKS = [
  { label: 'About', to: '/' },
  { label: 'Blog', to: '/' },
  { label: 'Careers', to: '/' },
  { label: 'Affiliates', to: '/' },
  { label: 'Contact Us', to: '/' },
]

const SUPPORT_LINKS = [
  { label: 'Help Center', to: '/' },
  { label: 'FAQ', to: '/' },
  { label: 'Refund Policy', to: '/' },
  { label: 'Community', to: '/' },
  { label: 'Status', to: '/' },
]

interface SocialLink {
  label: string
  href: string
  Icon: LucideIcon
}

const SOCIAL_LINKS: SocialLink[] = [
  { label: 'Twitter / X', href: '#', Icon: Twitter },
  { label: 'LinkedIn', href: '#', Icon: Linkedin },
  { label: 'GitHub', href: '#', Icon: Github },
  { label: 'YouTube', href: '#', Icon: Youtube },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FooterColProps {
  heading: string
  links: Array<{ label: string; to: string }>
}

function FooterCol({ heading, links }: FooterColProps) {
  return (
    <div>
      <p
        className={cn(
          'text-[11px] font-[700] uppercase tracking-[1.2px] mb-5',
          'text-white/35',
        )}
      >
        {heading}
      </p>
      <nav>
        <ul className="list-none p-0 m-0 space-y-2.5">
          {links.map((l) => (
            <li key={l.label}>
              <Link
                to={l.to}
                className={cn(
                  'text-[14px] no-underline transition-colors',
                  'text-white/60 hover:text-[var(--color-wise-primary)]',
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

// ─── Newsletter form ──────────────────────────────────────────────────────────

function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-xl px-5 py-4',
          'bg-[var(--color-wise-primary)]/15 border border-[var(--color-wise-primary)]/30',
        )}
      >
        <Check
          size={18}
          strokeWidth={2.5}
          className="text-[var(--color-wise-primary)] flex-shrink-0"
          aria-hidden="true"
        />
        <div>
          <p className="text-[14px] font-semibold text-white mb-0.5">
            You're on the list!
          </p>
          <p className="text-[12px] text-white/60">
            We'll notify you when new cohorts open.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex gap-2 mb-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className={cn(
            'flex-1 h-11 rounded-xl px-4 text-[14px] outline-none',
            'bg-white/5 text-white placeholder:text-white/40',
            'border border-white/10',
            'focus:border-[var(--color-wise-primary)]/60',
            'focus:ring-4 focus:ring-[var(--color-wise-primary)]/20',
            'transition-[border-color,box-shadow]',
          )}
        />
        <Button type="submit" variant="primary" size="md" className="flex-shrink-0">
          Notify Me
        </Button>
      </div>
      <p className="text-[12px] text-white/40">
        No spam. Unsubscribe any time.
      </p>
    </form>
  )
}

// ─── Main Footer ──────────────────────────────────────────────────────────────

export function Footer() {
  return (
    <footer role="contentinfo" className="bg-[var(--color-wise-dark)]">
      <style>{`
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
            padding: 48px 20px 36px !important;
            gap: 32px !important;
          }
          .footer-bottom {
            padding: 16px 20px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 8px !important;
          }
          .footer-legal { gap: 12px !important; flex-wrap: wrap !important; }
        }
      `}</style>

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div
        className="footer-grid border-b border-white/10"
        style={{
          padding: '72px 80px 56px',
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1.8fr',
          gap: 40,
        }}
      >
        {/* Brand column */}
        <div>
          <Link
            to="/"
            className="inline-block no-underline mb-3.5"
          >
            <Logo size="md" variant="dark" />
          </Link>
          <p className="text-[14px] text-white/55 leading-[1.7] mb-7 max-w-[240px]">
            The AI education platform built for builders. Learn by shipping real
            projects, not watching lectures.
          </p>

          {/* Social icons */}
          <div className="flex gap-2 mb-7">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className={cn(
                  'w-9 h-9 rounded-[10px] flex items-center justify-center',
                  'border border-white/10 bg-white/5 text-white/55',
                  'hover:bg-[var(--color-wise-primary)]/15',
                  'hover:border-[var(--color-wise-primary)]/40',
                  'hover:text-[var(--color-wise-primary)]',
                  'transition-colors no-underline',
                )}
              >
                <s.Icon size={16} strokeWidth={2} aria-hidden="true" />
              </a>
            ))}
          </div>

          {/* Trust badges — emoji swapped for lucide icons */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[12px] text-white/45">
              <Lock size={13} strokeWidth={2.25} aria-hidden="true" className="text-[var(--color-wise-primary)]" />
              Stripe-secured payments
            </div>
            <div className="flex items-center gap-2 text-[12px] text-white/45">
              <Check size={13} strokeWidth={2.5} aria-hidden="true" className="text-[var(--color-wise-primary)]" />
              30-day money-back guarantee
            </div>
          </div>
        </div>

        {/* Nav columns */}
        <FooterCol heading="Learn" links={LEARN_LINKS} />
        <FooterCol heading="Company" links={COMPANY_LINKS} />
        <FooterCol heading="Support" links={SUPPORT_LINKS} />

        {/* Newsletter column */}
        <div>
          <p className="text-[11px] font-[700] uppercase tracking-[1.2px] mb-5 text-white/35">
            Stay in the loop
          </p>
          <p className="text-[15px] font-[700] text-white leading-[1.4] mb-2">
            Get early access to new cohorts
          </p>
          <p className="text-[13px] text-white/55 leading-[1.6] mb-5">
            New AI cohorts sell out fast. Be first to know when spots open.
          </p>
          <NewsletterForm />

          {/* Cohort types quick reference */}
          <div className="mt-7">
            <p className="text-[11px] font-[700] uppercase tracking-[1px] mb-3 text-white/25">
              We offer
            </p>
            <div className="flex flex-col gap-2">
              {[
                {
                  dotClass: 'bg-[var(--color-wise-primary)]',
                  label: 'Recorded courses',
                  sub: 'Self-paced, lifetime access',
                },
                {
                  dotClass: 'bg-[var(--color-wise-primary-hover)]',
                  label: 'Live cohorts',
                  sub: 'Scheduled with instructor',
                },
                {
                  dotClass: 'bg-[var(--color-wise-mint)]',
                  label: 'Combined cohorts',
                  sub: 'Recorded + live sessions',
                },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      t.dotClass,
                    )}
                  />
                  <div>
                    <span className="text-[13px] font-[600] text-white/70">
                      {t.label}
                    </span>
                    <span className="text-[12px] text-white/40 ml-1.5">
                      {t.sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────────────── */}
      <div
        className="footer-bottom flex-wrap"
        style={{
          padding: '20px 80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <p className="text-[13px] text-white/30">
          © {new Date().getFullYear()} nextaibuilder. All rights reserved.
        </p>
        <nav className="footer-legal flex gap-5" aria-label="Legal">
          {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((l) => (
            <a
              key={l}
              href="#"
              className={cn(
                'text-[13px] no-underline transition-colors',
                'text-white/30 hover:text-[var(--color-wise-primary)]',
              )}
            >
              {l}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
