import { createFileRoute } from '@tanstack/react-router'

import { GuestsPage } from '@/features/guests'

export const Route = createFileRoute('/t/$slug/l/$venue/clientes')({ component: GuestsRoute })

function GuestsRoute() {
  const { tenant, venue } = Route.useRouteContext()
  return <GuestsPage tenantId={tenant.id} venueId={venue.id} />
}
