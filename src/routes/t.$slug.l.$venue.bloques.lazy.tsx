import { createLazyFileRoute } from '@tanstack/react-router'

import { SchedulingBlocksPage } from '@/features/scheduling'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/bloques')({
  component: BlocksRoute,
})

function BlocksRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <SchedulingBlocksPage tenantId={tenant.id} venueId={venue.id} />
}
