import { createFileRoute, notFound } from '@tanstack/react-router'

import { loadVenueRouteContext } from '@/features/venues'

export const Route = createFileRoute('/t/$slug/l/$venue/clientes')({
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    return routeContext
  },
})
