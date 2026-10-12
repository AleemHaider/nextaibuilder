'use client'
// sdk.nextaibuilder.com — Admin view of physical course admission applications

import * as React from 'react'
import { ChevronLeft, ChevronRight, ClipboardList, Mail, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { useAdminAdmissions, type AdmissionTrack } from '@/hooks/use-admin-admissions'

function TrackBadge({ track }: { track: AdmissionTrack | null }) {
  if (!track) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <Badge variant="outline">
      {track === '6-month' ? '6-Month' : '1-Year'}
    </Badge>
  )
}

const PAGE_LIMIT = 20

export default function Page() {
  const [page, setPage] = React.useState(1)
  const { data, isLoading } = useAdminAdmissions(page, PAGE_LIMIT)

  const applications = data?.applications ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground">Admissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Applications submitted through the physical course landing page (sdk.nextaibuilder.com).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applications{data ? ` (${data.total})` : ''}</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-3 px-6 pb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28 flex-1" />
                </div>
              ))}
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[160px] text-center px-6 pb-6">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
                <ClipboardList className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground">No applications yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Submissions from the admission form will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Admission applications">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2.5 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                      <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Contact</th>
                      <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Track</th>
                      <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground">Message</th>
                      <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-muted-foreground">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr
                        key={app.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors align-top"
                      >
                        <td className="py-3 pl-6 pr-3">
                          <span className="text-sm font-medium text-foreground">{app.fullName}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 text-sm text-foreground">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                              {app.email}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              {app.phone}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <TrackBadge track={app.track} />
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm text-muted-foreground line-clamp-2 max-w-[320px] block">
                            {app.message || '—'}
                          </span>
                        </td>
                        <td className="py-3 pl-3 pr-6 text-right text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(app.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
