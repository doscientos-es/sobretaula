import { createFileRoute, notFound } from '@tanstack/react-router'

import { getMyTimekeeping, getTimekeepingConfiguration } from '@/features/timekeeping'
import { loadVenueRouteContext } from '@/features/venues'
export const Route = createFileRoute('/t/$slug/l/$venue/fichaje')({
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
    const data = { tenantId: tenant.id, venueId: venue.id }
    const [summary, management] = await Promise.all([
      getMyTimekeeping({ data }),
      ['owner', 'manager'].includes(context.tenantMembership.role)
        ? getTimekeepingConfiguration({ data })
        : Promise.resolve(null),
    ])
    return { management, summary, tenant, venue }
  },
})
