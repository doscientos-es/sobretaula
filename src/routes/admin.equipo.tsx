import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute } from '@/app/platform-route-loader'
import {
  getPlatformOperators,
  PlatformOperatorsPage,
  PlatformRouteError,
  PlatformRoutePending,
} from '@/features/platform-admin'

export const Route = createFileRoute('/admin/equipo')({
  loader: () => loadPlatformRoute('/admin/equipo', () => getPlatformOperators()),
  component: PlatformOperatorsRoute,
  errorComponent: PlatformRouteError,
  pendingComponent: PlatformRoutePending,
  pendingMs: 200,
})

function PlatformOperatorsRoute() {
  const directory = Route.useLoaderData()
  return (
    <PlatformOperatorsPage
      currentUserId={directory.currentUserId}
      invitations={directory.invitations}
      operators={directory.operators}
    />
  )
}
