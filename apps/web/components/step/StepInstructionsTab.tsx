'use client'

// PBA-276 — Shared StepInstructionsTab component
// PBA-298 — Figma-spec: dark code blocks, checklist card, Why This Matters accordion,
//            quick-reference sidebar (240px, #f3f3f5)
// PBA-299 — Content wrapper card, numbered section badges, inline code pill polish
import { useCallback, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Calendar, Check, ChevronDown, ChevronRight, Copy, ExternalLink, HelpCircle, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_SCHEDULING_URL ?? '#'

// ── Copy button for code blocks ────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable — silently ignore
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied!' : 'Copy code'}
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-all duration-150',
        copied
          ? 'bg-[#16a34a]/15 text-[#4ade80]'
          : 'bg-white/8 text-[#94a3b8] hover:bg-white/14 hover:text-white',
      )}
    >
      {copied ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ── Dark code block with copy button ──────────────────────────────────────────

function CodeBlock({ children }: { children: React.ReactNode }) {
  // Extract raw text from children for clipboard
  function extractText(node: React.ReactNode): string {
    if (typeof node === 'string') return node
    if (typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(extractText).join('')
    if (node && typeof node === 'object' && 'props' in (node as object)) {
      return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children)
    }
    return ''
  }
  const rawText = extractText(children).trim()

  return (
    <div className="group relative my-4 rounded-xl" style={{ background: '#0f1b2d', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Top bar — macOS traffic lights + copy button */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: '#ff5f57' }} />
          <span className="h-3 w-3 rounded-full" style={{ background: '#ffbd2e' }} />
          <span className="h-3 w-3 rounded-full" style={{ background: '#28c840' }} />
        </div>
        <CopyButton text={rawText} />
      </div>
      {/* Code content — use inline style for padding so prose [&_pre]:p-0 cannot override */}
      <pre
        className="overflow-x-auto text-[13px] leading-[1.7] font-mono"
        style={{ color: '#cdd6f4', padding: '14px 20px', margin: 0 }}
      >
        <code style={{ background: 'none', padding: 0, color: 'inherit', fontSize: 'inherit', fontFamily: 'inherit' }}>
          {children}
        </code>
      </pre>
    </div>
  )
}

interface StepInstructionsTabProps {
  description: string
  screenshotCriteria: string
  checklist?: string[]
  whyItMatters?: string | null
  quickReferenceChecklist?: string[]
  keyLinks?: { label: string; url: string }[]
  estimatedMinutes?: number | null
  /** When true, renders checklist as static (first 2 checked) and support link as non-interactive span */
  isPreview?: boolean
  /** Used to persist checklist state in localStorage across page refreshes */
  stepId?: string
}

// ── PBA-298: Why This Matters collapsible ──────────────────────────────────────

function WhyItMatters({ content }: { content: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="overflow-hidden rounded-xl border transition-all duration-150"
      style={{ background: 'rgba(74,154,212,0.05)', borderColor: 'rgba(74,154,212,0.18)' }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-[#4a9ad4]/5"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style={{ background: 'rgba(74,154,212,0.15)' }}
          >
            <Lightbulb className="h-3.5 w-3.5 text-[#4a9ad4]" aria-hidden="true" />
          </span>
          <span className="text-[13px] font-semibold text-[#1a2744]">Why this matters</span>
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-[#717182] shrink-0 transition-transform" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[#717182] shrink-0 transition-transform" />
        )}
      </button>
      {open && (
        <div
          className="px-4 pb-4 pt-0 text-[13px] text-[#717182] leading-[1.65]"
          style={{ borderTop: '1px solid rgba(74,154,212,0.12)' }}
        >
          <div className="pt-3">{content}</div>
        </div>
      )}
    </div>
  )
}

// ── PBA-298: Checklist card ────────────────────────────────────────────────────

interface ChecklistProps {
  items: string[]
  isPreview: boolean
  checked?: boolean[]
  onToggle?: (index: number) => void
}

function ChecklistCard({ items, isPreview, checked, onToggle }: ChecklistProps) {
  if (items.length === 0) return null

  return (
    <div className="rounded-[10px] overflow-hidden" style={{ background: '#f3f3f5' }}>
      <div className="px-4 pt-4 pb-3">
        <p className="text-[13px] font-semibold text-[#1a2744]">Your Checklist</p>
      </div>
      <ul>
        {items.map((item, i) => {
          const isChecked = isPreview ? i < 2 : (checked?.[i] ?? false)
          return (
            <li key={i} className="flex items-center gap-[10px] px-4 py-[6px] border-b border-black/[0.08] last:border-b-0">
              {isPreview ? (
                <span
                  className={cn(
                    'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2',
                    isChecked
                      ? 'border-[#16a34a] bg-[#16a34a] text-white'
                      : 'border-[#d1d5db] bg-white',
                  )}
                  aria-hidden="true"
                >
                  {isChecked && (
                    <svg viewBox="0 0 10 8" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M1 4l3 3L9 1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              ) : (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isChecked}
                  onClick={() => onToggle?.(i)}
                  className={cn(
                    'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 cursor-pointer transition-colors',
                    isChecked
                      ? 'border-[#16a34a] bg-[#16a34a] text-white'
                      : 'border-[#d1d5db] bg-white hover:border-[#4a9ad4]',
                  )}
                  aria-label={`Mark "${item}" as ${isChecked ? 'incomplete' : 'complete'}`}
                >
                  {isChecked && (
                    <svg viewBox="0 0 10 8" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M1 4l3 3L9 1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )}
              <span
                className={cn(
                  'text-[13px]',
                  isChecked ? 'line-through text-[#717182]' : 'text-[#1a2744]',
                )}
              >
                {item}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── PBA-298: Quick Reference sidebar (240px, #f3f3f5) ─────────────────────────

interface QuickReferenceSidebarProps {
  quickReferenceChecklist: string[]
  keyLinks: { label: string; url: string }[]
  isPreview: boolean
}

function QuickReferenceSidebar({ quickReferenceChecklist, keyLinks }: QuickReferenceSidebarProps) {
  const hasContent = quickReferenceChecklist.length > 0 || keyLinks.length > 0
  if (!hasContent) return null

  return (
    <aside
      className="rounded-xl border space-y-4 overflow-hidden"
      style={{ background: '#f9f9fb', borderColor: 'rgba(0,0,0,0.08)', width: '240px', flexShrink: 0 }}
    >
      {quickReferenceChecklist.length > 0 && (
        <div>
          <div className="px-4 pt-4 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#717182]">
              Quick Reference
            </p>
          </div>
          <ul>
            {quickReferenceChecklist.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 px-4 py-[7px]"
                style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
              >
                <span
                  className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#4a9ad4]"
                  aria-hidden="true"
                />
                <span className="text-[12px] leading-[1.5] text-[#1a2744]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {quickReferenceChecklist.length > 0 && keyLinks.length > 0 && (
        <div className="h-px mx-4" style={{ background: 'rgba(0,0,0,0.08)' }} />
      )}

      {keyLinks.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#717182]">
            Key Links
          </p>
          <ul className="space-y-1.5">
            {keyLinks.map((link, i) => (
              <li key={i}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12px] text-[#4a9ad4] hover:underline leading-[1.4]"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}

// ── Section heading counter context ────────────────────────────────────────────
// We track h2 and h3 headings to auto-number them as step badges.
// Because ReactMarkdown renders headings as React elements, we use a mutable ref
// counter that increments during each render pass.

interface HeadingCounterRef {
  h2: number
  h3: number
}

// ── Main component ─────────────────────────────────────────────────────────────

function StepInstructionsTab({
  description,
  checklist = [],
  whyItMatters,
  quickReferenceChecklist = [],
  keyLinks = [],
  isPreview = false,
  stepId,
}: StepInstructionsTabProps) {
  const storageKey = stepId ? `pba_checklist_${stepId}` : null

  // Interactive checklist state — persisted to localStorage when stepId is provided
  const [checkedItems, setCheckedItems] = useState<boolean[]>(() => {
    if (!isPreview && storageKey) {
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          const parsed = JSON.parse(saved) as boolean[]
          // Ensure length matches current checklist (steps may have been updated)
          if (parsed.length === checklist.length) return parsed
        }
      } catch {
        // ignore malformed localStorage data
      }
    }
    return Array(checklist.length).fill(false)
  })

  // Mutable counter for numbered section headings — reset each render
  const headingCounter: HeadingCounterRef = { h2: 0, h3: 0 }

  function handleToggle(index: number) {
    setCheckedItems((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      if (!isPreview && storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          // ignore quota errors
        }
      }
      return next
    })
  }

  const hasSidebar = quickReferenceChecklist.length > 0 || keyLinks.length > 0

  return (
    <div
      data-slot="step-instructions-tab"
      className={cn(
        'flex gap-8',
        hasSidebar ? 'items-start' : '',
      )}
    >
      {/* ── Main content column ── */}
      <div className="min-w-0 flex-1 space-y-5">

        {/* ── Content wrapper card — white with subtle border + shadow ── */}
        <div
          className="rounded-2xl border bg-white px-8 py-7"
          style={{
            borderColor: 'rgba(0,0,0,0.08)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)',
          }}
        >
          {/*
            PBA-298/299: Markdown prose — 15px navy, 1.75 line height.
            Code blocks use custom <CodeBlock> with copy button.
            Inline code uses dark navy pill style.
            h2/h3 headings are replaced with numbered badge components.
          */}
          <div
            className={cn(
              'prose max-w-none',
              // Paragraph text
              '[&_p]:text-[15px] [&_p]:text-[#3d4f6b] [&_p]:leading-[1.75] [&_p]:mb-4 [&_p:last-child]:mb-0',
              // List items
              '[&_li]:text-[15px] [&_li]:text-[#3d4f6b] [&_li]:leading-[1.75]',
              '[&_ul]:pl-5 [&_ul]:mb-4 [&_ul>li]:mb-2',
              '[&_ol]:pl-5 [&_ol]:mb-4 [&_ol>li]:mb-2',
              // h1 — top-level heading (rare in step content)
              '[&_h1]:text-[20px] [&_h1]:font-semibold [&_h1]:text-[#1a2744] [&_h1]:mt-7 [&_h1]:mb-3 [&_h1]:tracking-[-0.01em]',
              // h2/h3 — suppressed via prose; replaced by our custom components below
              '[&_h2]:mt-0 [&_h2]:mb-0 [&_h2]:p-0 [&_h2]:border-none',
              '[&_h3]:mt-0 [&_h3]:mb-0 [&_h3]:p-0 [&_h3]:border-none',
              '[&_strong]:font-semibold [&_strong]:text-[#1a2744]',
              // Inline code — deep navy pill, monospace, sky-blue text
              '[&_:not(pre)>code]:rounded-[5px] [&_:not(pre)>code]:px-[6px] [&_:not(pre)>code]:py-[2px] [&_:not(pre)>code]:text-[12px] [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:bg-[#1a2744] [&_:not(pre)>code]:text-[#7dd3fc] [&_:not(pre)>code]:font-normal [&_:not(pre)>code]:whitespace-nowrap',
              // Block code — handled by custom CodeBlock component, disable prose defaults
              '[&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:rounded-none [&_pre]:my-0',
              '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_pre_code]:rounded-none [&_pre_code]:px-0 [&_pre_code]:py-0',
              // Links
              '[&_a]:text-[#4a9ad4] [&_a]:no-underline [&_a]:hover:underline',
              // Blockquote — left accent bar, indented, muted
              '[&_blockquote]:border-l-[3px] [&_blockquote]:border-[#4a9ad4]/30 [&_blockquote]:pl-4 [&_blockquote]:text-[#717182] [&_blockquote]:italic [&_blockquote]:my-4',
              // HR
              '[&_hr]:border-black/8 [&_hr]:my-6',
              // Table
              '[&_table]:text-[14px] [&_th]:text-[#1a2744] [&_th]:font-semibold [&_td]:text-[#3d4f6b]',
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Links — open in new tab, styled in brand blue
                a({ href, children }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#4a9ad4] underline underline-offset-2 hover:text-[#3a8ac4] transition-colors"
                    >
                      {children}
                    </a>
                  )
                },
                // h2 — numbered section badge, navy bg
                h2({ children }) {
                  headingCounter.h2 += 1
                  headingCounter.h3 = 0 // reset sub-count per section
                  const num = headingCounter.h2
                  return (
                    <div className="not-prose mt-8 first:mt-0 mb-4">
                      {/* Separator line above (skip the very first heading) */}
                      {num > 1 && (
                        <div className="mb-6 h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />
                      )}
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex shrink-0 items-center justify-center rounded-lg font-mono font-bold leading-none"
                          style={{
                            height: '28px',
                            minWidth: '28px',
                            padding: '0 8px',
                            fontSize: '12px',
                            background: '#1a2744',
                            color: '#ffffff',
                          }}
                        >
                          {num}
                        </span>
                        <span
                          style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#1a2744',
                            lineHeight: '1.35',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {children}
                        </span>
                      </div>
                    </div>
                  )
                },
                // h3 — sub-section badge, blue tint bg
                h3({ children }) {
                  headingCounter.h3 += 1
                  const parentNum = headingCounter.h2
                  const subNum = headingCounter.h3
                  const label = parentNum > 0 ? `${parentNum}.${subNum}` : `${subNum}`
                  return (
                    <div className="not-prose mt-6 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="inline-flex shrink-0 items-center justify-center rounded-md font-mono font-semibold leading-none"
                          style={{
                            height: '22px',
                            minWidth: '36px',
                            padding: '0 6px',
                            fontSize: '10px',
                            background: 'rgba(74,154,212,0.12)',
                            color: '#4a9ad4',
                          }}
                        >
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#1a2744',
                            lineHeight: '1.4',
                          }}
                        >
                          {children}
                        </span>
                      </div>
                    </div>
                  )
                },
                // Custom code renderer: code blocks get our styled component
                code({ className, children, ...rest }) {
                  const isBlock = !!className?.startsWith('language-')
                  if (isBlock) {
                    return <CodeBlock>{children}</CodeBlock>
                  }
                  // Inline code — prose CSS handles it via selector above
                  return (
                    <code className={className} {...rest}>
                      {children}
                    </code>
                  )
                },
                // Suppress the wrapping <pre> since CodeBlock renders its own
                pre({ children }) {
                  return <>{children}</>
                },
              }}
            >
              {description}
            </ReactMarkdown>
          </div>
        </div>

        {/* PBA-298: Your Checklist card */}
        {checklist.length > 0 && (
          <ChecklistCard
            items={checklist}
            isPreview={isPreview}
            checked={checkedItems}
            onToggle={handleToggle}
          />
        )}

        {/* PBA-298: Why this matters collapsible */}
        {whyItMatters && <WhyItMatters content={whyItMatters} />}

        {/* ── Help card — styled with brand weight ── */}
        <div
          className="flex items-start gap-3 rounded-xl border p-4"
          style={{ borderColor: 'rgba(0,0,0,0.08)', background: '#fafafa' }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5"
            style={{ background: '#f3f3f5' }}
          >
            <HelpCircle className="h-4 w-4 text-[#717182]" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#1a2744] mb-0.5">Need more help?</p>
            <p className="text-[12px] text-[#717182] leading-[1.5]">
              Book a 1-on-1 session with your cohort instructor.
            </p>
          </div>
          {isPreview ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#4a9ad4] shrink-0"
              style={{ background: 'rgba(74,154,212,0.1)' }}
            >
              <Calendar className="h-3 w-3" aria-hidden="true" />
              Book a call
            </span>
          ) : (
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#4a9ad4] transition-colors hover:text-white shrink-0"
              style={{ background: 'rgba(74,154,212,0.1)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#4a9ad4'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(74,154,212,0.1)'
              }}
            >
              <Calendar className="h-3 w-3" aria-hidden="true" />
              Book a call
            </a>
          )}
        </div>
      </div>

      {/* PBA-298: Right quick-reference sidebar — 240px, #f3f3f5, only when content exists */}
      {hasSidebar && (
        <div className="hidden md:block" style={{ width: '220px', flexShrink: 0 }}>
          <QuickReferenceSidebar
            quickReferenceChecklist={quickReferenceChecklist}
            keyLinks={keyLinks}
            isPreview={isPreview}
          />
        </div>
      )}
    </div>
  )
}

export { StepInstructionsTab }
