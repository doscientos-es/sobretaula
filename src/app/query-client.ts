import { QueryClient } from '@tanstack/react-query'

/**
 * A router instance is created per request on the server, so the cache must be
 * created per request too. Never promote this to a module-level singleton.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Keep recent route data available during fast back/forward navigation.
        // Stale queries still revalidate in the background when they are used.
        gcTime: 10 * 60_000,
        retry: 1,
        staleTime: 30_000,
        // Route navigation and mutations already invalidate operational data.
        // Avoid surprise Vercel/Supabase calls every time the window regains focus.
        refetchOnWindowFocus: false,
      },
    },
  })
}
