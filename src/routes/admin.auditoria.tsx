import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import { getPlatformAuditLog, PlatformAuditPage } from '@/features/platform-admin'

export const Route = createFileRoute('/admin/auditoria')({
  loader: () => loadPlatformRoute('/admin/auditoria', () => getPlatformAuditLog({ data: {} })),
  component: PlatformAuditRoute,
  ...platformRouteState,
})

function PlatformAuditRoute() {
  return <PlatformAuditPage events={Route.useLoaderData()} />
}
