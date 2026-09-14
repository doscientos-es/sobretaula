import { createLazyFileRoute } from '@tanstack/react-router'

import { TimekeepingTerminalPage } from '@/features/timekeeping/ui/timekeeping-terminal-page'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/fichaje-terminal')({
  component: TimekeepingTerminalRoute,
})

function TimekeepingTerminalRoute() {
  const { staff, tenant, venue } = Route.useLoaderData()
  return <TimekeepingTerminalPage staff={staff} tenantId={tenant.id} venueId={venue.id} />
}
