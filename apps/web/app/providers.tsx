'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useInitAuth } from '@/hooks/use-auth'
// Shared singleton so the auth store's logout/session-clear paths can purge the
// same cache the app reads from (see store/auth.ts clearAuth).
import { queryClient } from '@/lib/query-client'

function AuthBootstrap() {
  useInitAuth()
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      {children}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  )
}
