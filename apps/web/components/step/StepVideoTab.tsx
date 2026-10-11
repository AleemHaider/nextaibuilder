'use client'

// PBA-276 — Shared StepVideoTab component
// Updated: follow-along instruction box + video transcript collapsible
import { useState } from 'react'
import { ChevronDown, ChevronRight, Play, Video } from 'lucide-react'
import { extractLoomId } from '@/lib/step-utils'

interface StepVideoTabProps {
  videoUrl: string | null
  videoTranscript?: string | null
  /** Optional callback to navigate back to instructions (used in student view) */
  onBackToInstructions?: () => void
}

// ── Transcript collapsible ────────────────────────────────────────────────────

function VideoTranscript({ content }: { content: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>Video transcript</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

function StepVideoTab({ videoUrl, videoTranscript, onBackToInstructions }: StepVideoTabProps) {
  if (!videoUrl) {
    return (
      <div className="flex flex-col items-center space-y-3 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Video className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Video coming soon</p>
        <p className="text-xs text-muted-foreground">
          Add a Loom video URL in the editor to preview it here.
        </p>
        {onBackToInstructions && (
          <button
            type="button"
            onClick={onBackToInstructions}
            className="text-sm text-[#4a9ad4] hover:underline"
          >
            Back to written instructions
          </button>
        )}
      </div>
    )
  }

  const loomId = extractLoomId(videoUrl)
  const embedUrl = loomId
    ? `https://www.loom.com/embed/${loomId}?hide_share=true&hideEmbedTopBar=true&hide_owner=true`
    : videoUrl

  // If the URL is not a valid Loom URL, show a placeholder
  if (!loomId) {
    return (
      <div className="flex flex-col items-center space-y-3 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Play className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Video coming soon</p>
        <p className="text-xs text-muted-foreground">
          Enter a valid Loom URL to see the embed preview.
        </p>
      </div>
    )
  }

  return (
    <div data-slot="step-video-tab" className="space-y-4">
      {/* Video player */}
      <div className="relative w-full overflow-hidden rounded-xl bg-[#060d1f]" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={embedUrl}
          className="absolute inset-0 h-full w-full border-0"
          allowFullScreen
          title="Step walkthrough video"
        />
      </div>

      {/* Follow along instruction box */}
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
        <span className="font-semibold">Follow along</span>
        {' '}with the video to complete this step, then verify your setup in the next tab when you&apos;re done.
      </div>

      {/* Video transcript collapsible */}
      {videoTranscript && <VideoTranscript content={videoTranscript} />}

      {onBackToInstructions && (
        <button
          type="button"
          onClick={onBackToInstructions}
          className="text-sm text-[#4a9ad4] hover:underline"
        >
          Ready? Follow the written instructions above.
        </button>
      )}
    </div>
  )
}

export { StepVideoTab }
