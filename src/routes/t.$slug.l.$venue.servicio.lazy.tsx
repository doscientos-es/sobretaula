import { createLazyFileRoute } from '@tanstack/react-router'

import { ServicePage } from '@/features/service'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/servicio')({
  component: ServiceRoute,
})

function ServiceRoute() {
  const { board, plan, tenant, venue } = Route.useLoaderData()
  const { slug: tenantSlug, venue: venueSlug } = Route.useParams()

  return (
    <ServicePage
      board={board}
      plan={plan}
      tenantId={tenant.id}
      venueId={venue.id}
      tenantSlug={tenantSlug}
      venueSlug={venueSlug}
    />
  )
}
