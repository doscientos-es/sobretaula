import { createFileRoute } from '@tanstack/react-router'

import { getMyTimekeeping, getTimekeepingConfiguration } from '@/features/timekeeping'
import { TimekeepingPage } from '@/features/timekeeping/ui/timekeeping-page'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'
export const Route = createFileRoute('/t/$slug/l/$venue/fichaje')({
  loader: async ({ context }) => {
    const data = { tenantId: context.tenant.id, venueId: context.venue.id }
    const [summary, management] = await Promise.all([
      getMyTimekeeping({ data }),
      ['owner', 'manager'].includes(context.tenantMembership.role)
        ? getTimekeepingConfiguration({ data })
        : Promise.resolve(null),
    ])
    return { management, summary }
  },
  component: TimekeepingRoute,
})
function TimekeepingRoute() {
  const { tenant, tenantMembership, venue } = Route.useRouteContext()
  const { management, summary } = Route.useLoaderData()
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
