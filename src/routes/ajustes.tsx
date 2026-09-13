import { createFileRoute, redirect } from '@tanstack/react-router'

import { getCurrentUser } from '@/features/auth'
import { SettingsPage } from '@/features/settings'

export const Route = createFileRoute('/ajustes')({
  loader: async () => {
    try {
      return await getCurrentUser()
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/ajustes' } })
      }
      throw error
    }
  },
  component: SettingsRoute,
})

function SettingsRoute() {
  return <SettingsPage user={Route.useLoaderData()} />
}
