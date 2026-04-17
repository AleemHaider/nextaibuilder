/* eslint-disable react-refresh/only-export-components -- entry point, no exports by design */
// PBA-142 — App entry: bootstraps auth session on load
// PBA-143 — Adds React Query provider
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './app/router'
import { useInitAuth, useAuth } from './hooks/use-auth'
import { queryClient } from './lib/query-client'
import './styles/index.css'

// Thin wrapper so we can call hooks before router renders
function AppRoot() {
  useInitAuth() // attempts to restore session from httpOnly refresh cookie
  const { isLoading } = useAuth()

  // Block the entire router until the session restore attempt completes.
  // This prevents any route (including login pages) from flashing before
  // auth state is known.
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRoot />
    </QueryClientProvider>
  </StrictMode>,
)
