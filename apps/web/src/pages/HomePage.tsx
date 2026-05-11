// FIR-28 — Public homepage
// Sprint 3 Story 13 — Wise theme migration.
//
// Navy/blue palette replaced with `--color-wise-*` tokens. All emoji glyphs
// swapped for lucide icons. Inline styles collapsed into Tailwind class
// strings so the cascade is predictable and responsive breakpoints work
// through the normal `sm:` / `md:` / `lg:` modifiers.
import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  Target,
  Bot,
  MessageSquare,
  Video,
  Radio,
  Zap,
  Calendar,
  type LucideIcon,
} from 'lucide-react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import { usePageMeta } from '../hooks/usePageMeta'
import { fetchCohorts, type CohortSummary } from '../lib/api'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

type BadgeTone = 'primary' | 'mint' | 'neutral'

interface FeaturedCourse {
  title: string
  tagline: string
  coverTone: 'primary' | 'dark' | 'mint'
  badgeLabel: string
  badgeTone: BadgeTone
  price: string
  installment: string
  meta: string
  slug: string
}

// Logos for the "Our students come from" social-proof strip.
//
// Companies: Iconify proxies the simple-icons collection through
// `api.iconify.design`, which still serves brands that the cdn.simpleicons.org
// took down (Amazon, Microsoft, IBM were removed there). Color query is
// `?color=%239ca3af` (URL-encoded #9ca3af) so every SVG comes back tinted to
// a uniform grey instead of full brand color.
//
// Universities: Google's favicon service returns each school's own
// site favicon at 128x128. Quality is good enough for a 32px row and the URL
// is stable. This is also how LinkedIn, Twitter, and most logo-wall services
// resolve "school" logos without paying for a logo-licensing API.
const ICON_COLOR = '9ca3af'  // muted grey, same as text-muted

const STUDENT_COMPANIES: { name: string; slug: string }[] = [
  { name: 'Google',    slug: 'google' },
  { name: 'Meta',      slug: 'meta' },
  { name: 'Amazon',    slug: 'amazon' },
  { name: 'IBM',       slug: 'ibm' },
  { name: 'Microsoft', slug: 'microsoft' },
  { name: 'Apple',     slug: 'apple' },
  { name: 'Netflix',   slug: 'netflix' },
  { name: 'Stripe',    slug: 'stripe' },
]

const STUDENT_UNIVERSITIES: { name: string; domain: string }[] = [
  { name: 'Harvard',          domain: 'harvard.edu' },
  { name: 'Stanford',         domain: 'stanford.edu' },
  { name: 'MIT',              domain: 'mit.edu' },
  { name: 'Carnegie Mellon',  domain: 'cmu.edu' },
  { name: 'UC Berkeley',      domain: 'berkeley.edu' },
  { name: 'Oxford',           domain: 'ox.ac.uk' },
]

// Map an API cohort to the visual shape this page renders. The covered tones
// rotate through the palette so cards stay visually varied regardless of how
// many cohorts come back from the API.
const COVER_TONES: FeaturedCourse['coverTone'][] = ['primary', 'mint', 'dark']
const BADGE_TONES: Record<string, FeaturedCourse['badgeTone']> = {
  live:     'mint',
  recorded: 'primary',
  combined: 'neutral',
}
const BADGE_LABELS: Record<string, string> = {
  live:     'Live Cohort',
  recorded: 'Recorded',
  combined: 'Combined',
}

function toFeatured(c: CohortSummary, i: number): FeaturedCourse {
  const type = (c.type ?? 'recorded').toLowerCase()
  return {
    title:       c.title,
    tagline:     c.tagline,
    coverTone:   COVER_TONES[i % COVER_TONES.length],
    badgeLabel:  BADGE_LABELS[type] ?? 'Course',
    badgeTone:   BADGE_TONES[type] ?? 'neutral',
    price:       `$${c.price.toLocaleString('en-US')}`,
    installment: c.installmentPrice != null
      ? `${c.installmentCount ?? 3}× $${c.installmentPrice.toLocaleString('en-US')}/mo`
      : '',
    meta:        c.meta || (type === 'recorded' ? 'Self-paced' : ''),
    slug:        c.slug,
  }
}

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
// Helpers
// ---------------------------------------------------------------------------

const badgeToneClasses: Record<BadgeTone, string> = {
  primary:
    'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
  mint:
    'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
  neutral:
    'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text)]',
}

const coverClasses: Record<FeaturedCourse['coverTone'], string> = {
  primary:
    'bg-gradient-to-br from-[var(--color-wise-primary)] to-[var(--color-wise-mint)]',
  dark:
    'bg-gradient-to-br from-[var(--color-wise-dark)] to-[var(--color-wise-text-warm)]',
  mint:
    'bg-gradient-to-br from-[var(--color-wise-mint)] to-[var(--color-wise-primary)]',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[13px] font-semibold uppercase tracking-[1.5px] text-[var(--color-wise-primary-text)]">
      {children}
    </p>
  )
}

function FaqItem({ q, a }: { q: string; a: string | null }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-[var(--color-wise-ring)] py-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-4 text-left',
          'cursor-pointer bg-transparent border-0 p-0',
          'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2 rounded-md',
        )}
      >
        <span className="text-[18px] font-semibold leading-snug text-[var(--color-wise-text)]">
          {q}
        </span>
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-[var(--color-wise-text-muted)]">
          {open ? (
            <ChevronDown size={20} aria-hidden="true" />
          ) : (
            <ChevronRight size={20} aria-hidden="true" />
          )}
        </span>
      </button>
      {open && a && (
        <p className="mt-4 mb-0 text-base leading-[1.7] text-[var(--color-wise-text-muted)]">
          {a}
        </p>
      )}
    </div>
  )
}

interface ValueProp {
  Icon: LucideIcon
  title: string
  desc: string
}

const VALUE_PROPS: ValueProp[] = [
  {
    Icon: Target,
    title: 'Project-First Learning',
    desc: 'Every lesson is tied to a real deliverable. You leave each cohort with shipped code, not just notes.',
  },
  {
    Icon: Bot,
    title: 'AI-Validated Tools',
    desc: 'Our AI verifies your tool setup at each step, so you never get stuck on configuration issues.',
  },
  {
    Icon: MessageSquare,
    title: 'Live Expert Sessions',
    desc: 'Join live cohorts with direct instructor access, Q&A sessions, and real-time code reviews.',
  },
]

interface CourseType {
  Icon: LucideIcon
  badge: string
  badgeTone: BadgeTone
  name: string
  desc: string
}

const COURSE_TYPES: CourseType[] = [
  {
    Icon: Video,
    badge: 'Recorded',
    badgeTone: 'primary',
    name: 'Self-Paced Courses',
    desc: 'Watch at your own pace. Rewind, rewatch, and revisit any lesson whenever you need it.',
  },
  {
    Icon: Radio,
    badge: 'Live Cohort',
    badgeTone: 'mint',
    name: 'Live Cohorts',
    desc: 'Scheduled sessions with live instruction, peer collaboration, and real-time feedback.',
  },
  {
    Icon: Zap,
    badge: 'Combined',
    badgeTone: 'neutral',
    name: 'Combined Cohorts',
    desc: 'Best of both — recorded content with live sessions layered in at key milestones.',
  },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  usePageMeta({
    title: 'Build AI Products. Ship Real Projects.',
    description:
      'Learn to build, deploy, and scale AI-powered products through hands-on cohorts and recorded courses.',
  })

  // Pull published cohorts from the storefront API. Same query the catalog
  // page uses so React Query dedupes the request when both pages mount.
  const { data: cohorts } = useQuery<CohortSummary[]>({
    queryKey: ['cohorts'],
    queryFn:  fetchCohorts,
  })
  const featured = (cohorts ?? []).slice(0, 3).map(toFeatured)
  // Pricing teaser at the bottom mirrors whatever the first cohort costs so
  // the headline number is never a stale hand-typed string.
  const teaserPrice       = cohorts?.[0]?.price
  const teaserInstallment = cohorts?.[0]?.installmentPrice
  const teaserCount       = cohorts?.[0]?.installmentCount ?? 3

  const ctaPrimary =
    'inline-flex items-center justify-center rounded-[var(--radius-pill)] ' +
    'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)] ' +
    'font-bold transition-transform duration-150 ease-out ' +
    'hover:bg-[var(--color-wise-primary-hover)] hover:scale-[1.02] active:scale-[0.98] ' +
    'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2'

  const ctaOutline =
    'inline-flex items-center justify-center rounded-[var(--radius-pill)] ' +
    'bg-transparent text-[var(--color-wise-text)] ring-1 ring-[var(--color-wise-ring-strong)] ' +
    'font-bold transition-transform duration-150 ease-out ' +
    'hover:bg-[var(--color-wise-mint)] hover:scale-[1.02] active:scale-[0.98] ' +
    'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2'

  return (
    <div className="min-h-screen bg-[var(--color-wise-canvas)] text-[var(--color-wise-text)] font-sans">
      <TopNav />

      <main id="main-content" tabIndex={-1} className="focus:outline-none">

      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section
        className={cn(
          'bg-[var(--color-wise-surface)]',
          'px-6 sm:px-12 lg:px-20 py-16 sm:py-20 lg:py-24',
          'flex flex-col lg:flex-row items-center gap-12 lg:gap-16',
          'min-h-[560px]',
        )}
      >
        {/* Left — copy */}
        <div className="lg:flex-[0_0_55%] w-full">
          <div
            className={cn(
              'mb-7 inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-4 py-1.5',
              'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
              'text-[13px] font-semibold',
            )}
          >
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full bg-[var(--color-wise-primary-text)]"
            />
            AI Education Platform
          </div>

          <h1
            className={cn(
              'mb-7 font-black tracking-[-1px] leading-[0.9]',
              'text-5xl sm:text-6xl md:text-7xl lg:text-[88px]',
              'text-[var(--color-wise-text)]',
            )}
          >
            Build AI<br />
            Products.<br />
            <span className="text-[var(--color-wise-primary-text)]">Ship Real</span>
            <br />
            Projects.
          </h1>

          <p className="mb-10 max-w-[480px] text-[20px] leading-[1.55] text-[var(--color-wise-text-warm)]">
            Learn to build, deploy, and scale AI-powered products through
            hands-on cohorts and recorded courses.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
            <Link to="/courses" className={cn(ctaPrimary, 'px-8 py-4 text-[17px]')}>
              Browse Courses
            </Link>
            <Link to="#how-it-works" className={cn(ctaOutline, 'px-8 py-4 text-[17px]')}>
              See How It Works
            </Link>
          </div>
        </div>

        {/* Right — illustration (hidden on small viewports) */}
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <div
            className={cn(
              'relative overflow-hidden w-full h-[460px]',
              'rounded-[var(--radius-xl)]',
              'bg-gradient-to-br from-[var(--color-wise-primary)] via-[var(--color-wise-mint)] to-[var(--color-wise-primary-hover)]',
              'shadow-[var(--shadow-ring)]',
            )}
            aria-hidden="true"
          >
            {/* Hero illustration cards. Now mirror whichever cohorts the API
                returns so the marketing visual never lies about what we sell. */}
            {(cohorts ?? []).slice(0, 3).map((c, i) => {
              const type = (c.type ?? 'recorded').toLowerCase()
              const positions = [
                'top-10 left-[30px] w-[200px]',
                'top-[120px] right-5 w-[180px]',
                'bottom-[60px] left-[50px] w-[220px]',
              ]
              const badgeBgs = [
                'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
                'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text)]',
              ]
              return (
                <div
                  key={c.id}
                  className={cn(
                    'absolute',
                    positions[i] ?? positions[0],
                    'rounded-[var(--radius-sm)] bg-white px-5 py-4',
                    'shadow-[var(--shadow-ring)]',
                  )}
                >
                  <div
                    className={cn(
                      'mb-2 inline-block rounded-[var(--radius-pill)] px-2.5 py-0.5',
                      'text-[11px] font-semibold',
                      badgeBgs[i] ?? badgeBgs[0],
                    )}
                  >
                    {BADGE_LABELS[type] ?? 'Course'}
                  </div>
                  <div className="mb-1 text-[13px] font-bold text-[var(--color-wise-text)]">
                    {c.title}
                  </div>
                  <div className="text-[11px] text-[var(--color-wise-text-muted)]">
                    {c.meta || (type === 'recorded' ? 'Self-paced' : '')}
                  </div>
                </div>
              )
            })}

            {/* Floating stat. Live seat count across all cohorts so we don't
                advertise a hardcoded "500+ students" number that nobody can verify. */}
            <div
              className={cn(
                'absolute bottom-[30px] right-5',
                'rounded-xl px-4 py-2.5',
                'bg-[var(--color-wise-dark)] text-white',
                'text-xs font-bold',
              )}
            >
              <span className="block text-xl font-black text-[var(--color-wise-primary)]">
                {(cohorts ?? [])
                  .reduce((sum, c) => sum + (c.soldOut ? 0 : 1), 0)}
              </span>
              {(cohorts?.length ?? 0) === 1 ? 'cohort open' : 'cohorts open'}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SOCIAL PROOF — Companies + universities our students come from      */}
      {/* ------------------------------------------------------------------ */}
      <section
        className={cn(
          'bg-[var(--color-wise-surface)] px-6 sm:px-12 lg:px-20 py-12 lg:py-16',
          'border-y border-[var(--color-wise-surface-soft)]',
        )}
      >
        <p
          className={cn(
            'text-center text-xs font-semibold uppercase tracking-[0.2em]',
            'text-[var(--color-wise-text-muted)]',
            'mb-8',
          )}
        >
          Our students learn and ship from
        </p>

        {/* Company logos. Iconify simple-icons collection, recolored grey. */}
        <div
          className={cn(
            'flex flex-wrap items-center justify-center',
            'gap-x-10 gap-y-6 lg:gap-x-14',
            'mb-10',
          )}
        >
          {STUDENT_COMPANIES.map((c) => (
            <img
              key={c.slug}
              src={`https://api.iconify.design/simple-icons:${c.slug}.svg?color=%23${ICON_COLOR}`}
              alt={`${c.name} logo`}
              loading="lazy"
              className={cn(
                'h-8 sm:h-9 w-auto',
                'opacity-70 hover:opacity-100',
                'transition-opacity duration-200',
              )}
            />
          ))}
        </div>

        {/* Universities. Google's favicon service at 128px gives us each
            school's official site logo. The slight color variation between
            schools is OK here, the row already feels distinct from the
            companies row above. */}
        <div
          className={cn(
            'flex flex-wrap items-center justify-center',
            'gap-x-10 gap-y-6 lg:gap-x-14',
          )}
        >
          {STUDENT_UNIVERSITIES.map((u) => (
            <div
              key={u.domain}
              className={cn(
                'flex items-center gap-2.5',
                'opacity-70 hover:opacity-100 transition-opacity duration-200',
              )}
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${u.domain}&sz=128`}
                alt={`${u.name} crest`}
                loading="lazy"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <span
                className={cn(
                  'text-sm font-semibold',
                  'text-[var(--color-wise-text-muted)]',
                  'tracking-[0.02em]',
                )}
              >
                {u.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* VALUE PROPS                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-[var(--color-wise-canvas)] px-6 sm:px-12 lg:px-20 py-16 lg:py-24">
        <SectionEyebrow>Why nextaibuilder</SectionEyebrow>
        <h2
          className={cn(
            'mb-14 font-black leading-[0.9] tracking-[-1.5px]',
            'text-3xl sm:text-4xl md:text-5xl text-[var(--color-wise-text)]',
          )}
        >
          Everything you need<br />to ship AI products
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {VALUE_PROPS.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className={cn(
                'rounded-[var(--radius-lg)] bg-[var(--color-wise-surface)] p-9',
                'shadow-[var(--shadow-ring)]',
              )}
            >
              <div
                className={cn(
                  'mb-5 h-14 w-14 rounded-2xl',
                  'flex items-center justify-center',
                  'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                )}
              >
                <Icon className="h-7 w-7" strokeWidth={2.25} aria-hidden="true" />
              </div>
              <div className="mb-2.5 text-[22px] font-bold text-[var(--color-wise-text)]">
                {title}
              </div>
              <div className="text-base leading-[1.6] text-[var(--color-wise-text-muted)]">
                {desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* COURSE TYPES                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-[var(--color-wise-surface)] px-6 sm:px-12 lg:px-20 py-16 lg:py-24">
        <SectionEyebrow>Learning Formats</SectionEyebrow>
        <h2
          className={cn(
            'mb-14 font-black leading-[0.9] tracking-[-1.5px]',
            'text-3xl sm:text-4xl md:text-5xl text-[var(--color-wise-text)]',
          )}
        >
          Three ways to learn,<br />one destination
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COURSE_TYPES.map(({ Icon, badge, badgeTone, name, desc }) => (
            <div
              key={name}
              className={cn(
                'rounded-[var(--radius-lg)] bg-[var(--color-wise-canvas)] p-10',
                'shadow-[var(--shadow-ring)]',
              )}
            >
              <div
                className={cn(
                  'mb-5 h-16 w-16 rounded-2xl',
                  'flex items-center justify-center',
                  'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                )}
              >
                <Icon className="h-8 w-8" strokeWidth={2.25} aria-hidden="true" />
              </div>
              <div
                className={cn(
                  'mb-3 inline-block rounded-[var(--radius-pill)] px-2.5 py-0.5',
                  'text-xs font-semibold',
                  badgeToneClasses[badgeTone],
                )}
              >
                {badge}
              </div>
              <div className="mb-3 text-2xl font-extrabold text-[var(--color-wise-text)]">
                {name}
              </div>
              <div className="mb-5 text-base leading-[1.6] text-[var(--color-wise-text-muted)]">
                {desc}
              </div>
              <Link
                to="/courses"
                className={cn(
                  'inline-flex items-center gap-1 text-[15px] font-semibold',
                  'text-[var(--color-wise-primary-text)] hover:underline',
                  'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2 rounded',
                )}
              >
                Learn more
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FEATURED COURSES                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-[var(--color-wise-canvas)] px-6 sm:px-12 lg:px-20 py-16 lg:py-24">
        <SectionEyebrow>Featured Cohorts</SectionEyebrow>
        <h2
          className={cn(
            'mb-14 font-black leading-[0.9] tracking-[-1.5px]',
            'text-3xl sm:text-4xl md:text-5xl text-[var(--color-wise-text)]',
          )}
        >
          Start learning today
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featured.length === 0 && (
            <div className="md:col-span-3 text-center text-sm text-[var(--color-wise-text-muted)] py-12">
              Loading courses...
            </div>
          )}
          {featured.map((c) => (
            <div
              key={c.title}
              className={cn(
                'overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-wise-surface)]',
                'shadow-[var(--shadow-ring)]',
              )}
            >
              <div className={cn('relative h-[200px]', coverClasses[c.coverTone])}>
                <div className="absolute top-4 left-4">
                  <span
                    className={cn(
                      'rounded-[var(--radius-pill)] px-3 py-1 text-[11px] font-semibold',
                      badgeToneClasses[c.badgeTone],
                    )}
                  >
                    {c.badgeLabel}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-2 text-xl font-bold leading-snug text-[var(--color-wise-text)]">
                  {c.title}
                </div>
                <div className="mb-4 text-sm text-[var(--color-wise-text-muted)]">
                  {c.tagline}
                </div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[22px] font-extrabold text-[var(--color-wise-text)]">
                    {c.price}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--color-wise-primary-text)]">
                    {c.installment}
                  </span>
                </div>
                <div className="mb-5 flex items-center gap-1.5 text-[13px] text-[var(--color-wise-text-muted)]">
                  <Calendar size={14} aria-hidden="true" />
                  {c.meta}
                </div>
                <Link
                  to={`/courses/${c.slug}`}
                  className={cn(
                    ctaPrimary,
                    'block w-full py-3 text-center text-[15px] box-border',
                  )}
                >
                  Enroll Now
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* HOW IT WORKS                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="how-it-works"
        className="bg-[var(--color-wise-surface)] px-6 sm:px-12 lg:px-20 py-16 lg:py-24"
      >
        <SectionEyebrow>Process</SectionEyebrow>
        <h2
          className={cn(
            'mb-14 font-black leading-[0.9] tracking-[-1.5px]',
            'text-3xl sm:text-4xl md:text-5xl text-[var(--color-wise-text)]',
          )}
        >
          Three steps to<br />your first AI product
        </h2>
        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-0">
          {[
            {
              num: 1,
              title: 'Browse Courses',
              desc: 'Explore our catalog of recorded courses and live cohorts. Filter by format, topic, or level.',
            },
            {
              num: 2,
              title: 'Enroll & Pay',
              desc: 'Secure checkout with Stripe or pay in 3 installments. Manual payment options also available.',
            },
            {
              num: 3,
              title: 'Learn & Ship',
              desc: 'Follow the curriculum, set up your AI tools, and ship real projects with instructor support.',
            },
          ].map((step, i) => (
            <div
              key={step.num}
              className="relative flex-1 px-5 text-center"
            >
              {/* Dashed connector — hidden on mobile / last step */}
              {i < 2 && (
                <div
                  aria-hidden="true"
                  className="hidden md:block absolute top-8 left-1/2 -right-1/2 h-[2px] z-0"
                  style={{
                    background:
                      'repeating-linear-gradient(90deg, var(--color-wise-primary-text) 0, var(--color-wise-primary-text) 8px, transparent 8px, transparent 16px)',
                  }}
                />
              )}
              <div
                className={cn(
                  'relative z-10 mx-auto mb-5 h-16 w-16 rounded-[var(--radius-pill)]',
                  'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
                  'flex items-center justify-center',
                  'text-2xl font-black',
                )}
              >
                {step.num}
              </div>
              <div className="mb-2.5 text-[22px] font-bold text-[var(--color-wise-text)]">
                {step.title}
              </div>
              <div className="text-base leading-[1.6] text-[var(--color-wise-text-muted)]">
                {step.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* STATS                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section
        className={cn(
          'bg-[var(--color-wise-dark)] text-white text-center',
          'px-6 sm:px-12 lg:px-20 py-16 lg:py-24',
        )}
      >
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-[1.5px] text-white/50">
          By the numbers
        </p>
        <h2
          className={cn(
            'mb-10 font-black leading-[0.9] tracking-[-1.5px]',
            'text-3xl sm:text-4xl md:text-5xl',
          )}
        >
          Trusted by builders<br />around the world
        </h2>
        <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-10 md:gap-20">
          {[
            { number: '500+', label: 'Students Enrolled' },
            { number: '12', label: 'Active Cohorts' },
            { number: '95%', label: 'Completion Rate' },
          ].map((s) => (
            <div key={s.label}>
              <div
                className={cn(
                  'font-black leading-none tracking-[-2px]',
                  'text-5xl sm:text-6xl md:text-7xl lg:text-[80px]',
                  'text-[var(--color-wise-primary)]',
                )}
              >
                {s.number}
              </div>
              <div className="mt-2 text-lg font-medium text-white/70">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* PRICING CALLOUT                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-[var(--color-wise-canvas)] px-6 sm:px-12 lg:px-20 py-16 lg:py-24">
        <div
          className={cn(
            'rounded-[var(--radius-xl)]',
            'bg-[var(--color-wise-dark)] text-white',
            'flex flex-col md:flex-row items-center gap-10 md:gap-16',
            'p-8 md:p-16',
          )}
        >
          <div className="flex-1">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[1.5px] text-white/50">
              Flexible Pricing
            </p>
            <h2
              className={cn(
                'mb-4 font-black leading-[0.9] tracking-[-1.5px]',
                'text-3xl sm:text-4xl md:text-5xl',
              )}
            >
              Pay your<br />way
            </h2>
            <p className="m-0 text-lg leading-[1.5] text-white/70">
              Choose full payment or spread the cost across 3 installments.
              Manual payment option also available.
            </p>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <div
              className={cn(
                'rounded-[var(--radius-md)] p-7',
                'bg-white/5 ring-1 ring-white/10',
              )}
            >
              <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                Pay in Full
              </div>
              <div className="text-4xl font-black tracking-[-1px]">
                {teaserPrice != null ? `$${teaserPrice.toLocaleString('en-US')}` : 'From $—'}
              </div>
              <div className="mt-1.5 text-sm text-white/60">One-time payment</div>
            </div>
            <div
              className={cn(
                'rounded-[var(--radius-md)] p-7',
                'bg-[var(--color-wise-primary)]/20 ring-1 ring-[var(--color-wise-primary)]',
              )}
            >
              <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                Installment Plan
              </div>
              <div className="text-4xl font-black tracking-[-1px]">
                {teaserInstallment != null ? `$${teaserInstallment.toLocaleString('en-US')}` : '$—'}
                <span className="text-base font-medium">/mo</span>
              </div>
              <div className="mt-1.5 text-sm text-white/60">
                ×{teaserCount} monthly payments
              </div>
              <div className="mt-2 text-sm font-semibold text-[var(--color-wise-primary)]">
                Most popular option
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FAQ                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-[var(--color-wise-surface)] px-6 sm:px-12 lg:px-20 py-16 lg:py-24">
        <div className="text-center">
          <SectionEyebrow>FAQ</SectionEyebrow>
          <h2
            className={cn(
              'mb-14 font-black leading-[0.9] tracking-[-1.5px]',
              'text-3xl sm:text-4xl md:text-5xl text-[var(--color-wise-text)]',
            )}
          >
            Frequently asked<br />questions
          </h2>
        </div>
        <div className="mx-auto max-w-[800px]">
          {FAQ_ITEMS.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER CTA                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section
        className={cn(
          'bg-[var(--color-wise-dark)] text-white text-center',
          'px-6 sm:px-12 lg:px-20 py-16 lg:py-24',
        )}
      >
        <h2
          className={cn(
            'mb-8 font-black leading-[0.9] tracking-[-2px]',
            'text-4xl sm:text-5xl md:text-6xl lg:text-[64px]',
          )}
        >
          Ready to build<br />your first AI product?
        </h2>
        <Link to="/courses" className={cn(ctaPrimary, 'px-10 py-[18px] text-lg')}>
          Get Started Today
        </Link>
        <div className="mt-6 flex justify-center gap-6">
          <Link
            to="/privacy"
            className="text-sm text-white/50 hover:text-white/80 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded"
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            className="text-sm text-white/50 hover:text-white/80 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded"
          >
            Terms of Service
          </Link>
        </div>
      </section>

      </main>

      <Footer />
    </div>
  )
}

const __BUILD_MARKER__ = 'newdesign-v2'
export { __BUILD_MARKER__ }
// build-1776111635
