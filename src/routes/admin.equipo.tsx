import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import { getPlatformOperators, PlatformOperatorsPage } from '@/features/platform-admin'

export const Route = createFileRoute('/admin/equipo')({
  loader: () => loadPlatformRoute('/admin/equipo', () => getPlatformOperators()),
  component: PlatformOperatorsRoute,
  ...platformRouteState,
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
