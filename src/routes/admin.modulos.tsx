import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import {
  getPlatformModules,
  getPlatformDashboard,
  PlatformModulesPage,
} from '@/features/platform-admin'

export const Route = createFileRoute('/admin/modulos')({
  loader: () =>
    loadPlatformRoute('/admin/modulos', async () => {
      const [modules, dashboard] = await Promise.all([getPlatformModules(), getPlatformDashboard()])
      return {
        modules,
        tenants: dashboard.tenants.map(({ id, name, slug }) => ({ id, name, slug })),
      }
    }),
  component: PlatformModulesRoute,
  ...platformRouteState,
})

function PlatformModulesRoute() {
  const { modules, tenants } = Route.useLoaderData()
  return <PlatformModulesPage initialModules={modules} tenants={tenants} />
}
