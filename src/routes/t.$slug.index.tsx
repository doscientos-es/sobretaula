import { useQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { dashboardMetricsQuery, tenantSetupStatusQuery, TenantHomePage } from '@/features/tenancy'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/')({
  component: TenantHomeRoute,
})

function TenantHomeRoute() {
  const { tenant, venues } = tenantRoute.useLoaderData()
  const venueIds = venues.map((venue) => venue.id)
  const metrics = useQuery(dashboardMetricsQuery(tenant.id, venueIds))
  const setupStatus = useQuery(tenantSetupStatusQuery(tenant.id, venueIds))

  if (metrics.isPending || setupStatus.isPending) return <TenantRoutePending />
  if (metrics.error) throw metrics.error
  if (setupStatus.error) throw setupStatus.error

  return (
    <TenantHomePage
      metrics={metrics.data}
      setupStatus={setupStatus.data}
      tenant={tenant}
      venues={venues}
    />
  )
}
