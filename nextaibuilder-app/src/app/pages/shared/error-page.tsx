
import { Link, useRouteError, isRouteErrorResponse } from 'react-router'
import { Home, RefreshCw } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Logo } from '@/app/components/ui/logo'

interface ErrorConfig {
  code: number
  title: string
  description: string
}

function getErrorConfig(error: unknown): ErrorConfig {
  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      return {
        code: 403,
        title: 'Access denied',
        description: "You don't have permission to view this page. Contact your administrator if you think this is a mistake.",
      }
    }
    if (error.status === 404) {
      return {
        code: 404,
        title: 'Page not found',
        description: "The page you're looking for doesn't exist or has been moved.",
      }
    }
  }
  return {
    code: 500,
    title: 'Something went wrong',
    description: "We're experiencing a technical issue. Our team has been notified. Please try again in a moment.",
  }
}

function ErrorPage() {
  const error = useRouteError()
const { code, title, description } = getErrorConfig(error)

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <Logo variant="icon" size="md" className="mb-8" />

      {/* Error code illustration */}
      <div className="mb-8">
        <svg width="200" height="120" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <text x="50%" y="80" textAnchor="middle" fontFamily="Inter, sans-serif"
            fontSize="96" fontWeight="700" fill="#ececf0">
            {code}
          </text>
          <path d="M 20 60 C 40 40, 80 70, 100 55 C 120 40, 160 65, 180 55"
            stroke={code === 500 ? '#ff8c5a' : '#4a9ad4'} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.4"/>
          <path d="M 20 72 C 40 52, 80 82, 100 67 C 120 52, 160 77, 180 67"
            stroke={code === 500 ? '#d73027' : '#7bb8e0'} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.3"/>
        </svg>
      </div>

      <h1 className="text-2xl font-medium text-foreground mb-3">{title}</h1>
      <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mb-8">{description}</p>

      <div className="flex items-center gap-3">
        <Button variant="default" asChild>
          <Link to="/">
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </Button>
        {code === 500 && (
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}

export { ErrorPage }
