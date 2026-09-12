import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { requireTenantRouteAccess } from '@/features/tenancy'
import { VenueCreatePage } from '@/features/venues'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/l/nuevo')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'venue_management')
  },
  component: VenueCreateRoute,
})

function VenueCreateRoute() {
  const { tenant } = tenantRoute.useLoaderData()
  const locale = useLocale(tenant.defaultLocale)

  return (
    <VenueCreatePage locale={locale} tenantId={tenant.id} tenantSlug={tenant.slug} />
  )
}
