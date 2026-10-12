'use client'

// PBA-316 — AI Troubleshooter panel
// PBA-375 — Screenshot attachment via paperclip button (presign → S3 PUT → s3Key in send)
// Collapsible chat panel shown below failed/flagged submission feedback.
// Uses SSE streaming to display Claude Haiku responses in real time.
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { ChevronDown, ChevronUp, Sparkles, Send, Paperclip, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTroubleshootHistory, useTroubleshooter } from '@/hooks/use-troubleshooter'
import { troubleshootApi, type AiMessage } from '@/lib/api-client'

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024 // 2 MB

// ── Streaming animated dots ───────────────────────────────────────────────────

function StreamingDots() {
  return (
    <span className="flex gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#717182] animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}

// ── Markdown renderer for assistant messages ─────────────────────────────────

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        // Paragraphs
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        // Bold
        strong: ({ children }) => (
          <strong className="font-semibold text-[#1a2744]">{children}</strong>
        ),
        // Italic
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        // Ordered list (numbered steps)
        ol: ({ children }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
        ),
        // Unordered list (bullet points)
        ul: ({ children }) => (
          <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        // Inline code
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <pre className="my-2 overflow-x-auto rounded-md bg-[#1a2744]/8 px-3 py-2 text-xs font-mono text-[#1a2744]">
                <code>{children}</code>
              </pre>
            )
          }
          return (
            <code className="rounded bg-[#1a2744]/10 px-1.5 py-0.5 font-mono text-xs text-[#1a2744]">
              {children}
            </code>
          )
        },
        // Headings (Claude sometimes uses these)
        h3: ({ children }) => (
          <h3 className="mb-1 mt-3 text-sm font-semibold text-[#1a2744] first:mt-0">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="mb-1 mt-2 text-sm font-medium text-[#1a2744] first:mt-0">{children}</h4>
        ),
        // Horizontal rule
        hr: () => <hr className="my-2 border-black/10" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: AiMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-[#1a2744] text-white'
            : 'rounded-bl-sm bg-[#f3f3f5] text-[#1a2744]',
        )}
      >
        {isUser ? (
          message.content
        ) : (
          <AssistantMarkdown content={message.content} />
        )}
      </div>
    </div>
  )
}

// ── Main panel component ──────────────────────────────────────────────────────

interface TroubleshooterPanelProps {
  stepId: string
  submissionId: string
  className?: string
}

export function TroubleshooterPanel({ stepId, submissionId, className }: TroubleshooterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // PBA-375: attachment state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null)
  const [attachmentS3Key, setAttachmentS3Key] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const { data: history, isLoading: historyLoading } = useTroubleshootHistory(stepId)
  const {
    messages,
    setMessages,
    streamingContent,
    isStreaming,
    error: streamError,
    sendMessage,
    isRateLimited,
  } = useTroubleshooter(stepId)

  // Populate messages from history when history loads and panel first expands
  useEffect(() => {
    if (isExpanded && history?.messages && messages.length === 0) {
      setMessages(
        history.messages.map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      )
    }
  }, [isExpanded, history, messages.length, setMessages])

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent, isExpanded])

  // Revoke object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl)
    }
  }, [attachmentPreviewUrl])

  // ── Attachment handlers ──────────────────────────────────────────────────

  function handlePaperclipClick() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset input so the same file can be re-selected after clearing
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('Image must be 2 MB or smaller.')
      return
    }

    const allowed: string[] = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('Only PNG, JPEG, and WebP images are supported.')
      return
    }

    // Show local preview immediately while uploading
    const preview = URL.createObjectURL(file)
    setAttachmentFile(file)
    setAttachmentPreviewUrl(preview)
    setAttachmentS3Key(null)
    setIsUploading(true)

    try {
      const contentType = file.type as 'image/png' | 'image/jpeg' | 'image/webp'
      const { data, error } = await troubleshootApi.presignUpload(stepId, contentType)
      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to get upload URL.')
      }

      const putRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      })
      if (!putRes.ok) {
        throw new Error(`Upload failed: ${putRes.status}`)
      }

      setAttachmentS3Key(data.s3Key)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload image.')
      clearAttachment()
    } finally {
      setIsUploading(false)
    }
  }

  function clearAttachment() {
    if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl)
    setAttachmentFile(null)
    setAttachmentPreviewUrl(null)
    setAttachmentS3Key(null)
    setIsUploading(false)
  }

  // ── Send handler ─────────────────────────────────────────────────────────

  function handleSend() {
    const trimmed = inputValue.trim()
    if (!trimmed || isStreaming || isRateLimited || isUploading) return
    const s3Key = attachmentS3Key ?? undefined
    setInputValue('')
    clearAttachment()
    void sendMessage(trimmed, submissionId, s3Key)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const charCount = inputValue.length
  const hasMessages = messages.length > 0 || !!streamingContent
  const isSendDisabled = isStreaming || isRateLimited || !inputValue.trim() || isUploading

  return (
    <div
      data-slot="troubleshooter-panel"
      className={cn('rounded-xl border border-black/10 overflow-hidden', className)}
    >
      {/* ── Header / toggle button ── */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center justify-between bg-[#eff6ff] px-5 py-3.5 text-left transition-colors hover:bg-[#dbeafe]"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-[#4a9ad4]" aria-hidden="true" />
          <span className="text-[14px] font-medium text-[#1a2744]">AI Troubleshooter</span>
          <span className="rounded-md bg-[#e9ebef] px-2 py-0.5 text-xs text-[#717182]">
            Powered by Claude
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-[#717182]" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#717182]" aria-hidden="true" />
        )}
      </button>

      {/* ── Expanded panel ── */}
      {isExpanded && (
        <div className="flex flex-col bg-white">
          {/* ── Rate limit banner ── */}
          {isRateLimited && (
            <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You have reached the hourly limit (10 requests). Try again in an hour.
            </div>
          )}

          {/* ── Message area ── */}
          <div
            className="flex max-h-[400px] flex-col gap-3 overflow-y-auto px-5 py-5"
            aria-live="polite"
            aria-label="Troubleshooter conversation"
          >
            {/* Empty state */}
            {!hasMessages && !historyLoading && !streamError && (
              <p className="text-center text-sm text-[#717182]">
                Describe your issue and I will help you troubleshoot.
                <br />
                You can also attach a screenshot using the paperclip icon below.
              </p>
            )}

            {/* Loading history skeleton */}
            {historyLoading && messages.length === 0 && (
              <div className="flex flex-col gap-2 animate-pulse">
                <div className="h-8 w-3/4 rounded-xl bg-[#f3f3f5]" />
                <div className="ml-auto h-8 w-1/2 rounded-xl bg-[#e5eaf2]" />
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}

            {/* Streaming in-progress assistant bubble */}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl rounded-bl-sm bg-[#f3f3f5] px-4 py-3 text-sm text-[#1a2744]">
                  {streamingContent ? (
                    <AssistantMarkdown content={streamingContent} />
                  ) : (
                    <StreamingDots />
                  )}
                </div>
              </div>
            )}

            {/* Error state */}
            {streamError && !isStreaming && (
              <p className="text-center text-sm text-destructive">{streamError}</p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-black/[0.06]" />

          {/* ── Input area ── */}
          <div className="px-4 py-4">
            <div className="relative flex flex-col gap-2">

              {/* PBA-375: Attachment thumbnail preview */}
              {attachmentPreviewUrl && (
                <div className="relative inline-flex w-fit">
                  <img
                    src={attachmentPreviewUrl}
                    alt={attachmentFile?.name ?? 'Attached screenshot'}
                    className={cn(
                      'h-16 w-16 rounded-md border border-black/10 object-cover',
                      isUploading && 'opacity-50',
                    )}
                  />
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-white/60">
                      <span className="text-xs text-[#717182]">Uploading…</span>
                    </div>
                  )}
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={clearAttachment}
                      aria-label="Remove attachment"
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#1a2744] text-white hover:bg-[#2d3f6b]"
                    >
                      <X className="h-2.5 w-2.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}

              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming || isRateLimited}
                placeholder="Describe your issue..."
                maxLength={2000}
                rows={2}
                className={cn(
                  'w-full resize-none rounded-md border border-transparent bg-[#f3f3f5]',
                  'px-3 py-2 text-sm text-[#1a2744] placeholder:text-[#717182]',
                  'focus:border-[#4a9ad4] focus:outline-none focus:ring-2 focus:ring-[#4a9ad4]/20',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'transition-all',
                )}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#717182]">
                    {charCount}/2000
                  </span>

                  {/* PBA-375: Paperclip / attach button */}
                  <button
                    type="button"
                    onClick={handlePaperclipClick}
                    disabled={isStreaming || isRateLimited || isUploading}
                    aria-label="Attach screenshot"
                    title="Attach a screenshot (PNG, JPEG, WebP — max 2 MB)"
                    className={cn(
                      'inline-flex items-center justify-center rounded-md p-1.5',
                      'text-[#717182] transition-colors hover:bg-[#f3f3f5] hover:text-[#1a2744]',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                      attachmentFile && !isUploading && 'text-[#4a9ad4]',
                    )}
                  >
                    <Paperclip className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSendDisabled}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md bg-[#030213] px-4 py-1.5',
                    'text-sm font-medium text-white transition-opacity',
                    'hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40',
                  )}
                >
                  Send
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PBA-375: Hidden file input — triggered by paperclip button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={handleFileSelected}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  )
}
