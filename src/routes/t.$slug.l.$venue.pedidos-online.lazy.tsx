import { createLazyFileRoute } from '@tanstack/react-router'

import { OnlineOrdersPage } from '@/features/online-ordering'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/pedidos-online')({
  component: OnlineOrdersRoute,
})

function OnlineOrdersRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <OnlineOrdersPage tenantId={tenant.id} venueId={venue.id} />
}
