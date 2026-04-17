
import { Link } from 'react-router'
import { Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Logo } from '@/app/components/ui/logo'

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <Logo variant="icon" size="md" className="mb-8" />

      {/* 404 illustration */}
      <div className="mb-8">
        <svg width="200" height="120" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <text x="50%" y="80" textAnchor="middle" fontFamily="Inter, sans-serif"
            fontSize="96" fontWeight="700" fill="#ececf0">
            404
          </text>
          {/* Brand ribbon accent across the 404 */}
          <path d="M 20 60 C 40 40, 80 70, 100 55 C 120 40, 160 65, 180 55"
            stroke="#4a9ad4" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.4"/>
          <path d="M 20 72 C 40 52, 80 82, 100 67 C 120 52, 160 77, 180 67"
            stroke="#7bb8e0" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.3"/>
        </svg>
      </div>

      <h1 className="text-2xl font-medium text-foreground mb-3">Page not found</h1>
      <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="flex items-center gap-3">
        <Button variant="default" asChild>
          <Link to="/">
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Button>
      </div>
    </div>
  )
}

export { NotFoundPage }
