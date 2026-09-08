import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { VenueCreatePage } from '@/features/venues'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/l/nuevo')({
  component: VenueCreateRoute,
})

function VenueCreateRoute() {
  const { tenant } = tenantRoute.useLoaderData()

  return (
    <VenueCreatePage
      locale={tenant.defaultLocale}
      tenantId={tenant.id}
      tenantSlug={tenant.slug}
    />
  )
}
