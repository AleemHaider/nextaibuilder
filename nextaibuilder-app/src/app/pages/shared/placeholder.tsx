

interface PlaceholderPageProps {
  title: string
  description?: string
}

/**
 * Temporary placeholder for pages not yet implemented.
 * Replace with real page components as each epic is built out.
 */
function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6">
      <div className="mb-6">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="8" width="48" height="48" rx="12" fill="#ececf0"/>
          <rect x="18" y="24" width="28" height="4" rx="2" fill="#cbced4"/>
          <rect x="18" y="34" width="20" height="4" rx="2" fill="#cbced4"/>
        </svg>
      </div>
      <h2 className="text-lg font-medium text-foreground mb-2">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      <span className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-md px-2.5 py-1">
        Coming soon
      </span>
    </div>
  )
}

export { PlaceholderPage }
