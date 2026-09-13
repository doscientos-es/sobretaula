import { createFileRoute, notFound } from '@tanstack/react-router'

import { getMyTimekeeping, getTimekeepingConfiguration } from '@/features/timekeeping'
import { TimekeepingPage } from '@/features/timekeeping/ui/timekeeping-page'
import { loadVenueRouteContext } from '@/features/venues'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'
export const Route = createFileRoute('/t/$slug/l/$venue/fichaje')({
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(params.slug, params.venue)
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
  component: TimekeepingRoute,
})
function TimekeepingRoute() {
  const { tenantMembership } = Route.useRouteContext()
  const { management, summary, tenant, venue } = Route.useLoaderData()
  const reload = useLoaderReload()
  return (
    <TimekeepingPage
      summary={summary}
      management={management}
      employeeId={tenantMembership.userId}
      tenantId={tenant.id}
      venueId={venue.id}
      onDone={reload}
    />
  )
}
