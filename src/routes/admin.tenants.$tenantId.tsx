import { createFileRoute, redirect } from '@tanstack/react-router'

import { getPlatformTenantDetail, PlatformTenantDetailsPage } from '@/features/platform-admin'

export const Route = createFileRoute('/admin/tenants/$tenantId')({
  loader: async ({ params }) => {
    try {
      return await getPlatformTenantDetail({ data: { tenantId: params.tenantId } })
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: `/admin/tenants/${params.tenantId}` } })
      }
      throw error
    }
  },
  component: PlatformTenantDetailsRoute,
})

function PlatformTenantDetailsRoute() {
  return <PlatformTenantDetailsPage tenant={Route.useLoaderData()} />
}
