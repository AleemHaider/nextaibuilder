'use client'

// PBA-276 — Shared StepVerifyTab component (upload zone placeholder for preview contexts)
import { Upload } from 'lucide-react'

interface StepVerifyTabProps {
  screenshotCriteria: string
}

function StepVerifyTab({ screenshotCriteria }: StepVerifyTabProps) {
  return (
    <div data-slot="step-verify-tab" className="space-y-4">
      {/* Screenshot criteria reminder */}
      {screenshotCriteria && (
        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Screenshot must show: </span>
          {screenshotCriteria}
        </div>
      )}

      {/* Upload dropzone (non-functional preview) */}
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center">
        <Upload className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">Drag &amp; drop your screenshot here</p>
          <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP — max 10MB</p>
      </div>
    </div>
  )
}

export { StepVerifyTab }
