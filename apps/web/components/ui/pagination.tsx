'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
  /** Show individual page number buttons (default: true for ≤7 pages) */
  showPageNumbers?: boolean
}

function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
  showPageNumbers,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const show = showPageNumbers ?? totalPages <= 7

  const pages = show
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : null

  return (
    <div
      data-slot="pagination"
      className={cn('flex items-center justify-center gap-1', className)}
      aria-label="Pagination"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages ? (
        pages.map((p) => (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className="h-8 w-8 p-0"
          >
            {p}
          </Button>
        ))
      ) : (
        <span className="text-sm text-muted-foreground px-2">
          {page} / {totalPages}
        </span>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

export { Pagination }
