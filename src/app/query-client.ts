import { QueryClient } from '@tanstack/react-query'

/**
 * A router instance is created per request on the server, so the cache must be
 * created per request too. Never promote this to a module-level singleton.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
      },
    },
  })
}
