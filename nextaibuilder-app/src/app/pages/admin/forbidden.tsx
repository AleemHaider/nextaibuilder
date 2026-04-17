// PBA-236 — Admin 403 Forbidden page
// Shown when a user navigates to a route requiring a permission they don't hold.
import { ShieldOff } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Card, CardContent } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'

function AdminForbiddenPage() {
  const navigate = useNavigate()

  return (
    <div
      data-slot="admin-forbidden-page"
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6"
    >
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-10 pb-10 px-8 flex flex-col items-center gap-5">
          {/* Icon */}
          <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
            <ShieldOff className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          </div>

          {/* Heading */}
          <div className="space-y-1.5">
            <h2 className="text-xl font-medium text-foreground">Access Denied</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You don't have permission to view this page.
              Contact your administrator to request access.
            </p>
          </div>

          {/* CTA */}
          <Button
            onClick={() => navigate('/admin')}
            className="mt-2"
          >
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export { AdminForbiddenPage }
