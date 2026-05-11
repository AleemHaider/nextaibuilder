// FIR-30 — Cohort detail / course landing page
// Sprint 3 Story 13 — Wise theme migration.
//
// The hero gradient, type badges, pricing card, modal, and curriculum rows
// are now driven by `--color-wise-*` tokens and Tailwind utilities. Emojis
// were swapped for lucide icons (Radio, Zap, Video, Calendar, Users, Clock,
// Armchair, Flame, Lock, Check, Play, FileText, Wrench). sanitizeHtml() on
// the cohort description is kept — do not unwrap.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Radio,
  Zap,
  Video,
  Calendar,
  Clock,
  Users,
  Armchair,
  Flame,
  Lock,
  Check,
  Play,
  FileText,
  Wrench,
  ChevronRight,
  X,
  // NAB-P0-3 — social-link icons on the instructor card.
  Twitter,
  Linkedin,
  Github,
  Youtube,
  Link as LinkIcon,
  type LucideIcon,
} from 'lucide-react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'
import { Button } from '../components/ui/Button'
import { usePageMeta } from '../hooks/usePageMeta'
import { fetchCohortBySlug, fetchPreviewLessons, instructorAvatarUrl } from '../lib/api'
import type {
  CohortDetail,
  CohortLesson,
  PreviewLesson,
  InstructorSocialPlatform,
} from '../lib/api'
import { sanitizeHtml } from '../lib/sanitize'
import { toEmbedUrl } from '../lib/detectVideoProvider'
import { cn } from '../lib/utils'

// ─── helpers ──────────────────────────────────────────────────────────────────

interface TypeMeta {
  label: string
  Icon: LucideIcon
  chipClass: string
}

const TYPE_META: Record<string, TypeMeta> = {
  live: {
    label: 'Live Cohort',
    Icon: Radio,
    chipClass: 'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
  },
  combined: {
    label: 'Combined',
    Icon: Zap,
    chipClass: 'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text)]',
  },
  recorded: {
    label: 'Recorded',
    Icon: Video,
    chipClass: 'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
  },
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

// ─── Preview player modal ──────────────────────────────────────────────────────

/**
 * NAB-P0-5 — Body for the preview-player modal: picks the right iframe
 * source (Loom / YouTube / Vimeo) via `toEmbedUrl`, falling back to the
 * deprecated `loomUrl` field for lessons the server hasn't migrated yet.
 */
function PreviewPlayerBody({ lesson }: { lesson: PreviewLesson }) {
  if (lesson.type === 'VIDEO') {
    const rawUrl  = lesson.videoUrl ?? lesson.loomUrl ?? null
    const embedUrl = toEmbedUrl(lesson.videoProvider ?? null, rawUrl)
    if (embedUrl) {
      return (
        <div className="relative h-0 pb-[56.25%]">
          <iframe
            src={embedUrl}
            title={lesson.title}
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      )
    }
  }

  if (lesson.type === 'TEXT') {
    // NAB-P0-4 — prefer the TipTap-authored HTML; fall back to the legacy
    // plain-text `content`. The HTML is piped through sanitizeHtml before
    // hitting the DOM, same allow-list the rest of the admin-authored HTML
    // uses.
    const richHtml = lesson.richContent?.trim()
    if (richHtml) {
      return (
        <div
          className="prose max-h-[480px] overflow-y-auto px-7 py-6"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(richHtml) }}
        />
      )
    }
    if (lesson.content) {
      return (
        <div
          className="max-h-[480px] overflow-y-auto whitespace-pre-wrap px-7 py-6 text-[15px] leading-[1.8] text-[var(--color-wise-text-warm)]"
        >
          {lesson.content}
        </div>
      )
    }
  }

  return (
    <div className="p-12 text-center text-sm text-[var(--color-wise-text-muted)]">
      No preview available.
    </div>
  )
}

function PreviewPlayer({
  lesson,
  onClose,
}: {
  lesson: PreviewLesson
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lesson preview"
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full max-w-[880px] overflow-hidden bg-[var(--color-wise-surface)]',
          'rounded-[var(--radius-md)] shadow-[0_40px_100px_rgba(0,0,0,0.5)]',
        )}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--color-wise-ring)]">
          <div>
            <span
              className={cn(
                'inline-block rounded-md px-2.5 py-0.5',
                'text-[10px] font-bold uppercase tracking-wider',
                'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
              )}
            >
              Free Preview
            </span>
            <p className="mt-1.5 text-base font-bold text-[var(--color-wise-text)]">
              {lesson.title}
            </p>
            {lesson.moduleTitle && (
              <p className="mt-0.5 text-xs text-[var(--color-wise-text-muted)]">
                {lesson.moduleTitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
              'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]',
              'hover:bg-[var(--color-wise-mint)] hover:text-[var(--color-wise-primary-text)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
            )}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* content */}
        {/* NAB-P0-5 — Resolve the embed URL from the multi-provider fields,
            falling back to the legacy loomUrl for back-compat. */}
        <PreviewPlayerBody lesson={lesson} />

        {/* footer cta */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-wise-ring)] bg-[var(--color-wise-canvas)] px-5 py-3.5">
          <p className="text-[13px] text-[var(--color-wise-text-muted)]">
            Enjoying this? Enroll to unlock all lessons.
          </p>
          <Button variant="primary" size="sm" onClick={onClose}>
            Enroll now
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Curriculum module accordion ──────────────────────────────────────────────

function LessonTypeIcon({ type }: { type: CohortLesson['type'] }) {
  if (type === 'VIDEO') return <Play size={14} aria-hidden="true" />
  if (type === 'TEXT') return <FileText size={14} aria-hidden="true" />
  return <Wrench size={14} aria-hidden="true" />
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

function ModuleRow({
  title,
  lessonCount,
  freePreviewCount,
  lessons,
  previewLessonMap,
  onPreviewClick,
  defaultOpen = false,
}: ModuleRowProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={cn(
        'mb-2.5 overflow-hidden rounded-[var(--radius-sm)]',
        'ring-1 ring-[var(--color-wise-ring)]',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left',
          'cursor-pointer border-0',
          'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
          open
            ? 'bg-[var(--color-wise-mint)]'
            : 'bg-[var(--color-wise-canvas)] hover:bg-[var(--color-wise-surface-soft)]',
        )}
      >
        <div className="flex items-center gap-2.5">
          <ChevronRight
            size={16}
            aria-hidden="true"
            className={cn(
              'inline-block transition-transform duration-200',
              open
                ? 'rotate-90 text-[var(--color-wise-primary-text)]'
                : 'text-[var(--color-wise-text-muted)]',
            )}
          />
          <span className="text-[15px] font-bold text-[var(--color-wise-text)]">
            {title}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {freePreviewCount > 0 && (
            <span
              className={cn(
                'rounded-[var(--radius-pill)] px-2.5 py-0.5',
                'text-[10px] font-bold tracking-wide',
                'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
              )}
            >
              {freePreviewCount} free
            </span>
          )}
          <span
            className={cn(
              'rounded-[var(--radius-pill)] px-2.5 py-0.5',
              'text-[11px] font-semibold',
              'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]',
            )}
          >
            {lessonCount} lessons
          </span>
        </div>
      </button>

      {open && (
        <div className="bg-[var(--color-wise-surface)]">
          {lessons.length > 0 ? (
            lessons.map((lesson, i) => {
              const preview = previewLessonMap.get(lesson.id)
              return (
                <div
                  key={lesson.id}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-2.5',
                    i === 0
                      ? 'border-t border-[var(--color-wise-ring)]'
                      : 'border-t border-[var(--color-wise-ring)]/60',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex-shrink-0 text-[var(--color-wise-text-muted)]">
                      <LessonTypeIcon type={lesson.type} />
                    </span>
                    <span
                      className={cn(
                        'overflow-hidden text-ellipsis whitespace-nowrap text-[13px]',
                        lesson.freePreview
                          ? 'font-semibold text-[var(--color-wise-text)]'
                          : 'text-[var(--color-wise-text-muted)]',
                      )}
                    >
                      {lesson.title}
                    </span>
                    {lesson.freePreview && (
                      <span
                        className={cn(
                          'flex-shrink-0 rounded px-1.5 py-0.5',
                          'text-[9px] font-extrabold tracking-wider',
                          'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
                        )}
                      >
                        FREE
                      </span>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2.5">
                    {lesson.estimatedMinutes > 0 && (
                      <span className="text-[11px] text-[var(--color-wise-text-muted)]">
                        {lesson.estimatedMinutes}m
                      </span>
                    )}
                    {lesson.freePreview && preview ? (
                      <button
                        type="button"
                        onClick={() => onPreviewClick(preview)}
                        className={cn(
                          'rounded-md px-3 py-1 text-[11px] font-bold',
                          'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
                          'hover:bg-[var(--color-wise-primary-hover)]',
                          'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
                        )}
                      >
                        Watch free
                      </button>
                    ) : (
                      <Lock
                        size={14}
                        aria-hidden="true"
                        className="text-[var(--color-wise-text-muted)]"
                      />
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="border-t border-[var(--color-wise-ring)] px-4 py-3">
              <p className="text-[13px] text-[var(--color-wise-text-muted)]">
                {lessonCount} lesson{lessonCount !== 1 ? 's' : ''} — enroll to access
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-xl px-3.5 py-2',
        'bg-white/10 text-white/90 backdrop-blur',
        'ring-1 ring-white/15',
      )}
    >
      <Icon size={16} aria-hidden="true" />
      <span className="text-[13px] font-semibold">{label}</span>
    </div>
  )
}

// ─── Instructor card ─────────────────────────────────────────────────────────
//
// NAB-P0-3 — Rendered only when `cohort.instructor` is non-null. Avatars fall
// back to the instructor's initial when `avatarKey` is missing. Bio HTML is
// piped through the shared DOMPurify sanitizer before entering the DOM.

const INSTRUCTOR_SOCIAL_ICON: Record<InstructorSocialPlatform, LucideIcon> = {
  TWITTER:  Twitter,
  X:        Twitter,
  LINKEDIN: Linkedin,
  GITHUB:   Github,
  YOUTUBE:  Youtube,
  WEBSITE:  LinkIcon,
}

const INSTRUCTOR_SOCIAL_LABEL: Record<InstructorSocialPlatform, string> = {
  TWITTER:  'Twitter profile',
  X:        'X profile',
  LINKEDIN: 'LinkedIn profile',
  GITHUB:   'GitHub profile',
  YOUTUBE:  'YouTube channel',
  WEBSITE:  'Website',
}

function InstructorCard({ instructor }: { instructor: NonNullable<CohortDetail['instructor']> }) {
  // The server hands us an avatarUrl relative path when set, but consumers
  // that talk directly to the admin API only have avatarKey — we normalise
  // here to handle both shapes without special-casing at the call site.
  const avatarSrc =
    instructor.avatarUrl ??
    instructorAvatarUrl((instructor as { avatarKey?: string | null }).avatarKey ?? null)
  const bioHtml = sanitizeHtml(instructor.bio || '')

  return (
    <section
      className={cn(
        'rounded-[var(--radius-md)] bg-[var(--color-wise-surface)] p-8',
        'shadow-[var(--shadow-ring)]',
      )}
    >
      <p className="mb-5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-wise-primary-text)]">
        Your instructor
      </p>
      <div className="flex items-start gap-5">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={instructor.name}
            className="h-[72px] w-[72px] flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className={cn(
              'h-[72px] w-[72px] flex-shrink-0 rounded-full',
              'flex items-center justify-center text-2xl font-black',
              'bg-[var(--color-wise-mint)] text-[var(--color-wise-primary-text)]',
            )}
            aria-hidden="true"
          >
            {(instructor.name || 'I').charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="mb-1 text-xl font-extrabold text-[var(--color-wise-text)]">
            {instructor.name}
          </h3>
          {instructor.title ? (
            <p className="mb-2.5 text-sm font-semibold text-[var(--color-wise-primary-text)]">
              {instructor.title}
            </p>
          ) : null}
          {bioHtml ? (
            <div
              className="text-[15px] leading-[1.65] text-[var(--color-wise-text-muted)]"
              // Sanitized above — still lands inside the DOMPurify allow-list.
              dangerouslySetInnerHTML={{ __html: bioHtml }}
            />
          ) : null}
          {instructor.socialLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" data-testid="instructor-social-links">
              {instructor.socialLinks.map((link) => {
                const Icon = INSTRUCTOR_SOCIAL_ICON[link.platform as InstructorSocialPlatform] ?? LinkIcon
                const label = INSTRUCTOR_SOCIAL_LABEL[link.platform as InstructorSocialPlatform] ?? 'External link'
                return (
                  <a
                    key={`${link.platform}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={cn(
                      'inline-flex items-center justify-center h-9 w-9 rounded-full',
                      'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text)]',
                      'hover:bg-[var(--color-wise-mint)] transition-colors',
                    )}
                  >
                    <Icon size={16} aria-hidden="true" />
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing card ──────────────────────────────────────────────────────────────

function PricingCard({ cohort }: { cohort: CohortDetail }) {
  const navigate = useNavigate()

  return (
    <div
      className={cn(
        'sticky top-[88px] rounded-[var(--radius-md)] bg-[var(--color-wise-surface)]',
        'p-7 shadow-[var(--shadow-card)]',
      )}
    >
      {/* Price */}
      <div className="mb-5">
        {/* Founding discount: strike-through regular price + percent-off badge. */}
        {cohort.regularPrice != null && cohort.price > 0 && (
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-base font-bold text-[var(--color-wise-text-muted)] line-through">
              {fmt(cohort.regularPrice)}
            </span>
            <span
              className={cn(
                'rounded-[var(--radius-pill)] px-2 py-0.5',
                'text-[11px] font-bold uppercase tracking-wide',
                'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
              )}
            >
              {Math.round((1 - cohort.price / cohort.regularPrice) * 100)}% off
            </span>
          </div>
        )}
        <div className="text-[42px] font-black leading-none tracking-[-1.5px] text-[var(--color-wise-text)]">
          {cohort.price === 0 ? 'Free' : fmt(cohort.price)}
        </div>
        {cohort.installmentPrice != null && (
          <p className="mt-1.5 text-sm font-bold text-[var(--color-wise-primary-text)]">
            or {cohort.installmentCount ?? 3}× {fmt(cohort.installmentPrice)}/mo
          </p>
        )}
        {cohort.promoSeatsRemaining != null && cohort.promoSeatsRemaining > 0 && (
          <p className="mt-2 text-xs font-semibold text-[var(--color-wise-text-muted)]">
            Founding rate. {cohort.promoSeatsRemaining}{' '}
            {cohort.promoSeatsRemaining === 1 ? 'seat' : 'seats'} left at this price.
          </p>
        )}
      </div>

      {/* Seats urgency */}
      {cohort.seatsRemaining != null && cohort.seatsRemaining <= 10 && (
        <div
          className={cn(
            'mb-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5',
            'bg-[var(--color-wise-warning-soft)] text-[var(--color-wise-text)]',
          )}
        >
          <Flame
            size={16}
            aria-hidden="true"
            className="text-[var(--color-wise-warning)]"
          />
          <span className="text-[13px] font-bold">
            Only {cohort.seatsRemaining} seats left!
          </span>
        </div>
      )}

      {/* Primary CTA */}
      <Button
        variant="primary"
        size="lg"
        onClick={() => navigate(`/checkout/${cohort.slug}`)}
        className="mb-2.5 w-full"
      >
        Enroll Now {cohort.price > 0 ? `— ${fmt(cohort.price)}` : '— Free'}
      </Button>

      {/* Installment CTA */}
      {cohort.installmentPrice != null && (
        <Button
          variant="outline"
          size="md"
          onClick={() => navigate(`/checkout/${cohort.slug}?plan=installment`)}
          className="mb-2.5 w-full"
        >
          Pay {cohort.installmentCount ?? 3} installments of{' '}
          {fmt(cohort.installmentPrice)}
        </Button>
      )}

      {/* Manual payment link */}
      <Link
        to={`/manual-payment/${cohort.slug}`}
        className={cn(
          'mb-5 block py-2.5 text-center',
          'text-[13px] font-semibold text-[var(--color-wise-text-muted)] underline',
          'hover:text-[var(--color-wise-text)]',
          'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2 rounded',
        )}
      >
        Upload payment receipt
      </Link>

      <div className="mb-4 h-px bg-[var(--color-wise-ring)]" />

      {/* What's included */}
      <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-wise-text-muted)]">
        What's included
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {cohort.includes.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-[13px] text-[var(--color-wise-text-warm)]"
          >
            <Check
              size={14}
              strokeWidth={3}
              aria-hidden="true"
              className="mt-0.5 flex-shrink-0 text-[var(--color-wise-primary-text)]"
            />
            {item}
          </li>
        ))}
      </ul>

      <div className="my-5 h-px bg-[var(--color-wise-ring)]" />

      {/* Trust row */}
      <div className="flex items-center justify-center gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 py-1',
            'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]',
            'text-xs font-semibold',
          )}
        >
          <Lock size={12} aria-hidden="true" />
          Secure
        </span>
        <span className="text-[11px] text-[var(--color-wise-text-muted)]">
          Visa · Mastercard · Amex
        </span>
      </div>
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div>
      <div className="h-[420px] animate-pulse bg-[var(--color-wise-surface-soft)]" />
      <div className="max-w-[1180px] mx-auto px-6 py-12 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 flex flex-col gap-5">
          {[140, 280, 200].map((h, i) => (
            <div
              key={i}
              className="animate-pulse rounded-[var(--radius-md)] bg-[var(--color-wise-surface-soft)]"
              style={{ height: h }}
            />
          ))}
        </div>
        <div className="w-full lg:w-[340px] flex-shrink-0">
          <div className="h-[380px] animate-pulse rounded-[var(--radius-md)] bg-[var(--color-wise-surface-soft)]" />
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

  if (isPending)
    return (
      <div className="min-h-screen">
        <TopNav />
        <Skeleton />
      </div>
    )

  if (isError || cohort == null) {
    return (
      <div className="min-h-screen">
        <TopNav />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <p className="text-[64px] font-black leading-none text-[var(--color-wise-text)]">
            404
          </p>
          <p className="text-lg text-[var(--color-wise-text-muted)]">
            Course not found
          </p>
          <Link
            to="/courses"
            className={cn(
              'inline-flex items-center rounded-[var(--radius-pill)] px-8 py-3',
              'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
              'text-[15px] font-bold',
              'hover:bg-[var(--color-wise-primary-hover)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
            )}
          >
            Browse Courses
          </Link>
        </div>
      </div>
    )
  }

  const typeMeta = TYPE_META[cohort.type] ?? TYPE_META.recorded

  return (
    <div className="min-h-screen bg-[var(--color-wise-canvas)]">
      <TopNav />

      <main id="main-content" tabIndex={-1} className="focus:outline-none">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[var(--color-wise-dark)]">
        {/* Decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 h-[400px] w-[400px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(159,232,112,0.22) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 left-[30%] h-[300px] w-[300px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(226,246,213,0.12) 0%, transparent 70%)',
          }}
        />

        <div className="relative max-w-[1180px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
          {/* Breadcrumb */}
          <p className="mb-6 text-[13px] text-white/55">
            <Link
              to="/"
              className="text-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded"
            >
              Home
            </Link>
            {' › '}
            <Link
              to="/courses"
              className="text-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded"
            >
              Courses
            </Link>
            {' › '}
            <span className="text-white/85">{cohort.title}</span>
          </p>

          {/* Type badge */}
          <div className="mb-4">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3.5 py-1.5',
                'text-xs font-bold',
                typeMeta.chipClass,
              )}
            >
              <typeMeta.Icon size={14} aria-hidden="true" />
              {typeMeta.label}
            </span>
          </div>

          {/* Title */}
          <h1
            className={cn(
              'mb-4 max-w-[780px] font-black leading-[1.05] tracking-[-1.5px] text-white',
              'text-4xl sm:text-5xl md:text-6xl lg:text-[62px]',
            )}
          >
            {cohort.title}
          </h1>

          {/* Tagline */}
          <p className="mb-8 max-w-[620px] text-lg leading-[1.5] text-white/70">
            {cohort.tagline}
          </p>

          {/* Stats pills */}
          <div className="flex flex-wrap gap-2.5">
            {cohort.lessonCount > 0 && (
              <StatPill Icon={Video} label={`${cohort.lessonCount} lessons`} />
            )}
            {cohort.hoursOfContent > 0 && (
              <StatPill Icon={Clock} label={`${cohort.hoursOfContent}h of content`} />
            )}
            {cohort.startDate && (
              <StatPill Icon={Calendar} label={`Starts ${cohort.startDate}`} />
            )}
            {cohort.enrolledCount != null && (
              <StatPill Icon={Users} label={`${cohort.enrolledCount} enrolled`} />
            )}
            {cohort.seatsRemaining != null && (
              <StatPill
                Icon={Armchair}
                label={`${cohort.seatsRemaining} seats left`}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'max-w-[1180px] mx-auto px-4 sm:px-6',
          'py-10 lg:py-12 pb-20',
          'flex flex-col lg:flex-row gap-8 lg:items-start',
        )}
      >
        {/* LEFT COLUMN */}
        <div className="flex flex-1 min-w-0 flex-col gap-5">
          {/* About */}
          <section
            className={cn(
              'rounded-[var(--radius-md)] bg-[var(--color-wise-surface)] p-8',
              'shadow-[var(--shadow-ring)]',
            )}
          >
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-wise-primary-text)]">
              About this course
            </p>
            <div
              className="text-base leading-[1.75] text-[var(--color-wise-text-warm)]"
              // sanitizeHtml() wrap retained from Sprint 1 Story 6.
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(cohort.description ?? ''),
              }}
            />
          </section>

          {/* NAB-P0-2 — What you'll learn (formerly "What's included").
              Still reads `cohort.learningOutcomes` — the legacy `includes`
              alias is kept on the payload for back-compat but the dark-card
              hero now pulls exclusively from the new field. */}
          {cohort.learningOutcomes.length > 0 && (
            <section
              className={cn(
                'rounded-[var(--radius-md)] p-8',
                'bg-[var(--color-wise-dark)] text-white',
                'shadow-[var(--shadow-card)]',
              )}
            >
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-wise-primary)]">
                What you'll learn
              </p>
              <h2 className="mb-5 text-2xl font-extrabold tracking-[-0.5px]">
                Outcomes you'll walk away with
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {cohort.learningOutcomes.map((item) => (
                  <div
                    key={item}
                    className={cn(
                      'flex items-start gap-2.5 rounded-xl px-3.5 py-3',
                      'bg-white/5 ring-1 ring-white/10',
                    )}
                  >
                    <Check
                      size={14}
                      strokeWidth={3}
                      aria-hidden="true"
                      className="mt-0.5 flex-shrink-0 text-[var(--color-wise-primary)]"
                    />
                    <span className="text-sm leading-snug text-white/85">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* NAB-P0-2 — Requirements. Rendered only when non-empty. Uses the
              light surface-card style to sit alongside the curriculum rather
              than competing with the dark outcomes hero above. */}
          {cohort.requirements.length > 0 && (
            <section
              className={cn(
                'rounded-[var(--radius-md)] bg-[var(--color-wise-surface)] p-8',
                'shadow-[var(--shadow-ring)]',
              )}
            >
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-wise-primary-text)]">
                Requirements
              </p>
              <h2 className="mb-5 text-[22px] font-extrabold tracking-[-0.5px] text-[var(--color-wise-text)]">
                Before you start
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {cohort.requirements.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-[15px] leading-snug text-[var(--color-wise-text-warm)]"
                  >
                    <Check
                      size={14}
                      strokeWidth={3}
                      aria-hidden="true"
                      className="mt-1 flex-shrink-0 text-[var(--color-wise-primary-text)]"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* NAB-P0-2 — Who this course is for. Same light-card style as
              Requirements; hidden when empty. */}
          {cohort.targetAudience.length > 0 && (
            <section
              className={cn(
                'rounded-[var(--radius-md)] bg-[var(--color-wise-surface)] p-8',
                'shadow-[var(--shadow-ring)]',
              )}
            >
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-wise-primary-text)]">
                Who this course is for
              </p>
              <h2 className="mb-5 text-[22px] font-extrabold tracking-[-0.5px] text-[var(--color-wise-text)]">
                Built for builders like you
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {cohort.targetAudience.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-[15px] leading-snug text-[var(--color-wise-text-warm)]"
                  >
                    <Check
                      size={14}
                      strokeWidth={3}
                      aria-hidden="true"
                      className="mt-1 flex-shrink-0 text-[var(--color-wise-primary-text)]"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Curriculum */}
          <section
            className={cn(
              'rounded-[var(--radius-md)] bg-[var(--color-wise-surface)] p-8',
              'shadow-[var(--shadow-ring)]',
            )}
          >
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-wise-primary-text)]">
              Curriculum
            </p>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[22px] font-extrabold tracking-[-0.5px] text-[var(--color-wise-text)]">
                {cohort.modules.length} modules · {cohort.lessonCount} lessons
              </h2>
              {previewLessons.length > 0 && (
                <span className="text-[13px] font-semibold text-[var(--color-wise-primary-text)]">
                  {previewLessons.length} free preview
                  {previewLessons.length !== 1 ? 's' : ''} available
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

          {/* NAB-P0-3 — Instructor card driven by the populated primary
              instructor profile. When `cohort.instructor` is null we skip the
              whole section instead of rendering an empty placeholder. */}
          {cohort.instructor && (
            <InstructorCard instructor={cohort.instructor} />
          )}

          {/* Live sessions */}
          {cohort.liveSessions != null && cohort.liveSessions.length > 0 && (
            <section
              className={cn(
                'rounded-[var(--radius-md)] bg-[var(--color-wise-surface)] p-8',
                'shadow-[var(--shadow-ring)]',
              )}
            >
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-wise-primary-text)]">
                Live Sessions
              </p>
              <h2 className="mb-5 text-[22px] font-extrabold tracking-[-0.5px] text-[var(--color-wise-text)]">
                Weekly office hours
              </h2>
              <div className="flex flex-col gap-2.5">
                {cohort.liveSessions.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-[var(--radius-sm)] px-4 py-3.5',
                      'bg-[var(--color-wise-canvas)] ring-1 ring-[var(--color-wise-ring)]',
                    )}
                  >
                    <div>
                      <p className="mb-0.5 text-[15px] font-bold text-[var(--color-wise-text)]">
                        {s.title}
                      </p>
                      <p className="text-[13px] text-[var(--color-wise-text-muted)]">
                        {s.date}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-3 py-1',
                        'text-xs font-semibold',
                        s.status === 'upcoming'
                          ? 'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]'
                          : 'bg-[var(--color-wise-surface-soft)] text-[var(--color-wise-text-muted)]',
                      )}
                    >
                      {s.status === 'upcoming' ? (
                        <>
                          <Radio size={12} aria-hidden="true" />
                          Upcoming
                        </>
                      ) : (
                        'Completed'
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bottom mobile CTA */}
          <div className="block lg:hidden">
            <Link
              to={`/checkout/${cohort.slug}`}
              className={cn(
                'block w-full rounded-[var(--radius-pill)] px-6 py-4 text-center',
                'bg-[var(--color-wise-primary)] text-[var(--color-wise-primary-text)]',
                'text-base font-extrabold',
                'hover:bg-[var(--color-wise-primary-hover)]',
                'focus-visible:outline-2 focus-visible:outline-[var(--color-wise-primary-text)] focus-visible:outline-offset-2',
              )}
            >
              Enroll Now{' '}
              {cohort.price > 0 ? `— ${fmt(cohort.price)}` : '— Free'}
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN — sticky pricing card */}
        <div className="w-full lg:w-[340px] flex-shrink-0 hidden lg:block">
          <PricingCard cohort={cohort} />
        </div>
      </div>

      </main>

      <Footer />

      {/* Preview player modal */}
      {activePreview && (
        <PreviewPlayer
          lesson={activePreview}
          onClose={() => setActivePreview(null)}
        />
      )}
    </div>
  )
}
