import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'

import { PlatformAdminFrame } from '@/app/platform-admin-frame'
import { loadPlatformRoute } from '@/app/platform-route-loader'
import {
  getPlatformAdminAccess,
  PlatformRouteError,
  PlatformRoutePending,
} from '@/features/platform-admin'

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ location }) => {
    if (location.pathname === '/admin/invitacion') return
    return loadPlatformRoute('/admin', () => getPlatformAdminAccess())
  },
  component: PlatformAdminLayout,
  errorComponent: PlatformRouteError,
  pendingComponent: PlatformRoutePending,
  pendingMs: 200,
})

function PlatformAdminLayout() {
  const isInvitationRoute = useRouterState({
    select: (state) => state.location.pathname === '/admin/invitacion',
  })
  if (isInvitationRoute) return <Outlet />

  return (
    <PlatformAdminFrame>
      <Outlet />
    </PlatformAdminFrame>
  )
}
