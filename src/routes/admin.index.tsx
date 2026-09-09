import { createFileRoute, redirect } from '@tanstack/react-router'

import { getPlatformDashboard, PlatformConsolePage } from '@/features/platform-admin'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    try {
      return await getPlatformDashboard()
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/admin' } })
      }
      throw error
    }
  },
  component: PlatformConsole,
})

function PlatformConsole() {
  return <PlatformConsolePage dashboard={Route.useLoaderData()} />
}
