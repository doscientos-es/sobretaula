import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute } from '@/app/platform-route-loader'
import {
  getPlatformAuditLog,
  PlatformAuditPage,
  PlatformRouteError,
  PlatformRoutePending,
} from '@/features/platform-admin'

export const Route = createFileRoute('/admin/auditoria')({
  loader: () => loadPlatformRoute('/admin/auditoria', () => getPlatformAuditLog({ data: {} })),
  component: PlatformAuditRoute,
  errorComponent: PlatformRouteError,
  pendingComponent: PlatformRoutePending,
  pendingMs: 200,
})

function PlatformAuditRoute() {
  return <PlatformAuditPage events={Route.useLoaderData()} />
}
