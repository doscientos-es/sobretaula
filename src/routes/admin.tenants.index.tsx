import { createFileRoute, redirect } from '@tanstack/react-router'

import { getPlatformDashboard, PlatformTenantsPage } from '@/features/platform-admin'

export const Route = createFileRoute('/admin/tenants/')({
  loader: async () => {
    try {
      return await getPlatformDashboard()
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/admin/tenants' } })
      }
      throw error
    }
  },
  component: PlatformTenantsRoute,
})

function PlatformTenantsRoute() {
  return <PlatformTenantsPage tenants={Route.useLoaderData().tenants} />
}
