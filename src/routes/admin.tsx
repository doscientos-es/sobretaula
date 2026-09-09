import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'

import { PlatformAdminFrame } from '@/app/platform-admin-frame'
import { getPlatformAdminAccess } from '@/features/platform-admin'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/admin/invitacion') return
    try {
      await getPlatformAdminAccess()
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/admin' } })
      }
      throw error
    }
  },
  component: PlatformAdminLayout,
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
