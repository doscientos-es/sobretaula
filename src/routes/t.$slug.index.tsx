import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { TenantHomePage } from '@/features/tenancy'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/')({
  component: TenantHomeRoute,
})

function TenantHomeRoute() {
  const { metrics, setupStatus, tenant, venues } = tenantRoute.useLoaderData()

  return (
    <TenantHomePage metrics={metrics} setupStatus={setupStatus} tenant={tenant} venues={venues} />
  )
}
