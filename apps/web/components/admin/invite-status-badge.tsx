'use client'

import { Badge } from '@/components/ui/badge'

type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | undefined

function InviteStatusBadge({ status }: { status: InviteStatus }) {
  if (!status || status === 'ACCEPTED') return null
  if (status === 'PENDING') {
    return (
      <Badge variant="warning" className="ml-1.5 text-xs">
        Awaiting Google Registration
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="ml-1.5 text-xs text-muted-foreground">
      Revoked
    </Badge>
  )
}

export { InviteStatusBadge }
export type { InviteStatus }
