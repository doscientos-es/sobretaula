import { createFileRoute, notFound } from '@tanstack/react-router'

import { getTimekeepingTerminalStaff } from '@/features/timekeeping'
import { TimekeepingTerminalPage } from '@/features/timekeeping/ui/timekeeping-terminal-page'
import { loadVenueRouteContext } from '@/features/venues'

export const Route = createFileRoute('/t/$slug/l/$venue/fichaje-terminal')({
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
    return {
      staff: await getTimekeepingTerminalStaff({
        data: { tenantId: tenant.id, venueId: venue.id },
      }),
      tenant,
      venue,
    }
  },
  component: TimekeepingTerminalRoute,
})

function TimekeepingTerminalRoute() {
  const { staff, tenant, venue } = Route.useLoaderData()
  return <TimekeepingTerminalPage staff={staff} tenantId={tenant.id} venueId={venue.id} />
}
