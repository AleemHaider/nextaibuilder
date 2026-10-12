'use client'

import { cn } from '@/lib/utils'

interface AuthShellProps {
  children: React.ReactNode
  /** Max width of the card — defaults to sm (384px) */
  maxWidth?: 'xs' | 'sm' | 'md'
  className?: string
}

function AuthShell({ children, maxWidth = 'sm', className }: AuthShellProps) {
  const widthClass = { xs: 'max-w-xs', sm: 'max-w-sm', md: 'max-w-md' }[maxWidth]
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 py-12">
      <div
        data-slot="auth-shell"
        className={cn(
          'w-full bg-card rounded-xl border border-black/[0.08]',
          'shadow-[0px_4px_12px_rgba(0,0,0,0.08)] px-8 py-10 sm:px-10',
          widthClass,
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

export { AuthShell }
