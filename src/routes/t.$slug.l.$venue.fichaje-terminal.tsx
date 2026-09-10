import { createFileRoute } from '@tanstack/react-router'

import { getTimekeepingTerminalStaff } from '@/features/timekeeping'
import { TimekeepingTerminalPage } from '@/features/timekeeping/ui/timekeeping-terminal-page'

export const Route = createFileRoute('/t/$slug/l/$venue/fichaje-terminal')({
  loader: ({ context }) =>
    getTimekeepingTerminalStaff({
      data: { tenantId: context.tenant.id, venueId: context.venue.id },
    }),
  component: TimekeepingTerminalRoute,
})

function TimekeepingTerminalRoute() {
  const { tenant, venue } = Route.useRouteContext()
  return (
    <TimekeepingTerminalPage
      staff={Route.useLoaderData()}
      tenantId={tenant.id}
      venueId={venue.id}
    />
  )
}
