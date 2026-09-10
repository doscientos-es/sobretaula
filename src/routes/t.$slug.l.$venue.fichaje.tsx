import { createFileRoute } from '@tanstack/react-router'

import { getMyTimekeeping } from '@/features/timekeeping'
import { TimekeepingPage } from '@/features/timekeeping/ui/timekeeping-page'
export const Route = createFileRoute('/t/$slug/l/$venue/fichaje')({
  loader: ({ context }) =>
    getMyTimekeeping({ data: { tenantId: context.tenant.id, venueId: context.venue.id } }),
  component: TimekeepingRoute,
})
function TimekeepingRoute() {
  const { tenant, venue } = Route.useRouteContext()
  const summary = Route.useLoaderData()
  return (
    <TimekeepingPage
      summary={summary}
      tenantId={tenant.id}
      venueId={venue.id}
      onDone={() => window.location.reload()}
    />
  )
}
