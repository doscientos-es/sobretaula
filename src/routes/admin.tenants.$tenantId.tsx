import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import {
  getPlatformAuditLog,
  getPlatformTenantDetail,
  PlatformTenantDetailsPage,
} from '@/features/platform-admin'

export const Route = createFileRoute('/admin/tenants/$tenantId')({
  loader: ({ params }) =>
    loadPlatformRoute(`/admin/tenants/${params.tenantId}`, async () => {
      const [tenant, auditEvents] = await Promise.all([
        getPlatformTenantDetail({ data: { tenantId: params.tenantId } }),
        getPlatformAuditLog({ data: { tenantId: params.tenantId } }),
      ])
      return { auditEvents, tenant }
    }),
  component: PlatformTenantDetailsRoute,
  ...platformRouteState,
})

function PlatformTenantDetailsRoute() {
  const { auditEvents, tenant } = Route.useLoaderData()
  return <PlatformTenantDetailsPage auditEvents={auditEvents} tenant={tenant} />
}
