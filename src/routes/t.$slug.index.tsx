import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { TenantHomePage } from '@/features/tenancy'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/')({
  component: TenantHomeRoute,
})

function TenantHomeRoute() {
  const { metrics, tenant, venues } = tenantRoute.useLoaderData()

  return <TenantHomePage metrics={metrics} tenant={tenant} venues={venues} />
}
