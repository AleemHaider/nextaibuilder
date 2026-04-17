// PBA-129 — Help & Support page (Sprint 3)
// Route: /help  |  Requires auth
import { useEffect, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileQuestion,
  HelpCircle,
  Image,
  LifeBuoy,
  Mail,
  MessageCircle,
  Phone,
  RotateCcw,
  ShieldAlert,
  Upload,
} from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '../../../lib/utils'
import { Button } from '../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'

// VITE_SUPPORT_SCHEDULING_URL is deprecated in PBA-334 — replaced by /student/agents
const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL ?? 'support@productbuilderacademy.com'

// ── FAQ data ──────────────────────────────────────────────────────────────────

interface FaqItem {
  id: string
  question: string
  answer: string
  icon: React.ElementType
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'submit-screenshot',
    question: 'How do I submit a screenshot?',
    answer:
      'Navigate to any unlocked step and click the "Verify Setup" tab. You can drag and drop your screenshot into the upload zone or click "Choose File" to browse your computer. Accepted formats are PNG and JPG. The screenshot will be reviewed automatically — you\'ll see feedback within a few seconds.',
    icon: Upload,
  },
  {
    id: 'upload-fails',
    question: 'What happens if my upload fails?',
    answer:
      'If your upload fails, check that your file is under 10 MB and is a PNG or JPG image. Make sure you have a stable internet connection, then try again. If the problem persists, clear your browser cache and reload the page or try a different browser. If none of these steps help, use the "Book a Session" option below to get live support.',
    icon: ShieldAlert,
  },
  {
    id: 'validation-time',
    question: 'How long does screenshot validation take?',
    answer:
      'Most screenshots are reviewed automatically within 5–15 seconds. Our AI checks that your screenshot meets the step criteria — correct application, visible terminal output, proper file structure, and so on. If your submission is flagged for manual review, a member of the academy team will respond within one business day.',
    icon: Clock,
  },
  {
    id: 'reset-progress',
    question: 'Can I re-submit a screenshot for a step?',
    answer:
      'Yes. You can re-upload a screenshot for any step that is in "Pending Review" or has received feedback. Navigate back to the step, open the "Verify Setup" tab, and upload a new screenshot — your latest submission replaces the previous one. Note: steps that have already passed cannot be reset; contact support if you need a manual adjustment.',
    icon: RotateCcw,
  },
  {
    id: 'screenshot-criteria',
    question: 'What must my screenshot show?',
    answer:
      'Each step lists its specific screenshot criteria in a blue info box on the Instructions tab. In general, capture the full application window (not a cropped portion), ensure the expected terminal output or file structure is visible, and make sure there are no unintended error states. Common rejection reasons are a cropped window or missing terminal output.',
    icon: Image,
  },
  {
    id: 'step-locked',
    question: 'Why is a step locked?',
    answer:
      'Steps unlock sequentially. You must receive a passing review on the current step\'s screenshot before the next step becomes available. This ensures you have a correctly configured environment at every stage. If a step appears locked even though your previous submission shows "Complete", please contact support.',
    icon: BookOpen,
  },
  {
    id: 'deadline-missed',
    question: 'What happens if I miss the setup deadline?',
    answer:
      'If your cohort\'s setup deadline passes before you complete all steps, your dashboard switches to "Deadline Missed" mode and new screenshot uploads are paused. Please book a support session as soon as possible — our team can discuss deferral options or manual overrides depending on your situation.',
    icon: FileQuestion,
  },
  {
    id: 'browser-support',
    question: 'Which browsers are supported?',
    answer:
      'Product Builder Academy works best on the latest versions of Chrome, Edge, Firefox, and Safari. Internet Explorer is not supported. If you experience display or upload issues, update your browser to the latest version. Switching to Chrome or Edge resolves most problems.',
    icon: HelpCircle,
  },
]

// ── AccordionItem ─────────────────────────────────────────────────────────────

interface AccordionItemProps {
  item: FaqItem
  isOpen: boolean
  onToggle: () => void
}

function AccordionItem({ item, isOpen, onToggle }: AccordionItemProps) {
  const Icon = item.icon

  return (
    <div
      data-slot="accordion-item"
      className={cn(
        'overflow-hidden rounded-xl border border-border transition-shadow',
        isOpen ? 'shadow-sm' : 'shadow-none',
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.id}`}
        id={`faq-trigger-${item.id}`}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-3 px-5 py-4 text-left transition-colors',
          isOpen ? 'bg-card' : 'bg-card hover:bg-accent',
        )}
      >
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            isOpen
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 text-sm font-medium text-foreground">
          {item.question}
        </span>
        <span className="shrink-0 text-muted-foreground">
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>

      {isOpen && (
        <div
          id={`faq-answer-${item.id}`}
          role="region"
          aria-labelledby={`faq-trigger-${item.id}`}
          className="border-t border-border bg-card px-5 pb-5 pt-4"
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            {item.answer}
          </p>
        </div>
      )}
    </div>
  )
}

// ── BrowseAgentsCard (PBA-334 — replaces static BookSessionCard) ─────────────

function BrowseAgentsCard() {
  return (
    <Card data-slot="browse-agents-card">
      <CardHeader>
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Phone className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-base">Browse Support Agents</CardTitle>
        <CardDescription>
          Stuck on a step or need live guidance? Book a 15-min call with one of
          our technical coaches — usually available within 24 hours.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="mb-5 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4a9ad4]" />
            Live screen-share with a technical coach
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4a9ad4]" />
            Step-by-step troubleshooting in real time
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4a9ad4]" />
            Read reviews to find the right coach for you
          </li>
        </ul>
        <Link to="/student/agents" className="block">
          <Button className="w-full gap-2">
            <Phone className="h-4 w-4" />
            Browse Support Agents
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// ── ContactCard ───────────────────────────────────────────────────────────────

function ContactCard() {
  return (
    <Card data-slot="contact-card">
      <CardHeader>
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <MessageCircle className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-base">Other Ways to Get Help</CardTitle>
        <CardDescription>
          Not ready to book a session? Reach us by email or check the resources
          below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Email support */}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className={cn(
            'flex items-center gap-3 rounded-lg border border-border p-3.5 text-sm transition-colors',
            'hover:bg-accent',
          )}
          aria-label={`Send an email to ${SUPPORT_EMAIL}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Mail className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Email Support</p>
            <p className="truncate text-xs text-muted-foreground">
              {SUPPORT_EMAIL}
            </p>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>

        {/* Knowledge base — coming soon */}
        <div
          className="flex cursor-not-allowed items-center gap-3 rounded-lg border border-border p-3.5 text-sm opacity-50"
          aria-disabled="true"
          role="presentation"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BookOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Knowledge Base</p>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── HelpPage ──────────────────────────────────────────────────────────────────

function HelpPage() {
  // First FAQ item open by default
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id)

  useEffect(() => {
    document.title = 'Help & Support — Setup Companion'
  }, [])

  function handleToggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div data-slot="help-page" className="mx-auto max-w-3xl space-y-10">

      {/* ── Page header ── */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <LifeBuoy className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-medium text-foreground">
            Help &amp; Support
          </h1>
        </div>
        <p className="mt-1 pl-12 text-sm text-muted-foreground">
          Find answers to common questions, or get in touch with our team.
        </p>
      </div>

      {/* ── FAQ section ── */}
      <section aria-labelledby="faq-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="faq-heading"
            className="text-base font-medium text-foreground"
          >
            Frequently Asked Questions
          </h2>
          <span className="text-xs text-muted-foreground">
            {FAQ_ITEMS.length} questions
          </span>
        </div>

        <div className="space-y-2.5">
          {FAQ_ITEMS.map((item) => (
            <AccordionItem
              key={item.id}
              item={item}
              isOpen={openId === item.id}
              onToggle={() => handleToggle(item.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Support actions ── */}
      <section aria-labelledby="support-heading">
        <h2
          id="support-heading"
          className="mb-4 text-base font-medium text-foreground"
        >
          Get Personal Support
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BrowseAgentsCard />
          <ContactCard />
        </div>
      </section>

      {/* ── Footer note ── */}
      <p className="pb-4 text-center text-xs text-muted-foreground">
        Product Builder Academy &middot; Support hours Mon–Fri, 9 am–6 pm GMT
      </p>
    </div>
  )
}

export { HelpPage }
