import { createLazyFileRoute } from '@tanstack/react-router'

import { TimekeepingPage } from '@/features/timekeeping/ui/timekeeping-page'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/fichaje')({
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
