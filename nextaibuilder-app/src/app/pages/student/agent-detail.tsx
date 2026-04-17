// PBA-332 — Student agent detail page
// Route: /student/agents/:id

import * as React from 'react'
import { useParams, Link } from 'react-router'
import { ArrowLeft, Phone, Star, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { useStudentAgent, useActiveCall, useBookCall, type AgentReviewItem } from '@/hooks/use-student-agents'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function formatReviewerName(first: string, last: string) {
  return `${first} ${last.charAt(0)}.`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function StarDisplay({ rating, size = 'md' }: { rating: number | null; size?: 'sm' | 'md' }) {
  const value = rating ?? 0
  const cls = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            cls,
            i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-none text-muted-foreground/30'
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: AgentReviewItem }) {
  return (
    <div data-slot="review-card" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {formatReviewerName(review.reviewer.firstName, review.reviewer.lastName)}
          </span>
          <StarDisplay rating={review.rating} size="sm" />
        </div>
        <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function StudentAgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useStudentAgent(id ?? '')
  const { data: activeCallData } = useActiveCall()
  const bookCall = useBookCall()

  const agent = data?.agent
  const reviews = data?.reviews ?? []
  const activeCall = activeCallData?.call

  const hasActiveCall = Boolean(activeCall)
  const isUnavailable = agent ? !agent.isAvailableForCalls : false
  const bookingDisabled = hasActiveCall || isUnavailable || bookCall.isPending

  async function handleBook() {
    if (!agent) return
    try {
      const call = await bookCall.mutateAsync({ agentId: agent.id })
      toast.success('Call booked! Opening scheduling link…')
      // Open in new tab via anchor click (not window.open)
      const a = document.createElement('a')
      a.href = call.schedulingUrl
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.click()
    } catch (err: unknown) {
      const apiError = (err as { apiError?: { error?: string } }).apiError
      if (apiError?.error === 'ACTIVE_CALL_EXISTS') {
        toast.error('You already have an active call booking.')
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to book call')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 animate-pulse">
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-36 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
          </div>
          <div className="h-10 w-full rounded-md bg-muted" />
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-2xl text-center py-16">
        <p className="text-muted-foreground">Agent not found.</p>
        <Link to="/student/agents">
          <Button variant="outline" className="mt-4">Back to Agents</Button>
        </Link>
      </div>
    )
  }

  return (
    <div data-slot="agent-detail-page" className="mx-auto max-w-2xl space-y-6">
      {/* Back link */}
      <Link
        to="/student/agents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to agents
      </Link>

      {/* Agent hero */}
      <Card data-slot="agent-hero">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarImage src={agent.avatarUrl ?? undefined} alt={`${agent.firstName} ${agent.lastName}`} />
              <AvatarFallback className="text-lg font-medium">
                {getInitials(agent.firstName, agent.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-medium text-foreground">
                {agent.firstName} {agent.lastName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <StarDisplay rating={agent.avgRating} />
                {agent.reviewCount > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {agent.avgRating?.toFixed(1)} ({agent.reviewCount} review{agent.reviewCount !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Booking section */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            {isUnavailable && (
              <p className="text-sm text-amber-600 font-medium">
                This agent is temporarily unavailable for new bookings.
              </p>
            )}
            {hasActiveCall && !isUnavailable && (
              <p className="text-sm text-muted-foreground">
                You already have an active booking. Complete or cancel it before booking another call.
              </p>
            )}
            <Button
              className="w-full gap-2"
              disabled={bookingDisabled}
              onClick={handleBook}
            >
              {bookCall.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                  Booking…
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Book a Call
                  <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reviews */}
      {reviews.length > 0 && (
        <Card data-slot="agent-reviews">
          <CardHeader>
            <CardTitle className="text-base">Student Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 divide-y divide-border">
            {reviews.map((review) => (
              <div key={review.id} className="pt-4 first:pt-0">
                <ReviewCard review={review} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export { StudentAgentDetailPage }
