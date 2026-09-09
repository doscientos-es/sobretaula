import { DataViewState, DataViewStateDescription, DataViewStateTitle } from '@doscientos/ui'
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'

import { getTenantBySlug, requireTenantRouteAccess } from '@/features/tenancy'
import { getTenantVenues, resolveVenue } from '@/features/venues'
import { DEFAULT_LOCALE } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'
import { parseVenueSlug } from '@/shared/lib/tenant/venue-slug'

/**
 * Resolves the addressed local once so every child route works with an id the
 * server has already validated against the caller's access.
 */
export const Route = createFileRoute('/t/$slug/l/$venue')({
  beforeLoad: async ({ context, params }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'operations')
    const venueSlug = parseVenueSlug(params.venue)
    if (!venueSlug) throw notFound()

    const tenant = await getTenantBySlug({ data: { slug: params.slug } })
    if (!tenant) throw notFound()

    const venues = await getTenantVenues({ data: { tenantId: tenant.id } })
    const venue = resolveVenue(venues, venueSlug)
    if (!venue) throw notFound()

    return { tenant, venue }
  },
  component: VenueLayout,
  notFoundComponent: VenueNotFound,
})

function VenueLayout() {
  return <Outlet />
}

function VenueNotFound() {
  const t = createTranslator(DEFAULT_LOCALE)

  return (
    <DataViewState>
      <DataViewStateTitle>{t('venue.notFound.title')}</DataViewStateTitle>
      <DataViewStateDescription>{t('venue.notFound.description')}</DataViewStateDescription>
    </DataViewState>
  )
}
