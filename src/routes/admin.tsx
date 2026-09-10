import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'

import { PlatformAdminFrame } from '@/app/platform-admin-frame'
import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import { getPlatformAdminAccess } from '@/features/platform-admin'

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ location }) => {
    if (location.pathname === '/admin/invitacion') return
    return loadPlatformRoute('/admin', () => getPlatformAdminAccess())
  },
  component: PlatformAdminLayout,
  ...platformRouteState,
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
