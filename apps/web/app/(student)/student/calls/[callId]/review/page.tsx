'use client'

// PBA-333 — Student call review page
// Route: /student/calls/:callId/review

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Star, CheckCircle, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useSubmitCallReview } from '@/hooks/use-student-agents'
import { apiFetch } from '@/store/auth'
import { usePageMeta } from '@/hooks/use-page-meta'

// ── Star picker ───────────────────────────────────────────────────────────────

interface StarPickerProps {
  value: number
  onChange: (v: number) => void
}

function StarPicker({ value, onChange }: StarPickerProps) {
  const [hovered, setHovered] = React.useState(0)

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Star rating">
      {Array.from({ length: 5 }).map((_, i) => {
        const star = i + 1
        const filled = star <= (hovered || value)
        return (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <Star
              className={cn(
                'h-8 w-8 transition-colors',
                filled ? 'fill-amber-400 text-amber-400' : 'fill-none text-muted-foreground/30 hover:text-amber-300'
              )}
              aria-hidden="true"
            />
          </button>
        )
      })}
      {value > 0 && (
        <span className="ml-2 text-sm text-muted-foreground">
          {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][value]}
        </span>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'form' | 'already_reviewed' | 'not_found' | 'success'

export default function Page() {
  const params = useParams<{ callId: string }>()
  const callId = params?.callId
  const router = useRouter()
  const submitReview = useSubmitCallReview(callId ?? '')

  const [pageState, setPageState] = React.useState<PageState>('loading')
  const [rating, setRating] = React.useState(0)
  const [comment, setComment] = React.useState('')
  const [ratingError, setRatingError] = React.useState<string | null>(null)

  usePageMeta({ title: 'Leave a Review — Setup Companion' })

  React.useEffect(() => {
    if (!callId) { router.replace('/student/agents'); return }

    // Verify call is COMPLETED and belongs to student
    apiFetch<{ call: { _id: string; status: string; studentId: string } | null }>(`/api/student/calls/active`)
      .then(() => {
        // The active call endpoint doesn't give us the specific call detail.
        // We'll validate on submit — just show the form now.
        setPageState('form')
      })
      .catch(() => setPageState('form'))
  }, [callId, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) { setRatingError('Please select a rating.'); return }
    setRatingError(null)

    try {
      await submitReview.mutateAsync({ rating, comment: comment.trim() || '(No comment provided)' })
      setPageState('success')
      toast.success('Review submitted!')
      setTimeout(() => router.push('/student/agents'), 2000)
    } catch (err: unknown) {
      const apiError = (err as { apiError?: { error?: string } }).apiError
      if (apiError?.error === 'REVIEW_ALREADY_SUBMITTED') {
        setPageState('already_reviewed')
      } else if (apiError?.error === 'CALL_NOT_COMPLETED') {
        toast.error('This call has not been completed yet.')
        router.replace('/student/agents')
      } else if (apiError?.error === 'NOT_FOUND') {
        setPageState('not_found')
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to submit review')
      }
    }
  }

  function handleSkip() {
    router.push('/student/agents')
  }

  if (pageState === 'loading') {
    return (
      <div className="mx-auto max-w-lg animate-pulse space-y-4">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="h-48 w-full rounded-xl bg-muted" />
      </div>
    )
  }

  if (pageState === 'not_found') {
    return (
      <div className="mx-auto max-w-lg text-center py-16">
        <p className="text-muted-foreground">Call not found or you don&apos;t have permission to review it.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/student/agents')}>
          Back to Agents
        </Button>
      </div>
    )
  }

  if (pageState === 'already_reviewed') {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted mx-auto mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
            </div>
            <CardTitle className="text-center text-base">Already Reviewed</CardTitle>
            <CardDescription className="text-center">
              You have already submitted a review for this call. Thank you for your feedback!
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => router.push('/student/agents')} className="gap-2">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              Back to Agents
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (pageState === 'success') {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 mx-auto mb-2">
              <CheckCircle className="h-6 w-6 text-green-600" aria-hidden="true" />
            </div>
            <CardTitle className="text-center text-lg">Review Submitted!</CardTitle>
            <CardDescription className="text-center">
              Thank you for your feedback. Redirecting you back to agents…
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Form state
  return (
    <div data-slot="call-review-page" className="mx-auto max-w-lg space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Star className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-medium text-foreground">Leave a Review</h1>
        </div>
        <p className="mt-1 pl-12 text-sm text-muted-foreground">
          Share your experience to help other students find the right support.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Star rating */}
            <div className="space-y-2">
              <Label>Your Rating</Label>
              <StarPicker value={rating} onChange={setRating} />
              {ratingError && <p className="text-xs text-destructive">{ratingError}</p>}
            </div>

            {/* Comment */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="review-comment">Comment <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <span className="text-xs text-muted-foreground">{comment.length}/500</span>
              </div>
              <textarea
                id="review-comment"
                placeholder="How was your experience? Was the agent helpful?"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={4}
                className={cn(
                  'w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'resize-none',
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={submitReview.isPending}
                className="flex-1"
              >
                Skip
              </Button>
              <Button
                type="submit"
                disabled={submitReview.isPending || rating === 0}
                className="flex-1 gap-2"
              >
                {submitReview.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Submitting…
                  </>
                ) : (
                  'Submit Review'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
