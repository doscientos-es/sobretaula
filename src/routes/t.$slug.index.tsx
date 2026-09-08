import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { TenantHomePage } from '@/features/tenancy'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/')({
  component: TenantHomeRoute,
})

function TenantHomeRoute() {
  const { tenant } = tenantRoute.useLoaderData()

  return <TenantHomePage tenant={tenant} />
}
