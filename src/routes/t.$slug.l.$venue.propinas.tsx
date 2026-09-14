import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { getTipsOverview } from '@/features/tips'
import { loadVenueRouteContext } from '@/features/venues'

export const Route = createFileRoute('/t/$slug/l/$venue/propinas')({
  validateSearch: z.object({ page: z.number().int().min(1).default(1) }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context, deps, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
    return {
      overview: await getTipsOverview({
        data: { tenantId: tenant.id, venueId: venue.id, page: deps.page, pageSize: 25 },
      }),
      tenant,
      venue,
    }
  },
})
