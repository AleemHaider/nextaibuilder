// About page — nextaibuilder platform
//
// Sprint 3 Story 13 — migrated from navy/blue palette to the Wise theme.
// Emojis swapped for lucide icons, inline styles consolidated into Tailwind
// classes that consume the `--color-wise-*` tokens. The existing TopNav is
// left untouched (separate story).
import { Link } from 'react-router'
import {
  ArrowRight,
  Target,
  Users,
  Rocket,
  Unlock,
  type LucideIcon,
} from 'lucide-react'
import { TopNav } from '../components/TopNav'
import { cn } from '../lib/utils'

const TEAM = [
  {
    name: 'Aleem Haider',
    role: 'Founder & Lead Instructor',
    bio: 'Builder, educator, and AI product enthusiast. Helping founders ship real AI products.',
    initials: 'AH',
  },
]

interface Value {
  Icon: LucideIcon
  title: string
  desc: string
}

const VALUES: Value[] = [
  {
    Icon: Target,
    title: "Build, don't just learn",
    desc: 'Every cohort ends with a deployed, production-grade project — not a certificate you forget about.',
  },
  {
    Icon: Users,
    title: 'Community first',
    desc: 'You learn faster alongside people who share your goals. Our cohorts keep groups intentionally small.',
  },
  {
    Icon: Rocket,
    title: 'AI-native curriculum',
    desc: 'We update every cohort as the tools evolve. No stale content — just what\'s relevant right now.',
  },
  {
    Icon: Unlock,
    title: 'Transparent pricing',
    desc: 'Instalment plans, manual payment options, and no hidden fees. Education should be accessible.',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--color-wise-canvas)]">
      <TopNav />

      <main className="max-w-[1100px] mx-auto px-6 py-12 lg:py-16">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section
          className={cn(
            'relative overflow-hidden mb-14',
            'rounded-[var(--radius-xl)]',
            'bg-[var(--color-wise-dark)] text-white',
            'px-7 py-10 sm:px-12 sm:py-14 lg:px-16 lg:py-16',
          )}
        >
          {/* Decorative blobs */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-16 w-[320px] h-[320px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(159,232,112,0.22) 0%, transparent 70%)',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 left-[35%] w-[200px] h-[200px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(226,246,213,0.16) 0%, transparent 70%)',
            }}
          />

          <p className="relative mb-4 text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--color-wise-primary)]">
            About nextaibuilder
          </p>
          <h1 className="relative mb-5 max-w-[640px] text-4xl sm:text-5xl md:text-[56px] font-black leading-[0.95] tracking-[-1px]">
            We help builders ship<br />
            <span className="text-[var(--color-wise-primary)]">real AI products.</span>
          </h1>
          <p className="relative mb-8 max-w-[560px] text-base sm:text-[17px] leading-relaxed text-white/70">
            nextaibuilder is a cohort-based learning platform where founders,
            developers, and product thinkers learn to build and ship AI products
            — with live sessions, real projects, and a community that actually
            shows up.
          </p>
          <Link
            to="/courses"
            className={cn(
              'relative inline-flex items-center gap-2',
              'rounded-[var(--radius-pill)] px-7 py-3',
              'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
              'text-[15px] font-bold',
              'transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]',
              'hover:bg-[var(--color-wise-primary-hover)]',
              'focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2',
            )}
          >
            Browse cohorts
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        {/* ── Values ────────────────────────────────────────────────────── */}
        <p className="mb-5 text-[11px] font-extrabold uppercase tracking-[1.2px] text-[var(--color-wise-text-muted)]">
          What we stand for
        </p>
        <div className="mb-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {VALUES.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className={cn(
                'flex flex-col gap-3.5',
                'rounded-[var(--radius-md)] bg-[var(--color-wise-surface)]',
                'px-5 py-6 shadow-[var(--shadow-ring)]',
              )}
            >
              <div
                className={cn(
                  'flex h-13 w-13 items-center justify-center',
                  'h-[52px] w-[52px] rounded-2xl',
                  'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
              </div>
              <div>
                <p className="mb-1.5 text-[15px] font-bold leading-tight text-[var(--color-wise-text)]">
                  {title}
                </p>
                <p className="m-0 text-[13px] leading-[1.55] text-[var(--color-wise-text-muted)]">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Team ──────────────────────────────────────────────────────── */}
        <p className="mb-5 text-[11px] font-extrabold uppercase tracking-[1.2px] text-[var(--color-wise-text-muted)]">
          The team
        </p>
        <div className="mb-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEAM.map((member) => (
            <div
              key={member.name}
              className={cn(
                'flex flex-col items-start gap-3.5',
                'rounded-[var(--radius-md)] bg-[var(--color-wise-surface)]',
                'px-6 py-7 shadow-[var(--shadow-ring)]',
              )}
            >
              <div
                className={cn(
                  'h-[60px] w-[60px] rounded-full',
                  'flex items-center justify-center',
                  'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                  'text-xl font-extrabold',
                )}
                aria-hidden="true"
              >
                {member.initials}
              </div>
              <div>
                <p className="mb-0.5 text-base font-bold text-[var(--color-wise-text)]">
                  {member.name}
                </p>
                <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.6px] text-[var(--color-wise-primary-text)]">
                  {member.role}
                </p>
                <p className="m-0 text-[13px] leading-[1.55] text-[var(--color-wise-text-muted)]">
                  {member.bio}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-6',
            'rounded-[var(--radius-lg)] bg-[var(--color-wise-surface)]',
            'px-8 py-10 shadow-[var(--shadow-ring)]',
          )}
        >
          <div>
            <h2 className="mb-1.5 text-[22px] font-extrabold text-[var(--color-wise-text)]">
              Ready to build?
            </h2>
            <p className="m-0 text-[15px] text-[var(--color-wise-text-muted)]">
              Pick a cohort and start shipping in days, not months.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/courses"
              className={cn(
                'inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-6 py-2.5',
                'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
                'text-sm font-bold',
                'transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]',
                'hover:bg-[var(--color-wise-primary-hover)]',
                'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
              )}
            >
              See all cohorts
            </Link>
            <Link
              to="/signup"
              className={cn(
                'inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-6 py-2.5',
                'bg-transparent text-[var(--color-wise-text)]',
                'ring-1 ring-[var(--color-wise-ring-strong)]',
                'text-sm font-semibold',
                'transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]',
                'hover:bg-[var(--color-wise-mint)]',
                'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
              )}
            >
              Create free account
            </Link>
          </div>
        </div>

      </main>
    </div>
  )
}
