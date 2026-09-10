import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute } from '@/app/platform-route-loader'
import {
  getPlatformDashboard,
  PlatformRouteError,
  PlatformRoutePending,
  PlatformTenantsPage,
} from '@/features/platform-admin'

export const Route = createFileRoute('/admin/tenants/')({
  loader: () => loadPlatformRoute('/admin/tenants', () => getPlatformDashboard()),
  component: PlatformTenantsRoute,
  errorComponent: PlatformRouteError,
  pendingComponent: PlatformRoutePending,
  pendingMs: 200,
})

function PlatformTenantsRoute() {
  return <PlatformTenantsPage tenants={Route.useLoaderData().tenants} />
}
