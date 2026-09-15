import { createFileRoute } from '@tanstack/react-router'

import { OnlineOrdersPage } from '@/features/online-ordering'
export const Route = createFileRoute('/t/$slug/l/$venue/pedidos-online')({
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
  component: OnlineOrdersRoute,
})
function OnlineOrdersRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <OnlineOrdersPage tenantId={tenant.id} venueId={venue.id} />
}
