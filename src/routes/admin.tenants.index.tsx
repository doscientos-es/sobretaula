import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import { getPlatformDashboard, PlatformTenantsPage } from '@/features/platform-admin'

export const Route = createFileRoute('/admin/tenants/')({
  loader: () => loadPlatformRoute('/admin/tenants', () => getPlatformDashboard()),
  component: PlatformTenantsRoute,
  ...platformRouteState,
})

function PlatformTenantsRoute() {
  return <PlatformTenantsPage tenants={Route.useLoaderData().tenants} />
}
