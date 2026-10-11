'use client'
// PBA — Admin Step Editor with live student portal preview
// Routes: /admin/steps/new  and  /admin/steps/:stepId/edit
// PBA-270 — isActive wired through save payload + pre-populated in edit mode
// PBA-271 — Surface videoUrl mutation error from API
// PBA-272 — useAdminStep(id) for edit mode fetch
// Updated: estimatedMinutes, checklist, whyItMatters, quickReferenceChecklist, keyLinks, videoTranscript
import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bold,
  Clock,
  Code,
  Eye,
  EyeOff,
  Heading2,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  Lock,
  Play,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAdminStep,
  useCreateStep,
  useUpdateStep,
  type CreateStepPayload,
  type UpdateStepPayload,
} from '@/hooks/use-admin-steps'
import { StepInstructionsTab } from '@/components/step/StepInstructionsTab'
import { StepVideoTab } from '@/components/step/StepVideoTab'
import { StepVerifyTab } from '@/components/step/StepVerifyTab'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KeyLink {
  label: string
  url: string
}

interface StepFormValues {
  title: string
  description: string
  screenshotCriteria: string
  videoUrl: string
  isActive: boolean
  estimatedMinutes: string          // stored as string for input, parsed on submit
  checklist: string[]
  whyItMatters: string
  quickReferenceChecklist: string[]
  keyLinks: KeyLink[]
  videoTranscript: string
}

type PreviewStatus = 'LOCKED' | 'UNLOCKED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETE'
type PreviewTab = 'instructions' | 'video' | 'verify'
type MobileView = 'edit' | 'preview'

// ── Markdown utilities ────────────────────────────────────────────────────────

function isValidLoomUrl(url: string): boolean {
  return /loom\.com\/(share|embed)\/[a-zA-Z0-9]+/.test(url)
}

function extractLoomId(url: string): string | null {
  const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/)
  return match?.[1] ?? null
}

function normalizeLoomInput(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/)
  if (match?.[1]) return `https://www.loom.com/share/${match[1]}`
  return trimmed
}

// ── Markdown renderer (preview only) ─────────────────────────────────────────

function renderMarkdown(raw: string): string {
  if (!raw) return ''

  const html = raw
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-foreground mt-4 mb-1">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-gray-900 text-green-400 px-1.5 py-0.5 text-sm font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/((<li class="ml-4 list-disc">.*<\/li>\n?)+)/g, '<ul class="space-y-1 my-2 pl-2">$1</ul>')
    .replace(/((<li class="ml-4 list-decimal">.*<\/li>\n?)+)/g, '<ol class="space-y-1 my-2 pl-2">$1</ol>')
    .replace(/\n\n/g, '</p><p class="text-sm text-foreground leading-relaxed mb-2">')
    .replace(/\n/g, '<br />')

  return `<p class="text-sm text-foreground leading-relaxed mb-2">${html}</p>`
}

// ── Markdown Toolbar ──────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded text-muted-foreground',
        'hover:bg-accent hover:text-foreground transition-colors'
      )}
    >
      {children}
    </button>
  )
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  error?: string
  rows?: number
}

function MarkdownEditor({ value, onChange, error, rows = 10 }: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  function insertAtCursor(before: string, after = '', placeholder = 'text') {
    const el = textareaRef.current
    if (!el) return

    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || placeholder
    const newValue =
      value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(newValue)

    requestAnimationFrame(() => {
      el.focus()
      const cursorPos = start + before.length + selected.length + after.length
      el.setSelectionRange(
        start + before.length,
        start + before.length + selected.length
      )
      void cursorPos
    })
  }

  const toolbarActions = React.useMemo(() => [
    { icon: <Bold className="h-3.5 w-3.5" />, title: 'Bold', action: () => insertAtCursor('**', '**', 'bold text') },
    { icon: <Italic className="h-3.5 w-3.5" />, title: 'Italic', action: () => insertAtCursor('*', '*', 'italic text') },
    { icon: <Heading2 className="h-3.5 w-3.5" />, title: 'Heading', action: () => insertAtCursor('## ', '', 'Heading') },
    { icon: <List className="h-3.5 w-3.5" />, title: 'Bullet list', action: () => insertAtCursor('- ', '', 'List item') },
    { icon: <ListOrdered className="h-3.5 w-3.5" />, title: 'Numbered list', action: () => insertAtCursor('1. ', '', 'List item') },
    { icon: <Link2 className="h-3.5 w-3.5" />, title: 'Link', action: () => insertAtCursor('[', '](url)', 'link text') },
    { icon: <Code className="h-3.5 w-3.5" />, title: 'Inline code', action: () => insertAtCursor('`', '`', 'code') },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [value])

  return (
    <div className={cn('rounded-lg border border-border overflow-hidden', error && 'border-destructive')}>
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          {toolbarActions.map((action) => (
            <ToolbarButton key={action.title} onClick={action.action} title={action.title}>
              {action.icon}
            </ToolbarButton>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className={cn(
            'flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors',
            showPreview
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          {showPreview ? (
            <><EyeOff className="h-3.5 w-3.5" /> Edit</>
          ) : (
            <><Eye className="h-3.5 w-3.5" /> Preview</>
          )}
        </button>
      </div>

      {showPreview ? (
        <div
          className="min-h-[160px] p-3 text-sm"
          dangerouslySetInnerHTML={{ __html: value ? renderMarkdown(value) : '<p class="text-muted-foreground text-sm">Nothing to preview yet.</p>' }}
        />
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder="Write step instructions using Markdown…&#10;&#10;## Heading&#10;**Bold**, *italic*, `code`&#10;- Bullet list&#10;1. Numbered list"
          className="rounded-none border-0 bg-transparent focus-visible:ring-0 focus-visible:border-0 resize-y"
          aria-invalid={Boolean(error)}
        />
      )}
    </div>
  )
}

// ── Dynamic List Field ────────────────────────────────────────────────────────

interface DynamicListFieldProps {
  label: string
  helperText?: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
  maxItems?: number
  addLabel?: string
}

function DynamicListField({
  label,
  helperText,
  items,
  onChange,
  placeholder = 'Item',
  maxItems = 20,
  addLabel = 'Add item',
}: DynamicListFieldProps) {
  function handleChange(index: number, value: string) {
    const next = [...items]
    next[index] = value
    onChange(next)
  }

  function handleRemove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function handleAdd() {
    if (items.length < maxItems) {
      onChange([...items, ''])
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={(e) => handleChange(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => handleRemove(i)}
              aria-label="Remove item"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {items.length < maxItems && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Dynamic Key Links Field ───────────────────────────────────────────────────

interface DynamicKeyLinksFieldProps {
  items: KeyLink[]
  onChange: (items: KeyLink[]) => void
}

function DynamicKeyLinksField({ items, onChange }: DynamicKeyLinksFieldProps) {
  function handleLabelChange(index: number, value: string) {
    const next = [...items]
    next[index] = { ...next[index], label: value }
    onChange(next)
  }

  function handleUrlChange(index: number, value: string) {
    const next = [...items]
    next[index] = { ...next[index], url: value }
    onChange(next)
  }

  function handleRemove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function handleAdd() {
    onChange([...items, { label: '', url: '' }])
  }

  return (
    <div className="space-y-1.5">
      <Label>Key Links</Label>
      <p className="text-xs text-muted-foreground">
        External links shown in the right sidebar
      </p>
      <div className="space-y-2">
        {items.map((link, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={link.label}
              onChange={(e) => handleLabelChange(i, e.target.value)}
              placeholder="Label (e.g. VS Code Download)"
              className="flex-1"
            />
            <Input
              value={link.url}
              onChange={(e) => handleUrlChange(i, e.target.value)}
              placeholder="https://..."
              type="url"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => handleRemove(i)}
              aria-label="Remove link"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAdd}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add link
        </Button>
      </div>
    </div>
  )
}

// ── Preview: Bottom CTA Bar ────────────────────────────────────────────────────

function PreviewBottomCTA({ status }: { status: PreviewStatus }) {
  switch (status) {
    case 'UNLOCKED':
    case 'IN_PROGRESS':
      return (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#ff8c5a] px-4 py-2.5 text-sm font-medium text-white opacity-90 cursor-not-allowed"
        >
          <Upload className="h-4 w-4" />
          Upload Screenshot
        </button>
      )
    case 'PENDING_REVIEW':
      return (
        <div className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-muted/50 px-4 py-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <span className="text-sm text-muted-foreground">Submitted — awaiting review</span>
        </div>
      )
    case 'COMPLETE':
      return (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white cursor-not-allowed opacity-90"
        >
          Next Step
          <ArrowRight className="h-4 w-4" />
        </button>
      )
    case 'LOCKED':
    default:
      return (
        <div className="flex w-full items-center justify-center gap-1.5 py-2.5">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Complete previous step first</p>
        </div>
      )
  }
}

// ── Preview Panel ─────────────────────────────────────────────────────────────

interface PreviewPanelProps {
  title: string
  description: string
  screenshotCriteria: string
  videoUrl: string
  stepNumber: number
  estimatedMinutes: number | null
  checklist: string[]
  whyItMatters: string
  quickReferenceChecklist: string[]
  keyLinks: KeyLink[]
  videoTranscript: string
}

function PreviewPanel({
  title,
  description,
  screenshotCriteria,
  videoUrl,
  stepNumber,
  estimatedMinutes,
  checklist,
  whyItMatters,
  quickReferenceChecklist,
  keyLinks,
  videoTranscript,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = React.useState<PreviewTab>('instructions')
  const [previewStatus, setPreviewStatus] = React.useState<PreviewStatus>('UNLOCKED')

  const TABS: { key: PreviewTab; label: string }[] = [
    { key: 'instructions', label: 'Instructions' },
    { key: 'video', label: 'Watch Video' },
    { key: 'verify', label: 'Verify Setup' },
  ]

  const STATUS_OPTIONS: { value: PreviewStatus; label: string }[] = [
    { value: 'LOCKED', label: 'Locked' },
    { value: 'UNLOCKED', label: 'Unlocked' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'PENDING_REVIEW', label: 'Pending Review' },
    { value: 'COMPLETE', label: 'Complete' },
  ]

  return (
    <div
      data-slot="preview-panel"
      className="flex h-full flex-col overflow-hidden"
    >
      {/* Preview header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Student Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="preview-status" className="text-xs text-muted-foreground whitespace-nowrap">
            View as:
          </Label>
          <Select
            value={previewStatus}
            onValueChange={(v) => setPreviewStatus(v as PreviewStatus)}
          >
            <SelectTrigger id="preview-status" className="h-7 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scrollable preview content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 pt-5 pb-28">

          {/* Step header preview */}
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a2744] text-white font-semibold text-sm">
              {stepNumber}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-medium text-foreground">
                {title || <span className="italic text-muted-foreground">Untitled step</span>}
              </h1>
              <div className="mt-1 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  In Progress
                </span>
                {estimatedMinutes != null && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    ~{estimatedMinutes} min
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mb-5 border-t border-border" />

          {/* Tab bar */}
          <div className="mb-5 flex gap-1 rounded-xl bg-muted p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 rounded-xl px-3 py-1.5 text-sm font-medium transition-all',
                  activeTab === tab.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content — uses shared components with isPreview=true */}
          {activeTab === 'instructions' && (
            <StepInstructionsTab
              description={description}
              screenshotCriteria={screenshotCriteria}
              checklist={checklist}
              whyItMatters={whyItMatters || null}
              quickReferenceChecklist={quickReferenceChecklist}
              keyLinks={keyLinks}
              estimatedMinutes={estimatedMinutes}
              isPreview={true}
            />
          )}
          {activeTab === 'video' && (
            <StepVideoTab
              videoUrl={videoUrl || null}
              videoTranscript={videoTranscript || null}
            />
          )}
          {activeTab === 'verify' && (
            <StepVerifyTab screenshotCriteria={screenshotCriteria} />
          )}
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <PreviewBottomCTA status={previewStatus} />
      </div>
    </div>
  )
}

// ── Unsaved changes indicator ─────────────────────────────────────────────────

function UnsavedDot() {
  return (
    <span
      className="inline-flex h-2 w-2 rounded-full bg-amber-500"
      title="Unsaved changes"
      aria-label="Unsaved changes"
    />
  )
}

// ── Main StepEditor Page ──────────────────────────────────────────────────────

function PageContent() {
  const params = useParams<{ stepId: string }>()
  const stepId = params?.stepId
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEditMode = Boolean(stepId)

  // insertAt is only relevant in create mode
  const insertAtParam = !isEditMode ? searchParams.get('insertAt') : null
  const insertAt = insertAtParam !== null ? parseInt(insertAtParam, 10) : null
  const hasInsertAt = insertAt !== null && !Number.isNaN(insertAt)

  const { data: existingStep, isLoading: stepLoading } = useAdminStep(stepId ?? '')
  const createStep = useCreateStep()
  const updateStep = useUpdateStep()

  const stepNumber = React.useMemo(() => {
    if (isEditMode && existingStep) return existingStep.order
    return 1
  }, [isEditMode, existingStep])

  const [mobileView, setMobileView] = React.useState<MobileView>('edit')

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isDirty, isSubmitting },
    reset,
    setError,
  } = useForm<StepFormValues>({
    defaultValues: {
      title: '',
      description: '',
      screenshotCriteria: '',
      videoUrl: '',
      isActive: true,
      estimatedMinutes: '',
      checklist: [],
      whyItMatters: '',
      quickReferenceChecklist: [],
      keyLinks: [],
      videoTranscript: '',
    },
  })

  const watched = useWatch({ control })

  // Populate form when editing existing step
  React.useEffect(() => {
    if (isEditMode && existingStep) {
      reset({
        title: existingStep.title,
        description: existingStep.description,
        screenshotCriteria: existingStep.screenshotCriteria,
        videoUrl: existingStep.videoUrl ?? '',
        isActive: existingStep.isActive,
        estimatedMinutes: existingStep.estimatedMinutes != null
          ? String(existingStep.estimatedMinutes)
          : '',
        checklist: existingStep.checklist ?? [],
        whyItMatters: existingStep.whyItMatters ?? '',
        quickReferenceChecklist: existingStep.quickReferenceChecklist ?? [],
        keyLinks: existingStep.keyLinks ?? [],
        videoTranscript: existingStep.videoTranscript ?? '',
      })
    }
  }, [isEditMode, existingStep, reset])

  if (isEditMode && stepLoading) {
    return (
      <div className="flex h-full items-center justify-center py-24">
        <div className="space-y-2 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading step…</p>
        </div>
      </div>
    )
  }

  if (isEditMode && !stepLoading && !existingStep) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 py-24">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground">Step not found</p>
          <p className="text-sm text-muted-foreground">
            This step may have been deleted or you may not have access.
          </p>
        </div>
        <Button variant="outline" onClick={() => void router.push('/admin/steps')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Steps
        </Button>
      </div>
    )
  }

  async function onSubmit(values: StepFormValues) {
    try {
      const estimatedMinutesParsed = values.estimatedMinutes
        ? parseInt(values.estimatedMinutes, 10) || null
        : null

      // Filter out empty strings from dynamic lists
      const cleanChecklist = values.checklist.filter((s) => s.trim() !== '')
      const cleanQRC = values.quickReferenceChecklist.filter((s) => s.trim() !== '')
      const cleanKeyLinks = values.keyLinks.filter((l) => l.label.trim() !== '' || l.url.trim() !== '')

      if (isEditMode && stepId) {
        const payload: UpdateStepPayload = {
          title: values.title,
          description: values.description,
          screenshotCriteria: values.screenshotCriteria,
          videoUrl: values.videoUrl || null,
          isActive: values.isActive,
          estimatedMinutes: estimatedMinutesParsed,
          checklist: cleanChecklist,
          whyItMatters: values.whyItMatters || null,
          quickReferenceChecklist: cleanQRC,
          keyLinks: cleanKeyLinks,
          videoTranscript: values.videoTranscript || null,
        }
        await updateStep.mutateAsync({ id: stepId, payload })
        toast.success('Step updated successfully')
      } else {
        const payload: CreateStepPayload = {
          title: values.title,
          description: values.description,
          screenshotCriteria: values.screenshotCriteria,
          isActive: values.isActive,
          ...(values.videoUrl ? { videoUrl: values.videoUrl } : {}),
          ...(hasInsertAt ? { order: insertAt! } : {}),
          estimatedMinutes: estimatedMinutesParsed,
          checklist: cleanChecklist,
          whyItMatters: values.whyItMatters || null,
          quickReferenceChecklist: cleanQRC,
          keyLinks: cleanKeyLinks,
          videoTranscript: values.videoTranscript || null,
        }
        await createStep.mutateAsync(payload)
        toast.success('Step created successfully')
      }
      reset(values)
      void router.push('/admin/steps')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save step'
      if (message.toLowerCase().includes('loom') || message.toLowerCase().includes('video')) {
        setError('videoUrl', { message })
      } else {
        toast.error(message)
      }
    }
  }

  const titleValue = watched.title ?? ''
  const descriptionValue = watched.description ?? ''
  const screenshotCriteriaValue = watched.screenshotCriteria ?? ''
  const videoUrlValue = watched.videoUrl ?? ''
  const isActiveValue = watched.isActive ?? true
  const estimatedMinutesValue = watched.estimatedMinutes ?? ''
  const checklistValue = watched.checklist ?? []
  const whyItMattersValue = watched.whyItMatters ?? ''
  const quickReferenceChecklistValue = watched.quickReferenceChecklist ?? []
  const keyLinksValue: KeyLink[] = (watched.keyLinks ?? []) as KeyLink[]
  const videoTranscriptValue = watched.videoTranscript ?? ''

  const loomPreviewId = videoUrlValue && isValidLoomUrl(videoUrlValue)
    ? extractLoomId(videoUrlValue)
    : null

  const estimatedMinutesParsed = estimatedMinutesValue
    ? parseInt(estimatedMinutesValue, 10) || null
    : null

  const titleMax = 300
  const criteriaMax = 600
  const whyItMattersMax = 2000
  const transcriptMax = 10000

  return (
    <div data-slot="step-editor-page" className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">

      {/* Page header bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3 shrink-0 bg-background">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void router.push('/admin/steps')}
          >
            <ArrowLeft className="h-4 w-4" />
            Steps
          </Button>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-sm font-medium text-foreground">
            {isEditMode ? 'Edit Step' : 'New Step'}
          </h1>
          {isDirty && <UnsavedDot />}
        </div>

        {/* Mobile: toggle edit/preview */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setMobileView('edit')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                mobileView === 'edit'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setMobileView('preview')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                mobileView === 'preview'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Form panel */}
        <div
          className={cn(
            'flex flex-col overflow-hidden border-r border-border',
            'w-full lg:w-1/2',
            mobileView === 'preview' && 'hidden lg:flex'
          )}
        >
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col h-full"
          >
            {/* Scrollable form fields */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6 px-6 py-5">

                {/* Insert-at position banner — create mode only */}
                {!isEditMode && hasInsertAt && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>
                      This step will be inserted at position {insertAt}. Steps {insertAt} and above
                      will shift forward automatically.
                    </p>
                  </div>
                )}

                {/* Step Title */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="step-title">
                      Step Title <span className="text-destructive">*</span>
                    </Label>
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        titleValue.length > titleMax
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      )}
                    >
                      {titleValue.length}/{titleMax}
                    </span>
                  </div>
                  <Input
                    id="step-title"
                    placeholder="e.g. Set up your development environment"
                    aria-invalid={Boolean(errors.title)}
                    {...register('title', {
                      required: 'Title is required',
                      maxLength: { value: titleMax, message: `Title must be ${titleMax} characters or fewer` },
                    })}
                  />
                  {errors.title && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {/* Description — Rich Markdown Editor */}
                <div className="space-y-1.5">
                  <Label>
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Supports Markdown formatting. Use the toolbar or type directly.
                  </p>
                  <MarkdownEditor
                    value={descriptionValue}
                    onChange={(v) => setValue('description', v, { shouldDirty: true, shouldValidate: true })}
                    error={errors.description?.message}
                    rows={12}
                  />
                  <input
                    type="hidden"
                    {...register('description', { required: 'Description is required' })}
                  />
                  {errors.description && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {errors.description.message}
                    </p>
                  )}
                </div>

                {/* Screenshot Criteria */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="step-criteria">
                      Screenshot Criteria <span className="text-destructive">*</span>
                    </Label>
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        screenshotCriteriaValue.length > criteriaMax
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      )}
                    >
                      {screenshotCriteriaValue.length}/{criteriaMax}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Describe exactly what the student&apos;s screenshot must show for it to pass review.
                  </p>
                  <Textarea
                    id="step-criteria"
                    rows={3}
                    placeholder="e.g. The screenshot must show the terminal with the server running on port 3000, with no error messages visible."
                    aria-invalid={Boolean(errors.screenshotCriteria)}
                    {...register('screenshotCriteria', {
                      required: 'Screenshot criteria is required',
                      maxLength: { value: criteriaMax, message: `Criteria must be ${criteriaMax} characters or fewer` },
                    })}
                  />
                  {errors.screenshotCriteria && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {errors.screenshotCriteria.message}
                    </p>
                  )}
                </div>

                {/* Video URL */}
                <div className="space-y-1.5">
                  <Label htmlFor="step-video">
                    Video URL{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="step-video"
                    type="url"
                    placeholder="https://www.loom.com/share/... or paste embed code"
                    aria-invalid={Boolean(errors.videoUrl)}
                    {...register('videoUrl')}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text')
                      const normalized = normalizeLoomInput(pasted)
                      if (normalized !== pasted.trim()) {
                        e.preventDefault()
                        setValue('videoUrl', normalized, { shouldDirty: true, shouldValidate: true })
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste a Loom share URL or embed code — both are supported.
                  </p>

                  {errors.videoUrl && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {errors.videoUrl.message}
                    </p>
                  )}

                  {/* Loom embed preview */}
                  {videoUrlValue && (
                    <div className="mt-2">
                      {loomPreviewId ? (
                        <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: '56.25%' }}>
                          <iframe
                            src={`https://www.loom.com/embed/${loomPreviewId}`}
                            className="absolute inset-0 h-full w-full border-0"
                            allowFullScreen
                            title="Loom video preview"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            Enter a valid Loom share URL to see the embed preview.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {!videoUrlValue && (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3">
                      <Play className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground">No video added yet.</p>
                    </div>
                  )}
                </div>

                {/* Video Transcript — only show when videoUrl is filled */}
                {videoUrlValue && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="step-transcript">
                        Video Transcript{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <span
                        className={cn(
                          'text-xs tabular-nums',
                          videoTranscriptValue.length > transcriptMax
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        )}
                      >
                        {videoTranscriptValue.length}/{transcriptMax}
                      </span>
                    </div>
                    <Textarea
                      id="step-transcript"
                      rows={4}
                      placeholder="Paste the video transcript here…"
                      {...register('videoTranscript', {
                        maxLength: {
                          value: transcriptMax,
                          message: `Transcript must be ${transcriptMax} characters or fewer`,
                        },
                      })}
                    />
                    {errors.videoTranscript && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        {errors.videoTranscript.message}
                      </p>
                    )}
                  </div>
                )}

                {/* Estimated Time */}
                <div className="space-y-1.5">
                  <Label htmlFor="step-estimated-minutes">
                    Estimated Time (minutes){' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="step-estimated-minutes"
                    type="number"
                    min="1"
                    max="999"
                    placeholder="15"
                    className="w-32"
                    {...register('estimatedMinutes', {
                      min: { value: 1, message: 'Must be at least 1 minute' },
                      max: { value: 999, message: 'Must be 999 minutes or fewer' },
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown as &apos;~15 min&apos; on the student step card
                  </p>
                  {errors.estimatedMinutes && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {errors.estimatedMinutes.message}
                    </p>
                  )}
                </div>

                {/* Checklist */}
                <DynamicListField
                  label="Your Checklist"
                  helperText="Students check these off as they complete the step"
                  items={checklistValue}
                  onChange={(items) => setValue('checklist', items, { shouldDirty: true })}
                  placeholder="e.g. Downloaded Node.js LTS from nodejs.org"
                  maxItems={20}
                  addLabel="Add checklist item"
                />

                {/* Why It Matters */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="step-why">
                      Why This Matters{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        whyItMattersValue.length > whyItMattersMax
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      )}
                    >
                      {whyItMattersValue.length}/{whyItMattersMax}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Shown in a collapsible &apos;Why this matters&apos; section with a lightbulb icon
                  </p>
                  <Textarea
                    id="step-why"
                    rows={3}
                    placeholder="e.g. Understanding Git gives you a safety net for your code…"
                    {...register('whyItMatters', {
                      maxLength: {
                        value: whyItMattersMax,
                        message: `Must be ${whyItMattersMax} characters or fewer`,
                      },
                    })}
                  />
                  {errors.whyItMatters && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {errors.whyItMatters.message}
                    </p>
                  )}
                </div>

                {/* Quick Reference Checklist */}
                <DynamicListField
                  label="Quick Reference Checklist"
                  helperText="Short checklist shown in the right sidebar (e.g. 'Open VS Code', 'Extensions panel')"
                  items={quickReferenceChecklistValue}
                  onChange={(items) =>
                    setValue('quickReferenceChecklist', items, { shouldDirty: true })
                  }
                  placeholder="e.g. Open VS Code"
                  maxItems={20}
                  addLabel="Add checklist item"
                />

                {/* Key Links */}
                <DynamicKeyLinksField
                  items={keyLinksValue}
                  onChange={(items) => setValue('keyLinks', items, { shouldDirty: true })}
                />

                {/* Step Visibility */}
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="step-active" className="text-sm font-medium cursor-pointer">
                      Active
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Active steps are visible to students in cohorts.
                    </p>
                  </div>
                  <Switch
                    id="step-active"
                    checked={isActiveValue}
                    onCheckedChange={(checked) =>
                      setValue('isActive', checked, { shouldDirty: true })
                    }
                  />
                </div>

              </div>
            </div>

            {/* Sticky form actions */}
            <div className="shrink-0 border-t border-border bg-background px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isDirty && (
                    <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <UnsavedDot />
                      Unsaved changes
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void router.push('/admin/steps')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? (isEditMode ? 'Saving…' : 'Creating…')
                      : (isEditMode ? 'Save Step' : 'Create Step')
                    }
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT: Preview panel */}
        <div
          className={cn(
            'flex flex-col overflow-hidden bg-muted/10',
            'w-full lg:w-1/2',
            mobileView === 'edit' && 'hidden lg:flex'
          )}
        >
          <PreviewPanel
            title={titleValue}
            description={descriptionValue}
            screenshotCriteria={screenshotCriteriaValue}
            videoUrl={videoUrlValue}
            stepNumber={stepNumber}
            estimatedMinutes={estimatedMinutesParsed}
            checklist={checklistValue}
            whyItMatters={whyItMattersValue}
            quickReferenceChecklist={quickReferenceChecklistValue}
            keyLinks={keyLinksValue}
            videoTranscript={videoTranscriptValue}
          />
        </div>

      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><PageContent /></Suspense>
}
