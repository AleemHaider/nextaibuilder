'use client'

// PBA-276 — Shared StepBottomCTA component
// Handles ALL step statuses including OVERRIDE_PASS and OVERRIDE_FAIL
import { ArrowRight, Lock, Play, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { StepStatus } from '@/lib/api-client'

interface StepBottomCTAProps {
  status: StepStatus | 'UNLOCKED'
  nextStepId?: string | null
  /** Called when the upload button is clicked (student view) */
  onUploadClick?: () => void
  /** Called to navigate to next step or back to dashboard */
  onNavigate?: (stepId: string | null) => void
}

function StepBottomCTA({
  status,
  nextStepId,
  onUploadClick,
  onNavigate,
}: StepBottomCTAProps) {
  switch (status) {
    case 'UNLOCKED':
    case 'IN_PROGRESS':
      return onUploadClick ? (
        <Button className="w-full" onClick={onUploadClick}>
          <Play className="mr-2 h-4 w-4" />
          Upload Screenshot
        </Button>
      ) : (
        // Preview mode — disabled visual
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#ff8c5a] px-4 py-2.5 text-sm font-medium text-white opacity-90 cursor-not-allowed"
        >
          <Upload className="h-4 w-4" />
          Upload Screenshot
        </button>
      )

    case 'PENDING_REVIEW':
      return (
        <Button className="w-full" disabled variant="outline">
          Submitted — awaiting review
        </Button>
      )

    case 'COMPLETE':
    case 'OVERRIDE_PASS':
      if (!onNavigate) {
        // Preview mode
        return (
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white cursor-not-allowed opacity-90"
          >
            Next Step
            <ArrowRight className="h-4 w-4" />
          </button>
        )
      }
      return nextStepId ? (
        <Button className="w-full" onClick={() => onNavigate(nextStepId)}>
          Continue to Next Step
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      ) : (
        <Button className="w-full" onClick={() => onNavigate(null)}>
          Back to Dashboard
        </Button>
      )

    case 'OVERRIDE_FAIL':
      return onUploadClick ? (
        <Button className="w-full" onClick={onUploadClick}>
          <Upload className="mr-2 h-4 w-4" />
          Re-upload Screenshot
        </Button>
      ) : (
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#ff8c5a] px-4 py-2.5 text-sm font-medium text-white opacity-90 cursor-not-allowed"
        >
          <Upload className="h-4 w-4" />
          Re-upload Screenshot
        </button>
      )

    case 'LOCKED':
    default:
      return (
        <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground py-2.5">
          <Lock className="h-4 w-4" />
          Complete the previous step to unlock this one.
        </p>
      )
  }
}

export { StepBottomCTA }
