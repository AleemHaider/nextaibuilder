// PBA-331 — Student agent listing page
// Route: /student/agents

import * as React from 'react'
import { Search, Phone, Star, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { useStudentAgents, useActiveCall, type AgentSummary } from '@/hooks/use-student-agents'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function StarDisplay({ rating }: { rating: number | null }) {
  const value = rating ?? 0
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-none text-muted-foreground/30'
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

// ── Active call banner ────────────────────────────────────────────────────────

function ActiveCallBanner() {
  const { data } = useActiveCall()
  const call = data?.call

  if (!call) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Phone className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            You have an active booking with {call.agentId.firstName} {call.agentId.lastName}
          </p>
          <p className="text-xs text-amber-600">Use your scheduling link to book your time slot.</p>
        </div>
      </div>
      <a
        href={call.schedulingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
      >
        <Button size="sm" variant="outline" className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Open Scheduling Link
        </Button>
      </a>
    </div>
  )
}

// ── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentSummary }) {
  return (
    <Link
      to={`/student/agents/${agent.id}`}
      data-slot="agent-card"
      className="block rounded-xl border border-border bg-card p-4 space-y-3 hover:shadow-sm hover:border-muted-foreground/20 transition-all"
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage src={agent.avatarUrl ?? undefined} alt={`${agent.firstName} ${agent.lastName}`} />
          <AvatarFallback className="text-sm font-medium">
            {getInitials(agent.firstName, agent.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {agent.firstName} {agent.lastName}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <StarDisplay rating={agent.avgRating} />
            {agent.reviewCount > 0 && (
              <span className="text-xs text-muted-foreground">({agent.reviewCount})</span>
            )}
          </div>
        </div>
      </div>
      <Button size="sm" className="w-full gap-2" type="button" asChild>
        <span>
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          Book a Call
        </span>
      </Button>
    </Link>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function AgentCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 w-28 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
      </div>
      <div className="h-8 w-full rounded-md bg-muted" />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function StudentAgentsPage() {
  const [searchInput, setSearchInput] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    document.title = 'Book a Call — Setup Companion'
  }, [])

  // Debounce 300ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading } = useStudentAgents(debouncedSearch, page, 12)
  const agents = data?.agents ?? []
  const totalPages = data?.pagination.totalPages ?? 1

  return (
    <div data-slot="student-agents-page" className="mx-auto max-w-4xl space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-medium text-foreground">Book a 15-Min Call</h1>
        </div>
        <p className="mt-1 pl-12 text-sm text-muted-foreground">
          Get live support from one of our coaches. Select an agent and book your time slot.
        </p>
      </div>

      {/* Active call banner */}
      <ActiveCallBanner />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          placeholder="Search by name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search support agents"
        />
      </div>

      {/* Agent grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <AgentCardSkeleton key={i} />)}
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Phone className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">No agents available</p>
            <p className="text-xs text-muted-foreground">
              {debouncedSearch ? 'No agents match your search.' : 'Check back later for available support agents.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}

export { StudentAgentsPage }
