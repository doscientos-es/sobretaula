import { createFileRoute, redirect } from '@tanstack/react-router'

import {
  getPlatformAuditLog,
  getPlatformTenantDetail,
  PlatformTenantDetailsPage,
} from '@/features/platform-admin'

export const Route = createFileRoute('/admin/tenants/$tenantId')({
  loader: async ({ params }) => {
    try {
      const [tenant, auditEvents] = await Promise.all([
        getPlatformTenantDetail({ data: { tenantId: params.tenantId } }),
        getPlatformAuditLog({ data: { tenantId: params.tenantId } }),
      ])
      return { auditEvents, tenant }
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
  const { auditEvents, tenant } = Route.useLoaderData()
  return <PlatformTenantDetailsPage auditEvents={auditEvents} tenant={tenant} />
}
