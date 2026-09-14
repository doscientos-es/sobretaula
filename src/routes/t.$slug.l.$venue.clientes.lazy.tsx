import { createLazyFileRoute } from '@tanstack/react-router'

import { GuestsPage } from '@/features/guests'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/clientes')({ component: GuestsRoute })

function GuestsRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <GuestsPage tenantId={tenant.id} venueId={venue.id} />
}
