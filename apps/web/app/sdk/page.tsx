'use client'

import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import {
  Loader2, Building2, User, Linkedin, MapPin, Users, CalendarClock,
  Target, Code2, Layers, Server, GitBranch, Workflow, Rocket, Zap, Percent,
} from 'lucide-react'
import { NextAiBuilderLogo, NextAiBuilderMark } from '@/components/ui/nextaibuilder-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// ── Design tokens (nextaibuilder brand — see BRAND.md) ──────────────────────
// This page carries its own brand skin (distinct from the Product Builder
// Academy design system used elsewhere in the app), so colors are the raw
// brand hex values rather than the shared semantic tokens.
const NAVY = '#1a2744'
const BLUE = '#4a9ad4'
const PALE = '#d4e8f7'
const TINT = '#e8f4fd'
const SPARK = '#ff6347'
const SLATE = '#5b6a85'
// The brand's two signature gradients (see BRAND.md) — used sparingly here:
// navy for the headline/dark panels, spark for the one primary action color.
const NAVY_GRADIENT = 'linear-gradient(135deg, #1a2744 0%, #4a90c4 100%)'
// A subtler, darker gradient for panels that hold body text — the full
// navy→blue sweep above washes out to a light corner that hurts contrast
// against light-colored text, so dark UI stays within the ink/navy range.
const PANEL_GRADIENT = 'linear-gradient(135deg, #0d1a3a 0%, #16243f 55%, #1f3155 100%)'
const SPARK_GRADIENT = 'linear-gradient(135deg, #ff8c5a 0%, #ff6347 55%, #d73027 100%)'

// ── Scroll reveal — sections below the hero were popping in flat with no
// motion at all, which read as static/unfinished once you scroll past the
// hero's own entrance animation. This reuses the same sdk-rise keyframe,
// just triggered by IntersectionObserver instead of firing once on load.

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // Starts visible — motion is a progressive enhancement here, not something
  // content availability should ever depend on. If IntersectionObserver is
  // unsupported, misbehaves, or never fires for any reason, content must
  // never be stuck invisible; worst case it just skips the fade-in.
  const [visible, setVisible] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    // Only start hidden once we know the observer is actually watching —
    // otherwise there's a window where it's hidden with nothing enforcing
    // it ever becomes visible again.
    setVisible(false)
    setReady(true)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)

    // Failsafe: force reveal after 2s regardless of the observer's state,
    // in case it never fires (seen in some headless/automated environments).
    const timeout = setTimeout(() => setVisible(true), 2000)

    return () => {
      observer.disconnect()
      clearTimeout(timeout)
    }
  }, [])

  const motionClass = ready ? (visible ? 'animate-sdk-rise' : 'opacity-0') : ''

  return (
    <div ref={ref} className={`${className ?? ''} ${motionClass}`}>
      {children}
    </div>
  )
}

// ── Announcement bar — a continuous marquee for time-sensitive updates.
// Content duplicated once so the loop is seamless; pauses on hover so it's
// actually readable, and sits still (no animation) under reduced motion.

// Rendered 8x rather than the usual 2x for a seamless marquee loop — with
// only 2 copies, the track is narrower than the viewport on wide monitors
// (2560px+), so the loop visibly runs out mid-cycle. 8 copies of this short
// content comfortably exceeds even 8K-wide displays, so the seam never
// shows regardless of screen size. Keep ANNOUNCEMENT_COPIES and the
// translateX percentage in the keyframe (-100%/N) in sync if this changes.
const ANNOUNCEMENT_COPIES = 8

function AnnouncementBar({ items }: { items: { icon: React.ElementType; text: string }[] }) {
  const track = (
    <>
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-2 px-8">
          <item.icon className="h-3.5 w-3.5 shrink-0" style={{ color: SPARK }} aria-hidden="true" />
          <span className="font-mono text-xs font-semibold tracking-wide" style={{ color: PALE }}>
            {item.text}
          </span>
        </span>
      ))}
    </>
  )

  return (
    <div
      className="announcement-bar overflow-hidden border-b"
      style={{ background: PANEL_GRADIENT, borderColor: 'rgba(212,232,247,0.14)' }}
    >
      <div className="announcement-track flex w-max py-2">
        {Array.from({ length: ANNOUNCEMENT_COPIES }).map((_, i) => (
          <div
            key={i}
            className={`flex shrink-0 ${i > 0 ? 'announcement-track-copy' : ''}`}
            aria-hidden={i > 0}
          >
            {track}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Content ──────────────────────────────────────────────────────────────
// Real, non-fabricated program facts only — no invented seat counts or
// dates until those are finalized.

const WHY_IN_PERSON = [
  {
    icon: MapPin,
    title: 'On-site in Sadiqabad',
    description: 'Hands-on agent-building sessions led by instructors in our studio, not a recording.',
  },
  {
    icon: Users,
    title: 'Built around a cohort',
    description: 'A fixed start date, building alongside the same small group for the length of your track.',
  },
  {
    icon: Target,
    title: 'Small by design',
    description: 'Limited seats so every applicant gets real instructor time, not a lecture hall.',
  },
]

const MANIFEST = [
  { key: 'agent.deployed', desc: 'a real AI agent, live and doing real work' },
  { key: 'code.reviewed', desc: 'direct feedback from instructors, in the room' },
  { key: 'tools.mastered', desc: 'Claude API, tool use, multi-step agent design' },
  { key: 'certificate.pdf', desc: 'proof of what you built, not just attended' },
]

// Two durations, same core program — kept honest and generic (pace/depth
// only) since curriculum specifics for each track aren't finalized yet.
const TRACKS = [
  {
    id: '6-month' as const,
    icon: Zap,
    name: '6-Month Track',
    tag: 'Accelerated',
    description: 'The full program on a tighter timeline, for builders who want to move fast and go all-in.',
  },
  {
    id: '1-year' as const,
    icon: Layers,
    name: '1-Year Track',
    tag: 'Comprehensive',
    description: 'The same core program with more time in the room, and more depth on every project you ship.',
  },
]

// Same monthly fee on both tracks — it's priced per month, not per program
// length. Update both here and in the FAQ/structured data together if this
// changes; they're kept in sync by hand, not computed from one source.
const PRICING = {
  currency: 'PKR',
  regularPerMonth: 15000,
  discountedPerMonth: 12000,
  discountNote: 'First 10 students · 20% off',
}

const PROCESS = [
  { n: '01', title: 'Apply', desc: 'Tell us about you and what you want to build.' },
  { n: '02', title: 'Review', desc: 'We read every application and follow up directly.' },
  { n: '03', title: 'Admit', desc: 'Accepted builders get cohort dates and setup details.' },
]

// Time-sensitive announcements — real dates/offers only, update or remove
// these once they pass rather than leaving a stale deadline up.
const ANNOUNCEMENTS = [
  { icon: CalendarClock, text: 'Admissions close August 28, 2026' },
  { icon: Percent, text: '20% off tuition for the first 10 students. Apply now' },
]

// Real answers to real questions, in the same phrasing people actually
// search with. This is also the most useful format for AI answer engines
// (Perplexity, AI Overviews, etc), which tend to lift directly from
// clearly-stated Q&A content — so it's doing double duty, not just SEO.
const FAQ = [
  {
    q: 'What is an Agentic AI Engineer?',
    a: 'Someone who designs and deploys AI agents, systems that can use tools, take multi-step actions, and complete tasks on their own rather than just responding to a single prompt.',
  },
  {
    q: 'Do I need to know Python before applying?',
    a: 'No. Python is the first step of the program itself, rebuilt specifically for AI work. You need a willingness to learn, not prior experience.',
  },
  {
    q: 'What is the difference between the 6-month and 1-year track?',
    a: 'Both cover the same six steps in the same order: Python, LangChain fundamentals, LangChain in production, LangGraph, n8n, and a capstone. The 1-year track spreads each step across two months instead of one, for more depth per stage.',
  },
  {
    q: 'Is this course online or in-person?',
    a: 'In-person only, at the studio in Sadiqabad, Punjab. There is no recorded or remote-only option.',
  },
  {
    q: 'What will I build by the end of the program?',
    a: 'One real, deployed AI agent, applying everything from the earlier steps, reviewed live by instructors as the program capstone.',
  },
  {
    q: 'How much does the program cost?',
    a: 'PKR 15,000 per month on both tracks. The first 10 students get 20% off, PKR 12,000 per month.',
  },
  {
    q: 'How do I apply?',
    a: 'Submit the admission form on this page with your track choice. Applications are reviewed on a rolling basis and the admissions team follows up directly by email or phone.',
  },
]

// The 6-month track's month-by-month curriculum — the 1-year track covers
// the same progression at a slower pace with more project depth per stage,
// rather than different material. Order is real and load-bearing here
// (LangChain before LangGraph before n8n), so numbering the months is
// showing information, not decorating a list.
const SYLLABUS = [
  {
    n: '01',
    icon: Code2,
    title: 'Python for AI Engineers',
    desc: 'Python fundamentals rebuilt for AI work: environments, APIs, async code, and calling LLMs directly. Everything after this month runs on it.',
  },
  {
    n: '02',
    icon: Layers,
    title: 'LangChain: Fundamentals',
    desc: 'Prompts, chains, memory, and retrieval-augmented generation (RAG): the building blocks most agent frameworks sit on top of.',
  },
  {
    n: '03',
    icon: Server,
    title: 'LangChain: In Production',
    desc: 'Tool calling, structured output, vector stores, and evaluation. Moving a chain from a notebook demo to something that holds up under real use.',
  },
  {
    n: '04',
    icon: GitBranch,
    title: 'LangGraph',
    desc: 'Stateful, multi-step agents: graphs, cycles, human-in-the-loop, and multi-agent coordination. For work a single prompt-response chain can’t handle.',
  },
  {
    n: '05',
    icon: Workflow,
    title: 'n8n',
    desc: 'Wiring agents into the rest of the world: workflow automation, webhooks, and connecting your agent to real tools without hand-writing glue code for every integration.',
  },
  {
    n: '06',
    icon: Rocket,
    title: 'Capstone: Ship Your Agent',
    desc: 'Everything from the steps before this one, applied to one real, deployed AI agent, reviewed live by instructors in the room.',
  },
]

// Same six steps on both tracks — the 1-year track just spreads each one
// across two months instead of one, rather than covering different material.
function syllabusMonthLabel(stepIndex: number, trackId: TrackId): string {
  if (trackId === '6-month') return `Month ${stepIndex + 1}`
  const start = stepIndex * 2 + 1
  return `Months ${start}–${start + 1}`
}

// This is the first-ever run of the in-person Sadiqabad cohort — there are
// no real alumni, companies, or reviews yet. These sections are built and
// wired up now (structure, spacing, social-link slots) but deliberately
// rendered as obvious placeholders — dashed borders, "awaiting cohort 1"
// labels — rather than invented names/photos/quotes standing in as if
// real. Swap COMPANY_SLOTS / REVIEW_SLOTS for real data once it exists;
// nothing else on the page needs to change.
const COMPANY_SLOTS = 6
const REVIEW_SLOTS = 3

// ── Signature element: a terminal-styled cohort status panel ───────────────
// Echoes the audience (builders who live in a terminal) and the logo's
// pixel-grid language, without fabricating specifics like seat counts.

const TERMINAL_LINES = [
  { k: 'program', v: 'Agentic AI Engineer' },
  { k: 'tracks', v: '6-month · 1-year' },
  { k: 'location', v: 'Sadiqabad, Punjab, PK · PKT (UTC+5)' },
  { k: 'format', v: 'in-person · on-site studio' },
  { k: 'stack', v: 'Claude API · tool use · agent design' },
  { k: 'outcome', v: 'one deployed agent, reviewed live' },
]

function TerminalPanel() {
  return (
    <div className="relative">
      {/* Ambient glow — a soft blurred echo of the logo's spark core sitting
          behind the panel, so the "signal" the terminal reports on feels lit. */}
      <div
        className="absolute -inset-6 -z-10 rounded-[2rem] opacity-60 blur-2xl"
        style={{ background: 'radial-gradient(circle at 30% 20%, rgba(255,99,71,0.35), transparent 60%), radial-gradient(circle at 80% 80%, rgba(74,154,212,0.35), transparent 60%)' }}
        aria-hidden="true"
      />
      <div
        className="relative rounded-2xl border overflow-hidden shadow-[0_32px_70px_-24px_rgba(13,26,58,0.6)]"
        style={{ background: PANEL_GRADIENT, borderColor: 'rgba(212,232,247,0.18)' }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: 'rgba(212,232,247,0.12)', backgroundColor: 'rgba(13,26,58,0.35)' }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#ff6347' }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#ff8c5a' }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PALE }} />
          <span className="ml-2 font-mono text-[11px] tracking-wide" style={{ color: 'rgba(212,232,247,0.5)' }}>
            cohort-status.sh
          </span>
        </div>
        <div className="px-5 py-5 font-mono text-[13px] leading-relaxed sm:text-sm">
        <p
          className="animate-sdk-rise"
          style={{ color: PALE }}
        >
          <span style={{ color: BLUE }}>$</span> nextaibuilder --cohort next
        </p>
        {TERMINAL_LINES.map((line, i) => (
          <p
            key={line.k}
            className="mt-1.5 animate-sdk-rise"
            style={{ animationDelay: `${(i + 1) * 110}ms` }}
          >
            <span style={{ color: 'rgba(212,232,247,0.45)' }}>{'  '}{line.k.padEnd(9, ' ')}</span>
            <span style={{ color: '#ffffff' }}>{line.v}</span>
          </p>
        ))}
        <p
          className="mt-1.5 animate-sdk-rise"
          style={{ animationDelay: `${(TERMINAL_LINES.length + 1) * 110}ms` }}
        >
          <span style={{ color: 'rgba(212,232,247,0.45)' }}>{'  '}{'status'.padEnd(9, ' ')}</span>
          <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: SPARK }}>
            <span
              className="h-1.5 w-1.5 rounded-full motion-safe:animate-pulse"
              style={{ backgroundColor: SPARK }}
            />
            ADMITTING
          </span>
        </p>
        </div>
      </div>
    </div>
  )
}

// ── Pixel-corner card accent — echoes the logo's corner-square mark ────────

function PixelCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div
      className="group relative rounded-xl border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{ borderColor: TINT }}
    >
      <span
        className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: SPARK_GRADIENT }}
      />
      <span className="absolute left-0 top-0 h-2.5 w-2.5" style={{ backgroundColor: BLUE }} />
      <span className="absolute right-0 bottom-0 h-2.5 w-2.5" style={{ backgroundColor: SPARK }} />
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: TINT }}
      >
        <Icon className="h-5 w-5" style={{ color: BLUE }} aria-hidden="true" />
      </div>
      <div className="mt-3 font-bold" style={{ color: NAVY }}>{title}</div>
      <p className="mt-2 text-sm" style={{ color: SLATE }}>{description}</p>
    </div>
  )
}

// ── Track card — the two program durations ──────────────────────────────

function TrackCard({
  icon: Icon,
  name,
  tag,
  description,
}: {
  icon: React.ElementType
  name: string
  tag: string
  description: string
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-white p-6"
      style={{ borderColor: TINT }}
    >
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: SPARK_GRADIENT }}
      />
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide"
          style={{ backgroundColor: TINT, color: BLUE }}
        >
          {tag}
        </span>
        <Icon className="h-5 w-5" style={{ color: SPARK }} aria-hidden="true" />
      </div>
      <div className="mt-3 text-xl font-black" style={{ color: NAVY }}>{name}</div>
      <p className="mt-2 text-sm" style={{ color: SLATE }}>{description}</p>

      <div className="mt-4 flex items-end gap-2">
        <span className="text-3xl font-black tracking-tight" style={{ color: NAVY }}>
          {PRICING.currency} {PRICING.discountedPerMonth.toLocaleString()}
        </span>
        <span className="pb-1 text-sm font-semibold" style={{ color: SLATE }}>/mo</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="text-sm line-through" style={{ color: SLATE, opacity: 0.55 }}>
          {PRICING.currency} {PRICING.regularPerMonth.toLocaleString()}/mo
        </span>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-white"
          style={{ background: SPARK_GRADIENT }}
        >
          {PRICING.discountNote}
        </span>
      </div>

      <a href="#apply" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: BLUE }}>
        Apply for this track →
      </a>
    </div>
  )
}

// ── Syllabus timeline — order is real information, so it's numbered ────────

function SyllabusItem({
  icon: Icon,
  title,
  desc,
  monthLabel,
  isLast,
}: {
  icon: React.ElementType
  title: string
  desc: string
  monthLabel: string
  isLast: boolean
}) {
  return (
    <div className="relative flex gap-5 pb-10 last:pb-0">
      {!isLast && (
        <span
          className="absolute left-[19px] top-10 bottom-0 w-px"
          style={{ backgroundColor: TINT }}
          aria-hidden="true"
        />
      )}
      <span
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2"
        style={{ borderColor: BLUE, backgroundColor: '#ffffff' }}
      >
        <Icon className="h-4 w-4" style={{ color: BLUE }} aria-hidden="true" />
      </span>
      <div className="pt-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <div className="font-bold" style={{ color: NAVY }}>{title}</div>
          <span className="font-mono text-xs font-semibold" style={{ color: BLUE }}>{monthLabel}</span>
        </div>
        <p className="mt-1.5 max-w-xl text-sm" style={{ color: SLATE }}>{desc}</p>
      </div>
    </div>
  )
}

// ── FAQ item — plain Q&A, no accordion. Simple, crawlable, no JS needed to read it. ──

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-b py-5 last:border-0" style={{ borderColor: TINT }}>
      <h3 className="font-bold" style={{ color: NAVY }}>{q}</h3>
      <p className="mt-2 text-sm" style={{ color: SLATE }}>{a}</p>
    </div>
  )
}

// ── Placeholder social-proof slots ──────────────────────────────────────
// Deliberately unmistakable as placeholders (dashed borders, muted icons,
// "cohort 1" labels) — see the note above COMPANY_SLOTS/REVIEW_SLOTS.

function CompanyLogoSlot() {
  return (
    <div
      className="flex h-16 items-center justify-center gap-2 rounded-lg border border-dashed px-4"
      style={{ borderColor: PALE, color: SLATE }}
    >
      <Building2 className="h-4 w-4 opacity-50" aria-hidden="true" />
      <span className="font-mono text-xs opacity-60">company</span>
    </div>
  )
}

function ReviewSlot({ index }: { index: number }) {
  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-dashed p-6"
      style={{ borderColor: PALE }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed"
          style={{ borderColor: PALE, color: SLATE }}
        >
          <User className="h-5 w-5 opacity-50" aria-hidden="true" />
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: SLATE }}>Student name</div>
          <div className="font-mono text-xs opacity-60" style={{ color: SLATE }}>role · company</div>
        </div>
        <Linkedin className="ml-auto h-4 w-4 opacity-30" style={{ color: SLATE }} aria-hidden="true" />
      </div>
      <p className="font-mono text-xs leading-relaxed opacity-60" style={{ color: SLATE }}>
        &ldquo;Review #{index + 1}, reserved for cohort 1&rdquo;
      </p>
    </div>
  )
}

// ── Admission form ───────────────────────────────────────────────────────

type TrackId = typeof TRACKS[number]['id']

interface FormState {
  fullName: string
  email: string
  phone: string
  track: TrackId | ''
  message: string
}

const EMPTY_FORM: FormState = { fullName: '', email: '', phone: '', track: '', message: '' }

const fieldStyle = {
  backgroundColor: 'rgba(212,232,247,0.06)',
  borderColor: 'rgba(212,232,247,0.18)',
  color: '#ffffff',
} as React.CSSProperties

// Fires the Google Ads conversion event on a successful application.
// No-ops safely if gtag hasn't loaded (NEXT_PUBLIC_GOOGLE_ADS_ID unset —
// see layout.tsx) or the conversion label isn't configured yet, so this is
// safe to call unconditionally without breaking the page for anyone.
function trackApplicationConversion() {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL
  if (!adsId || !label) return
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
  gtag?.('event', 'conversion', { send_to: `${adsId}/${label}` })
}

function AdmissionForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.track) {
      setStatus('error')
      setErrorMessage('Select a track before submitting.')
      return
    }

    setStatus('submitting')
    setErrorMessage(null)

    try {
      // Relative path so this works from whichever host served the page
      // (sdk.nextaibuilder.com in prod) without any cross-origin/CORS setup.
      const res = await fetch('/api/v1/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          track: form.track,
          message: form.message || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message ?? 'Something went wrong. Please try again.')
      }

      setStatus('success')
      setForm(EMPTY_FORM)
      trackApplicationConversion()
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full font-mono text-lg font-bold"
          style={{ backgroundColor: 'rgba(255,99,71,0.16)', color: SPARK }}
        >
          &#10003;
        </span>
        <h3 className="text-lg font-bold text-white">Application received</h3>
        <p className="max-w-sm text-sm" style={{ color: 'rgba(212,232,247,0.75)' }}>
          Thanks for applying. Our admissions team will reach out to the email or phone number you provided.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="font-mono text-xs tracking-wide" style={{ color: PALE }}>
          track
        </Label>
        <div role="radiogroup" aria-label="Track" className="grid grid-cols-2 gap-2">
          {TRACKS.map((track) => {
            const selected = form.track === track.id
            return (
              <button
                key={track.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setForm((f) => ({ ...f, track: track.id }))}
                className="rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors"
                style={
                  selected
                    ? { background: SPARK_GRADIENT, borderColor: 'transparent', color: '#ffffff' }
                    : { ...fieldStyle, color: 'rgba(212,232,247,0.85)' }
                }
              >
                {track.name}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName" className="font-mono text-xs tracking-wide" style={{ color: PALE }}>
          full_name
        </Label>
        <Input
          id="fullName"
          required
          maxLength={200}
          value={form.fullName}
          onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          placeholder="Jane Doe"
          className="placeholder:text-white/30 focus-visible:ring-[#4a9ad4]/50 focus-visible:border-[#4a9ad4]"
          style={fieldStyle}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="font-mono text-xs tracking-wide" style={{ color: PALE }}>
          email
        </Label>
        <Input
          id="email"
          type="email"
          required
          maxLength={320}
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="jane@example.com"
          className="placeholder:text-white/30 focus-visible:ring-[#4a9ad4]/50 focus-visible:border-[#4a9ad4]"
          style={fieldStyle}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone" className="font-mono text-xs tracking-wide" style={{ color: PALE }}>
          phone
        </Label>
        <Input
          id="phone"
          type="tel"
          required
          maxLength={40}
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="+1 555 123 4567"
          className="placeholder:text-white/30 focus-visible:ring-[#4a9ad4]/50 focus-visible:border-[#4a9ad4]"
          style={fieldStyle}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message" className="font-mono text-xs tracking-wide" style={{ color: PALE }}>
          message <span style={{ color: 'rgba(212,232,247,0.4)' }}>(optional)</span>
        </Label>
        <Textarea
          id="message"
          maxLength={5000}
          rows={4}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder="Background, availability, questions..."
          className="placeholder:text-white/30 focus-visible:ring-[#4a9ad4]/50 focus-visible:border-[#4a9ad4]"
          style={fieldStyle}
        />
      </div>

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-sm" style={{ color: '#ff8c8c' }}>{errorMessage}</p>
      )}

      <Button
        type="submit"
        disabled={status === 'submitting'}
        className="mt-2 font-semibold border-0 shadow-[0_8px_24px_-8px_rgba(255,99,71,0.6)]"
        style={{ background: SPARK_GRADIENT, color: '#ffffff' }}
      >
        {status === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {status === 'submitting' ? 'Submitting…' : 'Submit application'}
      </Button>
    </form>
  )
}

// ── WhatsApp contact — floating button, fixed regardless of scroll ─────────
// No WhatsApp glyph in lucide-react (it's a generic icon set, not brand
// logos), so this is a small inline SVG rather than pulling in a new
// icon package for one icon.

const WHATSAPP_NUMBER = '923456655181' // +92 345 6655181 — no "+" in the wa.me link

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.36a9.85 9.85 0 0 0 4.62 1.14h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.19 0 4.24.85 5.79 2.4a8.14 8.14 0 0 1 2.4 5.8c0 4.53-3.68 8.21-8.21 8.21a8.2 8.2 0 0 1-4.15-1.12l-.3-.17-3.21.8.81-3.13-.19-.32a8.16 8.16 0 0 1-1.25-4.35c0-4.53 3.69-8.12 8.31-8.12Zm-4.5 4.3c-.15 0-.4.06-.61.3-.21.24-.8.78-.8 1.9s.82 2.21.94 2.36c.11.15 1.6 2.55 3.95 3.47 1.95.77 2.35.61 2.77.58.43-.04 1.39-.57 1.58-1.11.2-.55.2-1.03.14-1.12-.06-.1-.21-.16-.44-.27-.23-.12-1.39-.68-1.61-.77-.21-.08-.37-.11-.53.12-.15.23-.6.76-.74.92-.14.15-.27.17-.5.06-.23-.12-.98-.36-1.86-1.15-.69-.61-1.15-1.37-1.29-1.6-.13-.23-.01-.36.11-.47.11-.11.23-.28.35-.42.11-.14.15-.24.23-.4.08-.15.04-.29-.02-.4-.06-.12-.53-1.31-.74-1.79-.19-.46-.39-.4-.53-.4Z" />
    </svg>
  )
}

function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_12px_30px_-8px_rgba(37,211,102,0.65)] transition-transform duration-200 hover:scale-110"
      style={{ backgroundColor: '#25D366' }}
    >
      <WhatsAppIcon className="h-7 w-7 text-white" />
    </a>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function SdkLandingPage() {
  const [syllabusTrack, setSyllabusTrack] = useState<TrackId>('6-month')

  return (
    <div className="sdk-page min-h-screen bg-white font-sans">
      <style>{`
        @keyframes sdk-rise {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sdk-page .animate-sdk-rise { animation: sdk-rise 0.45s ease-out both; }
        .sdk-page .font-mono { font-family: var(--font-mono), ui-monospace, monospace; }
        @keyframes sdk-marquee {
          /* -12.5% = -100% / ANNOUNCEMENT_COPIES (8) — advances by exactly
             one copy's width, so the loop seam lands on identical content
             regardless of how many copies are rendered. */
          from { transform: translateX(0); }
          to   { transform: translateX(-12.5%); }
        }
        .sdk-page .announcement-track { animation: sdk-marquee 22s linear infinite; }
        .sdk-page .announcement-bar:hover .announcement-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .sdk-page .animate-sdk-rise { animation: none; opacity: 1; transform: none; }
          .sdk-page .announcement-track { animation: none; width: 100%; justify-content: center; flex-wrap: wrap; }
          .sdk-page .announcement-track-copy { display: none; }
        }
      `}</style>

      {/* ── Nav ── */}
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur-sm" style={{ borderColor: TINT }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <NextAiBuilderLogo size={32} />
          <a href="#apply">
            <Button
              className="h-10 border-0 px-5 text-[15px] font-semibold shadow-[0_6px_18px_-6px_rgba(255,99,71,0.55)] transition-transform duration-200 hover:scale-105"
              style={{ background: SPARK_GRADIENT, color: '#ffffff' }}
            >
              Enroll Now
            </Button>
          </a>
        </div>
      </header>

      <AnnouncementBar items={ANNOUNCEMENTS} />

      {/* ── Hero ── */}
      <main>
        <section className="relative overflow-hidden">
          {/* Ambient background: a soft navy/blue wash plus a faint pixel-dot
              field, echoing the logo's own grid language without repeating
              the mark itself. */}
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(60% 50% at 82% 12%, rgba(74,154,212,0.16), transparent 65%), radial-gradient(45% 40% at 8% 90%, rgba(255,140,90,0.10), transparent 65%)',
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
            style={{
              backgroundImage: 'radial-gradient(rgba(74,154,212,0.35) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              maskImage: 'radial-gradient(60% 60% at 75% 20%, black, transparent)',
              WebkitMaskImage: 'radial-gradient(60% 60% at 75% 20%, black, transparent)',
            }}
            aria-hidden="true"
          />

          <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-20">
            <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-start">
              <div>
                <span
                  className="animate-sdk-rise inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold tracking-wide"
                  style={{ backgroundColor: TINT, color: BLUE, animationDelay: '0ms' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full motion-safe:animate-pulse" style={{ backgroundColor: SPARK }} />
                  AGENTIC AI ENGINEER · SADIQABAD, PUNJAB
                </span>
                <h1
                  className="animate-sdk-rise mt-5 text-[3rem] font-black leading-[1.02] tracking-tight sm:text-7xl"
                  style={{ animationDelay: '80ms' }}
                >
                  <span
                    style={{
                      background: NAVY_GRADIENT,
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                    } as React.CSSProperties}
                  >
                    Become an
                  </span>
                  <br />
                  <span style={{ color: BLUE }}>Agentic AI Engineer.</span>
                </h1>
              <p
                className="animate-sdk-rise mt-6 max-w-md text-lg"
                style={{ color: SLATE, animationDelay: '160ms' }}
              >
                A hands-on, in-person program for builders who want real instructor feedback while
                designing and deploying AI agents, not another video course. Choose a 6-month or
                1-year track.
              </p>
              <div
                className="animate-sdk-rise mt-8 flex flex-wrap items-center gap-3"
                style={{ animationDelay: '240ms' }}
              >
                <a href="#apply">
                  <Button
                    size="lg"
                    className="font-semibold border-0 shadow-[0_10px_30px_-8px_rgba(255,99,71,0.55)] transition-transform duration-200 hover:scale-[1.03]"
                    style={{ background: SPARK_GRADIENT, color: '#ffffff' }}
                  >
                    Apply for admission
                  </Button>
                </a>
                <a href="#how-it-works">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-2 transition-colors hover:bg-[#e8f4fd]"
                    style={{ borderColor: BLUE, color: NAVY }}
                  >
                    See how it works
                  </Button>
                </a>
              </div>

              <div
                className="animate-sdk-rise mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-6 font-mono text-xs"
                style={{ color: SLATE, borderColor: TINT, animationDelay: '300ms' }}
              >
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" style={{ color: BLUE }} aria-hidden="true" />
                  Sadiqabad, Punjab
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" style={{ color: BLUE }} aria-hidden="true" />
                  Small cohort
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" style={{ color: BLUE }} aria-hidden="true" />
                  6 or 12 months
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="relative pb-8 pr-8 sm:pb-10 sm:pr-10">
                <div className="relative overflow-hidden rounded-2xl shadow-[0_24px_60px_-24px_rgba(13,26,58,0.5)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/photos/studio-session.jpg"
                    alt="An instructor leading a session at the nextaibuilder studio in Sadiqabad"
                    className="aspect-[4/3] w-full object-cover"
                    width={1440}
                    height={1078}
                  />
                  <span
                    className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold text-white"
                    style={{ backgroundColor: 'rgba(13,26,58,0.65)', backdropFilter: 'blur(4px)' }}
                  >
                    Live session · Sadiqabad studio
                  </span>
                </div>
                {/* Detail shot — overlaps the main photo's corner for an
                    editorial, two-photo composition instead of one flat image. */}
                <div
                  className="absolute -bottom-2 -right-2 w-[42%] overflow-hidden rounded-xl border-4 shadow-[0_16px_40px_-12px_rgba(13,26,58,0.55)] sm:-bottom-3 sm:-right-3"
                  style={{ borderColor: '#ffffff' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/photos/studio-session-2.jpg"
                    alt="Cohort seated during a full-room session at the Sadiqabad studio"
                    className="aspect-[4/3] w-full object-cover"
                    width={1024}
                    height={768}
                  />
                </div>
              </div>
              <TerminalPanel />
            </div>
            </div>
          </div>
        </section>

        {/* ── Choose your track ── */}
        <section id="tracks" className="border-t" style={{ borderColor: TINT, backgroundColor: '#fafcfe' }}>
          <Reveal className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="font-mono text-xs font-semibold tracking-widest" style={{ color: BLUE }}>
              CHOOSE YOUR TRACK
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {TRACKS.map((track) => (
                <TrackCard key={track.id} icon={track.icon} name={track.name} tag={track.tag} description={track.description} />
              ))}
            </div>
            <a
              href="#syllabus"
              className="mt-6 inline-flex items-center gap-1 font-mono text-sm font-semibold"
              style={{ color: BLUE }}
            >
              See the full syllabus ↓
            </a>
          </Reveal>
        </section>

        {/* ── Syllabus ── */}
        <section id="syllabus" className="border-t" style={{ borderColor: TINT }}>
          <Reveal className="mx-auto max-w-6xl px-6 py-16">
            <p className="font-mono text-xs font-semibold tracking-widest" style={{ color: BLUE }}>
              SYLLABUS
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black" style={{ color: NAVY }}>What you&apos;ll learn</h2>
                <p className="mt-2 max-w-xl text-sm" style={{ color: SLATE }}>
                  Same six steps on both tracks. The 1-year track spreads each one across two
                  months instead of one, for more depth per stage.
                </p>
              </div>
              <div role="radiogroup" aria-label="Syllabus track" className="inline-flex gap-1 rounded-lg p-1" style={{ backgroundColor: TINT }}>
                {TRACKS.map((track) => {
                  const selected = syllabusTrack === track.id
                  return (
                    <button
                      key={track.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSyllabusTrack(track.id)}
                      className="rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-colors"
                      style={selected ? { backgroundColor: '#ffffff', color: NAVY, boxShadow: '0 1px 2px rgba(13,26,58,0.08)' } : { color: BLUE }}
                    >
                      {track.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="mt-10">
              {SYLLABUS.map((item, i) => (
                <SyllabusItem
                  key={item.n}
                  icon={item.icon}
                  title={item.title}
                  desc={item.desc}
                  monthLabel={syllabusMonthLabel(i, syllabusTrack)}
                  isLast={i === SYLLABUS.length - 1}
                />
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── Companies (placeholder — see COMPANY_SLOTS note) ── */}
        <section className="border-t" style={{ borderColor: TINT }}>
          <Reveal className="mx-auto max-w-6xl px-6 py-12">
            <h2 className="text-center font-mono text-xs font-semibold tracking-widest" style={{ color: SLATE, opacity: 0.7 }}>
              WHERE OUR BUILDERS COME FROM · AWAITING COHORT 1
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: COMPANY_SLOTS }).map((_, i) => (
                <CompanyLogoSlot key={i} />
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── Why in-person ── */}
        <section className="border-t" style={{ borderColor: TINT, backgroundColor: '#fafcfe' }}>
          <Reveal className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="font-mono text-xs font-semibold tracking-widest" style={{ color: BLUE }}>
              WHY IN-PERSON
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {WHY_IN_PERSON.map((item) => (
                <PixelCard key={item.title} icon={item.icon} title={item.title} description={item.description} />
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── What you'll leave with (manifest) ── */}
        <section className="border-t" style={{ borderColor: TINT }}>
          <Reveal className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="font-mono text-xs font-semibold tracking-widest" style={{ color: BLUE }}>
              WHAT YOU&apos;LL LEAVE WITH
            </h2>
            <div
              className="mt-6 max-w-2xl rounded-xl border p-6 font-mono text-sm leading-loose sm:text-[15px]"
              style={{ borderColor: TINT, backgroundColor: '#fafcfe' }}
            >
              <p style={{ color: NAVY }}>./your-cohort/</p>
              {MANIFEST.map((item, i) => (
                <p key={item.key} className="pl-4" style={{ color: SLATE }}>
                  <span style={{ color: BLUE }}>{i === MANIFEST.length - 1 ? '└── ' : '├── '}</span>
                  <span className="font-semibold" style={{ color: NAVY }}>{item.key}</span>
                  <span className="hidden sm:inline">{' '.repeat(Math.max(2, 20 - item.key.length))}</span>
                  <span className="block pl-4 sm:inline sm:pl-0">{item.desc}</span>
                </p>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="border-t" style={{ borderColor: TINT, backgroundColor: '#fafcfe' }}>
          <Reveal className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="font-mono text-xs font-semibold tracking-widest" style={{ color: BLUE }}>
              HOW IT WORKS
            </h2>
            <div className="mt-6 grid gap-8 sm:grid-cols-3">
              {PROCESS.map((step) => (
                <div key={step.n}>
                  <span className="font-mono text-sm font-bold" style={{ color: PALE, WebkitTextStroke: `1px ${BLUE}` } as React.CSSProperties}>
                    {step.n}
                  </span>
                  <div className="mt-1 font-bold" style={{ color: NAVY }}>{step.title}</div>
                  <p className="mt-1 text-sm" style={{ color: SLATE }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── Reviews (placeholder — see REVIEW_SLOTS note) ── */}
        <section className="border-t" style={{ borderColor: TINT }}>
          <Reveal className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="font-mono text-xs font-semibold tracking-widest" style={{ color: BLUE }}>
              WHAT BUILDERS SAY
            </h2>
            <p className="mt-2 text-sm" style={{ color: SLATE, opacity: 0.75 }}>
              Reviews go here once our first Sadiqabad cohort ships. Nothing invented in the meantime.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {Array.from({ length: REVIEW_SLOTS }).map((_, i) => (
                <ReviewSlot key={i} index={i} />
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="border-t" style={{ borderColor: TINT, backgroundColor: '#fafcfe' }}>
          <Reveal className="mx-auto max-w-6xl px-6 py-16">
            <p className="font-mono text-xs font-semibold tracking-widest" style={{ color: BLUE }}>
              FAQ
            </p>
            <h2 className="mt-2 text-2xl font-black" style={{ color: NAVY }}>Common questions</h2>
            <div className="mt-6 max-w-2xl">
              {FAQ.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </Reveal>
          {/* Machine-readable copy of the same content above, for search
              engines and AI answer engines that read schema.org markup
              directly rather than parsing rendered text. */}
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: FAQ.map((item) => ({
                  '@type': 'Question',
                  name: item.q,
                  acceptedAnswer: { '@type': 'Answer', text: item.a },
                })),
              }),
            }}
          />
        </section>

        {/* ── Application form ── */}
        <section id="apply" className="border-t" style={{ borderColor: TINT }}>
          <Reveal className="mx-auto max-w-6xl px-6 py-16">
            <div
              className="mx-auto max-w-xl rounded-2xl border p-8 shadow-[0_24px_60px_-24px_rgba(13,26,58,0.55)]"
              style={{ background: PANEL_GRADIENT, borderColor: 'rgba(212,232,247,0.14)' }}
            >
              <p className="font-mono text-xs font-semibold tracking-widest" style={{ color: BLUE }}>
                ./apply
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">Apply for admission</h2>
              <p className="mt-2 text-sm" style={{ color: 'rgba(212,232,247,0.7)' }}>
                Tell us a bit about yourself. We&apos;ll follow up by email or phone with next steps.
              </p>
              <div className="mt-6">
                <AdmissionForm />
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: PANEL_GRADIENT }}>
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <NextAiBuilderLogo size={30} onDark />
              <p className="mt-4 text-sm" style={{ color: 'rgba(212,232,247,0.7)' }}>
                An in-person Agentic AI Engineer program: 6-month or 1-year tracks, built and
                shipped in Sadiqabad, Punjab.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-mono text-xs font-semibold tracking-widest" style={{ color: BLUE }}>
                PROGRAM
              </span>
              {[
                { href: '#tracks', label: 'Choose your track' },
                { href: '#syllabus', label: 'Syllabus' },
                { href: '#how-it-works', label: 'How it works' },
                { href: '#faq', label: 'FAQ' },
                { href: '#apply', label: 'Apply' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm transition-colors hover:text-white"
                  style={{ color: 'rgba(212,232,247,0.75)' }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-mono text-xs font-semibold tracking-widest" style={{ color: BLUE }}>
                LOCATION
              </span>
              <p className="font-mono text-sm leading-relaxed" style={{ color: 'rgba(212,232,247,0.75)' }}>
                Plaza No. 11, Al-Haram City
                <br />
                Near New Bus Stand, Sadiqabad
                <br />
                Punjab, Pakistan · PKT (UTC+5)
              </p>
            </div>
          </div>

          <div
            className="mt-12 flex flex-col items-center gap-4 border-t pt-6 sm:flex-row sm:justify-between"
            style={{ borderColor: 'rgba(212,232,247,0.14)' }}
          >
            <p className="text-xs" style={{ color: 'rgba(212,232,247,0.5)' }}>
              &copy; {new Date().getFullYear()} nextaibuilder. All rights reserved.
            </p>
            <NextAiBuilderMark size={18} />
          </div>
        </div>
      </footer>

      <WhatsAppButton />
    </div>
  )
}
