// PBA-143 — React Query client (shared singleton)
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,      // 30s before refetch
      gcTime: 5 * 60 * 1000,    // 5min cache
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})
