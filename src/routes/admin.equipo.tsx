import { createFileRoute, redirect } from '@tanstack/react-router'

import { getPlatformOperators, PlatformOperatorsPage } from '@/features/platform-admin'

export const Route = createFileRoute('/admin/equipo')({
  loader: async () => {
    try {
      return await getPlatformOperators()
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/admin/equipo' } })
      }
      throw error
    }
  },
  component: PlatformOperatorsRoute,
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
